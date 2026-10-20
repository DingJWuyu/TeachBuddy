import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';
import { currentApi, installMathProbe, enterMath, savedMath } from './math-unified-helpers.mjs';
let world;
test.beforeEach(async ({ page }, info) => {
  world = await createIntegration({ webDist: path.resolve(process.env.WORKBENCH_WEB_DIST ?? 'apps/web/dist') });
  await installMathProbe(page);
  await register(page, world, `protect-${info.testId.replace(/[^a-z0-9]/gi,'')}@example.test`);
  const tutorial = page.getByRole('button', { name: '知道了', exact: true }); if (await tutorial.isVisible()) await tutorial.click();
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
});
test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) page = page.context().pages().at(-1);
  if (info.status !== info.expectedStatus) { await page.screenshot({ path: info.outputPath('failure.png') }); fs.writeFileSync(info.outputPath('device.json'), JSON.stringify(await page.context().storageState())); fs.writeFileSync(info.outputPath('world.json'), JSON.stringify({ directory:world.directory })); }
  await world.close(); if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive:true, force:true });
});
async function module(page, name) { await page.getByRole('navigation', { name:'功能模块',exact:true }).getByRole('link', { name:new RegExp(`^${name}`) }).click(); }
async function coords(page, name) { await expect.poll(async () => (await currentApi(page,name))?.exists, { timeout:90000 }).toBe(true); return (await currentApi(page,name)).coords; }
test('即时返回、切模块、刷新和正常关闭保留统一作品，已保存状态正确', async ({ page, context }) => {
  await enterMath(page,'A=(2,3)','A');
  await page.getByRole('button',{name:'返回工坊',exact:true}).click(); await page.locator('.tbx-mw-card>button').click();
  expect(await coords(page,'A')).toEqual([2,3]);
  await enterMath(page,'B=(5,7)','B'); await module(page,'资源库'); await module(page,'数学工坊');
  expect(await coords(page,'B')).toEqual([5,7]);
  await enterMath(page,'C=(9,10)','C'); await page.reload(); expect(await coords(page,'C')).toEqual([9,10]);
  await enterMath(page,'D=(11,12)','D'); const address=page.url(); await page.close({runBeforeUnload:true});
  page=await context.newPage(); await installMathProbe(page); await page.goto(address); expect(await coords(page,'D')).toEqual([11,12]);
  await savedMath(page); await module(page,'资源库'); await module(page,'数学工坊');
  await expect(page.locator('.mw-save-state')).toHaveText('已保存'); expect(await coords(page,'A')).toEqual([2,3]);
});
test('409 保留当前修改，取消读取保留现场，再按服务器基线保存与另存', async ({ page }) => {
  await enterMath(page,'A=(2,3)','A'); const first=await savedMath(page);
  let server;
  await page.route(`**/api/modules/math/v1/works/${first.id}`, async route => {
    const request=route.request(); if(request.method()!=='PUT') return route.continue();
    if (!server) {
      const original=JSON.parse(request.postData()); const headers=request.headers();
      const advanced=await route.fetch({ headers:{...headers,'idempotency-key':crypto.randomUUID()}, postData:JSON.stringify({...original, title:'服务器作品', source:first.source}) });
      expect(advanced.status()).toBe(200); server=await advanced.json();
    }
    await route.continue();
  });
  await enterMath(page,'A=(8,9)','A'); await expect(page.getByRole('button',{name:'读取服务器作品',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'读取服务器作品',exact:true}).click(); await page.getByRole('alertdialog').getByRole('button',{name:'取消',exact:true}).click();
  expect(await coords(page,'A')).toEqual([8,9]);
  await page.getByRole('button',{name:'以服务器版本为基线保留本地内容',exact:true}).click(); const latest=await savedMath(page);
  expect(latest.id).toBe(first.id); expect(latest.version).toBe(server.version+1); expect(await coords(page,'A')).toEqual([8,9]);
  await page.unroute(`**/api/modules/math/v1/works/${first.id}`);
  await page.getByLabel('更多作品操作',{exact:true}).click(); await page.getByRole('menuitem',{name:'另存作品',exact:true}).click();
  const copied=await savedMath(page); expect(copied.id).not.toBe(first.id); expect(await coords(page,'A')).toEqual([8,9]);
});

test('保存响应丢失后同键确认，保留随后编辑且不重复创建作品', async ({ page }) => {
  let intercepted = false; let originalRequest; let savedOnServer;
  await page.route('**/api/modules/math/v1/works', async route => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true; originalRequest = route.request(); const result = await route.fetch(); expect(result.status()).toBe(201); savedOnServer = await result.json(); await route.abort('failed');
  });
  await enterMath(page,'A=(2,3)','A'); await expect(page.locator('.mw-save-state')).toHaveText('待确认');
  await enterMath(page,'B=(5,6)','B');
  const confirmation = page.waitForRequest(request => request.method()==='POST' && request.url().endsWith('/works'));
  await page.getByRole('button',{ name:'确认结果', exact:true }).click(); const request=await confirmation;
  expect(request.headers()['idempotency-key']).toBe(originalRequest.headers()['idempotency-key']); expect(request.postData()).toBe(originalRequest.postData());
  const saved=await savedMath(page); expect(saved.id).toBe(savedOnServer.id); expect(saved.version).toBe(savedOnServer.version+1); expect(await coords(page,'B')).toEqual([5,6]);
  await page.getByRole('button',{name:'返回工坊',exact:true}).click(); await expect(page.locator('.tbx-mw-card')).toHaveCount(1);
});
