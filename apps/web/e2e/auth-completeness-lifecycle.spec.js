import { test, expect, registrationForm, register, signIn, openSettings, deferred, password } from './fixtures/auth-completeness.js';

test('S45 返回登录后同页可重新登录，不重复注册', async ({ page, world }) => {
  const email = 'pending-abandon@example.test';
  let registrations = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/register')) registrations += 1; });
  await registrationForm(page, world, email);
  world.workbench.db.exec("CREATE TRIGGER fail_remember BEFORE UPDATE OF persistence ON auth_sessions WHEN NEW.persistence='remembered' BEGIN SELECT RAISE(ABORT, 'isolated persistence failure'); END");
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByRole('heading', { name: '保存登录状态', exact: true })).toBeVisible();
  world.workbench.db.exec('DROP TRIGGER fail_remember');
  const pendingId = world.workbench.db.prepare('SELECT id FROM auth_sessions WHERE revokedAt IS NULL').get().id;
  const logout = page.waitForRequest('**/api/auth/logout');
  await page.getByRole('button', { name: '返回登录', exact: true }).click();
  expect((await logout).postDataJSON().sessionId).toBe(pendingId);
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await signIn(page, email);
  expect(world.workbench.db.prepare('SELECT revokedAt FROM auth_sessions WHERE id=?').get(pendingId).revokedAt).toBeTruthy();
  expect(registrations).toBe(1);
});

test('返回登录的准备失败可重试，期间不提交必败登录', async ({ page, world }) => {
  const email = 'prepare-retry@example.test';
  await register(page, world, email);
  await openSettings(page);
  let blockPreparation = true;
  await page.route('**/api/auth/session', async route => {
    if (blockPreparation && route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'bootstrap')
      await route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: '/problems/auth/session-store-unavailable', status: 503 }) });
    else await route.continue();
  });
  let logins = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/login')) logins += 1; });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '恢复失败', exact: true })).toBeVisible();
  expect(logins).toBe(0);
  blockPreparation = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await signIn(page, email);
});

test('当前身份可信失效后，同页重新登录已准备浏览器上下文', async ({ page, world, context }) => {
  const email = 'cookie-lost@example.test';
  await register(page, world, email);
  await context.clearCookies();
  await page.locator('a[href^="/resources"]').first().click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await signIn(page, email);
});

