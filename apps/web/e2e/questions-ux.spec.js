import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';

let world;
let client;
let failed = false;
test.beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-ux-e2e-'));
  world = await createIntegration({ directory, workbench: { filesDir: path.join(directory, 'files') } });
});
test.afterEach(async ({}, info) => { failed ||= info.status !== info.expectedStatus; });
test.afterAll(async () => {
  await world?.close();
  if (world && !failed) fs.rmSync(world.directory, { recursive: true });
  else if (world) console.log('保留测试现场：' + world.directory);
});
test.beforeEach(async ({ page }) => {
  const email = `questions-${crypto.randomUUID()}@example.test`;
  client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const code = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const account = await client.request('POST', '/api/auth/register', { body: { email, nickname: '题库老师', password: 'Questions-ux-2026',
    challengeId: code.json.challengeId, verificationCode: world.mailer.lastCode('registration', email), termsAccepted: true, rememberMe: true } });
  expect(account.status).toBe(201);
  await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: account.json.id, rememberMe: true } });
  await page.goto(world.origin);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('Questions-ux-2026');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
  await expect(page.getByRole('heading', { name: '把好题留下来，随时用起来' })).toBeVisible();
});

const finder = page => page.locator('.q-finder');
async function createQuestion(page, title = '平方根练习') {
  await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill(title);
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).pressSequentially('已知 $x^2=9$，求实数 $x$ 的值。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}
async function records() {
  const response = await client.request('GET', '/api/modules/questions/v2/items');
  expect(response.status).toBe(200);
  return response.json.items;
}

test('空稿退出、输入即录题、保存后阅读与刷新，已有题目的草稿独立保留', async ({ page }) => {
  await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续未完成的题目' })).toHaveCount(0);
  await createQuestion(page);
  const [original] = await records();
  await expect(page.locator('.q-reading-body .katex').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '保存题目', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('已知 $x^2=16$，求实数 $x$ 的值。');
  await page.getByRole('button', { name: '返回题目', exact: true }).click();
  await expect(page.locator('.q-draft-notice')).toContainText('未保存');
  expect((await records())[0].body).toEqual(original.body);
  await page.reload();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('已知 $x^2=16$，求实数 $x$ 的值。');
  await page.getByRole('button', { name: '添加答案与解析', exact: true }).click();
  await page.getByRole('textbox', { name: '答案与解析段落 1', exact: true }).fill('$x=\\pm4$');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '答案与解析', exact: true }).click();
  await expect(page.locator('.q-answer .katex')).toBeVisible();
  const [saved] = await records();
  expect(saved.id).toBe(original.id);
  expect(saved.answerStatus).toBe('present');
  expect(saved.version).toBeGreaterThan(original.version);
});

test('新题草稿刷新继续，复制改编保存前不创建服务器题目', async ({ page }) => {
  await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill('可继续的草稿');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('求 $2+3$。');
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '继续未完成的题目' }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('求 $2+3$。');
  expect(await records()).toHaveLength(0);
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '可继续的草稿', exact: true })).toBeVisible();
  const [original] = await records();
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  await expect(page.getByRole('region', { name: '原题对照' })).toBeVisible();
  expect(await records()).toHaveLength(1);
  await page.getByLabel('题目标题').fill('改编练习');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('求 $2+5$。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '改编练习', exact: true })).toBeVisible();
  const items = await records();
  expect(items).toHaveLength(2);
  expect(items.find(q => q.id === original.id).body).toEqual(original.body);
  const copy = items.find(q => q.id !== original.id);
  expect(copy.source.questionId).toBe(original.id);
  expect(copy.source.snapshot.body).toEqual(original.body);
});

test('筛选与题目分类分开，就地创建后保存，归档确认与恢复', async ({ page }) => {
  await createQuestion(page);
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await page.getByRole('button', { name: '题型、标签与笔记', exact: true }).click();
  await page.getByRole('button', { name: '新建题型', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建题型' });
  await dialog.getByLabel('分类名称').fill('计算题');
  await dialog.getByRole('button', { name: '创建并选用' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('题型', { exact: true })).toHaveValue(/.+/);
  await page.getByLabel('长期笔记').fill('提醒学生考虑两个根');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.locator('.q-question-meta')).toContainText('计算题');
  const original = (await records())[0];
  await page.getByRole('button', { name: '筛选题目', exact: true }).click();
  await page.getByLabel('筛选题型').selectOption({ label: '计算题' });
  await expect(page.locator('.q-list-entry')).toHaveCount(1);
  await page.getByRole('textbox', { name: '搜索题目' }).fill('没有这个题目');
  await expect(page.getByText('没有符合条件的题目，试试调整筛选。')).toBeVisible();
  expect((await records())[0].typeId).toBe(original.typeId);
  await page.getByRole('button', { name: '清除条件' }).click();
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '归档题目', exact: true }).click();
  await page.getByRole('dialog', { name: '归档题目？' }).getByRole('button', { name: '取消' }).click();
  expect(await records()).toHaveLength(1);
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '归档题目', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await expect(page.locator('.q-message')).toContainText('已归档');
  expect(await records()).toHaveLength(0);
  await page.getByRole('button', { name: '题库选项' }).click();
  await page.getByRole('menuitem', { name: '归档内容', exact: true }).click();
  await page.locator('.q-list-entry button').click();
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '恢复题目', exact: true }).click();
  await page.getByRole('dialog', { name: '恢复题目？' }).getByRole('button', { name: '确认恢复', exact: true }).click();
  await expect(page.locator('.q-message')).toContainText('已恢复');
  expect((await records())[0].id).toBe(original.id);
});

