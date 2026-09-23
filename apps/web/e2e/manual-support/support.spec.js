import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { startTeachingAuth } from '../teaching-time-auth/service.mjs';
import { register, login, logout, headers } from '../teaching-time-auth/helpers.mjs';

let world;
let directory;
test.beforeEach(async ({ page }) => {
  directory = fs.mkdtempSync(path.resolve('.tmp-ms/support-'));
  world = await startTeachingAuth({ directory });
  await register(page, world);
});
test.afterEach(async () => { await world?.close(); });

test('支持页面、偏好保存与重开', async ({ page }) => {
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.getByLabel('阅读字号')).toBeVisible();
  await page.getByLabel('阅读字号').selectOption('large');
  await page.getByLabel('界面动效').selectOption('reduce');
  await page.getByRole('button', { name: '保存偏好', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-reading-size', 'large');
  await page.reload();
  await expect(page.getByLabel('阅读字号')).toHaveValue('large');
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-motion', 'reduce');
  await page.getByRole('link', { name: '使用帮助', exact: true }).click();
  await expect(page.getByRole('heading', { name: '使用帮助', exact: true })).toBeVisible();
  await expect(page.locator('[data-region="auxiliary"]')).toHaveCount(0);
  await page.getByRole('link', { name: '版本记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '版本记录', exact: true })).toBeVisible();
  await logout(page);
  await login(page);
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.getByLabel('阅读字号')).toHaveValue('large');
});

test('偏好响应丢失后按原键确认、冲突对照与服务重启', async ({ page, browser }) => {
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.getByLabel('阅读字号')).toHaveValue('standard');
  const writes = [];
  await page.route('**/api/reliability/v1/preferences', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    await route.fetch(); await route.abort();
  });
  await page.getByLabel('阅读字号').selectOption('large');
  await page.getByRole('button', { name: '保存偏好', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.unroute('**/api/reliability/v1/preferences');
  page.on('request', req => { if (req.method() === 'PUT' && req.url().endsWith('/preferences')) writes.push({ key: req.headers()['idempotency-key'], body: req.postData() }); });
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
  expect(writes[1]).toEqual(writes[0]);
  await page.getByLabel('阅读字号').selectOption('standard');
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  const second = await other.newPage();
  await second.goto(world.origin); await login(second);
  await second.getByRole('link', { name: '设置', exact: true }).click();
  await second.getByLabel('界面动效').selectOption('reduce');
  await second.getByRole('button', { name: '保存偏好', exact: true }).click();
  await expect(second.locator('[data-save-status="saved"]')).toBeVisible();
  await page.getByRole('button', { name: '保存偏好', exact: true }).click();
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await expect(page.getByLabel('阅读字号')).toHaveValue('standard');
  await page.getByRole('button', { name: '查看服务器版本' }).click();
  await expect(page.locator('[data-region="server-version"]')).toContainText('大字号');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '采用服务器版本' }).click();
  await expect(page.getByLabel('界面动效')).toHaveValue('reduce');
  const port = Number(new URL(world.origin).port);
  await world.close(); world = await startTeachingAuth({ directory, port });
  await page.reload();
  await expect(page.getByLabel('阅读字号')).toHaveValue('large');
  await expect(page.getByLabel('界面动效')).toHaveValue('reduce');
  await other.close();
});

test('清理保留未确认操作、其他账户和损坏原文，删除失败不报成功', async ({ page }) => {
  const context = await (await page.request.get(world.origin + '/api/workbench/context', { headers: headers(page) })).json();
  const account = context.accountKey;
  await page.evaluate(account => {
    const prefix = `tb.workbench.v1:${account}:`;
    localStorage.setItem(prefix + 'draft:lesson:new', JSON.stringify({ input: { title: '保留未确认输入' }, pending: { key: 'test' } }));
    localStorage.setItem(prefix + 'questions-materials-draft:new:new', JSON.stringify({ title: '可清理' }));
    localStorage.setItem(prefix + 'scene:resources', '{broken');
    localStorage.setItem('tb.workbench.v1:someone-else:draft:lesson:new', 'foreign');
  }, account);
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.locator('[data-field="draft-count"]')).toContainText('1 项待确认');
  await page.evaluate(() => { window.originalRemove = Storage.prototype.removeItem; Storage.prototype.removeItem = function() { throw new Error('storage denied'); }; });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清除本设备草稿' }).click();
  await expect(page.getByRole('alert')).toContainText('storage denied');
  await page.evaluate(() => { Storage.prototype.removeItem = window.originalRemove; });
  await page.getByRole('button', { name: '重新检查' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '清除本设备草稿' }).click();
  await expect(page.getByText(/已清除本设备可清理/)).toBeVisible();
  const values = await page.evaluate(account => {
    const prefix = `tb.workbench.v1:${account}:`;
    return ['draft:lesson:new', 'questions-materials-draft:new:new', 'scene:resources'].map(name => localStorage.getItem(prefix + name))
      .concat(localStorage.getItem('tb.workbench.v1:someone-else:draft:lesson:new'));
  }, account);
  expect(values[0]).toContain('保留未确认输入'); expect(values[1]).toBeNull(); expect(values[2]).toBe('{broken'); expect(values[3]).toBe('foreign');
});

