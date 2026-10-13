import { test, expect, registrationForm, deferred, password } from './fixtures/auth-completeness.js';

async function holdPreflight(page) {
  const waiting = deferred();
  const reached = deferred();
  const delivered = deferred();
  let reads = 0;
  await page.route('**/api/auth/session', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    reads++;
    if (reads !== 1) return route.continue();
    const response = await route.fetch();
    reached.resolve();
    await waiting.promise;
    await route.fulfill({ response });
    delivered.resolve();
  });
  return { waiting, reached, delivered, reads: () => reads };
}

async function settlePreflight(page, held) {
  const response = page.waitForResponse(response => response.url().endsWith('/api/auth/session') && response.request().method() === 'GET');
  held.waiting.resolve();
  await response;
  await held.delivered.promise;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('注册预读中切回登录不创建账户或交接身份', async ({ page, world }, info) => {
  await registrationForm(page, world, 'forms-switch@example.test');
  let registrations = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/register')) registrations++; });
  const held = await holdPreflight(page);
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await held.reached.promise;
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await settlePreflight(page, held);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await expect(page.locator('.wb-shell')).toHaveCount(0);
  expect(registrations).toBe(0);
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('forms-switch@example.test');
  await page.screenshot({ path: info.outputPath('preflight-switch.png') });
});

test('注册预读中重复 Enter 只保留一次预读，编辑后旧结果不能提交，最新输入可正常注册', async ({ page, world }, info) => {
  await registrationForm(page, world, 'forms-edit@example.test');
  const registrations = [];
  page.on('request', request => { if (request.url().endsWith('/api/auth/register')) registrations.push(request.postDataJSON()); });
  const held = await holdPreflight(page);
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await held.reached.promise;
  await page.getByLabel('确认密码', { exact: true }).press('Enter');
  await page.getByLabel('确认密码', { exact: true }).press('Enter');
  expect(held.reads()).toBe(1);
  await page.getByLabel('昵称', { exact: true }).fill('最新昵称');
  await settlePreflight(page, held);
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('最新昵称');
  await expect(page.getByRole('button', { name: '注册', exact: true })).toBeEnabled();
  expect(registrations).toHaveLength(0);
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
  await page.screenshot({ path: info.outputPath('preflight-edit.png'), mask: [page.locator('#ae-code')] });
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  expect(registrations).toHaveLength(1);
  expect(registrations[0].nickname).toBe('最新昵称');
  await expect(page.locator('.tb-account-row')).toHaveAccessibleName('账户：最新昵称');
});

test('发码等待不显示注册进展，真实注册提交才显示注册中', async ({ page, world }, info) => {
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await page.getByLabel('邮箱', { exact: true }).fill('forms-progress@example.test');
  world.mailer.pauseNext();
  try {
    await page.getByRole('button', { name: '发送验证码', exact: true }).click();
    await expect(page.getByRole('button', { name: '发送中', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '注册', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '注册中', exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('send-progress.png') });
  } finally { world.mailer.release(); }
  await expect(page.getByLabel('邮箱验证码')).toBeVisible();
  await page.getByLabel('昵称', { exact: true }).fill('阶段教师');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码', { exact: true }).fill(password);
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'forms-progress@example.test'));
  await page.getByRole('checkbox').check();
  const waiting = deferred();
  await page.route('**/api/auth/register', async route => {
    await waiting.promise;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: '注册', exact: true }).click();
    await expect(page.getByRole('button', { name: '注册中', exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('register-progress.png'), mask: [page.locator('#ae-code')] });
  } finally { waiting.resolve(); }
  await expect(page.locator('.wb-shell')).toBeVisible();
});
