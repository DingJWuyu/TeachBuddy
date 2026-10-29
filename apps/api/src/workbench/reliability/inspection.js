import { validateSchema } from '../content/schema.js';

// Shared document/file integrity. Owners choose the records to inspect and
// validate their own source schemas and relationships before calling this.
export function inspectDocuments(db, records) {
  const schemas = new Map();
  const owners = new Map(db.prepare('SELECT id,accountKey FROM materials_files').all().map(row => [row.id, row.accountKey]));
  function visit(value, account) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value.blocks) && value.version !== undefined) {
      validateSchema('Document', value);
      schemas.set(`document-${value.version}`, String(value.version));
    }
    for (const [key, item] of Object.entries(value)) {
      if (/fileId$/i.test(key) && typeof item === 'string' && owners.get(item) !== account) throw new Error('Missing or foreign file reference');
      if (/fileIds$/i.test(key) && Array.isArray(item) && item.some(id => owners.get(id) !== account)) throw new Error('Missing or foreign file references');
      visit(item, account);
    }
  }
  for (const row of records) visit(JSON.parse(row.value), row.accountKey);
  return [...schemas].map(([name, version]) => ({ name, version }));
}
export function assertRelation(db, child, column, parent) {
  const scoped = db.pragma(`table_info(${child})`).some(c => c.name === 'accountKey');
  if (db.prepare(`SELECT 1 FROM ${child} c LEFT JOIN ${parent} p ON c.${column}=p.id WHERE p.id IS NULL ${scoped ? 'OR c.accountKey <> p.accountKey' : ''} LIMIT 1`).get()) throw new Error(`Broken relation in ${child}`);
}
