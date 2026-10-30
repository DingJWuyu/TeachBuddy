// Explicit offline operation only. The caller owns physical isolation, stopped
// writers, integrity checks and reopening the same target before serving it.
//
// prepareRestoredAuth({ db }) revokes every identity carried by a restored copy:
// in one BEGIN IMMEDIATE transaction on main it deletes all page bindings,
// sessions, containers, challenges and completed deletion receipts, then
// asserts those tables are empty and that accounts (including password hashes),
// legacy gaps and the migration ledger are unchanged. Success exists only after
// COMMIT. Afterwards old cookies get 401 session-invalid, old challenges are
// missing, and signing in with the backed-up credentials returns the original
// accountKey. Re-running on the same unserved copy is idempotent (all counts 0);
// never run it on ordinary startup, as it would sign out live sessions.
// Errors carry code AUTH_RECOVERY_PRECONDITION (connection/configuration or a
// pending deletion), _SCHEMA (unsupported ledger, tables or legacy gaps),
// _STORAGE (I/O, lock or commit failure; never a rollback promise) or
// _INVARIANT; every one means the target must stay closed.
import Database from 'better-sqlite3';
import { isDeepStrictEqual } from 'node:util';

// Pin this revision independently of the ordinary migration runner: adding a
// migration must not silently expand auth-recovery/2's supported schema.
const migrationIds = [
  'auth_0001_accounts', 'auth_0002_challenges', 'auth_0003_containers',
  'auth_0004_sessions', 'auth_0005_meta', 'auth_0006_legacy_accounts',
  'auth_0007_drop_auth_meta', 'auth_0008_account_deletions'
];
const clearTables = {
  pageBindings: 'auth_page_bindings', sessions: 'auth_sessions',
  containers: 'auth_containers', challenges: 'auth_challenges', deletions: 'auth_account_deletions'
};
const requiredColumns = {
  auth_accounts: 'id accountKey email nickname passwordHash passwordVersion createdAt updatedAt',
  auth_challenges: 'id purpose email codeDigest issuedAt expiresAt resendAt remainingAttempts consumedAt replacedAt createdAt updatedAt',
  auth_containers: 'id rememberedSessionId createdAt updatedAt',
  auth_sessions: 'id containerId accountId state persistence rememberRequested passwordVersion issuedAt expiresAt activatedAt revokedAt createdAt updatedAt',
  auth_page_bindings: 'containerId pageId sessionId createdAt updatedAt',
  auth_legacy_gaps: 'accountId email reason detail recordedAt',
  auth_account_deletions: 'requestHash proof containerId accountId accountKey filesJson completedAt',
  workbench_migrations: 'id moduleId appliedAt'
};
const quote = name => '"' + name.replaceAll('"', '""') + '"';
function failure(kind, stage) {
  return Object.assign(new Error(`Authentication recovery stopped at ${stage}`), { code: `AUTH_RECOVERY_${kind}` });
}
export function assertNoPendingAccountDeletion(db) {
  if (db.prepare("SELECT 1 FROM main.sqlite_schema WHERE type='table' AND name='auth_account_deletions'").get() &&
      db.prepare('SELECT 1 FROM main.auth_account_deletions WHERE completedAt IS NULL LIMIT 1').get())
    throw failure('PRECONDITION', 'account-deletion-incomplete');
}
function checkConnection(db) {
  if (!(db instanceof Database) || !db.open || db.readonly || db.memory || db.inTransaction) {
    throw failure('PRECONDITION', 'connection');
  }
  const databases = db.pragma('database_list');
  if (!databases.find(row => row.name === 'main')?.file || databases.some(row => !['main', 'temp'].includes(row.name))) {
    throw failure('PRECONDITION', 'database-list');
  }
  if (db.pragma('query_only', { simple: true }) ||
      !['wal', 'delete', 'truncate', 'persist'].includes(db.pragma('main.journal_mode', { simple: true })) ||
      Number(db.pragma('main.synchronous', { simple: true })) < 2) {
    throw failure('PRECONDITION', 'durability');
  }
}
function checkSchema(db) {
  const tables = db.prepare("SELECT name FROM main.sqlite_schema WHERE type = 'table'").all().map(row => row.name);
  for (const [table, columns] of Object.entries(requiredColumns)) {
    if (!tables.includes(table)) throw failure('SCHEMA', 'required-table');
    const actual = db.prepare(`PRAGMA main.table_info(${quote(table)})`).all().map(row => row.name);
    if (columns.split(' ').some(column => !actual.includes(column))) throw failure('SCHEMA', 'required-column');
  }
  const ledger = db.prepare('SELECT id, moduleId FROM main.workbench_migrations').all()
    .filter(row => row.moduleId === 'auth' || row.id.startsWith('auth_'));
  if (ledger.length !== migrationIds.length || migrationIds.some(id =>
    ledger.filter(row => row.id === id && row.moduleId === 'auth').length !== 1)) {
    throw failure('SCHEMA', 'auth-migrations');
  }
  if (db.prepare('SELECT 1 FROM main.auth_legacy_gaps LIMIT 1').get()) throw failure('SCHEMA', 'legacy-gaps');
  // A copied target cannot resume cleanup of processes belonging to its source.
  // Preserve this locked state and refuse restoration until the source's
  // authorized deletion has completed and a new consistent backup is taken.
  assertNoPendingAccountDeletion(db);
  // The supported schema has no foreign keys or triggers involving the five
  // cleared tables. Reject unknown side effects before deleting anything.
  const cleared = Object.values(clearTables);
  for (const table of tables) {
    const keys = db.prepare(`PRAGMA main.foreign_key_list(${quote(table)})`).all();
    if (keys.some(key => cleared.includes(table) || cleared.includes(key.table.toLowerCase()))) throw failure('SCHEMA', 'foreign-key');
  }
  for (const schema of ['main', 'temp']) {
    const triggers = db.prepare(`SELECT tbl_name FROM ${schema}.sqlite_schema WHERE type = 'trigger'`).all();
    if (triggers.some(row => cleared.includes(row.tbl_name.toLowerCase()))) throw failure('SCHEMA', 'trigger');
  }
}
function preserved(db) {
  return ['auth_accounts', 'auth_legacy_gaps', 'workbench_migrations'].map(table =>
    db.prepare(`SELECT * FROM main.${table} ORDER BY rowid`).all());
}

