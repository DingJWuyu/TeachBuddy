import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { emptyDynamicSource, newElement } from '../src/features/math/model.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';
import { importLegacy, openTool, addGraphic, selectObject, disclosure, saveLegacy as save, downloadLegacy as download } from './fixtures/math-workspace.js';

let world;
let directory;
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  directory = world.directory;
  await register(page, world, 'manual-math@example.test');
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^数学工坊/ }).click();
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (info.status === info.expectedStatus) fs.rmSync(directory, { recursive: true, force: true });
  else fs.writeFileSync(info.outputPath('fixture-directory.txt'), directory);
});
async function start(page, kind = 'dynamic') {
  await importLegacy(page, kind);
  if (kind === 'plane') {
    await openTool(page, 'objects');
    while (await page.getByLabel('图形列表').getByRole('button').count()) {
      await page.getByLabel('图形列表').getByRole('button').first().click();
      await page.getByRole('button', { name: '移除对象', exact: true }).click();
    }
  }
}
async function label(page, text) {
  await disclosure(page, '图上标注');
  await page.getByLabel('label-text', { exact: true }).fill(text);
}
async function transparent(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(data.some((value, index) => index % 4 === 3 && value === 0)).toBe(true);
  return info;
}

test('旧动态源添加参数后可保存重开', async ({ page }) => {
  await start(page);
  await openTool(page, 'parameters');
  await page.getByRole('button', { name: '添加参数', exact: true }).click();
  const saved = await save(page);
  expect(saved.source.parameters).toHaveLength(4);
  await page.reload();
  await openTool(page, 'parameters');
  await expect(page.locator('.math-parameter-group')).toHaveCount(4);
});

test('旧动态源参数改名范围、步骤说明、对象增删与真实离线展示', async ({ page, browser }, info) => {
  await start(page);
  await page.getByLabel('作品名称').fill('手动正弦探究');
  await openTool(page, 'parameters');
  for (const [key, value] of Object.entries({ name: 'b', min: '-1', max: '1', step: '0.25' })) await page.getByLabel(`parameter-0-${key}`, { exact: true }).fill(value);
  await page.reload();
  await openTool(page, 'parameters');
  await expect(page.getByLabel('parameter-0-name', { exact: true })).toHaveValue('b');
  await page.getByRole('button', { name: '应用参数 1', exact: true }).click();
  await selectObject(page, 'f');
  await page.getByLabel('expression', { exact: true }).fill('b*sin(x-h)+k');
  await label(page, 'y={b}sin(x-{h})+{k}');
  await addGraphic(page, '添加文字');
  await page.getByLabel('text', { exact: true }).fill('观察振幅随参数变化');
  await page.getByLabel('at-y', { exact: true }).fill('3');
  await openTool(page, 'steps');
  await page.getByLabel('步骤 1 说明').fill('先观察振幅。\n再比较平移前后的图像。');
  await disclosure(page, '2 · 平移后曲线');
  await page.getByLabel('步骤 2 标题').fill('向右平移');
  const first = await save(page);
  expect(first.render.state).toBe('ready');
  expect(first.source.scene.elements[0].expression).toBe('b*sin(x-h)+k');
  expect(first.source.steps[2].values[0]).toEqual({ name: 'b', value: -1 });
  expect(first.source.steps.every(step => step.visibleIds.includes('T1'))).toBe(true);
  await selectObject(page, 'P');
  await page.getByLabel('id', { exact: true }).fill('Q');
  expect((await save(page)).source.drags[0].pointId).toBe('Q');
  await page.getByRole('button', { name: '移除对象', exact: true }).click();
  const removed = await save(page);
  expect(removed.source.drags).toEqual([]);
  expect(removed.source.steps.every(step => !step.visibleIds.includes('Q'))).toBe(true);
  await page.reload();
  await openTool(page, 'steps');
  await expect(page.getByLabel('步骤 1 说明')).toHaveValue('先观察振幅。\n再比较平移前后的图像。');
  const file = await download(page, 'html', info.outputPath('dynamic.html'));
  await world.close(); world = null;
  const offline = await browser.newContext({ offline: true });
  try {
    const display = await offline.newPage();
    await display.goto(pathToFileURL(file).href);
    const frame = display.frameLocator('iframe');
    await expect(frame.locator('.step-description')).toContainText('先观察振幅');
    await frame.getByRole('button', { name: '向右平移', exact: true }).click();
    await expect(frame.getByLabel('h 数值')).toHaveValue('1');
    await frame.getByLabel('b 数值').fill('0.5');
    await expect(frame.locator('svg')).toContainText('y=0.5sin');
  } finally { await offline.close(); }
});

