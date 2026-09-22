// CC-HAPPY / CC-INPUT / CC-BOUNDARY / CC-SEND / CC-CODE / CC-LOGIN-FAIL
// against real HTTP, isolated SQLite, controllable clock and fake mail.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_1,
  assertOk,
  assertProblem,
  count,
  createWorld
} from './fixtures/auth-contract/harness.js';
import { hashVerificationCode } from '../src/features/auth/passwords.js';
import { hashSessionToken } from '../src/features/auth/protocol.js';

const TEST_CODE_SECRET = 'contract-test-code-secret';

function timestamp(world, offsetMs = 0) {
  return new Date(world.clock.now() + offsetMs).toISOString();
}

function seedChallenge(world, { purpose = 'registration', email, code = '001234', attempts = 5, issuedAtMs } = {}) {
  const issuedAt = issuedAtMs ?? world.clock.now();
  const iso = new Date(issuedAt).toISOString();
  const id = 'chl_seed_' + Math.random().toString(36).slice(2, 12);
  world.db
    .prepare(
      'INSERT INTO auth_challenges (id, purpose, email, codeDigest, issuedAt, expiresAt, resendAt, remainingAttempts, consumedAt, replacedAt, createdAt, updatedAt) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)'
    )
    .run(
      id,
      purpose,
      email,
      hashVerificationCode(code, TEST_CODE_SECRET),
      iso,
      new Date(issuedAt + 600000).toISOString(),
      new Date(issuedAt + 30000).toISOString(),
      attempts,
      iso,
      iso
    );
  return { challengeId: id, code };
}

function sendCode(client, email, options = {}) {
  return client.request('POST', '/api/auth/registration-codes', { body: { email }, ...options });
}

function inspectCookie(setCookie) {
  const parts = setCookie.split(';').map((part) => part.trim());
  return {
    raw: setCookie,
    nameValue: parts[0],
    attributes: parts.slice(1),
    hasAttribute(prefix) {
      return parts.slice(1).some((part) => part.toLowerCase().startsWith(prefix.toLowerCase()));
    }
  };
}

