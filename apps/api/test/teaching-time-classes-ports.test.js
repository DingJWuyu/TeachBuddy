// T51 public-port and provider-boundary coverage.
//
// schedule (T52) and the reverse feedback panels (T53) consume readClass,
// readRecord and listSourceRecords. This suite checks their frozen shapes,
// tombstone behaviour and the rule that a failing source read fails the read
// instead of pretending the source was deleted.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createClassesRepository } from '../src/modules/classes/repository.js';
import { createClassesService } from '../src/modules/classes/service.js';
import { createQuestionsRepository } from '../src/modules/questions/repository.js';
import { createQuestionsService } from '../src/modules/questions/service.js';
import {
  classSample,
  createTeachingTimeClassesHarness,
  questionSample,
  recordSample
} from './teaching-time-classes-harness.js';

const CLASSES = '/api/modules/classes/items';
const RECORDS = '/api/modules/classes/records';
const SOURCE_RECORDS = '/api/modules/classes/source-records';
const QUESTIONS = '/api/modules/questions/items';

async function withHarness(run) {
  const harness = await createTeachingTimeClassesHarness();
  try {
    return await run(harness);
  } finally {
    harness.close();
  }
}

function contractFailure(status, type) {
  return Object.assign(new Error(type), { status, problem: { type } });
}

test('公共端口：readClass/readRecord 允许 tombstone，外账户统一 404', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await api.post(CLASSES, classSample(), { key: harness.nextUuid() }).expect(201);
    const record = await api.post(RECORDS, recordSample(classroom.body.id), { key: harness.nextUuid() }).expect(201);

    const service = createClassesService({
      repository: createClassesRepository(harness.db()),
      questions: { readForReference: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      lessons: { readForTeachingLink: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      now: () => new Date('2026-09-21T06:00:00.000Z')
    });
    const principal = { accountKey: 'teacher-a' };

    assert.deepEqual(service.readClass(principal, classroom.body.id), {
      id: classroom.body.id,
      version: 1,
      name: '高一(1)班',
      deletedAt: null
    });
    assert.deepEqual(service.readRecord(principal, record.body.id), {
      id: record.body.id,
      version: 1,
      classId: classroom.body.id,
      label: '例2没讲，任意性还需强调',
      deletedAt: null,
      classDeletedAt: null
    });

    // Deleting the class keeps the reference readable and exposes the tombstone.
    const deletedClass = await api.post(`${CLASSES}/${classroom.body.id}/deletion`, {
      expectedVersion: 1,
      deleted: true
    }, { key: harness.nextUuid() }).expect(200);
    assert.equal(service.readClass(principal, classroom.body.id).deletedAt, deletedClass.body.deletedAt);
    assert.equal(service.readRecord(principal, record.body.id).classDeletedAt, deletedClass.body.deletedAt);

    assert.throws(() => service.readClass({ accountKey: 'teacher-b' }, classroom.body.id), (error) => error.status === 404);
    assert.throws(() => service.readRecord({ accountKey: 'teacher-b' }, record.body.id), (error) => error.status === 404);
    assert.throws(
      () => service.readClass(principal, '99999999-0000-4000-8000-000000000009'),
      (error) => error.status === 404
    );
  });
});

test('公共端口：readRecord 的 label 取首个非空文字并截前 300 个 code point', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await api.post(CLASSES, classSample(), { key: harness.nextUuid() }).expect(201);
    const service = createClassesService({
      repository: createClassesRepository(harness.db()),
      questions: { readForReference: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      lessons: { readForTeachingLink: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      now: () => new Date('2026-09-21T06:00:00.000Z')
    });
    const principal = { accountKey: 'teacher-a' };

    const longNote = '教'.repeat(301);
    const longRecord = await api.post(RECORDS, recordSample(classroom.body.id, { note: longNote }), { key: harness.nextUuid() }).expect(201);
    const longLabel = service.readRecord(principal, longRecord.body.id).label;
    assert.equal(Array.from(longLabel).length, 300);
    assert.equal(longLabel, '教'.repeat(300));

    const positionOnly = await api.post(RECORDS, recordSample(classroom.body.id, {
      note: '   ',
      position: '定义讲完',
      unfinished: '例2'
    }), { key: harness.nextUuid() }).expect(201);
    assert.equal(service.readRecord(principal, positionOnly.body.id).label, '定义讲完');
  });
});

