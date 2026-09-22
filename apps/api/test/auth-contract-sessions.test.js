// CC-SESSION / CC-PENDING / CC-RESTORE / CC-ISOLATION / CC-RESET /
// CC-CLOSED / CC-LOGOUT over real HTTP with isolated SQLite.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_1,
  PAGE_2,
  assertOk,
  assertProblem,
  clearFault,
  createWorld,
  injectFault,
  nextTick
} from './fixtures/auth-contract/harness.js';

function sessionInfo(world, sessionId) {
  return world.db.prepare('SELECT * FROM auth_sessions WHERE id = ?').get(sessionId);
}

function resolveFor(world, client) {
  return world.module.resolvePrincipal({
    headers: { cookie: client.jar.header(), 'x-teachbuddy-page': client.pageId }
  });
}

describe('CC-SESSION / CC-PENDING / CC-RESTORE 会话寿命与恢复', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('SE01 page 身份只绑定当前页面，刷新换页不能继承', async () => {
    const account = await world.createAccount({ email: 'se01@example.com', rememberMe: false });
    const client = world.client();
    await world.bootstrap(client);
    const login = await client.request('POST', '/api/auth/login', {
      body: { email: 'se01@example.com', password: account.password, rememberMe: false }
    });
    const activate = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: login.json.id, rememberMe: false }
    });
    assertOk(activate);
    assert.equal(activate.json.session.persistence, 'page');
    assert.equal(activate.json.session.expiresAt, null);
    assert.equal(activate.setCookies.length, 0);

    const otherPage = world.client({ jar: client.jar, pageId: PAGE_2 });
    const getOther = await otherPage.request('GET', '/api/auth/session');
    assertOk(getOther);
    assert.equal(getOther.json.session, null);
    assert.equal(getOther.json.rememberedSession, null);
    assert.deepEqual(await resolveFor(world, client), { accountKey: account.accountKey });
    assert.equal(await resolveFor(world, otherPage), null);
  });

  it('SE02 remembered 恢复不延期，第7天边界401，独立设备无目标', async () => {
    const account = await world.createAccount({ email: 'se02@example.com', rememberMe: true });
    const client = account.client;
    const session = sessionInfo(world, account.sessionId);
    assert.equal(session.persistence, 'remembered');

    const reopened = world.client({ jar: client.jar, pageId: PAGE_2 });
    const beforeRestore = await reopened.request('GET', '/api/auth/session');
    assertOk(beforeRestore);
    assert.equal(beforeRestore.json.session, null);
    assert.equal(beforeRestore.json.rememberedSession.id, account.sessionId);
    assert.equal(beforeRestore.json.rememberedSession.expiresAt, session.expiresAt);
    assert.equal(await resolveFor(world, reopened), null);

    const restore = await reopened.request('POST', '/api/auth/session', {
      body: { action: 'restore', sessionId: account.sessionId }
    });
    assertOk(restore);
    assert.equal(restore.json.session.state, 'active');
    assert.equal(restore.json.session.id, account.sessionId);
    assert.equal(restore.json.session.issuedAt, session.issuedAt);
    assert.equal(restore.json.session.expiresAt, session.expiresAt);
    assert.equal(restore.setCookies.length, 0);

    world.clock.advance(24 * 3600 * 1000);
    const thirdPage = world.client({ jar: client.jar, pageId: '33333333333333333333333333333333' });
    const restoredAgain = await thirdPage.request('POST', '/api/auth/session', {
      body: { action: 'restore', sessionId: account.sessionId }
    });
    assertOk(restoredAgain);
    assert.equal(restoredAgain.json.session.expiresAt, session.expiresAt);

    const independent = world.client();
    await world.bootstrap(independent);
    const independentStatus = await independent.request('GET', '/api/auth/session');
    assert.equal(independentStatus.json.rememberedSession, null);

    world.clock.set(session.expiresAt);
    const expiredStatus = await reopened.request('GET', '/api/auth/session');
    assertOk(expiredStatus);
    assert.equal(expiredStatus.json.rememberedSession, null);
    assertProblem(
      await reopened.request('POST', '/api/auth/session', {
        body: { action: 'restore', sessionId: account.sessionId }
      }),
      { status: 401, type: 'session-invalid' }
    );
    assert.deepEqual(await resolveFor(world, reopened), null);
  });

  it('PN01 remembered 持久失败保留 pending，可继续当前页或重试保存', async () => {
    const account = await world.createAccount({ email: 'pn01@example.com', rememberMe: false });
    const client = world.client();
    await world.bootstrap(client);
    const login = await client.request('POST', '/api/auth/login', {
      body: { email: 'pn01@example.com', password: account.password, rememberMe: true }
    });
    assertOk(login);

    injectFault(
      world.db,
      'fault_activation',
      "BEFORE UPDATE OF state ON auth_sessions WHEN NEW.state = 'active' BEGIN SELECT RAISE(ABORT, 'fault'); END"
    );
    assertProblem(
      await client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: login.json.id, rememberMe: true }
      }),
      { status: 503, type: 'session-persistence-unavailable' }
    );
    clearFault(world.db, 'fault_activation');

    const stillPending = await client.request('GET', '/api/auth/session');
    assertOk(stillPending);
    assert.equal(stillPending.json.session.state, 'pending');
    assert.equal(sessionInfo(world, login.json.id).state, 'pending');

    const continued = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: login.json.id, rememberMe: false }
    });
    assertOk(continued);
    assert.equal(continued.json.session.state, 'active');
    assert.equal(continued.json.session.persistence, 'page');
    assert.equal(continued.json.session.expiresAt, null);
  });

  it('PN01 注册后的 pending 保存失败不否定账户与验证码消费', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const email = 'pn01-register@example.com';
    const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    const code = world.mailer.lastCode('registration', email);
    const registered = await client.request('POST', '/api/auth/register', {
      body: {
        email,
        nickname: 'PN01',
        password: 'secret-9',
        challengeId: sent.json.challengeId,
        verificationCode: code,
        termsAccepted: true,
        rememberMe: true
      }
    });
    assertOk(registered, 201);

    injectFault(
      world.db,
      'fault_activation_r',
      "BEFORE UPDATE OF state ON auth_sessions WHEN NEW.state = 'active' BEGIN SELECT RAISE(ABORT, 'fault'); END"
    );
    assertProblem(
      await client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: registered.json.id, rememberMe: true }
      }),
      { status: 503, type: 'session-persistence-unavailable' }
    );
    clearFault(world.db, 'fault_activation_r');

    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email = ?').get(email).total,
      1
    );
    assert.ok(world.db.prepare('SELECT consumedAt FROM auth_challenges WHERE id = ?').get(sent.json.challengeId).consumedAt);
    const final = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: registered.json.id, rememberMe: true }
    });
    assertOk(final);
    assert.equal(final.json.session.persistence, 'remembered');
  });

  it('PN02 保存失败期间账户被重置或目标被撤销后不能进入', async () => {
    const account = await world.createAccount({ email: 'pn02@example.com', rememberMe: false });
    const client = world.client();
    await world.bootstrap(client);
    const login = await client.request('POST', '/api/auth/login', {
      body: { email: 'pn02@example.com', password: account.password, rememberMe: true }
    });

    const resetCode = await client.request('POST', '/api/auth/password-reset-codes', {
      body: { email: 'pn02@example.com' }
    });
    assertOk(resetCode);
    const reset = await client.request('POST', '/api/auth/password-reset', {
      body: {
        verificationCode: world.mailer.lastCode('password-reset', 'pn02@example.com'),
        password: 'new-secret-9',
        challengeId: resetCode.json.challengeId,
        email: 'pn02@example.com'
      }
    });
    assertOk(reset, 204);

    assertProblem(
      await client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: login.json.id, rememberMe: true }
      }),
      { status: 401, type: 'session-invalid' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: login.json.id, rememberMe: false }
      }),
      { status: 401, type: 'session-invalid' }
    );

    // A targeted logout of a second pending target makes later activation fail
    // while a new registration form in a new page context stays usable.
    const second = await client.request('POST', '/api/auth/login', {
      body: { email: 'pn02@example.com', password: 'new-secret-9', rememberMe: true }
    });
    assertOk(second);
    const page2 = world.client({ jar: client.jar, pageId: PAGE_2 });
    const third = await page2.request('POST', '/api/auth/login', {
      body: { email: 'pn02@example.com', password: 'new-secret-9', rememberMe: true }
    });
    assertOk(third);
    const logout = await client.request('POST', '/api/auth/logout', { body: { sessionId: second.json.id } });
    assert.equal(logout.status, 204);
    assertProblem(
      await client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: second.json.id, rememberMe: true }
      }),
      { status: 401, type: 'session-invalid' }
    );
    assert.equal(sessionInfo(world, third.json.id).revokedAt, null);
  });

  it('PN03 放弃旧目标后新页面上下文不被旧事件清除', async () => {
    const account = await world.createAccount({ email: 'pn03@example.com', rememberMe: false });
    const client = world.client();
    await world.bootstrap(client);
    const login = await client.request('POST', '/api/auth/login', {
      body: { email: 'pn03@example.com', password: account.password, rememberMe: true }
    });

    const logout = await client.request('POST', '/api/auth/logout', { body: { sessionId: login.json.id } });
    assert.equal(logout.status, 204);
    assert.equal(sessionInfo(world, login.json.id).revokedAt !== null, true);

    // New page context and container for a fresh registration form.
    const fresh = world.client();
    await world.bootstrap(fresh);
    const pending = await fresh.request('POST', '/api/auth/login', {
      body: { email: 'pn03@example.com', password: account.password, rememberMe: true }
    });
    assertOk(pending);
    assert.equal(sessionInfo(world, pending.json.id).revokedAt, null);

    // The stale revoke request is idempotent and does not touch the new target.
    const stale = await client.request('POST', '/api/auth/logout', { body: { sessionId: login.json.id } });
    assert.equal(stale.status, 204);
    assert.equal(sessionInfo(world, pending.json.id).revokedAt, null);
    assert.equal(
      world.db.prepare('SELECT sessionId FROM auth_page_bindings WHERE containerId = ? AND pageId = ?')
        .get(sessionInfo(world, pending.json.id).containerId, PAGE_1).sessionId,
      pending.json.id
    );
  });

  it('PN04 已提交的不同选择为409，同参重试不延期', async () => {
    const account = await world.createAccount({ email: 'pn04@example.com', rememberMe: true });
    const client = account.client;
    const session = sessionInfo(world, account.sessionId);

    assertProblem(
      await client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: account.sessionId, rememberMe: false }
      }),
      { status: 409, type: 'session-state-conflict' }
    );

    world.clock.advance(3600 * 1000);
    const retry = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: account.sessionId, rememberMe: true }
    });
    assertOk(retry);
    assert.equal(retry.json.session.expiresAt, session.expiresAt);
    assert.equal(retry.json.session.issuedAt, session.issuedAt);
    const maxAge = Number(/Max-Age=(\d+)/.exec(retry.setCookies[0])[1]);
    assert.ok(maxAge > 6 * 24 * 3600 && maxAge < 604800, 'remaining Max-Age should shrink, got ' + maxAge);
  });

  it('RE01 restore 存储故障可重试且不续期', async () => {
    const account = await world.createAccount({ email: 're01@example.com', rememberMe: true });
    const session = sessionInfo(world, account.sessionId);
    const page2 = world.client({ jar: account.client.jar, pageId: PAGE_2 });

    injectFault(
      world.db,
      'fault_restore',
      "BEFORE INSERT ON auth_page_bindings BEGIN SELECT RAISE(ABORT, 'fault'); END"
    );
    assertProblem(
      await page2.request('POST', '/api/auth/session', {
        body: { action: 'restore', sessionId: account.sessionId }
      }),
      { status: 503, type: 'session-store-unavailable' }
    );
    clearFault(world.db, 'fault_restore');

    const retried = await page2.request('POST', '/api/auth/session', {
      body: { action: 'restore', sessionId: account.sessionId }
    });
    assertOk(retried);
    assert.equal(retried.json.session.expiresAt, session.expiresAt);
  });

  it('RE02 到期、撤销、被替换与数据损坏的恢复结果', async () => {
    const account = await world.createAccount({ email: 're02@example.com', rememberMe: true });
    const page2 = world.client({ jar: account.client.jar, pageId: PAGE_2 });

    // A second live session keeps the container cookie after the remembered
    // target itself is revoked.
    const keeper = await page2.request('POST', '/api/auth/login', {
      body: { email: 're02@example.com', password: account.password, rememberMe: false }
    });
    assertOk(keeper);

    const logout = await account.client.request('POST', '/api/auth/logout', {
      body: { sessionId: account.sessionId }
    });
    assert.equal(logout.status, 204);
    assertProblem(
      await page2.request('POST', '/api/auth/session', {
        body: { action: 'restore', sessionId: account.sessionId }
      }),
      { status: 401, type: 'session-invalid' }
    );
    assertProblem(
      await page2.request('POST', '/api/auth/session', {
        body: { action: 'restore', sessionId: account.sessionId }
      }),
      { status: 401, type: 'session-invalid' }
    );

    // Corrupt account data is 503, not 401 and never a seeded identity.
    const corrupt = await world.createAccount({ email: 're02-corrupt@example.com', rememberMe: true });
    world.db.prepare('UPDATE auth_accounts SET nickname = NULL WHERE email = ?').run('re02-corrupt@example.com');
    const corruptPage = world.client({ jar: corrupt.client.jar, pageId: PAGE_2 });
    assertProblem(
      await corruptPage.request('POST', '/api/auth/session', {
        body: { action: 'restore', sessionId: corrupt.sessionId }
      }),
      { status: 503, type: 'account-store-unavailable' }
    );
  });
});

