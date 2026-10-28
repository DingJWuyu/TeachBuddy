import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, register, login, ok, problem, questions, question, write } from './helpers.js';

test('A-R1 注册开关：关闭时拒绝发码和已有挑战注册，不消费挑战且不阻止已有账户登录', async t => {
  const world = await createWorld(t), existing = await register(world);
  const client = world.client(), email = 'closed-registration@example.test';
  ok(await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } }));
  const issued = ok(await client.request('POST', '/api/auth/registration-codes', { body: { email } }));
  const body = { email, nickname: '教师', password: 'teacher-password-9', challengeId: issued.challengeId, verificationCode: world.app.mailer.lastCode('registration', email), termsAccepted: true, rememberMe: true };
  world.app.env.registrationOpen = false;
  assert.equal(ok(await client.request('GET', '/api/auth/session')).registrationOpen, false);
  problem(await client.request('POST', '/api/auth/registration-codes', { body: { email: 'new@example.test' } }), 403, 'registration-closed');
  problem(await client.request('POST', '/api/auth/register', { body }), 403, 'registration-closed');
  const old = await login(world, existing);
  ok(await old.client.request('GET', questions));
  world.app.env.registrationOpen = true;
  ok(await client.request('POST', '/api/auth/register', { body }), 201, '重新开放后原正确挑战仍可注册');
});

test('A-R1 验证码绑定：用途和邮箱错误不扣预算，原挑战仍可正确完成注册', async t => {
  const world = await createWorld(t), client = world.client(), email = 'challenge-binding@example.test';
  ok(await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } }));
  const issued = ok(await client.request('POST', '/api/auth/registration-codes', { body: { email } }));
  const body = { email, nickname: '教师', password: 'teacher-password-9', challengeId: issued.challengeId, verificationCode: world.app.mailer.lastCode('registration', email), termsAccepted: true, rememberMe: true };
  for (let attempt = 0; attempt < 6; attempt++) {
    problem(await client.request('POST', '/api/auth/password-reset', { body: { email, password: body.password, challengeId: body.challengeId, verificationCode: body.verificationCode } }), 422, 'verification-code-binding-mismatch');
    problem(await client.request('POST', '/api/auth/register', { body: { ...body, email: 'wrong-owner@example.test' } }), 422, 'verification-code-binding-mismatch');
  }
  assert.equal(world.app.workbench.db.prepare('SELECT remainingAttempts FROM auth_challenges WHERE id=?').get(issued.challengeId).remainingAttempts, 5);
  ok(await client.request('POST', '/api/auth/register', { body }), 201, '绑定拒绝不能耗尽合法用途的挑战');
});

test('A-R1 pending激活：保存失败保留账户与pending，可继续本页或原会话重试记住我', async t => {
  const world = await createWorld(t);
  for (const rememberMe of [false, true]) {
    const a = await register(world, `activation-${rememberMe}@example.test`, { pending: true });
    const activation = { action: 'activate', sessionId: a.sessionId, rememberMe: true };
    world.app.workbench.db.exec(`CREATE TRIGGER rebuilt_activation_failure BEFORE UPDATE OF state ON auth_sessions
      WHEN NEW.state='active' BEGIN SELECT RAISE(ABORT, 'session persistence failed'); END`);
    try { problem(await a.client.request('POST', '/api/auth/session', { body: activation }), 503, 'session-persistence-unavailable'); }
    finally { world.app.workbench.db.exec('DROP TRIGGER rebuilt_activation_failure'); }
    const pending = ok(await a.client.request('GET', '/api/auth/session')).session;
    assert.equal(pending.id, a.sessionId);
    assert.equal(pending.state, 'pending', '保存失败不能把pending误报成已授权或撤销');
    problem(await a.client.request('GET', questions), 401, 'unauthenticated');
    const active = ok(await a.client.request('POST', '/api/auth/session', { body: { ...activation, rememberMe } })).session;
    assert.equal(active.id, a.sessionId, '继续或重试复用原会话，不重新创建账户');
    assert.equal(active.persistence, rememberMe ? 'remembered' : 'page');
    ok(await write(a.client, 'POST', questions, question()), 201);
    problem(await a.client.request('POST', '/api/auth/session', { body: { ...activation, rememberMe: !rememberMe } }), 409, 'session-state-conflict');
  }
});

test('A-R1 认证存储：账户读取失败返回503且不伪装匿名，修复后原身份和资料仍可用', async t => {
  const world = await createWorld(t), a = await register(world);
  const saved = ok(await write(a.client, 'POST', questions, question()), 201);
  world.app.workbench.db.exec('ALTER TABLE auth_accounts RENAME TO rebuilt_unreadable_accounts');
  try {
    problem(await a.client.request('GET', '/api/auth/session'), 503, 'account-store-unavailable');
    problem(await a.client.request('GET', questions), 503, 'temporarily-unavailable');
    problem(await a.client.request('POST', '/api/auth/login', { body: { email: a.email, password: a.password, rememberMe: true } }), 503, 'account-store-unavailable');
  } finally { world.app.workbench.db.exec('ALTER TABLE rebuilt_unreadable_accounts RENAME TO auth_accounts'); }
  assert.equal(ok(await a.client.request('GET', '/api/auth/session')).session.id, a.sessionId);
  assert.equal(ok(await a.client.request('GET', `${questions}/${saved.id}`)).id, saved.id);
});
