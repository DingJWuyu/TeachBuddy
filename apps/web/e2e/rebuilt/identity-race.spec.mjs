import { test, expect, register } from './fixture.mjs';

test('D11 两页昵称交错保存，先提交的迟到回执不能覆盖后来已保存昵称', async ({ page, context, world }) => {
  await register(page, world);
  await page.getByRole('link', { name: /^账户：/ }).click();
  const other = await context.newPage();
  await other.goto(world.origin + '/settings');
  await expect(other.getByRole('button', { name: '修改昵称', exact: true })).toBeVisible();
  let holdRead = false, firstReadHeld = false, readArrived, releaseRead;
  const readHeld = new Promise(resolve => { readArrived = resolve; });
  const readGate = new Promise(resolve => { releaseRead = resolve; });
  await page.route('**/api/auth/session', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (holdRead && !firstReadHeld) { firstReadHeld = true; readArrived(); await readGate; }
    await route.fulfill({ response });
  });
  let submitted, release;
  const written = new Promise(resolve => { submitted = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/profile', async route => {
    const response = await route.fetch();
    expect(response.status(), '首次昵称写入必须已经真实提交').toBe(200);
    submitted(); await gate;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('先提交的旧昵称');
  await page.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await written;
  const checked = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/auth/session');
  await other.getByRole('button', { name: '修改昵称', exact: true }).click();
  await other.getByRole('textbox', { name: '昵称', exact: true }).fill('随后保存的新昵称');
  await other.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect(other.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('随后保存的新昵称');
  await (await checked).finished();
  await expect(page.getByRole('textbox', { name: '昵称', exact: true })).toHaveAttribute('readonly', '');
  const oldReceipt = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/profile');
  holdRead = true;
  release();
  const received = await oldReceipt;
  expect(received.status()).toBe(200);
  await received.finished();
  await expect.poll(async () => firstReadHeld || await page.getByRole('textbox', { name: '昵称', exact: true }).count() === 0,
    { message: '旧回执处理已经进入复核或结束保存' }).toBe(true);
  await expect(page.getByRole('link', { name: '账户：先提交的旧昵称', exact: true })).toHaveCount(0);
  await readHeld;
  await other.getByRole('button', { name: '修改昵称', exact: true }).click();
  await other.getByRole('textbox', { name: '昵称', exact: true }).fill('最终保存的新昵称');
  await other.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect(other.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('最终保存的新昵称');
  await expect(page.getByRole('link', { name: '账户：最终保存的新昵称', exact: true })).toBeVisible();
  releaseRead();
  await expect(page.getByRole('textbox', { name: '昵称', exact: true })).toHaveCount(0);
  await expect(page.locator('.settings-nickname-status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('最终保存的新昵称');
  await expect(page.getByRole('link', { name: '账户：最终保存的新昵称', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('最终保存的新昵称');
  await other.close();
});

test('D11 昵称成功后的身份复核迟到不能恢复已退出账户', async ({ page, context, world }) => {
  const preparation = await context.browser().newContext({ ignoreHTTPSErrors: true });
  try { await register(await preparation.newPage(), world, 'next@example.test', '新账户老师'); }
  finally { await preparation.close(); }
  await register(page, world);
  await page.getByRole('link', { name: /^账户：/ }).click();
  const peer = await context.newPage();
  await peer.goto(world.origin + '/settings');
  await expect(peer.getByRole('button', { name: '修改昵称', exact: true })).toBeVisible();
  let submitted, releaseWrite, readArrived, releaseRead, holdRead = false, held = false;
  const written = new Promise(resolve => { submitted = resolve; });
  const writeGate = new Promise(resolve => { releaseWrite = resolve; });
  const readHeld = new Promise(resolve => { readArrived = resolve; });
  const readGate = new Promise(resolve => { releaseRead = resolve; });
  await page.route('**/api/auth/profile', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (!holdRead) { submitted(); await writeGate; }
    await route.fulfill({ response });
  });
  await page.route('**/api/auth/session', async route => {
    const response = await route.fetch();
    if (route.request().method() === 'GET' && holdRead && !held) {
      expect(response.status()).toBe(200); held = true; readArrived(); await readGate;
    }
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('旧账户已提交昵称');
  await page.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await written;
  const checked = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/auth/session');
  await peer.getByRole('button', { name: '修改昵称', exact: true }).click();
  await peer.getByRole('textbox', { name: '昵称', exact: true }).fill('旧账户后续昵称');
  await peer.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect(peer.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('旧账户后续昵称');
  await (await checked).finished();
  holdRead = true; releaseWrite();
  await readHeld;
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await page.locator('dialog.settings-logout-dialog').getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await page.getByLabel('邮箱', { exact: true }).fill('next@example.test');
  await page.getByLabel('密码', { exact: true }).fill('browser-password-2026');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('link', { name: '账户：新账户老师', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  const oldRead = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/auth/session');
  releaseRead();
  await (await oldRead).finished();
  await page.getByRole('link', { name: '账户：新账户老师', exact: true }).click();
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('新账户继续保存');
  await page.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('新账户继续保存');
  await expect(page.getByRole('link', { name: '账户：新账户继续保存', exact: true })).toBeVisible();
  await expect(page.getByText('旧账户后续昵称', { exact: true })).toHaveCount(0);
  await peer.close();
});
