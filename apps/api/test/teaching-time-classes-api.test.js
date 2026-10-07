// T51 data-side integration coverage for classes, records and material links
// over the frozen workbench seam. Cases map to TT-C1/C5 and WB-T001, WB-T002,
// WB-T003, WB-T017, WB-T018, WB-T019 in docs/acceptance/teaching-time.feature.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProblem,
  classSample,
  createTeachingTimeClassesHarness,
  lessonSample,
  questionSample,
  recordSample
} from './teaching-time-classes-harness.js';

const CLASSES = '/api/modules/classes/items';
const RECORDS = '/api/modules/classes/records';
const SOURCE_RECORDS = '/api/modules/classes/source-records';
const QUESTIONS = '/api/modules/questions/items';
const LESSONS = '/api/modules/lessons/items';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function withHarness(run) {
  const harness = await createTeachingTimeClassesHarness();
  try {
    return await run(harness);
  } finally {
    await harness.close();
  }
}

async function seedClass(harness, api, name) {
  const created = await api.post(CLASSES, classSample({ name }), { key: harness.nextUuid() }).expect(201);
  return created.body;
}

async function seedQuestion(harness, api, overrides = {}) {
  const created = await api.post(QUESTIONS, questionSample(overrides), { key: harness.nextUuid() }).expect(201);
  return created.body;
}

async function seedLesson(harness, api, overrides = {}) {
  const created = await api.post(LESSONS, lessonSample(overrides), { key: harness.nextUuid() }).expect(201);
  return created.body;
}

function updatePayload(record, overrides = {}) {
  return {
    expectedVersion: record.version,
    classId: record.classId,
    recordedOn: record.recordedOn,
    note: record.note,
    position: record.position,
    unfinished: record.unfinished,
    commonIssues: record.commonIssues,
    nextNote: record.nextNote,
    sources: record.sources.map((source) => ({ kind: source.kind, id: source.id })),
    ...overrides
  };
}

