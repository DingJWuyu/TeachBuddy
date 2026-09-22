import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstFlowHarness } from './first-flow-harness.js';

const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
const input = {
  title: '函数课', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, lessonId: null, recordIds: [] },
  reminder: { side: 'before', minutes: 10 }
};

test('real composition exposes scheduled notifications with no implicit reminder', async () => {
  const h = await createFirstFlowHarness();
  try {
    const a = h.agent(h.createAccount('teacher-a'));
    const created = await a.post(entries, { ...input, reminder: null }, { key: h.nextUuid() });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const result = await a.get(notices);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { items: [], unreadCount: 0 });
  } finally { h.close(); }
});

async function fixture(run) {
  let now = '2026-09-21T06:00:00.000Z';
  const h = await createFirstFlowHarness({ clock: () => new Date(now) });
  const a = h.agent(h.createAccount('teacher-a'));
  const b = h.agent(h.createAccount('teacher-b'));
  const post = async (url, body, key = h.nextUuid()) => a.post(url, body, { key });
  const create = async (value = input) => {
    const result = await post(entries, value);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body;
  };
  const getNotices = async () => {
    const result = await a.get(notices);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  try { await run({ h, a, b, post, create, getNotices, at: value => { now = value; } }); }
  finally { h.close(); }
}

test('WB-T012/014: before, after, original due time and stable identities survive repeated restarts', async () => fixture(async f => {
  const before = await f.create();
  await f.create({ ...input, reminder: { side: 'after', minutes: 20 } });
  await f.create({ ...input, reminder: null });
  f.at('2026-09-21T08:19:59.000Z');
  assert.equal((await f.getNotices()).items.length, 0);
  await f.h.restart();
  f.at('2026-09-21T09:00:00.000Z');
  const result = await f.getNotices();
  assert.equal(result.unreadCount, 2);
  assert.deepEqual(result.items.map(n => n.dueAt), ['2026-09-21T08:50:00Z', '2026-09-21T08:20:00Z']);
  assert.equal(result.items[1].key.entryId, before.id);
  assert.equal(result.items[1].key.originDate, null);
  const parallel = await Promise.all([f.getNotices(), f.getNotices()]);
  assert.deepEqual(parallel, [result, result]);
  await f.h.restart();
  assert.deepEqual(await f.getNotices(), result);
}));

test('WB-T013: changing before due recalculates; changing after due captures old title and original time atomically', async () => fixture(async f => {
  const early = await f.create();
  const late = await f.create();
  f.at('2026-09-21T08:00:00.000Z');
  const changed = { ...input, time: { ...input.time, durationMinutes: 120 }, expectedVersion: 1 };
  assert.equal((await f.a.put(`${entries}/${early.id}`, changed, { key: f.h.nextUuid() })).status, 200);
  f.at('2026-09-21T08:25:00.000Z');
  assert.equal((await f.a.put(`${entries}/${late.id}`, { ...changed, title: '改名' }, { key: f.h.nextUuid() })).status, 200);
  const original = (await f.getNotices()).items;
  assert.equal(original.length, 1);
  assert.equal(original[0].title, '函数课');
  assert.equal(original[0].dueAt, '2026-09-21T08:20:00Z');
  f.at('2026-09-21T09:00:00.000Z');
  const result = (await f.getNotices()).items;
  assert.equal(result.length, 2);
  assert.equal(result[1].id, original[0].id);
  assert.equal(result[0].dueAt, '2026-09-21T08:50:00Z');
}));

test('WB-T015/017/018: reads, dismissal snapshots, atomic foreign-ID rejection, replay and isolation', async () => fixture(async f => {
  const first = await f.create();
  await f.create({ ...input, reminder: { side: 'after', minutes: 20 } });
  f.at('2026-09-21T08:25:00.000Z');
  const n = (await f.getNotices()).items[0];
  const key = f.h.nextUuid();
  const read = await f.post(`${notices}/${n.id}`, { action: 'read' }, key);
  assert.equal(read.status, 200);
  assert.equal(read.body.readAt, '2026-09-21T08:25:00.000Z');
  f.at('2026-09-21T09:00:00.000Z');
  assert.deepEqual((await f.post(`${notices}/${n.id}`, { action: 'read' })).body, read.body);
  await f.h.restart();
  assert.deepEqual((await f.post(`${notices}/${n.id}`, { action: 'read' }, key)).body, read.body);
  assert.equal((await f.b.post(`${notices}/${n.id}`, { action: 'read' }, { key: f.h.nextUuid() })).status, 404);
  const actionUrl = '/api/modules/schedule/notification-actions';
  assert.equal((await f.post(actionUrl, { ids: [n.id, f.h.nextUuid()], action: 'dismiss' })).status, 404);
  assert.equal((await f.getNotices()).items.length, 2);
  assert.equal((await f.post(actionUrl, { ids: [n.id], action: 'dismiss' })).status, 200);
  await f.h.restart();
  const remaining = await f.getNotices();
  assert.equal(remaining.items.length, 1);
  assert.notEqual(remaining.items[0].id, n.id);
  assert.equal((await f.a.get(`${entries}/${first.id}`)).body.version, 1);
  assert.deepEqual((await f.b.get(notices)).body, { items: [], unreadCount: 0 });
}));

test('WB-T013/018: real SQLite failure rolls back pre-change notification capture and the schedule write', async () => fixture(async f => {
  const entry = await f.create();
  f.at('2026-09-21T08:25:00.000Z');
  f.h.injectFault(`CREATE TRIGGER t53_fail_update BEFORE UPDATE ON schedule_entries BEGIN SELECT RAISE(ABORT, 'T53 rollback'); END`);
  const key = f.h.nextUuid();
  const body = { ...input, title: '失败修改', expectedVersion: 1 };
  const failed = await f.a.put(`${entries}/${entry.id}`, body, { key });
  assert.equal(failed.status, 503);
  assert.equal((await f.a.get(`${entries}/${entry.id}`)).body.title, '函数课');
  // Rewind only the test clock: a leaked capture would still be publicly visible.
  f.at('2026-09-21T08:19:59.000Z');
  assert.deepEqual(await f.getNotices(), { items: [], unreadCount: 0 });
  f.h.injectFault('DROP TRIGGER t53_fail_update');
  f.at('2026-09-21T08:25:00.000Z');
  assert.equal((await f.a.put(`${entries}/${entry.id}`, body, { key })).status, 200);
  assert.equal((await f.getNotices()).items[0].title, '函数课');
}));

test('WB-T012: Unicode fallback title matches the public candidate projection without truncating saved input', async () => fixture(async f => {
  const text = '😀'.repeat(301);
  const entry = await f.create({ ...input, title: '  ', items: [{ id: f.h.nextUuid(), text, priority: 'normal' }] });
  f.at('2026-09-21T08:25:00.000Z');
  assert.equal((await f.getNotices()).items[0].title, '😀'.repeat(300));
  assert.equal((await f.a.get(`${entries}/${entry.id}`)).body.items[0].text, text);
}));

test('WB-T010/016: moved weekly instances, cancellation recovery, deletion and outside-series targets', async () => fixture(async f => {
  const series = await f.create({ ...input, repeat: { until: '2026-10-05' } });
  const exception = `${entries}/${series.id}/exceptions/2026-09-28`;
  const moved = { title: '调课', items: [], time: { ...input.time, date: '2026-09-29', startTime: '16:00' }, course: input.course, reminder: input.reminder };
  assert.equal((await f.a.put(exception, { expectedVersion: 1, mode: 'override', content: moved }, { key: f.h.nextUuid() })).status, 200);
  f.at('2026-09-28T09:00:00.000Z');
  assert.equal((await f.getNotices()).items.length, 1);
  f.at('2026-09-29T09:20:00.000Z');
  const due = (await f.getNotices()).items;
  assert.equal(due.length, 2);
  assert.deepEqual(due[0].key, { entryId: series.id, originDate: '2026-09-28' });
  assert.equal(due[0].dueAt, '2026-09-29T09:20:00Z');
  assert.equal((await f.a.get(`${entries}/${series.id}/occurrence`, { originDate: '2026-09-28' })).body.startsAt, '2026-09-29T08:00:00Z');
  const shrink = { ...input, reminder: null, repeat: { until: '2026-09-21' }, expectedVersion: 2 };
  assert.equal((await f.a.put(`${entries}/${series.id}`, shrink, { key: f.h.nextUuid() })).status, 200);
  assert.equal((await f.a.get(`${entries}/${series.id}/occurrence`, { originDate: '2026-09-28' })).body.state, 'outside-series');
  assert.equal((await f.post(`${entries}/${series.id}/deletion`, { expectedVersion: 3, deleted: true })).status, 200);
  assert.equal((await f.a.get(`${entries}/${series.id}/occurrence`, { originDate: '2026-09-28' })).body.state, 'deleted');
  assert.equal((await f.getNotices()).items.length, 2);
}));

test('TT-C7: production catalog matches frozen combined v3 and rejects all four invalid static inputs', async () => {
  const { readFileSync } = await import('node:fs');
  const { assertModuleCatalog, projectModuleCatalog } = await import('@refatos/shared');
  const samples = JSON.parse(readFileSync(new URL('../../../docs/contracts/teaching-time/samples.json', import.meta.url))).samples;
  const expected = JSON.parse(readFileSync(new URL('../../../docs/contracts/workbench/math/samples.json', import.meta.url))).find(s=>s.id==='catalog-combined-target').value;
  await fixture(async f => assert.deepEqual((await f.a.get('/api/modules')).body, expected));
  for (const sample of samples.filter(s => s.id.startsWith('catalog-v2-reject-'))) {
    assert.throws(() => assertModuleCatalog(sample.value.items), error => {
      assert.equal(error.status, 422);
      assert.deepEqual(error.problem, { type: '/problems/workbench/invalid-input', field: sample.expectedStaticValidation.field, reason: sample.expectedStaticValidation.reason });
      return true;
    });
  }
  assert.deepEqual(projectModuleCatalog(expected.items.map(i => i.id), expected.items), expected);
});

test('WB-T016: cancelling before due and restoring after due is quiet; deleting after due captures the old notification', async () => fixture(async f => {
  const series = await f.create({ ...input, repeat: { until: '2026-09-28' } });
  const exception = `${entries}/${series.id}/exceptions/2026-09-21`;
  f.at('2026-09-21T08:00:00.000Z');
  assert.equal((await f.a.put(exception, { expectedVersion: 1, mode: 'cancelled' }, { key: f.h.nextUuid() })).status, 200);
  f.at('2026-09-21T09:00:00.000Z');
  assert.equal((await f.a.put(exception, { expectedVersion: 2, mode: 'inherit' }, { key: f.h.nextUuid() })).status, 200);
  assert.deepEqual(await f.getNotices(), { items: [], unreadCount: 0 });
  f.at('2026-09-28T09:00:00.000Z');
  assert.equal((await f.post(`${entries}/${series.id}/deletion`, { expectedVersion: 3, deleted: true })).status, 200);
  const list = await f.getNotices();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].key.originDate, '2026-09-28');
  assert.equal((await f.post(`${entries}/${series.id}/deletion`, { expectedVersion: 4, deleted: false })).status, 200);
  await f.h.restart();
  assert.deepEqual(await f.getNotices(), list);
}));

