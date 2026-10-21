/*
 * Account-entry behavior against the contract HTTP substitute: local
 * validation, normalization, code lifecycle, registration closure, recovery
 * and the accepted interface interactions.
 */
import { expect, test } from '@playwright/test';
import {
  armFault,
  ensureSubstitute,
  latestMail,
  readState,
  requestsFor,
  resetState,
  seedAccount,
  setConfig,
} from './fixtures/auth-contract/fixture-control.mjs';

const PORT = 47182;
const BASE = `http://127.0.0.1:${PORT}`;
const TEACHER = { email: 'teacher@example.com', nickname: '林老师', password: ' TeAcH😀9' };

let substitute;

test.beforeAll(async () => {
  substitute = await ensureSubstitute({ port: PORT });
});

test.afterAll(async () => {
  await substitute?.stop();
});

test.beforeEach(async () => {
  await resetState(PORT);
});

async function openEntry(page, query = '') {
  await page.goto(`${BASE}/${query}`);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
}

async function openRegister(page) {
  await openEntry(page);
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('heading', { name: '创建账户' })).toBeVisible();
}

async function fillRegistration(page, { nickname = '新教师', email, password = 'password-8' } = {}) {
  await page.getByLabel('昵称', { exact: true }).fill(nickname);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码', { exact: true }).fill(password);
}

async function sendRegistrationCode(page) {
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByLabel('邮箱验证码')).toBeVisible();
}

async function fillCode(page, code) {
  await page.getByLabel('邮箱验证码').fill(code);
}

async function waitForServerCooldown(port, email) {
  await expect
    .poll(async () => {
      const state = await readState(port);
      const active = state.challenges.filter((challenge) => challenge.email === email && !challenge.replaced);
      if (active.length === 0) return true;
      return Date.now() >= Math.max(...active.map((challenge) => challenge.resendAt));
    }, { timeout: 10_000 })
    .toBe(true);
}

test('bootstrap 建立空容器并展示登录卡，空容器不算登录', async ({ page }) => {
  await openEntry(page);
  await expect(page.getByRole('button', { name: /^登录(?: ›)?$/ })).toBeVisible();
  await expect(page.locator('[data-harness-nickname]')).toHaveCount(0);
  const state = await readState(PORT);
  expect(state.containers).toHaveLength(1);
  expect(state.sessions).toHaveLength(0);
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === '__Host-teachbuddy_session');
  expect(session).toBeTruthy();
  expect(session.httpOnly).toBe(true);
  expect(session.secure).toBe(true);
  expect(session.sameSite).toBe('Lax');
  expect(session.path).toBe('/');
  expect(session.expires).toBe(-1);
});

test('本地错误不发业务请求（CC-INPUT / IN01）', async ({ page }) => {
  await openEntry(page);
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
  await expect(page.getByText('请填写邮箱。')).toBeVisible();

  await page.getByLabel('邮箱', { exact: true }).fill('not-an-email@');
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
  await expect(page.getByText('邮箱格式不正确。')).toBeVisible();

  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill('short');
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
  await expect(page.getByText('密码至少 8 位。')).toBeVisible();

  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/login' })).toHaveLength(0);

  await openRegister(page);
  await fillRegistration(page, { nickname: '', email: TEACHER.email });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('请填写昵称。')).toBeVisible();

  await fillRegistration(page, { nickname: '😀'.repeat(41), email: TEACHER.email });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('昵称不能超过 40 个字符。')).toBeVisible();

  await fillRegistration(page, { nickname: '新教师', email: TEACHER.email, password: 'short' });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('密码至少 8 位。')).toBeVisible();

  await fillRegistration(page, { nickname: '新教师', email: TEACHER.email });
  await page.getByLabel('确认密码', { exact: true }).fill('password-9');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('两次输入的密码不一致。')).toBeVisible();

  await fillRegistration(page, { nickname: '新教师', email: TEACHER.email });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('请先发送邮箱验证码。')).toBeVisible();

  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/register' })).toHaveLength(0);
});

test('邮箱规范化提交但键入原文不改（CC-BOUNDARY / B01）', async ({ page }) => {
  await openEntry(page);
  await page.getByLabel('邮箱', { exact: true }).fill(' Teacher@Example.COM ');
  await page.getByLabel('密码', { exact: true }).fill('password-8');
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
  await expect(page.getByText('邮箱或密码不正确，请重试。')).toBeVisible();

  const requests = await requestsFor(PORT, { method: 'POST', path: '/api/auth/login' });
  expect(requests).toHaveLength(1);
  expect(requests[0].body.email).toBe('teacher@example.com');
  expect(await page.getByLabel('邮箱', { exact: true }).inputValue()).toBe(' Teacher@Example.COM ');
});