describe('CC-HAPPY 账户、注册与服务失败', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('H01 空容器匿名、bootstrap 建立 Cookie、GET 确认真实携带', async () => {
    const client = world.client();
    const anonymous = await client.request('GET', '/api/auth/session');
    assertOk(anonymous);
    assert.equal(anonymous.json.browserReady, false);
    assert.equal(anonymous.json.registrationOpen, true);
    assert.equal(anonymous.json.session, null);
    assert.equal(anonymous.json.rememberedSession, null);
    assert.equal(Number.isNaN(Date.parse(anonymous.json.serverTime)), false);
    assert.equal(anonymous.setCookies.length, 0);

    const boot = await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    assertOk(boot);
    assert.equal(boot.json.browserReady, true);
    assert.equal(boot.json.session, null);
    assert.equal(boot.setCookies.length, 1);
    const cookie = inspectCookie(boot.setCookies[0]);
    assert.match(cookie.nameValue, /^__Host-teachbuddy_session=[A-Za-z0-9_-]+$/);
    assert.equal(cookie.hasAttribute('Path=/'), true);
    assert.equal(cookie.hasAttribute('HttpOnly'), true);
    assert.equal(cookie.hasAttribute('Secure'), true);
    assert.equal(cookie.hasAttribute('SameSite=Lax'), true);
    assert.equal(cookie.hasAttribute('Domain'), false);
    assert.equal(/max-age|expires/i.test(cookie.raw), false);

    const confirmed = await client.request('GET', '/api/auth/session');
    assertOk(confirmed);
    assert.equal(confirmed.json.browserReady, true);
    assert.equal(confirmed.json.session, null);

    // Only a digest of the browser token may exist at rest.
    const token = cookie.nameValue.split('=')[1];
    assert.equal(world.db.prepare('SELECT COUNT(*) AS total FROM auth_containers WHERE id = ?').get(token).total, 0);
    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_containers WHERE id = ?').get(hashSessionToken(token)).total,
      1
    );
    assert.equal(
      await world.module.resolvePrincipal({
        headers: { cookie: client.jar.header(), 'x-teachbuddy-page': PAGE_1 }
      }),
      null
    );
  });

  it('H02 登录创建 pending 不授权，activate 后才得到固定 accountKey', async () => {
    const account = await world.createAccount({ email: 'h02@example.com', rememberMe: false });
    const client = world.client();
    await world.bootstrap(client);

    const login = await client.request('POST', '/api/auth/login', {
      body: { email: 'h02@example.com', password: account.password, rememberMe: true }
    });
    assertOk(login);
    assert.equal(login.json.state, 'pending');
    assert.equal(login.json.account.accountKey, account.accountKey);
    assert.equal(login.setCookies.length, 0);
    assert.equal(login.json.expiresAt, timestamp(world, 7 * 24 * 3600 * 1000));

    const beforeActivate = await client.request('GET', '/api/auth/session');
    assertOk(beforeActivate);
    assert.equal(beforeActivate.json.session.state, 'pending');
    assert.equal(
      await world.module.resolvePrincipal({
        headers: { cookie: client.jar.header(), 'x-teachbuddy-page': PAGE_1 }
      }),
      null
    );

    const activate = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId: login.json.id, rememberMe: true }
    });
    assertOk(activate);
    assert.equal(activate.json.session.state, 'active');
    assert.equal(activate.json.session.persistence, 'remembered');
    assert.equal(activate.json.session.account.accountKey, account.accountKey);
    const cookie = inspectCookie(activate.setCookies[0]);
    const maxAge = /Max-Age=(\d+)/.exec(cookie.raw);
    assert.ok(Number(maxAge[1]) > 0 && Number(maxAge[1]) <= 604800);

    const after = await client.request('GET', '/api/auth/session');
    assert.equal(after.json.session.state, 'active');
    assert.deepEqual(
      await world.module.resolvePrincipal({
        headers: { cookie: client.jar.header(), 'x-teachbuddy-page': PAGE_1 }
      }),
      { accountKey: account.accountKey }
    );
  });

  it('H03 注册原子提交，重启后同账户键可登录', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const email = 'h03@example.com';
    const sent = await sendCode(client, email);
    assertOk(sent);
    const code = world.mailer.lastCode('registration', email);

    const registered = await client.request('POST', '/api/auth/register', {
      body: {
        email,
        nickname: '  林老师  ',
        password: 'secret-9',
        challengeId: sent.json.challengeId,
        verificationCode: code,
        termsAccepted: true,
        rememberMe: true
      }
    });
    assertOk(registered, 201);
    assert.equal(registered.json.state, 'pending');
    assert.equal(registered.json.account.nickname, '林老师');
    assert.equal(registered.json.account.email, email);

    const challengeRow = world.db.prepare('SELECT * FROM auth_challenges WHERE id = ?').get(sent.json.challengeId);
    assert.ok(challengeRow.consumedAt);
    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email = ?').get(email).total,
      1
    );
    const sessionRow = world.db.prepare('SELECT * FROM auth_sessions WHERE id = ?').get(registered.json.id);
    assert.equal(sessionRow.state, 'pending');

    await world.restart();
    const client2 = world.client();
    await world.bootstrap(client2);
    const relogin = await client2.request('POST', '/api/auth/login', {
      body: { email, password: 'secret-9', rememberMe: false }
    });
    assertOk(relogin);
    assert.equal(relogin.json.account.accountKey, registered.json.account.accountKey);
    assert.equal(relogin.json.account.nickname, '林老师');
  });

  it('H04 昵称按 code point 保存完整值，不从邮箱派生', async () => {
    const nickname = '😀'.repeat(20) + '林'.repeat(20);
    assert.equal([...nickname].length, 40);
    const account = await world.createAccount({ email: 'h04@example.com', nickname });
    assert.equal(account.nickname, nickname);

    const client = world.client();
    await world.bootstrap(client);
    const login = await client.request('POST', '/api/auth/login', {
      body: { email: 'h04@example.com', password: account.password, rememberMe: false }
    });
    assertOk(login);
    assert.equal(login.json.account.nickname, nickname);
    assert.notEqual(login.json.account.nickname, 'h04');
    assert.equal([...login.json.account.nickname].length, 40);
  });
});

