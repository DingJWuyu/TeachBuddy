// Auth-owned migrations. The shared runner owns the ledger and applies each
// item inside one transaction: `{ id, up(db) }` with the `auth_` prefix.
//
// All statements are additive and idempotent so a re-run after a lost ledger
// cannot damage existing data. The baseline app schema (users table) is only
// read during the legacy import; no baseline table is altered.

import { canonicalizeEmail, isCanonicalEmail, OPAQUE_ID_PATTERN } from '../validation.js';

const CREATE_ACCOUNTS = `
  CREATE TABLE IF NOT EXISTS auth_accounts (
    id TEXT PRIMARY KEY,
    accountKey TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nickname TEXT,
    passwordHash TEXT NOT NULL,
    passwordVersion INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_accounts_email_idx ON auth_accounts (email COLLATE NOCASE);
`;

const CREATE_CHALLENGES = `
  CREATE TABLE IF NOT EXISTS auth_challenges (
    id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    email TEXT NOT NULL,
    codeDigest TEXT NOT NULL,
    issuedAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    resendAt TEXT NOT NULL,
    remainingAttempts INTEGER NOT NULL,
    consumedAt TEXT,
    replacedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_challenges_binding_idx
    ON auth_challenges (purpose, email, issuedAt DESC);
`;

const CREATE_CONTAINERS = `
  CREATE TABLE IF NOT EXISTS auth_containers (
    id TEXT PRIMARY KEY,
    rememberedSessionId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`;

const CREATE_SESSIONS = `
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    containerId TEXT,
    accountId TEXT NOT NULL,
    state TEXT NOT NULL,
    persistence TEXT NOT NULL,
    rememberRequested INTEGER NOT NULL,
    passwordVersion INTEGER NOT NULL,
    issuedAt TEXT NOT NULL,
    expiresAt TEXT,
    activatedAt TEXT,
    revokedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions (accountId);
  CREATE INDEX IF NOT EXISTS auth_sessions_container_idx ON auth_sessions (containerId);
  CREATE TABLE IF NOT EXISTS auth_page_bindings (
    containerId TEXT NOT NULL,
    pageId TEXT NOT NULL,
    sessionId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    PRIMARY KEY (containerId, pageId)
  );
  CREATE INDEX IF NOT EXISTS auth_page_bindings_session_idx ON auth_page_bindings (sessionId);
`;

const CREATE_META = `
  CREATE TABLE IF NOT EXISTS auth_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const CREATE_LEGACY_GAPS = `
  CREATE TABLE IF NOT EXISTS auth_legacy_gaps (
    accountId TEXT PRIMARY KEY,
    email TEXT,
    reason TEXT NOT NULL,
    detail TEXT,
    recordedAt TEXT NOT NULL
  );
`;

function hasTable(db, name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return Boolean(row);
}

function toIso(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

// Copies baseline accounts into the auth store without inventing data.
// accountKey keeps the original stable user id so workspace partitions keep
// resolving. A nickname that cannot be derived from the baseline `name` column
// is left null and recorded in auth_legacy_gaps for the integrator instead of
// being derived from the email or truncated.
function importLegacyAccounts(db) {
  if (!hasTable(db, 'users')) return;

  const nowIso = new Date().toISOString();
  const rows = db.prepare('SELECT * FROM users').all();
  const insertGap = db.prepare(
    'INSERT OR REPLACE INTO auth_legacy_gaps (accountId, email, reason, detail, recordedAt) VALUES (?, ?, ?, ?, ?)'
  );
  const findAccount = db.prepare('SELECT id FROM auth_accounts WHERE id = ? OR email = ? COLLATE NOCASE');
  const insertAccount = db.prepare(`
    INSERT INTO auth_accounts (id, accountKey, email, nickname, passwordHash, passwordVersion, createdAt, updatedAt)
    VALUES (@id, @accountKey, @email, @nickname, @passwordHash, 1, @createdAt, @updatedAt)
  `);

  for (const row of rows) {
    const legacyId = typeof row.id === 'string' ? row.id : '';
    const rawEmail = typeof row.email === 'string' ? row.email : '';
    const email = canonicalizeEmail(rawEmail);

    if (!legacyId || !OPAQUE_ID_PATTERN.test(legacyId)) {
      insertGap.run(legacyId || '(missing)', email || null, 'account-key-unusable', null, nowIso);
      continue;
    }
    if (!isCanonicalEmail(email)) {
      insertGap.run(legacyId, email || null, 'email-invalid-format', null, nowIso);
      continue;
    }
    if (findAccount.get(legacyId, email)) {
      insertGap.run(legacyId, email, 'duplicate-account', null, nowIso);
      continue;
    }

    const rawName = typeof row.name === 'string' ? row.name : '';
    const nickname = rawName.trim();
    const nicknameUsable = [...nickname].length >= 1 && [...nickname].length <= 40;
    if (!nicknameUsable) {
      insertGap.run(legacyId, email, 'nickname-unavailable', 'baseline name is empty or exceeds 40 code points', nowIso);
    }

    insertAccount.run({
      id: legacyId,
      accountKey: legacyId,
      email,
      nickname: nicknameUsable ? nickname : null,
      passwordHash: typeof row.passwordHash === 'string' ? row.passwordHash : '',
      createdAt: toIso(row.createdAt, nowIso),
      updatedAt: toIso(row.updatedAt, nowIso)
    });
  }
}

export const migrations = [
  {
    id: 'auth_0001_accounts',
    up(db) {
      db.exec(CREATE_ACCOUNTS);
    }
  },
  {
    id: 'auth_0002_challenges',
    up(db) {
      db.exec(CREATE_CHALLENGES);
    }
  },
  {
    id: 'auth_0003_containers',
    up(db) {
      db.exec(CREATE_CONTAINERS);
    }
  },
  {
    id: 'auth_0004_sessions',
    up(db) {
      db.exec(CREATE_SESSIONS);
    }
  },
  {
    id: 'auth_0005_meta',
    up(db) {
      db.exec(CREATE_META + CREATE_LEGACY_GAPS);
    }
  },
  {
    id: 'auth_0006_legacy_accounts',
    up(db) {
      importLegacyAccounts(db);
    }
  },
  {
    // The verification-code HMAC key must not live next to its digests. An
    // earlier candidate wrote a fallback key into auth_meta; drop the table so
    // both fresh and upgraded databases hold no key material.
    id: 'auth_0007_drop_auth_meta',
    up(db) {
      db.exec('DROP TABLE IF EXISTS auth_meta;');
    }
  }
];