test('文字收录先读题再检查，疑点可定位，确认后继续下一题并刷新', async ({ page }) => {
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  const capture = page.getByRole('dialog', { name: '从资料收录题目' });
  await capture.getByRole('button', { name: /粘贴文字/ }).click();
  await capture.getByLabel('原始文字').fill('1. 计算 1+1。\n答案：2\n2. 解方程 x+3=5。\n答案：x=2');
  await capture.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByRole('button', { name: '1 待检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试未完成部分', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.locator('.q-review-checks select').first()).toBeFocused();
  await page.getByLabel('题干是否完整，是否混入了其他题目？').selectOption('acknowledged');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByRole('button', { name: '1 已入库', exact: true })).toBeVisible();
  expect(await records()).toHaveLength(1);
  await page.getByRole('button', { name: '检查下一题' }).click();
  await page.getByRole('button', { name: '修改题目', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('解方程 $x+3=5$。');
  await page.getByRole('button', { name: '完成修改', exact: true }).click();
  await page.getByLabel('题干是否完整，是否混入了其他题目？').selectOption('acknowledged');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 已入库', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('2 题已入库')).toBeVisible();
  expect(await records()).toHaveLength(2);
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await expect(page.locator('.q-list-entry')).toHaveCount(2);
});

test('深浅色与窄屏保持可达布局，收录浮层关闭恢复焦点', async ({ page }) => {
  await createQuestion(page);
  for (const colorScheme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('link', { name: '账户：题库老师' }).click();
    await page.getByRole('button', { name: colorScheme === 'light' ? '浅色' : '深色', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', colorScheme);
    await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
    for (const width of [1440, 1024, 600]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: '编辑题目', exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      const main = await page.locator('.q-main').boundingBox();
      const side = await page.locator('.q-finder').boundingBox();
      if (width > 760) { expect(Math.abs(main.y - side.y)).toBeLessThan(1); expect(Math.abs(main.height - side.height)).toBeLessThan(1); }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    window.questionMotion = { frames: [], done: false };
    function sample(time) {
      const state = window.questionMotion;
      const node = document.querySelector('.q-finder .wb-module-presence.is-collapse');
      if (node) state.frames.push({ time, state: node.dataset.state, opacity: Number(getComputedStyle(node).opacity) });
      if (!state.done) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const filter = finder(page).getByRole('button', { name: '筛选题目', exact: true });
  await filter.click();
  await expect.poll(() => page.evaluate(() => window.questionMotion.frames.some(f => f.state === 'open' && f.opacity > 0 && f.opacity < 1))).toBe(true);
  await filter.click();
  await expect.poll(() => page.evaluate(() => window.questionMotion.frames.some(f => f.state === 'closed' && f.opacity > 0 && f.opacity < 1)), { intervals: [16] }).toBe(true);
  await filter.click();
  await expect(filter).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.evaluate(() => {
    const frames = window.questionMotion.frames;
    const lastClosing = frames.findLastIndex(f => f.state === 'closed' && f.opacity > 0);
    return lastClosing >= 0 && frames.slice(lastClosing + 1).some(f => f.state === 'open' && f.opacity === 1);
  })).toBe(true);
  await page.evaluate(() => { window.questionMotion.done = true; });
  const trigger = finder(page).getByRole('button', { name: '从资料收录', exact: true });
  await trigger.click();
  const capture = page.getByRole('dialog', { name: '从资料收录题目' });
  await expect(capture).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(capture).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await capture.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(capture).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('公式、选项与表格可插入和修改，保存重开保留结构', async ({ page }) => {
  await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill('结构化题面');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('选择正确答案。');
  await page.getByRole('button', { name: '插入公式', exact: true }).click();
  const formula = page.getByRole('textbox', { name: '题干 公式 1源', exact: true });
  await formula.click();
  await formula.pressSequentially('x^2+1');
  await expect(formula).toHaveValue('x^2+1');
  await page.getByRole('button', { name: '插入更多内容', exact: true }).click();
  await page.getByRole('menuitem', { name: '添加选项或列表', exact: true }).click();
  await page.getByLabel('题干 列表 1用途', { exact: true }).selectOption('options');
  await page.getByLabel('题干 列表 1项目 1标号', { exact: true }).fill('A');
  await page.getByLabel('题干 列表 1项目 1 段落 1', { exact: true }).fill('结果是 1');
  await page.getByRole('button', { name: '插入更多内容', exact: true }).click();
  await page.getByRole('menuitem', { name: '添加表格', exact: true }).click();
  await page.locator('.material-table-scroll td').first().getByRole('button', { name: '段落', exact: true }).click();
  await page.getByLabel('题干 表格 1第 1 行第 1 列 段落 1', { exact: true }).fill('表格内容');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '结构化题面', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.q-reading-body .katex')).toBeVisible();
  await expect(page.locator('.q-reading-body table')).toContainText('表格内容');
  const [saved] = await records();
  expect(saved.body.blocks.map(block => block.type)).toEqual(['paragraph', 'math', 'list', 'table']);
  expect(saved.body.blocks[1].latex).toBe('x^2+1');
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await expect(formula).toHaveValue('x^2+1');
  await expect(page.getByLabel('题干 列表 1项目 1 段落 1', { exact: true })).toHaveValue('结果是 1');
});

test('新题保存响应丢失后确认原请求，保留后续输入且不重复建题', async ({ page }) => {
  await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill('断线后续写');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('第一次保存的题干');
  await page.route('**/api/modules/questions/v2/items', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch();
    await route.abort('failed');
  }, { times: 1 });
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  const confirm = page.getByRole('button', { name: '确认上次请求', exact: true });
  await expect(confirm).toBeVisible();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('断线后继续补充的题干');
  await confirm.click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('断线后继续补充的题干');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '断线后续写', exact: true })).toBeVisible();
  const items = await records();
  expect(items).toHaveLength(1);
  expect(items[0].body.blocks[0].runs[0].text).toBe('断线后继续补充的题干');
});

test('图片原稿预览读取失败后可恢复，原图仍能对照', async ({ page }) => {
  let interruptPreview = true;
  await page.route('**/api/workbench/files/*/preview', route => interruptPreview && route.request().method() === 'GET' ? route.abort('failed') : route.continue());
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传图片 截图/ }).click();
  await page.getByLabel('选择原稿').setInputFiles({ name: '原稿.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 320, height: 200, channels: 3, background: '#fff' } }).png().toBuffer() });
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  const original = page.getByRole('region', { name: '原始材料' });
  await expect(original).toContainText('原稿预览暂不可用');
  interruptPreview = false;
  await original.getByRole('button', { name: '重新生成预览', exact: true }).click();
  await expect(original.locator('.q-page img')).toBeVisible();
  await expect.poll(() => original.locator('.q-page img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(original.getByRole('combobox', { name: '原稿页码' })).toHaveCount(0);
  await expect(original.getByText('第 1 页', { exact: true })).toBeVisible();
});

test('阅读已保存题目时生成图片，不覆盖另存的编辑草稿', async ({ page }) => {
  await createQuestion(page);
  const original = (await records())[0];
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('尚未保存的新题干');
  await page.getByRole('button', { name: '返回题目', exact: true }).click();
  await page.getByRole('button', { name: '复制文字或下载图片', exact: true }).click();
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/assets') && response.request().method() === 'POST'),
    page.getByRole('button', { name: '生成题面图片', exact: true }).click(),
  ]);
  await expect(page.locator('.q-draft-notice')).toBeVisible();
  expect((await records())[0].version).toBe(original.version);
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('尚未保存的新题干');
});

test('移出材料后回到题库首页，刷新不会重新打开已移出的材料', async ({ page }) => {
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /粘贴文字/ }).click();
  await page.getByLabel('原始文字').fill('1. 计算 2+3。\n答案：5');
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button', { name: '归档材料', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await expect(page.getByRole('region', { name: '原始材料' })).toBeHidden();
  await expect(page.getByRole('heading', { name: '把好题留下来，随时用起来' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '把好题留下来，随时用起来' })).toBeVisible();
  await page.getByRole('button', { name: '题库选项' }).click();
  await page.getByRole('menuitem', { name: '归档内容', exact: true }).click();
  await page.locator('.q-imports button').click();
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button', { name: '恢复材料', exact: true }).click();
  await page.getByRole('button', { name: '确认恢复', exact: true }).click();
  await expect(page.getByRole('heading', { name: '暂无归档内容' })).toBeVisible();
  await finder(page).getByRole('button', { name: '返回题库', exact: true }).click();
  await page.locator('.q-imports button').click();
  const materials = await client.request('GET', '/api/modules/questions/v2/imports');
  const materialId = materials.json.items[0].id;
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button', { name: '归档材料', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await page.getByRole('button', { name: '题库选项' }).click();
  await page.getByRole('menuitem', { name: '归档内容', exact: true }).click();
  await page.locator('.q-imports button').click();
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button', { name: '彻底删除材料', exact: true }).click();
  await page.getByRole('dialog', { name: '彻底删除材料？' }).getByRole('button', { name: '取消', exact: true }).click();
  expect((await client.request('GET', '/api/modules/questions/v2/imports/' + materialId)).status).toBe(200);
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button', { name: '彻底删除材料', exact: true }).click();
  await page.getByRole('dialog', { name: '彻底删除材料？' }).getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(page.getByRole('heading', { name: '暂无归档内容' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '暂无归档内容' })).toBeVisible();
  expect((await client.request('GET', '/api/modules/questions/v2/imports/' + materialId)).status).toBe(404);
});

test('从题目直达链接归档后清除详情路由，彻底删除响应丢失可确认原请求', async ({ page }) => {
  await createQuestion(page, '归档与彻底删除');
  const original = (await records())[0];
  await page.goto(world.origin + '/questions/' + original.id);
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '归档题目', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await expect(page).toHaveURL(world.origin + '/questions');
  await page.reload();
  await expect(page.getByRole('heading', { name: '把好题留下来，随时用起来' })).toBeVisible();
  await page.getByRole('button', { name: '题库选项' }).click();
  await page.getByRole('menuitem', { name: '归档内容', exact: true }).click();
  await page.locator('.q-list-entry button').click();
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '彻底删除题目', exact: true }).click();
  await page.route('**/items/' + original.id + '/purge', async route => { await route.fetch(); await route.abort('failed'); }, { times: 1 });
  const dialog = page.getByRole('dialog', { name: '彻底删除题目？' });
  await dialog.getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(page.getByRole('heading', { name: '暂无归档内容' })).toBeVisible();
  await page.reload();
  expect((await client.request('GET', '/api/modules/questions/v2/items/' + original.id)).status).toBe(404);
  await expect(page.locator('.q-list-entry')).toHaveCount(0);
});

