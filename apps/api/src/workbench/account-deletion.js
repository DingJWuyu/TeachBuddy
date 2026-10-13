import { deleteAccountData as deleteQuestionsData } from '../modules/questions/index.js';
import { deleteAccountData as deleteResourcesData } from '../modules/resources/index.js';
import { deleteAccountData as deleteScheduleData } from '../modules/schedule/index.js';
import { deleteAccountData as deleteMathData } from '../modules/math/index.js';

// Shared workbench data is cleared alongside module-owned data in one transaction.
const accountTables = [
  'materials_recognition_requests', 'materials_recognition_results', 'materials_renditions', 'materials_previews',
  'materials_jobs', 'materials_files', 'reliability_frozen_operations', 'reliability_exports',
  'reliability_preferences', 'workbench_navigation', 'workbench_mutation_keys', 'agent_conversations',
];

export function eraseAccountRows(db, accountKey) {
  db.transaction(() => {
    db.prepare('DELETE FROM agent_events WHERE conversationId IN (SELECT id FROM agent_conversations WHERE accountKey=?)').run(accountKey);
    deleteQuestionsData(db, accountKey);
    deleteResourcesData(db, accountKey);
    deleteScheduleData(db, accountKey);
    deleteMathData(db, accountKey);
    for (const table of accountTables) db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
  }).immediate();
}
