// Account ownership is explicit, including relation/history tables whose
// ownership is inherited from a parent. This list follows the product schema.
const accountTables = [
  'classes_record_sources', 'classes_records', 'classes_removed_objects', 'classes_items',
  'lesson_references', 'lesson_sections', 'lesson_history', 'lesson_exports', 'lesson_order', 'lesson_items',
  'question_items', 'questions_materials_meta', 'questions_materials_imports', 'questions_materials_taxonomy', 'questions_materials_tasks',
  'resource_file_history', 'resource_text_cache', 'resource_taxonomy', 'resource_items',
  'schedule_labels', 'schedule_entries', 'schedule_settings', 'math_exports', 'math_works',
  'materials_recognition_requests', 'materials_recognition_results', 'materials_renditions', 'materials_previews',
  'materials_jobs', 'materials_files', 'reliability_frozen_operations', 'reliability_exports',
  'reliability_preferences', 'workbench_navigation', 'workbench_mutation_keys', 'agent_conversations',
];

export function eraseAccountRows(db, accountKey) {
  db.transaction(() => {
    db.prepare('DELETE FROM agent_events WHERE conversationId IN (SELECT id FROM agent_conversations WHERE accountKey=?)').run(accountKey);
    db.prepare('DELETE FROM math_revisions WHERE workId IN (SELECT id FROM math_works WHERE accountKey=?)').run(accountKey);
    for (const table of ['schedule_exceptions', 'schedule_instance_arms'])
      db.prepare(`DELETE FROM ${table} WHERE entryId IN (SELECT id FROM schedule_entries WHERE accountKey=?)`).run(accountKey);
    for (const table of accountTables) db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
  }).immediate();
}
