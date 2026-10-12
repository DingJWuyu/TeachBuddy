import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createIntegration } from './fixtures/auth-integration/harness.js';

async function register(world, email) {
  const client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const pending = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '原昵称', password: 'profile-test-password', termsAccepted: true, rememberMe: true,
    challengeId: sent.json.challengeId, verificationCode: world.mailer.lastCode('registration', email)
  } });
  assert.equal(pending.status, 201, pending.text);
  return { client, session: pending.json };
}

test('nickname profile uses the active account, persists and leaves identity fields untouched', async () => {
  const world = await createIntegration();
  let passed = false;
  try {
    const { client, session } = await register(world, 'profile@example.test');
    const other = await register(world, 'other-profile@example.test');
    assert.equal((await client.request('POST', '/api/auth/profile', { body: { nickname: '待激活' } })).status, 401);
    await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: session.id, rememberMe: true } });
    const before = world.workbench.db.prepare('SELECT * FROM auth_accounts WHERE accountKey=?').get(session.account.accountKey);
    const sessionBefore = world.workbench.db.prepare('SELECT * FROM auth_sessions WHERE id=?').get(session.id);
    const containersBefore = world.workbench.db.prepare('SELECT * FROM auth_containers').all();
    world.clock.advance(1000);
    const nickname = '😀'.repeat(40);
    const changed = await client.request('POST', '/api/auth/profile', { body: { nickname: ` ${nickname} ` } });
    assert.equal(changed.status, 200, changed.text);
    assert.equal(changed.headers['cache-control'], 'no-store');
    assert.deepEqual(changed.setCookies, []);
    assert.deepEqual(changed.json, { ...session.account, nickname });
    const after = world.workbench.db.prepare('SELECT * FROM auth_accounts WHERE accountKey=?').get(session.account.accountKey);
    assert.deepEqual(after, { ...before, nickname, updatedAt: world.clock.iso() });
    assert.deepEqual(world.workbench.db.prepare('SELECT * FROM auth_sessions WHERE id=?').get(session.id), sessionBefore);
    assert.deepEqual(world.workbench.db.prepare('SELECT * FROM auth_containers').all(), containersBefore);
    assert.equal(world.workbench.db.prepare('SELECT nickname FROM auth_accounts WHERE accountKey=?').get(other.session.account.accountKey).nickname, '原昵称');
    assert.equal((await client.request('GET', '/api/auth/session')).json.session.account.nickname, nickname);
    const fresh = world.client();
    await fresh.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    const signedIn = await fresh.request('POST', '/api/auth/login', { body: { email: 'profile@example.test', password: 'profile-test-password', rememberMe: false } });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.json.account.nickname, nickname);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});

test('nickname profile rejects invalid input, forged identity, revoked sessions and rolls back storage failures', async () => {
  const world = await createIntegration();
  let passed = false;
  try {
    const { client, session } = await register(world, 'profile-guards@example.test');
    await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: session.id, rememberMe: true } });
    const before = world.workbench.db.prepare('SELECT * FROM auth_accounts').all();
    for (const [body, type] of [
      [{ nickname: '' }, 'nickname-empty'], [{ nickname: ' \n\t ' }, 'nickname-empty'],
      [{ nickname: '😀'.repeat(41) }, 'nickname-too-long'], [{ nickname: 12 }, 'invalid-field-type'],
      [{}, 'required-field'], [{ nickname: '新昵称', email: 'other@example.test' }, 'unknown-field'],
      [{ nickname: '新昵称', accountKey: 'someone-else' }, 'unknown-field']
    ]) {
      const result = await client.request('POST', '/api/auth/profile', { body });
      assert.equal(result.status, 422, result.text);
      assert.equal(result.json.type, '/problems/auth/' + type);
    }
    for (const [options, status] of [
      [{ origin: 'https://untrusted.example' }, 403], [{ protect: false }, 403],
      [{ cookie: null }, 409], [{ page: 'f'.repeat(32) }, 401], [{ contentType: 'text/plain' }, 415]
    ]) assert.equal((await client.request('POST', '/api/auth/profile', { body: { nickname: '拒绝保存' }, ...options })).status, status);
    world.workbench.db.exec("CREATE TRIGGER fail_nickname BEFORE UPDATE OF nickname ON auth_accounts BEGIN SELECT RAISE(ABORT, 'write rejected'); END");
    assert.equal((await client.request('POST', '/api/auth/profile', { body: { nickname: '失败保存' } })).status, 503);
    world.workbench.db.exec('DROP TRIGGER fail_nickname');
    assert.deepEqual(world.workbench.db.prepare('SELECT * FROM auth_accounts').all(), before);
    await client.request('POST', '/api/auth/logout', { body: { sessionId: session.id } });
    const rejected = await client.request('POST', '/api/auth/profile', { body: { nickname: '退出后保存' } });
    assert.ok([401, 409].includes(rejected.status), rejected.text);
    assert.deepEqual(world.workbench.db.prepare('SELECT * FROM auth_accounts').all(), before);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
