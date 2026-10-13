/**
 * Public ports, reminder projection and the beforeChange settlement seam.
 *
 * These suites call the module's public port surface directly (the same
 * operations T53 consumes) and observe the injected `beforeChange` fixture while
 * every HTTP write still goes through the real mutation transaction.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduleHarness } from './fixtures/teaching-time-schedule/harness.js';
import {
  advanceFixtureNow,
  beforeChangeCalls,
  clearBeforeChangeCalls,
  failNextBeforeChange,
  fixtureNowIso,
  setFixtureNow
} from './fixtures/teaching-time-schedule/runtime.js';
import { SAMPLE_IDS, timedEntry, weeklyEntry } from './fixtures/teaching-time-schedule/samples.js';

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

test('listReminderCandidates only returns armed instances that are due', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;

    const created = await a.post(ENTRIES, timedEntry({
      time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 },
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    assert.equal(created.status, 201);
    assert.equal(created.body.reminder.side, 'before');

    setFixtureNow('2026-09-21T08:19:59Z');
    assert.deepEqual(port.listReminderCandidates(principal, fixtureNowIso()), []);

    setFixtureNow('2026-09-21T08:20:00Z');
    const due = port.listReminderCandidates(principal, fixtureNowIso());
    assert.equal(due.length, 1);
    assert.deepEqual(due[0].key, { entryId: created.body.id, originDate: null });
    assert.equal(due[0].dueAt, '2026-09-21T08:20:00Z');
    assert.equal(due[0].title, '备课');
    assert.equal(due[0].armedAt, '2026-09-21T06:00:00Z');

    // Repeats are stable; nothing is written by the projection.
    assert.deepEqual(port.listReminderCandidates(principal, fixtureNowIso()), due);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM schedule_entries'), 1);
  });
});

test('an unset reminder never produces a candidate and a past one is rejected on create', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;

    const withoutReminder = await a.post(ENTRIES, timedEntry(), { key: harness.key() });
    assert.equal(withoutReminder.status, 201);
    setFixtureNow('2026-09-21T09:00:00Z');
    assert.deepEqual(port.listReminderCandidates(principal, fixtureNowIso()), []);

    const past = await a.post(ENTRIES, timedEntry({
      time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 },
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    assert.equal(past.status, 422);
    assert.equal(past.body.type, '/problems/workbench/reminder-not-future');
    assert.equal(past.body.field, '/reminder');

    const after = await a.post(ENTRIES, timedEntry({
      time: { date: '2026-09-21', startTime: '19:00', timeZone: 'Asia/Shanghai', durationMinutes: 30 },
      reminder: { side: 'after', minutes: 20 }
    }), { key: harness.key() });
    assert.equal(after.status, 201);
    const candidates = port.listReminderCandidates(principal, '2026-09-21T11:50:00Z');
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].dueAt, '2026-09-21T11:50:00Z');
  });
});

test('a repeating template needs at least one future instance for a reminder', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const valid = await a.post(ENTRIES, weeklyEntry({
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    assert.equal(valid.status, 201);

    setFixtureNow('2026-11-01T00:00:00Z');
    const expired = await a.post(ENTRIES, weeklyEntry({
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    assert.equal(expired.status, 422);
    assert.equal(expired.body.type, '/problems/workbench/reminder-not-future');
  });
});

test('past reminder configurations survive text edits but not an adjusted due time', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, timedEntry({
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    const url = `${ENTRIES}/${created.body.id}`;

    setFixtureNow('2026-09-21T08:25:00Z');
    const textOnly = await a.put(url, {
      expectedVersion: 1,
      ...timedEntry({
        items: [{ id: SAMPLE_IDS.itemOne, text: '选例题（改）', priority: 'high' }],
        reminder: { side: 'before', minutes: 10 }
      })
    }, { key: harness.key() });
    assert.equal(textOnly.status, 200);
    assert.equal(textOnly.body.version, 2);

    const movedIntoTheFuture = await a.put(url, {
      expectedVersion: 2,
      ...timedEntry({
        time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 120 },
        reminder: { side: 'before', minutes: 10 }
      })
    }, { key: harness.key() });
    assert.equal(movedIntoTheFuture.status, 200);
    assert.equal(movedIntoTheFuture.body.time.durationMinutes, 120);

    // Now the due time is in the past: adjusting it again is rejected, while
    // another pure text edit stays allowed.
    setFixtureNow('2026-09-21T09:30:00Z');
    const adjustPast = await a.put(url, {
      expectedVersion: 3,
      ...timedEntry({
        time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 150 },
        reminder: { side: 'before', minutes: 10 }
      })
    }, { key: harness.key() });
    assert.equal(adjustPast.status, 422);
    assert.equal(adjustPast.body.type, '/problems/workbench/reminder-not-future');

    const stillTextOnly = await a.put(url, {
      expectedVersion: 3,
      ...timedEntry({
        title: '备课（再改）',
        time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 120 },
        reminder: { side: 'before', minutes: 10 }
      })
    }, { key: harness.key() });
    assert.equal(stillTextOnly.status, 200);
  });
});

test('changing the reminder re-arms it and never backfills the old due instant', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;
    const created = await a.post(ENTRIES, timedEntry({
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    const url = `${ENTRIES}/${created.body.id}`;

    setFixtureNow('2026-09-21T09:00:00Z');
    const changed = await a.put(url, {
      expectedVersion: 1,
      ...timedEntry({
        time: { date: '2026-09-22', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 },
        reminder: { side: 'before', minutes: 30 }
      })
    }, { key: harness.key() });
    assert.equal(changed.status, 200);

    // The original 08:20Z instant is in the past but the reminder was re-armed
    // at 09:00Z, so it must not surface as a late candidate.
    assert.deepEqual(port.listReminderCandidates(principal, '2026-09-21T09:30:00Z'), []);

    const armed = port.listReminderCandidates(principal, '2026-09-22T08:00:00Z');
    assert.equal(armed.length, 1);
    assert.equal(armed[0].dueAt, '2026-09-22T08:00:00Z');
    assert.equal(armed[0].armedAt, '2026-09-21T09:00:00Z');
  });
});

test('cancelled instances stay silent while a moved override is found on its new time', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;
    const created = await a.post(ENTRIES, weeklyEntry({
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    const url = `${ENTRIES}/${created.body.id}`;

    const override = await a.put(`${url}/exceptions/2026-09-28`, {
      expectedVersion: 1,
      mode: 'override',
      content: {
        title: '备课',
        items: [{ id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }],
        time: { date: '2026-09-29', startTime: '16:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 },

        reminder: { side: 'before', minutes: 10 }
      }
    }, { key: harness.key() });
    assert.equal(override.status, 200);

    await a.put(`${url}/exceptions/2026-10-05`, { expectedVersion: 2, mode: 'cancelled' }, { key: harness.key() });

    const early = port.listReminderCandidates(principal, '2026-09-21T08:20:00Z');
    assert.deepEqual(early.map((candidate) => candidate.key.originDate), ['2026-09-21']);

    const candidates = port.listReminderCandidates(principal, '2026-09-29T09:20:00Z');
    assert.deepEqual(
      candidates.map((candidate) => [candidate.key.originDate, candidate.dueAt]),
      [
        ['2026-09-21', '2026-09-21T08:20:00Z'],
        ['2026-09-28', '2026-09-29T09:20:00Z']
      ]
    );
    // The 09-28 original slot produces nothing; the cancelled 10-05 slot too.
    // The cancelled 10-05 slot never becomes a candidate, while the still
    // uncaptured 09-28 override remains visible at its moved instant.
    const later = port.listReminderCandidates(principal, '2026-10-05T08:20:00Z');
    assert.deepEqual(later.map((candidate) => candidate.key.originDate), ['2026-09-21', '2026-09-28']);
  });
});

test('the reminder title projection trims the fallback item to 300 code points', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;
    const longText = '题'.repeat(301);
    const created = await a.post(ENTRIES, timedEntry({
      title: '   ',
      items: [{ id: SAMPLE_IDS.itemOne, text: `  ${longText}  `, priority: 'normal' }],
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    assert.equal(created.status, 201);
    // The saved title and item text are untouched by the projection.
    assert.equal(created.body.title, '   ');
    assert.equal(created.body.items[0].text, `  ${longText}  `);

    const candidates = port.listReminderCandidates(principal, '2026-09-21T08:20:00Z');
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].title.length, 300);
    assert.equal(candidates[0].title, '题'.repeat(300));
  });
});

test('cancelling before the due instant keeps that occurrence out of the candidates', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;
    const created = await a.post(ENTRIES, timedEntry({
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });

    setFixtureNow('2026-09-21T08:00:00Z');
    const cancelled = await a.post(`${ENTRIES}/${created.body.id}/deletion`, {
      expectedVersion: 1,
      deleted: true
    }, { key: harness.key() });
    assert.equal(cancelled.status, 200);
    assert.deepEqual(port.listReminderCandidates(principal, '2026-09-21T09:00:00Z'), []);

    // Restoring after the due instant re-arms from the restore instant instead
    // of backfilling the cancelled occurrence.
    setFixtureNow('2026-09-21T09:00:00Z');
    const restored = await a.post(`${ENTRIES}/${created.body.id}/deletion`, {
      expectedVersion: 2,
      deleted: false
    }, { key: harness.key() });
    assert.equal(restored.status, 200);
    assert.deepEqual(port.listReminderCandidates(principal, '2026-09-21T09:30:00Z'), []);
  });
});

test('readOccurrence honours the port contract for unscheduled, unknown and outside-series', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;

    const unscheduled = await a.post(ENTRIES, {
      ...timedEntry({ time: null, items: [{ id: SAMPLE_IDS.itemOne, text: '选例题', priority: 'normal' }] })
    }, { key: harness.key() });
    assert.throws(() => port.readOccurrence(principal, { entryId: unscheduled.body.id }), (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.problem.type, '/problems/workbench/not-found');
      return true;
    });

    const weekly = await a.post(ENTRIES, weeklyEntry(), { key: harness.key() });
    const occurrence = port.readOccurrence(principal, { entryId: weekly.body.id, originDate: '2026-09-28' });
    assert.equal(occurrence.state, 'active');
    assert.deepEqual(occurrence.key, { entryId: weekly.body.id, originDate: '2026-09-28' });

    const outside = port.readOccurrence(principal, { entryId: weekly.body.id, originDate: '2026-10-12' });
    assert.equal(outside.state, 'outside-series');

    assert.throws(
      () => port.readOccurrence(principal, { entryId: weekly.body.id, originDate: '2026-09-22' }),
      (error) => error.status === 404
    );
    assert.throws(
      () => port.readOccurrence({ accountKey: 'teacher-b' }, { entryId: weekly.body.id, originDate: '2026-09-28' }),
      (error) => error.status === 404
    );
  });
});

test('beforeChange runs once, inside the write, before the change and never on replay', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    clearBeforeChangeCalls();

    const key = harness.key();
    const first = await a.post(ENTRIES, timedEntry(), { key });
    assert.equal(first.status, 201);
    assert.equal(beforeChangeCalls().length, 1);
    assert.deepEqual(beforeChangeCalls()[0], { accountKey: 'teacher-a', now: '2026-09-21T06:00:00Z' });
    assert.equal(first.body.createdAt, '2026-09-21T06:00:00Z');

    clearBeforeChangeCalls();
    const replay = await a.post(ENTRIES, timedEntry(), { key });
    assert.equal(replay.status, 201);
    assert.deepEqual(beforeChangeCalls(), []);

    clearBeforeChangeCalls();
    const conflict = await a.put(`${ENTRIES}/${first.body.id}`, {
      expectedVersion: 99,
      ...timedEntry()
    }, { key: harness.key() });
    assert.equal(conflict.status, 409);
    assert.deepEqual(beforeChangeCalls(), []);


  });
});

test('a failing beforeChange rolls the whole schedule write back', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, timedEntry(), { key: harness.key() });
    assert.equal(created.status, 201);

    clearBeforeChangeCalls();
    failNextBeforeChange();
    const keyA = harness.key();
    const failed = await a.put(`${ENTRIES}/${created.body.id}`, {
      expectedVersion: 1,
      ...timedEntry({ title: '不会落库' })
    }, { key: keyA });
    assert.equal(failed.status, 503);
    assert.equal(beforeChangeCalls().length, 1);

    const unchanged = await a.get(`${ENTRIES}/${created.body.id}`);
    assert.equal(unchanged.body.version, 1);
    assert.equal(unchanged.body.title, '备课');
    assert.equal(
      harness.count('SELECT COUNT(*) AS count FROM workbench_mutation_keys WHERE key = ?', keyA),
      0
    );

    // The same key can be retried after a rolled-back transaction.
    const retried = await a.put(`${ENTRIES}/${created.body.id}`, {
      expectedVersion: 1,
      ...timedEntry({ title: '重试成功' })
    }, { key: keyA });
    assert.equal(retried.status, 200);
    assert.equal(retried.body.version, 2);
    assert.equal(retried.body.title, '重试成功');
  });
});


test('accounts and ranges stay isolated from each other', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const b = harness.agent(harness.account('teacher-b'));
    const created = await a.post(ENTRIES, timedEntry(), { key: harness.key() });
    assert.equal(created.status, 201);

    assert.equal((await b.get(`${ENTRIES}/${created.body.id}`)).status, 404);
    assert.deepEqual((await b.get(ENTRIES)).body.items, []);
    assert.deepEqual((await b.get(OCCURRENCES, { from: '2026-09-21', to: '2026-10-01' })).body.items, []);
    assert.deepEqual(
      harness.workbench().scheduleModule.port.listReminderCandidates({ accountKey: 'teacher-b' }, '2026-12-31T00:00:00Z'),
      []
    );
    assert.deepEqual(
      harness.workbench().scheduleModule.port.listReminderCandidates({ accountKey: 'teacher-a' }, '2026-12-31T00:00:00Z').length,
      0
    );

    // A same-key write from another account is a separate logical request.
    const key = harness.key();
    const first = await a.post(ENTRIES, timedEntry(), { key });
    const second = await b.post(ENTRIES, timedEntry(), { key });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body.id, second.body.id);
  });
});

test('a repeating template keeps a past reminder through text edits but not through a new due time', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const created = await a.post(ENTRIES, weeklyEntry({
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    assert.equal(created.status, 201);
    const url = `${ENTRIES}/${created.body.id}`;

    // Every instance is in the past now; a pure text edit must still be allowed.
    setFixtureNow('2026-10-20T06:00:00Z');
    const textOnly = await a.put(url, {
      expectedVersion: 1,
      ...weeklyEntry({
        title: '每周备课（改名）',
        items: [{ id: SAMPLE_IDS.itemOne, text: '选例题（改）', priority: 'high' }],
        reminder: { side: 'before', minutes: 10 }
      })
    }, { key: harness.key() });
    assert.equal(textOnly.status, 200, JSON.stringify(textOnly.body));
    assert.equal(textOnly.body.title, '每周备课（改名）');

    // Adjusting the due instant of an expired series is still rejected.
    const adjusted = await a.put(url, {
      expectedVersion: 2,
      ...weeklyEntry({
        title: '每周备课（改名）',
        time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 120 },
        reminder: { side: 'before', minutes: 10 }
      })
    }, { key: harness.key() });
    assert.equal(adjusted.status, 422);
    assert.equal(adjusted.body.type, '/problems/workbench/reminder-not-future');
  });
});

test('deleting and restoring the group cannot replay reminders from the disabled window', async () => {
  await withHarness(async (harness) => {
    const a = harness.agent(harness.account('teacher-a'));
    const principal = { accountKey: 'teacher-a' };
    const port = harness.workbench().scheduleModule.port;
    const created = await a.post(ENTRIES, weeklyEntry({
      repeat: { until: '2026-09-28' },
      reminder: { side: 'before', minutes: 10 }
    }), { key: harness.key() });
    assert.equal(created.status, 201);
    const url = `${ENTRIES}/${created.body.id}`;

    // The 09-21 instance was never captured; the 09-28 one only becomes
    // visible here, which arms it at the visible moment.
    setFixtureNow('2026-09-27T06:00:00Z');
    const extended = await a.put(url, {
      expectedVersion: 1,
      ...weeklyEntry({
        repeat: { until: '2026-09-28' },
        reminder: { side: 'before', minutes: 10 }
      })
    }, { key: harness.key() });
    assert.equal(extended.status, 200);

    setFixtureNow('2026-09-28T00:00:00Z');
    const deleted = await a.post(`${url}/deletion`, { expectedVersion: 2, deleted: true }, { key: harness.key() });
    assert.equal(deleted.status, 200);

    setFixtureNow('2026-09-28T12:00:00Z');
    const restored = await a.post(`${url}/deletion`, { expectedVersion: 3, deleted: false }, { key: harness.key() });
    assert.equal(restored.status, 200);

    // Both instances stay silent: the 09-28 due fell inside the disabled
    // window, and the group-level restore also re-arms the earlier one.
    const candidates = port.listReminderCandidates(principal, '2026-09-28T13:00:00Z');
    assert.deepEqual(candidates, []);
  });
});