describe('CC-INPUT / CC-BOUNDARY 精确输入', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('IN01 各操作独立拒绝非法字段且无账户/预算副作用', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const challengesBefore = count(world, 'auth_challenges');

    assertProblem(await sendCode(client, '   '), { status: 422, type: 'email-empty', field: 'email' });
    assertProblem(await sendCode(client, 'not-an-email'), {
      status: 422,
      type: 'email-invalid-format',
      field: 'email'
    });

    const base = {
      email: 'in01@example.com',
      nickname: 'n',
      password: '12345678',
      challengeId: 'chl_shape_ok',
      verificationCode: '123456',
      termsAccepted: true,
      rememberMe: false
    };
    assertProblem(await client.request('POST', '/api/auth/register', { body: { ...base, nickname: '   ' } }), {
      status: 422,
      type: 'nickname-empty',
      field: 'nickname'
    });
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...base, nickname: '😀'.repeat(41) } }),
      { status: 422, type: 'nickname-too-long', field: 'nickname' }
    );
    assertProblem(await client.request('POST', '/api/auth/register', { body: { ...base, password: '1234567' } }), {
      status: 422,
      type: 'password-too-short',
      field: 'password'
    });
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...base, password: 'a'.repeat(129) } }),
      { status: 422, type: 'password-too-long', field: 'password' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/register', {
        body: { ...base, verificationCode: 'abc123' }
      }),
      { status: 422, type: 'verification-code-invalid-format', field: 'verificationCode' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...base, termsAccepted: false } }),
      { status: 422, type: 'terms-not-accepted', field: 'termsAccepted' }
    );

    assert.equal(count(world, 'auth_challenges'), challengesBefore);
    assert.equal(count(world, 'auth_accounts'), 0);
  });

  it('IN02 缺 challengeId、空字符串与未知 id 各自定位', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const body = {
      email: 'in02@example.com',
      nickname: 'n',
      password: '12345678',
      verificationCode: '123456',
      termsAccepted: true,
      rememberMe: false
    };
    assertProblem(await client.request('POST', '/api/auth/register', { body }), {
      status: 422,
      type: 'required-field',
      field: 'challengeId'
    });
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...body, challengeId: '' } }),
      { status: 422, type: 'verification-code-missing', field: 'verificationCode' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...body, challengeId: 'chl_unknown_but_valid' } }),
      { status: 422, type: 'verification-code-missing', field: 'verificationCode' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...body, challengeId: 'bad id!' } }),
      { status: 422, type: 'invalid-field-value', field: 'challengeId' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...body, challengeId: 'chl_unknown\n' } }),
      { status: 422, type: 'invalid-field-value', field: 'challengeId' }
    );
  });

  it('B01 邮箱规范化与边界', async () => {
    const client = world.client();
    const canonical = await sendCode(client, ' Teacher@Example.COM ');
    assertOk(canonical);
    assert.equal(canonical.json.email, 'teacher@example.com');

    const local64 = 'a'.repeat(64) + '@example.com';
    const domain63 = 'a@' + 'b'.repeat(63) + '.com';
    const email254 = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(57) + '.com';
    assert.equal([...email254].length, 254);
    assertOk(await sendCode(client, local64));
    assertOk(await sendCode(client, domain63));
    assertOk(await sendCode(client, email254));
    assertOk(await sendCode(client, 'user@no-such-host.invalid'));

    const rejected = [
      'b'.repeat(65) + '@example.com',
      'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(58) + '.com',
      'a@' + 'b'.repeat(64) + '.com',
      'a..b@example.com',
      '.a@example.com',
      'a.@example.com',
      'a@example',
      'a@-example.com',
      'a@example-.com',
      'a@example..com',
      'ünï@example.com',
      'a@exa mple.com'
    ];
    for (const email of rejected) {
      assertProblem(await sendCode(client, email), { status: 422, type: 'email-invalid-format', field: 'email' });
    }

    const account = await world.createAccount({ email: 'Boundary@Example.com', nickname: 'Boundary' });
    assert.equal(account.email, 'boundary@example.com');
    assertProblem(await sendCode(client, ' boundary@EXAMPLE.com '), {
      status: 409,
      type: 'email-already-registered',
      field: 'email'
    });
  });

  it('B02 昵称 trim、40/41 code points 与全空白', async () => {
    const forty = '😀'.repeat(40);
    const account = await world.createAccount({ email: 'b02@example.com', nickname: '  ' + forty + '  ' });
    assert.equal(account.nickname, forty);

    const client = world.client();
    await world.bootstrap(client);
    const base = {
      email: 'b02-b@example.com',
      password: '12345678',
      challengeId: 'chl_seed_b02',
      verificationCode: '123456',
      termsAccepted: true,
      rememberMe: false
    };
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...base, nickname: '😀'.repeat(41) } }),
      { status: 422, type: 'nickname-too-long', field: 'nickname' }
    );
    assertProblem(
      await client.request('POST', '/api/auth/register', { body: { ...base, nickname: ' \t\n ' } }),
      { status: 422, type: 'nickname-empty', field: 'nickname' }
    );
  });

  it('B03 密码按原始字符串处理，不 trim/不归一化', async () => {
    const account = await world.createAccount({
      email: 'b03@example.com',
      password: ' TeAcH😀9x ',
      rememberMe: false
    });
    const client = world.client();
    await world.bootstrap(client);
    const login = (password) =>
      client.request('POST', '/api/auth/login', { body: { email: 'b03@example.com', password, rememberMe: false } });

    assertOk(await login(' TeAcH😀9x '));
    assertProblem(await login('TeAcH😀9x'), { status: 401, type: 'credentials-rejected' });
    assertProblem(await login(' teach😀9x '), { status: 401, type: 'credentials-rejected' });

    const decomposed = 'e\u0301'.repeat(8);
    const composed = 'é'.repeat(8);
    assert.equal([...decomposed].length, 16);
    assert.equal([...composed].length, 8);
    await world.createAccount({ email: 'b03b@example.com', password: decomposed, rememberMe: false });
    const client2 = world.client();
    await world.bootstrap(client2);
    assertProblem(
      await client2.request('POST', '/api/auth/login', {
        body: { email: 'b03b@example.com', password: composed, rememberMe: false }
      }),
      { status: 401, type: 'credentials-rejected' }
    );
    assertOk(
      await client2.request('POST', '/api/auth/login', {
        body: { email: 'b03b@example.com', password: decomposed, rememberMe: false }
      })
    );
  });

  it('B04 验证码是六位字符串，前导零保留且不隐式转数', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const seeded = seedChallenge(world, { email: 'b04@example.com', code: '001234' });
    const registerBody = (verificationCode) => ({
      email: 'b04@example.com',
      nickname: 'B04',
      password: '12345678',
      challengeId: seeded.challengeId,
      verificationCode,
      termsAccepted: true,
      rememberMe: false
    });

    assertProblem(await client.request('POST', '/api/auth/register', { body: registerBody('12345') }), {
      status: 422,
      type: 'verification-code-invalid-format',
      field: 'verificationCode'
    });
    assertProblem(await client.request('POST', '/api/auth/register', { body: registerBody('1234567') }), {
      status: 422,
      type: 'verification-code-invalid-format',
      field: 'verificationCode'
    });
    assertProblem(await client.request('POST', '/api/auth/register', { body: registerBody('１２３４５６') }), {
      status: 422,
      type: 'verification-code-invalid-format',
      field: 'verificationCode'
    });
    assertProblem(await client.request('POST', '/api/auth/register', { body: registerBody('123456\n') }), {
      status: 422,
      type: 'verification-code-invalid-format',
      field: 'verificationCode'
    });
    assertProblem(await client.request('POST', '/api/auth/register', { body: registerBody(123456) }), {
      status: 422,
      type: 'invalid-field-type',
      field: 'verificationCode'
    });
    assert.equal(
      world.db.prepare('SELECT remainingAttempts FROM auth_challenges WHERE id = ?').get(seeded.challengeId)
        .remainingAttempts,
      5
    );

    const registered = await client.request('POST', '/api/auth/register', {
      body: registerBody(seeded.code)
    });
    assertOk(registered, 201);
  });

  it('B05 验证码形状与条款先于值判断', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const seeded = seedChallenge(world, { email: 'b05@example.com', code: '654321' });
    const body = (verificationCode, termsAccepted) => ({
      email: 'b05@example.com',
      nickname: 'B05',
      password: '12345678',
      challengeId: seeded.challengeId,
      verificationCode,
      termsAccepted,
      rememberMe: false
    });

    assertProblem(await client.request('POST', '/api/auth/register', { body: body('12', false) }), {
      status: 422,
      type: 'verification-code-invalid-format',
      field: 'verificationCode'
    });
    assertProblem(await client.request('POST', '/api/auth/register', { body: body('111111', false) }), {
      status: 422,
      type: 'terms-not-accepted',
      field: 'termsAccepted'
    });
    assert.equal(
      world.db.prepare('SELECT remainingAttempts FROM auth_challenges WHERE id = ?').get(seeded.challengeId)
        .remainingAttempts,
      5
    );

    assertProblem(await client.request('POST', '/api/auth/register', { body: body('111111', true) }), {
      status: 422,
      type: 'verification-code-incorrect',
      field: 'verificationCode',
      extra: { remainingAttempts: 4 }
    });
  });

  it('L01 不存在邮箱与错误密码使用同一拒绝', async () => {
    const account = await world.createAccount({ email: 'l01@example.com', rememberMe: false });
    const client = world.client();
    await world.bootstrap(client);
    const sessionsBefore = count(world, 'auth_sessions');

    const unknown = await client.request('POST', '/api/auth/login', {
      body: { email: 'nobody@example.com', password: 'whatever-8', rememberMe: false }
    });
    const wrong = await client.request('POST', '/api/auth/login', {
      body: { email: 'l01@example.com', password: 'wrong-pass', rememberMe: false }
    });
    assertProblem(unknown, { status: 401, type: 'credentials-rejected' });
    assertProblem(wrong, { status: 401, type: 'credentials-rejected' });
    assert.deepEqual(Object.keys(unknown.json).sort(), Object.keys(wrong.json).sort());
    assert.equal(count(world, 'auth_sessions'), sessionsBefore);
    assert.equal(account.accountKey.length > 0, true);
  });
});

