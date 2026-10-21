// CC-STORE / CC-UNKNOWN / CC-RACE: real SQLite faults, real rollback, lost
// responses through a lossy TCP proxy and server-side concurrency.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertOk,
  assertProblem,
  clearFault,
  createClient,
  createWorld,
  injectFault,
  startLossyProxy
} from './fixtures/auth-contract/harness.js';

function accountRow(world, email) {
  return world.db.prepare('SELECT * FROM auth_accounts WHERE email = ?').get(email) ?? null;
}

function challengeRow(world, id) {
  return world.db.prepare('SELECT * FROM auth_challenges WHERE id = ?').get(id);
}

function sessionRow(world, id) {
  return world.db.prepare('SELECT * FROM auth_sessions WHERE id = ?').get(id);
}

async function issueRegistrationChallenge(world, email) {
  const client = world.client();
  await world.bootstrap(client);
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  assertOk(sent);
  return { client, challengeId: sent.json.challengeId, code: world.mailer.lastCode('registration', email) };
}

function registrationBody(email, challengeId, code, nickname = 'ST01') {
  return {
    email,
    nickname,
    password: 'secret-9',
    challengeId,
    verificationCode: code,
    termsAccepted: true,
    rememberMe: false
  };
}

async function issueResetChallenge(world, client, email) {
  const sent = await client.request('POST', '/api/auth/password-reset-codes', { body: { email } });
  assertOk(sent);
  return { challengeId: sent.json.challengeId, code: world.mailer.lastCode('password-reset', email) };
}

