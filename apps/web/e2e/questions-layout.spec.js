import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';

let world;
let client;
let failed = false;
const base = '/api/modules/questions/v2';
const typeId = crypto.randomUUID();
const tagId = crypto.randomUUID();

test.beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-layout-'));
  world = await createIntegration({ directory, workbench: { filesDir: path.join(directory, 'files') } });
});
test.afterEach(async ({ page }, info) => {
  failed ||= info.status !== info.expectedStatus;
  if (info.status !== info.expectedStatus) await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true });
});
test.afterAll(async () => {
  await world?.close();
  if (world && !failed) fs.rmSync(world.directory, { recursive: true });
  else if (world) console.log('保留测试现场：' + world.directory);
});
test.beforeEach(async ({ page }) => {
  const email = `layout-${crypto.randomUUID()}@example.test`;
  client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const code = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const account = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '分类老师', password: 'Questions-layout-2026', challengeId: code.json.challengeId,
    verificationCode: world.mailer.lastCode('registration', email), termsAccepted: true, rememberMe: true,
  } });
  expect(account.status).toBe(201);
  await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: account.json.id, rememberMe: true } });
  const seeded = await client.request('PUT', base + '/taxonomy', { headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: { baseVersion: 1, types: [{ id: typeId, name: '证明题' }], tags: [{ id: tagId, name: '证明题' }] } });
  expect(seeded.status).toBe(200);
  await page.goto(world.origin);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('Questions-layout-2026');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
  await expect(page.getByRole('heading', { name: '把好题留下来，随时用起来' })).toBeVisible();
});

async function openManagement(page) {
  await page.getByRole('button', { name: '题库选项', exact: true }).click();
  await page.getByRole('menuitem', { name: '管理题型与标签', exact: true }).click();
  await expect(page.getByLabel('分类类别')).toBeVisible();
}
async function geometry(page) {
  return page.locator('.q-workspace').evaluate(workspace => {
    const first = workspace.querySelector(workspace.dataset.compare === 'true' ? '.q-copy-source' : '.q-finder').getBoundingClientRect();
    const divider = workspace.querySelector('.q-resize-divider').getBoundingClientRect();
    const main = workspace.querySelector('.q-main').getBoundingClientRect();
    return { first: { x: first.x, right: first.right, width: first.width }, divider: { x: divider.x, right: divider.right, width: divider.width }, main: { x: main.x }, width: workspace.clientWidth };
  });
}
async function expectBoundary(page) {
  await expect.poll(async () => {
    const box = await geometry(page);
    return Math.abs(box.first.right - box.divider.x) + Math.abs(box.divider.right - box.main.x);
  }).toBeLessThan(2);
}
async function snapshot(page, info, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => animation.effect.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: true });
}