test('归档保留设备草稿，恢复后可以继续编辑并保存', async ({ page }) => {
  await createQuestion(page, '归档前的草稿');
  const original = (await records())[0];
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('尚未提交但要保留的题干');
  await page.getByRole('button', { name: '返回题目', exact: true }).click();
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '归档题目', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await page.getByRole('button', { name: '题库选项' }).click();
  await page.getByRole('menuitem', { name: '归档内容', exact: true }).click();
  await page.locator('.q-list-entry').click();
  await expect(page.locator('.q-draft-notice')).toContainText('恢复题目后可继续编辑');
  await expect(page.getByRole('button', { name: '继续编辑', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '恢复题目', exact: true }).click();
  await page.getByRole('button', { name: '确认恢复', exact: true }).click();
  await finder(page).getByRole('button', { name: '返回题库', exact: true }).click();
  await page.locator('.q-list-entry').click();
  await page.reload();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('尚未提交但要保留的题干');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '归档前的草稿', exact: true })).toBeVisible();
  const [saved] = await records();
  expect(saved.id).toBe(original.id);
  expect(saved.body.blocks[0].runs[0].text).toBe('尚未提交但要保留的题干');
});

test('题库辅助栏和主面板上下对齐，搜索焦点框包住整个输入区域', async ({ page }) => {
  await page.getByRole('button', { name: '题库选项', exact: true }).click();
  await page.getByRole('menuitem', { name: '管理题型与标签', exact: true }).click();
  const main = page.locator('.q-main');
  const aux = page.getByRole('complementary', { name: '辅助栏' });
  await expect(aux).toBeVisible();
  await expect.poll(async () => {
    const a = await main.boundingBox(), b = await aux.boundingBox();
    return Math.max(Math.abs(a.y - b.y), Math.abs(a.y + a.height - b.y - b.height));
  }).toBeLessThan(1);
  await page.getByRole('textbox', { name: '搜索题目', exact: true }).click();
  const focus = await page.locator('.q-search').evaluate(node => {
    const field = node.querySelector('input');
    return { ring: getComputedStyle(node).boxShadow, inputOutline: getComputedStyle(field).outlineStyle, inputShadow: getComputedStyle(field).boxShadow };
  });
  expect(focus.ring).not.toBe('none');
  expect(focus.inputOutline).toBe('none');
  expect(focus.inputShadow).toBe('none');
});

