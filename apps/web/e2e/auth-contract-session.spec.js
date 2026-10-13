/*
 * Session handoff, recovery, persistence failure, unknown results and late
 * identity against the contract HTTP substitute.
 */
import { expect, test } from '@playwright/test';
import {
  armFault,
  clearFaults,
  ensureSubstitute,
  latestMail,
  readRequests,
  readState,
  requestsFor,
  resetState,
  revokeAccount,
  revokeSession,
  seedAccount,
} from './fixtures/auth-contract/fixture-control.mjs';

const PORT = 48182;
const BASE = `http://127.0.0.1:${PORT}`;
const TEACHER = { email: 'teacher@example.com', nickname: '林老师', password: ' TeAcH😀9' };
const OTHER = { email: 'other@example.com', nickname: '别的老师', password: 'other-secret-1' };

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

/* Register/reset unknown results keep the form; the way back to login is the
 * card switch in those modes and an explicit link in the other cards. */
async function returnToLogin(page) {
  const explicit = page.getByRole('button', { name: '返回登录' });
  if (await explicit.count()) {
    await explicit.first().click();
  } else {
    await page.locator('.ae-switch button').click();
  }
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
}

async function signIn(page, { email, password, nickname, remember = true }) {
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  if (!remember) await page.getByLabel('记住我').uncheck();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(nickname);
}

async function activeSession(state, email) {
  return state.sessions.find((session) => session.email === email && session.state === 'active' && !session.revoked);
}

async function activateRequests() {
  const requests = await requestsFor(PORT, { method: 'POST', path: '/api/auth/session' });
  return requests.filter((request) => request.body?.action === 'activate');
}

test('不记住我：刷新回登录且旧页面绑定不能授权（SE01 / C21）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, { ...TEACHER, remember: false });

  const before = await readState(PORT);
  const session = await activeSession(before, TEACHER.email);
  expect(session.persistence).toBe('page');
  const oldPageId = Object.keys(before.containers[0].pages)[0];

  await page.reload();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();

  const response = await page.context().request.get(`${BASE}/api/workbench/context`, {
    headers: { 'X-TeachBuddy-Page': oldPageId },
  });
  expect(response.status()).toBe(401);
});

test('记住我：刷新先显示恢复等待，核验后回同一账户（SE02 / WB-AUTH-012）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, TEACHER);
  const state = await readState(PORT);
  const session = await activeSession(state, TEACHER.email);
  expect(session.persistence).toBe('remembered');
  const accountKey = await page.locator('[data-harness-account-key]').textContent();

  await armFault(PORT, { operation: 'session-post', kind: 'delay', ms: 1200, times: 1 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '恢复登录状态' })).toBeVisible();
  await expect(page.getByText('正在恢复登录状态，请稍候…')).toBeVisible();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  await expect(page.locator('[data-harness-account-key]')).toHaveText(accountKey);
});

test('恢复前新页面头不能授权，恢复后同一身份可访问（C21 / RE02）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, TEACHER);
  const accountKey = await page.locator('[data-harness-account-key]').textContent();

  await armFault(PORT, { operation: 'session-post', kind: 'delay', ms: 1500, times: 1 });
  await page.reload();
  await expect(page.getByRole('heading', { name: '恢复登录状态' })).toBeVisible();

  const beforeRestore = await page.evaluate(() => window.__authHarness.request('/api/workbench/context'));
  expect(beforeRestore.status).toBe(401);

  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  const afterRestore = await page.evaluate(() => window.__authHarness.run('getWorkbenchContext'));
  expect(afterRestore.status).toBe(200);
  await expect(page.locator('[data-harness-account-key]')).toHaveText(accountKey);
});

test('恢复失败可重试，重试后进入工作台（RE01 / S47）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, TEACHER);
  const accountKey = await page.locator('[data-harness-account-key]').textContent();

  await armFault(PORT, {
    operation: 'session-post',
    kind: 'problem',
    type: '/problems/auth/session-store-unavailable',
    times: 1,
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '恢复失败' })).toBeVisible();
  await expect(page.getByText('暂时无法恢复登录状态，请重试或返回登录。')).toBeVisible();
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  await expect(page.locator('[data-harness-account-key]')).toHaveText(accountKey);
});

