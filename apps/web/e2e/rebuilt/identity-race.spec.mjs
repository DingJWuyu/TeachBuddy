import { test, expect, register } from './fixture.mjs';

test('D11 两页昵称交错保存，先提交的迟到回执不能覆盖后来已保存昵称', async ({ page, context, world }) => {
  await register(page, world);
  await page.getByRole('link', { name: /^账户：/ }).click();
  const other = await context.newPage();
  await other.goto(world.origin + '/settings');
  await expect(other.getByRole('button', { name: '修改昵称', exact: true })).toBeVisible();
  let submitted, release;
  const written = new Promise(resolve => { submitted = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/profile', async route => {
    const response = await route.fetch();
    submitted(); await gate;
    await route.fulfill({ response });
  }, { times: 1 });
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('先提交的旧昵称');
  await page.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await written;
  const checked = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/auth/session');
  await other.getByRole('button', { name: '修改昵称', exact: true }).click();
  await other.getByRole('textbox', { name: '昵称', exact: true }).fill('随后保存的新昵称');
  await other.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect(other.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('随后保存的新昵称');
  await checked;
  release();
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('随后保存的新昵称');
  await expect(page.getByRole('link', { name: '账户：随后保存的新昵称', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('随后保存的新昵称');
  await other.close();
});
