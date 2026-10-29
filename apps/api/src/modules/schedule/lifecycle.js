export const optionalMigrationIds = ['schedule_0003_remove_teaching_links'];
import { createScheduleRepository } from './repository.js';
import { projectNotification } from './reminders/index.js';
import { assertRelation } from '../../workbench/reliability/inspection.js';
import { portableObject, readableContent } from '../../workbench/reliability/portable-records.js';

const labels = {"note": "备注", "text": "正文", "items": "条目"};
const record = (kind, value, options) => portableObject(kind, value, { html: readableContent(value, labels), ...options });

export function snapshot(db, principal) {
  const repository = createScheduleRepository(db);
  const settings = repository.readSettings(principal.accountKey);
  const saved = {
    entries: repository.listEntries(principal.accountKey).map(entry => ({
      entry: Object.fromEntries(['id', 'version', 'createdAt', 'updatedAt', 'deletedAt', 'title', 'items', 'time', 'repeat', 'reminder', 'calendar'].map(key => [key, entry[key]])),
      exceptions: repository.listExceptions(entry.id),
    })),
    settings: settings ? { timeZone: settings.timeZone, version: settings.version } : null,
  };
  const objects = saved.entries.map(value => record('entry', value, { id: value.entry.id, version: value.entry.version, label: '日程', title: value.entry.title || '日程', state: value.entry.deletedAt ? 'deleted' : 'active' }));
  objects.push(...db.prepare('SELECT * FROM schedule_notifications WHERE accountKey=?').all(principal.accountKey).map(row => record('notification', projectNotification(row), { label: '通知' })));
  if (saved.settings) objects.push(record('schedule-settings', saved.settings, { label: '日程设置' }));
  return { objects };
}
export function validateStorage(db) {
  assertRelation(db, 'schedule_exceptions', 'entryId', 'schedule_entries');
  return [];
}
export function deleteAccountData(db, accountKey) {
  for (const table of ['schedule_exceptions', 'schedule_instance_arms']) db.prepare(`DELETE FROM ${table} WHERE entryId IN (SELECT id FROM schedule_entries WHERE accountKey=?)`).run(accountKey);
  for (const table of ['schedule_notifications', 'schedule_labels', 'schedule_entries', 'schedule_settings']) db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