test('旧平面源函数、圆、线段、多边形与标注保存并导出透明图片', async ({ page }, info) => {
  await start(page, 'plane');
  await page.getByLabel('作品名称').fill('三角函数与单位圆');
  await page.getByRole('button', { name: '添加函数', exact: true }).click();
  await page.getByLabel('expression', { exact: true }).fill('2*sin(x)+1');
  await label(page, '振幅为二');
  await addGraphic(page, '添加圆 / 椭圆');
  await page.getByLabel('rx', { exact: true }).fill('1');
  await page.getByLabel('ry', { exact: true }).fill('1');
  await addGraphic(page, '添加线段');
  await page.getByLabel('to-x', { exact: true }).fill('3');
  await page.getByLabel('arrow', { exact: true }).selectOption('end');
  await addGraphic(page, '添加多边形');
  await page.getByRole('button', { name: '添加顶点', exact: true }).click();
  await page.getByLabel('points-3-x', { exact: true }).fill('-2');
  await addGraphic(page, '添加文字');
  await page.getByLabel('text', { exact: true }).fill('单位圆与正弦函数');
  await page.getByLabel('at-y', { exact: true }).fill('4');
  expect((await save(page)).render.state).toBe('ready');
  await page.reload();
  const svg = await download(page, 'svg', info.outputPath('plane.svg'));
  expect(fs.readFileSync(svg, 'utf8')).toContain('单位圆与正弦函数');
  expect((await transparent(await download(page, 'png', info.outputPath('plane.png')))).width).toBe(1600);
});

test('旧空间源自定义顶点与棱、改名删点、投影保存重开', async ({ page }, info) => {
  await start(page, 'space');
  await selectObject(page, 'A');
  await page.getByLabel('id', { exact: true }).fill('O');
  await label(page, '原点 O');
  await selectObject(page, 'D1');
  await page.getByRole('button', { name: '移除对象', exact: true }).click();
  await addGraphic(page, '添加点');
  await page.getByLabel('z', { exact: true }).fill('4');
  const addedPoint = await page.getByLabel('id', { exact: true }).inputValue();
  await addGraphic(page, '添加棱');
  await page.getByLabel('棱终点', { exact: true }).selectOption(addedPoint);
  await disclosure(page, '颜色与样式');
  await page.getByLabel('style-dash', { exact: true }).selectOption('dashed');
  await openTool(page, 'canvas');
  await page.getByLabel('azimuth', { exact: true }).fill('45');
  await page.getByLabel('elevation', { exact: true }).fill('30');
  const saved = await save(page);
  expect(saved.render.state).toBe('ready');
  expect(saved.source.edges.every(edge => !['A', 'D1'].includes(edge.from) && !['A', 'D1'].includes(edge.to))).toBe(true);
  await page.reload();
  await openTool(page, 'canvas');
  await expect(page.getByLabel('azimuth', { exact: true })).toHaveValue('45');
  await download(page, 'svg', info.outputPath('space.svg'));
  await download(page, 'png', info.outputPath('space.png'));
});

test('HTML 从当前菜单导入、源码修改、保存重开及真实离线交互', async ({ page, browser }, info) => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('complementary', { name: '数学工坊导航', exact: true }).getByRole('button', { name: /^导入网页/ }).click();
  await (await chooser).setFiles({ name: '外部演示.html', mimeType: 'text/html', buffer: Buffer.from('<!doctype html><meta charset="utf-8"><h1>三角形面积</h1><button onclick="document.querySelector(\'output\').textContent=6">计算</button><output>0</output>') });
  await expect(page.getByLabel('作品名称')).toHaveValue('外部演示.html');
  await save(page);
  await page.getByRole('button', { name: '编辑源码', exact: true }).click();
  const editor = page.getByLabel('网页源码', { exact: true });
  await editor.fill((await editor.inputValue()).replace('三角形面积', '底为四、高为三').replace('textContent=6', 'textContent=12'));
  await save(page);
  await page.reload();
  await page.locator('.math-html .math-add').getByRole('button', { name: '运行预览', exact: true }).click();
  const preview = page.frameLocator('iframe[title="作品隔离预览"]').frameLocator('iframe');
  await expect(preview.locator('h1')).toHaveText('底为四、高为三');
  await preview.getByRole('button', { name: '计算' }).click();
  await expect(preview.locator('output')).toHaveText('12');
  const file = await download(page, 'html', info.outputPath('external.html'));
  await world.close(); world = null;
  const offline = await browser.newContext({ offline: true });
  try {
    const display = await offline.newPage();
    await display.goto(pathToFileURL(file).href);
    const frame = display.frameLocator('iframe');
    await frame.getByRole('button', { name: '计算' }).click();
    await expect(frame.locator('output')).toHaveText('12');
  } finally { await offline.close(); }
});

