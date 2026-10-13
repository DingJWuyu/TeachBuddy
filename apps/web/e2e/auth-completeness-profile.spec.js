import { test, expect, deferred, register, signIn, openSettings, removeAccount } from './fixtures/auth-completeness.js';

test('退出未决时保留当前核实目标，不能切入另一账户删除核实', async ({ page, browser, world }, info) => {
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try { await register(await other.newPage(), world, 'pending-logout-b@example.test'); }
  finally { await other.close(); }
  await register(page, world, 'pending-delete-a@example.test');
  await page.route('**/api/auth/account-deletion', route => route.abort('failed'));
  await removeAccount(page, 'pending-delete-a@example.test');
  await expect(page.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '稍后核实，登录其他账户', exact: true }).click();
  await signIn(page, 'pending-logout-b@example.test');
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await openSettings(page);
  let target;
  const held = deferred();
  await page.route('**/api/auth/logout', async route => {
    target = route.request().postDataJSON().sessionId;
    await held.promise;
    return route.abort('failed');
  });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: '正在退出…', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '继续核实账户删除', exact: true })).toBeDisabled();
  } finally { held.release(); }
  await expect(page.getByRole('alert').filter({ hasText: '退出结果暂未确认' })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续核实账户删除', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '重试确认退出', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('logout-blocks-deletion-390.png') });
  await page.unroute('**/api/auth/logout');
  const retry = page.waitForRequest('**/api/auth/logout');
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  expect((await retry).postDataJSON().sessionId).toBe(target);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
});

test('退出处理中及结果未知时昵称不能绕过身份锁提交', async ({ page, world }) => {
  await register(page, world, 'profile-logout@example.test');
  await openSettings(page);
  const held = deferred();
  let writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/profile')) writes++; });
  await page.route('**/api/auth/logout', async route => { await held.promise; await route.abort('failed'); });
  try {
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(page.getByRole('button', { name: '正在退出…', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '修改昵称', exact: true }).click();
    const input = page.getByRole('textbox', { name: '昵称', exact: true });
    await input.fill('不应提交的昵称'); await input.press('Enter');
    await expect(page.getByText('登录状态已变化，请重新登录。', { exact: true })).toBeVisible();
    held.release();
    await expect(page.getByRole('alert').filter({ hasText: '退出结果暂未确认' })).toBeVisible();
    await input.press('Enter');
    await expect(input).toHaveValue('不应提交的昵称');
    await expect(page.locator('.tb-account-row')).toContainText('核查教师');
    expect(writes).toBe(0);
    expect(world.workbench.db.prepare('SELECT nickname FROM auth_accounts').get().nickname).toBe('核查教师');
    await page.unroute('**/api/auth/logout');
    await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  } finally { held.release(); }
});

test('昵称迟到回执不能复活已删除账户或移除删除核实状态', async ({ page, world }) => {
  const email = 'profile-delete@example.test';
  await register(page, world, email);
  await openSettings(page);
  const held = deferred();
  const committed = deferred();
  await page.route('**/api/auth/profile', async route => {
    const response = await route.fetch(); committed.resolve();
    await held.promise; await route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: '修改昵称', exact: true }).click();
    const input = page.getByRole('textbox', { name: '昵称', exact: true });
    await input.fill('删除前已保存'); await input.press('Enter');
    await committed.promise;
    await page.route('**/api/auth/account-deletion', async route => { await route.fetch(); await route.abort('failed'); });
    await removeAccount(page, email);
    await expect(page.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
    const response = page.waitForResponse('**/api/auth/profile');
    held.release(); await response;
    await expect(page.locator('.wb-shell')).toBeHidden();
    await expect(page.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
    expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
    await page.unroute('**/api/auth/account-deletion');
    await page.getByRole('button', { name: '重试核实删除', exact: true }).click();
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  } finally { held.release(); }
});

test('A删除未决时B改名保留工作台和核实入口，刷新后仍隔离账户', async ({ page, browser, world }, info) => {
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try { await register(await other.newPage(), world, 'profile-b@example.test'); }
  finally { await other.close(); }
  await register(page, world, 'profile-a@example.test');
  await page.route('**/api/auth/account-deletion', route => route.abort('failed'));
  await removeAccount(page, 'profile-a@example.test');
  await expect(page.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
  const records = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('teachbuddy:account-deletion:v1:')));
  await page.getByRole('button', { name: '稍后核实，登录其他账户', exact: true }).click();
  await signIn(page, 'profile-b@example.test');
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await openSettings(page);
  const mounted = await page.locator('.wb-shell').elementHandle();
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  const input = page.getByRole('textbox', { name: '昵称', exact: true });
  await input.fill('乙账户新昵称'); await input.press('Enter');
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('乙账户新昵称');
  expect(await mounted.evaluate(element => element.isConnected)).toBe(true);
  await expect(page.getByRole('button', { name: '继续核实账户删除', exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('teachbuddy:account-deletion:v1:')))).toEqual(records);
  await page.reload();
  await expect(page.locator('.tb-account-row')).toContainText('乙账户新昵称');
  await page.getByRole('button', { name: '继续核实账户删除', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('nickname-with-pending-deletion.png') });
  await page.getByRole('button', { name: '继续核实账户删除', exact: true }).click();
  await expect(page.getByText('profile-a@example.test', { exact: true })).toBeVisible();
  expect(world.workbench.db.prepare('SELECT nickname FROM auth_accounts WHERE email=?').get('profile-b@example.test').nickname).toBe('乙账户新昵称');
});