describe('CC-STORE 事务回滚', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('ST01 I03 账户/消费/pending 三个失败点统一回滚且同码重试', async () => {
    const faults = [
      ['fault_account', "BEFORE INSERT ON auth_accounts BEGIN SELECT RAISE(ABORT, 'fault'); END"],
      [
        'fault_consume',
        "BEFORE UPDATE OF consumedAt ON auth_challenges WHEN NEW.consumedAt IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fault'); END"
      ],
      ['fault_session', "BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT, 'fault'); END"]
    ];

    for (const [index, [name, sql]] of faults.entries()) {
      const email = 'st01-register-' + index + '@example.com';
      const { client, challengeId, code } = await issueRegistrationChallenge(world, email);
      const sessionsBefore = world.db.prepare('SELECT COUNT(*) AS total FROM auth_sessions').get().total;
      const bindingsBefore = world.db.prepare('SELECT COUNT(*) AS total FROM auth_page_bindings').get().total;
      injectFault(world.db, name, sql);

      assertProblem(
        await client.request('POST', '/api/auth/register', {
          body: registrationBody(email, challengeId, code)
        }),
        { status: 503, type: 'account-store-unavailable' }
      );
      clearFault(world.db, name);

      assert.equal(accountRow(world, email), null, name + ': no partial account');
      assert.equal(challengeRow(world, challengeId).consumedAt, null, name + ': challenge not consumed');
      assert.equal(
        world.db.prepare('SELECT COUNT(*) AS total FROM auth_sessions').get().total,
        sessionsBefore,
        name + ': no partial session'
      );
      assert.equal(
        world.db.prepare('SELECT COUNT(*) AS total FROM auth_page_bindings').get().total,
        bindingsBefore,
        name + ': no partial page binding'
      );

      await world.restart();
      assert.equal(accountRow(world, email), null, name + ': restart sees no partial account');

      const restarted = world.client({ jar: client.jar, pageId: client.pageId });
      const retried = await restarted.request('POST', '/api/auth/register', {
        body: registrationBody(email, challengeId, code)
      });
      assertOk(retried, 201);
      assert.equal(sessionRow(world, retried.json.id).state, 'pending');
      assert.equal(
        await world.module.resolvePrincipal({
          headers: { cookie: restarted.jar.header(), 'x-teachbuddy-page': restarted.pageId }
        }),
        null,
        name + ': pending still cannot authorize'
      );
      const activated = await restarted.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: retried.json.id, rememberMe: false }
      });
      assertOk(activated);
      assert.deepEqual(
        await world.module.resolvePrincipal({
          headers: { cookie: restarted.jar.header(), 'x-teachbuddy-page': restarted.pageId }
        }),
        { accountKey: retried.json.account.accountKey }
      );
    }
  });

  it('ST01 I05 密码/撤销/消费三个失败点统一回滚且同码重试', async () => {
    const faults = [
      ['fault_password', "BEFORE UPDATE OF passwordHash ON auth_accounts BEGIN SELECT RAISE(ABORT, 'fault'); END"],
      [
        'fault_revoke',
        "BEFORE UPDATE OF revokedAt ON auth_sessions WHEN NEW.revokedAt IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fault'); END"
      ],
      [
        'fault_reset_consume',
        "BEFORE UPDATE OF consumedAt ON auth_challenges WHEN NEW.consumedAt IS NOT NULL BEGIN SELECT RAISE(ABORT, 'fault'); END"
      ]
    ];

    for (const [index, [name, sql]] of faults.entries()) {
      const email = 'st01-reset-' + index + '@example.com';
      const account = await world.createAccount({ email, password: 'old-secret-9', rememberMe: false });
      const client = account.client;
      const before = accountRow(world, email);
      const { challengeId, code } = await issueResetChallenge(world, client, email);
      injectFault(world.db, name, sql);

      assertProblem(
        await client.request('POST', '/api/auth/password-reset', {
          body: { verificationCode: code, password: 'new-secret-9', challengeId, email }
        }),
        { status: 503, type: 'account-store-unavailable' }
      );
      clearFault(world.db, name);

      const after = accountRow(world, email);
      assert.equal(after.passwordHash, before.passwordHash, name + ': password unchanged');
      assert.equal(after.passwordVersion, before.passwordVersion, name + ': version unchanged');
      assert.ok(challengeRow(world, challengeId).consumedAt === null, name + ': challenge not consumed');
      assert.equal(sessionRow(world, account.sessionId).revokedAt, null, name + ': session not revoked');
      assert.deepEqual(
        await world.module.resolvePrincipal({
          headers: { cookie: client.jar.header(), 'x-teachbuddy-page': client.pageId }
        }),
        { accountKey: account.accountKey }
      );

      await world.restart();
      const restarted = world.client({ jar: client.jar, pageId: client.pageId });
      const retried = await restarted.request('POST', '/api/auth/password-reset', {
        body: { verificationCode: code, password: 'new-secret-9', challengeId, email }
      });
      assertOk(retried, 204);
      assert.equal(accountRow(world, email).passwordVersion, before.passwordVersion + 1);
      assert.ok(sessionRow(world, account.sessionId).revokedAt, name + ': session revoked after retry');
      assert.equal(
        await world.module.resolvePrincipal({
          headers: { cookie: restarted.jar.header(), 'x-teachbuddy-page': restarted.pageId }
        }),
        null
      );
      const oldPassword = await restarted.request('POST', '/api/auth/login', {
        body: { email, password: 'old-secret-9', rememberMe: false }
      });
      assertProblem(oldPassword, { status: 401, type: 'credentials-rejected' });
    }
  });

  it('ST02 账户存储不可读/结构损坏返回503，不种子化也不伪装匿名', async () => {
    const account = await world.createAccount({ email: 'st02@example.com', rememberMe: false });
    const client = account.client;
    assert.deepEqual(
      await world.module.resolvePrincipal({
        headers: { cookie: client.jar.header(), 'x-teachbuddy-page': client.pageId }
      }),
      { accountKey: account.accountKey }
    );

    world.db.exec('ALTER TABLE auth_accounts RENAME TO auth_accounts_hidden');
    assertProblem(await client.request('GET', '/api/auth/session'), {
      status: 503,
      type: 'account-store-unavailable'
    });
    assertProblem(
      await client.request('POST', '/api/auth/login', {
        body: { email: 'st02@example.com', password: account.password, rememberMe: false }
      }),
      { status: 503, type: 'account-store-unavailable' }
    );
    await assert.rejects(
      world.module.resolvePrincipal({
        headers: { cookie: client.jar.header(), 'x-teachbuddy-page': client.pageId }
      }),
      (error) => error.status === 503
    );
    world.db.exec('ALTER TABLE auth_accounts_hidden RENAME TO auth_accounts');

    const recovered = await client.request('GET', '/api/auth/session');
    assertOk(recovered);
    assert.equal(recovered.json.session.account.accountKey, account.accountKey);
  });

  it('ST02 昵称缺口返回503而不是邮箱派生身份', async () => {
    const account = await world.createAccount({ email: 'st02-nickname@example.com', rememberMe: false });
    world.db.prepare('UPDATE auth_accounts SET nickname = NULL WHERE email = ?').run('st02-nickname@example.com');
    const client = world.client();
    await world.bootstrap(client);
    assertProblem(
      await client.request('POST', '/api/auth/login', {
        body: { email: 'st02-nickname@example.com', password: account.password, rememberMe: false }
      }),
      { status: 503, type: 'account-store-unavailable' }
    );
    assert.equal(accountRow(world, 'st02-nickname@example.com').nickname, null);
  });

  it('RA03 activate 与撤销按提交顺序裁决，已撤销目标不可复活', async () => {
    const first = await world.createAccount({ email: 'ra03-first@example.com', rememberMe: true });
    const second = await world.createAccount({ email: 'ra03-second@example.com', rememberMe: true });

    // Revoke then activate: the pending target cannot come back.
    const pending = await second.client.request('POST', '/api/auth/login', {
      body: { email: 'ra03-second@example.com', password: second.password, rememberMe: true }
    });
    const revokeFirst = await second.client.request('POST', '/api/auth/logout', {
      body: { sessionId: pending.json.id }
    });
    assert.equal(revokeFirst.status, 204);
    assertProblem(
      await second.client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: pending.json.id, rememberMe: true }
      }),
      { status: 401, type: 'session-invalid' }
    );

    // Activate then revoke: the active session is revoked afterwards.
    const activated = await first.client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: first.sessionId, rememberMe: true }
    });
    assertOk(activated);
    const revokeSecond = await first.client.request('POST', '/api/auth/logout', {
      body: { sessionId: first.sessionId }
    });
    assert.equal(revokeSecond.status, 204);
    const afterRevoke = await first.client.request('GET', '/api/auth/session');
    assert.equal(afterRevoke.json.session, null);
    assert.equal(afterRevoke.json.browserReady, false);

    const fresh = world.client();
    await world.bootstrap(fresh);
    assertProblem(
      await fresh.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: first.sessionId, rememberMe: true }
      }),
      { status: 401, type: 'session-invalid' }
    );
  });

  it('RA01/RA02 并发提交使用请求快照且只产生一个业务结果', async () => {
    const { client, challengeId, code } = await issueRegistrationChallenge(world, 'ra02@example.com');
    const [original, otherEmail] = await Promise.all([
      client.request('POST', '/api/auth/register', {
        body: registrationBody('ra02@example.com', challengeId, code, 'Original')
      }),
      client.request('POST', '/api/auth/register', {
        body: registrationBody('ra02-other@example.com', challengeId, code, 'Other')
      })
    ]);
    const statuses = [original.status, otherEmail.status].sort();
    assert.deepEqual(statuses, [201, 422]);
    const winner = original.status === 201 ? original : otherEmail;
    const stored = accountRow(world, winner.json.account.email);
    assert.equal(stored.nickname, winner.json.account.nickname);
    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email IN (?, ?)')
        .get('ra02@example.com', 'ra02-other@example.com').total,
      1
    );

    const account = await world.createAccount({ email: 'ra01-reset@example.com', rememberMe: false });
    const reset = await issueResetChallenge(world, account.client, 'ra01-reset@example.com');
    const [left, right] = await Promise.all([
      account.client.request('POST', '/api/auth/password-reset', {
        body: { verificationCode: reset.code, password: 'one-new-pass', challengeId: reset.challengeId, email: 'ra01-reset@example.com' }
      }),
      account.client.request('POST', '/api/auth/password-reset', {
        body: { verificationCode: reset.code, password: 'two-new-pass', challengeId: reset.challengeId, email: 'ra01-reset@example.com' }
      })
    ]);
    assert.deepEqual([left.status, right.status].sort(), [204, 422]);
  });
});