describe('CC-RESET / CC-ISOLATION 重置撤销与账户隔离', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  async function resetPasswordFor(client, email, newPassword) {
    const code = await client.request('POST', '/api/auth/password-reset-codes', { body: { email } });
    assertOk(code);
    const done = await client.request('POST', '/api/auth/password-reset', {
      body: {
        verificationCode: world.mailer.lastCode('password-reset', email),
        password: newPassword,
        challengeId: code.json.challengeId,
        email
      }
    });
    assertOk(done, 204);
    return done;
  }

  it('R01 重置撤销A全部旧会话且不清B，A账户键保持', async () => {
    const accountA = await world.createAccount({ email: 'r01-a@example.com', rememberMe: true, pageId: PAGE_1 });
    const deviceTwo = world.client();
    await world.bootstrap(deviceTwo);
    const pageSession = await deviceTwo.request('POST', '/api/auth/login', {
      body: { email: 'r01-a@example.com', password: accountA.password, rememberMe: false }
    });
    await deviceTwo.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: pageSession.json.id, rememberMe: false }
    });
    const pending = await deviceTwo.request('POST', '/api/auth/login', {
      body: { email: 'r01-a@example.com', password: accountA.password, rememberMe: true }
    });

    const accountB = await world.createAccount({ email: 'r01-b@example.com', rememberMe: true });
    const bCookieBefore = accountB.client.jar.header();

    const reset = await accountA.client.request('POST', '/api/auth/password-reset-codes', {
      body: { email: 'r01-a@example.com' }
    });
    assertOk(reset);
    const done = await accountA.client.request('POST', '/api/auth/password-reset', {
      body: {
        verificationCode: world.mailer.lastCode('password-reset', 'r01-a@example.com'),
        password: 'brand-new-9',
        challengeId: reset.json.challengeId,
        email: 'r01-a@example.com'
      }
    });
    assertOk(done, 204);
    assert.equal(done.text, '');
    assert.equal(done.setCookies.length, 0);

    assert.equal(await resolveFor(world, accountA.client), null);
    assert.equal(await resolveFor(world, deviceTwo), null);
    for (const id of [accountA.sessionId, pageSession.json.id, pending.json.id]) {
      assert.ok(sessionInfo(world, id).revokedAt, 'session ' + id + ' must be revoked');
    }

    assertProblem(
      await accountA.client.request('POST', '/api/auth/login', {
        body: { email: 'r01-a@example.com', password: accountA.password, rememberMe: false }
      }),
      { status: 401, type: 'credentials-rejected' }
    );
    const relogin = await accountA.client.request('POST', '/api/auth/login', {
      body: { email: 'r01-a@example.com', password: 'brand-new-9', rememberMe: false }
    });
    assertOk(relogin);
    assert.equal(relogin.json.account.accountKey, accountA.accountKey);

    assert.deepEqual(await resolveFor(world, accountB.client), { accountKey: accountB.accountKey });
    assert.equal(accountB.client.jar.header(), bCookieBefore);
    const bStatus = await accountB.client.request('GET', '/api/auth/session');
    assertOk(bStatus);
    assert.equal(bStatus.json.session.account.accountKey, accountB.accountKey);
  });

  it('IS02 无关账户的重置通知不退出另一账户', async () => {
    const accountA = await world.createAccount({ email: 'is02-a@example.com', rememberMe: false });
    const accountB = await world.createAccount({ email: 'is02-b@example.com', rememberMe: true });

    await resetPasswordFor(accountB.client, 'is02-b@example.com', 'b-new-pass-9');

    assert.deepEqual(await resolveFor(world, accountA.client), { accountKey: accountA.accountKey });
    const statusA = await accountA.client.request('GET', '/api/auth/session');
    assert.equal(statusA.json.session.state, 'active');
    assert.equal(await resolveFor(world, accountB.client), null);
  });

  it('IS03 accountKey 只来自服务器绑定的会话', async () => {
    const accountA = await world.createAccount({ email: 'is03-a@example.com', rememberMe: false });
    const accountB = await world.createAccount({ email: 'is03-b@example.com', rememberMe: false });

    assert.deepEqual(await resolveFor(world, accountA.client), { accountKey: accountA.accountKey });
    assert.deepEqual(await resolveFor(world, accountB.client), { accountKey: accountB.accountKey });

    const forged = await world.module.resolvePrincipal({
      headers: {
        cookie: accountA.client.jar.header(),
        'x-teachbuddy-page': accountA.client.pageId,
        'x-teachbuddy-account-key': accountB.accountKey,
        authorization: 'Bearer ' + accountB.accountKey
      }
    });
    assert.deepEqual(forged, { accountKey: accountA.accountKey });
  });
});

