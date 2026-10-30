import { deleteAccountData as deleteAgentData } from '../agent/lifecycle.js';

// Shared workbench data is cleared alongside module-owned data in one transaction.
// Every module with storage takes part, including ones absent from the current catalog.
const accountTables = [
  'materials_recognition_requests', 'materials_recognition_results', 'materials_renditions', 'materials_previews',
  'materials_jobs', 'materials_files', 'reliability_exports',
  'reliability_preferences', 'workbench_navigation', 'workbench_mutation_keys',
];

export function eraseAccountRows(db, accountKey, owners) {
  db.transaction(() => {
    deleteAgentData(db, accountKey);
    for (const owner of owners) owner.deleteAccountData(db, accountKey);
    for (const table of accountTables) db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
  }).immediate();
}
