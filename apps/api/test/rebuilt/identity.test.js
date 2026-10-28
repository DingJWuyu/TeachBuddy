import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, register, login, anotherPage, ok, problem, questions, question, write } from './helpers.js';

test('身份：pending、新页面和单独页面头均不授权，restore 显式绑定且定向退出不撤另一会话', async t => {
  const world = await createWorld(t);
  const a = await register(world, 'pending@example.test', { pending: true });
  problem(await a.client.request('GET', questions), 401, 'unauthenticated');
  const activation = await a.client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: a.sessionId, rememberMe: true } });
  const activated = ok(activation);
  const cookie = activation.setCookies.find(value => value.startsWith('__Host-teachbuddy_session='));
  assert.ok(cookie, '真实记住我激活必须签发__Host会话Cookie');
  for (const attribute of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
    assert.ok(cookie.split(';').map(value => value.trim()).includes(attribute), `会话Cookie必须包含${attribute}`);
  }
  assert.doesNotMatch(cookie, /(?:^|;)\s*Domain=/i, '__Host会话Cookie不能指定Domain');
  assert.match(cookie, /; Max-Age=604800(?:;|$)/, '初次记住我激活保留七天绝对期限');
  assert.ok(activated);
  const created = ok(await write(a.client, 'POST', questions, question()), 201);
  const page = anotherPage(world, a.client);
  problem(await page.request('GET', questions), 401, 'unauthenticated');
  const state = ok(await page.request('GET', '/api/auth/session'));
  assert.equal(state.rememberedSession.id, a.sessionId, '新页面仅提供恢复目标');
  ok(await page.request('POST', '/api/auth/session', { body: { action: 'restore', sessionId: a.sessionId } }));
  assert.equal(ok(await page.request('GET', `${questions}/${created.id}`)).id, created.id);
  problem(await world.client().request('GET', questions), 401, 'unauthenticated');
  const b = await register(world, 'other-page@example.test', { client: anotherPage(world, a.client) });
  ok(await a.client.request('POST', '/api/auth/logout', { body: { sessionId: a.sessionId } }), 204);
  problem(await page.request('GET', questions), 401, 'unauthenticated');
  assert.deepEqual(ok(await b.client.request('GET', questions)).items, [], '定向退出保留同容器其他账户页面');
  ok(await a.client.request('POST', '/api/auth/logout', { body: { sessionId: a.sessionId } }), 204);
  assert.equal(ok(await b.client.request('GET', '/api/auth/session')).session.id, b.sessionId);
});

test('身份：来源和保护头先拒绝，记住我绝对到期，page 模式不提供恢复身份', async t => {
  const world = await createWorld(t);
  const a = await register(world);
  problem(await write(a.client, 'POST', questions, question(), undefined, { origin: 'https://attacker.example' }), 403, 'request-not-allowed');
  problem(await write(a.client, 'POST', questions, question(), undefined, { protect: false }), 403, 'request-not-allowed');
  assert.equal(ok(await a.client.request('GET', questions)).items.length, 0);
  world.clock.advance(7 * 24 * 3600 * 1000);
  problem(await a.client.request('GET', questions), 401, 'unauthenticated');
  const ordinary = await login(world, a, { rememberMe: false });
  ok(await ordinary.client.request('GET', questions));
  const fresh = anotherPage(world, ordinary.client);
  const state = ok(await fresh.request('GET', '/api/auth/session'));
  assert.equal(state.session, null);
  assert.equal(state.rememberedSession, null, 'page 会话不能在刷新后自动恢复');
});

test('验证码：错误预算、重发替换、投递失败和过期不泄漏或激活错误挑战', async t => {
  const world = await createWorld(t);
  const c = world.client();
  ok(await c.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } }));
  const email = 'codes@example.test';
  const send = () => c.request('POST', '/api/auth/registration-codes', { body: { email } });
  let issued = ok(await send());
  assert.equal(issued.verificationCode, undefined, 'HTTP 不返回验证码');
  const original = world.app.mailer.lastCode('registration', email);
  const body = code => ({ email, nickname: '林老师', password: 'teacher-password-9', termsAccepted: true, rememberMe: true, challengeId: issued.challengeId, verificationCode: code });
  problem(await send(), 429, 'code-send-cooldown');
  for (let i = 1; i <= 5; i++) {
    const bad = original === '000000' ? '111111' : '000000';
    problem(await c.request('POST', '/api/auth/register', { body: body(bad) }), 422, i === 5 ? 'verification-code-exhausted' : 'verification-code-incorrect', { remainingAttempts: 5 - i });
  }
  problem(await c.request('POST', '/api/auth/register', { body: body(original) }), 422, 'verification-code-exhausted');
  world.clock.advance(31000);
  const replacedChallengeId = issued.challengeId;
  issued = ok(await send());
  problem(await c.request('POST', '/api/auth/register', { body: { ...body(original), challengeId: replacedChallengeId } }), 422, 'verification-code-replaced');
  const current = world.app.mailer.lastCode('registration', email);
  world.clock.advance(31000);
  world.app.mailer.failNext();
  problem(await send(), 503, 'code-delivery-unavailable');
  ok(await c.request('POST', '/api/auth/register', { body: body(current) }), 201, '投递失败必须保留上一活动挑战');
  const expiredEmail = 'expired@example.test';
  const expired = ok(await c.request('POST', '/api/auth/registration-codes', { body: { email: expiredEmail } }));
  world.clock.advance(600000);
  problem(await c.request('POST', '/api/auth/register', { body: { ...body(world.app.mailer.lastCode('registration', expiredEmail)), email: expiredEmail, challengeId: expired.challengeId } }), 422, 'verification-code-expired');
});

test('认证事务：注册失败不消费正确码，重置原子撤销全部旧会话并启用新密码', async t => {
  const world = await createWorld(t);
  const c = world.client();
  ok(await c.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } }));
  const email = 'atomic@example.test';
  const sent = ok(await c.request('POST', '/api/auth/registration-codes', { body: { email } }));
  const body = { email, nickname: '林老师', password: 'teacher-password-9', termsAccepted: true, rememberMe: true, challengeId: sent.challengeId, verificationCode: world.app.mailer.lastCode('registration', email) };
  world.app.workbench.db.exec("CREATE TRIGGER rebuilt_reject_account BEFORE INSERT ON auth_accounts BEGIN SELECT RAISE(ABORT, 'test disk failure'); END");
  problem(await c.request('POST', '/api/auth/register', { body }), 503, 'account-store-unavailable');
  world.app.workbench.db.exec('DROP TRIGGER rebuilt_reject_account');
  const session = ok(await c.request('POST', '/api/auth/register', { body }), 201);
  ok(await c.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: session.id, rememberMe: true } }));
  const a = { email, password: body.password };
  const device2 = await login(world, a);
  const reset = ok(await c.request('POST', '/api/auth/password-reset-codes', { body: { email } }));
  const changed = { email, challengeId: reset.challengeId, verificationCode: world.app.mailer.lastCode('password-reset', email), password: 'new-password-99' };
  ok(await c.request('POST', '/api/auth/password-reset', { body: changed }), 204);
  problem(await c.request('GET', questions), 401, 'unauthenticated');
  problem(await device2.client.request('GET', questions), 401, 'unauthenticated');
  problem(await c.request('POST', '/api/auth/login', { body: { ...a, rememberMe: true } }), 401, 'credentials-rejected');
  const next = await login(world, { ...a, password: changed.password });
  ok(await next.client.request('GET', questions));
  problem(await c.request('POST', '/api/auth/password-reset', { body: changed }), 422, 'verification-code-consumed');
});
