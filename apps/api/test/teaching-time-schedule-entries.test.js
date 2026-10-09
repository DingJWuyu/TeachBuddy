/**
 * TT-C2 / TT-C5: entry CRUD, placement, strict request schema and course links
 * through the substitute ports, all over the real workbench HTTP transport.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduleHarness } from './fixtures/teaching-time-schedule/harness.js';
import { SAMPLE_IDS, emptyCourse, timedEntry, unscheduledEntry, weeklyEntry } from './fixtures/teaching-time-schedule/samples.js';

const SETTINGS = '/api/modules/schedule/settings';
const ENTRIES = '/api/modules/schedule/entries';
const OCCURRENCES = '/api/modules/schedule/occurrences';

async function withHarness(run) {
  const harness = await createScheduleHarness();
  try {
    await run(harness);
  } finally {
    harness.close();
  }
}

test('settings default to Asia/Shanghai version 1 and update with a version guard', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const initial = await a.get(SETTINGS);
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body, { timeZone: 'Asia/Shanghai', version: 1 });

    const replay = await a.get(SETTINGS);
    assert.deepEqual(replay.body, { timeZone: 'Asia/Shanghai', version: 1 });

    const updated = await a.put(SETTINGS, { timeZone: 'America/New_York', expectedVersion: 1 }, { key: harness.key() });
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.body, { timeZone: 'America/New_York', version: 2 });

    const conflict = await a.put(SETTINGS, { timeZone: 'UTC', expectedVersion: 1 }, { key: harness.key() });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.currentVersion, 2);
    assert.equal(conflict.body.objectId, undefined);

    const invalid = await a.put(SETTINGS, { timeZone: 'Mars/Olympus', expectedVersion: 2 }, { key: harness.key() });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.type, '/problems/workbench/invalid-time-zone');
    assert.equal(invalid.body.field, '/timeZone');
  });
});

test('unscheduled entries save, list and schedule without losing item identity', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, unscheduledEntry(), { key: harness.key() });
    assert.equal(created.status, 201);
    assert.equal(created.body.version, 1);
    assert.equal(created.body.time, null);
    assert.equal(created.body.repeat, null);
    assert.equal(created.body.reminder, null);
    assert.deepEqual(created.body.course.recordIds, []);
    const entryId = created.body.id;

    const unscheduled = await a.get(ENTRIES, { placement: 'unscheduled' });
    assert.equal(unscheduled.status, 200);
    assert.equal(unscheduled.body.items.length, 1);
    assert.equal(unscheduled.body.items[0].items[0].id, SAMPLE_IDS.itemOne);

    const scheduled = await a.put(`${ENTRIES}/${entryId}`, {
      expectedVersion: 1,
      ...timedEntry({ title: '', items: created.body.items })
    }, { key: harness.key() });
    assert.equal(scheduled.status, 200);
    assert.equal(scheduled.body.version, 2);
    assert.equal(scheduled.body.time.date, '2026-09-21');

    const occurrences = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-10-01' });
    assert.equal(occurrences.status, 200);
    assert.equal(occurrences.body.timeZone, 'Asia/Shanghai');
    assert.equal(occurrences.body.items.length, 1);
    const [occurrence] = occurrences.body.items;
    assert.deepEqual(occurrence.key, { entryId, originDate: null });
    assert.equal(occurrence.startsAt, '2026-09-21T07:00:00Z');
    assert.equal(occurrence.endsAt, '2026-09-21T08:30:00Z');
    assert.equal(occurrence.state, 'active');
    assert.equal(occurrence.entryVersion, 2);

    const emptyRange = await a.get(OCCURRENCES, { from: '2026-09-22', to: '2026-10-01' });
    assert.equal(emptyRange.body.items.length, 0);

    await harness.restart();
    const afterRestart = harness.agent(harness.account('teacher-a'));
    const reloaded = await afterRestart.get(`${ENTRIES}/${entryId}`);
    assert.equal(reloaded.status, 200);
    assert.equal(reloaded.body.items[0].id, SAMPLE_IDS.itemOne);
    assert.equal(reloaded.body.version, 2);
  });
});

test('array order is segment order and priority is a separate axis', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, timedEntry({
      items: [
        { id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' },
        { id: SAMPLE_IDS.itemTwo, text: '印讲义', priority: 'high' }
      ]
    }), { key: harness.key() });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.items.map((item) => item.id), [SAMPLE_IDS.itemOne, SAMPLE_IDS.itemTwo]);
    assert.deepEqual(created.body.items.map((item) => item.priority), ['normal', 'high']);

    const swapped = await a.put(`${ENTRIES}/${created.body.id}`, {
      expectedVersion: 1,
      ...timedEntry({
        items: [
          { id: SAMPLE_IDS.itemTwo, text: '印讲义', priority: 'high' },
          { id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }
        ]
      })
    }, { key: harness.key() });
    assert.equal(swapped.status, 200);
    assert.deepEqual(swapped.body.items.map((item) => item.id), [SAMPLE_IDS.itemTwo, SAMPLE_IDS.itemOne]);
    assert.deepEqual(swapped.body.items.map((item) => item.priority), ['high', 'normal']);
  });
});

test('strict request schema rejects unknown nested fields with the exact pointer', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const base = timedEntry();
    const cases = [
      ['items', { items: [{ ...base.items[0], unexpected: true }] }, '/items/0/unexpected'],
      ['time', { time: { ...base.time, unexpected: true } }, '/time/unexpected'],
      ['repeat', { repeat: { until: '2026-10-05', unexpected: true } }, '/repeat/unexpected'],
      ['course', { course: { ...base.course, unexpected: true } }, '/course/unexpected'],
      ['reminder', { reminder: { side: 'before', minutes: 10, unexpected: true } }, '/reminder/unexpected']
    ];
    for (const [label, patch, field] of cases) {
      const body = { ...base, ...patch };
      const response = await a.post(ENTRIES, body, { key: harness.key() });
      assert.equal(response.status, 422, `${label} should be rejected`);
      assert.equal(response.body.type, '/problems/workbench/invalid-input');
      assert.equal(response.body.field, field);
      assert.equal(response.body.reason, 'unknown-field');
    }
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM schedule_entries'), 0);
  });
});

test('cross-field entry rules reject empty content, blank or duplicate items and bad couplings', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const reject = async (body, field, reason) => {
      const response = await a.post(ENTRIES, body, { key: harness.key() });
      assert.equal(response.status, 422, `${field} expected 422, got ${response.status}`);
      assert.equal(response.body.field, field);
      if (reason === 'invalid-zone') assert.equal(response.body.type, '/problems/workbench/invalid-time-zone');
      else assert.equal(response.body.reason, reason);
    };

    await reject(unscheduledEntry({ title: '', items: [] }), '/title', 'empty-content');
    await reject(unscheduledEntry({ items: [{ id: SAMPLE_IDS.itemOne, text: '   ', priority: 'normal' }] }), '/items/0/text', 'out-of-range');
    await reject(unscheduledEntry({
      items: [
        { id: SAMPLE_IDS.itemOne, text: '一', priority: 'normal' },
        { id: SAMPLE_IDS.itemOne, text: '二', priority: 'normal' }
      ]
    }), '/items/1/id', 'duplicate-id');
    await reject(unscheduledEntry({ repeat: { until: '2026-10-05' } }), '/repeat', 'invalid-type');
    await reject(unscheduledEntry({ reminder: { side: 'before', minutes: 10 } }), '/reminder', 'invalid-type');
    await reject(unscheduledEntry({ course: emptyCourse({ recordIds: [SAMPLE_IDS.recordOne] }) }), '/course/recordIds', 'invalid-type');
    await reject(timedEntry({ repeat: { until: '2026-09-20' } }), '/repeat/until', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, date: '2026-02-30' } }), '/time/date', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, date: '2101-01-01' } }), '/time/date', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, date: '1899-12-31' } }), '/time/date', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, startTime: '24:00' } }), '/time/startTime', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, startTime: '12:60' } }), '/time/startTime', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, durationMinutes: 0 } }), '/time/durationMinutes', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, durationMinutes: 1441 } }), '/time/durationMinutes', 'out-of-range');
    await reject(timedEntry({ time: { ...timedEntry().time, timeZone: 'Mars/Olympus' } }), '/time/timeZone', 'invalid-zone');
    await reject(timedEntry({ course: emptyCourse({ recordIds: [SAMPLE_IDS.recordOne] }) }), '/course/recordIds', 'invalid-reference');
    await reject(timedEntry({ time: null, repeat: { until: '2026-10-05' } }), '/repeat', 'invalid-type');
  });
});

test('the supported date window is inclusive on both ends', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const first = await a.post(ENTRIES, timedEntry({
      time: { date: '1900-01-01', startTime: '00:00', timeZone: 'Asia/Shanghai', durationMinutes: 1 }
    }), { key: harness.key() });
    assert.equal(first.status, 201);
    assert.equal(first.body.time.date, '1900-01-01');

    const last = await a.post(ENTRIES, timedEntry({
      time: { date: '2100-12-31', startTime: '23:59', timeZone: 'Asia/Shanghai', durationMinutes: 1440 }
    }), { key: harness.key() });
    assert.equal(last.status, 201);

    const occurrences = await a.get(OCCURRENCES, { from: '2100-12-31', to: '2100-12-31' });
    assert.equal(occurrences.status, 200);
    assert.deepEqual(occurrences.body.items.map((item) => item.time.date), ['2100-12-31']);
  });
});

test('course links resolve through the ports and derived state never fakes a deletion', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const b = harness.agent(harness.account('teacher-b'));

    const classroom = await a.post('/api/modules/classes/items', { name: '高一(1)班' }, { key: harness.key() });
    assert.equal(classroom.status, 201);
    const otherClass = await a.post('/api/modules/classes/items', { name: '高一(2)班' }, { key: harness.key() });
    const lesson = await a.post('/api/modules/lessons/items', { title: '函数单调性' }, { key: harness.key() });
    const record = await a.post('/api/modules/classes/records', {
      classId: classroom.body.id,
      recordedOn: '2026-09-21',
      note: '例2没讲，任意性还需强调'
    }, { key: harness.key() });
    assert.equal(record.status, 201);

    const created = await a.post(ENTRIES, timedEntry({
      course: { classId: classroom.body.id, lessonId: lesson.body.id, recordIds: [record.body.id] }
    }), { key: harness.key() });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.course, {
      classId: classroom.body.id,
      lessonId: lesson.body.id,
      recordIds: [record.body.id]
    });
    assert.equal(created.body.courseState.classroom.currentLabel, '高一(1)班');
    assert.equal(created.body.courseState.classroom.deleted, false);
    assert.equal(created.body.courseState.lesson.currentLabel, '函数单调性');
    assert.equal(created.body.courseState.records[0].currentLabel, '例2没讲，任意性还需强调');

    // Another class record cannot be attached to this class.
    const mismatched = await a.post(ENTRIES, timedEntry({
      course: { classId: otherClass.body.id, lessonId: null, recordIds: [record.body.id] }
    }), { key: harness.key() });
    assert.equal(mismatched.status, 409);
    assert.equal(mismatched.body.type, '/problems/workbench/class-mismatch');

    // Another account's objects are a 404, never a leak.
    const foreign = await b.get(`${ENTRIES}/${created.body.id}`);
    assert.equal(foreign.status, 404);
    const foreignClass = await a.post(ENTRIES, timedEntry({
      course: { classId: '99999999-0000-4000-8000-000000000009', lessonId: null, recordIds: [] }
    }), { key: harness.key() });
    assert.equal(foreignClass.status, 404);

    // A deleted lesson stays readable on the existing link but cannot be linked anew.
    await a.post(`/api/modules/lessons/items/${lesson.body.id}/deletion`, { deleted: true }, { key: harness.key() });
    const readBack = await a.get(`${ENTRIES}/${created.body.id}`);
    assert.equal(readBack.body.courseState.lesson.deleted, true);
    assert.equal(readBack.body.courseState.lesson.currentLabel, '函数单调性');
    assert.equal(readBack.body.courseState.lesson.labelAtLink, '函数单调性');

    const relink = await a.post(ENTRIES, timedEntry({
      course: { classId: null, lessonId: lesson.body.id, recordIds: [] }
    }), { key: harness.key() });
    assert.equal(relink.status, 409);
    assert.equal(relink.body.type, '/problems/workbench/reference-deleted');

    // Editing an unrelated field keeps the deleted link.
    const renamed = await a.put(`${ENTRIES}/${created.body.id}`, {
      expectedVersion: created.body.version,
      ...timedEntry({
        title: '备课（改）',
        course: { classId: classroom.body.id, lessonId: lesson.body.id, recordIds: [record.body.id] }
      })
    }, { key: harness.key() });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.version, created.body.version + 1);
    assert.equal(renamed.body.courseState.lesson.deleted, true);

    // A repeating template cannot carry record links.
    const repeating = await a.post(ENTRIES, weeklyEntry({
      course: { classId: classroom.body.id, lessonId: null, recordIds: [record.body.id] }
    }), { key: harness.key() });
    assert.equal(repeating.status, 422);
    assert.equal(repeating.body.field, '/course/recordIds');
    assert.equal(repeating.body.reason, 'out-of-range');
  });
});

test('repeating templates keep the first day, zone and kind after the first save', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, weeklyEntry(), { key: harness.key() });
    assert.equal(created.status, 201);
    const url = `${ENTRIES}/${created.body.id}`;

    const movedFirstDay = await a.put(url, {
      expectedVersion: 1,
      ...weeklyEntry({ time: { ...weeklyEntry().time, date: '2026-09-28' } })
    }, { key: harness.key() });
    assert.equal(movedFirstDay.status, 409);
    assert.equal(movedFirstDay.body.type, '/problems/workbench/immutable-series');

    const movedZone = await a.put(url, {
      expectedVersion: 1,
      ...weeklyEntry({ time: { ...weeklyEntry().time, timeZone: 'America/New_York' } })
    }, { key: harness.key() });
    assert.equal(movedZone.status, 409);

    const unroll = await a.put(url, { expectedVersion: 1, ...timedEntry() }, { key: harness.key() });
    assert.equal(unroll.status, 409);

    const nonRepeating = await a.post(ENTRIES, timedEntry(), { key: harness.key() });
    const toWeekly = await a.put(`${ENTRIES}/${nonRepeating.body.id}`, {
      expectedVersion: 1,
      ...weeklyEntry()
    }, { key: harness.key() });
    assert.equal(toWeekly.status, 409);
    assert.equal(toWeekly.body.type, '/problems/workbench/immutable-series');

    // A non-repeating entry may still move freely in time.
    const moved = await a.put(`${ENTRIES}/${nonRepeating.body.id}`, {
      expectedVersion: 1,
      ...timedEntry({ time: { date: '2026-10-02', startTime: '09:00', timeZone: 'America/New_York', durationMinutes: 45 } })
    }, { key: harness.key() });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.time.date, '2026-10-02');
    assert.equal(moved.body.time.timeZone, 'America/New_York');
  });
});

test('delete and restore are versioned and a deleted entry rejects edits', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, timedEntry(), { key: harness.key() });
    const url = `${ENTRIES}/${created.body.id}`;

    const deleted = await a.post(`${url}/deletion`, { expectedVersion: 1, deleted: true }, { key: harness.key() });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.version, 2);
    assert.equal(typeof deleted.body.deletedAt, 'string');

    const listActive = await a.get(ENTRIES);
    assert.equal(listActive.body.items.length, 0);
    const listDeleted = await a.get(ENTRIES, { state: 'deleted' });
    assert.equal(listDeleted.body.items.length, 1);

    const edit = await a.put(url, { expectedVersion: 2, ...timedEntry() }, { key: harness.key() });
    assert.equal(edit.status, 409);
    assert.equal(edit.body.type, '/problems/workbench/object-deleted');

    const occurrences = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-09-21' });
    assert.equal(occurrences.body.items.length, 0);

    const restored = await a.post(`${url}/deletion`, { expectedVersion: 2, deleted: false }, { key: harness.key() });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.version, 3);
    assert.equal(restored.body.deletedAt, null);
    const afterRestore = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-09-21' });
    assert.equal(afterRestore.body.items.length, 1);
  });
});

test('write protocol keeps source, identity, conflict and unknown-result rules intact', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, timedEntry(), { key: harness.key() });
    const url = `${ENTRIES}/${created.body.id}`;

    const badOrigin = await a.put(url, { expectedVersion: 1, ...timedEntry() }, {
      key: harness.key(),
      origin: 'https://evil.example'
    });
    assert.equal(badOrigin.status, 403);
    assert.equal(badOrigin.body.type, '/problems/workbench/request-not-allowed');

    const noProtection = await a.put(url, { expectedVersion: 1, ...timedEntry() }, {
      key: harness.key(),
      protection: null
    });
    assert.equal(noProtection.status, 403);

    const anonymous = await harness.raw()
      .post(ENTRIES)
      .set('Origin', harness.trustedOrigin)
      .set('X-TeachBuddy-Request', '1')
      .set('Idempotency-Key', harness.key())
      .send(timedEntry());
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.type, '/problems/workbench/unauthenticated');

    // A committed write whose response is lost is replayed by the same key.
    const key = harness.key();
    const first = await a.put(url, { expectedVersion: 1, ...timedEntry({ title: '第一次' }) }, { key });
    assert.equal(first.status, 200);
    const replay = await a.put(url, { expectedVersion: 1, ...timedEntry({ title: '第一次' }) }, { key });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body, first.body);
    const reused = await a.put(url, { expectedVersion: 1, ...timedEntry({ title: '第二次' }) }, { key });
    assert.equal(reused.status, 409);
    assert.equal(reused.body.type, '/problems/workbench/idempotency-key-reused');

    const stale = await a.put(url, { expectedVersion: 1, ...timedEntry() }, { key: harness.key() });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.type, '/problems/workbench/version-conflict');
    assert.equal(stale.body.objectId, created.body.id);
    assert.equal(stale.body.currentVersion, 2);

    const wrongQuery = await a.get(ENTRIES, { unknown: '1' });
    assert.equal(wrongQuery.status, 422);
    assert.equal(wrongQuery.body.field, '/query/unknown');
    assert.equal(wrongQuery.body.reason, 'unknown-field');
  });
});

test('entry lists are stable, repeated queries are rejected and PUT replaces the whole body', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const first = await a.post(ENTRIES, timedEntry({ title: '第一段' }), { key: harness.key() });
    const second = await a.post(ENTRIES, timedEntry({ title: '第二段' }), { key: harness.key() });
    const third = await a.post(ENTRIES, unstableEntry(), { key: harness.key() });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(third.status, 201);

    // The fixed clock makes updatedAt equal, so the stable tiebreaker is id asc.
    const list = await a.get(ENTRIES);
    assert.deepEqual(
      list.body.items.map((item) => item.id),
      [first.body.id, second.body.id, third.body.id].sort()
    );

    // A repeated query key is a request-schema rejection, not a silent pick.
    const repeated = await a.get(`${ENTRIES}?placement=all&placement=unscheduled`);
    assert.equal(repeated.status, 422);
    assert.equal(repeated.body.field, '/query/placement');
    assert.equal(repeated.body.reason, 'duplicate-id');

    // An undeclared enum value is rejected too.
    const badEnum = await a.get(`${ENTRIES}?state=everything`);
    assert.equal(badEnum.status, 422);
    assert.equal(badEnum.body.field, '/query/state');
    assert.equal(badEnum.body.reason, 'out-of-range');

    // PUT is a full replacement: an omitted field is not "keep the old value".
    const { items, ...withoutItems } = timedEntry({ title: '缺字段' });
    const missing = await a.put(`${ENTRIES}/${first.body.id}`, {
      expectedVersion: 1,
      ...withoutItems
    }, { key: harness.key() });
    assert.equal(missing.status, 422);
    assert.equal(missing.body.field, '/items');
    assert.equal(missing.body.reason, 'required');

    // The same body with a new key still advances the version.
    const same = await a.put(`${ENTRIES}/${first.body.id}`, {
      expectedVersion: 1,
      ...timedEntry({ title: '第一段' })
    }, { key: harness.key() });
    assert.equal(same.status, 200);
    assert.equal(same.body.version, 2);
  });
});

function unstableEntry() {
  return {
    title: '',
    items: [{ id: SAMPLE_IDS.itemTwo, text: '未排期事项', priority: 'low' }],
    time: null,
    repeat: null,
    course: emptyCourse(),
    reminder: null
  };
}

test('permanent deletion guards ownership/version, removes child rows and replays after restart', async () => {
  await withHarness(async harness => {
    const a = harness.agent(harness.account('teacher-a'));
    const b = harness.agent(harness.account('teacher-b'));
    const created = await a.post(ENTRIES, weeklyEntry(), { key: harness.key() });
    const id = created.body.id;
    const exception = await a.put(`${ENTRIES}/${id}/exceptions/2026-09-28`, { expectedVersion: 1, mode: 'cancelled' }, { key: harness.key() });
    assert.equal(exception.status, 200);
    const entry = await a.get(`${ENTRIES}/${id}`);
    const version = entry.body.version;
    harness.workbench().db.prepare('INSERT INTO schedule_instance_arms (entryId, originDate, armedAt) VALUES (?, ?, ?)').run(id, '2026-10-05', '2026-09-21T00:00:00Z');
    assert.equal((await b.post(`${ENTRIES}/${id}/delete`, { expectedVersion: version }, { key: harness.key() })).status, 404);
    assert.equal((await a.post(`${ENTRIES}/${id}/delete`, { expectedVersion: 1 }, { key: harness.key() })).status, 409);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM schedule_exceptions WHERE entryId = ?', id), 1);
    const key = harness.key();
    const deleted = await a.post(`${ENTRIES}/${id}/delete`, { expectedVersion: version }, { key });
    assert.equal(deleted.status, 200);
    for (const table of ['schedule_entries', 'schedule_exceptions', 'schedule_instance_arms']) {
      const column = table === 'schedule_entries' ? 'id' : 'entryId';
      assert.equal(harness.count(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`, id), 0);
    }
    assert.equal((await a.get(`${ENTRIES}/${id}`)).status, 404);
    assert.equal((await a.post(`${ENTRIES}/${id}/deletion`, { expectedVersion: version, deleted: false }, { key: harness.key() })).status, 404);
    await harness.restart();
    const replay = await harness.agent(harness.account('teacher-a')).post(`${ENTRIES}/${id}/delete`, { expectedVersion: version }, { key });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body, deleted.body);
  });
});

test('detaching an occurrence is atomic, idempotent and survives deletion of its repeat rule', async () => {
  await withHarness(async harness => {
    const a = harness.agent(harness.account('teacher-a'));
    const calendar = { allDay: false, notes: '课堂笔记', tags: [] };
    const created = await a.post(ENTRIES, weeklyEntry({ calendar }), { key: harness.key() });
    const id = created.body.id;
    const url = `${ENTRIES}/${id}/occurrences/2026-09-21/detach`;
    const content = timedEntry({ calendar, title: '本次调整', expectedVersion: 1 });
    const bad = await a.post(url, { ...content, expectedVersion: 99 }, { key: harness.key() });
    assert.equal(bad.status, 409);
    assert.equal((await a.get(`${ENTRIES}/${id}/occurrence`, { originDate: '2026-09-21' })).body.state, 'active');
    assert.equal((await a.get(ENTRIES)).body.items.length, 1);
    const key = harness.key();
    const detached = await a.post(url, content, { key });
    assert.equal(detached.status, 201);
    assert.notEqual(detached.body.id, id);
    assert.equal(detached.body.repeat, null);
    assert.deepEqual(detached.body.items, content.items);
    assert.deepEqual(detached.body.calendar, calendar);
    assert.deepEqual((await a.post(url, content, { key })).body, detached.body);
    assert.equal((await a.get(ENTRIES)).body.items.length, 2);
    assert.equal((await a.get(`${ENTRIES}/${id}/occurrence`, { originDate: '2026-09-21' })).body.state, 'cancelled');
    assert.equal((await a.get(`${ENTRIES}/${id}/occurrence`, { originDate: '2026-09-28' })).body.state, 'active');
    const removed = await a.post(`${ENTRIES}/${id}/delete`, { expectedVersion: 2 }, { key: harness.key() });
    assert.equal(removed.status, 200);
    assert.equal((await a.get(`${ENTRIES}/${detached.body.id}`)).body.deletedAt, null);
  });
});

test('item completion is optional for old entries, validated and persisted with item moves', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const original = unscheduledEntry();
    original.items[0].completed = true;
    const created = await a.post(ENTRIES, original, { key: harness.key() });
    assert.equal(created.status, 201);
    const entry = created.body;
    assert.equal((await a.get(`${ENTRIES}/${entry.id}`)).body.items[0].completed, true);
    const invalid = await a.put(`${ENTRIES}/${entry.id}`, { ...original, items: [{ ...original.items[0], completed: 'true' }], expectedVersion: entry.version }, { key: harness.key() });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.body.field, '/items/0/completed');
    const target = await a.post(ENTRIES, unscheduledEntry({ title: '目标', items: [] }), { key: harness.key() });
    const moved = await a.post('/api/modules/schedule/item-moves', { itemId: original.items[0].id, fromEntryId: entry.id, fromVersion: entry.version, toEntryId: target.body.id, toVersion: target.body.version, toIndex: 0 }, { key: harness.key() });
    assert.equal(moved.status, 200);
    const stored = (await a.get(`${ENTRIES}/${target.body.id}`)).body;
    assert.equal(stored.items[0].completed, true);
    const updated = await a.put(`${ENTRIES}/${stored.id}`, { title: stored.title, items: [{ ...stored.items[0], completed: false }], time: stored.time, repeat: stored.repeat, reminder: stored.reminder, course: stored.course, expectedVersion: stored.version }, { key: harness.key() });
    assert.equal(updated.status, 200);
    assert.equal((await a.get(`${ENTRIES}/${stored.id}`)).body.items[0].completed, false);
  });
});
