import test from 'node:test';
import assert from 'node:assert/strict';
import { roster, assessment, student, updateStudent } from './classroom-fixture.js';
import { createWorld, register, ok, problem, classes, write } from './helpers.js';

test('班级：学号唯一，换班移除原座位并升版，归档按班级/学生/记录逐级恢复', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const c = ok(await write(client, 'POST', `${classes}/classes`, { name: '一班' }), 201);
  const d = ok(await write(client, 'POST', `${classes}/classes`, { name: '二班' }), 201);
  const s = ok(await write(client, 'POST', `${classes}/students`, student(c.id, '甲', '001')), 201);
  problem(await write(client, 'POST', `${classes}/students`, student(c.id, '乙', '001')), 409, 'classroom-student-number-conflict');
  const seating = ok(await write(client, 'PUT', `${classes}/classes/${c.id}/seating`, { baseVersion: c.version, seating: { rows: 2, columns: 2, seats: [{ row: 1, column: 1, studentId: s.id }] } }));
  const moved = ok(await write(client, 'PUT', `${classes}/students/${s.id}`, { ...updateStudent(s), classId: d.id, baseVersion: s.version }));
  const former = ok(await client.request('GET', `${classes}/classes/${c.id}`));
  assert.deepEqual(former.seating.seats, []);
  assert.equal(former.version, seating.version + 1, '换班使旧座位布局升版');
  const record = ok(await write(client, 'POST', `${classes}/records`, { scope: 'student', subjectId: s.id, occurredOn: '2026-01-05', text: '保留课堂观察' }), 201);
  const rdel = ok(await write(client, 'PUT', `${classes}/records/${record.id}/deletion`, { baseVersion: 1, deleted: true }));
  const sdel = ok(await write(client, 'PUT', `${classes}/students/${s.id}/deletion`, { baseVersion: moved.version, deleted: true }));
  const dcurrent = ok(await client.request('GET', `${classes}/classes/${d.id}`));
  const ddel = ok(await write(client, 'PUT', `${classes}/classes/${d.id}/deletion`, { baseVersion: dcurrent.version, deleted: true }));
  assert.equal(ok(await client.request('GET', `${classes}/records?deleted=deleted`)).items[0].id, record.id, '归档父级下记录仍能查到');
  problem(await write(client, 'PUT', `${classes}/students/${s.id}/deletion`, { baseVersion: sdel.version, deleted: false }), 409, 'classroom-restore-class-required');
  ok(await write(client, 'PUT', `${classes}/classes/${d.id}/deletion`, { baseVersion: ddel.version, deleted: false }));
  problem(await write(client, 'PUT', `${classes}/records/${record.id}/deletion`, { baseVersion: rdel.version, deleted: false }), 409, 'classroom-restore-student-required');
  ok(await write(client, 'PUT', `${classes}/students/${s.id}/deletion`, { baseVersion: sdel.version, deleted: false }));
  assert.equal(ok(await write(client, 'PUT', `${classes}/records/${record.id}/deletion`, { baseVersion: rdel.version, deleted: false })).id, record.id);
});