test('两标签页备课输入刷新后各自恢复', async ({ page, context }) => {
  await page.getByRole('link', { name: '备课', exact: true }).click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('标签甲独立草稿');
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(second.getByLabel('课题', { exact: true })).toHaveValue('标签甲独立草稿');
  await second.getByLabel('课题', { exact: true }).fill('标签乙独立草稿');
  await page.reload();
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('标签甲独立草稿');
  await second.reload();
  await expect(second.getByLabel('课题', { exact: true })).toHaveValue('标签乙独立草稿');
  await second.close();
});

test('偏好 API 认证、校验、幂等与版本保护', async ({ page, playwright }) => {
  const endpoint = world.origin + '/api/reliability/v1/preferences';
  const anonymous = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  expect((await anonymous.get(endpoint)).status()).toBe(401);
  await anonymous.dispose();
  const get = await page.request.get(endpoint, { headers: headers(page) });
  expect(get.headers()['cache-control']).toBe('no-store');
  expect(await get.json()).toEqual({ version: 1, updatedAt: null, values: { readingSize: 'standard', motion: 'system', externalAi: 'deepseek' } });
  const data = { baseVersion: 1, values: { readingSize: 'large', motion: 'reduce', externalAi: 'doubao' } };
  const requestHeaders = { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': crypto.randomUUID() };
  expect((await page.request.put(endpoint, { headers: headers(page), data })).status()).toBe(403);
  expect((await page.request.put(endpoint, { headers: requestHeaders, data: { ...data, extra: true } })).status()).toBe(422);
  expect((await page.request.get(endpoint + '?extra=true', { headers: headers(page) })).status()).toBe(422);
  const first = await page.request.put(endpoint, { headers: requestHeaders, data });
  expect(first.status()).toBe(200);
  const saved = await first.json(); expect(saved.version).toBe(2);
  const replay = await page.request.put(endpoint, { headers: requestHeaders, data });
  expect(await replay.json()).toEqual(saved);
  expect((await page.request.put(endpoint, { headers: { ...requestHeaders, 'Idempotency-Key': crypto.randomUUID() }, data })).status()).toBe(409);
  expect((await page.request.put(endpoint, { headers: requestHeaders, data: { ...data, baseVersion: 2 } })).status()).toBe(409);
});

test('支持页桌面与平板布局', async ({ page }) => {
  const evidence = path.resolve('docs/acceptance/evidence/MANUAL-SUPPORT/v1/browser'); fs.mkdirSync(evidence, { recursive: true });
  for (const width of [1440, 820]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['settings', 'help', 'releases']) {
      await page.goto(world.origin + '/' + route);
      await expect(page.locator(`[data-region="${route}"]`)).toBeVisible();
      if (route === 'settings') await expect(page.getByLabel('阅读字号')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(evidence, `${route}-${width}.png`) });
    }
  }
});

test('切换模块返回备课编辑现场，数学双标签页草稿独立', async ({ page, context }) => {
  await page.getByRole('link', { name: '备课', exact: true }).click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('跨模块返回现场');
  await page.getByRole('link', { name: '题库', exact: true }).click();
  await page.getByRole('link', { name: '备课', exact: true }).click();
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('跨模块返回现场');
  await page.getByRole('link', { name: '数学工坊', exact: true }).click();
  await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
  await page.getByLabel('作品名称').fill('数学甲草稿');
  await page.getByLabel('LaTeX', { exact: true }).fill('x^2+1');
  const second = await context.newPage(); await second.goto(page.url());
  await expect(second.getByLabel('作品名称')).toHaveValue('数学甲草稿');
  await second.getByLabel('作品名称').fill('数学乙草稿');
  await second.getByLabel('LaTeX', { exact: true }).fill('y^2+2');
  await page.reload();
  await expect(page.getByLabel('作品名称')).toHaveValue('数学甲草稿');
  await expect(page.getByLabel('LaTeX', { exact: true })).toHaveValue('x^2+1');
  await second.reload(); await expect(second.getByLabel('LaTeX', { exact: true })).toHaveValue('y^2+2');
  await second.close();
});
