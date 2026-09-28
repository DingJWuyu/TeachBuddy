// Migration checks: fresh database and an isolated baseline ("old") database
// fixture created with the real baseline dataStore schema. The import keeps the
// legacy stable id as accountKey, upgrades legacy password hashes on first
// successful login, and records nickname/email gaps instead of inventing data.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createDataStore } from '../src/core/dataStore.js';
import { hashPassword as hashLegacyPassword } from '../src/core/auth.js';
import { applyMigrations, assertOk, assertProblem, createWorld } from './fixtures/auth-contract/harness.js';
import { migrations } from '../src/features/auth/migrations/index.js';

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function openMigrated(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  applyMigrations(db);
  return db;
}

describe('认证迁移', () => {
  it('空库：迁移可重复执行且新账户路径可独立完成', async () => {
    const workDir = tempDir('auth-migration-empty-');
    const dbPath = path.join(workDir, 'empty.sqlite');
    const db = openMigrated(dbPath);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'auth_%'")
      .all()
      .map((row) => row.name)
      .sort();
    assert.deepEqual(tables, [
      'auth_account_deletions',
      'auth_accounts',
      'auth_challenges',
      'auth_containers',
      'auth_legacy_gaps',
      'auth_page_bindings',
      'auth_sessions'
    ]);
    const ledgerCount = db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get().total;
    assert.equal(ledgerCount, migrations.length);

    // Re-running the same ledger is a no-op.
    applyMigrations(db);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get().total, migrations.length);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM auth_legacy_gaps').get().total, 0);
    db.close();

    const world = await createWorld({ workDir, dbPath });
    try {
      const account = await world.createAccount({ email: 'fresh@example.com', rememberMe: false });
      assert.equal(account.nickname, '林老师');
      assert.equal(
        world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email = ?').get('fresh@example.com')
          .total,
        1
      );
    } finally {
      await world.stop();
    }
  });

  it('旧库：保留稳定账户键与昵称，缺口显式登记且不派生邮箱', async () => {
    const workDir = tempDir('auth-migration-legacy-');
    const dbPath = path.join(workDir, 'legacy.sqlite');

    const baseline = createDataStore({ sqlitePath: dbPath });
    const legacyOne = baseline.createUser({
      name: '  林老师  ',
      email: 'Legacy@Example.com',
      passwordHash: hashLegacyPassword('legacy-pass-9'),
      role: 'teacher'
    });
    const legacyNicknameGap = baseline.createUser({
      name: '',
      email: 'gap@example.com',
      passwordHash: hashLegacyPassword('gap-pass-9'),
      role: 'teacher'
    });
    const legacyEmailGap = baseline.createUser({
      name: 'Bad Email',
      email: 'not-an-email',
      passwordHash: hashLegacyPassword('bad-pass-9'),
      role: 'teacher'
    });
    const legacyLongName = baseline.createUser({
      name: '名'.repeat(41),
      email: 'long-name@example.com',
      passwordHash: hashLegacyPassword('long-pass-9'),
      role: 'teacher'
    });
    baseline.close();

    const db = openMigrated(dbPath);
    const accounts = db.prepare('SELECT * FROM auth_accounts').all();
    const gaps = db.prepare('SELECT * FROM auth_legacy_gaps').all();
    assert.equal(accounts.length, 3);
    assert.equal(gaps.length, 3);

    const one = db.prepare('SELECT * FROM auth_accounts WHERE id = ?').get(legacyOne.id);
    assert.equal(one.accountKey, legacyOne.id);
    assert.equal(one.email, 'legacy@example.com');
    assert.equal(one.nickname, '林老师');

    const nicknameGap = db.prepare('SELECT * FROM auth_accounts WHERE id = ?').get(legacyNicknameGap.id);
    assert.equal(nicknameGap.nickname, null);
    assert.equal(
      db.prepare('SELECT reason FROM auth_legacy_gaps WHERE accountId = ?').get(legacyNicknameGap.id).reason,
      'nickname-unavailable'
    );

    assert.equal(db.prepare('SELECT * FROM auth_accounts WHERE id = ?').get(legacyEmailGap.id), undefined);
    assert.equal(
      db.prepare('SELECT reason FROM auth_legacy_gaps WHERE accountId = ?').get(legacyEmailGap.id).reason,
      'email-invalid-format'
    );
    const longName = db.prepare('SELECT * FROM auth_accounts WHERE id = ?').get(legacyLongName.id);
    assert.equal(longName.nickname, null);
    db.close();

    const world = await createWorld({ workDir, dbPath });
    try {
      const client = world.client();
      await world.bootstrap(client);

      const login = await client.request('POST', '/api/auth/login', {
        body: { email: ' LEGACY@example.com ', password: 'legacy-pass-9', rememberMe: false }
      });
      assertOk(login);
      assert.equal(login.json.account.accountKey, legacyOne.id);
      assert.equal(login.json.account.nickname, '林老师');
      const upgraded = world.db.prepare('SELECT passwordHash FROM auth_accounts WHERE id = ?').get(legacyOne.id);
      assert.ok(upgraded.passwordHash.startsWith('scrypt$'), 'legacy hash upgraded on successful login');

      const secondLogin = await client.request('POST', '/api/auth/login', {
        body: { email: 'legacy@example.com', password: 'legacy-pass-9', rememberMe: false }
      });
      assertOk(secondLogin);

      assertProblem(
        await client.request('POST', '/api/auth/login', {
          body: { email: 'gap@example.com', password: 'gap-pass-9', rememberMe: false }
        }),
        { status: 503, type: 'account-store-unavailable' }
      );
      assert.equal(
        world.db.prepare('SELECT nickname FROM auth_accounts WHERE id = ?').get(legacyNicknameGap.id).nickname,
        null
      );
    } finally {
      await world.stop();
    }
  });

  it('上一阶段库：遗留的验证码密钥表被新增迁移删除', async () => {
    const workDir = tempDir('auth-migration-meta-');
    const dbPath = path.join(workDir, 'meta.sqlite');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)');
    const record = db.prepare('INSERT INTO schema_migrations (id, appliedAt) VALUES (?, ?)');
    // State left by the earlier candidate: 0001-0006 applied, auth_meta holding
    // a fallback verification-code secret.
    for (const migration of migrations.slice(0, 6)) {
      db.exec('BEGIN IMMEDIATE');
      migration.up(db);
      record.run(migration.id, new Date().toISOString());
      db.exec('COMMIT');
    }
    db.prepare('INSERT INTO auth_meta (key, value) VALUES (?, ?)').run('verification_code_secret', 'old-fallback');

    applyMigrations(db);

    assert.equal(
      db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'auth_meta'").get().total,
      0
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get().total, migrations.length);
    db.close();
  });

  it('旧库迁移不覆盖已有认证账户，也不改动baseline表', async () => {
    const workDir = tempDir('auth-migration-rerun-');
    const dbPath = path.join(workDir, 'rerun.sqlite');
    const baseline = createDataStore({ sqlitePath: dbPath });
    const legacy = baseline.createUser({
      name: 'Legacy',
      email: 'rerun@example.com',
      passwordHash: hashLegacyPassword('rerun-pass-9'),
      role: 'teacher'
    });
    baseline.close();

    const db = openMigrated(dbPath);
    const first = db.prepare('SELECT * FROM auth_accounts WHERE id = ?').get(legacy.id);
    assert.ok(first);
    const usersAfter = db.prepare('SELECT * FROM users').all();
    assert.equal(usersAfter.length, 1);
    applyMigrations(db);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM auth_accounts').get().total, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM auth_legacy_gaps').get().total, 0);
    db.close();
  });
});