test('TT-C1/WB-T001: 班级只有名称，可建可改名可删可恢复，重复名允许', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));

    const created = await api.post(CLASSES, classSample(), { key: harness.nextUuid() }).expect(201);
    assert.equal(created.headers['cache-control'], 'no-store');
    assert.match(created.body.id, UUID_PATTERN);
    assert.equal(created.body.version, 1);
    assert.equal(created.body.deletedAt, null);
    assert.equal(created.body.name, '高一(1)班');
    assert.equal(created.body.createdAt, harness.nowIso());
    assert.equal(created.body.updatedAt, harness.nowIso());

    const duplicateName = await api.post(CLASSES, classSample(), { key: harness.nextUuid() }).expect(201);
    assert.notEqual(duplicateName.body.id, created.body.id);

    const renamed = await api.put(`${CLASSES}/${created.body.id}`, {
      expectedVersion: 1,
      name: '高一(1)班 A'
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(renamed.body.version, 2);
    assert.equal(renamed.body.name, '高一(1)班 A');
    assert.equal(renamed.body.id, created.body.id);

    const blank = await api.post(CLASSES, classSample({ name: '   ' }), { key: harness.nextUuid() }).expect(422);
    assertProblem(blank, 422, '/problems/workbench/invalid-input');
    assert.equal(blank.body.field, '/name');
    assert.equal(blank.body.reason, 'out-of-range');

    const unknownField = await api.post(CLASSES, { name: 'x', students: [] }, { key: harness.nextUuid() }).expect(422);
    assert.equal(unknownField.body.field, '/students');
    assert.equal(unknownField.body.reason, 'unknown-field');

    const deleted = await api.post(`${CLASSES}/${created.body.id}/deletion`, {
      expectedVersion: 2,
      deleted: true
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(deleted.body.version, 3);
    assert.notEqual(deleted.body.deletedAt, null);

    const repeatDelete = await api.post(`${CLASSES}/${created.body.id}/deletion`, {
      expectedVersion: 3,
      deleted: true
    }, { key: harness.nextUuid() }).expect(409);
    assertProblem(repeatDelete, 409, '/problems/workbench/object-deleted');

    const deletedList = await api.get(CLASSES).query({ state: 'deleted' }).expect(200);
    assert.deepEqual(deletedList.body.items.map((item) => item.id), [created.body.id]);
    const activeList = await api.get(CLASSES).expect(200);
    assert.deepEqual(activeList.body.items.map((item) => item.id), [duplicateName.body.id]);

    const restored = await api.post(`${CLASSES}/${created.body.id}/deletion`, {
      expectedVersion: 3,
      deleted: false
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(restored.body.version, 4);
    assert.equal(restored.body.deletedAt, null);

    const byName = await api.get(CLASSES).expect(200);
    assert.deepEqual(
      byName.body.items.map((item) => item.name),
      ['高一(1)班', '高一(1)班 A']
    );

    const tombstoneRead = await api.get(`${CLASSES}/${created.body.id}`).expect(200);
    assert.equal(tombstoneRead.body.deletedAt, null);
    const unknownQuery = await api.get(CLASSES).query({ name: 'x' }).expect(422);
    assert.equal(unknownQuery.body.field, '/query/name');
  });
});

test('TT-C1/WB-T001: 一句话就是一条有效记录，刷新与保留库重启后仍在', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await seedClass(harness, api, '高一(1)班');

    const quick = await api.post(RECORDS, recordSample(classroom.id), { key: harness.nextUuid() }).expect(201);
    assert.match(quick.body.id, UUID_PATTERN);
    assert.equal(quick.body.version, 1);
    assert.equal(quick.body.classId, classroom.id);
    assert.equal(quick.body.recordedOn, '2026-09-21');
    assert.equal(quick.body.note, '例2没讲，任意性还需强调');
    assert.deepEqual(quick.body.sources, []);
    assert.equal(quick.body.createdAt, harness.nowIso());

    const listed = await api.get(RECORDS).query({ classId: classroom.id }).expect(200);
    assert.deepEqual(listed.body.items.map((item) => item.note), ['例2没讲，任意性还需强调']);

    await harness.restart();
    const afterRestart = harness.agent(harness.createAccount('teacher-a'));
    const readBack = await afterRestart.get(`${RECORDS}/${quick.body.id}`).expect(200);
    assert.deepEqual(readBack.body, quick.body);
    const listAfterRestart = await afterRestart.get(RECORDS).query({ classId: classroom.id }).expect(200);
    assert.equal(listAfterRestart.body.items.length, 1);

    // No progress, category, link or completion status is required.
    const missingClass = await api.get(RECORDS).expect(422);
    assert.equal(missingClass.body.field, '/query/classId');
    assert.equal(missingClass.body.reason, 'required');
  });
});