test('恢复失败返回登录会定向放弃恢复目标（S47 / CC-PENDING）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, TEACHER);
  const target = (await activeSession(await readState(PORT), TEACHER.email)).id;

  await armFault(PORT, {
    operation: 'session-post',
    kind: 'problem',
    type: '/problems/auth/session-store-unavailable',
    times: -1,
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '恢复失败' })).toBeVisible();
  await page.getByRole('button', { name: '返回登录' }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();

  await expect
    .poll(async () => (await readState(PORT)).sessions.find((session) => session.id === target)?.revoked)
    .toBe(true);
  const logouts = await requestsFor(PORT, { method: 'POST', path: '/api/auth/logout' });
  expect(logouts.some((request) => request.body?.sessionId === target)).toBe(true);
});

test('记住我保存失败：继续当前会话进入 page 模式，刷新回登录（PN01 / WB-AUTH-013）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await armFault(PORT, {
    operation: 'session-persistence',
    kind: 'problem',
    type: '/problems/auth/session-persistence-unavailable',
    times: 1,
  });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();

  await expect(page.getByRole('heading', { name: '保存登录状态' })).toBeVisible();
  await expect(page.getByText('登录已完成，但登录状态未能保存。')).toBeVisible();
  await page.getByRole('button', { name: '继续进入工作台' }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  const session = await activeSession(await readState(PORT), TEACHER.email);
  expect(session.persistence).toBe('page');

  await page.reload();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
});

test('记住我保存失败：重试保存成功后刷新可恢复（PN01 / WB-AUTH-013）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await armFault(PORT, {
    operation: 'session-persistence',
    kind: 'problem',
    type: '/problems/auth/session-persistence-unavailable',
    times: 1,
  });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '保存登录状态' })).toBeVisible();

  await page.getByRole('button', { name: '重试保存登录状态' }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  expect((await activeSession(await readState(PORT), TEACHER.email)).persistence).toBe('remembered');

  await page.reload();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
});

test('离开保存失败卡：定向撤销旧身份且迟到结果不改写新表单（PN03 / WB-AUTH-014）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await armFault(PORT, {
    operation: 'session-persistence',
    kind: 'problem',
    type: '/problems/auth/session-persistence-unavailable',
    times: 1,
  });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '保存登录状态' })).toBeVisible();
  const pending = (await readState(PORT)).sessions.find((session) => session.state === 'pending');

  await armFault(PORT, { operation: 'session-post', kind: 'delay', ms: 1500, times: 1 });
  await page.getByRole('button', { name: '重试保存登录状态' }).click();
  await page.getByRole('button', { name: '返回登录' }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await page.getByLabel('邮箱', { exact: true }).fill('late@example.com');
  await page.waitForTimeout(2000);

  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('late@example.com');
  await expect(page.locator('[data-harness-nickname]')).toHaveCount(0);
  await expect
    .poll(async () => (await readState(PORT)).sessions.find((session) => session.id === pending.id)?.revoked)
    .toBe(true);
});

test('注册结果未确认进入 S44，以提交凭据登录恢复（UN01 / WB-AUTH-010）', async ({ page }) => {
  await openEntry(page, '?requestTimeoutMs=1200');
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('新教师');
  await page.getByLabel('邮箱', { exact: true }).fill('unknown@example.com');
  await page.getByLabel('密码', { exact: true }).fill('password-8');
  await page.getByLabel('确认密码', { exact: true }).fill('password-8');
  await page.getByRole('button', { name: '发送验证码' }).click();
  const mail = await latestMail(PORT, 'unknown@example.com');
  await page.getByLabel('邮箱验证码').fill(mail.code);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();

  await armFault(PORT, { operation: 'register', kind: 'hang-after', times: 1 });
  await page.getByRole('button', { name: '注册', exact: true }).click();

  await expect(page.getByText('注册结果暂未确认，请返回登录并尝试使用刚提交的邮箱和密码。')).toBeVisible();
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('unknown@example.com');
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('新教师');
  await expect(page.locator('[data-harness-nickname]')).toHaveCount(0);

  const state = await readState(PORT);
  expect(await activeSession(state, 'unknown@example.com')).toBeUndefined();
  expect(state.sessions.some((session) => session.state === 'pending')).toBe(true);
  expect(state.challenges[0].consumed).toBe(true);

  await returnToLogin(page);
  await signIn(page, { email: 'unknown@example.com', password: 'password-8', nickname: '新教师' });
});

