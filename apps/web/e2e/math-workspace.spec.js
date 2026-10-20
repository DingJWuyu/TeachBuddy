import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import path from 'node:path';
import { emptySource, emptyDynamicSource, newElement, defaultStyle, dynamicSource } from '../src/features/math/model.js';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';
import { installMathProbe, enterMath, savedMath, currentApi } from './math-unified-helpers.mjs';

import { importMathSource, chooseFile } from './fixtures/math-workspace.js';
let world;
test.beforeEach(async ({ page }) => {
  world = await createIntegration({ webDist: path.resolve(process.env.WORKBENCH_WEB_DIST ?? 'apps/web/dist') });
  await register(page, world, 'math-workspace@example.test');
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    await page.screenshot({ path: info.outputPath('failure.png') });
    fs.writeFileSync(info.outputPath('world.json'), JSON.stringify({ directory: world?.directory }));
  }
  if (world) {
    await world.close();
    if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
    world = null;
  }
});

// Compatibility coverage for saved formula/plane/space/dynamic/html sources.
// New unified works are covered by math-unified; legacy input comes through import.
async function importSource(page, source, title = '兼容作品') {
  const input = structuredClone(source);
  // Old sources on disk must be complete. Start blank editing by removing a real
  // imported item through the UI, rather than inventing an unsupported empty file.
  const emptyFormula = input.kind === 'formula' && !input.latex;
  const emptyGraph = input.scene && !input.scene.elements.length;
  const emptySpace = input.kind === 'space' && !input.points.length;
  if (emptyFormula) input.latex = 'x';
  if (emptyGraph) input.scene.elements = [newElement('point', 'Seed')];
  if (emptySpace) input.points = [{ id: 'Seed', x: 0, y: 0, z: 0, label: { text: 'Seed', dx: 10, dy: -10 }, style: defaultStyle() }];
  const work = await importMathSource(page, input, title);
  if (emptyFormula) {
    await page.getByLabel('LaTeX', { exact: true }).fill('');
    await page.getByRole('button', { name: '常用结构', exact: true }).click();
  } else if (emptyGraph || emptySpace) {
    await selectTools(page, '对象');
    await page.getByRole('button', { name: '移除对象', exact: true }).click();
  }
  return work;
}

async function archived(page, show = true) {
  const rail = page.getByRole('complementary', { name: '数学工坊导航', exact: true });
  await rail.getByRole('button', { name: show ? '已归档' : /^全部作品/ }).click();
}
function workRow(page, title) { return page.locator('.tbx-mw-card').filter({ has: page.getByText(title, { exact: true }) }); }

async function save(page) {
  const request = page.waitForResponse(response => response.url().includes('/api/modules/math/v1/works')
    && ['PUT', 'POST'].includes(response.request().method()));
  await page.getByRole('button', { name: /^(保存|确认保存结果)$/ }).click();
  const response = await request;
  expect(response.status(), await response.text()).toBeLessThan(300);
  await expect(page.locator('.math-workspace-status')).toHaveText('已保存');
  return response.json();
}
async function download(page, format, target) {
  const exportToggle = page.getByRole('button', { name: /^下载(图片|演示)$/ });
  if (await exportToggle.getAttribute('aria-expanded') !== 'true') await exportToggle.click();
  await page.getByLabel('导出格式', { exact: true }).selectOption(format);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载作品', exact: true }).click();
  await (await event).saveAs(target);
}
async function selectTools(page, name) {
  await page.getByRole('button', { name: ({ 对象: '图形与标注', 参数: '设置滑杆', 步骤: '编排步骤', 画布: '画布设置' })[name], exact: true }).click();
}

test('动态作品归档后仍显示保存的初态，恢复后参数可用', async ({ page }) => {
  await importSource(page, emptyDynamicSource());
  await page.getByRole('button', { name: '试试二次函数演示', exact: true }).click();
  await page.getByLabel('作品名称').fill('归档动态预览');
  await save(page);
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档作品', exact: true }).click();
  await archived(page);
  await workRow(page, '归档动态预览').locator('>button').click();
  await expect(page.locator('.math-archived-preview svg [data-object="f"]')).toBeVisible();
  await expect(page.locator('.math-archived-preview')).toContainText('定位点 (0,0)');
  await expect(page.getByRole('slider')).toHaveCount(0);
  await page.getByRole('button', { name: '恢复作品', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'a 滑杆', exact: true })).toBeVisible();
});