async function collectText(page, text) {
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /粘贴文字/ }).click();
  await page.getByLabel('原始文字').fill(text);
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
}

test('功能：无题号的单题可以校对入库，保留题干、答案和原稿', async ({ page }) => {
  const text = '求实数 x 的值。\n答案：x 等于三。';
  await collectText(page, text);
  await expect(page.getByRole('button', { name: '确认这道题', exact: true })).toBeVisible();
  await expect(page.locator('.q-review-answer')).toContainText('x 等于三');
  await page.getByLabel('题干是否完整，是否混入了其他题目？').selectOption('acknowledged');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: '原始材料' })).toContainText(text);
  const [question] = await records();
  expect(question.body.blocks[0].runs[0].text).toContain('求实数');
  expect(question.solution.blocks[0].runs[0].text).toContain('三');
});

test('功能：答案题号的全半角和标点差异不影响匹配', async ({ page }) => {
  await collectText(page, '1. 求三加五的结果。\n参考答案\n１、八');
  await expect(page.locator('.q-review-answer')).toContainText('八');
  await expect(page.getByText('原稿中未提供答案', { exact: true })).toHaveCount(0);
  await page.getByLabel('题干是否完整，是否混入了其他题目？').selectOption('acknowledged');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  const [question] = await records();
  expect(question.answerStatus).toBe('present');
  expect(question.solution.blocks[0].runs[0].text).toBe('八');
});

test('功能：教师活动分隔的无题号题目分别保留题干和答案', async ({ page }) => {
  await collectText(page, '求三加五的和。\n答案：八\n教师活动：讨论不同解法。\n求九减二的差。\n答案：七');
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toBeVisible();
  await expect(page.locator('.q-review-answer')).toContainText('八');
  await page.getByRole('button', { name: '2 待检查', exact: true }).click();
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('求九减二的差');
  await expect(page.locator('.q-review-answer')).toContainText('七');
  await expect(page.getByRole('article', { name: '待检查题干' })).not.toContainText('教师活动');
});

test('功能：原始材料彻底删除后保留题目，来源入口说明原因且不跳到失效详情', async ({ page }) => {
  await collectText(page, '1. 求三加五的结果。\n答案：八');
  await page.getByLabel('题干是否完整，是否混入了其他题目？').selectOption('acknowledged');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button', { name: '归档材料', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await page.getByRole('button', { name: '题库选项' }).click();
  await page.getByRole('menuitem', { name: '归档内容', exact: true }).click();
  await page.locator('.q-imports button').click();
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button', { name: '彻底删除材料', exact: true }).click();
  await page.getByRole('dialog', { name: '彻底删除材料？' }).getByRole('button', { name: '彻底删除', exact: true }).click();
  await finder(page).getByRole('button', { name: '返回题库', exact: true }).click();
  await page.locator('.q-list-entry').click();
  await expect(page.locator('.q-reading-body')).toContainText('求三加五');
  await expect(page.getByText('原始材料已彻底删除，题目内容仍保留。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '对照原稿', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.q-reading-body')).toContainText('求三加五');
});

test('功能：搜索答案由用户选择，刷新保留选择，清除条件恢复默认范围', async ({ page }) => {
  await createQuestion(page, '检索范围练习');
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await page.getByRole('button', { name: '添加答案与解析', exact: true }).click();
  await page.getByRole('textbox', { name: '答案与解析段落 1', exact: true }).fill('仅答案包含蓝莓。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索题目', exact: true }).fill('蓝莓');
  await expect(page.locator('.q-list-entry')).toHaveCount(0);
  await page.getByRole('button', { name: '筛选题目', exact: true }).click();
  await page.getByRole('checkbox', { name: '同时搜索答案与解析', exact: true }).check();
  await expect(page.locator('.q-list-entry')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '同时搜索答案与解析', exact: true })).toBeChecked();
  await expect(page.locator('.q-list-entry')).toHaveCount(1);
  await page.getByRole('button', { name: '清除条件', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '同时搜索答案与解析', exact: true })).not.toBeChecked();
  await expect(page.getByRole('textbox', { name: '搜索题目', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: '搜索题目', exact: true }).fill('练习');
  await expect(page.locator('.q-list-entry')).toHaveCount(1);
});