test('重置结果未确认进入 S44，以新密码登录恢复（UN02 / WB-AUTH-010）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page, '?requestTimeoutMs=1200');
  await page.getByRole('button', { name: '忘记密码？' }).click();
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();
  const mail = await latestMail(PORT, TEACHER.email);
  await page.getByLabel('验证码', { exact: true }).fill(mail.code);
  await page.getByLabel('新密码', { exact: true }).fill('new-password-9');
  await page.getByLabel('确认新密码').fill('new-password-9');

  await armFault(PORT, { operation: 'password-reset', kind: 'hang-after', times: 1 });
  await page.getByRole('button', { name: '重置密码' }).click();
  await expect(page.getByText('重置结果暂未确认，请返回登录并尝试使用新密码。')).toBeVisible();
  await expect(page.getByLabel('新密码', { exact: true })).toHaveValue('new-password-9');

  await returnToLogin(page);
  await signIn(page, { email: TEACHER.email, password: 'new-password-9', nickname: TEACHER.nickname });
  const state = await readState(PORT);
  expect(state.accounts[0].password).toBe('new-password-9');
  expect(state.challenges[0].consumed).toBe(true);
});

test('注册存储写入故障为已知回滚，保留输入并可同码重试（ST01 / WB-AUTH-009）', async ({ page }) => {
  await openEntry(page);
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('新教师');
  await page.getByLabel('邮箱', { exact: true }).fill('rollback@example.com');
  await page.getByLabel('密码', { exact: true }).fill('password-8');
  await page.getByLabel('确认密码', { exact: true }).fill('password-8');
  await page.getByRole('button', { name: '发送验证码' }).click();
  const mail = await latestMail(PORT, 'rollback@example.com');
  await page.getByLabel('邮箱验证码').fill(mail.code);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();

  await armFault(PORT, {
    operation: 'account-store-write',
    kind: 'problem',
    type: '/problems/auth/account-store-unavailable',
    times: 1,
  });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('暂时无法完成，请重试。')).toBeVisible();
  await expect(page.getByLabel('邮箱验证码')).toHaveValue(mail.code);
  expect((await readState(PORT)).accounts).toHaveLength(0);

  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText('新教师');
  expect((await readState(PORT)).accounts).toHaveLength(1);
});

test('注册收到未声明的会话存储故障按结果未确认处理（ST01 / P04）', async ({ page }) => {
  await openEntry(page);
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('新教师');
  await page.getByLabel('邮箱', { exact: true }).fill('undeclared@example.com');
  await page.getByLabel('密码', { exact: true }).fill('password-8');
  await page.getByLabel('确认密码', { exact: true }).fill('password-8');
  await page.getByRole('button', { name: '发送验证码' }).click();
  const mail = await latestMail(PORT, 'undeclared@example.com');
  await page.getByLabel('邮箱验证码').fill(mail.code);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();

  await armFault(PORT, {
    operation: 'register',
    kind: 'problem',
    type: '/problems/auth/session-store-unavailable',
    times: 1,
  });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('注册结果暂未确认，请返回登录并尝试使用刚提交的邮箱和密码。')).toBeVisible();
  expect((await readState(PORT)).accounts).toHaveLength(1);

  await returnToLogin(page);
  await signIn(page, { email: 'undeclared@example.com', password: 'password-8', nickname: '新教师' });
});

test('已知未发出的离线失败可重试，不为注册业务制造副作用（L02 / UN01）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);

  await page.context().setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('网络连接不可用，请检查网络后重试。')).toBeVisible();
  expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/login' })).toHaveLength(0);

  await page.context().setOffline(false);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
});

