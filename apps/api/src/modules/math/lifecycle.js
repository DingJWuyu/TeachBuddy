import { inspectDocuments, assertRelation } from '../../workbench/reliability/inspection.js';
import { portableObject, readableContent, reference } from '../../workbench/reliability/portable-records.js';
import { supportedRendererVersions } from './render.js';

const labels = {"caption": "说明", "source": "来源与源码", "snapshot": "已采用的历史快照", "content": "内容", "text": "正文", "latex": "LaTeX", "expression": "表达式", "steps": "步骤", "items": "条目"};
const record = (kind, value, options) => portableObject(kind, value, { html: readableContent(value, labels), ...options });

export function snapshot(db, principal) {
  const objects = db.prepare('SELECT value FROM math_works WHERE accountKey=?').all(principal.accountKey).map(row => record('math', JSON.parse(row.value), { label: '数学作品' }));
  objects.push(...db.prepare('SELECT r.workId,r.value FROM math_revisions r JOIN math_works w ON w.id=r.workId WHERE w.accountKey=?').all(principal.accountKey).map(row => record('math-revision', JSON.parse(row.value), { id: row.workId, label: '数学历史版本', relations: [reference('math', row.workId, 'current-link', 'work')] })));
  return { objects, supplemental: { mathExports: db.prepare('SELECT value FROM math_exports WHERE accountKey=?').all(principal.accountKey).map(row => JSON.parse(row.value)) } };
}
export function validateStorage(db) {
  assertRelation(db, 'math_revisions', 'workId', 'math_works');
  const records = [...db.prepare('SELECT accountKey,value FROM math_works').all(), ...db.prepare('SELECT r.value,w.accountKey FROM math_revisions r JOIN math_works w ON w.id=r.workId').all()];
  return [...inspectDocuments(db, records), ...inspectSources(records)];
}
export function inspectSources(records) {
  const schemas = new Map();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.schemaVersion !== undefined && ['formula', 'plane', 'space', 'dynamic', 'html', 'geogebra', 'workshop'].includes(value.kind)) {
      if (value.schemaVersion !== 1) throw new Error('Unsupported mathematical source version');
      schemas.set('math-source', '1');
    }
    for (const [key, item] of Object.entries(value)) {
      if (key === 'rendererVersion' && typeof item === 'string') {
        if (!supportedRendererVersions.has(item)) throw new Error('Unsupported renderer version');
        schemas.set('math-renderer', item);
      }
      visit(item);
    }
  }
  for (const row of records) visit(JSON.parse(row.value));
  return [...schemas].map(([name, version]) => ({ name, version }));
}
export function deleteAccountData(db, accountKey) {
  db.prepare('DELETE FROM math_revisions WHERE workId IN (SELECT id FROM math_works WHERE accountKey=?)').run(accountKey);
  for (const table of ['math_exports', 'math_works']) db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