test('分类辅助栏开关后分隔条沿真实列边界，点击、指针拖拽和键盘均可用', async ({ page }, info) => {
  await openManagement(page);
  await snapshot(page, info, 'management-open');
  const options = page.getByRole('button', { name: '题库选项', exact: true });
  const buttonBox = await options.boundingBox();
  await page.mouse.click(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  await expect(options).toHaveAttribute('aria-expanded', 'true');
  await expectBoundary(page);
  const openGeometry = await geometry(page);
  await expect(page.getByRole('menuitem', { name: '归档内容', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '筛选题目', exact: true }).click();
  await page.getByLabel('筛选题型').selectOption(typeId);
  await page.getByLabel('只看已标记').check();
  const divider = page.getByRole('separator', { name: '调整题目列表宽度', exact: true });
  await divider.focus();
  await divider.press('Home');
  await expectBoundary(page);
  const minimum = await geometry(page);
  await divider.press('ArrowRight');
  await expect.poll(async () => (await geometry(page)).first.width).toBeGreaterThan(minimum.first.width + 5);
  await divider.press('ArrowLeft');
  await expect.poll(async () => Math.abs((await geometry(page)).first.width - minimum.first.width)).toBeLessThan(2);
  await divider.press('End');
  await expectBoundary(page);
  expect((await geometry(page)).first.width).toBeGreaterThan(minimum.first.width + 100);
  let handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
  await page.mouse.down();
  await page.mouse.move(minimum.first.x - 50, handle.y + 40, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await geometry(page)).first.width - minimum.first.width)).toBeLessThan(2);
  handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
  await page.mouse.down();
  await page.mouse.move(minimum.first.x + minimum.width + 50, handle.y + 40, { steps: 10 });
  await page.mouse.up();
  await expectBoundary(page);
  expect(await divider.getAttribute('aria-valuenow')).toBe('70');
  const rightGeometry = await geometry(page);
  await divider.press('Home');
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).click();
  await expectBoundary(page);
  await page.reload();
  await expect(page.getByLabel('筛选题型')).toHaveValue(typeId);
  await expectBoundary(page);
  await openManagement(page);
  await expectBoundary(page);
  await snapshot(page, info, 'desktop-light');
  fs.writeFileSync(info.outputPath('divider-geometry.json'), JSON.stringify({ openGeometry, minimum, rightGeometry }, null, 2));
  await page.getByRole('button', { name: '支持', exact: true }).click();
  await page.getByRole('menuitem', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await openManagement(page);
  await snapshot(page, info, 'desktop-dark');
  for (const width of [1280, 1100, 740]) {
    await page.setViewportSize({ width, height: 900 });
    if (width <= 760) {
      await snapshot(page, info, 'dark-' + width + '-auxiliary');
      await page.getByRole('button', { name: '关闭辅助栏', exact: true }).click();
    }
    await page.getByRole('button', { name: '题库选项', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '管理题型与标签', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    if (width > 1200) await expectBoundary(page);
    else await expect(divider).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await snapshot(page, info, 'dark-' + width);
  }
});

test('原题对照使用同一网格边界，辅助栏和刷新保持可调宽度', async ({ page }, info) => {
  await page.locator('.q-finder').getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill('原题对照布局');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('求 $2+3$。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '原题对照布局', exact: true })).toBeVisible();
  await openManagement(page);
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  await expect(page.getByRole('region', { name: '原题对照', exact: true })).toBeVisible();
  await expectBoundary(page);
  const divider = page.getByRole('separator', { name: '调整原题对照宽度', exact: true });
  await divider.focus();
  await divider.press('Home');
  await expect(divider).toHaveAttribute('aria-valuenow', '25');
  await expectBoundary(page);
  const minimum = await geometry(page);
  expect(minimum.first.width).toBeLessThan(280);
  await divider.press('ArrowRight');
  await expect.poll(async () => (await geometry(page)).first.width).toBeGreaterThan(minimum.first.width + 5);
  await divider.press('End');
  await expect(divider).toHaveAttribute('aria-valuenow', '70');
  await expectBoundary(page);
  await divider.press('Home');
  await snapshot(page, info, 'compare-light-with-auxiliary');
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).click();
  await expectBoundary(page);
  await page.reload();
  await expect(page.getByRole('region', { name: '原题对照', exact: true })).toBeVisible();
  await expect(divider).toHaveAttribute('aria-valuenow', '25');
  await expectBoundary(page);
  for (const width of [1280, 1100, 740]) {
    await page.setViewportSize({ width, height: 900 });
    if (width > 1200) await expectBoundary(page);
    else await expect(divider).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await snapshot(page, info, 'compare-light-' + width);
  }
});

test('同名题型和标签分组可辨认，改名删除保存刷新只改变选定类别关联', async ({ page }, info) => {
  await page.locator('.q-finder').getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill('分类关联验证');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('证明 $a^2+b^2\\geq 2ab$。');
  await page.getByRole('button', { name: '题型、标签与笔记', exact: true }).click();
  await page.getByLabel('题型', { exact: true }).selectOption(typeId);
  await page.getByLabel('证明题', { exact: true }).check();
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '分类关联验证', exact: true })).toBeVisible();
  const original = (await client.request('GET', base + '/items')).json.items[0];
  await openManagement(page);
  await snapshot(page, info, 'same-name-categories');
  const types = page.getByRole('group', { name: '题型', exact: true });
  const tags = page.getByRole('group', { name: '标签', exact: true });
  await expect(types.getByRole('textbox', { name: '题型名称', exact: true })).toHaveValue('证明题');
  await expect(tags.getByRole('textbox', { name: '标签名称', exact: true })).toHaveValue('证明题');
  await page.getByLabel('分类类别').selectOption('tags');
  await page.getByLabel('新分类名称').fill('需复习');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await expect(tags.getByRole('textbox')).toHaveCount(2);
  await types.getByRole('textbox', { name: '题型名称', exact: true }).click();
  await types.getByRole('textbox', { name: '题型名称', exact: true }).fill('推理题');
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  await expect(types.getByRole('textbox')).toHaveValue('推理题');
  await expect(page.getByRole('button', { name: '保存分类', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: '分类关联验证', exact: true })).toBeVisible();
  let saved = (await client.request('GET', base + '/items/' + original.id)).json;
  expect(saved.typeId).toBe(typeId);
  expect(saved.tagIds).toEqual([tagId]);
  if (!(await page.getByLabel('分类类别').isVisible())) await openManagement(page);
  await tags.getByRole('textbox', { name: '标签名称', exact: true }).first().focus();
  await page.keyboard.press('Tab');
  await expect(tags.getByRole('button', { name: '删除标签“证明题”', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '删除标签', exact: true });
  await expect(dialog).toContainText('证明题');
  await expect(dialog).toContainText('1 道题');
  await snapshot(page, info, 'delete-tag-confirmation');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(tags.getByRole('textbox').first()).toHaveValue('证明题');
  await tags.getByRole('button', { name: '删除标签“证明题”', exact: true }).click();
  await dialog.getByRole('button', { name: '删除标签', exact: true }).click();
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  await expect(tags.getByRole('textbox')).toHaveValue('需复习');
  await expect(page.getByRole('button', { name: '保存分类', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: '分类关联验证', exact: true })).toBeVisible();
  saved = (await client.request('GET', base + '/items/' + original.id)).json;
  expect(saved.typeId).toBe(typeId);
  expect(saved.tagIds).toEqual([]);
  const taxonomy = (await client.request('GET', base + '/taxonomy')).json;
  expect(taxonomy.types).toEqual([{ id: typeId, name: '推理题' }]);
  expect(taxonomy.tags.map(category => category.name)).toEqual(['需复习']);
  await snapshot(page, info, 'categories-saved-refresh');
  fs.writeFileSync(info.outputPath('saved-associations.json'), JSON.stringify({ original, saved, taxonomy }, null, 2));
});
