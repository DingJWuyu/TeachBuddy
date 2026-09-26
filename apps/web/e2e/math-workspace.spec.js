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
  await save(page);
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
