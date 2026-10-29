import { inspectDocuments } from '../../workbench/reliability/inspection.js';
import { portableObject, readableContent, reference } from '../../workbench/reliability/portable-records.js';

const labels = {"note": "备注", "source": "来源与源码", "snapshot": "已采用的历史快照", "content": "内容", "text": "正文", "origin": "来源"};
const record = (kind, value, options) => portableObject(kind, value, { html: readableContent(value, labels), ...options });

export function snapshot(db, principal) {
  const rows = table => db.prepare(`SELECT * FROM ${table} WHERE accountKey=?`).all(principal.accountKey);
  const objects = rows('resource_items').map(row => record('resource', JSON.parse(row.value), { label: '资源' }));
  objects.push(...rows('resource_taxonomy').map(row => record('resource-taxonomy', JSON.parse(row.value), { label: '资源分类' })));
  objects.push(...rows('resource_file_history').map(row => record('resource-file-revision', JSON.parse(row.value), { id: row.resourceId, label: '资源文件历史版本', relations: [reference('resource', row.resourceId, 'current-link', 'resource')] })));
  return { objects };
}
export function validateStorage(db) {
  const records = db.prepare('SELECT accountKey,value FROM resource_items').all();
  // Old backups predate the file-history migration.
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='resource_file_history'").get()) records.push(...db.prepare('SELECT accountKey,value FROM resource_file_history').all());
  return inspectDocuments(db, records);
}
export function deleteAccountData(db, accountKey) {
  for (const table of ['resource_file_history', 'resource_text_cache', 'resource_taxonomy', 'resource_items']) db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