test('成绩：真实工作簿确认原子且幂等，零分/缺总分/缺考/未记录有独立统计，历史姓名换班后保持', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const { c, students } = await roster(client);
  const { exam, tag, q, mapped } = await assessment(client, c, students);
  assert.equal(mapped.rows[0].studentId, students[0].id, '前导零学号正确匹配');
  assert.equal(mapped.rows[2].totalScore, 0, '0 分不是空白');
  const confirmation = { baseVersion: mapped.version };
  const key = '16c50897-f608-40a6-9122-5a3315ea0376';
  const confirmed = ok(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, confirmation, key));
  assert.deepEqual(ok(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, confirmation, key)), confirmed);
  assert.equal(ok(await client.request('GET', `${classes}/results?examId=${exam.id}`)).items.length, 1, '重试只生成一份班级成绩');
  const stats = ok(await client.request('GET', `${classes}/classes/${c.id}/statistics`));
  const point = stats.points[0], overall = point.overall;
  assert.equal(overall.scoredCount, 3);
  assert.equal(overall.mean, 200 / 3, '均分只包含100、100、0');
  assert.equal(overall.missingTotalCount, 1);
  assert.equal(overall.absentCount, 1);
  assert.equal(overall.unrecordedCount, 1);
  assert.equal(overall.distribution[0].count, 1, '缺分和缺考不进入零分档');
  assert.equal(overall.distribution[9].count, 2, '满分进入最后一档');
  assert.equal(point.questions[0].observedCount, 4);
  assert.equal(point.questions[0].rate, 230 / 400, '单题分母仅已知人数');
  const ranks = [];
  for (const s of students.slice(0, 3)) ranks.push(ok(await client.request('GET', `${classes}/students/${s.id}/statistics`)).points[0].overall.rank);
  assert.deepEqual(ranks, [1, 1, 3], '同分排名必须跳名次');
  const newClass = ok(await write(client, 'POST', `${classes}/classes`, { name: '转入班级' }), 201);
  const changed = ok(await write(client, 'PUT', `${classes}/students/${students[0].id}`, { ...updateStudent(students[0]), classId: newClass.id, name: '改名后', baseVersion: students[0].version }));
  assert.equal(changed.name, '改名后');
  assert.equal(ok(await client.request('GET', `${classes}/results/${confirmed.result.id}`)).rows.find(row => row.studentId === students[0].id).studentSnapshot.name, '甲', '成绩保留考试时姓名');
  assert.equal(ok(await client.request('GET', `${classes}/students/${students[0].id}/statistics`)).points[0].overall.classReference.id, c.id, '换班后统计仍使用考试时班级');
  const tag2 = ok(await write(client, 'POST', `${classes}/tags`, { name: '综合' }), 201);
  const merged = ok(await write(client, 'POST', `${classes}/tags/${tag.id}/merge`, { baseVersion: tag.version, targetId: tag2.id, targetVersion: tag2.version }));
  assert.ok(merged.affectedExamIds.includes(exam.id));
  const afterMerge = ok(await client.request('GET', `${classes}/exams/${exam.id}`));
  assert.deepEqual(afterMerge.questions.find(x => x.id === q).tagIds, [tag2.id]);
  assert.equal(afterMerge.version, exam.version + 1);
  const finalTag = ok(await write(client, 'POST', `${classes}/tags`, { name: '最终标签' }), 201);
  ok(await write(client, 'POST', `${classes}/tags/${tag2.id}/merge`, { baseVersion: tag2.version, targetId: finalTag.id, targetVersion: finalTag.version }));
  assert.equal(ok(await client.request('GET', `${classes}/tags/${tag.id}`)).mergedIntoId, finalTag.id, '连续合并把既有别名单跳指向最终目标');
  assert.deepEqual(ok(await client.request('GET', `${classes}/exams/${exam.id}`)).questions[0].tagIds, [finalTag.id]);
});

test('成绩：确认时重核学生版本，冲突不留部分成绩', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const { c, students } = await roster(client);
  const { mapped, exam } = await assessment(client, c, students);
  ok(await write(client, 'PUT', `${classes}/students/${students[0].id}`, { ...updateStudent(students[0]), description: '后来更新', baseVersion: 1 }));
  problem(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, { baseVersion: mapped.version }), 409, 'classroom-import-baseline-conflict');
  assert.deepEqual(ok(await client.request('GET', `${classes}/results?examId=${exam.id}`)).items, [], '基线冲突不能部分提交');
  assert.equal(ok(await client.request('GET', `${classes}/imports/${mapped.id}`)).state, 'draft');
});

test('成绩事务：回执写入失败回滚成绩和确认态，原键恢复后只确认一份结果', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const { c, students } = await roster(client);
  const { mapped, exam } = await assessment(client, c, students);
  const key = '7bbd1c3e-41fb-4f3f-859a-c6f23d9a0a0a', body = { baseVersion: mapped.version };
  world.app.workbench.db.exec(`CREATE TRIGGER rebuilt_reject_assessment BEFORE INSERT ON workbench_mutation_keys
    WHEN NEW.path LIKE '%/confirmation' BEGIN SELECT RAISE(ABORT, 'assessment receipt unavailable'); END`);
  problem(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, body, key), 503, 'temporarily-unavailable');
  assert.deepEqual(ok(await client.request('GET', `${classes}/results?examId=${exam.id}`)).items, []);
  assert.equal(ok(await client.request('GET', `${classes}/imports/${mapped.id}`)).state, 'draft');
  world.app.workbench.db.exec('DROP TRIGGER rebuilt_reject_assessment');
  const confirmed = ok(await write(client, 'POST', `${classes}/imports/${mapped.id}/confirmation`, body, key));
  assert.equal(confirmed.import.state, 'confirmed');
  assert.equal(ok(await client.request('GET', `${classes}/results?examId=${exam.id}`)).items.length, 1);
});
