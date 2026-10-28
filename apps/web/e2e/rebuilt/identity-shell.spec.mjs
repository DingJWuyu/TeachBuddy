import { test, expect, register, navigate, createQuestion, logout } from './fixture.mjs';

test('真实退出后切换账户隔离保存内容，同账户再次登录可读回', async ({ page, world }) => {
  let activationStarted, releaseActivation;
  const started = new Promise(resolve => { activationStarted = resolve; });
  const released = new Promise(resolve => { releaseActivation = resolve; });
  const gate = async route => {
    if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'activate') {
      activationStarted();
      await released;
    }
    await route.continue();
  };
  await page.route('**/api/auth/session', gate);
  await Promise.all([
    register(page, world, 'first@example.test', '甲老师'),
    (async () => {
      await started;
      try { await expect(page.locator('.wb-shell'), '身份激活确认前不能挂载业务').toHaveCount(0); }
      finally { releaseActivation(); }
    })(),
  ]);
  await page.unroute('**/api/auth/session', gate);
  await createQuestion(page, '甲账户独有题', '甲账户的题干。');
  await logout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await register(page, world, 'second@example.test', '乙老师');
  await navigate(page, '/questions');
  await expect(page.getByText('甲账户独有题', { exact: true })).toHaveCount(0);
  await logout(page);
  await page.getByLabel('邮箱', { exact: true }).fill('first@example.test');
  await page.getByLabel('密码', { exact: true }).fill('browser-password-2026');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  await navigate(page, '/questions');
  await expect(page.locator('.q-list').getByText('甲账户独有题', { exact: true })).toBeVisible();
});

test('设置外观刷新读回，全局搜索 Escape 归焦后键盘可重开，平板入口可达', async ({ page, world }, info) => {
  await register(page, world);
  await page.getByRole('link', { name: /^账户：/ }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '深色', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const search = page.getByRole('button', { name: '全局搜索', exact: true });
  await search.click();
  await expect(page.getByRole('searchbox', { name: '搜索模块', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('searchbox', { name: '搜索模块', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
  await page.getByRole('link', { name: /^题库。/ }).click();
  await expect(page.getByRole('button', { name: '新建题目', exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ animations: 'disabled', path: info.outputPath('tablet-question-library.png') });
});

test('退出已提交但响应丢失时锁住业务，原目标确认后才回登录页', async ({ page, world }) => {
  await register(page, world);
  let lost = false;
  const targets = [];
  await page.route('**/api/auth/logout', async route => {
    targets.push(route.request().postData());
    if (!lost) { lost = true; await route.fetch(); await route.abort('connectionreset'); }
    else await route.continue();
  });
  await logout(page);
  await expect(page.getByText('退出结果暂未确认，业务操作已锁定。请重试确认。', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '重试确认退出', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  expect(targets.length).toBeGreaterThanOrEqual(2);
  expect(targets[1]).toBe(targets[0]);
});
