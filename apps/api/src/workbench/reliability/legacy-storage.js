import { inspectSources } from '../../modules/math/lifecycle.js';
import { inspectDocuments, assertRelation } from './inspection.js';
export function validateRetiredStorage(db, { allowOlder }) {
  const exists = table => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
  const records = [];
  for (const [table, columns] of Object.entries({ classes_records: ['content'], lesson_items: ['intro'], lesson_sections: ['content', 'pageSource'], lesson_references: ['snapshot'], lesson_history: ['snapshot'], lesson_exports: ['record', 'snapshot'] })) {
    if (!exists(table)) continue;
    for (const row of db.prepare(`SELECT * FROM ${table}`).all()) for (const column of columns) if (row[column] !== undefined) records.push({ accountKey: row.accountKey, value: row[column] });
  }
  const schemas = [...inspectDocuments(db, records), ...inspectSources(records)];
  if (exists('classes_records')) {
    assertRelation(db, 'classes_records', 'classId', 'classes_items');
    assertRelation(db, 'classes_record_sources', 'recordId', 'classes_records');
  }
  const sourceTables = {
    question: "question_items",
    resource: "resource_items",
    math: "math_works",
    class: "classes_items",
    record: "classes_records",
  };
  // Permanently removed teaching objects retain only an owned identity for
  // existing schedule links; older backups may predate this classes migration.
  const removedTeachingObject = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='classes_removed_objects'").get()
    ? db.prepare("SELECT 1 FROM classes_removed_objects WHERE id=? AND accountKey=? AND kind=?") : null;
  function owned(kind, id, account, adoptedSnapshot = null) {
    const table = sourceTables[kind];
    const source = table && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table) && db.prepare(`SELECT accountKey FROM ${table} WHERE id=?`).get(id);
    if (source && source.accountKey !== account)
      throw new Error("Missing or foreign object reference");
    const removed = ["class", "record"].includes(kind) && removedTeachingObject?.get(id, account, kind);
    // Adopted content survives permanent source deletion. Existing sources must
    // still belong to this account; nested files are checked by contentSchemas.
    const captured = table && adoptedSnapshot && typeof adoptedSnapshot === "object" && !Array.isArray(adoptedSnapshot);
    if (!source && !removed && !captured)
      throw new Error("Missing or foreign object reference");
  }
  if (exists('classes_record_sources')) for (const row of db.prepare("SELECT * FROM classes_record_sources").all())
    if (!(allowOlder && row.kind === 'lesson')) owned(row.kind, row.sourceId, row.accountKey);
  if (exists("schedule_entries")) for (const row of db.prepare("SELECT * FROM schedule_entries").all()) {
    if (row.courseJson === undefined) continue;
    const course = JSON.parse(row.courseJson);
    if (course.classId) owned("class", course.classId, row.accountKey);
    for (const id of course.recordIds) owned("record", id, row.accountKey);
  }
  return schemas;
}
