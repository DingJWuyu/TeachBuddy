import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import Database from 'better-sqlite3';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { createClassroomRepository } from '../src/modules/classroom/repository.js';

const base = '/api/modules/classroom';
const date = '2026-01-01T00:00:00.000Z';
const object = fields => ({ id: randomUUID(), version: 1, createdAt: date, updatedAt: date, deletedAt: null, ...fields });

async function register(world, email) {
  const client = world.client();
  assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } })).status, 200);
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const registration = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '统计老师', password: 'statistics-password', termsAccepted: true, rememberMe: true,
    challengeId: sent.json.challengeId, verificationCode: world.mailer.lastCode('registration', email)
  } });
  assert.equal(registration.status, 201, registration.text);
  assert.equal((await client.request('POST', '/api/auth/session', { body: {
    action: 'activate', sessionId: registration.json.id, rememberMe: true
  } })).status, 200);
  return { client, accountKey: registration.json.account.accountKey };
}

// Statistics is a read seam. Seed fixed confirmed facts in the isolated SQLite
// database; importing and correcting workbooks is covered by the import tests.
async function seed(world, accountKey, client) {
  const png = fs.readFileSync(new URL('../../../test/fixtures/questions/figure.png', import.meta.url));
  const boundary = 'statistics-' + randomUUID();
  const upload = await client.request('POST', '/api/workbench/files', {
    headers: { 'Idempotency-Key': randomUUID() }, contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="exam.png"\r\nContent-Type: image/png\r\n\r\n`),
      png, Buffer.from(`\r\n--${boundary}--\r\n`)])
  });
  assert.equal(upload.status, 201, upload.text);
  const db = new Database(path.join(world.directory, 'workspace.sqlite'));
  const repository = createClassroomRepository(db);
  const save = (kind, value) => repository.write(kind, accountKey, value);
  const classes = ['甲班', '乙班'].map(name => save('classes', object({ name, term: null, seating: { rows: 6, columns: 8, seats: [] } })));
  const students = Array.from({ length: 6 }, (_, index) => save('students', object({
    classId: classes[index < 4 ? 0 : 1].id, name: index === 5 ? '学生一' : `学生${index + 1}`,
    studentNumber: `00${index + 1}`, birthday: null, interests: '', description: ''
  })));
  const tags = ['函数', '图像', '几何'].map(name => save('tags', object({ name, normalizedName: name, mergedIntoId: null })));
  const question = (label, maxScore, tagIds) => ({ id: randomUUID(), label, groupLabel: null, maxScore, tagIds, locations: [] });
  const exams = [
    object({ name: '考试一', subject: '数学', occurredOn: '2026-01-01', totalMax: 100,
      questions: [question('A', 40, [tags[0].id]), question('B', 60, [tags[0].id, tags[1].id])] }),
    object({ name: '考试二', subject: '数学', occurredOn: '2026-02-01', totalMax: 50,
      questions: [question('C', 50, [tags[0].id])] }),
    object({ name: '考试三', subject: '数学', occurredOn: '2026-03-01', totalMax: 20,
      questions: [question('D', 20, [tags[2].id])] })
  ].map(exam => save('exams', { ...exam, source: [{ fileId: upload.json.id, renditionFileId: null }] }));
  const row = (exam, index, totalScore, values, status = 'present') => ({ studentId: students[index].id,
    studentSnapshot: { name: students[index].name, studentNumber: students[index].studentNumber },
    status, totalScore, scores: Object.fromEntries(exam.questions.map((question, n) => [question.id, values[n] ?? null])) });
  const result = (exam, klass, rows) => save('results', object({ examId: exam.id, classId: klass.id,
    rows, examVersionAtConfirmation: exam.version, provenance: { importId: null, sourceFileId: null } }));
  const results = [
    result(exams[0], classes[0], [row(exams[0], 0, 80, [30, 45]), row(exams[0], 1, 80, [40, 40]),
      row(exams[0], 2, 50, [null, 50]), row(exams[0], 3, null, [], 'absent')]),
    result(exams[0], classes[1], [row(exams[0], 4, 60, [20, 40]), row(exams[0], 5, 0, [0, 0])]),
    result(exams[1], classes[1], [row(exams[1], 0, 50, [50]), row(exams[1], 4, null, [null]), row(exams[1], 5, null, [], 'unrecorded')]),
    result(exams[2], classes[1], [row(exams[2], 0, 10.01, [10.01]), row(exams[2], 4, 10.01, [10.01])])
  ];
  students[0] = save('students', { ...students[0], classId: classes[1].id, version: 2 });
  return { db, save, classes, students, tags, exams, results };
}

test('real authenticated HTTPS statistics preserves denominators, ties, historical identity and read versions', async () => {
  let world = await createIntegration();
  const directory = world.directory;
  let fixture;
  let passed = false;
  try {
    const teacher = await register(world, 'statistics@example.test');
    const other = await register(world, 'statistics-other@example.test');
    fixture = await seed(world, teacher.accountKey, teacher.client);
    const { classes: c, students: s, tags: t, exams: e, results: r, save } = fixture;
    const get = async (url, client = teacher.client, status = 200) => {
      const response = await client.request('GET', base + url);
      assert.equal(response.status, status, response.text);
      return response.json;
    };
    await get(`/classes/${c[0].id}/statistics`, world.client(), 401);
    await get(`/students/${s[0].id}/statistics`, other.client, 404);
    await get(`/classes/${c[0].id}/statistics?tagIds=${t[0].id}`, other.client, 404);
    const klass = await get(`/classes/${c[0].id}/statistics`);
    assert.equal(klass.points.length, 1);
    const first = klass.points[0];
    assert.deepEqual(first.warnings, [{ code: 'total-mismatch', studentId: s[0].id }]);
    assert.equal(first.scoreEvidence[2].totalMismatch, false, 'a missing question cannot prove total mismatch');
    assert.deepEqual([first.overall.mean, first.overall.median, first.overall.min, first.overall.max], [70, 80, 50, 80]);
    assert.deepEqual([first.overall.rosterCount, first.overall.scoredCount, first.overall.absentCount], [4, 3, 1]);
    assert.deepEqual(first.questions.map(q => [q.scoreSum, q.maxSum, q.observedCount, q.missingCount, q.mean, q.rate]),
      [[70, 80, 2, 1, 35, 0.875], [135, 180, 3, 0, 45, 0.75]]);
    const fn = first.tags.find(tag => tag.id === t[0].id);
    assert.deepEqual([fn.scoreSum, fn.maxSum, fn.possibleMax, fn.observedCells, fn.eligibleCells, fn.missingCount, fn.absentCount], [205, 260, 300, 5, 6, 1, 1]);
    assert.equal(fn.rate, 205 / 260);
    const union = await get(`/classes/${c[0].id}/statistics?tagIds=${t[0].id},${t[1].id}`);
    assert.deepEqual([union.points[0].tagSelection.scoreSum, union.points[0].tagSelection.maxSum, union.points[0].tagSelection.questionCount], [205, 260, 2]);
    assert.deepEqual(first.exam.source, e[0].source);
    assert.deepEqual(klass.dataVersions.exam, [{ id: e[0].id, version: 1 }]);
    assert.deepEqual(klass.dataVersions.results, [{ id: r[0].id, version: 1 }]);
    const person = await get(`/students/${s[0].id}/statistics?tagIds=${t[0].id}`);
    assert.deepEqual(person.points.map(point => point.exam.id), e.map(exam => exam.id));
    assert.equal(person.points[0].overall.classReference.id, c[0].id);
    assert.equal(person.points[1].overall.classReference.id, c[1].id);
    assert.deepEqual([person.points[0].overall.rate, person.points[0].tagSelection.rate, person.points[0].overall.totalMismatch], [0.8, 0.75, true]);
    assert.equal(person.points[2].tagSelection.rate, null);
    assert.equal(person.points[2].tagSelection.reason, 'not-assessed');
    for (const [index, rank] of [[0, 1], [1, 1], [2, 3], [3, null]]) {
      const stats = await get(`/students/${s[index].id}/statistics?examId=${e[0].id}`);
      assert.equal(stats.points[0].overall.rank, rank);
      assert.equal(stats.points[0].overall.rankedCount, 3);
    }
    const sameName = await get(`/students/${s[5].id}/statistics`);
    assert.equal(sameName.points.length, 2);
    assert.equal(sameName.points[0].overall.totalScore, 0);
    const comparison = await get(`/exams/${e[0].id}/comparison?classIds=${c.map(klass => klass.id).join(',')}`);
    assert.deepEqual(comparison.classes.map(value => value.point.overall.mean), [70, 30]);
    assert.deepEqual(comparison.classes[1].point.overall.distribution[0].studentIds, [s[5].id]);
    const second = await get(`/exams/${e[1].id}/comparison?classIds=${c.map(klass => klass.id).join(',')}`);
    assert.equal(second.classes[0].state, 'no-result');
    assert.equal(second.classes[0].point, null);
    const secondOverall = second.classes[1].point.overall;
    assert.deepEqual([secondOverall.scoredCount, secondOverall.missingTotalCount, secondOverall.unrecordedCount], [1, 1, 1]);
    assert.deepEqual(secondOverall.distribution[9].studentIds, [s[0].id]);
    assert.deepEqual([second.classes[1].point.tagSelection.rate, second.classes[1].point.tagSelection.missingCount], [1, 1]);
    const missing = await get(`/students/${s[4].id}/statistics?examId=${e[1].id}&tagIds=${t[0].id}`);
    assert.equal(missing.points[0].tagSelection.reason, 'missing-scores');
    assert.equal(missing.points[0].tagSelection.rate, null);
    const decimal = await get(`/exams/${e[2].id}/comparison?classIds=${c[1].id}`);
    assert.equal(decimal.classes[0].point.overall.mean, 10.01);
    assert.equal(decimal.classes[0].point.tagSelection.scoreSum, 20.02);
    assert.equal((await get(`/students/${s[0].id}/statistics?examId=${e[2].id}`)).points[0].overall.rank, 1);
    assert.equal((await get(`/students/${s[4].id}/statistics?examId=${e[2].id}`)).points[0].overall.rank, 1);
    assert.equal((await get(`/students/${s[0].id}/statistics?from=2026-02-01&to=2026-02-01`)).points.length, 1);
    assert.deepEqual((await get(`/students/${s[0].id}/statistics?from=2027-01-01`)).points, []);
    await get(`/classes/${c[0].id}/statistics?tagIds=${randomUUID()}`, teacher.client, 404);
    await get(`/classes/${c[0].id}/statistics?examId=${randomUUID()}`, teacher.client, 404);
    save('students', { ...s[2], deletedAt: date, version: 2 });
    save('classes', { ...c[0], deletedAt: date, version: 2 });
    assert.equal((await get(`/classes/${c[0].id}/statistics`)).points[0].overall.mean, 70);
    assert.equal((await get(`/classes/${c[0].id}/statistics`)).scope.deletedAt, date);
    save('results', { ...r[0], deletedAt: date, version: 2 });
    assert.deepEqual((await get(`/classes/${c[0].id}/statistics`)).points, []);
    save('results', { ...r[0], version: 3 });
    save('exams', { ...e[0], deletedAt: date, version: 2 });
    assert.deepEqual((await get(`/classes/${c[0].id}/statistics`)).points, []);
    save('exams', { ...e[0], version: 3 });
    const restored = await get(`/classes/${c[0].id}/statistics`);
    assert.equal(restored.points[0].overall.mean, 70);
    assert.equal(restored.dataVersions.results[0].version, 3);
    fixture.db.close();
    fixture.db = null;
    await world.close();
    world = await createIntegration({ directory });
    const fresh = await register(world, 'statistics-restart@example.test');
    // Re-authenticate the original account after restarting the real service.
    const client = world.client();
    await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    const login = await client.request('POST', '/api/auth/login', { body: { email: 'statistics@example.test', password: 'statistics-password', rememberMe: true } });
    assert.equal(login.status, 200, login.text);
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: login.json.id, rememberMe: true } })).status, 200);
    assert.equal((await get(`/classes/${c[0].id}/statistics`, client)).points[0].overall.mean, 70);
    await get(`/classes/${c[0].id}/statistics`, fresh.client, 404);
    passed = true;
  } finally {
    fixture?.db?.close();
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error('Retained classroom statistics fixture:', directory);
  }
});
