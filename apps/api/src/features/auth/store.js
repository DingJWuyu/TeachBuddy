// Synchronous better-sqlite3 access layer for the auth module. All statements
// are prepared once; callers own transaction boundaries and problem mapping.

export function createAuthStore(db) {
  const statements = {
    accountByEmail: db.prepare('SELECT * FROM auth_accounts WHERE email = ? COLLATE NOCASE'),
    accountById: db.prepare('SELECT * FROM auth_accounts WHERE id = ?'),
    accountInsert: db.prepare(`
      INSERT INTO auth_accounts (id, accountKey, email, nickname, passwordHash, passwordVersion, createdAt, updatedAt)
      VALUES (@id, @accountKey, @email, @nickname, @passwordHash, @passwordVersion, @createdAt, @updatedAt)
    `),
    accountPasswordUpdate: db.prepare(`
      UPDATE auth_accounts SET passwordHash = @passwordHash, passwordVersion = @passwordVersion, updatedAt = @updatedAt
      WHERE id = @id
    `),

    challengeById: db.prepare('SELECT * FROM auth_challenges WHERE id = ?'),
    challengeLatest: db.prepare(`
      SELECT * FROM auth_challenges WHERE purpose = ? AND email = ?
      ORDER BY issuedAt DESC, rowid DESC LIMIT 1
    `),
    challengeInsert: db.prepare(`
      INSERT INTO auth_challenges
        (id, purpose, email, codeDigest, issuedAt, expiresAt, resendAt, remainingAttempts, consumedAt, replacedAt, createdAt, updatedAt)
      VALUES
        (@id, @purpose, @email, @codeDigest, @issuedAt, @expiresAt, @resendAt, @remainingAttempts, NULL, NULL, @createdAt, @updatedAt)
    `),
    challengeReplaceActive: db.prepare(`
      UPDATE auth_challenges SET replacedAt = @replacedAt, updatedAt = @updatedAt
      WHERE purpose = @purpose AND email = @email AND consumedAt IS NULL AND replacedAt IS NULL
    `),
    challengeConsume: db.prepare(`
      UPDATE auth_challenges SET consumedAt = @consumedAt, updatedAt = @updatedAt
      WHERE id = @id AND consumedAt IS NULL AND replacedAt IS NULL
    `),
    challengeDecrement: db.prepare(`
      UPDATE auth_challenges SET remainingAttempts = remainingAttempts - 1, updatedAt = @updatedAt
      WHERE id = @id AND remainingAttempts > 0 AND consumedAt IS NULL AND replacedAt IS NULL
    `),

    containerById: db.prepare('SELECT * FROM auth_containers WHERE id = ?'),
    containerInsert: db.prepare('INSERT INTO auth_containers (id, rememberedSessionId, createdAt, updatedAt) VALUES (?, NULL, ?, ?)'),
    containerPointer: db.prepare('UPDATE auth_containers SET rememberedSessionId = @sessionId, updatedAt = @updatedAt WHERE id = @id'),
    containerDelete: db.prepare('DELETE FROM auth_containers WHERE id = ?'),
    containersClearPointerForAccount: db.prepare(`
      UPDATE auth_containers SET rememberedSessionId = NULL, updatedAt = @updatedAt
      WHERE rememberedSessionId IN (SELECT id FROM auth_sessions WHERE accountId = @accountId)
    `),

    sessionById: db.prepare('SELECT * FROM auth_sessions WHERE id = ?'),
    sessionInsert: db.prepare(`
      INSERT INTO auth_sessions
        (id, containerId, accountId, state, persistence, rememberRequested, passwordVersion,
         issuedAt, expiresAt, activatedAt, revokedAt, createdAt, updatedAt)
      VALUES
        (@id, @containerId, @accountId, @state, @persistence, @rememberRequested, @passwordVersion,
         @issuedAt, @expiresAt, NULL, NULL, @createdAt, @updatedAt)
    `),
    sessionActivate: db.prepare(`
      UPDATE auth_sessions
      SET state = 'active', persistence = @persistence, expiresAt = @expiresAt,
          activatedAt = @activatedAt, updatedAt = @updatedAt
      WHERE id = @id AND state = 'pending' AND revokedAt IS NULL
    `),
    sessionRevoke: db.prepare(`
      UPDATE auth_sessions SET revokedAt = @revokedAt, updatedAt = @updatedAt
      WHERE id = @id AND revokedAt IS NULL
    `),
    sessionsRevokeAccount: db.prepare(`
      UPDATE auth_sessions SET revokedAt = @revokedAt, updatedAt = @updatedAt
      WHERE accountId = @accountId AND revokedAt IS NULL
    `),
    sessionsCountLive: db.prepare(`
      SELECT COUNT(*) AS count FROM auth_sessions s
      JOIN auth_accounts a ON a.id = s.accountId
      WHERE s.containerId = @containerId
        AND s.revokedAt IS NULL
        AND s.passwordVersion = a.passwordVersion
        AND (s.expiresAt IS NULL OR s.expiresAt > @now)
    `),

    bindingByPage: db.prepare('SELECT * FROM auth_page_bindings WHERE containerId = ? AND pageId = ?'),
    bindingUpsert: db.prepare(`
      INSERT INTO auth_page_bindings (containerId, pageId, sessionId, createdAt, updatedAt)
      VALUES (@containerId, @pageId, @sessionId, @now, @now)
      ON CONFLICT(containerId, pageId) DO UPDATE SET sessionId = excluded.sessionId, updatedAt = excluded.updatedAt
    `),
    bindingsDeleteForSession: db.prepare('DELETE FROM auth_page_bindings WHERE sessionId = ?'),
    bindingsDeleteForAccountSessions: db.prepare(
      'DELETE FROM auth_page_bindings WHERE sessionId IN (SELECT id FROM auth_sessions WHERE accountId = ?)'
    ),
    bindingsDeleteForContainer: db.prepare('DELETE FROM auth_page_bindings WHERE containerId = ?')
  };

  return {
    isAccountDeleting(accountId) {
      return Boolean(db.prepare('SELECT 1 FROM auth_account_deletions WHERE accountId=?').get(accountId));
    },
    isAccountActive(accountKey) {
      return Boolean(db.prepare(`SELECT 1 FROM auth_accounts a WHERE accountKey=?
        AND NOT EXISTS (SELECT 1 FROM auth_account_deletions d WHERE d.accountId=a.id)`).get(accountKey));
    },
    getAccountByEmail(email) {
      return statements.accountByEmail.get(email) ?? null;
    },

    getAccountById(id) {
      return statements.accountById.get(id) ?? null;
    },

    insertAccount(account) {
      statements.accountInsert.run(account);
      return account;
    },

    updateAccountPassword(id, passwordHash, passwordVersion, updatedAt) {
      const result = statements.accountPasswordUpdate.run({ id, passwordHash, passwordVersion, updatedAt });
      return result.changes > 0;
    },

    getChallenge(id) {
      return statements.challengeById.get(id) ?? null;
    },

    getLatestChallenge(purpose, email) {
      return statements.challengeLatest.get(purpose, email) ?? null;
    },

    insertChallenge(challenge) {
      statements.challengeInsert.run(challenge);
      return challenge;
    },

    replaceActiveChallenges(purpose, email, replacedAt) {
      statements.challengeReplaceActive.run({ purpose, email, replacedAt, updatedAt: replacedAt });
    },

    consumeChallenge(id, consumedAt) {
      const result = statements.challengeConsume.run({ id, consumedAt, updatedAt: consumedAt });
      return result.changes > 0;
    },

    decrementChallengeAttempt(id, updatedAt) {
      statements.challengeDecrement.run({ id, updatedAt });
      return statements.challengeById.get(id) ?? null;
    },

    getContainer(id) {
      return statements.containerById.get(id) ?? null;
    },

    insertContainer(id, now) {
      statements.containerInsert.run(id, now, now);
      return { id, rememberedSessionId: null, createdAt: now, updatedAt: now };
    },

    setRememberedPointer(id, sessionId, updatedAt) {
      statements.containerPointer.run({ id, sessionId, updatedAt });
    },

    deleteContainer(id) {
      statements.containerDelete.run(id);
    },

    clearRememberedPointersForAccount(accountId, updatedAt) {
      statements.containersClearPointerForAccount.run({ accountId, updatedAt });
    },

    getSession(id) {
      return statements.sessionById.get(id) ?? null;
    },

    insertSession(session) {
      statements.sessionInsert.run(session);
      return session;
    },

    activateSession(id, persistence, expiresAt, activatedAt) {
      const result = statements.sessionActivate.run({
        id,
        persistence,
        expiresAt,
        activatedAt,
        updatedAt: activatedAt
      });
      return result.changes > 0;
    },

    revokeSession(id, revokedAt) {
      const result = statements.sessionRevoke.run({ id, revokedAt, updatedAt: revokedAt });
      return result.changes > 0;
    },

    revokeAccountSessions(accountId, revokedAt) {
      statements.sessionsRevokeAccount.run({ accountId, revokedAt, updatedAt: revokedAt });
    },

    countLiveSessions(containerId, now) {
      return statements.sessionsCountLive.get({ containerId, now }).count;
    },

    getPageBinding(containerId, pageId) {
      return statements.bindingByPage.get(containerId, pageId) ?? null;
    },

    upsertPageBinding(containerId, pageId, sessionId, now) {
      statements.bindingUpsert.run({ containerId, pageId, sessionId, now });
    },

    deleteBindingsForSession(sessionId) {
      statements.bindingsDeleteForSession.run(sessionId);
    },

    deleteBindingsForAccountSessions(accountId) {
      statements.bindingsDeleteForAccountSessions.run(accountId);
    },

    deleteBindingsForContainer(containerId) {
      statements.bindingsDeleteForContainer.run(containerId);
    }
  };
}