export function prepareRestoredAuth(options) {
  const db = options?.db;
  let stage = 'connection';
  let began = false;
  try {
    checkConnection(db);
    stage = 'begin';
    db.exec('BEGIN IMMEDIATE');
    began = true;
    stage = 'schema';
    checkSchema(db);
    const before = preserved(db);
    const removed = {};
    const remaining = {};
    for (const [key, table] of Object.entries(clearTables)) {
      stage = `delete-${key}`;
      removed[key] = Number(db.prepare(`DELETE FROM main.${table}`).run().changes);
    }
    stage = 'invariant';
    for (const [key, table] of Object.entries(clearTables)) {
      remaining[key] = Number(db.prepare(`SELECT COUNT(*) AS count FROM main.${table}`).get().count);
      if (remaining[key] !== 0 || !Number.isSafeInteger(removed[key]) || removed[key] < 0) {
        throw failure('INVARIANT', stage);
      }
    }
    if (!isDeepStrictEqual(before, preserved(db))) throw failure('INVARIANT', stage);
    stage = 'commit';
    db.exec('COMMIT');
    return { contractRevision: 'auth-recovery/2', outcome: 'cleared', removed, remaining };
  } catch (error) {
    if (began && db.inTransaction) {
      try { db.exec('ROLLBACK'); }
      catch { throw failure('STORAGE', 'rollback-result-unknown'); }
    }
    // Do not expose SQLite messages/causes: triggers can include private data.
    // STORAGE never promises rollback or authorizes opening the target.
    if (error?.code?.startsWith('AUTH_RECOVERY_')) throw error;
    throw failure('STORAGE', stage);
  }
}