for (const committed of [false, true]) {
test(`放弃恢复的撤销${committed ? '已提交回执丢失' : '未到服务器'}在刷新后仍隔离原目标并可核实`, async ({ page, world }, testInfo) => {
  await register(page, world, 'recovery-abandon@example.test');
  await page.route('**/api/auth/session', async route => {
    if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'restore')
      await route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: '/problems/auth/session-store-unavailable', status: 503 }) });
    else await route.continue();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '恢复失败', exact: true })).toBeVisible();
  const targets = [];
  await page.route('**/api/auth/logout', async route => {
    targets.push(route.request().postDataJSON().sessionId);
    if (committed) await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: '返回登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('退出结果暂未确认');
  await page.getByRole('status').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await page.screenshot({ path: testInfo.outputPath('revocation-unknown.png') });
  for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('button', { name: '重试确认退出', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`revocation-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.unroute('**/api/auth/session');
  let restores = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/auth/session') && request.method() === 'POST' && request.postDataJSON()?.action === 'restore') restores += 1;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('退出结果暂未确认');
  expect(restores).toBe(0);
  await page.unroute('**/api/auth/logout');
  const retry = page.waitForRequest('**/api/auth/logout');
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  expect((await retry).postDataJSON().sessionId).toBe(targets[0]);
  await expect(page.getByRole('button', { name: '重试确认退出', exact: true })).toHaveCount(0);
  await signIn(page, 'recovery-abandon@example.test');
});

}

test('退出未知反馈与同目标核实跨普通导航保留', async ({ page, world }, testInfo) => {
  await register(page, world, 'logout-navigation@example.test');
  await openSettings(page);
  let target;
  await page.route('**/api/auth/logout', async route => {
    target = route.request().postDataJSON().sessionId;
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  const protectedRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/') && !request.url().includes('/api/auth/')) protectedRequests.push(request.url());
  });
  await page.locator('a[href^="/resources"]').first().click();
  await expect(page).toHaveURL(/\/resources/);
  await openSettings(page);
  await expect(page.getByRole('alert').filter({ hasText: '退出结果暂未确认' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试确认退出', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试确认退出', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('logout-navigation.png') });
  expect(protectedRequests).toEqual([]);
  await page.unroute('**/api/auth/logout');
  const retry = page.waitForRequest('**/api/auth/logout');
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  expect((await retry).postDataJSON().sessionId).toBe(target);
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
});

test('另一 remembered 账户不受原账户未决撤销影响', async ({ page, context, world }) => {
  const emailA = 'isolation-a@example.test', emailB = 'isolation-b@example.test';
  await register(page, world, emailA);
  await openSettings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await signIn(page, emailA, { remember: false });
  const other = await context.newPage();
  await register(other, world, emailB);
  await openSettings(page);
  await page.route('**/api/auth/logout', route => route.abort('failed'));
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  await other.reload();
  await expect(other.locator('.wb-shell')).toBeVisible();
  await expect(other.locator('.tb-account-row')).toHaveAccessibleName('账户：核查教师');
  expect(world.workbench.db.prepare('SELECT count(*) AS n FROM auth_accounts').get().n).toBe(2);
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible();
  await openSettings(page);
  await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: '退出结果暂未确认' })).toHaveCount(0);
});

test('未知退出后核实明确失败仍保留业务锁与原目标', async ({ page, world }) => {
  await register(page, world, 'unknown-then-store@example.test');
  await openSettings(page);
  let target;
  await page.route('**/api/auth/logout', async route => { target = route.request().postDataJSON().sessionId; await route.abort('failed'); });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  await page.unroute('**/api/auth/logout');
  world.workbench.db.exec("CREATE TRIGGER fail_logout BEFORE UPDATE OF revokedAt ON auth_sessions BEGIN SELECT RAISE(ABORT, 'isolated revocation failure'); END");
  const retry = page.waitForRequest('**/api/auth/logout');
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  expect((await retry).postDataJSON().sessionId).toBe(target);
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  world.workbench.db.exec('DROP TRIGGER fail_logout');
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
});

test('放弃 pending 的撤销处理中编辑字段，确认后保留新输入', async ({ page, world }) => {
  await registrationForm(page, world, 'pending-edit@example.test');
  world.workbench.db.exec("CREATE TRIGGER fail_remember BEFORE UPDATE OF persistence ON auth_sessions WHEN NEW.persistence='remembered' BEGIN SELECT RAISE(ABORT, 'isolated persistence failure'); END");
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByRole('heading', { name: '保存登录状态', exact: true })).toBeVisible();
  world.workbench.db.exec('DROP TRIGGER fail_remember');
  const held = deferred();
  await page.route('**/api/auth/logout', async route => { const response = await route.fetch(); await held.promise; await route.fulfill({ response }); });
  await page.getByRole('button', { name: '返回登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await page.getByLabel('邮箱', { exact: true }).fill('edited@example.test');
  await page.getByLabel('密码', { exact: true }).fill(password);
  held.resolve();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('edited@example.test');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue(password);
});

test('未知发码反馈说明可能收件并保留注册输入', async ({ page, world }) => {
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await page.getByLabel('邮箱', { exact: true }).fill('send-unknown@example.test');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.route('**/api/auth/registration-codes', async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('发送结果暂未确认');
  await expect(page.getByRole('status')).toContainText('可能收到邮件');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue(password);
  expect(world.mailer.lastCode('registration', 'send-unknown@example.test')).toBeTruthy();
});