test('功能：同一段中的两题可按换行拆分，公式保留且答案重新核对', async ({ page }) => {
  await collectText(page, '1. 先求 x，再求 y。\n答案：第一问答案。第二问答案。');
  await page.getByRole('button', { name: '修改题目', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('先求 $x$。\n再求 $y$。');
  await page.getByRole('button', { name: '完成修改', exact: true }).click();
  await page.getByRole('button', { name: '调整题目：拆分、合并或忽略', exact: true }).click();
  await expect(page.getByRole('button', { name: '拆分', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '拆分', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toBeVisible();
  await expect(page.getByLabel('答案状态', { exact: true })).toHaveValue('unresolved');
  await expect(page.locator('.q-review-answer')).toContainText('第一问答案。第二问答案。');
  for (const [index, answer] of [[1, '第一问答案。'], [2, '第二问答案。']]) {
    if (index === 2) await page.getByRole('button', { name: '检查下一题', exact: true }).click();
    await expect(page.getByLabel('答案状态', { exact: true })).toHaveValue('unresolved');
    await page.getByRole('button', { name: '修改题目', exact: true }).click();
    await page.getByRole('textbox', { name: '答案与解析段落 1', exact: true }).fill(answer);
    await page.getByLabel('答案状态', { exact: true }).selectOption('present');
    await page.getByRole('button', { name: '完成修改', exact: true }).click();
    for (const control of await page.locator('.q-review-checks select').all()) await control.selectOption('corrected');
    await page.getByRole('button', { name: '确认这道题', exact: true }).click();
    await expect(page.getByRole('button', { name: `${index} 已入库`, exact: true })).toBeVisible();
  }
  await page.reload();
  const saved = await records();
  expect(saved).toHaveLength(2);
  expect(saved.flatMap(q => q.body.blocks.flatMap(b => b.runs ?? [])).filter(r => r.type === 'math').map(r => r.latex).sort()).toEqual(['x', 'y']);
  expect(saved.map(q => q.solution.blocks[0].runs[0].text).sort()).toEqual(['第一问答案。', '第二问答案。'].sort());
});

test('功能：来源读取失败不误报删除，原题删除后改编快照仍可对照', async ({ page }) => {
  await createQuestion(page, '可删除的原题');
  const original = (await records())[0];
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  await page.getByLabel('题目标题').fill('保留的改编题');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '保留的改编题', exact: true })).toBeVisible();
  const sourceUrl = `**/api/modules/questions/v2/items/${original.id}`;
  await page.route(sourceUrl, route => route.abort('failed'));
  await page.reload();
  await page.getByRole('button', { name: '查看原题', exact: true }).click();
  await expect(page.locator('.q-message')).toBeVisible();
  await expect(page.getByText('原题已彻底删除，可以继续查看采用时的原题。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '保留的改编题', exact: true })).toBeVisible();
  await page.unroute(sourceUrl);
  await page.getByRole('button', { name: '查看原题', exact: true }).click();
  await expect(page.getByRole('heading', { name: '可删除的原题', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '归档题目', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await page.getByRole('button', { name: '题库选项' }).click();
  await page.getByRole('menuitem', { name: '归档内容', exact: true }).click();
  await page.locator('.q-list-entry').click();
  await page.getByRole('button', { name: '更多题目操作' }).click();
  await page.getByRole('menuitem', { name: '彻底删除题目', exact: true }).click();
  await page.getByRole('dialog', { name: '彻底删除题目？' }).getByRole('button', { name: '彻底删除', exact: true }).click();
  await finder(page).getByRole('button', { name: '返回题库', exact: true }).click();
  await page.locator('.q-list-entry').click();
  await expect(page.getByText('原题已彻底删除，可以继续查看采用时的原题。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看原题', exact: true })).toHaveCount(0);
  await page.getByText('采用时的原题', { exact: true }).click();
  await expect(page.locator('.q-question details .katex')).toHaveCount(2);
  await expect(page.locator('.q-question details .katex').first()).toBeVisible();
  await page.getByRole('button', { name: '对照原题', exact: true }).click();
  await expect(page.locator('.q-workspace')).toHaveAttribute('data-compare', 'true');
});

test('功能：无答案草稿拆分再合并，保存和刷新保留题干与公式', async ({ page }) => {
  await collectText(page, '1. 先观察 $x$。\n再观察 $y$。');
  await page.getByRole('button', { name: '调整题目：拆分、合并或忽略', exact: true }).click();
  await page.getByRole('button', { name: '拆分', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toBeVisible();
  await page.getByLabel('合并目标', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: '合并', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '保存检查进度', exact: true }).click();
  await expect(page.locator('.q-message')).toContainText('校对已保存');
  await page.reload();
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('先观察');
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('再观察');
  for (const control of await page.locator('.q-review-checks select').all()) await control.selectOption('corrected');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  const [question] = await records();
  expect(question.answerStatus).toBe('absent');
  expect(question.body.blocks.flatMap(b => b.runs ?? []).filter(r => r.type === 'math').map(r => r.latex)).toEqual(['x', 'y']);
});

test('导入：Word 段内换行保留题目边界和各自答案', async ({ page }) => {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const doc = new Document({ sections: [{ children: [new Paragraph({ children: [
    new TextRun('1. 求三加五的和。'), new TextRun({ text: '答案：八', break: 1 }),
    new TextRun({ text: '2. 求九减二的差。', break: 1 }), new TextRun({ text: '答案：七', break: 1 }),
  ] })] }] });
  const file = path.join(world.directory, 'line-breaks.docx');
  fs.writeFileSync(file, await Packer.toBuffer(doc));
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传 Word/ }).click();
  await page.getByLabel('选择原稿').setInputFiles(file);
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toBeVisible();
  for (const [number, text, answer] of [[1, '求三加五的和', '八'], [2, '求九减二的差', '七']]) {
    await page.getByRole('button', { name: `${number} 待检查`, exact: true }).click();
    await expect(page.getByRole('article', { name: '待检查题干' })).toContainText(text);
    await expect(page.locator('.q-review-answer')).toHaveText(`答案与解析${answer}`);
    await page.getByLabel('题干是否完整，是否混入了其他题目？').selectOption('acknowledged');
    await page.getByRole('button', { name: '确认这道题', exact: true }).click();
    await expect(page.getByRole('button', { name: `${number} 已入库`, exact: true })).toBeVisible();
  }
  await page.reload();
  expect(await records()).toHaveLength(2);
});

test('导入：PDF 明示续题跨页合并，保留两页来源和后续独立题目', async ({ page, context }) => {
  const source = await context.newPage();
  const pdf = path.join(world.directory, 'continuation.pdf');
  try {
    await source.setContent(`<html lang="zh-CN"><head><style>@page{size:A4;margin:20mm}body{font:16px sans-serif}.next{break-before:page}p{line-height:1.8}</style></head><body><p>1. 阅读条件并回答问题。</p><p>（1）说明第一个条件。</p><section class="next"><p>续第1题</p><p>（2）说明第二个条件。</p><p>2. 求三加五的和。</p></section></body></html>`);
    await source.evaluate(() => document.fonts.ready);
    await source.pdf({ path: pdf, preferCSSPageSize: true });
  } finally { await source.close(); }
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传 PDF/ }).click();
  await page.getByLabel('选择原稿').setInputFiles(pdf);
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByText('整理完成，等待校对', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('第一个条件');
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('第二个条件');
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '3 待检查', exact: true })).toHaveCount(0);
  for (const control of await page.locator('.q-review-checks select').all()) await control.selectOption('corrected');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  await page.reload();
  const [question] = await records();
  expect(question.source.parts.flatMap(part => part.locations.map(location => location.page)).sort()).toEqual([1, 2]);
  // Importing only the continuation page must not guess a missing first page,
  // or attach its content to a question from another import.
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传 PDF/ }).click();
  await page.getByLabel('选择原稿').setInputFiles(pdf);
  await page.getByRole('button', { name: '材料名称、出处与处理范围', exact: true }).click();
  await page.getByLabel('处理页码').fill('2');
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByText('整理完成，等待校对', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('求三加五的和');
  await expect(page.getByRole('article', { name: '待检查题干' })).not.toContainText('第二个条件');
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toHaveCount(0);
  await page.getByText('未分配片段 · 1', { exact: true }).click();
  await expect(page.locator('.q-review details pre')).toContainText('第二个条件');
  await page.getByLabel('片段处理', { exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByLabel('片段处理', { exact: true }).selectOption('ignored');
  await page.getByRole('button', { name: '保存检查进度', exact: true }).click();
  await expect(page.locator('.q-message')).toContainText('校对已保存');
  await page.reload();
  await page.getByText('未分配片段 · 1', { exact: true }).click();
  await expect(page.getByLabel('片段处理', { exact: true })).toHaveValue('ignored');
  await page.screenshot({ path: test.info().outputPath('continuation-fragments.png') });
  const split = path.join(world.directory, 'continuation-page-%d.pdf');
  const reversed = path.join(world.directory, 'reversed-continuation.pdf');
  execFileSync('/usr/bin/pdfseparate', [pdf, split]);
  execFileSync('/usr/bin/pdfunite', [split.replace('%d', '2'), split.replace('%d', '1'), reversed]);
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传 PDF/ }).click();
  await page.getByLabel('选择原稿').setInputFiles(reversed);
  // Page selection belongs to this new import; clear the previous selection.
  await page.getByRole('button', { name: '材料名称、出处与处理范围', exact: true }).click();
  await page.getByLabel('处理页码').fill('');
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByText('整理完成，等待校对', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2 待检查', exact: true }).click();
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('第一个条件');
  await expect(page.getByRole('article', { name: '待检查题干' })).not.toContainText('第二个条件');
  await expect(page.getByText('未分配片段 · 1', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '账户：题库老师' }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', 'dark');
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
  await page.setViewportSize({ width: 600, height: 900 });
  await page.getByRole('button', { name: '校对结果', exact: true }).click();
  await page.getByText('未分配片段 · 1', { exact: true }).click();
  await page.getByLabel('片段处理', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '确认这道题', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: test.info().outputPath('continuation-fragments-dark-narrow.png') });
});

for (const variant of ['对齐双栏', '逆序写入且无结构标签', '长题换行与独立答案页']) {
test(`导入：双栏 PDF ${variant}按栏整理，题干和选项不串栏`, async ({ page, context }) => {
  const source = await context.newPage();
  const pdf = path.join(world.directory, 'two-columns.pdf');
  const long = variant === '长题换行与独立答案页';
  const reverse = variant === '逆序写入且无结构标签';
  const left = `<section style="grid-column:1;grid-row:1"><p>1. 左栏第一题，${long ? '某班先有三位同学到场，随后又来了五位同学，请根据题目中给出的信息计算现在共有多少位同学到场。' : '求三加五的和。'}</p><p>A. 六　B. 七　C. 八　D. 九</p><p>2. 左栏第二题，求九减二的差。</p><p>请说明计算步骤。</p></section>`;
  const right = '<section style="grid-column:2;grid-row:1"><p>3. 右栏第三题，求四乘二的积。</p><p>A. 六　B. 七　C. 八　D. 九</p><p>4. 右栏第四题，求十除二的商。</p><p>请说明计算步骤。</p></section>';
  try {
    await source.setContent(`<html lang="zh-CN"><head><style>@page{size:A4;margin:20mm}body{font:16px "Noto Sans CJK SC",sans-serif}.columns{display:grid;grid-template-columns:1fr 1fr;gap:50px}p{line-height:1.8;margin:0 0 20px}.answers{break-before:page}</style></head><body>${long ? '<h2>数学练习</h2>' : ''}<div class="columns">${reverse ? right + left : left + right}</div><footer>第 1 页</footer>${long ? '<section class="answers"><h2>参考答案</h2><div class="columns"><section><p>1. 八</p><p>2. 七</p></section><section><p>3. 八</p><p>4. 五</p></section></div><footer>第 2 页</footer></section>' : ''}</body></html>`);
    await source.evaluate(() => document.fonts.ready);
    await source.pdf({ path: pdf, preferCSSPageSize: true, tagged: !reverse });
  } finally { await source.close(); }
  if (reverse) {
    const raw = execFileSync('/usr/bin/pdftotext', ['-raw', pdf, '-'], { encoding: 'utf8' });
    expect(raw.indexOf('右栏第三题')).toBeLessThan(raw.indexOf('左栏第一题'));
  }
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传 PDF/ }).click();
  await page.getByLabel('选择原稿').setInputFiles(pdf);
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByText('整理完成，等待校对', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '4 待检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '5 待检查', exact: true })).toHaveCount(0);
  const bodies = [];
  for (const [number, text] of [[1, '左栏第一题'], [2, '左栏第二题'], [3, '右栏第三题'], [4, '右栏第四题']]) {
    await page.getByRole('button', { name: `${number} 待检查`, exact: true }).click();
    const body = page.getByRole('article', { name: '待检查题干' });
    await expect(body).toContainText(text);
    await expect(body).not.toContainText(/第 [12] 页|数学练习|参考答案/);
    if ([1, 3].includes(number)) {
      await expect(body.getByRole('listitem')).toHaveText(['A六', 'B七', 'C八', 'D九']);
    }
    if (long) {
      await expect(page.locator('.q-review-answer')).toHaveText(`答案与解析${['八', '七', '八', '五'][number - 1]}`);
      if (number === 1) expect((await body.innerText()).replace(/\s/g, '')).toContain('现在共有多少位同学到场。');
    }
    bodies.push(await body.innerText());
    for (const control of await page.locator('.q-review-checks select').all()) await control.selectOption('corrected');
    await page.getByRole('button', { name: '确认这道题', exact: true }).click();
    await expect(page.getByRole('button', { name: `${number} 已入库`, exact: true })).toBeVisible();
  }
  expect(bodies[0]).not.toContain('右栏');
  expect(bodies[1]).not.toContain('右栏');
  expect(bodies[2]).not.toContain('左栏');
  expect(bodies[3]).not.toContain('左栏');
  await page.reload();
  const saved = await records();
  expect(saved).toHaveLength(4);
  for (const question of saved) {
    expect(question.source.parts.flatMap(p => p.locations.map(l => l.page)).sort()).toEqual(long ? [1, 2] : [1]);
  }
});
}