describe('CC-CLOSED 注册关闭', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('CL01 关闭只阻止新注册与注册发码，重开后同码可用', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const email = 'cl01@example.com';
    const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    assertOk(sent);
    const code = world.mailer.lastCode('registration', email);

    world.registrationOpen = false;
    const status = await client.request('GET', '/api/auth/session');
    assert.equal(status.json.registrationOpen, false);
    assertProblem(await client.request('POST', '/api/auth/registration-codes', { body: { email: 'cl01-new@example.com' } }), {
      status: 403,
      type: 'registration-closed'
    });
    assertProblem(
      await client.request('POST', '/api/auth/register', {
        body: {
          email,
          nickname: 'CL01',
          password: 'secret-9',
          challengeId: sent.json.challengeId,
          verificationCode: code,
          termsAccepted: true,
          rememberMe: false
        }
      }),
      { status: 403, type: 'registration-closed' }
    );
    assert.equal(
      world.db.prepare('SELECT consumedAt FROM auth_challenges WHERE id = ?').get(sent.json.challengeId).consumedAt,
      null
    );
    assert.equal(world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email = ?').get(email).total, 0);

    world.registrationOpen = true;
    const registered = await client.request('POST', '/api/auth/register', {
      body: {
        email,
        nickname: 'CL01',
        password: 'secret-9',
        challengeId: sent.json.challengeId,
        verificationCode: code,
        termsAccepted: true,
        rememberMe: false
      }
    });
    assertOk(registered, 201);
  });

  it('CL01 发码等待期间关闭注册不激活挑战', async () => {
    const client = world.client();
    const email = 'cl01-race@example.com';
    world.mailer.pauseNext();
    const pending = client.request('POST', '/api/auth/registration-codes', { body: { email } });
    await nextTick();
    world.registrationOpen = false;
    world.mailer.release();
    assertProblem(await pending, { status: 403, type: 'registration-closed' });
    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_challenges WHERE email = ?').get(email).total,
      0
    );
    world.registrationOpen = true;
  });

  it('CL02 关闭后既有账户登录、找回、重置正常，已创建账户保留', async () => {
    const account = await world.createAccount({ email: 'cl02@example.com', rememberMe: false });
    world.registrationOpen = false;
    try {
      const client = world.client();
      await world.bootstrap(client);
      const login = await client.request('POST', '/api/auth/login', {
        body: { email: 'cl02@example.com', password: account.password, rememberMe: false }
      });
      assertOk(login);

      const reset = await client.request('POST', '/api/auth/password-reset-codes', {
        body: { email: 'cl02@example.com' }
      });
      assertOk(reset);
      const done = await client.request('POST', '/api/auth/password-reset', {
        body: {
          verificationCode: world.mailer.lastCode('password-reset', 'cl02@example.com'),
          password: 'closed-new-9',
          challengeId: reset.json.challengeId,
          email: 'cl02@example.com'
        }
      });
      assertOk(done, 204);
      assert.equal(
        world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email = ?').get('cl02@example.com')
          .total,
        1
      );
    } finally {
      world.registrationOpen = true;
    }
  });
});

