import { createScheduleRepository } from './repository.js';
import { createScheduleRouter } from './router.js';
import { createScheduleService } from './service.js';
import { validateCreateEntry } from './schema.js';
import { validateIdPath } from '../../workbench/schema.js';
import { migrations as scheduleMigrations } from './migrations/index.js';
import { createReminders, migrations as reminderMigrations } from './reminders/index.js';
// Schedule owns reminder settlement and preserves their existing migration order.
const migrations = [...scheduleMigrations, ...reminderMigrations];

export function createScheduleModule({ db, mutations, beforeChange, clock } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('createScheduleModule requires a better-sqlite3 Database instance.');
  }
  if (!mutations || typeof mutations.execute !== 'function') {
    throw new TypeError('createScheduleModule requires the mutations.execute seam.');
  }
  if (beforeChange !== undefined && typeof beforeChange !== 'function') {
    throw new TypeError('createScheduleModule requires a synchronous beforeChange seam.');
  }
  if (!clock || typeof clock.now !== 'function') {
    throw new TypeError('createScheduleModule requires a clock returning a UTC ISO Z instant.');
  }

  // Explicit beforeChange is a synchronous fixture seam; production captures due reminders.
  let reminders;
  const repository = createScheduleRepository(db);
  const service = createScheduleService({ repository, beforeChange: beforeChange ?? ((principal, now) => reminders.captureDue(principal, now)), clock });
  const router = createScheduleRouter({ service, mutations });

  reminders = createReminders({ db, mutations, clock, schedule: service });
  router.use(reminders.router);
  return {
    router,
    port: {
      readReference(principal, { id, originDate = null }) {
        validateIdPath(id);
        return {
          entry: service.getEntry(principal, id),
          occurrence: originDate === null ? null : service.readOccurrence(principal, { entryId: id, originDate })
        };
      },
      operations: {
        createEntry({ principal, key, input }) {
          const body = validateCreateEntry(input);
          return mutations.execute({
            principal, key, method: 'POST', path: '/api/modules/schedule/entries', body
          }, () => ({ status: 201, body: service.createEntry(principal, body) }));
        }
      },
      readForExport: principal => ({ ...service.readForExport(principal), notifications: reminders.readForExport(principal) }),
      readOccurrence: (principal, key) => service.readOccurrence(principal, key),
      listReminderCandidates: (principal, now) => service.listReminderCandidates(principal, now)
    }
  };
}

export { migrations };
// Construction seam; assembled callers use port.operations for validated writes.
export { createScheduleService } from './service.js';
// One title projection for reminder candidates and notifications; T53 imports
// this exact function so both sides stay byte-identical.
export { projectReminderTitle } from './occurrences.js';

// Account lifecycle owned by this module; the composition root owns the transaction.
export function deleteAccountData(db, accountKey) {
  for (const table of ['schedule_exceptions', 'schedule_instance_arms'])
    db.prepare(`DELETE FROM ${table} WHERE entryId IN (SELECT id FROM schedule_entries WHERE accountKey=?)`).run(accountKey);
  for (const table of ['schedule_notifications', 'schedule_labels', 'schedule_entries', 'schedule_settings'])
    db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