test('导入：双栏 PDF 左栏题目和右栏答案不能整页误判为答案页', async ({ page, context }) => {
  const source = await context.newPage();
  const pdf = path.join(world.directory, 'questions-and-answers.pdf');
  try {
    await source.setContent('<html lang="zh-CN"><style>@page{size:A4;margin:20mm}body{font:16px "Noto Sans CJK SC",sans-serif}.columns{display:grid;grid-template-columns:1fr 1fr;gap:50px}</style><div class="columns"><section><p>1. 求三加五的和。</p><p>2. 求九减二的差。</p></section><section><p>参考答案</p><p>1. 八</p><p>2. 七</p></section></div></html>');
    await source.evaluate(() => document.fonts.ready);
    await source.pdf({ path: pdf, preferCSSPageSize: true });
  } finally { await source.close(); }
  await finder(page).getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传 PDF/ }).click();
  await page.getByLabel('选择原稿').setInputFiles(pdf);
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByText('整理完成，等待校对', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '2 待检查', exact: true })).toBeVisible();
  for (const [number, body, answer] of [[1, '求三加五的和', '八'], [2, '求九减二的差', '七']]) {
    await page.getByRole('button', { name: `${number} 待检查`, exact: true }).click();
    await expect(page.getByRole('article', { name: '待检查题干' })).toContainText(body);
    await expect(page.locator('.q-review-answer')).toHaveText(`答案与解析${answer}`);
  }
  await expect(page.getByRole('button', { name: '3 待检查', exact: true })).toHaveCount(0);
});

