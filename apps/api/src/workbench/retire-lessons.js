// One-way removal of the retired module. Shared files keep their own lifetime.
// The exact former ledger is accepted only when upgrading a saved database.
export const retiredLessonMigrationIds = Object.freeze([
  'lessons_0001_lesson_tables', 'lessons_materials_001', 'lessons_0003_order',
  'lessons_0004_history_and_placement', 'lessons_0005_page_source',
]);
export const retirementMigrationId = 'workbench_retirement_001_lessons';
const tables = ['lesson_exports', 'lesson_history', 'lesson_order', 'lesson_references', 'lesson_sections', 'lesson_items'];
const lessonTool = value => typeof value === 'string' && /(?:Lesson|lesson|QuestionUsages|question_usages)/.test(value);

function withoutLessonLinks(value) {
  if (Array.isArray(value)) return value.map(withoutLessonLinks);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'lessonId' || key === 'lesson') continue;
    if (key === 'references' && Array.isArray(child)) result[key] = child.filter(ref => (ref.input ?? ref).kind !== 'lesson').map(withoutLessonLinks);
    else if (['moduleIds', 'hiddenModuleIds'].includes(key) && Array.isArray(child)) result[key] = child.filter(id => id !== 'lessons');
    else if (key === 'sources' && Array.isArray(child)) result[key] = child.filter(source => source.kind !== 'lesson').map(withoutLessonLinks);
    else result[key] = withoutLessonLinks(child);
  }
  return result;
}

export const retirementMigrations = [{ moduleId: 'workbench-retirement', migrations: [{
  id: retirementMigrationId,
  up(db) {
    const exists = name => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
    const retired = db.prepare("SELECT id FROM workbench_migrations WHERE moduleId='lessons'").all();
    if (retired.some(row => !retiredLessonMigrationIds.includes(row.id))) throw new Error('Unsupported retired lessons migration');
    for (const table of tables) db.exec(`DROP TABLE IF EXISTS ${table}`);
    db.prepare("DELETE FROM workbench_migrations WHERE moduleId='lessons'").run();
    if (exists('classes_record_sources')) db.prepare("DELETE FROM classes_record_sources WHERE kind='lesson'").run();
    for (const [table, columns] of [
      ['schedule_entries', ['courseJson', 'courseLinks']], ['schedule_exceptions', ['contentJson']],
    ]) {
      if (!exists(table)) continue;
      for (const row of db.prepare(`SELECT rowid AS rowKey,${columns.join(',')} FROM ${table}`).all()) {
        for (const column of columns) {
          if (row[column] === null) continue;
          const next = JSON.stringify(withoutLessonLinks(JSON.parse(row[column])));
          if (next !== row[column]) db.prepare(`UPDATE ${table} SET ${column}=? WHERE rowid=?`).run(next, row.rowKey);
        }
      }
    }
    if (exists('workbench_navigation')) {
      for (const row of db.prepare('SELECT accountKey,layoutJson FROM workbench_navigation').all()) {
        const layout = JSON.parse(row.layoutJson);
        layout.groups.forEach(group => { group.moduleIds = group.moduleIds.filter(id => id !== 'lessons'); });
        layout.hiddenModuleIds = layout.hiddenModuleIds.filter(id => id !== 'lessons');
        if (JSON.stringify(layout) !== row.layoutJson) db.prepare('UPDATE workbench_navigation SET layoutJson=?,version=version+1 WHERE accountKey=?').run(JSON.stringify(layout), row.accountKey);
      }
    }
    if (exists('materials_jobs')) db.prepare("DELETE FROM materials_jobs WHERE json_extract(value,'$.target.kind')='lesson'").run();
    if (exists('workbench_mutation_keys')) {
      db.prepare("DELETE FROM workbench_mutation_keys WHERE path LIKE '/api/modules/lessons/%' OR path='/api/reliability/v1/exports'").run();
      for (const row of db.prepare("SELECT rowid AS rowKey,body FROM workbench_mutation_keys WHERE path LIKE '/api/modules/schedule/%' OR path LIKE '/api/modules/classes/%' OR path='/api/workbench/navigation' OR path LIKE '/api/agent/%'").all())
        db.prepare('UPDATE workbench_mutation_keys SET body=? WHERE rowid=?').run(JSON.stringify(withoutLessonLinks(JSON.parse(row.body))), row.rowKey);
    }
    // Retained user text and native conversation entries are historical data.
    // Remove active lesson references and tool cards so no old write can resume.
    if (exists('agent_conversations')) {
      for (const row of db.prepare('SELECT id,document FROM agent_conversations').all()) {
        const doc = JSON.parse(row.document), snapshot = doc.snapshot;
        const cleanReferences = value => {
          if (value?.references) value.references = value.references.filter(ref => (ref.input ?? ref).kind !== 'lesson');
        };
        cleanReferences(snapshot.draft);
        snapshot.messages.forEach(cleanReferences);
        const retiredOperations = snapshot.operations.filter(op => lessonTool(op.request?.operationId));
        snapshot.operations = snapshot.operations.filter(op => !lessonTool(op.request?.operationId));
        snapshot.toolCalls = snapshot.toolCalls.filter(call => !lessonTool(call.name));
        for (const op of retiredOperations) {
          delete doc.journals[op.id];
          if (exists('reliability_frozen_operations')) db.prepare('DELETE FROM reliability_frozen_operations WHERE id=?').run(op.id);
        }
        db.prepare('UPDATE agent_conversations SET document=? WHERE id=?').run(JSON.stringify(doc), row.id);
      }
      if (exists('agent_events')) for (const row of db.prepare('SELECT conversationId,seq,event FROM agent_events').all()) {
        const event = JSON.parse(row.event), value = event.value;
        if (lessonTool(value?.name) || lessonTool(value?.request?.operationId)) db.prepare('DELETE FROM agent_events WHERE conversationId=? AND seq=?').run(row.conversationId, row.seq);
        else if (value?.references) {
          value.references = value.references.filter(ref => (ref.input ?? ref).kind !== 'lesson');
          db.prepare('UPDATE agent_events SET event=? WHERE conversationId=? AND seq=?').run(JSON.stringify(event), row.conversationId, row.seq);
        }
      }
    }
    // Old personal packages contain the removed module. Regenerate from live data.
    if (exists('reliability_exports')) db.prepare('DELETE FROM reliability_exports').run();
  },
}] }];