test('TT-C1/WB-T002: 补充实际位置、按班级隔离并按日期排序', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const first = await seedClass(harness, api, '高一(1)班');
    const second = await seedClass(harness, api, '高一(2)班');

    const older = await api.post(RECORDS, recordSample(first.id, {
      recordedOn: '2026-09-19',
      note: '第一天'
    }), { key: harness.nextUuid() }).expect(201);
    const newer = await api.post(RECORDS, recordSample(first.id, {
      recordedOn: '2026-09-21',
      note: '第二天'
    }), { key: harness.nextUuid() }).expect(201);
    const otherClass = await api.post(RECORDS, recordSample(second.id, {
      recordedOn: '2026-09-20',
      note: '二班记录'
    }), { key: harness.nextUuid() }).expect(201);

    const completed = await api.put(`${RECORDS}/${older.body.id}`, updatePayload(older.body, {
      position: '定义讲完',
      unfinished: '例2',
      commonIssues: '忽略任意性',
      nextNote: '下节先辨析反例'
    }), { key: harness.nextUuid() }).expect(200);
    assert.equal(completed.body.version, 2);
    assert.equal(completed.body.position, '定义讲完');
    assert.equal(completed.body.unfinished, '例2');
    assert.equal(completed.body.commonIssues, '忽略任意性');
    assert.equal(completed.body.nextNote, '下节先辨析反例');
    assert.equal(completed.body.note, '第一天');

    const firstList = await api.get(RECORDS).query({ classId: first.id }).expect(200);
    assert.deepEqual(firstList.body.items.map((item) => item.id), [newer.body.id, older.body.id]);
    const secondList = await api.get(RECORDS).query({ classId: second.id }).expect(200);
    assert.deepEqual(secondList.body.items.map((item) => item.id), [otherClass.body.id]);

    // Same recordedOn: updatedAt desc decides (server ids are random, so a tie
    // would only be broken by id and could not be asserted from outside).
    harness.advance(60_000);
    const sameDayLate = await api.post(RECORDS, recordSample(first.id, {
      recordedOn: '2026-09-21',
      note: '后保存'
    }), { key: harness.nextUuid() }).expect(201);
    const sameDayList = await api.get(RECORDS).query({ classId: first.id }).expect(200);
    assert.deepEqual(sameDayList.body.items.map((item) => item.id), [sameDayLate.body.id, newer.body.id, older.body.id]);

    // A record belongs to one class for its whole life.
    const moved = await api.put(`${RECORDS}/${older.body.id}`, updatePayload(completed.body, {
      classId: second.id
    }), { key: harness.nextUuid() }).expect(409);
    assertProblem(moved, 409, '/problems/workbench/class-mismatch');
    const stillThere = await api.get(`${RECORDS}/${older.body.id}`).expect(200);
    assert.equal(stillThere.body.classId, first.id);
    assert.equal(stillThere.body.version, 2);

    // All five texts blank: nothing to save.
    const blank = await api.post(RECORDS, recordSample(first.id, { note: '   ' }), { key: harness.nextUuid() }).expect(422);
    assert.equal(blank.body.field, '/note');
    assert.equal(blank.body.reason, 'empty-content');

    const badDate = await api.post(RECORDS, recordSample(first.id, { recordedOn: '2026-02-30' }), { key: harness.nextUuid() }).expect(422);
    assert.equal(badDate.body.field, '/recordedOn');
    assert.equal(badDate.body.reason, 'out-of-range');

    const outOfRangeDate = await api.post(RECORDS, recordSample(first.id, { recordedOn: '2101-01-01' }), { key: harness.nextUuid() }).expect(422);
    assert.equal(outOfRangeDate.body.field, '/recordedOn');

    const badClass = await api.post(RECORDS, recordSample('99999999-0000-4000-8000-000000000001'), { key: harness.nextUuid() }).expect(404);
    assertProblem(badClass, 404, '/problems/workbench/not-found');
  });
});

