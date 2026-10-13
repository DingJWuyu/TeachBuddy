import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstFlowHarness } from './first-flow-harness.js';

const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
const input = {
  title: '函数课', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, recordIds: [] },
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
  } finally { await h.close(); }
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
  finally { await h.close(); }
}

test('notification read state can return to unread and survive restart without duplicating notices', async () => fixture(async f => {
  await f.create(); f.at('2026-09-21T09:00:00.000Z');
  const notice = (await f.getNotices()).items[0];
  await f.post(`${notices}/${notice.id}`, { action: 'read' });
  assert.equal((await f.getNotices()).unreadCount, 0);
  const key = f.h.nextUuid();
  const body = { ids: [notice.id], action: 'unread' };
  assert.equal((await f.post('/api/modules/schedule/notification-actions', body, key)).status, 200);
  assert.equal((await f.post('/api/modules/schedule/notification-actions', body, key)).status, 200);
  await f.h.restart();
  const result = await f.getNotices();
  assert.equal(result.unreadCount, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].readAt, null);
}));

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

test('TT-C7: production catalog matches combined v3 with the frozen teaching question overlay and rejects all four invalid static inputs', async () => {
  const { readFileSync } = await import('node:fs');
  const { assertModuleCatalog, projectModuleCatalog } = await import('@refatos/shared');
  const samples = JSON.parse(readFileSync(new URL('./fixtures/contracts/teaching-time-v1-samples.json', import.meta.url))).samples;
  const expected = JSON.parse(readFileSync(new URL('./fixtures/contracts/math-samples.json', import.meta.url))).find(s=>s.id==='catalog-combined-target').value;
  // materials-teaching-alignment.md: only classes' question dependency changes;
  // the historical M40 sample and every other descriptor field stay unchanged.
  expected.items.find(entry => entry.id === 'classes').requires[0] = 'questions.readForReferenceV2';
  await fixture(async f => {
    const response = await f.a.get('/api/modules');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, expected);
  });
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

test('B16 database upgrades into the current composition without losing linked sources', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't53-upgrade-'));
  const databasePath = path.join(dir, 'workbench.sqlite');
  const { manualQuestionSample: questionSample } = await import('./first-flow-harness.js');
  let h = await createFirstFlowHarness({ databasePath, baselineOnly: true });
  try {
    let a = h.agent(h.createAccount('teacher-a'));
    const question = (await a.post('/api/modules/questions/items', questionSample(), { key: h.nextUuid() })).body;
    await h.close();
    h = await createFirstFlowHarness({ databasePath });
    a = h.agent(h.createAccount('teacher-a'));
    assert.equal((await a.get(`/api/modules/questions/items/${question.id}`)).body.title, question.title);
    const classroom = (await a.post('/api/modules/classes/items', { name: '升级后的班级' }, { key: randomKey() })).body;
    const record = await a.post('/api/modules/classes/records', {
      classId: classroom.id, recordedOn: '2026-09-21', note: '真实关联', position: '', unfinished: '', commonIssues: '', nextNote: '',
      sources: [{ kind: 'question', id: question.id }]
    }, { key: randomKey() });
    assert.equal(record.status, 201, JSON.stringify(record.body));
    await h.restart();
    assert.equal((await a.get(`/api/modules/classes/records/${record.body.id}`)).body.sources[0].currentLabel, question.title);
    assert.deepEqual((await a.get(notices)).body, { items: [], unreadCount: 0 });
  } finally { await h.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
function randomKey() { return crypto.randomUUID(); }

test('detaching keeps an unchanged overdue reminder without duplicating delivery, and preserves later repeats', async () => fixture(async f => {
  const calendar = { allDay: false, notes: '', tags: [] };
  const series = await f.create({ ...input, repeat: { until: '2026-10-05' }, calendar });
  f.at('2026-09-21T09:00:00.000Z');
  const result = await f.post(`${entries}/${series.id}/occurrences/2026-09-21/detach`, {
    ...input, calendar: { ...calendar, notes: '已结束课堂的笔记' }, expectedVersion: series.version
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.repeat, null);
  const first = await f.getNotices();
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].key.entryId, series.id);
  await f.h.restart();
  assert.equal((await f.getNotices()).items.length, 1);
  f.at('2026-09-28T09:00:00.000Z');
  assert.equal((await f.getNotices()).items.length, 2);
}));

test('start-relative reminders fire around start and preserve legacy end-relative reminders', async () => fixture(async f => {
  for (const reminder of [{ anchor: 'start', side: 'before', minutes: 10 }, { anchor: 'start', side: 'after', minutes: 10 }, { side: 'before', minutes: 10 }, { side: 'after', minutes: 10 }]) {
    const created = await f.create({ ...input, reminder });
    assert.deepEqual(created.reminder, reminder);
  }
  f.at('2026-09-21T06:49:59Z'); assert.equal((await f.getNotices()).items.length, 0);
  f.at('2026-09-21T06:50:00Z'); assert.deepEqual((await f.getNotices()).items.map(n => n.dueAt), ['2026-09-21T06:50:00Z']);
  f.at('2026-09-21T07:10:00Z'); assert.equal((await f.getNotices()).items.length, 2);
  f.at('2026-09-21T08:40:00Z');
  const expected = ['2026-09-21T08:40:00Z', '2026-09-21T08:20:00Z', '2026-09-21T07:10:00Z', '2026-09-21T06:50:00Z'];
  assert.deepEqual((await f.getNotices()).items.map(n => n.dueAt), expected);
  await f.h.restart(); assert.deepEqual((await f.getNotices()).items.map(n => n.dueAt), expected);
}));

