/**
 * Schedule module entry point.
 *
 * The composition root mounts the returned router under
 * `/api/modules/schedule` and injects the classes/lessons public ports, the
 * server clock and the `beforeChange` seam. `clock.now()` returns a UTC ISO Z
 * instant; `beforeChange(principal, now)` is the synchronous settlement hook T53
 * replaces with the persistent `reminders.captureDue`. There is deliberately no
 * default implementation for either: a production composition without them must
 * fail to start instead of silently skipping reminder settlement.
 */
import { createScheduleRepository } from './repository.js';
import { createScheduleRouter } from './router.js';
import { createScheduleService } from './service.js';
import { migrations } from './migrations/index.js';

export function createScheduleModule({ db, mutations, classes, lessons, beforeChange, clock } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('createScheduleModule requires a better-sqlite3 Database instance.');
  }
  if (!mutations || typeof mutations.execute !== 'function') {
    throw new TypeError('createScheduleModule requires the mutations.execute seam.');
  }
  if (!classes || typeof classes.readClass !== 'function' || typeof classes.readRecord !== 'function') {
    throw new TypeError('createScheduleModule requires the classes.readClass/readRecord ports.');
  }
  if (!lessons || typeof lessons.readForTeachingLink !== 'function') {
    throw new TypeError('createScheduleModule requires the lessons.readForTeachingLink port.');
  }
  if (typeof beforeChange !== 'function') {
    throw new TypeError('createScheduleModule requires a synchronous beforeChange seam.');
  }
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('createScheduleModule requires a clock returning a UTC ISO Z instant.');
  }

  const repository = createScheduleRepository(db);
  const service = createScheduleService({ repository, classes, lessons, beforeChange, clock });
  const router = createScheduleRouter({ service, mutations });

  return {
    router,
    port: {
      readForExport: service.readForExport,
      readOccurrence: (principal, key) => service.readOccurrence(principal, key),
      listReminderCandidates: (principal, now) => service.listReminderCandidates(principal, now)
    }
  };
}

export { migrations };
// Callable business surface for future agent adapters; no HTTP dependency, so a
// caller can invoke the same operations the API uses.
export { createScheduleService } from './service.js';
// One title projection for reminder candidates and notifications; T53 imports
// this exact function so both sides stay byte-identical.
export { projectReminderTitle } from './occurrences.js';

// Account lifecycle owned by this module; the composition root owns the transaction.
export function deleteAccountData(db, accountKey) {
  for (const table of ['schedule_exceptions', 'schedule_instance_arms'])
    db.prepare(`DELETE FROM ${table} WHERE entryId IN (SELECT id FROM schedule_entries WHERE accountKey=?)`).run(accountKey);
  for (const table of ['schedule_labels', 'schedule_entries', 'schedule_settings'])
    db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