test('核心体验：删除和移动段落可局部撤销，保留之后输入', async ({ page }) => {
  await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill('局部恢复');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('第一段保留');
  await page.getByRole('button', { name: '插入更多内容', exact: true }).click();
  await page.getByRole('menuitem', { name: '添加段落', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 2', exact: true }).fill('误删的第二段');
  await page.getByRole('button', { name: '删除题干第 2 段', exact: true }).click();
  await page.getByLabel('题目标题').fill('删除后补写的标题');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('删除后补写的第一段');
  await page.getByRole('button', { name: '撤销题干结构操作', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 2', exact: true })).toHaveValue('误删的第二段');
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('删除后补写的第一段');
  await expect(page.getByLabel('题目标题')).toHaveValue('删除后补写的标题');
  await page.getByRole('button', { name: '上移题干第 2 段', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('移动后补写的第二段');
  await page.getByRole('button', { name: '撤销题干结构操作', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 2', exact: true })).toHaveValue('移动后补写的第二段');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await page.reload();
  expect((await records())[0].body.blocks.map(b => b.runs[0].text)).toEqual(['删除后补写的第一段', '移动后补写的第二段']);
});

test('核心体验：全部处理材料折叠访问，待处理材料继续收录', async ({ page }) => {
  await collectText(page, '1. 求三加五的和。');
  await page.getByLabel('题干是否完整，是否混入了其他题目？').selectOption('acknowledged');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await expect(page.locator('.q-imports').filter({ hasText: '继续收录' })).toHaveCount(0);
  const completed = page.locator('.q-imports').filter({ hasText: '已完成材料' });
  await expect(completed).not.toHaveAttribute('open');
  await completed.locator('summary').click();
  await completed.getByRole('button').click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await page.locator('.q-list-entry button').first().click();
  await page.getByRole('button', { name: '对照原稿', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await collectText(page, '1. 尚未确认的新题。');
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  await expect(page.locator('.q-imports').filter({ hasText: '继续收录' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.q-imports').filter({ hasText: '继续收录' }).getByRole('button')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('materials-completed-folded-light.png') });
});

test('核心体验：表格内部删除可撤销，保住另一格后续文字', async ({ page }) => {
  await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByRole('button', { name: '插入更多内容', exact: true }).click();
  await page.getByRole('menuitem', { name: '添加表格', exact: true }).click();
  const cells = page.locator('.material-table-scroll td');
  await cells.nth(0).getByRole('button', { name: '段落', exact: true }).click();
  await cells.nth(0).getByRole('textbox').fill('保留格');
  await cells.nth(1).getByRole('button', { name: '段落', exact: true }).click();
  await cells.nth(1).getByRole('textbox').fill('误删格');
  await page.getByRole('button', { name: '删除末列', exact: true }).click();
  await cells.nth(0).getByRole('textbox').fill('后来补写的格');
  await page.getByRole('button', { name: '撤销题干结构操作', exact: true }).click();
  await expect(cells.nth(0).getByRole('textbox')).toHaveValue('后来补写的格');
  await expect(cells.nth(1).getByRole('textbox')).toHaveValue('误删格');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await page.reload();
  expect((await records())[0].body.blocks.find(b => b.type === 'table').rows[0].map(c => c.blocks[0].runs[0].text)).toEqual(['后来补写的格', '误删格']);
});

test('核心体验：未分配片段选择答案或笔记，保存刷新不重复归入', async ({ page }) => {
  await collectText(page, '1. 计算 $1+1$。\n1. 计算 $2+2$。\n参考答案\n1. $2$。\n1. $4$。');
  await page.getByText('未分配片段 · 2', { exact: true }).click();
  await page.getByLabel('片段归入位置', { exact: true }).nth(0).selectOption('solution');
  await page.getByRole('button', { name: '归入答案与解析', exact: true }).nth(0).click();
  await page.getByLabel('片段归入位置', { exact: true }).nth(1).selectOption('note');
  await page.getByRole('button', { name: '归入笔记', exact: true }).click();
  await expect(page.getByRole('button', { name: '归入笔记', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '修改题目', exact: true }).click();
  await page.getByRole('button', { name: '教学笔记', exact: true }).click();
  await page.getByRole('button', { name: '移除笔记片段 1', exact: true }).click();
  await expect(page.getByLabel('片段处理', { exact: true }).nth(1)).toHaveValue('unassigned');
  await expect(page.getByRole('button', { name: '归入笔记', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '归入笔记', exact: true }).click();
  await page.getByRole('button', { name: '完成修改', exact: true }).click();
  await page.getByRole('button', { name: '保存检查进度', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认上次请求', exact: true })).toHaveCount(0);
  await expect(page.locator('.q-message')).toContainText('校对已保存');
  await page.reload();
  await page.getByText('未分配片段 · 2', { exact: true }).click();
  await expect(page.getByLabel('片段处理', { exact: true }).nth(0)).toBeDisabled();
  await expect(page.getByLabel('片段处理', { exact: true }).nth(1)).toBeDisabled();
  const notes = page.getByRole('button', { name: '教学笔记', exact: true });
  if (await notes.getAttribute('aria-expanded') !== 'true') await notes.click();
  await expect(page.locator('.q-note-fragments .katex')).toBeVisible();
  for (const control of await page.locator('.q-review-checks select').all()) await control.selectOption('corrected');
  await page.getByRole('button', { name: '修改题目', exact: true }).click();
  await page.getByLabel('答案状态', { exact: true }).selectOption('present');
  await page.getByRole('button', { name: '完成修改', exact: true }).click();
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByText('1 题已入库')).toBeVisible();
  await page.getByRole('button', { name: '查看题目', exact: true }).click();
  await page.getByRole('button', { name: '教学笔记', exact: true }).click();
  await expect(page.locator('.q-reader-note .katex')).toBeVisible();
  await page.reload();
  const [saved] = await records();
  for (const [theme, width] of [['light', 1440], ['dark', 600]]) {
    await page.getByRole('link', { name: '账户：题库老师' }).click();
    await page.getByRole('button', { name: theme === 'light' ? '浅色' : '深色', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', theme);
    await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
    await page.setViewportSize({ width, height: 900 });
    const noteToggle = page.getByRole('button', { name: '教学笔记', exact: true });
    if (await noteToggle.getAttribute('aria-expanded') !== 'true') await noteToggle.click();
    await expect.poll(() => page.locator('.q-reader-note .wb-module-disclosure-grid').evaluate(element => element.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
    await page.locator('.q-reader-note .katex').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: test.info().outputPath(`fragment-notes-${theme}-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(saved.note).toBe('');
  expect(saved.noteFragments).toHaveLength(1);
  expect(saved.noteFragments[0].locations.length).toBeGreaterThan(0);
  expect(saved.noteFragments[0].document.blocks.flatMap(b => b.runs ?? []).some(r => r.type === 'math')).toBe(true);
  expect(saved.solution.blocks.flatMap(b => b.runs ?? []).some(r => r.type === 'math')).toBe(true);
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await page.getByRole('button', { name: '题型、标签与笔记', exact: true }).click();
  await page.getByLabel('长期笔记', { exact: true }).fill('手写讲解提醒');
  await page.getByRole('textbox', { name: '笔记片段 1段落 1', exact: true }).fill('$4$ 是另一份答案。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑题目', exact: true })).toBeVisible();
  await page.reload();
  expect((await records())[0].note).toBe('手写讲解提醒');
  expect((await records())[0].noteFragments[0].document.blocks[0].runs[1].text).toContain('另一份答案');
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  const copyNotes = page.getByRole('button', { name: '题型、标签与笔记', exact: true });
  if (await copyNotes.getAttribute('aria-expanded') !== 'true') await copyNotes.click();
  await expect(page.getByLabel('长期笔记', { exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: '笔记片段 1段落 1', exact: true })).toHaveCount(0);
  await page.getByLabel('题目标题').fill('片段笔记独立的改编');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '片段笔记独立的改编', exact: true })).toBeVisible();
  expect((await records()).find(item => item.id !== saved.id).noteFragments ?? []).toEqual([]);
});

test('核心体验：局部撤销入口深浅色和窄屏可达', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.getByRole('link', { name: '账户：题库老师' }).click();
    await page.getByRole('button', { name: theme === 'light' ? '浅色' : '深色', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', theme);
    await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
    await finder(page).getByRole('button', { name: '手动录题', exact: true }).click();
    await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('已知 $x^2=9$，求实数 $x$。');
    await page.getByRole('button', { name: '插入更多内容', exact: true }).click();
    await page.getByRole('menuitem', { name: '添加段落', exact: true }).click();
    await page.getByRole('textbox', { name: '题干段落 2', exact: true }).fill('请说明解题步骤。');
    await page.getByRole('button', { name: '删除题干第 2 段', exact: true }).click();
    for (const width of [1440, 600]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: '撤销题干结构操作', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: test.info().outputPath(`structure-undo-${theme}-${width}.png`) });
    }
    await page.getByRole('button', { name: '撤销题干结构操作', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '题干段落 2', exact: true })).toHaveValue('请说明解题步骤。');
    await page.getByRole('button', { name: '保存题目', exact: true }).click();
    await expect(page.getByRole('button', { name: '编辑题目', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});

test('核心体验：没有待检查题但仍有未分配答案的材料继续收录', async ({ page }) => {
  await collectText(page, '参考答案\n1. $8$。');
  await expect(page.getByText('未分配片段 · 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回题库', exact: true }).click();
  const pending = page.locator('.q-imports').filter({ hasText: '继续收录' });
  await expect(pending.getByRole('button')).toHaveCount(1);
  await expect(pending).toContainText('0 待校对');
  await expect(page.locator('.q-imports').filter({ hasText: '已完成材料' })).toHaveCount(0);
  await page.reload();
  await expect(pending.getByRole('button')).toHaveCount(1);
});
