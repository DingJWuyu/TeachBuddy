import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test, expect } from '@playwright/test';
import { startTeachingAuth } from '../teaching-time-auth/service.mjs';
import { register, headers } from '../teaching-time-auth/helpers.mjs';

let world;
let directory;
test.beforeEach(async ({ page }) => {
  world = null;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'teachbuddy-support-'));
  world = await startTeachingAuth({ directory });
  await register(page, world);
  if (await page.getByRole("button", { name: /知道了/ }).count()) await page.getByRole("button", { name: /知道了/ }).first().click();
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (info.status === info.expectedStatus) fs.rmSync(directory, { recursive: true, force: true });
  else console.error(`保留失败现场: ${directory}`);
});

test('两标签页备课输入刷新后各自恢复', async ({ page, context }) => {
  await page.locator('a[href^="/lessons"]').first().click();
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

test('切换模块返回备课编辑现场，数学双标签页草稿独立', async ({ page, context }) => {
  await page.locator('a[href^="/lessons"]').first().click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('跨模块返回现场');
  await page.locator('a[href^="/questions"]').first().click();
  await page.locator('a[href^="/lessons"]').first().click();
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('跨模块返回现场');
  await page.locator('a[href^="/math"]').first().click();
  await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
  await page.getByLabel('作品名称').fill('数学甲草稿');
  await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
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

test('日程自动保存中刷新按原请求确认，后续输入继续保存', async ({ page }) => {
  await page.locator('a[href^="/calendar"]').first().click();
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  const writes = [];
  await page.route('**/api/modules/schedule/entries', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    await route.fetch(); await route.abort('failed');
  });
  await page.getByLabel('标题', { exact: true }).fill('保存中的日程输入');
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.unroute('**/api/modules/schedule/entries');
  await page.getByLabel('标题', { exact: true }).fill('确认期间新增的日程输入');
  const replay = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/schedule/entries'));
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  const request = await replay;
  expect({ key: request.headers()['idempotency-key'], body: request.postData() }).toEqual(writes[0]);
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('确认期间新增的日程输入');
  await expect.poll(async () => {
    const list = await (await page.request.get(world.origin + '/api/modules/schedule/entries', { headers: headers(page) })).json();
    return list.items.map(item => item.title);
  }).toEqual(['确认期间新增的日程输入']);
  await page.reload();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('确认期间新增的日程输入');
});

test('日程删除响应丢失后刷新仍用原键确认', async ({ page }) => {
  await page.locator('a[href^="/calendar"]').first().click();
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('需要确认删除的安排');
  await expect(page.getByRole('status', { name: '已保存', exact: true })).toBeVisible();
  let original;
  await page.route('**/api/modules/schedule/entries/*/deletion', async route => {
    original = { key: route.request().headers()['idempotency-key'], body: route.request().postData() };
    await route.fetch(); await route.abort('failed');
  });
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '删除任务', exact: true }).click();
  await page.getByRole('dialog', { name: '删除任务', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.unroute('**/api/modules/schedule/entries/*/deletion');
  const wait = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/deletion'));
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  const request = await wait;
  expect({ key: request.headers()['idempotency-key'], body: request.postData() }).toEqual(original);
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toHaveCount(0);
  const list = await (await page.request.get(world.origin + '/api/modules/schedule/entries?state=deleted', { headers: headers(page) })).json();
  expect(list.items).toHaveLength(1);
});

test('日程本地草稿重开保留原版本，不覆盖别处修改', async ({ page }) => {
  await page.locator('a[href^="/calendar"]').first().click();
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  const created = page.waitForResponse(res => res.request().method() === 'POST' && res.url().endsWith('/schedule/entries'));
  await page.getByLabel('标题', { exact: true }).fill('日程原始内容');
  const response = await created;
  const entry = await response.json();
  const input = response.request().postDataJSON();
  await expect(page.getByRole('status', { name: '已保存', exact: true })).toBeVisible();
  const updated = await page.request.put(world.origin + '/api/modules/schedule/entries/' + entry.id, {
    headers: { ...headers(page), Origin: world.origin, 'Idempotency-Key': crypto.randomUUID(), 'X-TeachBuddy-Request': '1' },
    data: { ...input, expectedVersion: entry.version, title: '别处已保存内容' }
  });
  expect(updated.ok(), await updated.text()).toBeTruthy();
  await page.getByLabel('标题', { exact: true }).fill('本地未保存内容');
  await expect(page.getByRole('alert')).toContainText('内容已在别处修改');
  await page.getByRole('button', { name: '关闭任务', exact: true }).click();
  const reopened = page.waitForResponse(res => res.request().method() === 'GET'
    && new URL(res.url()).pathname === '/api/modules/schedule/entries/' + entry.id);
  await page.goto(world.origin + '/calendar?entry=' + entry.id);
  const reopenedResponse = await reopened;
  expect(reopenedResponse.ok()).toBeTruthy();
  await reopenedResponse.finished();
  await expect(page.getByRole('button', { name: '读取最新版本', exact: true })).toBeVisible();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('本地未保存内容');
  await page.getByLabel('标题', { exact: true }).fill('重开后继续修改的本地草稿');
  await expect(page.getByRole('alert')).toContainText(/内容已在别处修改|本地输入已保留/);
  const current = await (await page.request.get(world.origin + '/api/modules/schedule/entries/' + entry.id, { headers: headers(page) })).json();
  expect(current.title).toBe('别处已保存内容');
});

test('班级创建输入和记录关联选择刷新恢复', async ({ page }) => {
  await page.locator('a[href^="/classes"]').first().click();
  await page.getByRole('button', { name: '创建班级', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('创建中的班级');
  await page.reload();
  await expect(page.getByLabel('班级名称', { exact: true })).toHaveValue('创建中的班级');
  await page.getByRole('dialog', { name: '创建班级' }).getByRole('button', { name: '创建班级', exact: true }).click();
  await page.getByLabel('写一句', { exact: true }).fill('待补充关联资料的记录');
  await page.getByRole('button', { name: '关联资料', exact: true }).click();
  await page.getByRole('tab', { name: '题目', exact: true }).click();
  await page.getByLabel('搜索资料').fill('保持筛选');
  await page.reload();
  await expect(page.getByRole('dialog', { name: '关联资料' })).toBeVisible();
  await expect(page.getByLabel('搜索资料')).toHaveValue('保持筛选');
});

test('数学预览参数和工具展开位置重开，不改作品源码', async ({ page }) => {
  await page.locator('a[href^="/math"]').first().click();
  await page.getByRole('button', { name: '新建动态演示', exact: true }).first().click();
  await page.getByLabel('作品名称').fill('独立预览参数');
  // 演示从空画布开始，先选含 a 参数的真实起点。
  await page.getByRole('button', { name: '试试二次函数演示', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.math-workspace-status')).toHaveText('已保存');
  await page.getByLabel('a 数值', { exact: true }).fill('2.5');
  await page.getByRole('button', { name: '设置滑杆', exact: true }).click();
  await page.getByRole('button', { name: '下载演示', exact: true }).click();
  await page.getByLabel('导出格式').selectOption('source');
  await page.reload();
  await expect(page.getByLabel('a 数值', { exact: true })).toHaveValue('2.5');
  await expect(page.getByLabel('导出格式')).toHaveValue('source');
  const list = await (await page.request.get(world.origin + '/api/modules/math/v1/works', { headers: headers(page) })).json();
  const work = await (await page.request.get(world.origin + '/api/modules/math/v1/works/' + list.items[0].id, { headers: headers(page) })).json();
  expect(work.source.parameters.find(parameter => parameter.name === 'a').initial).toBe(1);
});

test('资源两标签页上传互不覆盖，原文件确认后筛选与视图重开', async ({ page, context }) => {
  await page.locator('a[href^="/resources"]').first().click();
  await expect(page.getByLabel(/^上传(第一份)?资料$/)).toBeEnabled();
  const second = await context.newPage(); await second.goto(world.origin + '/resources');
  await expect(second.getByLabel(/^上传(第一份)?资料$/)).toBeEnabled();
  const buffer = fs.readFileSync('apps/web/e2e/fixtures/materials-resources/samples/page.png');
  let key;
  await page.route('**/api/workbench/files', async route => {
    key = route.request().headers()['idempotency-key']; await route.fetch(); await route.abort();
  });
  await page.getByLabel(/^上传(第一份)?资料$/).setInputFiles({ name: '甲页原图.png', mimeType: 'image/png', buffer });
  await expect(page.getByRole('button', { name: '重试确认原请求' })).toBeVisible();
  await second.getByLabel(/^上传(第一份)?资料$/).setInputFiles({ name: '乙页原图.png', mimeType: 'image/png', buffer });
  await expect(second.getByRole('heading', { name: '乙页原图.png', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel('重新选择原文件')).toBeVisible();
  await page.unroute('**/api/workbench/files');
  let replayCount = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/workbench/files')) replayCount += 1; });
  const different = Buffer.from(buffer); different[different.length - 1] ^= 1;
  await page.getByLabel('重新选择原文件').setInputFiles({ name: '甲页原图.png', mimeType: 'image/png', buffer: different });
  await expect(page.getByRole('alert')).toContainText('内容不匹配');
  expect(replayCount).toBe(0);
  const replay = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/api/workbench/files'));
  await page.getByLabel('重新选择原文件').setInputFiles({ name: '甲页原图.png', mimeType: 'image/png', buffer });
  expect((await replay).headers()['idempotency-key']).toBe(key);
  await expect(page.getByRole('heading', { name: '甲页原图.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回资源库', exact: true }).click();
  await expect(page.locator('.res-card')).toHaveCount(2);
  await page.getByLabel('搜索资料').fill('甲页');
  await page.getByRole('button', { name: '列表视图', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('搜索资料')).toHaveValue('甲页');
  await expect(page.getByRole('button', { name: '缩略图视图', exact: true })).toBeVisible();
  await expect(page.locator('.res-card')).toHaveCount(1);
  await second.close();
});

test('题库原文件刷新重选以同一摘要和原键确认，不启动整理模型', async ({ page }) => {
  await page.locator('a[href^="/questions"]').first().click();
  await page.locator('.q-finder').getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传图片 截图/ }).click();
  const file = { name: '待确认题面.png', mimeType: 'image/png', buffer: fs.readFileSync('apps/web/e2e/fixtures/materials-resources/samples/page.png') };
  const keys = [];
  const inputs = [];
  await page.route('**/api/modules/questions/v2/imports', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    inputs.push(route.request().postDataJSON());
    // Stop before extraction: this test exercises file recovery only.
    await route.fulfill({ status: 422, contentType: 'application/problem+json', body: JSON.stringify({ type: '/problems/workbench/invalid-input', field: '/input', reason: 'invalid-type' }) });
  });
  await page.route('**/api/workbench/files', async route => {
    keys.push(route.request().headers()['idempotency-key']);
    const response = await route.fetch();
    if (keys.length === 1) await route.abort(); else await route.fulfill({ response });
  });
  await page.getByLabel('选择原稿').setInputFiles(file);
  await page.getByRole('button', { name: '开始整理' }).click();
  await expect(page.getByRole('button', { name: '开始整理' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('dialog', { name: '从资料收录题目' })).toBeVisible();
  await page.getByLabel('选择原稿').setInputFiles(file);
  await page.getByRole('button', { name: '开始整理' }).click();
  await expect.poll(() => inputs.length).toBe(1);
  expect(keys).toHaveLength(2); expect(keys[1]).toBe(keys[0]);
  await page.reload();
  await page.getByLabel('选择原稿').setInputFiles(file);
  await page.getByRole('button', { name: '开始整理' }).click();
  await expect.poll(() => inputs.length).toBe(2);
  expect(keys).toHaveLength(2);
  expect(inputs[1].input).toEqual(inputs[0].input);
});

test('数学 HTML 上传重开后校验原文件并以原键确认', async ({ page }) => {
  await page.locator('a[href^="/math"]').first().click();
  const file = { name: '课堂演示.html', mimeType: 'text/html', buffer: Buffer.from('<!doctype html><html><body><h1>课堂演示</h1></body></html>') };
  let key;
  await page.route('**/api/workbench/files', async route => { key = route.request().headers()['idempotency-key']; await route.fetch(); await route.abort(); });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入已有 HTML 演示', exact: true }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByRole('button', { name: '重试原文件上传' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '重选原文件并确认上传' })).toBeVisible();
  await page.unroute('**/api/workbench/files');
  const replay = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/workbench/files'));
  await page.getByLabel('导入 HTML 文件').setInputFiles(file);
  expect((await replay).headers()['idempotency-key']).toBe(key);
  await expect(page.getByLabel('作品名称')).toHaveValue('课堂演示.html');
  await expect(page.getByRole('button', { name: '重选原文件并确认上传' })).toHaveCount(0);
});

test('返回备课标签页读取最新内容，有本地修改时只显示对照', async ({ page, context }) => {
  await page.locator('a[href^="/lessons"]').first().click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('前台刷新基线');
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /clean|saved/);
  const second = await context.newPage(); await second.goto(page.url());
  await second.getByLabel('课题', { exact: true }).fill('另一标签的第一版');
  await second.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(second.locator('[data-save-status]')).toHaveAttribute('data-save-status', /clean|saved/);
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('另一标签的第一版');
  await page.getByLabel('课题', { exact: true }).fill('当前标签未保存稿');
  await second.bringToFront();
  await second.getByLabel('课题', { exact: true }).fill('另一标签的第二版');
  await second.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(second.locator('[data-save-status]')).toHaveAttribute('data-save-status', /clean|saved/);
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('当前标签未保存稿');
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await second.close();
});
