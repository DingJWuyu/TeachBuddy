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

test('日程保存中重开按原请求确认，后续输入不冒充已保存', async ({ page }) => {
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await page.getByRole('button', { name: '记一件事', exact: true }).click();
  await page.getByLabel('事项 1', { exact: true }).fill('保存中的日程输入');
  let release; const held = new Promise(resolve => { release = resolve; });
  let original;
  await page.route('**/api/modules/schedule/entries', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    original = { key: route.request().headers()['idempotency-key'], body: route.request().postData() };
    const response = await route.fetch(); await held;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.locator('[data-action="save"]').click();
  await expect.poll(() => original).toBeTruthy();
  await page.reload(); release();
  await page.unroute('**/api/modules/schedule/entries');
  await expect(page.getByRole('button', { name: '用原请求重试', exact: true })).toBeVisible();
  await page.getByLabel('事项 1', { exact: true }).fill('确认期间新增的日程输入');
  const replay = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/schedule/entries'));
  await page.getByRole('button', { name: '用原请求重试', exact: true }).click();
  const request = await replay;
  expect({ key: request.headers()['idempotency-key'], body: request.postData() }).toEqual(original);
  await expect(page.locator('[data-region="save-state"]')).toContainText('未保存');
  await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('确认期间新增的日程输入');
  await page.locator('[data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toHaveText('已保存');
  await page.reload(); await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('确认期间新增的日程输入');
  const list = await (await page.request.get(world.origin + '/api/modules/schedule/entries', { headers: headers(page) })).json();
  expect(list.items).toHaveLength(1);
});

test('日程删除响应丢失后刷新仍用原键确认', async ({ page }) => {
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await page.getByRole('button', { name: '记一件事', exact: true }).click();
  await page.getByLabel('事项 1', { exact: true }).fill('需要确认删除的安排');
  await page.locator('[data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toHaveText('已保存');
  let original;
  await page.route('**/api/modules/schedule/entries/*/deletion', async route => {
    original = { key: route.request().headers()['idempotency-key'], body: route.request().postData() };
    await route.fetch(); await route.abort();
  });
  await page.locator('[data-action="delete-entry"]').click();
  await expect(page.getByRole('button', { name: '用原请求确认', exact: true })).toBeVisible();
  await page.reload(); await page.unroute('**/api/modules/schedule/entries/*/deletion');
  await expect(page.getByRole('button', { name: '用原请求确认', exact: true })).toBeVisible();
  const wait = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith('/deletion'));
  await page.getByRole('button', { name: '用原请求确认', exact: true }).click();
  const request = await wait;
  expect({ key: request.headers()['idempotency-key'], body: request.postData() }).toEqual(original);
  await expect(page.getByRole('button', { name: '用原请求确认', exact: true })).toHaveCount(0);
  const list = await (await page.request.get(world.origin + '/api/modules/schedule/entries?state=deleted', { headers: headers(page) })).json();
  expect(list.items).toHaveLength(1);
});

test('日程关闭草稿再打开仍保留原版本，不覆盖别处修改', async ({ page }) => {
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await page.getByRole('button', { name: '记一件事', exact: true }).click();
  await page.getByLabel('事项 1', { exact: true }).fill('日程原始内容');
  const created = page.waitForResponse(res => res.request().method() === 'POST' && res.url().endsWith('/schedule/entries'));
  await page.locator('[data-action="save"]').click();
  const response = await created;
  const entry = await response.json();
  const input = response.request().postDataJSON();
  await expect(page.locator('[data-region="save-state"]')).toHaveText('已保存');
  await page.getByLabel('事项 1', { exact: true }).fill('本地未保存内容');
  await page.locator('[data-action="cancel"]').click();
  const updated = await page.request.put(world.origin + '/api/modules/schedule/entries/' + entry.id, {
    headers: { ...headers(page), Origin: world.origin, 'Idempotency-Key': crypto.randomUUID(), 'X-TeachBuddy-Request': '1' },
    data: { ...input, expectedVersion: entry.version, items: entry.items.map(item => ({ ...item, text: '别处已保存内容' })) }
  });
  expect(updated.ok(), await updated.text()).toBeTruthy();
  await page.goto(world.origin + '/calendar?entry=' + entry.id);
  await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('本地未保存内容');
  await page.locator('[data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('内容已在别处修改');
  const current = await (await page.request.get(world.origin + '/api/modules/schedule/entries/' + entry.id, { headers: headers(page) })).json();
  expect(current.items[0].text).toBe('别处已保存内容');
});

test('班级创建输入和记录关联选择刷新恢复', async ({ page }) => {
  await page.getByRole('link', { name: '班级教学', exact: true }).click();
  await page.getByRole('button', { name: '新建班级', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('创建中的班级');
  await page.reload();
  await expect(page.getByLabel('班级名称', { exact: true })).toHaveValue('创建中的班级');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByLabel('写一句', { exact: true }).fill('待补充关联资料的记录');
  await page.getByRole('button', { name: '补充', exact: true }).click();
  await page.getByRole('button', { name: '关联资料', exact: true }).click();
  await page.getByRole('tab', { name: '题目', exact: true }).click();
  await page.getByLabel('搜索资料').fill('保持筛选');
  await page.reload();
  await expect(page.getByRole('dialog', { name: '关联资料' })).toBeVisible();
  await expect(page.getByLabel('搜索资料')).toHaveValue('保持筛选');
});

test('数学预览参数和工具展开位置重开，不改作品源码', async ({ page }) => {
  await page.getByRole('link', { name: '数学工坊', exact: true }).click();
  await page.getByRole('button', { name: '新建演示', exact: true }).first().click();
  await page.getByLabel('作品名称').fill('独立预览参数');
  // 演示从空画布开始，先选含 a 参数的真实起点。
  await page.getByRole('button', { name: '作品与工具', exact: true }).click();
  await page.getByRole('button', { name: '二次函数起点', exact: true }).click();
  await page.getByRole('button', { name: '作品与工具', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('已保存');
  await page.getByLabel('a 数值', { exact: true }).fill('2.5');
  await page.getByRole('button', { name: '作品与工具', exact: true }).click();
  await page.locator('.math-tools-panel details').filter({ has: page.locator('summary', { hasText: '参数' }) }).first().locator('summary').click();
  await page.getByLabel('导出格式').selectOption('source');
  await page.reload();
  await expect(page.getByLabel('a 数值', { exact: true })).toHaveValue('2.5');
  await expect(page.getByLabel('导出格式')).toHaveValue('source');
  const list = await (await page.request.get(world.origin + '/api/modules/math/v1/works', { headers: headers(page) })).json();
  const work = await (await page.request.get(world.origin + '/api/modules/math/v1/works/' + list.items[0].id, { headers: headers(page) })).json();
  expect(work.source.parameters.find(parameter => parameter.name === 'a').initial).toBe(1);
});

test('资源两标签页上传互不覆盖，原文件确认后筛选与视图重开', async ({ page, context }) => {
  await page.getByRole('link', { name: '资源库', exact: true }).click();
  await expect(page.getByLabel('上传资料')).toBeEnabled();
  const second = await context.newPage(); await second.goto(world.origin + '/resources');
  await expect(second.getByLabel('上传资料')).toBeEnabled();
  const buffer = fs.readFileSync('apps/web/e2e/fixtures/materials-resources/samples/page.png');
  let key;
  await page.route('**/api/workbench/files', async route => {
    key = route.request().headers()['idempotency-key']; await route.fetch(); await route.abort();
  });
  await page.getByLabel('上传资料').setInputFiles({ name: '甲页原图.png', mimeType: 'image/png', buffer });
  await expect(page.getByRole('button', { name: '重试确认原请求' })).toBeVisible();
  await second.getByLabel('上传资料').setInputFiles({ name: '乙页原图.png', mimeType: 'image/png', buffer });
  await expect(second.getByRole('heading', { name: '乙页原图.png', exact: true })).toBeVisible();
  await page.reload(); await page.unroute('**/api/workbench/files');
  await expect(page.getByLabel('重新选择原文件')).toBeVisible();
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
  await page.getByRole('link', { name: '题库', exact: true }).click();
  await page.getByRole('button', { name: '收录', exact: true }).click();
  await page.getByRole('button', { name: '图片', exact: true }).click();
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
  await page.getByRole('button', { name: '保存原稿并整理' }).click();
  await expect(page.getByRole('button', { name: '保存原稿并整理' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('dialog', { name: '收录材料' })).toBeVisible();
  await page.getByLabel('选择原稿').setInputFiles(file);
  await page.getByRole('button', { name: '保存原稿并整理' }).click();
  await expect.poll(() => inputs.length).toBe(1);
  expect(keys).toHaveLength(2); expect(keys[1]).toBe(keys[0]);
  await page.reload();
  await page.getByLabel('选择原稿').setInputFiles(file);
  await page.getByRole('button', { name: '保存原稿并整理' }).click();
  await expect.poll(() => inputs.length).toBe(2);
  expect(keys).toHaveLength(2);
  expect(inputs[1].input).toEqual(inputs[0].input);
});

test('清理其他标签页时不会由旧输入重新生成草稿', async ({ page, context }) => {
  await page.getByRole('link', { name: '备课', exact: true }).click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('需要清除的现场');
  const second = await context.newPage(); await second.goto(world.origin + '/settings');
  await expect(second.getByRole('button', { name: '清除本设备草稿' })).toBeEnabled();
  second.once('dialog', dialog => dialog.accept());
  await second.getByRole('button', { name: '清除本设备草稿' }).click();
  await expect(second.getByText(/已清除本设备可清理/)).toBeVisible();
  await expect(page.getByLabel('课题', { exact: true })).not.toHaveValue('需要清除的现场');
  await page.reload();
  await expect(page.getByLabel('课题', { exact: true })).not.toHaveValue('需要清除的现场');
  await second.close();
});

test('关闭标签页后从设置选择原备课草稿，保留当前分支', async ({ page, context }) => {
  await page.getByRole('link', { name: '备课', exact: true }).click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('已关闭标签页的甲稿');
  const second = await context.newPage(); await second.goto(page.url());
  await second.getByLabel('课题', { exact: true }).fill('仍要保留的乙稿');
  await page.close();
  await second.getByRole('link', { name: '设置', exact: true }).click();
  await second.locator('.wb-recovery-candidates > summary').click();
  const candidate = second.locator('.wb-recovery-candidates > ul > li').filter({ hasText: '已关闭标签页的甲稿' }).first();
  second.once('dialog', dialog => dialog.accept());
  await candidate.getByRole('button', { name: '继续这份备课草稿' }).click();
  await expect(second.getByLabel('课题', { exact: true })).toHaveValue('已关闭标签页的甲稿');
  await second.getByRole('link', { name: '设置', exact: true }).click();
  await second.locator('.wb-recovery-candidates > summary').click();
  await expect(second.locator('.wb-recovery-candidates > ul > li').filter({ hasText: '仍要保留的乙稿' }).first()).toBeVisible();
  await second.close();
});

test('数学 HTML 上传重开后校验原文件并以原键确认', async ({ page }) => {
  await page.getByRole('link', { name: '数学工坊', exact: true }).click();
  const file = { name: '课堂演示.html', mimeType: 'text/html', buffer: Buffer.from('<!doctype html><html><body><h1>课堂演示</h1></body></html>') };
  let key;
  await page.route('**/api/workbench/files', async route => { key = route.request().headers()['idempotency-key']; await route.fetch(); await route.abort(); });
  await page.getByLabel('导入 HTML 文件').setInputFiles(file);
  await expect(page.getByRole('button', { name: '重试原文件上传' })).toBeVisible();
  await page.reload(); await page.unroute('**/api/workbench/files');
  await expect(page.getByRole('button', { name: '重选原文件并确认上传' })).toBeVisible();
  const replay = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/workbench/files'));
  await page.getByLabel('导入 HTML 文件').setInputFiles(file);
  expect((await replay).headers()['idempotency-key']).toBe(key);
  await expect(page.getByLabel('作品名称')).toHaveValue('课堂演示.html');
  await expect(page.getByRole('button', { name: '重选原文件并确认上传' })).toHaveCount(0);
});

test('返回备课标签页读取最新内容，有本地修改时只显示对照', async ({ page, context }) => {
  await page.getByRole('link', { name: '备课', exact: true }).click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('前台刷新基线');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toContainText('已保存');
  const second = await context.newPage(); await second.goto(page.url());
  await second.getByLabel('课题', { exact: true }).fill('另一标签的第一版');
  await second.getByRole('button', { name: '保存', exact: true }).click();
  await expect(second.locator('[data-save-status]')).toContainText('已保存');
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('另一标签的第一版');
  await page.getByLabel('课题', { exact: true }).fill('当前标签未保存稿');
  await second.bringToFront();
  await second.getByLabel('课题', { exact: true }).fill('另一标签的第二版');
  await second.getByRole('button', { name: '保存', exact: true }).click();
  await expect(second.locator('[data-save-status]')).toContainText('已保存');
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('当前标签未保存稿');
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await second.close();
});