test('请求超时：登录按普通失败、注册按结果未确认（L02 / CC-UNKNOWN）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await page.goto(`${BASE}/?requestTimeoutMs=1500`);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();

  await armFault(PORT, { operation: 'login', kind: 'delay', ms: 4000, times: 1 });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('请求超时，请重试。')).toBeVisible();
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(TEACHER.email);
  await expect
    .poll(async () => (await requestsFor(PORT, { method: 'POST', path: '/api/auth/login' })).length, { timeout: 6000 })
    .toBe(1);

  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('新教师');
  await page.getByLabel('邮箱', { exact: true }).fill('timeout@example.com');
  await page.getByLabel('密码', { exact: true }).fill('password-8');
  await page.getByLabel('确认密码', { exact: true }).fill('password-8');
  await page.getByRole('button', { name: '发送验证码' }).click();
  const mail = await latestMail(PORT, 'timeout@example.com');
  await page.getByLabel('邮箱验证码').fill(mail.code);
  await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
  await armFault(PORT, { operation: 'register', kind: 'delay', ms: 4000, times: 1 });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('注册结果暂未确认，请返回登录并尝试使用刚提交的邮箱和密码。')).toBeVisible();
});

test('业务 401 触发身份复核并锁住工作台（C20 / CC-SESSION）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, TEACHER);
  const session = await activeSession(await readState(PORT), TEACHER.email);
  await revokeSession(PORT, session.id);

  await page.locator('[data-harness-business-401]').click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByText('登录状态已过期，请重新登录。')).toBeVisible();
  await expect(page.locator('[data-harness-nickname]')).toHaveCount(0);
});

test('隐藏页恢复可见时先复核身份（CC-SESSION）', async ({ page, context }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, TEACHER);
  const session = await activeSession(await readState(PORT), TEACHER.email);
  await revokeSession(PORT, session.id);

  const second = await context.newPage();
  await second.goto(`${BASE}/`);
  await expect(second.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await page.bringToFront();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await second.close();
});

test('跨页身份变化只触发核验，不清除另一账户的当前会话（IS02）', async ({ page, context }) => {
  await seedAccount(PORT, TEACHER);
  await seedAccount(PORT, OTHER);
  await openEntry(page);
  await signIn(page, { ...TEACHER, remember: false });
  const teacherKey = await page.locator('[data-harness-account-key]').textContent();

  const second = await context.newPage();
  await second.goto(`${BASE}/`);
  await expect(second.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await second.getByLabel('邮箱', { exact: true }).fill(OTHER.email);
  await second.getByLabel('密码', { exact: true }).fill(OTHER.password);
  await second.getByRole('button', { name: '登录', exact: true }).click();
  await expect(second.locator('[data-harness-nickname]')).toHaveText(OTHER.nickname);

  await page.bringToFront();
  await page.waitForTimeout(400);
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  await expect(page.locator('[data-harness-account-key]')).toHaveText(teacherKey);
  await second.close();
});

test('登录迟到 pending 不激活，也不污染已切换的新表单（RA02 / WB-AUTH-011）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await armFault(PORT, { operation: 'login', kind: 'delay', ms: 1500, times: 1 });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();

  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('迟到的新教师');
  await page.waitForTimeout(2200);

  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('迟到的新教师');
  await expect(page.getByRole('heading', { name: '创建账户' })).toBeVisible();
  await expect(page.locator('[data-harness-nickname]')).toHaveCount(0);
  expect(await activateRequests()).toHaveLength(0);
  const pending = (await readState(PORT)).sessions.find((session) => session.state === 'pending');
  expect(pending?.revoked ?? false).toBe(true);
});

