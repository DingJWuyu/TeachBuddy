import { confirmLogout } from './teaching-time-auth/helpers.mjs';
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
  await page.getByRole('button', { name: /^返回登录(?: ›)?$/ }).click();
  expect((await logout).postDataJSON().sessionId).toBe(pendingId);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
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
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '恢复失败', exact: true })).toBeVisible();
  expect(logins).toBe(0);
  blockPreparation = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await signIn(page, email);
});

test('当前身份可信失效后，同页重新登录已准备浏览器上下文', async ({ page, world, context }) => {
  const email = 'cookie-lost@example.test';
  await register(page, world, email);
  await context.clearCookies();
  await page.locator('a[href^="/resources"]').first().click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: /^返回登录(?: ›)?$/ }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
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
  await confirmLogout(page);
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  const protectedRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/') && !request.url().includes('/api/auth/')) protectedRequests.push(request.url());
  });
  await page.locator('a[href^="/resources"]').first().click();
  await expect(page).toHaveURL(/\/resources/);
  await expect(page.getByRole('alert').filter({ hasText: '退出结果暂未确认' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试确认退出', exact: true })).toBeVisible();
  await expect(page.getByText('结果未确认，请用原请求重试确认', { exact: true })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('logout-resource.png') });
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
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
});

test('资源页直接核实仍沿原退出目标，等待时保留账户提示', async ({ page, world }, testInfo) => {
  await register(page, world, 'resource-confirm@example.test');
  await openSettings(page);
  let target;
  await page.route('**/api/auth/logout', async route => { target = route.request().postDataJSON().sessionId; await route.abort('failed'); });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  await page.locator('a[href^="/resources"]').first().click();
  const confirmation = page.locator('[data-region="logout-confirmation"]');
  await expect(confirmation).toContainText('退出结果暂未确认');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(confirmation.getByRole('button', { name: '重试确认退出', exact: true })).toBeVisible();
    expect(await confirmation.evaluate(element => { const box = element.getBoundingClientRect(); return element.scrollWidth <= box.width + 1; })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`resource-confirm-${viewport.width}.png`) });
  }
  await page.unroute('**/api/auth/logout');
  const held = deferred();
  await page.route('**/api/auth/logout', async route => {
    expect(route.request().postDataJSON().sessionId).toBe(target);
    const response = await route.fetch(); await held.promise; await route.fulfill({ response });
  });
  await confirmation.getByRole('button', { name: '重试确认退出', exact: true }).click();
  await expect(confirmation.getByRole('button', { name: '正在退出…', exact: true })).toBeDisabled();
  await expect(page.getByText('结果未确认，请用原请求重试确认', { exact: true })).toBeHidden();
  held.resolve();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
});

test('设置的多条删除核实入口在三视口中完整可见', async ({ page, world }, testInfo) => {
  await register(page, world, 'deletion-list-layout@example.test');
  // Presentation-only persisted intents. Their unrelated targets must never
  // authorize an API request or replace this page's real active identity.
  await page.evaluate(() => {
    for (const digit of ['a', 'b']) {
      const requestId = digit.repeat(64);
      localStorage.setItem('teachbuddy:account-deletion:v1:' + requestId, JSON.stringify({
        formatVersion: 1, account: { accountKey: digit + '-layout', nickname: 'VeryLongTeacherNicknameWithoutWhitespace', email: digit + '-layout@example.test' },
        locale: 'en', body: { requestId, sessionId: digit + '-layout-session', email: digit + '-layout@example.test' },
      }));
    }
  });
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible();
  await openSettings(page);
  await page.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const buttons = page.getByRole('button', { name: /^Continue verifying account deletion/ });
    await expect(buttons).toHaveCount(2);
    await buttons.last().scrollIntoViewIfNeeded();
    for (const button of await buttons.all()) {
      expect(await button.evaluate(element => {
        const box = element.getBoundingClientRect(), row = element.closest('.settings-row').getBoundingClientRect();
        return element.scrollWidth <= box.width + 1 && element.scrollHeight <= box.height + 1
          && box.left >= row.left && box.right <= row.right + 1;
      })).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`deletion-list-${viewport.width}.png`) });
  }
});

test('另一 remembered 账户不受原账户未决撤销影响', async ({ page, context, world }) => {
  const emailA = 'isolation-a@example.test', emailB = 'isolation-b@example.test';
  await register(page, world, emailA);
  await openSettings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await signIn(page, emailA, { remember: false });
  const other = await context.newPage();
  await register(other, world, emailB);
  await openSettings(page);
  await page.route('**/api/auth/logout', route => route.abort('failed'));
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
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
  await confirmLogout(page);
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  await page.unroute('**/api/auth/logout');
  world.workbench.db.exec("CREATE TRIGGER fail_logout BEFORE UPDATE OF revokedAt ON auth_sessions BEGIN SELECT RAISE(ABORT, 'isolated revocation failure'); END");
  const retry = page.waitForRequest('**/api/auth/logout');
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  expect((await retry).postDataJSON().sessionId).toBe(target);
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  world.workbench.db.exec('DROP TRIGGER fail_logout');
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
});

test('放弃 pending 的撤销处理中编辑字段，确认后保留新输入', async ({ page, world }) => {
  await registrationForm(page, world, 'pending-edit@example.test');
  world.workbench.db.exec("CREATE TRIGGER fail_remember BEFORE UPDATE OF persistence ON auth_sessions WHEN NEW.persistence='remembered' BEGIN SELECT RAISE(ABORT, 'isolated persistence failure'); END");
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByRole('heading', { name: '保存登录状态', exact: true })).toBeVisible();
  world.workbench.db.exec('DROP TRIGGER fail_remember');
  const held = deferred();
  await page.route('**/api/auth/logout', async route => { const response = await route.fetch(); await held.promise; await route.fulfill({ response }); });
  await page.getByRole('button', { name: /^返回登录(?: ›)?$/ }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await page.getByLabel('邮箱', { exact: true }).fill('edited@example.test');
  await page.getByLabel('密码', { exact: true }).fill(password);
  held.resolve();
  await expect(page.getByRole('button', { name: /^登录(?: ›)?$/ })).toBeEnabled();
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('edited@example.test');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue(password);
});

test('未知发码反馈说明可能收件并保留注册输入', async ({ page, world }) => {
  await page.goto(world.origin);
  await page.getByRole('button', { name: /^创建账户(?: ›)?$/ }).click();
  await page.getByLabel('邮箱', { exact: true }).fill('send-unknown@example.test');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.route('**/api/auth/registration-codes', async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('发送结果暂未确认');
  await expect(page.getByRole('status')).toContainText('可能收到邮件');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue(password);
  expect(world.mailer.lastCode('registration', 'send-unknown@example.test')).toBeTruthy();
});
