// Frozen TeachingWork adapter, exclusively for T51-MATH isolated tests.
// Uses the caller's SQLite connection so projection failures share rollback.
import { ContractError, problems } from '../../../src/workbench/problems.js';
export function createMathAdapter(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS t51_math_adapter (
    id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, title TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1, deletedAt TEXT, kind TEXT NOT NULL DEFAULT 'formula',
    fault INTEGER, render TEXT NOT NULL DEFAULT 'ready'
  )`);
  return {
    readForTeachingLinkV1(principal, id) {
      const row = db.prepare('SELECT * FROM t51_math_adapter WHERE id = ? AND accountKey = ?').get(id, principal.accountKey);
      if (!row || row.fault === 404) throw new ContractError(404, problems.notFound());
      if (row.fault === 503) throw new ContractError(503, problems.temporarilyUnavailable());
      return { id: row.id, title: row.title, version: row.version, deletedAt: row.deletedAt };
    }
  };
}