test('凭据拒绝只清密码、保留邮箱并可关闭横幅（CC-LOGIN-FAIL / L01）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill('wrong password');
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();

  const banner = page.getByRole('alert').filter({ hasText: '邮箱或密码不正确，请重试。' });
  await expect(banner).toBeVisible();
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(TEACHER.email);

  await page.getByRole('button', { name: '关闭提示' }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(TEACHER.email);
});

test('登录成功后交接到工作台并显示保存昵称（CC-HAPPY / H02）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await expect(page.getByLabel('记住我')).toBeChecked();
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();

  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  await expect(page.locator('[data-harness-account-key]')).not.toBeEmpty();
  const state = await readState(PORT);
  expect(state.sessions).toHaveLength(1);
  expect(state.sessions[0]).toMatchObject({ state: 'active', persistence: 'remembered', revoked: false });
});

test('注册前发码失败保留第一步，重发成功替换旧挑战（CC-SEND / S02、S03）', async ({ page }) => {
  await setConfig(PORT, { resendCooldownMs: 1200 });
  await openRegister(page);
  await fillRegistration(page, { email: 'new.teacher@example.com' });

  await armFault(PORT, { operation: 'code-delivery', kind: 'problem', type: '/problems/auth/code-delivery-unavailable', times: 1 });
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByText('验证码发送失败，请稍后重试。')).toBeVisible();
  await expect(page.getByLabel('邮箱验证码')).toHaveCount(0);
  expect((await readState(PORT)).challenges).toHaveLength(0);

  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByLabel('邮箱验证码')).toBeVisible();
  const first = await latestMail(PORT, 'new.teacher@example.com');
  expect(first).toBeTruthy();

  const resend = page.getByRole('button', { name: /后重发/ });
  await expect(resend).toBeDisabled();
  const readyResend = page.getByRole('button', { name: '重新发送' });
  await expect(readyResend).toBeEnabled({ timeout: 6000 });
  await readyResend.click();
  await expect(page.getByLabel('邮箱验证码')).toHaveValue('');
  await expect
    .poll(async () => {
      const state = await readState(PORT);
      return state.challenges.filter((challenge) => challenge.email === 'new.teacher@example.com');
    })
    .toHaveLength(2);
  const state = await readState(PORT);
  const challenges = state.challenges.filter((challenge) => challenge.email === 'new.teacher@example.com');
  expect(challenges.find((challenge) => challenge.id === first.challengeId)?.replaced).toBe(true);
  expect(challenges.filter((challenge) => !challenge.replaced)).toHaveLength(1);
});

test('验证码形状与条款校验先于真实性且不消耗次数（CC-BOUNDARY / B05、WB-AUTH-004）', async ({ page }) => {
  await openRegister(page);
  await fillRegistration(page, { nickname: '新教师', email: 'shape@example.com' });
  await sendRegistrationCode(page);

  await fillCode(page, '12345');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('请输入 6 位数字验证码（0-9）。')).toBeVisible();
  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/register' })).toHaveLength(0);

  await fillCode(page, '111111');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('需要同意服务条款才能创建账户。')).toBeVisible();
  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/register' })).toHaveLength(0);

  const challenge = (await readState(PORT)).challenges.find((item) => item.email === 'shape@example.com');
  expect(challenge.attemptsLeft).toBe(5);

  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
  const wrong = challenge.code === '222222' ? '333333' : '222222';
  await fillCode(page, wrong);
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('验证码不正确，还可以再试 4 次。')).toBeVisible();
});

test('同一挑战连续错码后耗尽，正确码也拒绝（CC-CODE / C01）', async ({ page }) => {
  await openRegister(page);
  await fillRegistration(page, { nickname: '新教师', email: 'exhaust@example.com' });
  await sendRegistrationCode(page);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
  const challenge = await latestMail(PORT, 'exhaust@example.com');
  const wrong = challenge.code === '222222' ? '333333' : '222222';

  for (const remaining of [4, 3, 2, 1]) {
    await fillCode(page, wrong);
    await page.getByRole('button', { name: '注册', exact: true }).click();
    await expect(page.getByText(`验证码不正确，还可以再试 ${remaining} 次。`)).toBeVisible();
  }
  await fillCode(page, wrong);
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('验证码错误次数过多，请重新发送。')).toBeVisible();

  await fillCode(page, challenge.code);
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('验证码错误次数过多，请重新发送。')).toBeVisible();
  expect((await readState(PORT)).accounts).toHaveLength(0);
});

