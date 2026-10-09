/**
 * TT-C3 / WB-T009-011: weekly repetition, single-instance exceptions, range
 * boundaries, account timezone and DST through the public HTTP operations.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduleHarness } from './fixtures/teaching-time-schedule/harness.js';
import { SAMPLE_IDS, overrideContent, weeklyEntry } from './fixtures/teaching-time-schedule/samples.js';

const SETTINGS = '/api/modules/schedule/settings';
const ENTRIES = '/api/modules/schedule/entries';
const OCCURRENCES = '/api/modules/schedule/occurrences';

async function withHarness(run) {
  const harness = await createScheduleHarness();
  try {
    await run(harness);
  } finally {
    await harness.close();
  }
}

async function createWeekly(harness, overrides = {}) {
  const a = harness.agent(harness.account('teacher-a'));
  const response = await a.post(ENTRIES, weeklyEntry(overrides), { key: harness.key() });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { a, entry: response.body };
}

test('a weekly series expands to one instance per week with stable origin dates', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness);
    const range = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-10-12' });
    assert.equal(range.status, 200);
    assert.deepEqual(range.body.items.map((item) => item.key.originDate), ['2026-09-21', '2026-09-28', '2026-10-05']);
    assert.deepEqual(range.body.items.map((item) => item.startsAt), [
      '2026-09-21T07:00:00Z',
      '2026-09-28T07:00:00Z',
      '2026-10-05T07:00:00Z'
    ]);
    assert.ok(range.body.items.every((item) => item.exception === false && item.state === 'active'));
    assert.ok(range.body.items.every((item) => item.key.entryId === entry.id));
    // No instance rows are materialised.
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM schedule_entries'), 1);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM schedule_exceptions'), 0);
  });
});

test('a single-instance override keeps its origin identity and is found on the moved date', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness);
    const url = `${ENTRIES}/${entry.id}`;

    const override = await a.put(`${url}/exceptions/2026-09-28`, {
      expectedVersion: 1,
      mode: 'override',
      content: overrideContent()
    }, { key: harness.key() });
    assert.equal(override.status, 200, JSON.stringify(override.body));
    assert.deepEqual(override.body.key, { entryId: entry.id, originDate: '2026-09-28' });
    assert.equal(override.body.entryVersion, 2);
    assert.equal(override.body.exception, true);
    assert.equal(override.body.startsAt, '2026-09-29T08:00:00Z');
    assert.equal(override.body.endsAt, '2026-09-29T09:30:00Z');

    const movedDay = await a.get(OCCURRENCES, { from: '2026-09-29', to: '2026-09-29' });
    assert.deepEqual(movedDay.body.items.map((item) => item.key.originDate), ['2026-09-28']);
    assert.equal(movedDay.body.items[0].startsAt, '2026-09-29T08:00:00Z');

    const originalDay = await a.get(OCCURRENCES, { from: '2026-09-28', to: '2026-09-28' });
    assert.equal(originalDay.body.items.length, 0);

    const otherWeeks = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-09-21' });
    assert.deepEqual(otherWeeks.body.items.map((item) => item.startsAt), ['2026-09-21T07:00:00Z']);

    // A whole-group edit keeps the exception content untouched.
    const groupUpdate = await a.put(url, {
      expectedVersion: 2,
      ...weeklyEntry({ time: { ...weeklyEntry().time, startTime: '14:00' } })
    }, { key: harness.key() });
    assert.equal(groupUpdate.status, 200);
    assert.equal(groupUpdate.body.version, 3);
    assert.equal(groupUpdate.body.time.startTime, '14:00');

    const afterGroup = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-10-05' });
    const byOrigin = new Map(afterGroup.body.items.map((item) => [item.key.originDate, item]));
    assert.equal(byOrigin.get('2026-09-21').startsAt, '2026-09-21T06:00:00Z');
    assert.equal(byOrigin.get('2026-09-28').startsAt, '2026-09-29T08:00:00Z');
    assert.equal(byOrigin.get('2026-10-05').startsAt, '2026-10-05T06:00:00Z');
  });
});

test('shortening and extending the series hides and restores exceptions without deleting them', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness);
    const url = `${ENTRIES}/${entry.id}`;
    await a.put(`${url}/exceptions/2026-09-28`, {
      expectedVersion: 1,
      mode: 'override',
      content: overrideContent()
    }, { key: harness.key() });

    const shortened = await a.put(url, {
      expectedVersion: 2,
      ...weeklyEntry({ repeat: { until: '2026-09-21' } })
    }, { key: harness.key() });
    assert.equal(shortened.status, 200);
    assert.equal(shortened.body.version, 3);

    const exceptions = await a.get(`${url}/exceptions`);
    assert.equal(exceptions.status, 200);
    assert.equal(exceptions.body.version, 3);
    assert.deepEqual(exceptions.body.items.map((item) => [item.originDate, item.eligible]), [['2026-09-28', false]]);
    assert.equal(exceptions.body.items[0].mode, 'override');
    assert.equal(exceptions.body.items[0].content.time.date, '2026-09-29');

    const hidden = await a.get(`${url}/occurrence`, { originDate: '2026-09-28' });
    assert.equal(hidden.status, 200);
    assert.equal(hidden.body.state, 'outside-series');
    assert.equal(hidden.body.key.originDate, '2026-09-28');

    const rangeWhileHidden = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-10-12' });
    assert.deepEqual(rangeWhileHidden.body.items.map((item) => item.key.originDate), ['2026-09-21']);

    const extended = await a.put(url, {
      expectedVersion: 3,
      ...weeklyEntry()
    }, { key: harness.key() });
    assert.equal(extended.status, 200);
    const restored = await a.get(OCCURRENCES, { from: '2026-09-29', to: '2026-09-29' });
    assert.equal(restored.body.items.length, 1);
    assert.equal(restored.body.items[0].startsAt, '2026-09-29T08:00:00Z');
  });
});

test('cancel, restore and repeated inherit each advance the group version', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness);
    const url = `${ENTRIES}/${entry.id}`;

    const cancelled = await a.put(`${url}/exceptions/2026-09-28`, {
      expectedVersion: 1,
      mode: 'cancelled'
    }, { key: harness.key() });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.state, 'cancelled');
    assert.equal(cancelled.body.entryVersion, 2);
    assert.equal(cancelled.body.exception, true);
    assert.equal(cancelled.body.time.date, '2026-09-28');
    assert.equal(cancelled.body.startsAt, '2026-09-28T07:00:00Z');

    const range = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-10-05' });
    assert.deepEqual(range.body.items.map((item) => item.key.originDate), ['2026-09-21', '2026-10-05']);

    const single = await a.get(`${url}/occurrence`, { originDate: '2026-09-28' });
    assert.equal(single.body.state, 'cancelled');

    const inherited = await a.put(`${url}/exceptions/2026-09-28`, {
      expectedVersion: 2,
      mode: 'inherit'
    }, { key: harness.key() });
    assert.equal(inherited.status, 200);
    assert.equal(inherited.body.state, 'active');
    assert.equal(inherited.body.exception, false);
    assert.equal(inherited.body.entryVersion, 3);
    assert.equal(inherited.body.time.date, '2026-09-28');
    assert.equal(inherited.body.startsAt, '2026-09-28T07:00:00Z');

    const repeated = await a.put(`${url}/exceptions/2026-09-28`, {
      expectedVersion: 3,
      mode: 'inherit'
    }, { key: harness.key() });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.entryVersion, 4);
  });
});

test('a deleted group shows deleted instances and restores its exceptions', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness);
    const url = `${ENTRIES}/${entry.id}`;
    await a.put(`${url}/exceptions/2026-09-28`, {
      expectedVersion: 1,
      mode: 'cancelled'
    }, { key: harness.key() });

    const deleted = await a.post(`${url}/deletion`, { expectedVersion: 2, deleted: true }, { key: harness.key() });
    assert.equal(deleted.status, 200);

    const single = await a.get(`${url}/occurrence`, { originDate: '2026-09-21' });
    assert.equal(single.body.state, 'deleted');
    const stillCancelled = await a.get(`${url}/occurrence`, { originDate: '2026-09-28' });
    assert.equal(stillCancelled.body.state, 'deleted');

    const range = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-10-05' });
    assert.equal(range.body.items.length, 0);

    const restored = await a.post(`${url}/deletion`, { expectedVersion: 3, deleted: false }, { key: harness.key() });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.deletedAt, null);
    const afterRestore = await a.get(`${url}/occurrence`, { originDate: '2026-09-28' });
    assert.equal(afterRestore.body.state, 'cancelled');
  });
});

test('origin dates off the weekly rhythm are not found and out-of-range writes are 422', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness);
    const url = `${ENTRIES}/${entry.id}`;

    const offRhythm = await a.get(`${url}/occurrence`, { originDate: '2026-09-22' });
    assert.equal(offRhythm.status, 404);
    assert.equal(offRhythm.body.type, '/problems/workbench/not-found');

    const beforeFirst = await a.get(`${url}/occurrence`, { originDate: '2026-09-14' });
    assert.equal(beforeFirst.status, 404);

    const missingOrigin = await a.get(`${url}/occurrence`);
    assert.equal(missingOrigin.status, 422);
    assert.equal(missingOrigin.body.field, '/query/originDate');
    assert.equal(missingOrigin.body.reason, 'required');

    const writeOffRhythm = await a.put(`${url}/exceptions/2026-09-22`, {
      expectedVersion: 1,
      mode: 'cancelled'
    }, { key: harness.key() });
    assert.equal(writeOffRhythm.status, 404);

    const beyondUntil = await a.put(`${url}/exceptions/2026-10-12`, {
      expectedVersion: 1,
      mode: 'cancelled'
    }, { key: harness.key() });
    assert.equal(beyondUntil.status, 422);
    assert.equal(beyondUntil.body.field, '/originDate');
    assert.equal(beyondUntil.body.reason, 'out-of-range');

    const nonRepeating = await a.post(ENTRIES, weeklyEntry({ repeat: null }), { key: harness.key() });
    const withOrigin = await a.get(`${ENTRIES}/${nonRepeating.body.id}/occurrence`, { originDate: '2026-09-21' });
    assert.equal(withOrigin.status, 422);
    assert.equal(withOrigin.body.field, '/query/originDate');

    const unscheduled = await a.post(ENTRIES, {
      ...weeklyEntry({ repeat: null, time: null, items: [{ id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }] })
    }, { key: harness.key() });
    const unscheduledOccurrence = await a.get(`${ENTRIES}/${unscheduled.body.id}/occurrence`);
    assert.equal(unscheduledOccurrence.status, 404);
  });
});

test('range queries use the account timezone half-open interval and reject bad bounds', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness, {
      time: { date: '2026-09-27', startTime: '23:30', timeZone: 'Asia/Shanghai', durationMinutes: 120 }
    });
    const entryId = entry.id;

    const bothDays = await a.get(OCCURRENCES, { from: '2026-09-27', to: '2026-09-28' });
    assert.equal(bothDays.body.items.length, 1);
    assert.equal(bothDays.body.items[0].startsAt, '2026-09-27T15:30:00Z');
    assert.equal(bothDays.body.items[0].endsAt, '2026-09-27T17:30:00Z');
    assert.equal(bothDays.body.timeZone, 'Asia/Shanghai');

    const secondDayOnly = await a.get(OCCURRENCES, { from: '2026-09-28', to: '2026-09-28' });
    assert.equal(secondDayOnly.body.items.length, 1);
    assert.equal(secondDayOnly.body.items[0].key.originDate, '2026-09-27');

    const firstDayOnly = await a.get(OCCURRENCES, { from: '2026-09-27', to: '2026-09-27' });
    assert.equal(firstDayOnly.body.items.length, 1);

    // An instance that ends exactly at the next local midnight stays on its day.
    const midnight = await a.post(ENTRIES, weeklyEntry({
      repeat: null,
      time: { date: '2026-09-28', startTime: '22:00', timeZone: 'Asia/Shanghai', durationMinutes: 120 }
    }), { key: harness.key() });
    assert.equal(midnight.status, 201);
    const midnightNextDay = await a.get(OCCURRENCES, { from: '2026-09-29', to: '2026-09-29' });
    assert.equal(midnightNextDay.body.items.length, 0);
    const midnightSameDay = await a.get(OCCURRENCES, { from: '2026-09-28', to: '2026-09-28' });
    // The weekly instance that started 09-27 23:30 is still running on 09-28,
    // and the new 22:00 instance belongs to 09-28 alone.
    assert.deepEqual(
      midnightSameDay.body.items.map((item) => item.key.entryId).sort(),
      [entryId, midnight.body.id].sort()
    );

    const reversed = await a.get(OCCURRENCES, { from: '2026-10-01', to: '2026-09-21' });
    assert.equal(reversed.status, 422);
    assert.equal(reversed.body.field, '/query/from');
    assert.equal(reversed.body.reason, 'out-of-range');

    const missing = await a.get(OCCURRENCES, { to: '2026-09-21' });
    assert.equal(missing.status, 422);
    assert.equal(missing.body.field, '/query/from');
    assert.equal(missing.body.reason, 'required');

    const badDate = await a.get(OCCURRENCES, { from: '2026-02-30', to: '2026-03-01' });
    assert.equal(badDate.status, 422);
    assert.equal(badDate.body.field, '/query/from');
    assert.equal(badDate.body.reason, 'out-of-range');

    const beyondWindow = await a.get(OCCURRENCES, { from: '2026-01-01', to: '2101-01-01' });
    assert.equal(beyondWindow.status, 422);
    assert.equal(beyondWindow.body.field, '/query/to');

    const longRange = await a.get(OCCURRENCES, { from: '2026-01-01', to: '2027-01-01' });
    assert.equal(longRange.status, 200);
    assert.equal(longRange.body.items.length, 3);
  });
});

test('a 25-hour DST day keeps the half-open local-day boundaries', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const early = await a.post(ENTRIES, weeklyEntry({
      repeat: null,
      time: { date: '2026-11-01', startTime: '00:15', timeZone: 'America/New_York', durationMinutes: 30 }
    }), { key: harness.key() });
    const midnight = await a.post(ENTRIES, weeklyEntry({
      repeat: null,
      time: { date: '2026-11-02', startTime: '00:00', timeZone: 'America/New_York', durationMinutes: 30 }
    }), { key: harness.key() });
    assert.equal(early.status, 201);
    assert.equal(midnight.status, 201);

    const day = await a.get(OCCURRENCES, { from: '2026-11-01', to: '2026-11-01' });
    assert.deepEqual(day.body.items.map((item) => item.key.entryId), [early.body.id]);
    assert.equal(day.body.items[0].startsAt, '2026-11-01T04:15:00Z');

    // The instance starting exactly at the next local midnight belongs to the
    // next day; the 25-hour day still contains the whole local day.
    const nextDay = await a.get(OCCURRENCES, { from: '2026-11-02', to: '2026-11-02' });
    assert.deepEqual(nextDay.body.items.map((item) => item.key.entryId), [midnight.body.id]);
    assert.equal(nextDay.body.items[0].startsAt, '2026-11-02T05:00:00Z');
  });
});

test('DST gaps and overlaps resolve to the exact UTC instants the contract fixes', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const gap = await a.post(ENTRIES, weeklyEntry({
      time: { date: '2026-03-01', startTime: '02:30', timeZone: 'America/New_York', durationMinutes: 60 },
      repeat: { until: '2026-03-08' },
      reminder: null
    }), { key: harness.key() });
    assert.equal(gap.status, 201);

    const march = await a.get(OCCURRENCES, { from: '2026-03-01', to: '2026-03-08' });
    assert.equal(march.body.items.length, 2);
    const [first, second] = march.body.items;
    assert.equal(first.startsAt, '2026-03-01T07:30:00Z');
    assert.equal(first.timeAdjusted, false);
    assert.equal(second.startsAt, '2026-03-08T07:30:00Z');
    assert.equal(second.endsAt, '2026-03-08T08:30:00Z');
    assert.equal(second.timeAdjusted, true);
    assert.equal(second.time.startTime, '02:30');
    assert.equal(second.time.date, '2026-03-08');

    const overlap = await a.post(ENTRIES, weeklyEntry({
      repeat: null,
      time: { date: '2026-11-01', startTime: '01:30', timeZone: 'America/New_York', durationMinutes: 60 }
    }), { key: harness.key() });
    assert.equal(overlap.status, 201);
    const november = await a.get(OCCURRENCES, { from: '2026-11-01', to: '2026-11-01' });
    const instance = november.body.items.find((item) => item.key.entryId === overlap.body.id);
    assert.equal(instance.startsAt, '2026-11-01T05:30:00Z');
    assert.equal(instance.endsAt, '2026-11-01T06:30:00Z');
    assert.equal(instance.timeAdjusted, false);
  });
});

test('changing the account timezone preserves local task clock and moves actual instants', async () => {
  await withHarness(async (harness) => {
    const { a, entry } = await createWeekly(harness);
    const before = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-09-21' });
    assert.equal(before.body.timeZone, 'Asia/Shanghai');
    assert.equal(before.body.items[0].startsAt, '2026-09-21T07:00:00Z');

    const updated = await a.put(SETTINGS, { timeZone: 'America/New_York', expectedVersion: 1 }, { key: harness.key() });
    assert.equal(updated.body.version, 2);

    const after = await a.get(OCCURRENCES, { from: '2026-09-20', to: '2026-09-20' });
    assert.equal(after.body.timeZone, 'America/New_York');
    // The task retains 15:00 local clock after switching regions.
    assert.deepEqual(after.body.items, []);

    const nextDay = await a.get(OCCURRENCES, { from: '2026-09-21', to: '2026-09-21' });
    assert.equal(nextDay.body.timeZone, 'America/New_York');
    assert.deepEqual(nextDay.body.items.map((item) => item.key.entryId), [entry.id]);
    assert.equal(nextDay.body.items[0].startsAt, '2026-09-21T19:00:00Z');
  });
});