test('图形撤销重做保留服务器版本，历史恢复先成为可撤销草稿', async ({ page }, info) => {
  await importSource(page, emptySource('plane'));
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
  await expect(dialog.getByRole('button', { name: '恢复版本', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('history-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole('button', { name: '恢复版本', exact: true }).click();
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
  await importSource(page, emptyDynamicSource());
  await page.getByRole('button', { name: '试试二次函数演示', exact: true }).click();
  await page.getByLabel('作品名称').fill('导出后重新制作');
  const original = await save(page);
  const target = info.outputPath('dynamic.json');
  await download(page, 'source', target);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/modules/math/v1/works'));
  await chooseFile(page, '导入作品', target);
  const imported = await (await response).json();
  expect(imported.id).not.toBe(original.id);
  expect(imported.source).toEqual(original.source);
  await expect(page.getByRole('slider', { name: 'a 滑杆', exact: true })).toBeVisible();
  await page.getByLabel('作品名称').fill('保留我的草稿');
  await page.getByLabel('导入制作源文件').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ broken') });
  await expect(page.getByRole('alert')).toContainText('不是有效');
  await expect(page.getByLabel('作品名称')).toHaveValue('保留我的草稿');
  await page.getByLabel('导入制作源文件').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"kind":"dynamic","schemaVersion":1}') });
  await page.getByRole('alertdialog').getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('请检查');
  await expect(page.getByLabel('作品名称')).toHaveValue('保留我的草稿');
});

test('导入响应丢失后刷新确认原请求，只创建一份作品', async ({ page }) => {
  await importSource(page, emptySource('formula'));
  await page.getByRole('button', { name: '公式源码', exact: true }).click();
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
  await chooseFile(page, '导入作品', { name: '恢复导入.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original.source)) });
  await expect(page.getByRole('button', { name: '确认结果', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: '确认结果', exact: true }).click();
  await expect(page.getByLabel('作品名称')).toHaveValue('恢复导入');
  expect(keys.length).toBe(2); expect(new Set(keys).size).toBe(1);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.locator('.tbx-mw-card')).toHaveCount(2);
});

test('平面图制作动态副本，保留图形和原作品', async ({ page }) => {
  await importSource(page, emptySource('plane'));
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
  await workRow(page, '原来的函数图').locator('>button').click();
  await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('x^2');
});

test('可视化公式支持逐字输入、结构组合、撤销和保存导出，资源全部本地加载', async ({ page, context }, info) => {
  const external = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== world.origin) external.push(request.url()); });
  await importSource(page, emptySource('formula'));
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
  await page.getByRole('button', { name: '公式源码', exact: true }).click();
  const latex = await page.getByLabel('LaTeX', { exact: true }).inputValue();
  expect(latex).toContain('\\frac{x+1}{2}');
  await page.getByRole('button', { name: '可视化编辑', exact: true }).click();
  await expect.poll(() => field.evaluate(el => el.value)).toBe(latex);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('\\sqrt{x+2}'));
  await field.click(); await field.press('ControlOrMeta+A'); await field.press('ControlOrMeta+V');
  await expect.poll(() => field.evaluate(el => el.value)).toBe('\\sqrt{x+2}');
  await page.getByLabel('作品名称').fill('可视化编辑公式');
  await expect(page.getByLabel('作品名称')).toHaveValue('可视化编辑公式');
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

test('旧公式工具适配深色与窄屏，历史读取失败可重试，取消恢复保留输入', async ({ page }, info) => {
  await importSource(page, emptySource('formula'));
  await page.getByRole('button', { name: '公式源码', exact: true }).click();
  await page.getByLabel('LaTeX', { exact: true }).fill('x+1');
  const first = await save(page);
  await page.getByLabel('LaTeX', { exact: true }).fill('x+2');
  await save(page);
  await page.getByRole('button', { name: '可视化编辑', exact: true }).click();
  await page.getByRole('link', { name: /账户：/ }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
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
  await page.getByRole('button', { name: '公式源码', exact: true }).click();
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
  await history.getByRole('button', { name: '恢复版本' }).click();
  await page.getByRole('alertdialog', { name: '确认操作', exact: true }).getByRole('button', { name: '取消', exact: true }).click();
  await expect(history).toBeVisible();
  await history.getByLabel('保存记录').selectOption(String(first.version + 1));
  await history.getByRole('button', { name: '恢复版本' }).click();
  await page.getByRole('alertdialog', { name: '确认操作', exact: true }).getByRole('button', { name: '取消', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog', { name: '确认操作', exact: true })).toBeHidden();
  await expect(history).toBeVisible();
  await history.getByRole('button', { name: '关闭历史版本', exact: true }).click();
  await expect(page.getByLabel('LaTeX', { exact: true })).toHaveValue('不要丢掉这个草稿');
  await expect(page.getByRole('button', { name: '作品操作', exact: true })).toBeFocused();
});

test('归档当前作品后返回工坊，刷新不重开作品', async ({ page }) => {
  await importSource(page, emptySource('formula'));
  await page.getByLabel('作品名称').fill('归档流程验证');
  await page.getByRole('button', { name: '公式源码', exact: true }).click();
  await page.getByLabel('LaTeX', { exact: true }).fill('x^2');
  const work = await save(page);
  await page.goto(`${world.origin}/math?workId=${work.id}`);
  await expect(page.getByLabel('作品名称')).toHaveValue('归档流程验证');
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: /^(删除|归档)作品$/ }).click();
  await expect(page.getByRole('button', { name: '新建作品', exact: true })).toBeVisible();
  await expect(page.getByLabel('作品名称')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: '新建作品', exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${world.origin}/math`);
  await archived(page);
  const actions = workRow(page, '归档流程验证');
  await actions.getByRole('button', { name: '恢复', exact: true }).click();
  await expect(page.getByText('没有归档作品', { exact: true })).toBeVisible();
  await archived(page, false);
  await workRow(page, '归档流程验证').locator('>button').click();
  await expect(page.getByLabel('LaTeX', { exact: true })).toHaveValue('x^2');
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档作品', exact: true }).click();
  await archived(page);
  await actions.getByRole('button', { name: '彻底删除', exact: true }).click();
  await page.getByRole('alertdialog', { name: '彻底删除' }).getByRole('button', { name: '取消', exact: true }).click();
  await expect(actions.getByRole('button', { name: '彻底删除', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(actions.getByRole('button', { name: '彻底删除', exact: true })).toBeInViewport();
  await actions.getByRole('button', { name: '彻底删除', exact: true }).click();
  await page.getByRole('alertdialog', { name: '彻底删除' }).getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(page.getByText('没有归档作品', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('没有归档作品', { exact: true })).toBeVisible();
});

test('归档和彻底删除的响应丢失后按原请求确认，刷新返回首页', async ({ page }) => {
  await importSource(page, emptySource('plane'));
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
    if (action === 'purge') await page.getByRole('alertdialog', { name: '彻底删除' }).getByRole('button', { name: '彻底删除', exact: true }).click();
    await expect(page.getByRole('button', { name: action === 'deletion' ? '确认归档结果' : '确认删除结果', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '返回工坊', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: '确认结果', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认结果', exact: true })).toBeHidden();
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(1);
    await page.reload();
    await expect(page.getByRole('main').getByRole('heading', { name: action === 'purge' ? '已归档' : '全部作品', exact: true })).toBeVisible();
    await expect(page.getByLabel('作品名称', { exact: true })).toBeHidden();
    if (action === 'deletion') {
      await archived(page);
      await workRow(page, '请求确认作品').locator('>button').click();
      await expect(page.getByRole('button', { name: '恢复作品', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '图形与标注', exact: true })).toBeHidden();
    } else await expect(page.getByText('没有归档作品', { exact: true })).toBeVisible();
  }
});

test('导入旧平面图后编辑保存重开及真实导出，窄屏操作可达', async ({ page }, info) => {
  await importSource(page, emptySource('plane'));
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
  await importSource(page, emptySource('formula'));
  await page.getByRole('button', { name: '公式源码', exact: true }).click();
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
  await workRow(page, '求根公式').locator('>button').click();
  await expect(page.getByLabel('作品名称')).toHaveValue('求根公式');
  await expect(page.locator('#math-export-options')).toHaveCount(0);
  await expect(page.locator('.math-formula-preview img')).toBeVisible();
  await expect.poll(() => page.locator('.math-formula-preview img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('formula-desktop.png') });
});

test('演示对象、参数、步骤切换保留修改，下载物可离线运行', async ({ page, browser }, info) => {
  await importSource(page, emptyDynamicSource());
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

test('导入旧空间源保持草稿，网页导入后可修改源码并恢复历史', async ({ page }, info) => {
  await importSource(page, emptySource('space'));
  await page.getByRole('button', { name: '正方体示例', exact: true }).click();
  await page.getByLabel('作品名称').fill('正方体截面');
  await page.getByLabel('z', { exact: true }).fill('3');
  await page.reload();
  await selectTools(page, '对象');
  await expect(page.getByLabel('z', { exact: true })).toHaveValue('3');
  await selectTools(page, '画布');
  await page.getByLabel('azimuth', { exact: true }).fill('45');
  const space = await save(page);
  expect(space.source.points[0].z).toBe(3);
  expect(space.source.azimuth).toBe(45);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await chooseFile(page, '导入网页', { name: '面积演示.html', mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><meta charset="utf-8"><h1>三角形面积</h1><button onclick="document.querySelector(\'output\').textContent=6">计算</button><output>0</output>') });
  await expect(page.getByLabel('作品名称')).toHaveValue('面积演示.html');
  const html = await save(page);
  await page.getByRole('button', { name: '编辑源码', exact: true }).click();
  const editor = page.getByLabel('网页源码', { exact: true });
  await editor.fill((await editor.inputValue()).replace('textContent=6', 'textContent=12'));
  await save(page);
  await page.reload();
  await page.locator('.math-html .math-add').getByRole('button', { name: '运行预览', exact: true }).click();
  const preview = page.frameLocator('iframe[title="作品隔离预览"]').frameLocator('iframe');
  await preview.getByRole('button', { name: '计算', exact: true }).click();
  await expect(preview.locator('output')).toHaveText('12');
  await page.screenshot({ path: info.outputPath('html-desktop.png') });
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '历史版本', exact: true }).click();
  const history = page.getByRole('dialog', { name: '历史版本', exact: true });
  await history.getByLabel('保存记录').selectOption(String(html.version));
  await expect(history.locator('iframe')).toHaveCount(0);
  await history.getByRole('button', { name: '恢复版本' }).click();
  await expect(page.locator('iframe[title="作品隔离预览"]')).toHaveCount(0);
  const restored = await save(page);
  expect(restored.originalFileId).toBe(html.originalFileId);
  await page.locator('.math-html .math-add').getByRole('button', { name: '运行预览', exact: true }).click();
  await preview.getByRole('button', { name: '计算', exact: true }).click();
  await expect(preview.locator('output')).toHaveText('6');
});


test('导入的旧公式保留结构输入和设备草稿恢复', async ({ page }, info) => {
  await importSource(page, emptySource('formula'));
  await page.getByRole('button', { name: '分式', exact: true }).click();
  await page.getByLabel('分子', { exact: true }).fill('x+3');
  await page.getByLabel('分母', { exact: true }).fill('4');
  await expect(page.getByLabel('LaTeX', { exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^资源库/ }).click();
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^数学工坊/ }).click();
  await page.reload();
  await expect(page.getByLabel('分子', { exact: true })).toHaveValue('x+3');
  await expect(page.getByLabel('分母', { exact: true })).toHaveValue('4');
  await expect(page.getByRole('img', { name: '当前公式预览' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('guided-formula.png') });
  expect((await save(page)).source.latex).toBe('\\frac{x+3}{4}');
});

test('画布选择与右侧联动，空间棱在当前对象处编辑', async ({ page }, info) => {
  await importSource(page, emptySource('space'));
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

async function addGraph(page, name) {
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

test('自然数学输入、分段表单和数值分析可保存重开，渐近线不误报零点', async ({ page }, info) => {
  await importSource(page, emptySource('plane'));
  await page.getByRole('button', { name: '从 y = x² 开始', exact: true }).click();
  await page.getByLabel('expression', { exact: true }).fill('x²-2x-3');
  await expect(page.locator('.math-graphic-preview [data-object="f1"] path').first()).toBeVisible();
  await page.getByRole('button', { name: '函数分析', exact: true }).click();
  await page.getByRole('button', { name: '查找零点', exact: true }).click();
  const results = page.getByLabel('分析结果', { exact: true });
  await expect(results).toContainText('2 个候选点');
  await expect(results).toContainText('(-1,'); await expect(results).toContainText('(3,');
  await page.getByRole('button', { name: '作为固定点加入图形', exact: true }).click();
  await expect(page.locator('.math-graphic-preview [data-object="R1"] circle').first()).toBeVisible();
  await page.getByLabel('图形列表').getByRole('button', { name: /f1/ }).click();
  await page.getByLabel('expression', { exact: true }).fill('(x-0.37)^2');
  await page.getByRole('button', { name: '函数分析', exact: true }).click();
  await page.getByRole('button', { name: '查找零点', exact: true }).click();
  await expect(results).toContainText('1 个候选点'); await expect(results).toContainText('0.37');
  await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await page.getByLabel('expression', { exact: true }).fill('1/(x-0.37)');
  await page.getByRole('button', { name: '函数分析', exact: true }).click();
  await page.getByRole('button', { name: '查找零点', exact: true }).click();
  await expect(results).toContainText('未找到');
  await addGraph(page, '添加分段函数');
  await page.getByLabel('第 1 段表达式', { exact: true }).fill('-x-1');
  await page.getByLabel('第 1 段条件', { exact: true }).fill('x < 0');
  await page.getByLabel('第 2 段表达式', { exact: true }).fill('2x');
  await expect(page.locator('[data-object] circle[data-endpoint="open"]:not(.math-graphic-hit)')).toHaveCount(1);
  const saved = await save(page); expect(saved.render.state).toBe('ready');
  expect(saved.source.scene.elements.at(-1).expression).toContain('2x');
  await page.reload(); await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(page.getByLabel('第 1 段表达式', { exact: true })).toHaveValue('-x - 1');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '添加一段', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('piecewise-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('关联构造随点变化，改名保持引用，删除依赖可取消并撤销', async ({ page }, info) => {
  await importSource(page, emptySource('plane'));
  await addGraph(page, '添加点');
  await page.getByLabel('at-x', { exact: true }).fill('-2');
  await addGraph(page, '添加点');
  await page.getByLabel('at-x', { exact: true }).fill('2');
  await addGraph(page, '关联构造…');
  await page.getByLabel('第一个点', { exact: true }).selectOption('P1');
  await page.getByLabel('第二个点', { exact: true }).selectOption('P2');
  await page.getByRole('button', { name: '添加中点', exact: true }).click();
  const dot = page.locator('.math-graphic-preview [data-object="C1"] circle:not(.math-graphic-hit)');
  await expect(dot).toHaveAttribute('cx', '480');
  await page.getByLabel('图形列表').getByRole('button', { name: /^P2/ }).click();
  await page.getByLabel('at-y', { exact: true }).fill('2');
  await page.getByLabel('id', { exact: true }).fill('B');
  await expect(dot).not.toHaveAttribute('cy', '360');
  const saved = await save(page); expect(saved.render.state).toBe('ready');
  expect(saved.source.scene.elements.at(-1).construction.refs).toEqual(['P1', 'B']);
  await page.getByRole('button', { name: '移除对象', exact: true }).click();
  const confirm = page.getByRole('alertdialog'); await expect(confirm).toContainText('1 个依赖');
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dot).toBeVisible();
  await page.getByRole('button', { name: '移除对象', exact: true }).click();
  await confirm.getByRole('button', { name: '继续', exact: true }).click();
  await expect(dot).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(dot).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(dot).toBeVisible();
  await page.screenshot({ path: info.outputPath('construction-desktop.png') });
});

test('平面渲染错误显示双语具体原因，修正后可保存重开', async ({ page }, info) => {
  await importSource(page, emptySource('plane'));
  await addGraph(page, '添加圆 / 椭圆');
  await page.getByLabel('rx', { exact: true }).fill('0');
  const error = page.getByRole('alert');
  await expect(error).toHaveText('半径必须大于零，请将水平半径和垂直半径都设为正数。');
  await expect(error).toHaveAttribute('title', '半径必须大于零，请将水平半径和垂直半径都设为正数。');
  await page.screenshot({ path: info.outputPath('radius-error-zh.png'), animations: 'disabled' });
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(error).toHaveText('Radii must be greater than zero. Set both the horizontal and vertical radii to positive values.');
  await expect(error).toHaveAttribute('title', 'Radii must be greater than zero. Set both the horizontal and vertical radii to positive values.');
  await page.screenshot({ path: info.outputPath('radius-error-en.png'), animations: 'disabled' });
  await page.getByLabel('rx', { exact: true }).fill('1');
  await expect(error).toHaveCount(0);
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: '简体中文 Chinese (Simplified)', exact: true }).click();
  const radiusSaved = await save(page);
  expect(radiusSaved.render.state).toBe('ready');
  await page.reload();
  await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(page.getByLabel('rx', { exact: true })).toHaveValue('1');
  await expect(error).toHaveCount(0);

  await addGraph(page, '添加函数');
  await page.getByLabel('expression', { exact: true }).fill('sqrt(-1)');
  await expect(error).toHaveText('当前窗口内函数无有效值，请调整表达式、定义域或画布范围。');
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(error).toHaveText('The function has no valid values in the current window. Adjust its expression, domain, or canvas range.');
  await expect(error).toHaveAttribute('title', 'The function has no valid values in the current window. Adjust its expression, domain, or canvas range.');
  await page.getByLabel('expression', { exact: true }).fill('sin(');
  await expect(error).toContainText('Invalid expression.');
  await expect(error).toHaveAttribute('title', '请检查表达式的括号、运算符和分段条件');
  await page.getByLabel('expression', { exact: true }).fill('x^2');
  await expect(error).toHaveCount(0);
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: '简体中文 Chinese (Simplified)', exact: true }).click();
  expect((await save(page)).render.state).toBe('ready');

  await addGraph(page, '添加文字');
  await page.getByLabel('text', { exact: true }).fill('说明'.repeat(300));
  await page.getByRole('button', { name: '颜色与样式', exact: true }).click();
  await page.getByLabel('style-fontSize', { exact: true }).fill('64');
  await expect(error).toHaveText('文字超出画布，请缩小字号或精简标注。');
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(error).toHaveText('The text exceeds the canvas. Reduce its font size or shorten the label.');
  await expect(error).toHaveAttribute('title', 'The text exceeds the canvas. Reduce its font size or shorten the label.');
  await page.getByLabel('text', { exact: true }).fill('说明');
  await expect(error).toHaveCount(0);
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: '简体中文 Chinese (Simplified)', exact: true }).click();
  expect((await save(page)).render.state).toBe('ready');
});

test('空间面和截面保存重开及真实 SVG 下载，错误平面可修正', async ({ page }, info) => {
  await importSource(page, emptySource('space'));
  await page.getByRole('button', { name: '正方体示例', exact: true }).click();
  await expect(page.locator('.math-graphic-preview [data-surface]')).toHaveCount(6);
  await addGraph(page, '添加截面');
  await expect(page.locator('.math-graphic-preview [data-surface="S1"] polygon:not(.math-graphic-hit)')).toBeVisible();
  await page.getByLabel('section-d', { exact: true }).fill('0.5');
  const saved = await save(page); expect(saved.render.state).toBe('ready');
  const target = info.outputPath('section.svg'); await download(page, 'svg', target);
  expect(fs.readFileSync(target, 'utf8')).toContain('data-surface="S1"');
  await page.reload(); await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(page.getByLabel('section-d', { exact: true })).toHaveValue('0.5');
  await page.getByLabel('section-c', { exact: true }).fill('0');
  const sectionError = page.getByRole('alert');
  await expect(sectionError).toHaveText('截平面的法向量不能为零，请将 a、b、c 中至少一个系数设为非零。');
  await page.screenshot({ path: info.outputPath('section-error-zh.png'), animations: 'disabled' });
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(sectionError).toHaveText('The section plane normal cannot be zero. Set at least one of a, b, or c to a nonzero value.');
  await expect(sectionError).not.toHaveAttribute('title', /[\u4e00-\u9fff]/);
  await page.screenshot({ path: info.outputPath('section-error-en.png'), animations: 'disabled' });
  await page.getByLabel('section-c', { exact: true }).fill('1');
  await expect(sectionError).toHaveCount(0);
  await expect(page.locator('.math-graphic-preview [data-surface="S1"]')).toBeVisible();
  await page.getByRole('button', { name: /^(简体中文|English)$/ }).click();
  await page.getByRole('menuitemradio', { name: '简体中文 Chinese (Simplified)', exact: true }).click();
  const repaired = await save(page);
  expect(repaired.version).toBe(saved.version + 1);
  expect(repaired.render.state).toBe('ready');
  const repairedTarget = info.outputPath('section-repaired.svg');
  await download(page, 'svg', repairedTarget);
  expect(fs.readFileSync(repairedTarget, 'utf8')).toContain('data-surface="S1"');
  const exported = await page.context().newPage();
  try {
    await exported.goto(pathToFileURL(repairedTarget).href);
    await expect(exported.locator('[data-surface="S1"] polygon')).toBeVisible();
    await exported.screenshot({ path: info.outputPath('section-repaired-export.png') });
  } finally { await exported.close(); }
  await page.reload();
  await page.getByRole('button', { name: '图形与标注', exact: true }).click();
  await expect(page.getByLabel('section-c', { exact: true })).toHaveValue('1');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('section-desktop.png') });
  await page.getByRole('link', { name: /账户：/ }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^数学工坊/ }).click();
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel('section-d', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByLabel('section-d', { exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`section-dark-${width}.png`) });
  }
});

test('自动播放可暂停重置，轨迹和几何联动在实际下载物禁网后可用', async ({ page, browser }, info) => {
  await importSource(page, emptyDynamicSource());
  await page.getByRole('button', { name: '试试二次函数演示', exact: true }).click();
  await addGraph(page, '添加点');
  await addGraph(page, '关联构造…');
  await page.getByLabel('第一个点', { exact: true }).selectOption('P');
  await page.getByLabel('第二个点', { exact: true }).selectOption('P1');
  await page.getByRole('button', { name: '添加中点', exact: true }).click();
  await page.getByRole('button', { name: '设置滑杆', exact: true }).click();
  await page.getByRole('button', { name: '自动播放与轨迹', exact: true }).click();
  await page.getByLabel('播放参数', { exact: true }).selectOption('h');
  await page.getByLabel('单程秒数', { exact: true }).fill('2');
  await page.getByLabel('P 的轨迹', { exact: true }).check();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByLabel('h 数值', { exact: true })).not.toHaveValue('0');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  const value = await page.getByLabel('h 数值', { exact: true }).inputValue();
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
  await expect(page.locator('[data-trace="P"]')).toBeVisible();
  await page.getByRole('button', { name: '清除轨迹', exact: true }).click();
  await expect(page.locator('[data-trace="P"]')).toHaveCount(0);
  await expect(page.getByLabel('h 数值', { exact: true })).toHaveValue(value);
  const saved = await save(page); expect(saved.source.parameters[1].initial).toBe(1);
  expect(saved.source.steps[0].values.find(v => v.name === 'h').value).toBe(0);
  const target = info.outputPath('animation.html'); await download(page, 'html', target);
  const offline = await browser.newContext({ offline: true });
  const errors = [];
  try {
    const local = await offline.newPage(); local.on('pageerror', e => errors.push(e.message));
    await local.goto(pathToFileURL(target).href);
    const frame = local.frameLocator('iframe');
    await expect(frame.getByLabel('h 数值', { exact: true })).toHaveValue('0');
    const midpoint = frame.locator('[data-object="C1"] circle');
    await expect(midpoint).toHaveAttribute('cx', '480');
    await frame.getByRole('button', { name: '播放', exact: true }).click();
    await expect(frame.getByLabel('h 数值', { exact: true })).not.toHaveValue('0');
    await frame.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(midpoint).not.toHaveAttribute('cx', '480');
    await expect(frame.locator('[data-trace="P"]')).toBeVisible();
    await frame.getByRole('button', { name: '重置', exact: true }).click();
    await expect(frame.getByLabel('h 数值', { exact: true })).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally { await offline.close(); }
});


test('公式延迟聚焦不能抢回作品名输入，键盘和点击仍可回到公式', async ({ page }) => {
  await importSource(page, emptySource('formula'));
  await page.getByRole('button', { name: '可视化编辑', exact: true }).click();
  const field = page.locator('math-field'), title = page.getByLabel('作品名称');
  await expect(field).toBeVisible();
  await field.click(); await field.pressSequentially('x+1');
  await title.click(); await title.press('ControlOrMeta+A'); await title.pressSequentially('Quick title');
  await expect(title).toHaveValue('Quick title');
  await expect.poll(() => field.evaluate(el => el.value)).toBe('x+1');
  // Model the browser's public focus handoff in one task, then advance the
  // library's timer. This is a mechanism probe, separate from the user path.
  await page.clock.install();
  await page.evaluate(() => {
    const input = document.querySelector('math-field');
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    input.focus();
    const title = document.querySelector('input[aria-label="作品名称"]');
    title.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); title.focus();
  });
  await page.clock.runFor(120);
  await expect(title).toBeFocused();
  await title.press('End'); await title.pressSequentially(' 2');
  await expect.poll(() => field.evaluate(el => el.value)).toBe('x+1');
  await field.click(); await field.press('End'); await field.pressSequentially('+2');
  await expect.poll(() => field.evaluate(el => el.value)).toBe('x+1+2');
});

test('旧空间源移空后创建面可独立保存，不要求额外添加棱', async ({ page }) => {
  await importSource(page, emptySource('space'));
  await addGraph(page, '添加点');
  await addGraph(page, '添加点'); await page.getByLabel('x', { exact: true }).fill('2');
  await addGraph(page, '添加点'); await page.getByLabel('y', { exact: true }).fill('2');
  await addGraph(page, '添加面');
  await expect(page.locator('[data-surface="F1"]')).toBeVisible();
  const work = await save(page);
  expect(work.source.edges).toEqual([]); expect(work.source.faces[0].vertices).toEqual(['P1', 'P2', 'P3']);
  expect(work.render.state).toBe('ready');
  await page.reload(); await expect(page.locator('[data-surface="F1"]')).toBeVisible();
});

test('多级构造的中间对象可改名，后续引用同步且仍拒绝循环', async ({ page }) => {
  await importSource(page, emptySource('plane'));
  await addGraph(page, '添加点');
  await addGraph(page, '添加点'); await page.getByLabel('at-x', { exact: true }).fill('4');
  await addGraph(page, '关联构造…');
  await page.getByLabel('第一个点', { exact: true }).selectOption('P1');
  await page.getByLabel('第二个点', { exact: true }).selectOption('P2');
  await page.getByRole('button', { name: '添加中点', exact: true }).click();
  await addGraph(page, '关联构造…');
  await page.getByLabel('第一个点', { exact: true }).selectOption('C1');
  await page.getByLabel('第二个点', { exact: true }).selectOption('P2');
  await page.getByRole('button', { name: '添加中点', exact: true }).click();
  await page.getByLabel('图形列表').getByRole('button', { name: /^C1/ }).click();
  await page.getByLabel('id', { exact: true }).fill('M');
  await expect(page.getByLabel('id', { exact: true })).toHaveValue('M');
  await page.getByLabel('第一个点', { exact: true }).selectOption('C2');
  await expect(page.getByLabel('第一个点', { exact: true })).toHaveValue('P1');
  const work = await save(page);
  expect(work.source.scene.elements[3].construction.refs).toEqual(['M', 'P2']);
  expect(work.render.state).toBe('ready');
  await page.reload(); await expect(page.locator('.math-graphic-preview [data-object="M"]')).toBeVisible();
});


test('未知制作源只读打开并保留完整内容，禁止旧编辑器保存', async ({ page }) => {
  const work = await importSource(page, { ...emptySource('formula'), latex: 'x+1' }, '未来格式作品');
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  const source = { schemaVersion: 9, kind: 'future', payload: { formulas: ['x+1'], opaque: '完整原文' } };
  await page.route(`**/api/modules/math/v1/works/${work.id}`, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), source } });
  });
  await workRow(page, '未来格式作品').locator('>button').click();
  await expect(page.getByText('作品格式需要更新，请升级后编辑。', { exact: true })).toBeVisible();
  expect(JSON.parse(await page.locator('.math-formula pre').innerText())).toEqual(source);
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await expect(page.locator('.math-formula-editor')).toHaveCount(0);
  await page.reload();
  expect(JSON.parse(await page.locator('.math-formula pre').innerText())).toEqual(source);
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
});


test('已有旧 GeoGebra 类型从作品列表打开并刷新，完整构造仍可读', async ({ page }) => {
  await installMathProbe(page);
  await page.reload();
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await enterMath(page, 'A=(2,3)', 'A');
  const original = await savedMath(page);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  // Seed a real historical type through the authenticated creation endpoint.
  // The GGB bytes come from the actual local editor, not a fabricated engine file.
  await page.route('**/api/modules/math/v1/works', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const input = JSON.parse(route.request().postData());
    const source = { schemaVersion: 1, kind: 'geogebra', appName: 'classic', base64: original.source.graph.base64 };
    const response = await route.fetch({ postData: JSON.stringify({ ...input, source }) });
    await route.fulfill({ response });
  });
  const legacy = await importSource(page, { ...emptySource('formula'), latex: 'x+1' }, '旧画布作品');
  expect(legacy.source.kind).toBe('geogebra');
  await page.unroute('**/api/modules/math/v1/works');
  await expect.poll(async () => (await currentApi(page, 'A'))?.coords, { timeout: 90000 }).toEqual([2,3]);
  await expect(page.locator('.math-geogebra')).toHaveAttribute('aria-busy', 'false');
  // Resize the real mounted canvas before leaving. Native layout XML changes
  // must not turn an untouched saved construction into an unsaved edit.
  const width = await page.locator('.math-geogebra-host canvas').first().evaluate(canvas => canvas.width);
  await page.setViewportSize({ width: 1200, height: 850 });
  await expect.poll(() => page.locator('.math-geogebra-host canvas').first().evaluate(canvas => canvas.width)).not.toBe(width);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  expect(await currentApi(page, 'A')).toBeNull();
  await workRow(page, '旧画布作品').locator('>button').click();
  await expect(page.locator('.math-ggb-workspace')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect.poll(async () => (await currentApi(page, 'A'))?.coords, { timeout: 90000 }).toEqual([2,3]);
  await expect(page.locator('.math-ggb-workspace .mw-save-state')).toContainText(`已保存 · 版本 ${legacy.version}`);
  await page.reload();
  await expect.poll(async () => (await currentApi(page, 'A'))?.coords, { timeout: 90000 }).toEqual([2,3]);
  await expect(page.getByLabel('作品名称', { exact: true })).toHaveValue('旧画布作品');
  // The layout guard must still preserve a real pointer edit and its revision.
  const canvas = await page.locator('.math-geogebra-host canvas').first().boundingBox();
  const view = await page.evaluate(() => {
    const host = document.querySelector('.math-geogebra-host > div');
    const raw = window.mathTestApis[host.id].getViewProperties(1);
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  });
  const point = (x, y) => ({ x: canvas.x + (x - view.xMin) / view.invXscale, y: canvas.y + view.height - (y - view.yMin) / view.invYscale });
  const from = point(2, 3), to = point(1, 2);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 15 }); await page.mouse.up();
  const dragged = (await currentApi(page, 'A')).coords;
  expect(dragged[0]).toBeCloseTo(1, 2); expect(dragged[1]).toBeCloseTo(2, 2);
  const response = page.waitForResponse(result => result.request().method() === 'PUT' && result.url().endsWith(`/works/${legacy.id}`));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const result = await response; expect(result.status()).toBe(200);
  const saved = await result.json();
  expect(saved.id).toBe(legacy.id); expect(saved.version).toBe(legacy.version + 1);
  await page.reload();
  await expect.poll(async () => (await currentApi(page, 'A'))?.coords, { timeout: 90000 }).toEqual(dragged);
});

// Sample the rendered stroke, including its gaps. Attributes alone cannot catch
// a solid face boundary drawn underneath the dashed edge.
async function strokePixels(image, edge) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = Math.min(info.width / 960, info.height / 720);
  const offsetX = (info.width - 960 * scale) / 2;
  const offsetY = (info.height - 720 * scale) / 2;
  const [x1, y1, x2, y2] = edge;
  const length = Math.hypot(x2 - x1, y2 - y1);
  let gaps = 0, ink = 0;
  for (let d = 26; d < length - 26; d += 0.5) {
    const x = offsetX + (x1 + (x2 - x1) * d / length) * scale;
    const y = offsetY + (y1 + (y2 - y1) * d / length) * scale;
    // Include neighbouring pixels so raster antialiasing cannot turn a
    // continuous thin diagonal into false gaps.
    let redOnWhite = 255;
    for (const pixelY of [Math.floor(y), Math.ceil(y)]) for (const pixelX of [Math.floor(x), Math.ceil(x)]) {
      const i = (pixelY * info.width + pixelX) * 4;
      const alpha = data[i + 3] / 255;
      redOnWhite = Math.min(redOnWhite, data[i] * alpha + 255 * (1 - alpha));
    }
    if (redOnWhite > 180) gaps++;
    if (redOnWhite < 100) ink++;
  }
  return { gaps, ink };
}


test("real space edge dash has visible gaps after reopening and PNG SVG export", async ({ page, context }, info) => {
  await importSource(page, emptySource('space'));
  await page.getByRole('button', { name: '正方体示例', exact: true }).click();
    await page.getByLabel("作品名称").fill("遮挡棱真实虚线");
    async function saveAndReopen() {
      const response = page.waitForResponse(r => r.url().includes("/api/modules/math/v1/works") && ["POST", "PUT"].includes(r.request().method()));
      await page.getByRole("button", { name: "保存", exact: true }).click();
      const result = await response;
      expect(result.ok(), await result.text()).toBe(true);
      await expect(page.locator(".math-workspace-status")).toHaveText("已保存");
      await page.reload();
      await page.getByRole("button", { name: "图形与标注", exact: true }).click();
    }
    await saveAndReopen();
    await page.getByLabel("图形列表").getByRole("button", { name: "D → A", exact: true }).click();
    await page.getByLabel("style-dash", { exact: true }).selectOption("dashed");
    await saveAndReopen();
    await expect(page.getByLabel("style-dash", { exact: true })).toHaveValue("dashed");
    // Move selection away so an editing highlight cannot mask the real line.
    await page.getByLabel("图形列表").getByRole("button", { name: "A", exact: true }).click();
    const svg = page.locator(".math-graphic-preview svg");
    const path = svg.locator('path[stroke-dasharray="8 5"]').first();
    const edge = (await path.getAttribute("d")).match(/-?\d+(?:\.\d+)?/g).map(Number);
    const canvasFile = info.outputPath("cube-canvas.png");
    await svg.screenshot({ path: canvasFile });
    const samples = { canvas: await strokePixels(canvasFile, edge) };
    const viewer = await context.newPage();
    try {
      for (const format of ["png", "svg", "source"]) {
        if (!await page.locator("#math-export-options").isVisible()) await page.getByRole("button", { name: "下载图片", exact: true }).click();
        await page.getByLabel("导出格式", { exact: true }).selectOption(format);
        const event = page.waitForEvent("download");
        await page.getByRole("button", { name: "下载作品", exact: true }).click();
        const file = info.outputPath(`cube.${format === "source" ? "json" : format}`);
        await (await event).saveAs(file);
        if (format === "source") {
          expect(JSON.parse(fs.readFileSync(file, "utf8")).edges.find(e => e.from === "D" && e.to === "A").style.dash).toBe("dashed");
        } else {
          await viewer.setViewportSize({ width: 1600, height: 1200 });
          await viewer.goto(pathToFileURL(file).href);
          const opened = info.outputPath(`cube-${format}-opened.png`);
          if (format === "svg") await viewer.locator("svg").screenshot({ path: opened });
          else await viewer.locator("img").screenshot({ path: opened });
          samples[format] = await strokePixels(format === "png" ? file : opened, edge);
        }
      }
    } finally { await viewer.close(); }
    fs.writeFileSync(info.outputPath("stroke-pixels.json"), JSON.stringify(samples, null, 2));
    for (const [format, sample] of Object.entries(samples)) {
      expect(sample.ink, `${format} has visible ink`).toBeGreaterThan(20);
      expect(sample.gaps, `${format} has actual gaps, not a solid face outline`).toBeGreaterThan(10);
    }
    // A section owns its boundary even though the solid has explicit edges.
    await page.getByRole("button", { name: "添加图形", exact: true }).click();
    await page.getByRole("menuitem", { name: "添加截面", exact: true }).click();
    await page.getByLabel("section-d", { exact: true }).fill("0.5");
    const styles = page.getByRole("button", { name: "颜色与样式", exact: true });
    if (await styles.getAttribute("aria-expanded") !== "true") await styles.click();
    await page.getByLabel("style-stroke", { exact: true }).fill("#166534");
    await page.getByLabel("style-width", { exact: true }).fill("4");
    await saveAndReopen();
    await expect(page.getByLabel("section-d", { exact: true })).toHaveValue("0.5");
    const section = svg.locator('[data-surface="S1"] polygon:not(.math-graphic-hit)');
    await expect(section).toHaveAttribute("stroke", "#166534");
    await expect(section).toHaveAttribute("stroke-width", "4");
    await svg.screenshot({ path: info.outputPath("cube-section-canvas.png") });
    for (const format of ["png", "svg"]) {
      if (!await page.locator("#math-export-options").isVisible()) await page.getByRole("button", { name: "下载图片", exact: true }).click();
      await page.getByLabel("导出格式", { exact: true }).selectOption(format);
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: "下载作品", exact: true }).click();
      await (await event).saveAs(info.outputPath(`cube-section.${format}`));
    }
});

test("real standalone face and partial explicit edge keep selectable styled boundaries", async ({ page }, info) => {
  await importSource(page, emptySource('space'));
    await page.getByLabel("作品名称").fill("独立面和部分棱");
    async function add(name) {
      await page.getByRole("button", { name: "添加图形", exact: true }).click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    }
    async function save() {
      const response = page.waitForResponse(r => r.url().includes("/api/modules/math/v1/works") && ["POST", "PUT"].includes(r.request().method()));
      await page.getByRole("button", { name: "保存", exact: true }).click();
      const result = await response;
      expect(result.ok(), await result.text()).toBe(true);
      await expect(page.locator(".math-workspace-status")).toHaveText("已保存");
      return result.json();
    }
    await add("添加点");
    await add("添加点"); await page.getByLabel("x", { exact: true }).fill("2");
    await add("添加点"); await page.getByLabel("y", { exact: true }).fill("2");
    await add("添加面");
    await page.getByRole("button", { name: "颜色与样式", exact: true }).click();
    await page.getByLabel("style-stroke", { exact: true }).fill("#166534");
    await page.getByLabel("style-width", { exact: true }).fill("4");
    const work = await save();
    expect(work.source.edges).toEqual([]);
    await page.reload();
    const surface = page.locator('.math-graphic-preview [data-surface="F1"]');
    const polygon = surface.locator("polygon:not(.math-graphic-hit)");
    await expect(polygon).toHaveAttribute("stroke", "#166534");
    await expect(polygon).toHaveAttribute("stroke-width", "4");
    await surface.click();
    await expect(page.getByLabel("面顶点 1", { exact: true })).toHaveValue("P1");
    await page.locator(".math-graphic-preview svg").screenshot({ path: info.outputPath("face-only-canvas.png") });
    await add("添加棱");
    await page.getByLabel("棱起点", { exact: true }).selectOption("P1");
    await page.getByLabel("棱终点", { exact: true }).selectOption("P2");
    await page.getByLabel("style-dash", { exact: true }).selectOption("dashed");
    await save(); await page.reload();
    await expect(polygon).toHaveAttribute("stroke", "none");
    await expect(surface.locator('path:not(.math-graphic-hit)')).toHaveCount(2);
    for (const boundary of await surface.locator('path:not(.math-graphic-hit)').all()) {
      await expect(boundary).toHaveAttribute("stroke", "#166534");
      await expect(boundary).toHaveAttribute("stroke-width", "4");
    }
    await page.locator(".math-graphic-preview svg").screenshot({ path: info.outputPath("partial-face-canvas.png") });
    for (const format of ["png", "svg"]) {
      if (!await page.locator("#math-export-options").isVisible()) await page.getByRole("button", { name: "下载图片", exact: true }).click();
      await page.getByLabel("导出格式", { exact: true }).selectOption(format);
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: "下载作品", exact: true }).click();
      await (await event).saveAs(info.outputPath(`partial-face.${format}`));
    }
});

test('兼容公式字体失败可重试，语法错误能定位源位置', async ({ page }) => {
  let fail = true;
  await page.route('**/vendor/math/noto-sans-sc/files/*.woff', route => fail ? route.abort('failed') : route.continue());
  await page.reload();
  await importSource(page, { ...emptySource('formula'), latex: 'x+1' });
  await expect(page.getByRole('button', { name: '重试字体', exact: true })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '重试字体', exact: true }).click();
  await expect(page.getByRole('img', { name: '当前公式预览', exact: true })).toBeVisible();
  await page.getByLabel('LaTeX', { exact: true }).fill(String.raw`\frac{1`);
  await page.getByRole('button', { name: '定位到第 1 行第 6 列', exact: true }).click();
  expect(await page.getByLabel('LaTeX', { exact: true }).evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([5, 6]);
});

test('旧动态参数改名保留科学记数法，刷新后源码仍可读', async ({ page }) => {
  await importSource(page, dynamicSource());
  await selectTools(page, '参数');
  const name = page.getByLabel('parameter-0-name', { exact: true });
  await name.fill('e3');
  await page.getByRole('button', { name: '应用参数 1', exact: true }).click();
  await selectTools(page, '对象');
  await page.getByLabel('图形列表', { exact: true }).getByRole('button', { name: /^f / }).click();
  await page.getByLabel('expression', { exact: true }).fill('1e3*x+e3');
  await expect(page.locator('.math-dynamic [data-object="f"]')).toBeVisible();
  await selectTools(page, '参数');
  await name.fill('b');
  await page.getByRole('button', { name: '应用参数 1', exact: true }).click();
  const result = await save(page);
  expect(result.render.state).toBe('ready');
  expect(result.source.scene.elements[0].expression).toBe('1e3*x+b');
  await page.reload();
  await selectTools(page, '对象');
  await expect(page.getByLabel('expression', { exact: true })).toHaveValue('1e3*x+b');
});

test('极窄浮点坐标窗能真实保存并刷新重开', async ({ page }) => {
  const source = emptySource('plane');
  source.scene.elements = [{ ...newElement('point', 'P1'), at: { x: '1000000', y: '1000000' } }];
  source.scene.viewport = { ...source.scene.viewport, xMin: 999999.9999999999, xMax: 1000000, yMin: 999999.9999999999, yMax: 1000000 };
  const result = await importSource(page, source);
  expect(result.render.state).toBe('ready');
  await page.reload();
  await selectTools(page, '画布');
  await expect(page.getByLabel('xMin', { exact: true })).toHaveValue('999999.9999999999');
  await expect(page.getByLabel('xMax', { exact: true })).toHaveValue('1000000');
});

test('HTML 主动运行隔离身份、写入和外部资源，自导航后停止预览', async ({ page }, info) => {
  const hostile = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline'"><base href="https://m42-external.invalid/"><meta http-equiv="refresh" content="0;url=https://m42-external.invalid/meta"><a href="https://m42-external.invalid/link">link</a><pre id="results"></pre><button id="navigate" onclick="location.href='about:blank'">自导航</button><button id="network" onclick="document.querySelector('form').requestSubmit();window.open('https://m42-external.invalid/popup');try{top.location='https://m42-external.invalid/top'}catch{}">受限请求</button><form action="https://m42-external.invalid/form"><input name="secret" value="none"></form><script>
const result={};for(const [key,read] of Object.entries({parent:()=>parent.document.body.innerText,cookie:()=>document.cookie,storage:()=>localStorage.length,page:()=>parent.sessionStorage.length})) {try{result[key]=read()}catch(e){result[key]='blocked'}}
parent.postMessage({type:'saveWork',title:'HOSTILE',accountKey:'fake'},'*');
fetch('https://m42-external.invalid/fetch').catch(()=>{});try{new WebSocket('wss://m42-external.invalid/socket')}catch{};try{new Worker('https://m42-external.invalid/worker')}catch{};
document.querySelector('#results').textContent=JSON.stringify(result);
</script><script src="https://m42-external.invalid/script"></script><img src="https://m42-external.invalid/img"><iframe src="https://m42-external.invalid/frame"></iframe>`;

  const errors = [], writes = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await chooseFile(page, '导入网页', { name: 'hostile.html', mimeType: 'text/html', buffer: Buffer.from(hostile) });
  await save(page);
  page.on('request', request => { if (request.url().includes('/api/modules/math') && request.method() !== 'GET') writes.push(request.url()); });
  const run = page.locator('.math-html .math-add').getByRole('button', { name: '运行预览', exact: true });
  await run.click();
  const outer = page.frameLocator('iframe[title="作品隔离预览"]');
  const inner = outer.frameLocator('iframe[title="隔离作品"]');
  await expect(inner.locator('#results')).toHaveText(JSON.stringify({ parent: 'blocked', cookie: 'blocked', storage: 'blocked', page: 'blocked' }));
  await expect(inner.locator('a')).not.toHaveAttribute('href', /./);
  await inner.getByRole('button', { name: '受限请求', exact: true }).click();
  expect(writes).toEqual([]);
  expect(errors.some(message => /Content Security Policy|violates.*policy/i.test(message))).toBe(true);
  await inner.getByRole('button', { name: '自导航', exact: true }).click();
  await expect(outer.getByRole('status')).toContainText('预览已停止');
  await expect(outer.locator('iframe')).toHaveCount(0);
  await page.locator('.math-html .math-add').getByRole('button', { name: '关闭预览', exact: true }).click();
  await run.click();
  await expect(inner.locator('#results')).toBeVisible();
  await page.screenshot({ path: info.outputPath('hostile-preview.png') });
  world.clock.advance(8 * 86400000);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByLabel('网页源码', { exact: true })).toHaveCount(0);
});

test('HTML 首次修改前先保存原件，修改与取回保持原始字节', async ({ page }, info) => {
  const original = fs.readFileSync('test/fixtures/math/mx-model-revised.html');
  await chooseFile(page, '导入网页', { name: '原件.html', mimeType: 'text/html', buffer: original });
  await expect(page.getByRole('button', { name: '编辑源码', exact: true })).toBeDisabled();
  await save(page);
  await page.getByRole('button', { name: '编辑源码', exact: true }).click();
  await page.getByLabel('网页源码', { exact: true }).fill(original.toString().replace(/正比例函数斜率探究/g, '首次修改'));
  const work = await save(page);
  expect(work.originalFileId).not.toBe(work.source.fileId);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '取回原文件', exact: true }).click();
  const target = info.outputPath('original.html');
  await (await event).saveAs(target);
  expect(fs.readFileSync(target)).toEqual(original);
});

test('身份过期保留数学草稿，导出迟到响应不能跨账户下载', async ({ page }, info) => {
  const email = 'math-workspace@example.test';
  await importSource(page, { ...emptySource('formula'), latex: 'x^2+1' }, '账户 A 的公式');
  await page.getByRole('button', { name: '说明与样式', exact: true }).click();
  const caption = page.getByLabel('中文说明', { exact: true });
  await caption.fill('账户 A 未保存说明');
  world.clock.advance(8 * 86400000);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  const signIn = async () => {
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill('math-password');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
  };
  await signIn();
  await expect(caption).toHaveValue('账户 A 未保存说明');
  await save(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let arrived;
  const reached = new Promise(resolve => { arrived = resolve; });
  await page.route('**/api/workbench/files/*/content', async route => {
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  let downloads = 0;
  page.on('download', () => downloads++);
  try {
    await page.getByRole('button', { name: '下载图片', exact: true }).click();
    await page.getByRole('button', { name: '下载作品', exact: true }).click();
    await reached;
    world.clock.advance(8 * 86400000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
    await register(page, world, 'math-next-account@example.test');
    const tutorial = page.getByRole('button', { name: '知道了', exact: true });
    if (await tutorial.isVisible()) await tutorial.click();
    await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
    release();
    await expect(page.getByRole('heading', { name: '还没有作品', exact: true })).toBeVisible();
    expect(downloads).toBe(0);
    await expect(page.getByText('账户 A 的公式', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('account-isolation.png') });
  } finally {
    release();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

test('HTML 源保存丢响应按原键确认，随后源码保持且刷新可读', async ({ page }) => {
  const original = '<!doctype html><button onclick="document.querySelector(\'output\').textContent=1">计算</button><output>0</output>';
  await chooseFile(page, '导入网页', { name: 'HTML同键.html', mimeType: 'text/html', buffer: Buffer.from(original) });
  const work = await save(page);
  await page.getByRole('button', { name: '编辑源码', exact: true }).click();
  const field = page.getByLabel('网页源码', { exact: true });
  await field.fill(original.replace('textContent=1', 'textContent=2'));
  const requests = [];
  await page.route(`**/api/modules/math/v1/works/${work.id}`, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    const response = await route.fetch();
    if (requests.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认保存结果', exact: true })).toBeVisible();
  await field.fill(original.replace('textContent=1', 'textContent=3'));
  await page.getByRole('button', { name: '确认保存结果', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认保存结果', exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  await expect(field).toHaveValue(original.replace('textContent=1', 'textContent=3'));
  await save(page);
  await page.reload();
  await page.locator('.math-html .math-add').getByRole('button', { name: '运行预览', exact: true }).click();
  const inner = page.frameLocator('iframe[title="作品隔离预览"]').frameLocator('iframe');
  await inner.getByRole('button', { name: '计算', exact: true }).click();
  await expect(inner.locator('output')).toHaveText('3');
});

test('过大或非UTF8网页仍可保存和取回原字节，禁止编辑和运行', async ({ page }, info) => {
  for (const [name, buffer] of [['large.html', Buffer.alloc(1024 * 1024 + 1, 65)], ['encoding.html', Buffer.from([255, 254, 253])]]) {
    await chooseFile(page, '导入网页', { name, mimeType: 'application/octet-stream', buffer });
    await expect(page.getByText(/无法编辑或运行；可以取回原件/)).toBeVisible();
    const work = await save(page);
    expect(work.render.presentationFileId).toBeNull();
    await expect(page.getByRole('button', { name: '编辑源码', exact: true })).toBeDisabled();
    await expect(page.locator('.math-html .math-add').getByRole('button', { name: '运行预览', exact: true })).toBeDisabled();
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: '取回原文件', exact: true }).click();
    const target = info.outputPath(name);
    await (await event).saveAs(target);
    expect(fs.readFileSync(target)).toEqual(buffer);
    await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  }
});