test('TT-C5: notification actions reject malformed, unknown and duplicate input before writing', async () => fixture(async f => {
  await f.create(); f.at('2026-09-21T09:00:00.000Z');
  const n = (await f.getNotices()).items[0];
  for (const body of [{ action: 'done' }, { action: 'read', extra: true }, {}]) {
    assert.equal((await f.post(`${notices}/${n.id}`, body)).status, 422);
  }
  for (const body of [{ ids: [], action: 'read' }, { ids: [n.id, n.id], action: 'read' }]) {
    assert.equal((await f.post('/api/modules/schedule/notification-actions', body)).status, 422);
  }
  assert.equal((await f.a.get(notices, { now: '2100-01-01' })).status, 422);
  assert.equal((await f.a.post(`${notices}/${n.id}`, { action: 'read' }, { key: f.h.nextUuid(), protection: null })).status, 403);
  assert.equal((await f.a.send('get', notices, { cookie: null })).status, 401);
  assert.equal((await f.getNotices()).unreadCount, 1);
}));

test('B16 database upgrades into the real four-module composition without losing linked sources', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't53-upgrade-'));
  const databasePath = path.join(dir, 'workbench.sqlite');
  const { lessonSample } = await import('./first-flow-harness.js');
  let h = await createFirstFlowHarness({ databasePath, baselineOnly: true });
  try {
    let a = h.agent(h.createAccount('teacher-a'));
    const lesson = (await a.post('/api/modules/lessons/items', lessonSample(), { key: h.nextUuid() })).body;
    h.close();
    h = await createFirstFlowHarness({ databasePath });
    a = h.agent(h.createAccount('teacher-a'));
    assert.equal((await a.get(`/api/modules/lessons/items/${lesson.id}`)).body.title, lesson.title);
    const classroom = (await a.post('/api/modules/classes/items', { name: '升级后的班级' }, { key: randomKey() })).body;
    const record = await a.post('/api/modules/classes/records', {
      classId: classroom.id, recordedOn: '2026-09-21', note: '真实关联', position: '', unfinished: '', commonIssues: '', nextNote: '',
      sources: [{ kind: 'lesson', id: lesson.id }]
    }, { key: randomKey() });
    assert.equal(record.status, 201, JSON.stringify(record.body));
    await h.restart();
    assert.equal((await a.get(`/api/modules/classes/records/${record.body.id}`)).body.sources[0].currentLabel, lesson.title);
    assert.deepEqual((await a.get(notices)).body, { items: [], unreadCount: 0 });
  } finally { h.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
function randomKey() { return crypto.randomUUID(); }
