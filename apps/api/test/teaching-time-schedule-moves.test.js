/**
 * TT-C2 / WB-T006: atomic item moves between two active non-repeating entries.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduleHarness } from './fixtures/teaching-time-schedule/harness.js';
import { SAMPLE_IDS, timedEntry, unscheduledEntry, weeklyEntry } from './fixtures/teaching-time-schedule/samples.js';

const ENTRIES = '/api/modules/schedule/entries';
const MOVES = '/api/modules/schedule/item-moves';

const twoItems = [
  { id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' },
  { id: SAMPLE_IDS.itemTwo, text: '印讲义', priority: 'high' }
];

async function withHarness(run) {
  const harness = await createScheduleHarness();
  try {
    await run(harness);
  } finally {
    await harness.close();
  }
}

test('moving an item to a new unscheduled entry is one atomic result and replay-safe', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const source = await a.post(ENTRIES, timedEntry({ items: twoItems }), { key: harness.key() });
    assert.equal(source.status, 201);

    const key = harness.key();
    const body = {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: null,
      toVersion: null,
      toIndex: 0
    };
    const moved = await a.post(MOVES, body, { key });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.from.version, 2);
    assert.deepEqual(moved.body.from.items.map((item) => item.id), [SAMPLE_IDS.itemOne]);
    assert.equal(moved.body.to.version, 1);
    assert.equal(moved.body.to.time, null);
    assert.equal(moved.body.to.title, '');
    assert.deepEqual(moved.body.to.items, [{ id: SAMPLE_IDS.itemTwo, text: '印讲义', priority: 'high' }]);

    const replay = await a.post(MOVES, body, { key });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body, moved.body);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM schedule_entries'), 2);

    const unscheduled = await a.get(ENTRIES, { placement: 'unscheduled' });
    assert.deepEqual(unscheduled.body.items.map((item) => item.id), [moved.body.to.id]);

    await harness.restart();
    const afterRestart = harness.agent(harness.account('teacher-a'));
    const replayedAgain = await afterRestart.post(MOVES, body, { key });
    assert.equal(replayedAgain.status, 200);
    assert.deepEqual(replayedAgain.body, moved.body);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM schedule_entries'), 2);
  });
});

test('moving into an existing entry inserts at the index and rolls back entirely on conflict', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const source = await a.post(ENTRIES, timedEntry({ items: twoItems }), { key: harness.key() });
    const target = await a.post(ENTRIES, timedEntry({
      title: '目标段',
      time: { date: '2026-09-22', startTime: '10:00', timeZone: 'Asia/Shanghai', durationMinutes: 60 },
      items: [{ id: '50000000-0000-4000-8000-000000000009', text: '已有事项', priority: 'low' }],
      reminder: { side: 'after', minutes: 20 }
    }), { key: harness.key() });

    const moved = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: target.body.id,
      toVersion: 1,
      toIndex: 1
    }, { key: harness.key() });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.deepEqual(moved.body.to.items.map((item) => item.id), [
      '50000000-0000-4000-8000-000000000009',
      SAMPLE_IDS.itemTwo
    ]);
    assert.equal(moved.body.to.version, 2);
    assert.equal(moved.body.to.time.date, '2026-09-22');
    assert.deepEqual(moved.body.to.reminder, { side: 'after', minutes: 20 });

    const staleTarget = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemOne,
      fromEntryId: source.body.id,
      fromVersion: 2,
      toEntryId: target.body.id,
      toVersion: 1,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(staleTarget.status, 409);
    assert.equal(staleTarget.body.type, '/problems/workbench/version-conflict');
    assert.equal(staleTarget.body.objectId, target.body.id);
    assert.equal(staleTarget.body.currentVersion, 2);

    const sourceNow = await a.get(`${ENTRIES}/${source.body.id}`);
    assert.equal(sourceNow.body.version, 2);
    assert.equal(sourceNow.body.items.length, 1);
    const targetNow = await a.get(`${ENTRIES}/${target.body.id}`);
    assert.equal(targetNow.body.version, 2);
    assert.equal(targetNow.body.items.length, 2);

    const staleSource = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemOne,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: target.body.id,
      toVersion: 2,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(staleSource.status, 409);
    assert.equal(staleSource.body.objectId, source.body.id);

    // A duplicate can only be observed while the source still holds the item.
    const twins = await a.post(ENTRIES, timedEntry({
      title: '孪生来源',
      time: { date: '2026-09-25', startTime: '09:00', timeZone: 'Asia/Shanghai', durationMinutes: 30 },
      items: [{ id: '50000000-0000-4000-8000-000000000021', text: '同 ID 事项', priority: 'normal' }]
    }), { key: harness.key() });
    const twinTarget = await a.post(ENTRIES, timedEntry({
      title: '孪生目标',
      time: { date: '2026-09-26', startTime: '09:00', timeZone: 'Asia/Shanghai', durationMinutes: 30 },
      items: [{ id: '50000000-0000-4000-8000-000000000021', text: '同 ID 事项', priority: 'normal' }]
    }), { key: harness.key() });
    const duplicate = await a.post(MOVES, {
      itemId: '50000000-0000-4000-8000-000000000021',
      fromEntryId: twins.body.id,
      fromVersion: 1,
      toEntryId: twinTarget.body.id,
      toVersion: 1,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(duplicate.status, 422);
    assert.equal(duplicate.body.field, '/itemId');
    assert.equal(duplicate.body.reason, 'duplicate-id');
    assert.equal((await a.get(`${ENTRIES}/${twins.body.id}`)).body.version, 1);
    assert.equal((await a.get(`${ENTRIES}/${twinTarget.body.id}`)).body.version, 1);
    assert.equal((await a.get(`${ENTRIES}/${source.body.id}`)).body.version, 2);
    assert.equal((await a.get(`${ENTRIES}/${target.body.id}`)).body.version, 2);

    const outOfRange = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemOne,
      fromEntryId: source.body.id,
      fromVersion: 2,
      toEntryId: target.body.id,
      toVersion: 2,
      toIndex: 5
    }, { key: harness.key() });
    assert.equal(outOfRange.status, 422);
    assert.equal(outOfRange.body.field, '/toIndex');
    assert.equal(outOfRange.body.reason, 'out-of-range');
  });
});

test('invalid move shapes and repeating participants are rejected without a partial write', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const source = await a.post(ENTRIES, timedEntry({ items: twoItems }), { key: harness.key() });
    const target = await a.post(ENTRIES, timedEntry({
      title: '另一段',
      time: { date: '2026-09-23', startTime: '10:00', timeZone: 'Asia/Shanghai', durationMinutes: 60 },
      items: [{ id: '50000000-0000-4000-8000-000000000010', text: '另一事项', priority: 'low' }]
    }), { key: harness.key() });

    const sameEntry = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: source.body.id,
      toVersion: 1,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(sameEntry.status, 409);
    assert.equal(sameEntry.body.type, '/problems/workbench/invalid-move');

    const unknownItem = await a.post(MOVES, {
      itemId: '50000000-0000-4000-8000-0000000000ff',
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: target.body.id,
      toVersion: 1,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(unknownItem.status, 422);
    assert.equal(unknownItem.body.field, '/itemId');
    assert.equal(unknownItem.body.reason, 'invalid-reference');

    const newTargetWithVersion = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: null,
      toVersion: 1,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(newTargetWithVersion.status, 422);
    assert.equal(newTargetWithVersion.body.field, '/toVersion');

    const newTargetWithIndex = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: null,
      toVersion: null,
      toIndex: 2
    }, { key: harness.key() });
    assert.equal(newTargetWithIndex.status, 422);
    assert.equal(newTargetWithIndex.body.field, '/toIndex');

    const missingTargetVersion = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: target.body.id,
      toVersion: null,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(missingTargetVersion.status, 422);
    assert.equal(missingTargetVersion.body.field, '/toVersion');

    const weekly = await a.post(ENTRIES, weeklyEntry(), { key: harness.key() });
    const repeatingSource = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemOne,
      fromEntryId: weekly.body.id,
      fromVersion: 1,
      toEntryId: null,
      toVersion: null,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(repeatingSource.status, 409);
    assert.equal(repeatingSource.body.type, '/problems/workbench/invalid-move');

    const repeatingTarget = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: weekly.body.id,
      toVersion: 1,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(repeatingTarget.status, 409);
    assert.equal(repeatingTarget.body.type, '/problems/workbench/invalid-move');

    const sourceNow = await a.get(`${ENTRIES}/${source.body.id}`);
    assert.equal(sourceNow.body.version, 1);
    assert.equal(sourceNow.body.items.length, 2);
  });
});

test('an emptied untitled source is soft-deleted while a titled source stays', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const untitled = await a.post(ENTRIES, unscheduledEntry(), { key: harness.key() });
    const titled = await a.post(ENTRIES, unscheduledEntry({ title: '有标题的安排' }), { key: harness.key() });

    const first = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemOne,
      fromEntryId: untitled.body.id,
      fromVersion: 1,
      toEntryId: null,
      toVersion: null,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(first.status, 200);
    assert.equal(first.body.from.version, 2);
    assert.equal(typeof first.body.from.deletedAt, 'string');
    assert.deepEqual(first.body.from.items, []);

    const second = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemOne,
      fromEntryId: titled.body.id,
      fromVersion: 1,
      toEntryId: null,
      toVersion: null,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(second.status, 200);
    assert.equal(second.body.from.deletedAt, null);
    assert.equal(second.body.from.title, '有标题的安排');
    assert.deepEqual(second.body.from.items, []);

    const active = await a.get(ENTRIES);
    assert.ok(active.body.items.some((item) => item.id === titled.body.id));
    assert.ok(!active.body.items.some((item) => item.id === untitled.body.id));
    const deleted = await a.get(ENTRIES, { state: 'deleted' });
    assert.deepEqual(deleted.body.items.map((item) => item.id), [untitled.body.id]);
  });
});

test('deleted source or target rejects the move before any change', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const source = await a.post(ENTRIES, timedEntry({ items: twoItems }), { key: harness.key() });
    const target = await a.post(ENTRIES, timedEntry({
      title: '目标',
      time: { date: '2026-09-24', startTime: '11:00', timeZone: 'Asia/Shanghai', durationMinutes: 60 },
      items: [{ id: '50000000-0000-4000-8000-000000000011', text: '事项', priority: 'low' }]
    }), { key: harness.key() });
    await a.post(`${ENTRIES}/${target.body.id}/deletion`, { expectedVersion: 1, deleted: true }, { key: harness.key() });

    const response = await a.post(MOVES, {
      itemId: SAMPLE_IDS.itemTwo,
      fromEntryId: source.body.id,
      fromVersion: 1,
      toEntryId: target.body.id,
      toVersion: 2,
      toIndex: 0
    }, { key: harness.key() });
    assert.equal(response.status, 409);
    assert.equal(response.body.type, '/problems/workbench/object-deleted');
    assert.equal((await a.get(`${ENTRIES}/${source.body.id}`)).body.version, 1);
  });
});

test('repeat destinations require an explicit scope, series moves preserve identity and single-date moves detach atomically', async () => {
  await withHarness(async h => {
    const a = h.agent(h.account('teacher-a'));
    const source = (await a.post(ENTRIES, unscheduledEntry({ title: '来源', items: twoItems }), { key: h.key() })).body;
    const target = (await a.post(ENTRIES, weeklyEntry({ items: [], calendar: { allDay: false, notes: '保留备注', tags: [] } }), { key: h.key() })).body;
    const move = { itemId: twoItems[0].id, fromEntryId: source.id, fromVersion: source.version, toEntryId: target.id, toVersion: target.version, toIndex: 0, toScope: 'series', toOriginDate: null };
    const key = h.key();
    const all = await a.post(MOVES, move, { key });
    assert.equal(all.status, 200, JSON.stringify(all.body));
    assert.equal(all.body.to.id, target.id);
    assert.deepEqual(all.body.to.repeat, target.repeat);
    assert.deepEqual(all.body.to.items, [twoItems[0]]);
    assert.deepEqual((await a.post(MOVES, move, { key })).body, all.body);
    assert.equal(h.count('SELECT COUNT(*) AS count FROM schedule_entries'), 2);
    const single = { ...move, itemId: twoItems[1].id, fromVersion: 2, toVersion: 2, toScope: 'instance', toOriginDate: '2026-09-28', toIndex: 1 };
    const rejected = await a.post(MOVES, { ...single, toVersion: 1 }, { key: h.key() });
    assert.equal(rejected.status, 409);
    assert.deepEqual((await a.get(`${ENTRIES}/${source.id}`)).body.items, [twoItems[1]]);
    assert.equal(h.count('SELECT COUNT(*) AS count FROM schedule_entries'), 2);
    const invalidDate = await a.post(MOVES, { ...single, toOriginDate: '2026-09-29' }, { key: h.key() });
    assert.equal(invalidDate.status, 409);
    const singleKey = h.key();
    const one = await a.post(MOVES, single, { key: singleKey });
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.notEqual(one.body.to.id, target.id);
    assert.equal(one.body.to.repeat, null);
    assert.deepEqual(one.body.to.items, twoItems);
    assert.equal(one.body.to.calendar.notes, '保留备注');
    assert.equal(one.body.to.time.date, '2026-09-28');
    assert.deepEqual((await a.post(MOVES, single, { key: singleKey })).body, one.body);
    assert.equal(h.count('SELECT COUNT(*) AS count FROM schedule_entries'), 3);
    assert.equal((await a.get(`${ENTRIES}/${target.id}/occurrence`, { originDate: '2026-09-28' })).body.state, 'cancelled');
    assert.deepEqual((await a.get(`${ENTRIES}/${target.id}/occurrence`, { originDate: '2026-10-05' })).body.items, [twoItems[0]]);
    assert.deepEqual((await a.get(`${ENTRIES}/${source.id}`)).body.items, []);
  });
});
