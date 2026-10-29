export const optionalMigrationIds = ['auth_0008_account_deletions'];
// Read-only identity facts needed by account-scoped archives and storage checks.
export function readExportIdentity(db, principal) {
  return db.prepare('SELECT id,nickname FROM auth_accounts WHERE accountKey=?').get(principal.accountKey);
}
export function accountKeys(db) {
  return db.prepare('SELECT accountKey FROM auth_accounts').all().map(row => row.accountKey);
}

// Only completed deletion receipts may outlive their account. Other rows are
// subject to the shared account-ownership check, including pending deletions.
export function detachedAccountTables(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name='auth_account_deletions'").get()) return new Set();
  if (db.prepare(`SELECT 1 FROM auth_account_deletions WHERE accountKey IS NULL AND
    (completedAt IS NULL OR accountId IS NOT NULL OR filesJson IS NOT NULL) LIMIT 1`).get()) throw new Error('Invalid account deletion receipt');
  return new Set(['auth_account_deletions']);
}