test('TT-C1/WB-T003/WB-T019: 备课链接保存时标题，两班反馈独立，改删来源不破坏记录', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const first = await seedClass(harness, api, '高一(1)班');
    const second = await seedClass(harness, api, '高一(2)班');
    const lesson = await seedLesson(harness, api, { title: '函数单调性' });
    const question = await seedQuestion(harness, api, { title: '例1' });

    const firstRecord = await api.post(RECORDS, recordSample(first.id, {
      sources: [{ kind: 'lesson', id: lesson.id }]
    }), { key: harness.nextUuid() }).expect(201);
    assert.deepEqual(firstRecord.body.sources, [{
      kind: 'lesson',
      id: lesson.id,
      labelAtLink: '函数单调性',
      currentLabel: '函数单调性',
      deleted: false
    }]);

    const secondRecord = await api.post(RECORDS, recordSample(second.id, {
      recordedOn: '2026-09-20',
      note: '二班也用了这份备课',
      sources: [{ kind: 'lesson', id: lesson.id }, { kind: 'question', id: question.id }]
    }), { key: harness.nextUuid() }).expect(201);

    const feedback = await api.get(`${SOURCE_RECORDS}/lesson/${lesson.id}`).expect(200);
    assert.deepEqual(feedback.body.items.map((item) => item.id), [firstRecord.body.id, secondRecord.body.id]);
    assert.deepEqual(feedback.body.items.map((item) => item.classId), [first.id, second.id]);
    assert.equal(feedback.body.items[0].note, '例2没讲，任意性还需强调');
    assert.equal(feedback.body.items[1].note, '二班也用了这份备课');

    // Renaming the lesson updates currentLabel, never the saved label or the text.
    await api.put(`${LESSONS}/${lesson.id}`, {
      baseVersion: lesson.version,
      title: '函数单调性（修订）',
      intro: lesson.intro,
      sections: lesson.sections,
      materials: lesson.materials
    }, { key: harness.nextUuid() }).expect(200);

    const afterRename = await api.get(`${RECORDS}/${firstRecord.body.id}`).expect(200);
    assert.equal(afterRename.body.note, '例2没讲，任意性还需强调');
    assert.equal(afterRename.body.version, 1);
    assert.equal(afterRename.body.sources[0].labelAtLink, '函数单调性');
    assert.equal(afterRename.body.sources[0].currentLabel, '函数单调性（修订）');
    assert.equal(afterRename.body.sources[0].deleted, false);

    // Resubmitting the same link keeps the saved labelAtLink.
    const resubmitted = await api.put(`${RECORDS}/${firstRecord.body.id}`, updatePayload(afterRename.body, {
      position: '定义讲完'
    }), { key: harness.nextUuid() }).expect(200);
    assert.equal(resubmitted.body.version, 2);
    assert.equal(resubmitted.body.sources[0].labelAtLink, '函数单调性');

    // Deleting the lesson keeps the link readable and rejects a new link.
    await api.post(`${LESSONS}/${lesson.id}/deletion`, {
      baseVersion: 2,
      deleted: true
    }, { key: harness.nextUuid() }).expect(200);
    const afterDelete = await api.get(`${RECORDS}/${firstRecord.body.id}`).expect(200);
    assert.equal(afterDelete.body.note, '例2没讲，任意性还需强调');
    assert.equal(afterDelete.body.sources[0].deleted, true);
    assert.equal(afterDelete.body.sources[0].labelAtLink, '函数单调性');

    const newLinkToDeleted = await api.post(RECORDS, recordSample(second.id, {
      note: '想连已删备课',
      sources: [{ kind: 'lesson', id: lesson.id }]
    }), { key: harness.nextUuid() }).expect(409);
    assertProblem(newLinkToDeleted, 409, '/problems/workbench/reference-deleted');
    assert.equal(harness.countRows('classes_records'), 2, 'no partial record survives the rejected link');

    // Feedback for a deleted source is still queryable.
    const deletedFeedback = await api.get(`${SOURCE_RECORDS}/lesson/${lesson.id}`).expect(200);
    assert.deepEqual(deletedFeedback.body.items.map((item) => item.id), [firstRecord.body.id, secondRecord.body.id]);

    // The lesson body was never touched by feedback.
    const lessonAfter = await api.get(`${LESSONS}/${lesson.id}`).expect(200);
    assert.equal(lessonAfter.body.version, 3);
    assert.equal(lessonAfter.body.deletedAt !== null, true);

    // Duplicate kind+id is rejected before any write.
    const duplicate = await api.post(RECORDS, recordSample(first.id, {
      note: '重复链接',
      sources: [{ kind: 'question', id: question.id }, { kind: 'question', id: question.id }]
    }), { key: harness.nextUuid() }).expect(422);
    assert.equal(duplicate.body.field, '/sources/1/id');
    assert.equal(duplicate.body.reason, 'duplicate-id');

    // Foreign sources are a uniform 404 without leaking the other account.
    const other = harness.agent(harness.createAccount('teacher-b'));
    const foreignRead = await other.get(`${RECORDS}/${firstRecord.body.id}`).expect(404);
    assertProblem(foreignRead, 404, '/problems/workbench/not-found');
    const foreignSource = await api.post(RECORDS, recordSample(first.id, {
      note: '外账户来源',
      sources: [{ kind: 'question', id: '99999999-0000-4000-8000-000000000002' }]
    }), { key: harness.nextUuid() }).expect(404);
    assertProblem(foreignSource, 404, '/problems/workbench/not-found');
  });
});