test('注册关闭在表单进入与提交裁决两处生效（CC-CLOSED / CL01）', async ({ page }) => {
  await setConfig(PORT, { registrationOpen: false });
  await openEntry(page);
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByText('目前暂时不能创建新账户。')).toBeVisible();
  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/registration-codes' })).toHaveLength(0);
  await page.getByRole('button', { name: '返回登录' }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();

  await setConfig(PORT, { registrationOpen: true });
  await page.getByRole('button', { name: '创建账户' }).click();
  await fillRegistration(page, { nickname: '新教师', email: 'closed@example.com' });
  await sendRegistrationCode(page);
  const challenge = await latestMail(PORT, 'closed@example.com');
  await fillCode(page, challenge.code);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
  await setConfig(PORT, { registrationOpen: false });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('目前暂时不能创建新账户。')).toBeVisible();
  const state = await readState(PORT);
  expect(state.accounts).toHaveLength(0);
  expect(state.challenges[0].consumed).toBe(false);
});

test('注册成功交接昵称，注册默认记住我（CC-HAPPY / H03）', async ({ page }) => {
  await openRegister(page);
  await fillRegistration(page, { nickname: ' 林 老师 ', email: ' New.Teacher@Example.COM ' });
  await sendRegistrationCode(page);
  const challenge = await latestMail(PORT, 'new.teacher@example.com');
  await fillCode(page, challenge.code);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
  await page.getByRole('button', { name: '注册', exact: true }).click();

  await expect(page.locator('[data-harness-nickname]')).toHaveText('林 老师');
  const state = await readState(PORT);
  expect(state.accounts).toHaveLength(1);
  expect(state.accounts[0]).toMatchObject({ email: 'new.teacher@example.com', nickname: '林 老师' });
  expect(state.challenges[0].consumed).toBe(true);
  expect(state.sessions[0]).toMatchObject({ state: 'active', persistence: 'remembered' });
});

test('找回流程：未知邮箱字段拒绝、确认卡只读、更换邮箱重新发码、重置回登录（CC-RESET / S01、R01）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await setConfig(PORT, { resendCooldownMs: 1200 });
  await openEntry(page);
  await page.getByRole('button', { name: '忘记密码？' }).click();
  await expect(page.getByRole('heading', { name: '找回密码' })).toBeVisible();

  await page.getByLabel('邮箱', { exact: true }).fill('nobody@example.com');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByText('这个邮箱没有可找回的账户。')).toBeVisible();
  await expect(page.getByLabel('验证码', { exact: true })).toHaveCount(0);

  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();
  const boundEmail = page.getByLabel('邮箱', { exact: true });
  await expect(boundEmail).toHaveValue(TEACHER.email);
  await expect(boundEmail).toHaveAttribute('readonly', '');

  await page.getByRole('button', { name: '更换邮箱' }).click();
  await expect(page.getByRole('heading', { name: '找回密码' })).toBeVisible();
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(TEACHER.email);

  const sendAgain = page.getByRole('button', { name: /发送验证码|后重发/ });
  await waitForServerCooldown(PORT, TEACHER.email);
  await expect(sendAgain).toBeEnabled({ timeout: 8000 });
  await sendAgain.click();
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();
  const mail = await latestMail(PORT, TEACHER.email);
  await page.getByLabel('验证码', { exact: true }).fill(mail.code);
  await page.getByLabel('新密码', { exact: true }).fill('new-password-9');
  await page.getByLabel('确认新密码').fill('new-password-9');
  await page.getByRole('button', { name: '重置密码' }).click();

  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByText('密码已重置，请用新密码登录。')).toBeVisible();
  const state = await readState(PORT);
  expect(state.accounts[0].password).toBe('new-password-9');
});

test('找回确认本地顺序：验证码形状先于新密码长度（CC-UI / G06）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await page.getByRole('button', { name: '忘记密码？' }).click();
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  await page.getByLabel('验证码', { exact: true }).fill('12345');
  await page.getByLabel('新密码', { exact: true }).fill('short');
  await page.getByRole('button', { name: '重置密码' }).click();
  await expect(page.getByText('请输入 6 位数字验证码（0-9）。')).toBeVisible();

  await page.getByLabel('验证码', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '重置密码' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '新密码至少 8 位。' })).toBeVisible();

  await page.getByLabel('新密码', { exact: true }).fill('long-enough-9');
  await page.getByLabel('确认新密码').fill('long-enough-8');
  await page.getByRole('button', { name: '重置密码' }).click();
  await expect(page.getByText('两次输入的密码不一致。')).toBeVisible();
  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/password-reset' })).toHaveLength(0);
});

