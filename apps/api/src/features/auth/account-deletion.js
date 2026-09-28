import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { authProblem } from './problems.js';
import { readClosedObject, readEmailField, OPAQUE_ID_PATTERN, REQUEST_SCHEMAS } from './validation.js';
import { readPageContext, readSessionCookie, hashSessionToken } from './protocol.js';

// The original request is a narrowly scoped continuation. It remains usable
// after all account sessions are revoked, but grants no business identity.
export function createAccountDeletion({ db, operations, store, codeSecret, now, cleanup }) {
  const running = new Map();
  const get = db.prepare('SELECT * FROM auth_account_deletions WHERE requestHash=?');

  async function finish(row) {
    if (row.completedAt) return;
    if (running.has(row.requestHash)) return running.get(row.requestHash);
    const work = (async () => {
      const account = store.getAccountById(row.accountId);
      if (!account) throw new Error('Pending deletion account is missing');
      await cleanup({
        accountKey: row.accountKey,
        files: row.filesJson ? JSON.parse(row.filesJson) : null,
        rememberFiles(files) {
          db.prepare('UPDATE auth_account_deletions SET filesJson=? WHERE requestHash=?')
            .run(JSON.stringify(files), row.requestHash);
        },
      });
      db.transaction(() => {
        store.deleteBindingsForAccountSessions(account.id);
        store.clearRememberedPointersForAccount(account.id, new Date(now()).toISOString());
        db.prepare('DELETE FROM auth_sessions WHERE accountId=?').run(account.id);
        db.prepare('DELETE FROM auth_challenges WHERE email=? COLLATE NOCASE').run(account.email);
        db.prepare('DELETE FROM auth_legacy_gaps WHERE accountId=?').run(account.id);
        // Imported accounts still have a legacy credential mirror.
        if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='users'").get()) {
          db.prepare('DELETE FROM passwordResetCodes WHERE userId=?').run(account.accountKey);
          db.prepare('DELETE FROM workspaceLayouts WHERE ownerId=?').run(account.accountKey);
          db.prepare('DELETE FROM users WHERE id=?').run(account.accountKey);
        }
        db.prepare('DELETE FROM auth_accounts WHERE id=?').run(account.id);
        db.prepare(`UPDATE auth_account_deletions SET accountId=NULL, accountKey=NULL,
          filesJson=NULL, completedAt=? WHERE requestHash=?`)
          .run(new Date(now()).toISOString(), row.requestHash);
      }).immediate();
    })();
    running.set(row.requestHash, work);
    try { await work; } finally { running.delete(row.requestHash); }
  }

  return async function deleteAccount(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.accountDeletion);
    readPageContext(request);
    if (!/^[0-9a-f]{64}$/.test(input.requestId)) throw authProblem('invalidFieldValue', { field: 'requestId' });
    if (!OPAQUE_ID_PATTERN.test(input.sessionId)) throw authProblem('invalidFieldValue', { field: 'sessionId' });
    const email = readEmailField(input.email);
    const token = readSessionCookie(request);
    if (!token || !OPAQUE_ID_PATTERN.test(token)) throw authProblem('sessionInvalid');
    const requestHash = createHash('sha256').update(input.requestId).digest('hex');
    const proof = createHmac('sha256', codeSecret)
      .update(JSON.stringify([token, input.sessionId, email, input.requestId])).digest('hex');
    let row = get.get(requestHash);
    if (row) {
      if (!timingSafeEqual(Buffer.from(row.proof, 'hex'), Buffer.from(proof, 'hex'))) throw authProblem('sessionInvalid');
    } else {
      const account = operations.authorizeAccountDeletion(request, input.sessionId);
      if (account.email !== email) throw authProblem('deletionConfirmationMismatch', { field: 'email' });
      if (store.isAccountDeleting(account.id)) throw authProblem('deletionInProgress');
      db.transaction(() => {
        db.prepare('INSERT INTO auth_account_deletions VALUES (?, ?, ?, ?, ?, NULL, NULL)')
          .run(requestHash, proof, hashSessionToken(token), account.id, account.accountKey);
        const timestamp = new Date(now()).toISOString();
        store.revokeAccountSessions(account.id, timestamp);
        store.deleteBindingsForAccountSessions(account.id);
        store.clearRememberedPointersForAccount(account.id, timestamp);
      }).immediate();
      row = get.get(requestHash);
    }
    try { await finish(row); } catch { throw authProblem('deletionIncomplete'); }
    return { status: 204 };
  };
}