test('TT-C1.6/WB-T002/WB-T019: 删班记录只读，恢复保留原 ID 与来源，记录单独恢复', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await seedClass(harness, api, '高一(1)班');
    const lesson = await seedLesson(harness, api, { title: '函数单调性' });
    const record = await api.post(RECORDS, recordSample(classroom.id, {
      sources: [{ kind: 'lesson', id: lesson.id }]
    }), { key: harness.nextUuid() }).expect(201);

    const deletedClass = await api.post(`${CLASSES}/${classroom.id}/deletion`, {
      expectedVersion: classroom.version,
      deleted: true
    }, { key: harness.nextUuid() }).expect(200);

    // Records stay readable, but read-only, and reverse feedback hides them.
    const kept = await api.get(RECORDS).query({ classId: classroom.id }).expect(200);
    assert.deepEqual(kept.body.items.map((item) => item.id), [record.body.id]);
    const rejected = await api.put(`${RECORDS}/${record.body.id}`, updatePayload(record.body, {
      note: '删班后不该改'
    }), { key: harness.nextUuid() }).expect(409);
    assertProblem(rejected, 409, '/problems/workbench/object-deleted');
    const feedbackWithDeletedClass = await api.get(`${SOURCE_RECORDS}/lesson/${lesson.id}`).expect(200);
    assert.deepEqual(feedbackWithDeletedClass.body.items, []);

    // The class is restored with its original id; the record kept its link.
    const restoredClass = await api.post(`${CLASSES}/${classroom.id}/deletion`, {
      expectedVersion: deletedClass.body.version,
      deleted: false
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(restoredClass.body.id, classroom.id);
    const afterRestore = await api.get(`${RECORDS}/${record.body.id}`).expect(200);
    assert.equal(afterRestore.body.id, record.body.id);
    assert.equal(afterRestore.body.version, 1);
    assert.equal(afterRestore.body.sources[0].id, lesson.id);
    const feedbackAfterRestore = await api.get(`${SOURCE_RECORDS}/lesson/${lesson.id}`).expect(200);
    assert.deepEqual(feedbackAfterRestore.body.items.map((item) => item.id), [record.body.id]);

    // A deleted record needs its own restore; restoring the class does not.
    const deletedRecord = await api.post(`${RECORDS}/${record.body.id}/deletion`, {
      expectedVersion: 1,
      deleted: true
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(deletedRecord.body.version, 2);
    const deletedList = await api.get(RECORDS).query({ classId: classroom.id, state: 'deleted' }).expect(200);
    assert.deepEqual(deletedList.body.items.map((item) => item.id), [record.body.id]);
    const activeList = await api.get(RECORDS).query({ classId: classroom.id }).expect(200);
    assert.deepEqual(activeList.body.items, []);
    const feedbackAfterRecordDelete = await api.get(`${SOURCE_RECORDS}/lesson/${lesson.id}`).expect(200);
    assert.deepEqual(feedbackAfterRecordDelete.body.items, []);

    const restoredRecord = await api.post(`${RECORDS}/${record.body.id}/deletion`, {
      expectedVersion: 2,
      deleted: false
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(restoredRecord.body.id, record.body.id);
    assert.equal(restoredRecord.body.deletedAt, null);
    const finalFeedback = await api.get(`${SOURCE_RECORDS}/lesson/${lesson.id}`).expect(200);
    assert.deepEqual(finalFeedback.body.items.map((item) => item.id), [record.body.id]);
  });
});

test('TT-C1/WB-T019: 空标题只影响显示回退，labelAtLink 保存服务器读取的原文', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await seedClass(harness, api, '高一(1)班');
    const unnamed = await seedQuestion(harness, api, { title: '' });

    const record = await api.post(RECORDS, recordSample(classroom.id, {
      sources: [{ kind: 'question', id: unnamed.id }]
    }), { key: harness.nextUuid() }).expect(201);
    assert.equal(record.body.sources[0].labelAtLink, '');
    assert.equal(record.body.sources[0].currentLabel, '未命名题目');

    const renamed = await api.put(`${QUESTIONS}/${unnamed.id}`, {
      baseVersion: 1,
      title: '后来命名的题',
      body: unnamed.body,
      solution: unnamed.solution,
      note: '',
      starred: false
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(renamed.body.title, '后来命名的题');

    const after = await api.get(`${RECORDS}/${record.body.id}`).expect(200);
    assert.equal(after.body.sources[0].labelAtLink, '');
    assert.equal(after.body.sources[0].currentLabel, '后来命名的题');
    assert.equal(after.body.sources[0].deleted, false);
  });
});

test('WB-T017/TT-C5: 同键重放返回原结果、同键改体 409、无部分写入', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await seedClass(harness, api, '高一(1)班');

    const key = harness.nextUuid();
    const payload = recordSample(classroom.id);
    const first = await api.post(RECORDS, payload, { key }).expect(201);
    const replay = await api.post(RECORDS, payload, { key }).expect(201);
    assert.deepEqual(replay.body, first.body);
    assert.equal(harness.countRows('classes_records'), 1);

    const reused = await api.post(RECORDS, { ...payload, note: '同键改体' }, { key }).expect(409);
    assertProblem(reused, 409, '/problems/workbench/idempotency-key-reused');
    assert.equal(harness.countRows('classes_records'), 1);

    // A stale version is an explicit conflict that points at the current version.
    const conflict = await api.put(`${RECORDS}/${first.body.id}`, updatePayload(first.body, {
      expectedVersion: 99,
      note: '旧版本的修改'
    }), { key: harness.nextUuid() }).expect(409);
    assertProblem(conflict, 409, '/problems/workbench/version-conflict');
    assert.equal(conflict.body.currentVersion, 1);
    const untouched = await api.get(`${RECORDS}/${first.body.id}`).expect(200);
    assert.equal(untouched.body.note, '例2没讲，任意性还需强调');
    assert.equal(untouched.body.version, 1);
  });
});

