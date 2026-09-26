import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';

let world;
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  await register(page, world, 'math-workspace@example.test');
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) await page.screenshot({ path: info.outputPath('failure.png') });
  if (world) {
    await world.close();
    if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
    world = null;
  }
});

async function save(page) {
  const request = page.waitForResponse(response => response.url().includes('/api/modules/math/v1/works')
    && ['PUT', 'POST'].includes(response.request().method()));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const response = await request;
  expect(response.status(), await response.text()).toBeLessThan(300);
  await expect(page.locator('.math-workspace-status')).toHaveText('已保存');
  return response.json();
}
async function download(page, format, target) {
  await page.getByRole('button', { name: /^下载(图片|演示)$/ }).click();
  await page.getByLabel('导出格式', { exact: true }).selectOption(format);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载作品', exact: true }).click();
  await (await event).saveAs(target);
}
async function selectTools(page, name) {
  await page.getByRole('button', { name: ({ 对象: '图形与标注', 参数: '设置滑杆', 步骤: '编排步骤', 画布: '画布设置' })[name], exact: true }).click();
}

test('动态作品归档后仍显示保存的初态，恢复后参数可用', async ({ page }) => {
  await page.getByRole('button', { name: '新建动态演示', exact: true }).click();
  await page.getByRole('button', { name: '试试二次函数演示', exact: true }).click();
  await page.getByLabel('作品名称').fill('归档动态预览');
  await save(page);
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档作品', exact: true }).click();
  await page.getByLabel('已归档', { exact: true }).check();
  await page.locator('.math-library').getByRole('button', { name: '归档动态预览 动态演示', exact: true }).click();
  await expect(page.locator('.math-archived-preview svg [data-object="f"]')).toBeVisible();
  await expect(page.locator('.math-archived-preview')).toContainText('定位点 (0,0)');
  await expect(page.getByRole('slider')).toHaveCount(0);
  await page.getByRole('button', { name: '恢复作品', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'a 滑杆', exact: true })).toBeVisible();
});