test('旧公式源中文说明、透明导出与服务重启', async ({ page, browser }, info) => {
  await start(page, 'formula');
  await page.getByLabel('作品名称').fill('判别式与根');
  await page.getByLabel('LaTeX', { exact: true }).fill('x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
  await disclosure(page, '说明与样式');
  await page.getByLabel('中文说明').fill('判别式大于零时，方程有两个不同的实根。');
  const saved = await save(page);
  expect(saved.render.state).toBe('ready');
  await transparent(await download(page, 'png', info.outputPath('formula.png')));
  await download(page, 'svg', info.outputPath('formula.svg'));
  const directory = world.directory;
  const storageState = await page.context().storageState();
  await world.close();
  world = await createIntegration({ directory });
  const context = await browser.newContext({ storageState, ignoreHTTPSErrors: true });
  try {
    const reopened = await context.newPage();
    await reopened.goto(world.origin + `/math?workId=${saved.id}`);
    await reopened.getByRole('button', { name: '知道了', exact: true }).click();
    await expect(reopened.getByLabel('中文说明')).toHaveValue('判别式大于零时，方程有两个不同的实根。');
    await reopened.getByLabel('中文说明').fill('再次修改并保存的中文说明');
    expect((await save(reopened)).version).toBe(saved.version + 1);
  } finally { await context.close(); }
});

test('旧动态源对象标识冲突保留原点与拖动绑定', async ({ page }) => {
  await start(page);
  await selectObject(page, 'P');
  await page.getByLabel('id', { exact: true }).fill('f');
  await expect(page.getByRole('alert')).toContainText('对象标识已存在');
  await expect(page.getByLabel('id', { exact: true })).toHaveValue('P');
  const saved = await save(page);
  expect(saved.source.drags[0].pointId).toBe('P');
  expect(saved.render.state).toBe('ready');
});


test('旧动态源拖动绑定、步骤开场及移除全部参数后保存重开', async ({ page }) => {
  const source = emptyDynamicSource();
  source.scene.elements = [newElement('point', 'P1')];
  await importLegacy(page, 'dynamic', '动点旧作品', source);
  await selectObject(page, 'P1');
  await page.getByLabel('at-y', { exact: true }).fill('2');
  await label(page, '横坐标 {t}');
  await openTool(page, 'parameters');
  await page.locator('summary').filter({ hasText: /^拖动图上的点$/ }).click();
  await page.getByRole('button', { name: '添加拖动', exact: true }).click();
  await openTool(page, 'objects');
  await expect(page.getByLabel('at-x', { exact: true })).toHaveValue('t');
  await openTool(page, 'steps');
  await page.getByRole('button', { name: '添加步骤', exact: true }).click();
  await page.getByLabel('步骤 1 标题').fill('起点');
  await page.getByLabel('步骤 1 说明').fill('拖动蓝点观察横坐标');
  await page.getByRole('button', { name: '添加步骤', exact: true }).click();
  await page.getByLabel('步骤 2 t', { exact: true }).fill('3');
  expect((await save(page)).render.state).toBe('ready');
  await page.locator('.math-dynamic').getByRole('button', { name: '步骤 2', exact: true }).click();
  await expect(page.getByLabel('t 数值', { exact: true })).toHaveValue('3');
  await page.getByLabel('t 数值', { exact: true }).fill('4');
  await expect(page.locator('.math-dynamic svg')).toContainText('横坐标 4');
  const box = await page.locator('.math-dynamic [data-object="P1"] circle').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByLabel('t 数值', { exact: true })).not.toHaveValue('4');
  await page.getByRole('button', { name: '设为开场画面', exact: true }).click();
  let saved = await save(page);
  expect(saved.source.initialStepId).toBe(saved.source.steps[1].id);
  await openTool(page, 'parameters');
  await page.getByRole('button', { name: '移除参数 t', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '继续', exact: true }).click();
  saved = await save(page);
  expect(saved.source.parameters).toEqual([]);
  expect(saved.source.drags).toEqual([]);
  await openTool(page, 'steps');
  await page.getByRole('button', { name: '移除步骤 2', exact: true }).click();
  await disclosure(page, '1 · 起点');
  await page.getByRole('button', { name: '移除步骤 1', exact: true }).click();
  expect((await save(page)).source.initialStepId).toBeNull();
  await page.reload();
  await openTool(page, 'objects');
  await expect(page.getByLabel('图形列表').getByRole('button')).toHaveCount(1);
});