describe('CC-LOGOUT 退出交换', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('O01 定向撤销、重复、无会话与外容器id均安全', async () => {
    const account = await world.createAccount({ email: 'o01@example.com', rememberMe: false });
    const client = account.client;

    const page2 = world.client({ jar: client.jar, pageId: PAGE_2 });
    const secondLogin = await page2.request('POST', '/api/auth/login', {
      body: { email: 'o01@example.com', password: account.password, rememberMe: true }
    });
    const secondActivate = await page2.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: secondLogin.json.id, rememberMe: true }
    });
    assertOk(secondActivate);

    const logoutFirst = await client.request('POST', '/api/auth/logout', {
      body: { sessionId: account.sessionId }
    });
    assert.equal(logoutFirst.status, 204);
    assert.equal(logoutFirst.text, '');
    assert.equal(logoutFirst.setCookies.length, 0);
    assert.ok(sessionInfo(world, account.sessionId).revokedAt);
    assert.equal(await resolveFor(world, client), null);
    assert.deepEqual(await resolveFor(world, page2), { accountKey: account.accountKey });

    const repeat = await client.request('POST', '/api/auth/logout', { body: { sessionId: account.sessionId } });
    assert.equal(repeat.status, 204);

    const nullTarget = await client.request('POST', '/api/auth/logout', { body: { sessionId: null } });
    assert.equal(nullTarget.status, 204);
    assert.deepEqual(await resolveFor(world, page2), { accountKey: account.accountKey });

    const otherAccount = await world.createAccount({ email: 'o01-other@example.com', rememberMe: true });
    const foreign = await client.request('POST', '/api/auth/logout', {
      body: { sessionId: otherAccount.sessionId }
    });
    assert.equal(foreign.status, 204);
    assert.equal(sessionInfo(world, otherAccount.sessionId).revokedAt, null);
    assert.deepEqual(await resolveFor(world, otherAccount.client), { accountKey: otherAccount.accountKey });

    const logoutLast = await page2.request('POST', '/api/auth/logout', {
      body: { sessionId: secondLogin.json.id }
    });
    assert.equal(logoutLast.status, 204);
    assert.equal(logoutLast.setCookies.length, 1);
    assert.match(logoutLast.setCookies[0], /Max-Age=0/);
    assert.match(logoutLast.setCookies[0], /^__Host-teachbuddy_session=;/);
    assert.equal(client.jar.get('__Host-teachbuddy_session'), null);
  });

  it('O01 无 Cookie 退出仍返回204与清除头', async () => {
    const client = world.client();
    const response = await client.request('POST', '/api/auth/logout', {
      body: { sessionId: null },
      cookie: 'none'
    });
    assert.equal(response.status, 204);
    assert.equal(response.setCookies.length, 1);
    assert.match(response.setCookies[0], /Max-Age=0/);
  });

  it('O02 撤销写入失败回滚为503，重试成功且旧请求不影响新会话', async () => {
    const account = await world.createAccount({ email: 'o02@example.com', rememberMe: false });
    const client = account.client;

    injectFault(
      world.db,
      'fault_revoke',
      "BEFORE UPDATE OF revokedAt ON auth_sessions BEGIN SELECT RAISE(ABORT, 'fault'); END"
    );
    assertProblem(
      await client.request('POST', '/api/auth/logout', { body: { sessionId: account.sessionId } }),
      { status: 503, type: 'session-store-unavailable' }
    );
    clearFault(world.db, 'fault_revoke');
    assert.equal(sessionInfo(world, account.sessionId).revokedAt, null);
    assert.deepEqual(await resolveFor(world, client), { accountKey: account.accountKey });

    const retried = await client.request('POST', '/api/auth/logout', { body: { sessionId: account.sessionId } });
    assert.equal(retried.status, 204);

    await world.bootstrap(client);
    const relogin = await client.request('POST', '/api/auth/login', {
      body: { email: 'o02@example.com', password: account.password, rememberMe: false }
    });
    assertOk(relogin);
    const reactivated = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: relogin.json.id, rememberMe: false }
    });
    assertOk(reactivated);

    const stale = await client.request('POST', '/api/auth/logout', { body: { sessionId: account.sessionId } });
    assert.equal(stale.status, 204);
    assert.equal(sessionInfo(world, relogin.json.id).revokedAt, null);
    assert.deepEqual(await resolveFor(world, client), { accountKey: account.accountKey });
  });

  it('O03 退出后刷新无旧身份，重新登录可恢复业务', async () => {
    const account = await world.createAccount({ email: 'o03@example.com', rememberMe: true });
    const client = account.client;
    const logout = await client.request('POST', '/api/auth/logout', { body: { sessionId: account.sessionId } });
    assert.equal(logout.status, 204);

    const afterRefresh = await client.request('GET', '/api/auth/session');
    assertOk(afterRefresh);
    assert.equal(afterRefresh.json.session, null);
    assert.equal(afterRefresh.json.rememberedSession, null);

    const relogin = await world.login(world.client(), {
      email: 'o03@example.com',
      password: account.password,
      rememberMe: false
    });
    assert.equal(relogin.session.account.accountKey, account.accountKey);

    // The revoked target cannot be re-activated: the old browser lost its
    // container with the final logout, and a fresh container rejects the target.
    assertProblem(
      await client.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: account.sessionId, rememberMe: true }
      }),
      { status: 409, type: 'browser-context-required' }
    );
    const freshClient = world.client();
    await world.bootstrap(freshClient);
    assertProblem(
      await freshClient.request('POST', '/api/auth/session', {
        body: { action: 'activate', sessionId: account.sessionId, rememberMe: true }
      }),
      { status: 401, type: 'session-invalid' }
    );
  });
});
