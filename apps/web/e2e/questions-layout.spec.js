import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  await page.getByRole('button', { name: '管理题型与标签', exact: true }).click();
  await expect(page.getByLabel('分类类别')).toBeVisible();
}
async function snapshot(page, info, name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => animation.effect.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: true });
}

async function editorHeaderGeometry(page) {
  return page.locator('.q-question-heading').evaluate(header => {
    const box = node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const state = header.querySelector('.q-save-state');
    const range = document.createRange();
    range.selectNodeContents(state);
    return { header: box(header), back: box(header.querySelector('.q-back')), state: box(state),
      stateText: box(range), stateOverflow: state.scrollWidth - state.clientWidth, save: box(header.querySelector('.primary')) };
  });
}

for (const language of ['zh-CN', 'en']) {
  for (const theme of ['light', 'dark']) {
    test(`编辑头部 ${language}/${theme} 在桌面及窄容器显示返回、保存状态和保存按钮`, async ({ page }, info) => {
      await page.locator('.q-finder').getByRole('button', { name: '新建题目', exact: true }).click();
      await page.getByLabel('题目标题').fill('编辑头部原题');
      await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('计算2与3的和。');
      await page.getByRole('button', { name: '保存题目', exact: true }).click();
      await expect(page.getByRole('heading', { name: '编辑头部原题', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '复制改编', exact: true }).click();
      await page.getByLabel('题目标题').fill('编辑头部改编');
      await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('计算2与5的和。');
      await page.getByRole('link', { name: /^账户：/ }).click();
      await page.getByRole('button', { name: theme === 'dark' ? '深色' : '浅色', exact: true }).click();
      if (language === 'en') {
        await page.getByRole('button', { name: '语言', exact: true }).click();
        await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
      }
      await page.getByRole('navigation').getByRole('link', { name: language === 'en' ? /^Question bank/ : /^题库/ }).click();
      await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.q-save-state')).toHaveText(language === 'en' ? 'Draft saved on this device' : '草稿保存在此设备');
      const measurements = {};
      for (const width of [1440, 600, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator('.q-question-heading').scrollIntoViewIfNeeded();
        await snapshot(page, info, 'editor-header-' + width);
        const geometry = await editorHeaderGeometry(page);
        measurements[width] = geometry;
        fs.writeFileSync(info.outputPath('editor-header-geometry.json'), JSON.stringify(measurements, null, 2));
        if (width !== 390) {
        expect(geometry.stateOverflow).toBeLessThanOrEqual(1);
        for (const control of [geometry.back, geometry.stateText, geometry.save]) {
          expect(control.x).toBeGreaterThanOrEqual(geometry.header.x - 1);
          expect(control.right).toBeLessThanOrEqual(geometry.header.right + 1);
          expect(control.y).toBeGreaterThanOrEqual(geometry.header.y - 1);
          expect(control.bottom).toBeLessThanOrEqual(geometry.header.bottom + 1);
        }
        const overlap = (first, second) => Math.max(0, Math.min(first.right, second.right) - Math.max(first.x, second.x))
          * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y));
        expect(overlap(geometry.stateText, geometry.save)).toBeLessThan(1);
        expect(overlap(geometry.stateText, geometry.back)).toBeLessThan(1);
        expect(overlap(geometry.back, geometry.save)).toBeLessThan(1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      }
      await page.locator('.q-question-heading > .primary').click();
      await expect(page.getByRole('heading', { name: '编辑头部改编', exact: true })).toBeVisible();
      const records = (await client.request('GET', base + '/items')).json.items;
      expect(records).toHaveLength(2);
      expect(records.find(question => question.title === '编辑头部改编').body.blocks[0].runs[0].text).toBe('计算2与5的和。');
      await page.getByRole('button', { name: language === 'en' ? 'Edit question' : '编辑题目', exact: true }).click();
      await page.locator('.q-question-heading > .q-back').click();
      await expect(page.getByRole('button', { name: language === 'en' ? 'Edit question' : '编辑题目', exact: true })).toBeVisible();
    });
  }
}

async function reviewGeometry(page) {
  return page.locator('.q-review').evaluate(review => {
    const bounds = selector => {
      const box = review.querySelector(selector).getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return { original: bounds('.q-original'), divider: bounds('.q-resize-divider'), result: bounds('.q-review-result'), width: review.clientWidth };
  });
}
async function expectReviewBoundary(page) {
  await expect.poll(async () => {
    const box = await reviewGeometry(page);
    return Math.abs(box.original.right - box.divider.x) + Math.abs(box.divider.right - box.result.x)
      + Math.abs(box.original.y - box.result.y) + Math.abs(box.original.height - box.result.height);
  }).toBeLessThan(2);
}

for (const kind of ['文字', '图片']) {
  test(`${kind}收录校对原稿、分隔条、结果同行对齐，拖拽键盘及窄屏切换正常`, async ({ page }, info) => {
    await page.locator('.q-finder').getByRole('button', { name: '从资料收录', exact: true }).click();
    const capture = page.getByRole('dialog', { name: '从资料收录题目', exact: true });
    if (kind === '文字') {
      await capture.getByRole('button', { name: /粘贴文字/ }).click();
      await capture.getByLabel('原始文字').fill('1. 计算 1+1。\n答案：2\n2. 求 2+3。\n答案：5');
    } else {
      await capture.getByRole('button', { name: /上传图片/ }).click();
      await capture.getByLabel('选择原稿').setInputFiles(fileURLToPath(new URL('../../../test/fixtures/questions/recognition/I-3/page.png', import.meta.url)));
    }
    await capture.getByRole('button', { name: '开始整理', exact: true }).click();
    await expect(page.locator('.q-review-result')).toBeVisible();
    if (kind === '文字') await expect(page.getByRole('button', { name: '1 待检查', exact: true })).toBeVisible();
    else {
      await expect(page.locator('.q-original .q-page img')).toBeVisible();
      await expect.poll(() => page.locator('.q-original .q-page img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    }
    await snapshot(page, info, 'review-desktop-initial');
    fs.writeFileSync(info.outputPath('review-initial-geometry.json'), JSON.stringify(await reviewGeometry(page), null, 2));
    await expectReviewBoundary(page);
    const divider = page.getByRole('separator', { name: '调整原稿对照宽度', exact: true });
    await divider.focus();
    await divider.press('Home');
    await expect(divider).toHaveAttribute('aria-valuenow', '25');
    await expectReviewBoundary(page);
    const minimum = await reviewGeometry(page);
    await divider.press('ArrowRight');
    await expect.poll(async () => (await reviewGeometry(page)).original.width).toBeGreaterThan(minimum.original.width + 5);
    await divider.press('ArrowLeft');
    await expect.poll(async () => Math.abs((await reviewGeometry(page)).original.width - minimum.original.width)).toBeLessThan(2);
    await divider.press('End');
    await expect(divider).toHaveAttribute('aria-valuenow', '70');
    await expectReviewBoundary(page);
    let handle = await divider.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
    await page.mouse.down();
    await page.mouse.move(minimum.original.x - 50, handle.y + 40, { steps: 10 });
    await page.mouse.up();
    await expect(divider).toHaveAttribute('aria-valuenow', '25');
    await expectReviewBoundary(page);
    handle = await divider.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
    await page.mouse.down();
    await page.mouse.move(minimum.original.x + minimum.width + 50, handle.y + 40, { steps: 10 });
    await page.mouse.up();
    await expect(divider).toHaveAttribute('aria-valuenow', '70');
    await expectReviewBoundary(page);
    await divider.press('Home');
    await snapshot(page, info, 'review-desktop-keyboard-focus');
    await page.reload();
    await expect(divider).toHaveAttribute('aria-valuenow', '25');
    await expectReviewBoundary(page);
    for (const width of [900, 740]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(divider).toBeHidden();
      if (width > 1000) await snapshot(page, info, 'review-' + width);
      else {
        await page.locator('.q-review-switch').getByRole('button', { name: '原稿', exact: true }).click();
        await expect(page.locator('.q-original')).toBeVisible();
        await expect(page.locator('.q-review-result')).toBeHidden();
        let box = await page.locator('.q-original').boundingBox();
        expect(box.width).toBeGreaterThan((await page.locator('.q-review').boundingBox()).width - 2);
        await snapshot(page, info, 'review-original-' + width);
        await page.locator('.q-review-switch').getByRole('button', { name: '校对结果', exact: true }).click();
        await expect(page.locator('.q-original')).toBeHidden();
        await expect(page.locator('.q-review-result')).toBeVisible();
        box = await page.locator('.q-review-result').boundingBox();
        expect(box.width).toBeGreaterThan((await page.locator('.q-review').boundingBox()).width - 2);
        await snapshot(page, info, 'review-result-' + width);
        await page.reload();
        await expect(page.locator('.q-review')).toHaveAttribute('data-tab', 'result');
        await expect(page.locator('.q-review-result')).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('link', { name: /^账户：/ }).click();
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
    await expectReviewBoundary(page);
    await snapshot(page, info, 'review-desktop-dark');
  });
}

test('列表和阅读合为主卡片，右轨分类与标记在刷新后保留', async ({ page }, info) => {
  await page.locator('.q-finder').getByRole('button', { name: '新建题目', exact: true }).click();
  await page.getByLabel('题目标题').fill('原题对照布局');
  await page.getByLabel('题干段落 1', { exact: true }).fill('求 $2+3$。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  const list = page.locator('.tbx-qn-list'), reader = page.locator('.q-main'), rail = page.locator('.tbx-qn-rail');
  await expect(list).toBeVisible();
  await expect(rail).toBeVisible();
  await expect(page.locator('.q-workspace > .q-resize-divider')).toHaveCount(0);
  await snapshot(page, info, 'question-desktop');
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  await page.getByLabel('题目标题').fill('原题对照改编');
  await page.getByLabel('题干段落 1', { exact: true }).fill('求 $2+5$。');
  await expect(page.getByRole('region', { name: '原题对照', exact: true })).toContainText('原题对照布局');
  await page.reload();
  await expect(page.getByRole('region', { name: '原题对照', exact: true })).toBeVisible();
  await expect(page.getByLabel('题目标题')).toHaveValue('原题对照改编');
  await page.getByRole('button', { name: '结束对照', exact: true }).click();
  await expect(list).toBeVisible();
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(reader).toContainText('原题对照改编');
  await snapshot(page, info, 'question-adapted');
});

test('同名题型和标签分组可辨认，改名删除保存刷新只改变选定类别关联', async ({ page }, info) => {
  await page.locator('.q-finder').getByRole('button', { name: '新建题目', exact: true }).click();
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
  await openManagement(page);
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
  const dialog = page.getByRole('alertdialog', { name: '删除标签', exact: true });
  await expect(dialog).toContainText('证明题');
  await expect(dialog).toContainText('1 道题');
  await snapshot(page, info, 'delete-tag-confirmation');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(tags.getByRole('textbox').first()).toHaveValue('证明题');
  await tags.getByRole('button', { name: '删除标签“证明题”', exact: true }).click();
  await dialog.getByRole('button', { name: '删除标签', exact: true }).click();
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  await openManagement(page);
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