test('前导零验证码按字符串提交，输入不做隐式转换（CC-BOUNDARY / B04）', async ({ page }) => {
  await openRegister(page);
  await fillRegistration(page, { nickname: '新教师', email: 'leading@example.com' });
  await sendRegistrationCode(page);
  await fillCode(page, '001234');
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.ae-field-error, .ae-notice')).toBeVisible();
  const requests = await requestsFor(PORT, { method: 'POST', path: '/api/auth/register' });
  expect(requests).toHaveLength(1);
  expect(requests[0].body.verificationCode).toBe('001234');
});

test('键盘 Enter 只提交一次，密码显隐与条款链接遵守既定行为（CC-UI / U01）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await armFault(PORT, { operation: 'login', kind: 'delay', ms: 800, times: 1 });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill('wrong password');
  await page.getByLabel('密码', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: '登录中' })).toBeDisabled();
  await page.getByLabel('密码', { exact: true }).press('Enter');
  await page.getByRole('button', { name: '登录中' }).click({ force: true }).catch(() => {});
  await expect(page.getByText('邮箱或密码不正确，请重试。')).toBeVisible();
  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/login' })).toHaveLength(1);

  const toggle = page.getByRole('button', { name: '显示密码' });
  await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('');
  await page.getByLabel('密码', { exact: true }).fill('another-secret');
  await toggle.click();
  await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('another-secret');
  await page.getByRole('button', { name: '隐藏密码' }).click();
  await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'password');

  const url = page.url();
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('heading', { name: '创建账户' })).toBeVisible();
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(TEACHER.email);
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: /注册即表示同意/ })).not.toBeChecked();
  await page.getByRole('link', { name: '服务条款' }).click();
  expect(page.url()).toBe(url);
});

test('长邮箱在发码说明中单行省略且全文可访问（Design rules / S04）', async ({ page }) => {
  const longLocal = 'a'.repeat(64);
  const longEmail = `${longLocal}@example.com`;
  await openRegister(page);
  await fillRegistration(page, { nickname: '新教师', email: longEmail });
  await sendRegistrationCode(page);

  const address = page.locator('.ae-code-note-address');
  await expect(address).toBeVisible();
  await expect(address).toHaveAttribute('title', longEmail);
  const overflow = await address.evaluate((node) => node.scrollWidth > node.clientWidth);
  expect(overflow).toBe(true);
  const overflowPage = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflowPage).toBe(false);
});

test('40 个 code points 的昵称完整交接（H04 / G05）', async ({ page }) => {
  const nickname = '😀'.repeat(40);
  await openRegister(page);
  await fillRegistration(page, { nickname, email: 'emoji@example.com' });
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue(nickname);
  await sendRegistrationCode(page);
  const challenge = await latestMail(PORT, 'emoji@example.com');
  await fillCode(page, challenge.code);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
  await page.getByRole('button', { name: '注册', exact: true }).click();

  await expect(page.locator('[data-harness-nickname]')).toHaveText(nickname);
  const state = await readState(PORT);
  expect(state.accounts[0].nickname).toBe(nickname);
  expect([...state.accounts[0].nickname]).toHaveLength(40);
});

test('第一步发码冷却在按钮上倒计时，冷却结束后可重发（S02 / S39）', async ({ page }) => {
  await setConfig(PORT, { resendCooldownMs: 5000 });
  await openRegister(page);
  await fillRegistration(page, { nickname: '新教师', email: 'cooldown@example.com' });
  await sendRegistrationCode(page);
  await page.locator('.ae-switch button').click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();

  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('heading', { name: '创建账户' })).toBeVisible();
  await fillRegistration(page, { nickname: '新教师', email: 'cooldown@example.com' });
  const send = page.getByRole('button', { name: '发送验证码' });
  await send.click();
  const counting = page.getByRole('button', { name: /后重发/ });
  await expect(counting).toBeVisible();
  await expect(counting).toBeDisabled();
  await expect(page.getByRole('button', { name: '发送验证码' })).toBeEnabled({ timeout: 10_000 });
});