test('账户重置撤销所有旧会话，其他账户不受影响（IS01 / WB-AUTH-016）', async ({ page, context }) => {
  await seedAccount(PORT, TEACHER);
  await seedAccount(PORT, OTHER);
  await openEntry(page);
  await signIn(page, { ...TEACHER, remember: false });

  const second = await context.newPage();
  await second.goto(`${BASE}/`);
  await expect(second.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await second.getByLabel('邮箱', { exact: true }).fill(OTHER.email);
  await second.getByLabel('密码', { exact: true }).fill(OTHER.password);
  await second.getByRole('button', { name: '登录', exact: true }).click();
  await expect(second.locator('[data-harness-nickname]')).toHaveText(OTHER.nickname);

  await revokeAccount(PORT, TEACHER.email);

  const response = await page.evaluate(() => window.__authHarness.request('/api/workbench/context'));
  expect(response.status).toBe(401);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  const other = await second.evaluate(() => window.__authHarness.request('/api/workbench/context'));
  expect(other.status).toBe(200);
  await second.close();
});

test('登录响应晚到但请求已在线发送时按普通失败重试（CC-RACE / RA02）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await armFault(PORT, { operation: 'login', kind: 'delay', ms: 600, times: 1 });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  const requests = await requestsFor(PORT, { method: 'POST', path: '/api/auth/login' });
  expect(requests).toHaveLength(1);
  expect(await readRequests(PORT)).toBeTruthy();
});

test('保存失败期间的其他页面通知只触发核验，不误报过期（PN03 / IS02）', async ({ page, context }) => {
  await seedAccount(PORT, TEACHER);
  await seedAccount(PORT, OTHER);
  await openEntry(page);
  await armFault(PORT, {
    operation: 'session-persistence',
    kind: 'problem',
    type: '/problems/auth/session-persistence-unavailable',
    times: 1,
  });
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '保存登录状态' })).toBeVisible();

  const second = await context.newPage();
  await second.goto(`${BASE}/`);
  await expect(second.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await second.getByLabel('邮箱', { exact: true }).fill(OTHER.email);
  await second.getByLabel('密码', { exact: true }).fill(OTHER.password);
  await second.getByRole('button', { name: '登录', exact: true }).click();
  await expect(second.locator('[data-harness-nickname]')).toHaveText(OTHER.nickname);

  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: '保存登录状态' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续进入工作台' })).toBeVisible();
  expect((await readState(PORT)).sessions.some((session) => session.email === TEACHER.email && session.state === 'pending')).toBe(true);

  await second.close();
});

test('已激活但响应丢失（409 冲突）时先核实实际状态，不误报未保存（PN04）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  /* The activate itself succeeds server-side; the response is a conflict, so
   * the only safe next step is a read that confirms the real state. */
  await armFault(PORT, {
    operation: 'session-post',
    kind: 'problem',
    type: '/problems/auth/session-state-conflict',
    times: 1,
  });
  await signIn(page, TEACHER);

  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  await expect(page.getByRole('heading', { name: '保存登录状态' })).toHaveCount(0);
  const session = await activeSession(await readState(PORT), TEACHER.email);
  expect(session.persistence).toBe('remembered');
});

test('身份存储不可读时不回退旧身份，也不冒充已退出（C21 / ST02）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, TEACHER);
  const accountKey = await page.locator('[data-harness-account-key]').textContent();

  await armFault(PORT, {
    operation: 'session-get',
    kind: 'problem',
    type: '/problems/auth/session-store-unavailable',
    times: -1,
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(400);
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  await expect(page.locator('[data-harness-account-key]')).toHaveText(accountKey);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toHaveCount(0);

  await clearFaults(PORT);
  const business = await page.evaluate(() => window.__authHarness.request('/api/workbench/context'));
  expect(business.status).toBe(200);
});

test('BFCache 恢复不沿用旧页面级身份（SE01）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  await openEntry(page);
  await signIn(page, { ...TEACHER, remember: false });
  const lastPageId = async () => (await requestsFor(PORT, { method: 'GET', path: '/api/auth/session' })).at(-1).page;
  const before = await lastPageId();

  /* A fresh document (new page context) cannot reuse the page-level identity. */
  await page.goto(`${BASE}/?away=1`);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.locator('[data-harness-nickname]')).toHaveCount(0);
  await expect.poll(lastPageId).not.toBe(before);

  /*
   * Mechanism probe for the reused-document path: Playwright launches Chromium
   * with the back/forward cache disabled, so a synthetic persisted pageshow is
   * the only reachable trigger here. The handler must take a new page context
   * and re-read the session, which sends this page back to the login card.
   */
  await signIn(page, { ...TEACHER, remember: false });
  const active = await lastPageId();
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.locator('[data-harness-nickname]')).toHaveCount(0);
  await expect.poll(lastPageId).not.toBe(active);
});
