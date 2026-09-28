/** Same-database composition; the settlement closure is ready before requests. */
import { createScheduleModule as createSchedule, migrations as scheduleMigrations } from '../modules/schedule/index.js';
import { createReminders, migrations as reminderMigrations } from '../modules/schedule/reminders/index.js';

export const migrations = [...scheduleMigrations, ...reminderMigrations];
export function createScheduleModule(dependencies) {
  let reminders;
  const schedule = createSchedule({
    ...dependencies,
    beforeChange: (principal, now) => reminders.captureDue(principal, now)
  });
  reminders = createReminders({ ...dependencies, schedule: schedule.port });
  const readScheduleForExport = schedule.port.readForExport;
  schedule.port.readForExport = principal => ({
    ...readScheduleForExport(principal),
    notifications: reminders.readForExport(principal),
  });
  schedule.router.use(reminders.router);
  return schedule;
}
