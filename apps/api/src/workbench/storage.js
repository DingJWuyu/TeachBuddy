/**
 * Isolated workbench storage.
 *
 * Each worker (task worktree, test run, runner instance) opens its own SQLite
 * file; nothing here may touch a developer's user database. The composition
 * entry passes this single `better-sqlite3` instance to every module so module
 * tables, the idempotency ledger and the migration ledger commit together.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

function ensureParentDirectory(filePath) {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function openWorkbenchDatabase({ sqlitePath }) {
  if (!sqlitePath) throw new Error('A workbench sqlitePath is required.');
  if (sqlitePath !== ':memory:') ensureParentDirectory(sqlitePath);

  const db = new Database(sqlitePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