test('图形撤销重做保留服务器版本，历史恢复先成为可撤销草稿', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建平面图形', exact: true }).click();
  await page.getByRole('button', { name: '从 y = x² 开始', exact: true }).click();
  await page.getByLabel('作品名称').fill('历史恢复图形');
  const first = await save(page);
  await page.getByLabel('expression', { exact: true }).fill('x^3');
  const second = await save(page);
  expect(second.version).toBe(first.version + 1);
  await page.getByRole('button', { name: '移除对象', exact: true }).click();
  await expect(page.getByRole('button', { name: '从 y = x² 开始', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('x^3');
  await page.getByRole('button', { name: '撤销', exact: true }).press('ControlOrMeta+Shift+Z');
  await expect(page.getByRole('button', { name: '从 y = x² 开始', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  const third = await save(page);
  expect(third.id).toBe(first.id);
  expect(third.version).toBe(second.version + 1);
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '历史版本', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '历史版本', exact: true });
  await dialog.getByLabel('保存记录').selectOption(String(first.version));
  await expect(dialog.locator('svg [data-object="f1"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('history-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('button', { name: '恢复为草稿', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('history-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole('button', { name: '恢复为草稿', exact: true }).click();
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('x^2');
  await expect(page.locator('.math-workspace-status')).toHaveText('未保存');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('x^3');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  const restored = await save(page);
  expect(restored.id).toBe(first.id);
  expect(restored.version).toBe(third.version + 1);
  await page.reload();
  await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('x^2');
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
});

test('导出的制作源重新导入为独立作品，错误文件保留当前草稿', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建动态演示', exact: true }).click();
  await page.getByRole('button', { name: '试试二次函数演示', exact: true }).click();
  await page.getByLabel('作品名称').fill('导出后重新制作');
  const original = await save(page);
  const target = info.outputPath('dynamic.json');
  await download(page, 'source', target);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入制作源 JSON', exact: true }).click();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/modules/math/v1/works'));
  await (await picker).setFiles(target);
  const imported = await (await response).json();
  expect(imported.id).not.toBe(original.id);
  expect(imported.source).toEqual(original.source);
  await expect(page.getByRole('slider', { name: 'a 滑杆', exact: true })).toBeVisible();
  await page.getByLabel('作品名称').fill('保留我的草稿');
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.getByLabel('导入制作源文件').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ broken') });
  await expect(page.getByRole('alert')).toContainText('不是有效');
  await page.getByRole('button', { name: '继续制作', exact: true }).click();
  await expect(page.getByLabel('作品名称')).toHaveValue('保留我的草稿');
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.getByLabel('导入制作源文件').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"kind":"dynamic","schemaVersion":1}') });
  await page.getByRole('dialog').getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('请检查');
  await page.getByRole('button', { name: '继续制作', exact: true }).click();
  await expect(page.getByLabel('作品名称')).toHaveValue('保留我的草稿');
});

test('导入响应丢失后刷新确认原请求，只创建一份作品', async ({ page }) => {
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
  await page.getByLabel('LaTeX', { exact: true }).fill('x+1');
  const original = await save(page);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  const keys = [];
  let drop = true;
  await page.route('**/api/modules/math/v1/works', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    if (!drop) return route.continue();
    drop = false; await route.fetch(); await route.abort('failed');
  });
  await page.getByLabel('导入制作源文件').setInputFiles({ name: '恢复导入.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original.source)) });
  await expect(page.getByRole('button', { name: '确认操作结果', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: '确认操作结果', exact: true }).click();
  await expect(page.getByLabel('作品名称')).toHaveValue('恢复导入');
  expect(keys.length).toBe(2); expect(new Set(keys).size).toBe(1);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.locator('.math-work-row')).toHaveCount(2);
});

test('平面图制作动态副本，保留图形和原作品', async ({ page }) => {
  await page.getByRole('button', { name: '新建平面图形', exact: true }).click();
  await page.getByRole('button', { name: '从 y = x² 开始', exact: true }).click();
  await page.getByLabel('作品名称').fill('原来的函数图');
  const original = await save(page);
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '制作动态副本', exact: true }).click();
  await expect(page.getByRole('region', { name: '滑杆设置', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await page.getByLabel('expression', { exact: true }).fill('x^2+t');
  const dynamic = await save(page);
  expect(dynamic.id).not.toBe(original.id);
  expect(dynamic.source.kind).toBe('dynamic');
  expect(dynamic.source.scene.viewport).toEqual(original.source.scene.viewport);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.locator('.math-library').getByRole('button', { name: '原来的函数图 平面图形', exact: true }).click();
  await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('x^2');
});

test('可视化公式支持逐字输入、结构组合、撤销和保存导出，资源全部本地加载', async ({ page, context }, info) => {
  const external = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== world.origin) external.push(request.url()); });
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByRole('button', { name: '可视化编辑', exact: true }).click();
  const field = page.locator('math-field');
  await expect(field).toBeVisible();
  await field.click();
  await field.pressSequentially('x+1');
  await field.press('ControlOrMeta+A');
  await page.getByRole('button', { name: '分式', exact: true }).click();
  await field.pressSequentially('2');
  await expect.poll(() => field.evaluate(el => el.value)).toBe('\\frac{x+1}{2}');
  await field.press('ArrowRight');
  await field.pressSequentially('+3');
  await field.press('ControlOrMeta+Z');
  await field.press('ControlOrMeta+Shift+Z');
  await expect.poll(() => field.evaluate(el => el.value)).toContain('+3');
  await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
  const latex = await page.getByLabel('LaTeX', { exact: true }).inputValue();
  expect(latex).toContain('\\frac{x+1}{2}');
  await page.getByRole('button', { name: '可视化编辑', exact: true }).click();
  await expect.poll(() => field.evaluate(el => el.value)).toBe(latex);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('\\sqrt{x+2}'));
  await field.click(); await field.press('ControlOrMeta+A'); await field.press('ControlOrMeta+V');
  await expect.poll(() => field.evaluate(el => el.value)).toBe('\\sqrt{x+2}');
  await page.getByLabel('作品名称').fill('可视化编辑公式');
  const work = await save(page);
  expect(work.source.latex).toBe('\\sqrt{x+2}');
  expect(work.render.state).toBe('ready');
  await page.reload();
  await expect.poll(() => field.evaluate(el => el.value)).toBe('\\sqrt{x+2}');
  await field.click(); await field.press('ControlOrMeta+A'); await field.press('Backspace');
  await field.pressSequentially('x^2');
  await expect.poll(() => field.evaluate(el => el.value)).toBe('x^2');
  const edited = await save(page);
  expect(edited.id).toBe(work.id);
  await expect(page.getByRole('img', { name: '当前公式预览', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('visual-formula-desktop.png') });
  await download(page, 'svg', info.outputPath('visual-formula.svg'));
  expect(fs.readFileSync(info.outputPath('visual-formula.svg'), 'utf8')).toContain('<svg');
  expect(external).toEqual([]);
});

test('公式新工具适配深色与窄屏，历史读取失败可重试，取消恢复保留输入', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
  await page.getByLabel('LaTeX', { exact: true }).fill('x+1');
  const first = await save(page);
  await page.getByLabel('LaTeX', { exact: true }).fill('x+2');
  await save(page);
  await page.getByRole('button', { name: '可视化编辑', exact: true }).click();
  await page.getByRole('link', { name: /账户：/ }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', 'dark');
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^数学工坊/ }).click();
  const field = page.locator('math-field');
  await expect(field).toBeVisible();
  await field.click();
  await expect(page.getByRole('img', { name: '当前公式预览', exact: true })).toBeVisible();
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(field).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`formula-dark-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
  await page.getByLabel('LaTeX', { exact: true }).fill('不要丢掉这个草稿');
  let unavailable = true;
  await page.route('**/api/modules/math/v1/works/*/versions', route => unavailable ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '历史版本', exact: true }).click();
  const history = page.getByRole('dialog', { name: '历史版本', exact: true });
  await expect(history.getByRole('alert')).toContainText('当前作品没有改变');
  unavailable = false;
  await history.getByRole('button', { name: '重试', exact: true }).click();
  await history.getByLabel('保存记录').selectOption(String(first.version));
  await expect(history.getByRole('img', { name: '当前公式预览' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('history-dark.png') });
  await history.getByRole('button', { name: '恢复为草稿' }).click();
  await page.getByRole('dialog', { name: '确认操作', exact: true }).getByRole('button', { name: '取消', exact: true }).click();
  await expect(history).toBeVisible();
  await history.getByLabel('保存记录').selectOption(String(first.version + 1));
  await history.getByRole('button', { name: '恢复为草稿' }).click();
  await page.getByRole('dialog', { name: '确认操作', exact: true }).getByRole('button', { name: '取消', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '确认操作', exact: true })).toBeHidden();
  await expect(history).toBeVisible();
  await history.getByRole('button', { name: '关闭历史版本', exact: true }).click();
  await expect(page.getByLabel('LaTeX', { exact: true })).toHaveValue('不要丢掉这个草稿');
  await expect(page.getByRole('button', { name: '作品操作', exact: true })).toBeFocused();
});

test('归档当前作品后返回工坊，刷新不重开作品', async ({ page }) => {
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByLabel('作品名称').fill('归档流程验证');
  await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
  await page.getByLabel('LaTeX', { exact: true }).fill('x^2');
  const work = await save(page);
  await page.goto(`${world.origin}/math?workId=${work.id}`);
  await expect(page.getByLabel('作品名称')).toHaveValue('归档流程验证');
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: /^(删除|归档)作品$/ }).click();
  await expect(page.getByRole('button', { name: '新建公式', exact: true })).toBeVisible();
  await expect(page.getByLabel('作品名称')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '新建公式', exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${world.origin}/math`);
  await page.getByLabel('已归档', { exact: true }).check();
  const actions = page.getByRole('group', { name: '归档流程验证的归档操作', exact: true });
  await actions.getByRole('button', { name: '恢复', exact: true }).click();
  await expect(page.getByText('没有已归档的作品', { exact: true })).toBeVisible();
  await page.getByLabel('已归档', { exact: true }).uncheck();
  await page.locator('.math-library').getByRole('button', { name: '归档流程验证 公式', exact: true }).click();
  await expect(page.getByLabel('LaTeX', { exact: true })).toHaveValue('x^2');
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档作品', exact: true }).click();
  await page.getByLabel('已归档', { exact: true }).check();
  await actions.getByRole('button', { name: '彻底删除', exact: true }).click();
  await page.getByRole('dialog', { name: '彻底删除作品' }).getByRole('button', { name: '取消', exact: true }).click();
  await expect(actions.getByRole('button', { name: '彻底删除', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(actions.getByRole('button', { name: '彻底删除', exact: true })).toBeInViewport();
  await actions.getByRole('button', { name: '彻底删除', exact: true }).click();
  await page.getByRole('dialog', { name: '彻底删除作品' }).getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(page.getByText('没有已归档的作品', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('没有已归档的作品', { exact: true })).toBeVisible();
});

test('输入焦点框贴合完整控件，搜索框包含图标', async ({ page }, info) => {
  const search = page.getByLabel('搜索作品', { exact: true });
  await search.click();
  await page.screenshot({ path: info.outputPath('search-focus.png') });
  const parent = page.locator('.math-library-search');
  expect(await parent.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
  expect(await search.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
  expect(await search.evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  for (const control of [page.getByLabel('作品名称'), page.getByLabel('LaTeX', { exact: true })]) {
    if (await control.count() === 0) await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
    await control.click();
    const style = await control.evaluate(el => ({ offset: getComputedStyle(el).outlineOffset, shadow: getComputedStyle(el).boxShadow }));
    expect(parseFloat(style.offset)).toBeLessThanOrEqual(0);
    expect(style.shadow).toContain('inset');
  }
  await page.screenshot({ path: info.outputPath('formula-focus.png') });
});

test('归档和彻底删除的响应丢失后按原请求确认，刷新返回首页', async ({ page }) => {
  await page.getByRole('button', { name: '新建平面图形', exact: true }).click();
  await page.getByRole('button', { name: '从 y = x² 开始', exact: true }).click();
  await page.getByLabel('作品名称').fill('请求确认作品');
  await save(page);
  for (const action of ['deletion', 'purge']) {
    let first = true;
    const keys = [];
    await page.route(`**/api/modules/math/v1/works/*/${action}`, async route => {
      keys.push(route.request().headers()['idempotency-key']);
      if (!first) return route.continue();
      first = false;
      await route.fetch();
      await route.abort('failed');
    });
    await page.getByRole('button', { name: '作品操作', exact: true }).click();
    await page.getByRole('menuitem', { name: action === 'deletion' ? '归档作品' : '彻底删除', exact: true }).click();
    if (action === 'purge') await page.getByRole('dialog', { name: '彻底删除作品' }).getByRole('button', { name: '彻底删除', exact: true }).click();
    await expect(page.getByRole('button', { name: action === 'deletion' ? '确认归档结果' : '确认删除结果', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '返回工坊', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: '确认操作结果', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认操作结果', exact: true })).toBeHidden();
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(1);
    await page.reload();
    await expect(page.getByRole('button', { name: '新建公式', exact: true })).toBeVisible();
    if (action === 'deletion') {
      await page.getByLabel('已归档', { exact: true }).check();
      await page.locator('.math-library').getByRole('button', { name: '请求确认作品 平面图形', exact: true }).click();
      await expect(page.getByRole('button', { name: '恢复作品', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '图形与标注', exact: true })).toBeHidden();
    } else await expect(page.getByText('没有已归档的作品', { exact: true })).toBeVisible();
  }
});

test('新建图形直接编辑，保存重开及真实导出，窄屏操作可达', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建平面图形', exact: true }).click();
  await expect(page.getByLabel('搜索作品', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '添加函数', exact: true }).click();
  await expect(page.getByRole('region', { name: '图形编辑', exact: true })).toBeVisible();
  await page.getByLabel('作品名称', { exact: true }).fill('正弦函数课堂图');
  await page.getByLabel('expression', { exact: true }).fill('2*sin(x)');
  const name = page.getByLabel('id', { exact: true });
  await name.press('ControlOrMeta+A');
  await name.pressSequentially('sine');
  await expect(name).toHaveValue('sine');
  await expect(page.getByRole('button', { name: '颜色与样式', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('spinbutton', { name: 'style-width', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '颜色与样式', exact: true }).click();
  await page.getByLabel('style-width', { exact: true }).fill('3');
  const first = await save(page);
  expect(first.source.scene.elements[0].expression).toBe('2*sin(x)');
  expect(first.source.scene.elements[0].style.width).toBe(3);
  await page.reload();
  await expect(page.getByLabel('作品名称')).toHaveValue('正弦函数课堂图');
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('2*sin(x)');
  const png = info.outputPath('sine.png');
  await download(page, 'png', png);
  const meta = await sharp(png).metadata();
  expect(meta.width).toBe(1600);
  expect(meta.hasAlpha).toBe(true);
  await page.getByRole('button', { name: /^下载(图片|演示)$/ }).click();
  await expect(page.locator('#math-export-options')).toHaveCount(0);
  const bounds = await page.locator('.math-main').boundingBox();
  const auxiliary = await page.getByRole('complementary', { name: '辅助栏', exact: true }).boundingBox();
  expect(Math.abs(bounds.y - auxiliary.y)).toBeLessThan(1);
  expect(Math.abs(bounds.height - auxiliary.height)).toBeLessThan(1);
  expect(auxiliary.x - bounds.x - bounds.width).toBe(16);
  await page.screenshot({ path: info.outputPath('plane-desktop.png') });
  for (const [width, height] of [[1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const close = page.getByRole('button', { name: '关闭辅助栏', exact: true });
    if (await close.isVisible()) await close.click();
    await page.getByRole('button', { name: /^下载(图片|演示)$/ }).click();
    await expect(page.getByRole('button', { name: '下载作品', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`plane-${width}.png`) });
    await page.getByRole('button', { name: /^下载(图片|演示)$/ }).click();
  }
});

test('公式片段插入光标处，另存和作品切换保留正确版本', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByRole('button', { name: 'LaTeX 源码', exact: true }).click();
  const latex = page.getByLabel('LaTeX', { exact: true });
  await latex.fill('x+y');
  await latex.press('Home');
  await page.getByRole('button', { name: '分式', exact: true }).click();
  await expect(latex).toHaveValue('\\frac{}{}x+y');
  await expect(latex).toBeFocused();
  await latex.fill('\\frac{-b+\\sqrt{b^2-4ac}}{2a}');
  await page.getByLabel('作品名称').fill('求根公式');
  const original = await save(page);
  const svg = info.outputPath('formula.svg');
  await download(page, 'svg', svg);
  expect(fs.readFileSync(svg, 'utf8')).toContain('<svg');
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  const copyResponse = page.waitForResponse(response => response.url().endsWith('/works') && response.request().method() === 'POST');
  await page.getByRole('menuitem', { name: '另存作品', exact: true }).click();
  const copy = await (await copyResponse).json();
  expect(copy.id).not.toBe(original.id);
  await page.getByLabel('作品名称').fill('求根公式副本');
  await save(page);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.locator('.math-library').getByRole('button', { name: '求根公式 公式', exact: true }).click();
  await expect(page.getByLabel('作品名称')).toHaveValue('求根公式');
  await expect(page.locator('#math-export-options')).toHaveCount(0);
  await expect(page.locator('.math-formula-preview img')).toBeVisible();
  await expect.poll(() => page.locator('.math-formula-preview img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('formula-desktop.png') });
});

test('演示对象、参数、步骤切换保留修改，下载物可离线运行', async ({ page, browser }, info) => {
  await page.getByRole('button', { name: '新建动态演示', exact: true }).click();
  await page.getByRole('button', { name: '试试二次函数演示', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'k 滑杆', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '课堂展示', exact: true }).click();
  await page.getByRole('button', { name: '平移后曲线', exact: true }).click();
  await expect(page.getByLabel('h 数值', { exact: true })).toHaveValue('1');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '课堂展示', exact: true })).toBeVisible();
  await selectTools(page, '参数');
  await page.getByLabel('parameter-0-name', { exact: true }).fill('b');
  await page.getByRole('button', { name: '应用参数 1', exact: true }).click();
  await selectTools(page, '步骤');
  await page.getByRole('button', { name: '2 · 平移后曲线', exact: true }).click();
  await page.getByLabel('步骤 2 标题').fill('观察平移');
  await page.getByLabel('步骤 2 说明').fill('比较顶点位置与解析式。');
  await selectTools(page, '对象');
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('b*(x-h)^2+k');
  await page.getByLabel('作品名称').fill('二次函数平移演示');
  const saved = await save(page);
  expect(saved.source.steps[1].description).toBe('比较顶点位置与解析式。');
  await page.reload();
  await selectTools(page, '步骤');
  await expect(page.getByLabel('步骤 2 标题')).toHaveValue('观察平移');
  const file = info.outputPath('dynamic.html');
  await download(page, 'html', file);
  await page.getByRole('button', { name: /^下载(图片|演示)$/ }).click();
  await expect(page.locator('#math-export-options')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('dynamic-desktop.png') });
  const offline = await browser.newContext({ offline: true });
  try {
    const display = await offline.newPage();
    await display.goto(pathToFileURL(file).href);
    const frame = display.frameLocator('iframe');
    await frame.getByRole('button', { name: '观察平移', exact: true }).click();
    await expect(frame.getByLabel('h 数值', { exact: true })).toHaveValue('1');
    await expect(frame.locator('.step-description')).toHaveText('比较顶点位置与解析式。');
  } finally { await offline.close(); }
});

test('空间图形编辑和放弃新建保护，菜单导入 HTML 后可再次编辑', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建空间图形', exact: true }).click();
  await page.getByRole('button', { name: '正方体示例', exact: true }).click();
  await page.getByLabel('作品名称').fill('正方体截面');
  await page.getByLabel('z', { exact: true }).fill('3');
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByRole('dialog', { name: '确认操作' }).getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '继续制作', exact: true }).click();
  await selectTools(page, '对象');
  await expect(page.getByLabel('z', { exact: true })).toHaveValue('3');
  await selectTools(page, '画布');
  await page.getByLabel('azimuth', { exact: true }).fill('45');
  const space = await save(page);
  expect(space.source.points[0].z).toBe(3);
  expect(space.source.azimuth).toBe(45);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入已有 HTML 演示', exact: true }).click();
  await (await chooser).setFiles({ name: '面积演示.html', mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><meta charset="utf-8"><h1>三角形面积</h1><button onclick="document.querySelector(\'output\').textContent=6">计算</button><output>0</output>') });
  await expect(page.getByLabel('作品名称')).toHaveValue('面积演示.html');
  const html = await save(page);
  await page.getByRole('button', { name: '编辑源码', exact: true }).click();
  const editor = page.getByLabel('HTML 源码');
  await editor.fill((await editor.inputValue()).replace('textContent=6', 'textContent=12'));
  await save(page);
  await page.reload();
  await page.getByRole('button', { name: '运行预览', exact: true }).click();
  const preview = page.frameLocator('iframe[title="作品隔离预览"]').frameLocator('iframe');
  await preview.getByRole('button', { name: '计算', exact: true }).click();
  await expect(preview.locator('output')).toHaveText('12');
  await page.screenshot({ path: info.outputPath('html-desktop.png') });
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '历史版本', exact: true }).click();
  const history = page.getByRole('dialog', { name: '历史版本', exact: true });
  await history.getByLabel('保存记录').selectOption(String(html.version));
  await expect(history.locator('iframe')).toHaveCount(0);
  await history.getByRole('button', { name: '恢复为草稿' }).click();
  await expect(page.locator('iframe[title="作品隔离预览"]')).toHaveCount(0);
  const restored = await save(page);
  expect(restored.originalFileId).toBe(html.originalFileId);
  await page.getByRole('button', { name: '运行预览', exact: true }).click();
  await preview.getByRole('button', { name: '计算', exact: true }).click();
  await expect(preview.locator('output')).toHaveText('6');
});


test('空白公式随时返回，结构输入和草稿恢复无需源码，首页用途可见', async ({ page }, info) => {
  await expect(page.getByRole('button', { name: '新建动态演示', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('home-desktop.png') });
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '继续制作', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: '新建公式', exact: true }).click();
  await page.getByRole('button', { name: '分式', exact: true }).click();
  await page.getByLabel('分子', { exact: true }).fill('x+3');
  await page.getByLabel('分母', { exact: true }).fill('4');
  await expect(page.getByLabel('LaTeX', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('img', { name: '当前公式预览' })).toBeVisible();
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '继续制作', exact: true }).click();
  await expect(page.getByLabel('分子', { exact: true })).toHaveValue('x+3');
  await expect(page.getByLabel('分母', { exact: true })).toHaveValue('4');
  await expect(page.getByRole('img', { name: '当前公式预览' })).toBeVisible();
  await expect.poll(() => page.getByRole('img', { name: '当前公式预览' }).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('guided-formula.png') });
  const saved = await save(page);
  expect(saved.source.latex).toBe('\\frac{x+3}{4}');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '返回工坊', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('home-mobile.png') });
});

test('画布选择与右侧联动，空间棱在当前对象处编辑', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建空间图形', exact: true }).click();
  await page.getByRole('button', { name: '正方体示例', exact: true }).click();
  const canvas = page.getByLabel('数学图形编辑画布');
  await canvas.getByRole('button', { name: '选择 B', exact: true }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('id', { exact: true })).toHaveValue('B');
  const line = canvas.locator('[data-selection="edge:0"] path').last();
  const box = await line.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByLabel('棱起点', { exact: true })).toHaveValue('A');
  await expect(page.getByLabel('棱终点', { exact: true })).toHaveValue('B');
  await page.getByLabel('style-dash', { exact: true }).selectOption('dashed');
  const saved = await save(page);
  expect(saved.source.edges[0].style.dash).toBe('dashed');
  await page.screenshot({ path: info.outputPath('space-selected-edge.png') });
});