test('WB-T017/WB-T018: 存储失败 503 不留业务/幂等记录，恢复后同键只写一次', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await seedClass(harness, api, '高一(1)班');
    const key = harness.nextUuid();
    const payload = recordSample(classroom.id);

    harness.failWritesTo('classes_records');
    const blocked = await api.post(RECORDS, payload, { key }).expect(503);
    assertProblem(blocked, 503, '/problems/workbench/temporarily-unavailable');
    assert.equal(harness.countRows('classes_records'), 0);
    assert.equal(harness.countRows('workbench_mutation_keys'), 1, 'the class creation is the only confirmed write');

    harness.clearFaults();
    const retried = await api.post(RECORDS, payload, { key }).expect(201);
    assert.equal(harness.countRows('classes_records'), 1);
    assert.equal(harness.countRows('workbench_mutation_keys'), 2);
    const confirmed = await api.post(RECORDS, payload, { key }).expect(201);
    assert.deepEqual(confirmed.body, retried.body);
    assert.equal(harness.countRows('classes_records'), 1);
  });
});

test('WB-T018: 来源保护、身份与账户隔离', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const classroom = await seedClass(harness, api, '高一(1)班');
    const record = await api.post(RECORDS, recordSample(classroom.id), { key: harness.nextUuid() }).expect(201);

    const anonymous = await harness.raw().get(`${RECORDS}/${record.body.id}`).expect(401);
    assertProblem(anonymous, 401, '/problems/workbench/unauthenticated');

    const wrongOrigin = await api.post(RECORDS, recordSample(classroom.id), {
      key: harness.nextUuid(),
      origin: 'https://not-the-workbench.test'
    }).expect(403);
    assertProblem(wrongOrigin, 403, '/problems/workbench/request-not-allowed');

    const noProtection = await api.post(RECORDS, recordSample(classroom.id), {
      key: harness.nextUuid(),
      protection: null
    }).expect(403);
    assertProblem(noProtection, 403, '/problems/workbench/request-not-allowed');

    const noKey = await api.post(RECORDS, recordSample(classroom.id)).expect(422);
    assert.equal(noKey.body.field, '/headers/Idempotency-Key');
    assert.equal(noKey.body.reason, 'required');

    const malformed = await api.send('post', RECORDS, {
      key: harness.nextUuid(),
      headers: { 'content-type': 'application/json' },
      body: '{"classId":'
    }).expect(400);
    assertProblem(malformed, 400, '/problems/workbench/malformed-json');

    const other = harness.agent(harness.createAccount('teacher-b'));
    const foreignRecord = await other.get(`${RECORDS}/${record.body.id}`).expect(404);
    assertProblem(foreignRecord, 404, '/problems/workbench/not-found');
    const foreignClassUpdate = await other.put(`${CLASSES}/${classroom.id}`, {
      expectedVersion: 1,
      name: '偷看'
    }, { key: harness.nextUuid() }).expect(404);
    assertProblem(foreignClassUpdate, 404, '/problems/workbench/not-found');
    const otherList = await other.get(RECORDS).query({ classId: classroom.id }).expect(404);
    assertProblem(otherList, 404, '/problems/workbench/not-found');

    // The same object id is not a permission: A still sees its own record.
    const mine = await api.get(`${RECORDS}/${record.body.id}`).expect(200);
    assert.equal(mine.body.note, '例2没讲，任意性还需强调');
  });
});