test('公共端口：listSourceRecords 与 HTTP 同语义，返回活动记录与活动班级顺序', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const first = await api.post(CLASSES, classSample({ name: '高一(1)班' }), { key: harness.nextUuid() }).expect(201);
    const second = await api.post(CLASSES, classSample({ name: '高一(2)班' }), { key: harness.nextUuid() }).expect(201);
    const question = await api.post(QUESTIONS, questionSample({ title: '例1' }), { key: harness.nextUuid() }).expect(201);

    const older = await api.post(RECORDS, recordSample(first.body.id, {
      recordedOn: '2026-09-20',
      sources: [{ kind: 'question', id: question.body.id }]
    }), { key: harness.nextUuid() }).expect(201);
    const newer = await api.post(RECORDS, recordSample(second.body.id, {
      recordedOn: '2026-09-21',
      sources: [{ kind: 'question', id: question.body.id }]
    }), { key: harness.nextUuid() }).expect(201);

    const fixedNow = () => new Date('2026-09-21T06:00:00.000Z');
    const questionsService = createQuestionsService({
      repository: createQuestionsRepository(harness.db()),
      now: fixedNow
    });
    const service = createClassesService({
      repository: createClassesRepository(harness.db()),
      // The real B11 reference port, the same one the loader injects in production.
      questions: { readForReference: (principal, id) => questionsService.readForReference(principal, id) },
      lessons: { readForTeachingLink: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      now: fixedNow
    });
    const portItems = service.listSourceRecords({ accountKey: 'teacher-a' }, {
      kind: 'question',
      id: question.body.id
    }).items;
    const http = await api.get(`${SOURCE_RECORDS}/question/${question.body.id}`).expect(200);

    assert.deepEqual(portItems.map((item) => item.id), [newer.body.id, older.body.id]);
    assert.deepEqual(portItems.map((item) => item.sources[0].currentLabel), ['例1', '例1']);
    assert.deepEqual(http.body.items.map((item) => item.id), [newer.body.id, older.body.id]);
    assert.deepEqual(http.body.items.map((item) => item.classId), [second.body.id, first.body.id]);
    assert.equal(http.body.items[0].sources[0].labelAtLink, '例1');

    // Unknown or foreign sources are the provider's 404 before any listing.
    assert.throws(
      () => service.listSourceRecords({ accountKey: 'teacher-b' }, { kind: 'question', id: question.body.id }),
      (error) => error.status === 404
    );
  });
});

test('来源读取失败使本次读取失败，404 同样传播而非伪删除', async () => {
  await withHarness(async (harness) => {
    const api = harness.agent(harness.createAccount('teacher-a'));
    const classroom = await api.post(CLASSES, classSample(), { key: harness.nextUuid() }).expect(201);
    const question = await api.post(QUESTIONS, questionSample({ title: '例1' }), { key: harness.nextUuid() }).expect(201);
    const record = await api.post(RECORDS, recordSample(classroom.body.id, {
      sources: [{ kind: 'question', id: question.body.id }]
    }), { key: harness.nextUuid() }).expect(201);

    const repository = createClassesRepository(harness.db());
    const principal = { accountKey: 'teacher-a' };

    const failing = createClassesService({
      repository,
      questions: { readForReference: () => { throw contractFailure(503, '/problems/workbench/temporarily-unavailable'); } },
      lessons: { readForTeachingLink: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      now: () => new Date('2026-09-21T06:00:00.000Z')
    });
    assert.throws(() => failing.getRecord(principal, record.body.id), (error) => error.status === 503);

    const missing = createClassesService({
      repository,
      questions: { readForReference: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      lessons: { readForTeachingLink: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      now: () => new Date('2026-09-21T06:00:00.000Z')
    });
    assert.throws(() => missing.getRecord(principal, record.body.id), (error) => error.status === 404);
  });
});

test('直接业务调用同样拒绝非法输入，不依赖 HTTP 层', async () => {
  await withHarness(async (harness) => {
    const repository = createClassesRepository(harness.db());
    const service = createClassesService({
      repository,
      questions: { readForReference: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      lessons: { readForTeachingLink: () => { throw contractFailure(404, '/problems/workbench/not-found'); } },
      now: () => new Date('2026-09-21T06:00:00.000Z')
    });
    const principal = { accountKey: 'teacher-a' };
    const classroom = service.createClass(principal, { name: '高一(1)班' });

    assert.throws(() => service.createClass(principal, { name: '  ' }), (error) => error.status === 422);
    assert.throws(
      () => service.createRecord(principal, recordSample(classroom.id, { recordedOn: '2026-13-01' })),
      (error) => error.status === 422
    );
    assert.throws(
      () => service.createRecord(principal, recordSample(classroom.id, { note: ' ' })),
      (error) => error.status === 422
    );
    assert.throws(() => service.readClass(principal, 'not-a-uuid'), (error) => error.status === 404);
    assert.throws(() => service.listSourceRecords(principal, { kind: 'work', id: classroom.id }), (error) => error.status === 422);
  });
});
