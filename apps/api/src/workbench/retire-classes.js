// Exact former ledger accepted only for the one-way retirement of saved data.
export const retiredClassMigrationIds = Object.freeze([
  'classes_0001_class_tables', 'classes_0002_removed_objects',
  'classes_0003_next_note_visibility', 'classes_0004_record_content',
]);
export const classRetirementMigrationId = 'workbench_retirement_002_classes';
export function assertRetiredClassLedger(db) {
  const retired = db.prepare("SELECT id FROM workbench_migrations WHERE moduleId='classes'").all();
  if (retired.some(row => !retiredClassMigrationIds.includes(row.id))) throw new Error('Unsupported retired classes migration');
}
const retiredKind = kind => kind === 'class' || kind === 'record';
const retiredTool = name => typeof name === 'string' && /^(?:(?:list|get|read|create|update|set|delete|purge|move)(?:Class|Record)|classes[._]|(?:list|get|read|create|update|set|delete|purge|move)_(?:class|record))/.test(name);
const cleanReferences = value => {
  if (value?.references) value.references = value.references.filter(ref => !retiredKind((ref.input ?? ref).kind));
};
function cleanResponse(value) {
  if (Array.isArray(value)) return value.map(cleanResponse);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (['course', 'courseState', 'courseLinks'].includes(key)) continue;
    if (key === 'references' && Array.isArray(child)) result[key] = child.filter(ref => !retiredKind((ref.input ?? ref).kind)).map(cleanResponse);
    else if (['moduleIds', 'hiddenModuleIds'].includes(key) && Array.isArray(child)) result[key] = child.filter(id => id !== 'classes');
    else result[key] = cleanResponse(child);
  }
  return result;
}
function cleanLayout(layout) {
  for (const group of layout.groups ?? []) group.moduleIds = group.moduleIds.filter(id => id !== 'classes');
  layout.hiddenModuleIds = (layout.hiddenModuleIds ?? []).filter(id => id !== 'classes');
  return layout;
}
export const classRetirementMigrations = [{ moduleId: 'workbench-retirement', migrations: [{
  id: classRetirementMigrationId,
  up(db) {
    const exists = table => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
    assertRetiredClassLedger(db);
    for (const table of ['classes_record_sources', 'classes_records', 'classes_removed_objects', 'classes_items']) db.exec(`DROP TABLE IF EXISTS ${table}`);
    db.prepare("DELETE FROM workbench_migrations WHERE moduleId='classes'").run();
    if (exists('workbench_navigation')) for (const row of db.prepare('SELECT accountKey,layoutJson FROM workbench_navigation').all()) {
      const next = JSON.stringify(cleanLayout(JSON.parse(row.layoutJson)));
      if (next !== row.layoutJson) db.prepare('UPDATE workbench_navigation SET layoutJson=?,version=version+1 WHERE accountKey=?').run(next, row.accountKey);
    }
    // Preserve idempotency for surviving writes while retiring their response links.
    if (exists('workbench_mutation_keys')) {
      db.prepare("DELETE FROM workbench_mutation_keys WHERE path LIKE '/api/modules/classes/%' OR path='/api/reliability/v1/exports'").run();
      for (const row of db.prepare("SELECT rowid AS rowKey,body FROM workbench_mutation_keys WHERE path LIKE '/api/modules/schedule/%' OR path='/api/workbench/navigation' OR path LIKE '/api/agent/%'").all())
        db.prepare('UPDATE workbench_mutation_keys SET body=? WHERE rowid=?').run(JSON.stringify(cleanResponse(JSON.parse(row.body))), row.rowKey);
    }
    if (exists('agent_conversations')) for (const row of db.prepare('SELECT id,document FROM agent_conversations').all()) {
      const doc = JSON.parse(row.document), snapshot = doc.snapshot;
      cleanReferences(snapshot.draft);
      snapshot.messages.forEach(cleanReferences);
      const removed = snapshot.operations.filter(op => retiredTool(op.request?.operationId));
      snapshot.operations = snapshot.operations.filter(op => !retiredTool(op.request?.operationId));
      snapshot.toolCalls = snapshot.toolCalls.filter(call => !retiredTool(call.name));
      for (const op of removed) {
        delete doc.journals[op.id];
        if (exists('reliability_frozen_operations')) db.prepare('DELETE FROM reliability_frozen_operations WHERE id=?').run(op.id);
      }
      db.prepare('UPDATE agent_conversations SET document=? WHERE id=?').run(JSON.stringify(doc), row.id);
    }
    if (exists('agent_events')) for (const row of db.prepare('SELECT conversationId,seq,event FROM agent_events').all()) {
      const event = JSON.parse(row.event), value = event.value;
      if (retiredTool(value?.name) || retiredTool(value?.request?.operationId)) db.prepare('DELETE FROM agent_events WHERE conversationId=? AND seq=?').run(row.conversationId, row.seq);
      else {
        cleanReferences(value);
        db.prepare('UPDATE agent_events SET event=? WHERE conversationId=? AND seq=?').run(JSON.stringify(event), row.conversationId, row.seq);
      }
    }
    if (exists('reliability_exports')) db.prepare('DELETE FROM reliability_exports').run();
  },
}] }];