describe('CC-UNKNOWN 响应丢失后的恢复', () => {
  let world;
  let proxy;
  before(async () => {
    world = await createWorld();
    proxy = await startLossyProxy(world.baseUrl);
  });
  after(async () => {
    await proxy.close();
    await world.stop();
  });

  async function loseResponse(method, path, { jar, pageId, body }) {
    const client = createClient(proxy.baseUrl, { jar, pageId });
    let failed = false;
    try {
      await client.request(method, path, { body, origin: world.baseUrl });
    } catch {
      failed = true;
    }
    assert.equal(failed, true, 'lossy proxy must destroy the client connection');
  }

  it('UN01 注册已提交但响应丢失：登录可恢复且同码重试为已消费', async () => {
    const email = 'un01@example.com';
    const client = world.client();
    await world.bootstrap(client);
    const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    const code = world.mailer.lastCode('registration', email);

    await loseResponse('POST', '/api/auth/register', {
      jar: client.jar,
      pageId: client.pageId,
      body: registrationBody(email, sent.json.challengeId, code)
    });

    const stored = accountRow(world, email);
    assert.ok(stored, 'register committed before the response was lost');
    assert.ok(challengeRow(world, sent.json.challengeId).consumedAt);

    const retry = await client.request('POST', '/api/auth/register', {
      body: registrationBody(email, sent.json.challengeId, code)
    });
    assertProblem(retry, { status: 422, type: 'verification-code-consumed', field: 'verificationCode' });

    const relogin = await client.request('POST', '/api/auth/login', {
      body: { email, password: 'secret-9', rememberMe: false }
    });
    assertOk(relogin);
    assert.equal(relogin.json.account.accountKey, stored.accountKey);
  });

  it('UN01 请求未达服务端时没有副作用，原码仍可用', async () => {
    const email = 'un01-offline@example.com';
    const client = world.client();
    await world.bootstrap(client);
    const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    const code = world.mailer.lastCode('registration', email);

    const offline = createClient('http://127.0.0.1:1', { jar: client.jar, pageId: client.pageId });
    await assert.rejects(
      offline.request('POST', '/api/auth/register', {
        body: registrationBody(email, sent.json.challengeId, code)
      })
    );
    assert.equal(accountRow(world, email), null);

    const registered = await client.request('POST', '/api/auth/register', {
      body: registrationBody(email, sent.json.challengeId, code)
    });
    assertOk(registered, 201);
  });

  it('UN02 重置已提交但响应丢失：不自动重试，旧密码失效且只改一次', async () => {
    const account = await world.createAccount({ email: 'un02@example.com', password: 'old-secret-9', rememberMe: false });
    const client = account.client;
    const reset = await issueResetChallenge(world, client, 'un02@example.com');
    const versionBefore = accountRow(world, 'un02@example.com').passwordVersion;

    await loseResponse('POST', '/api/auth/password-reset', {
      jar: client.jar,
      pageId: client.pageId,
      body: {
        verificationCode: reset.code,
        password: 'new-secret-9',
        challengeId: reset.challengeId,
        email: 'un02@example.com'
      }
    });

    assert.equal(accountRow(world, 'un02@example.com').passwordVersion, versionBefore + 1);
    const retry = await client.request('POST', '/api/auth/password-reset', {
      body: {
        verificationCode: reset.code,
        password: 'new-secret-9',
        challengeId: reset.challengeId,
        email: 'un02@example.com'
      }
    });
    assertProblem(retry, { status: 422, type: 'verification-code-consumed', field: 'verificationCode' });
    assert.equal(accountRow(world, 'un02@example.com').passwordVersion, versionBefore + 1);

    const fresh = world.client();
    await world.bootstrap(fresh);
    assertProblem(
      await fresh.request('POST', '/api/auth/login', {
        body: { email: 'un02@example.com', password: 'old-secret-9', rememberMe: false }
      }),
      { status: 401, type: 'credentials-rejected' }
    );
    assertOk(
      await fresh.request('POST', '/api/auth/login', {
        body: { email: 'un02@example.com', password: 'new-secret-9', rememberMe: false }
      })
    );
  });

  it('UN03 发码响应丢失后冷却仍有效，旧挑战可继续使用', async () => {
    const email = 'un03@example.com';
    const client = world.client();
    await world.bootstrap(client);

    await loseResponse('POST', '/api/auth/registration-codes', {
      jar: client.jar,
      pageId: client.pageId,
      body: { email }
    });

    const stored = world.db
      .prepare('SELECT * FROM auth_challenges WHERE email = ? ORDER BY issuedAt DESC LIMIT 1')
      .get(email);
    assert.ok(stored, 'send committed before the response was lost');

    const tooSoon = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    assertProblem(tooSoon, { status: 429, type: 'code-send-cooldown' });

    world.clock.advance(30000);
    const resend = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    assertOk(resend);
    assert.notEqual(resend.json.challengeId, stored.id);
    assert.ok(challengeRow(world, stored.id).replacedAt);
  });

  it('O02 退出已提交但响应丢失：重试同目标安全', async () => {
    const account = await world.createAccount({ email: 'o02-lossy@example.com', rememberMe: false });
    await loseResponse('POST', '/api/auth/logout', {
      jar: account.client.jar,
      pageId: account.client.pageId,
      body: { sessionId: account.sessionId }
    });
    assert.ok(sessionRow(world, account.sessionId).revokedAt, 'logout committed before the response was lost');

    const retry = await account.client.request('POST', '/api/auth/logout', {
      body: { sessionId: account.sessionId }
    });
    assert.equal(retry.status, 204);
    assert.equal(
      await world.module.resolvePrincipal({
        headers: { cookie: account.client.jar.header(), 'x-teachbuddy-page': account.client.pageId }
      }),
      null
    );
  });

  it('P04 所有成功与失败响应结构符合操作schema', async () => {
    const email = 'p04@example.com';
    const client = world.client();
    const anonymous = await client.request('GET', '/api/auth/session');
    for (const key of ['browserReady', 'registrationOpen', 'session', 'rememberedSession', 'serverTime']) {
      assert.ok(key in anonymous.json, 'SessionStatus.' + key);
    }
    assert.equal(Number.isNaN(Date.parse(anonymous.json.serverTime)), false);

    const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    for (const key of ['challengeId', 'purpose', 'email', 'issuedAt', 'expiresAt', 'resendAt', 'serverTime', 'remainingAttempts']) {
      assert.ok(key in sent.json, 'Challenge.' + key);
    }
    assert.equal(sent.json.purpose, 'registration');
    assert.equal(Number.isNaN(Date.parse(sent.json.expiresAt)), false);

    const account = await world.createAccount({ email: 'p04-account@example.com', rememberMe: true });
    const status = await account.client.request('GET', '/api/auth/session');
    for (const key of ['id', 'account', 'state', 'persistence', 'rememberRequested', 'issuedAt', 'expiresAt']) {
      assert.ok(key in status.json.session, 'Session.' + key);
    }
    for (const key of ['accountKey', 'email', 'nickname']) {
      assert.ok(key in status.json.session.account, 'Account.' + key);
    }
    assert.equal(status.json.session.state, 'active');
    assert.equal(status.json.session.persistence, 'remembered');
    assert.equal(status.json.session.expiresAt, status.json.rememberedSession.expiresAt);

    const failure = await client.request('POST', '/api/auth/login', {
      body: { email: 'nobody@example.com', password: 'nope-nope', rememberMe: false }
    });
    assert.equal(failure.json.status, failure.status);
    assert.equal(typeof failure.json.type, 'string');
  });
});