test('changing a reminder anchor validates the new due time and retains unsaved time on rejection', async () => fixture(async f => {
  const created = await f.create(); f.at('2026-09-21T07:05:00Z');
  const rejected = await f.a.put(`${entries}/${created.id}`, { ...input, expectedVersion: created.version, reminder: { anchor: 'start', side: 'before', minutes: 10 } }, { key: f.h.nextUuid() });
  assert.equal(rejected.status, 422); assert.match(rejected.body.type, /reminder-not-future/);
  const unchanged = await f.a.get(`${entries}/${created.id}`); assert.deepEqual(unchanged.body.reminder, input.reminder); assert.equal(unchanged.body.version, created.version);
  const accepted = await f.a.put(`${entries}/${created.id}`, { ...input, expectedVersion: created.version, reminder: { anchor: 'start', side: 'after', minutes: 10 } }, { key: f.h.nextUuid() });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  f.at('2026-09-21T07:10:00Z'); assert.equal((await f.getNotices()).items[0].dueAt, '2026-09-21T07:10:00Z');
}));

test('start-relative reminders work for recurring and all-day tasks including zero minutes', async () => fixture(async f => {
  await f.create({ ...input, repeat: { until: '2026-09-28' }, reminder: { anchor: 'start', side: 'before', minutes: 0 } });
  await f.create({ ...input, time: { ...input.time, date: '2026-09-22', startTime: '00:00', durationMinutes: 1440 }, calendar: { allDay: true, tags: [], notes: '' }, reminder: { anchor: 'start', side: 'after', minutes: 0 } });
  f.at('2026-09-28T07:00:00Z');
  assert.deepEqual((await f.getNotices()).items.map(n => n.dueAt), ['2026-09-28T07:00:00Z', '2026-09-21T16:00:00Z', '2026-09-21T07:00:00Z']);
}));

test('system timezone changes keep wall clock and recompute reminder delivery without old future notices', async () => fixture(async f => {
  const task=await f.create();const settings=await f.a.get('/api/modules/schedule/settings');
  const changed=await f.a.put('/api/modules/schedule/settings',{timeZone:'America/New_York',expectedVersion:settings.body.version},{key:f.h.nextUuid()});assert.equal(changed.status,200,JSON.stringify(changed.body));
  const saved=await f.a.get(`${entries}/${task.id}`);assert.deepEqual(saved.body.time,{...input.time,timeZone:'America/New_York'});assert.equal(saved.body.version,task.version+1);
  f.at('2026-09-21T06:50:00Z');assert.equal((await f.getNotices()).items.length,0);
  f.at('2026-09-21T20:20:00Z');assert.deepEqual((await f.getNotices()).items.map(n=>n.dueAt),['2026-09-21T20:20:00Z']);
  await f.h.restart();assert.equal((await f.getNotices()).items.length,1);
}));

test('automatic timezone change accepts reminders that become past and stays silent for them', async () => fixture(async f => {
  const settings=await f.a.get('/api/modules/schedule/settings');await f.a.put('/api/modules/schedule/settings',{timeZone:'America/New_York',expectedVersion:settings.body.version},{key:f.h.nextUuid()});
  const task=await f.create({...input,time:{...input.time,timeZone:'America/New_York'}});f.at('2026-09-21T10:00:00Z');
  const changed=await f.a.put('/api/modules/schedule/settings',{timeZone:'Asia/Shanghai',expectedVersion:2},{key:f.h.nextUuid()});assert.equal(changed.status,200,JSON.stringify(changed.body));
  assert.equal((await f.a.get(`${entries}/${task.id}`)).body.time.startTime,'15:00');assert.equal((await f.getNotices()).items.length,0);
}));

test('timezone change updates recurring overrides and deleted tasks, preserves pending tasks and isolates accounts', async () => fixture(async f => {
  const series=await f.create({...input,repeat:{until:'2026-10-05'}});
  const {repeat,...content}=input;
  const override=await f.a.put(`${entries}/${series.id}/exceptions/2026-09-28`,{expectedVersion:series.version,mode:'override',content:{...content,time:{...input.time,date:'2026-09-29',startTime:'17:00'}}},{key:f.h.nextUuid()});assert.equal(override.status,200,JSON.stringify(override.body));
  const pending=await f.create({...input,time:null,reminder:null});const deleted=await f.create();await f.a.post(`${entries}/${deleted.id}/deletion`,{expectedVersion:deleted.version,deleted:true},{key:f.h.nextUuid()});
  const foreign=await f.b.post(entries,input,{key:f.h.nextUuid()});assert.equal(foreign.status,201);
  await f.a.get('/api/modules/schedule/settings');const change=await f.a.put('/api/modules/schedule/settings',{timeZone:'America/New_York',expectedVersion:1},{key:f.h.nextUuid()});assert.equal(change.status,200,JSON.stringify(change.body));
  const occurrence=await f.a.get(`${entries}/${series.id}/occurrence?originDate=2026-09-28`);assert.equal(occurrence.body.time.startTime,'17:00');assert.equal(occurrence.body.time.date,'2026-09-29');assert.equal(occurrence.body.time.timeZone,'America/New_York');assert.equal(occurrence.body.exception,true);
  assert.equal((await f.a.get(`${entries}/${pending.id}`)).body.version,pending.version);assert.equal((await f.a.get(`${entries}/${deleted.id}`)).body.time.timeZone,'America/New_York');assert.equal((await f.b.get(`${entries}/${foreign.body.id}`)).body.time.timeZone,'Asia/Shanghai');
  const again=await f.a.put('/api/modules/schedule/settings',{timeZone:'America/New_York',expectedVersion:2},{key:f.h.nextUuid()});assert.equal(again.body.version,2);assert.equal((await f.a.get(`${entries}/${series.id}`)).body.version,series.version+2);
}));