describe('CC-SEND / CC-CODE 发码与验证码生命周期', () => {
  let world;
  before(async () => {
    world = await createWorld();
  });
  after(async () => {
    await world.stop();
  });

  it('S01 注册占用与找回未注册按各自入口披露，均不投递', async () => {
    const account = await world.createAccount({ email: 's01@example.com' });
    const client = world.client();
    const delivered = world.mailer.deliveredCount('registration', account.email);

    assertProblem(await sendCode(client, account.email), {
      status: 409,
      type: 'email-already-registered',
      field: 'email'
    });
    assert.equal(world.mailer.deliveredCount('registration', account.email), delivered);

    assertProblem(
      await client.request('POST', '/api/auth/password-reset-codes', {
        body: { email: 'unknown-s01@example.com' }
      }),
      { status: 422, type: 'email-not-registered', field: 'email' }
    );
    const recovered = await client.request('POST', '/api/auth/password-reset-codes', {
      body: { email: ' S01@Example.com ' }
    });
    assertOk(recovered);
    assert.equal(recovered.json.email, 's01@example.com');
    assert.equal(recovered.json.purpose, 'password-reset');
  });

  it('S02 冷却拒绝不换码，重发成功替换旧挑战，并发只投递一次', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const email = 's02@example.com';
    const first = await sendCode(client, email);
    assertOk(first);
    assert.equal(first.json.resendAt, timestamp(world, 30000));
    assert.equal(first.json.expiresAt, timestamp(world, 600000));
    const firstCode = world.mailer.lastCode('registration', email);

    world.clock.advance(10000);
    const cooling = await sendCode(client, email);
    assertProblem(cooling, {
      status: 429,
      type: 'code-send-cooldown',
      extra: { retryAfterSeconds: 20, resendAt: first.json.resendAt }
    });
    assert.equal(cooling.headers['retry-after'], '20');
    assert.equal(world.mailer.deliveredCount('registration', email), 1);

    world.clock.advance(20000);
    const second = await sendCode(client, email);
    assertOk(second);
    assert.notEqual(second.json.challengeId, first.json.challengeId);
    const secondCode = world.mailer.lastCode('registration', email);
    assert.notEqual(secondCode, null);

    assertProblem(
      await client.request('POST', '/api/auth/register', {
        body: {
          email,
          nickname: 'S02',
          password: '12345678',
          challengeId: first.json.challengeId,
          verificationCode: firstCode,
          termsAccepted: true,
          rememberMe: false
        }
      }),
      { status: 422, type: 'verification-code-replaced', field: 'verificationCode' }
    );

    const concurrentEmail = 's02-concurrent@example.com';
    const [left, right] = await Promise.all([sendCode(client, concurrentEmail), sendCode(client, concurrentEmail)]);
    assert.deepEqual([left.status, right.status].sort(), [200, 429]);
    assert.equal(world.mailer.deliveredCount('registration', concurrentEmail), 1);
  });

  it('S03 投递失败不激活新码、不改变旧码与冷却', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const email = 's03@example.com';
    world.mailer.failNext(1);
    assertProblem(await sendCode(client, email), { status: 503, type: 'code-delivery-unavailable' });
    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_challenges WHERE email = ?').get(email).total,
      0
    );

    const first = await sendCode(client, email);
    assertOk(first);
    const firstCode = world.mailer.lastCode('registration', email);

    world.clock.advance(30000);
    world.mailer.failNext(1);
    assertProblem(await sendCode(client, email), { status: 503, type: 'code-delivery-unavailable' });
    const row = world.db.prepare('SELECT * FROM auth_challenges WHERE id = ?').get(first.json.challengeId);
    assert.equal(row.replacedAt, null);
    assert.equal(row.consumedAt, null);
    assert.equal(row.resendAt, first.json.resendAt);

    const registered = await client.request('POST', '/api/auth/register', {
      body: {
        email,
        nickname: 'S03',
        password: '12345678',
        challengeId: first.json.challengeId,
        verificationCode: firstCode,
        termsAccepted: true,
        rememberMe: false
      }
    });
    assertOk(registered, 201);
  });

  it('S04 成功发码只承诺提供者接受，响应与存储都不含验证码', async () => {
    const client = world.client();
    const email = 's04@example.com';
    const response = await sendCode(client, email);
    assertOk(response);
    const code = world.mailer.lastCode('registration', email);
    assert.equal(response.text.includes(code), false);
    assert.equal(JSON.stringify(response.json).includes(code), false);
    const row = world.db.prepare('SELECT * FROM auth_challenges WHERE id = ?').get(response.json.challengeId);
    assert.equal(row.codeDigest.includes(code), false);
    assert.notEqual(row.codeDigest, code);
    assert.equal(response.json.remainingAttempts, 5);
    assert.equal(response.json.serverTime, response.json.issuedAt);
  });

  it('C01 前四次错码剩余4..1，第五次耗尽且正确码也被拒绝', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const seeded = seedChallenge(world, { email: 'c01@example.com', code: '001234' });
    const attempt = (verificationCode) =>
      client.request('POST', '/api/auth/register', {
        body: {
          email: 'c01@example.com',
          nickname: 'C01',
          password: '12345678',
          challengeId: seeded.challengeId,
          verificationCode,
          termsAccepted: true,
          rememberMe: false
        }
      });

    for (const remaining of [4, 3, 2, 1]) {
      assertProblem(await attempt('999999'), {
        status: 422,
        type: 'verification-code-incorrect',
        field: 'verificationCode',
        extra: { remainingAttempts: remaining }
      });
      assert.equal(
        world.db.prepare('SELECT remainingAttempts FROM auth_challenges WHERE id = ?').get(seeded.challengeId)
          .remainingAttempts,
        remaining
      );
    }
    assertProblem(await attempt('999999'), {
      status: 422,
      type: 'verification-code-exhausted',
      field: 'verificationCode',
      extra: { remainingAttempts: 0 }
    });
    assertProblem(await attempt('999999'), {
      status: 422,
      type: 'verification-code-exhausted',
      extra: { remainingAttempts: 0 }
    });
    assertProblem(await attempt(seeded.code), {
      status: 422,
      type: 'verification-code-exhausted',
      extra: { remainingAttempts: 0 }
    });
    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email = ?').get('c01@example.com').total,
      0
    );
  });

  it('C01 错码预算跨进程重启不重置', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const seeded = seedChallenge(world, { email: 'c01-restart@example.com', code: '001234' });
    const attempt = (verificationCode) =>
      client.request('POST', '/api/auth/register', {
        body: {
          email: 'c01-restart@example.com',
          nickname: 'C01R',
          password: '12345678',
          challengeId: seeded.challengeId,
          verificationCode,
          termsAccepted: true,
          rememberMe: false
        }
      });
    assertProblem(await attempt('999999'), { status: 422, type: 'verification-code-incorrect', extra: { remainingAttempts: 4 } });
    assertProblem(await attempt('999999'), { status: 422, type: 'verification-code-incorrect', extra: { remainingAttempts: 3 } });

    await world.restart();

    const client2 = world.client();
    await world.bootstrap(client2);
    assertProblem(
      await client2.request('POST', '/api/auth/register', {
        body: {
          email: 'c01-restart@example.com',
          nickname: 'C01R',
          password: '12345678',
          challengeId: seeded.challengeId,
          verificationCode: '999999',
          termsAccepted: true,
          rememberMe: false
        }
      }),
      { status: 422, type: 'verification-code-incorrect', extra: { remainingAttempts: 2 } }
    );
  });

  it('C02 到期、替换与新id旧值语义', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const email = 'c02@example.com';
    const first = await sendCode(client, email);
    assertOk(first);
    const firstCode = world.mailer.lastCode('registration', email);

    world.clock.set(new Date(Date.parse(first.json.expiresAt)).toISOString());
    assertProblem(
      await client.request('POST', '/api/auth/register', {
        body: {
          email,
          nickname: 'C02',
          password: '12345678',
          challengeId: first.json.challengeId,
          verificationCode: firstCode,
          termsAccepted: true,
          rememberMe: false
        }
      }),
      { status: 422, type: 'verification-code-expired', field: 'verificationCode' }
    );

    world.clock.set(new Date(Date.parse(first.json.issuedAt) + 30000).toISOString());
    const second = await sendCode(client, email);
    assertOk(second);
    assertProblem(
      await client.request('POST', '/api/auth/register', {
        body: {
          email,
          nickname: 'C02',
          password: '12345678',
          challengeId: first.json.challengeId,
          verificationCode: firstCode,
          termsAccepted: true,
          rememberMe: false
        }
      }),
      { status: 422, type: 'verification-code-replaced', field: 'verificationCode' }
    );

    assertProblem(
      await client.request('POST', '/api/auth/register', {
        body: {
          email,
          nickname: 'C02',
          password: '12345678',
          challengeId: second.json.challengeId,
          verificationCode: firstCode,
          termsAccepted: true,
          rememberMe: false
        }
      }),
      { status: 422, type: 'verification-code-incorrect', extra: { remainingAttempts: 4 } }
    );
  });

  it('C03 绑定错误不扣预算，原用途仍可成功', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const emailOne = 'c03-a@example.com';
    const sent = await sendCode(client, emailOne);
    assertOk(sent);
    const code = world.mailer.lastCode('registration', emailOne);

    const resetAttempt = await client.request('POST', '/api/auth/password-reset', {
      body: { verificationCode: code, password: 'new-pass-9', challengeId: sent.json.challengeId, email: emailOne }
    });
    assertProblem(resetAttempt, {
      status: 422,
      type: 'verification-code-binding-mismatch',
      field: 'verificationCode'
    });

    const wrongEmail = await client.request('POST', '/api/auth/register', {
      body: {
        email: 'c03-b@example.com',
        nickname: 'C03',
        password: '12345678',
        challengeId: sent.json.challengeId,
        verificationCode: code,
        termsAccepted: true,
        rememberMe: false
      }
    });
    assertProblem(wrongEmail, {
      status: 422,
      type: 'verification-code-binding-mismatch',
      field: 'verificationCode'
    });
    assert.equal(
      world.db.prepare('SELECT remainingAttempts FROM auth_challenges WHERE id = ?').get(sent.json.challengeId)
        .remainingAttempts,
      5
    );

    const original = await client.request('POST', '/api/auth/register', {
      body: {
        email: emailOne,
        nickname: 'C03',
        password: '12345678',
        challengeId: sent.json.challengeId,
        verificationCode: code,
        termsAccepted: true,
        rememberMe: false
      }
    });
    assertOk(original, 201);
  });

  it('C04 挑战只消费一次，并发正确提交只有一个成功', async () => {
    const client = world.client();
    await world.bootstrap(client);
    const email = 'c04@example.com';
    const sent = await sendCode(client, email);
    const code = world.mailer.lastCode('registration', email);
    const body = {
      email,
      nickname: 'C04',
      password: '12345678',
      challengeId: sent.json.challengeId,
      verificationCode: code,
      termsAccepted: true,
      rememberMe: false
    };

    const [left, right] = await Promise.all([
      client.request('POST', '/api/auth/register', { body }),
      client.request('POST', '/api/auth/register', { body })
    ]);
    assert.deepEqual([left.status, right.status].sort(), [201, 422]);
    const failure = left.status === 422 ? left : right;
    assertProblem(failure, { status: 422, type: 'verification-code-consumed', field: 'verificationCode' });
    assert.equal(
      world.db.prepare('SELECT COUNT(*) AS total FROM auth_accounts WHERE email = ?').get(email).total,
      1
    );

    const replay = await client.request('POST', '/api/auth/register', { body });
    assertProblem(replay, { status: 422, type: 'verification-code-consumed', field: 'verificationCode' });
  });
});
