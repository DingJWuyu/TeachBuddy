import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { randomUUID } from 'node:crypto';
import { doc, question } from '../../api/test/teaching-time-classes-materials-fixture.js';
import { register, headers } from './teaching-time-auth/helpers.mjs';
let world;
let errors;
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await register(page, world);
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});
const row = (page, id) => page.locator(`[data-drop-module="${id}"]`);
async function route(page, path, name) {
  await page.goto(world.origin + path);
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', name);
}

test('六模块真实外壳、辅助栏、前进后退、未知及非法深链接', async ({ page }, info) => {
  for (const [id, path] of [['questions', '/questions'], ['lessons', '/lessons'], ['math', '/math'], ['resources', '/resources'], ['classes', '/classes'], ['schedule', '/calendar']]) {
    await route(page, path, id);
    if (id !== 'schedule') await expect(row(page, id)).toHaveAttribute('aria-current', 'page');
    else {
      await expect(row(page, 'schedule')).toHaveCount(0);
      await expect(page.locator('.tb-global-nav').getByRole('link', { name: '日程' })).toHaveClass(/is-current/);
    }
    await page.getByRole('button', { name: 'AI 助理', exact: true }).click();
    await expect(page.locator('.wb-shell')).toHaveClass(/has-panel/);
    await page.screenshot({ path: info.outputPath(`${id}.png`) });
    await page.getByRole('button', { name: 'AI 助理', exact: true }).click();
    await expect(page.locator('.wb-shell')).not.toHaveClass(/has-panel/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await row(page, 'questions').click();
  await row(page, 'resources').click();
  await page.goBack();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
  await page.goForward();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'resources');
  for (const path of ['/missing', '/resources/%E0%A4%A', '/questions/%ZZ', '/lessons/%FF', '/classes/%E0%A4%A/records/x', '/math/unknown']) {
    await route(page, path, 'unknown');
    await expect(page.getByText('未找到内容', { exact: true })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('invalid-url.png') });
  await route(page, '/questions/' + encodeURIComponent('题目'), 'question');
  await expect(row(page, 'questions')).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('侧栏分组、拖动、隐藏恢复和刷新保留', async ({ page }, info) => {
  await route(page, '/questions', 'questions');
  await page.locator('[data-new-group-toggle]').click();
  await page.getByRole('textbox', { name: '新分组名称' }).fill('备课分组');
  await page.getByRole('textbox', { name: '新分组名称' }).press('Enter');
  const target = page.locator('[data-drop-group]').filter({ has: page.getByText('备课分组', { exact: true }) });
  await row(page, 'math').dragTo(target);
  await expect(target.locator('[data-drop-module="math"]')).toBeVisible();
  await row(page, 'resources').focus();
  await page.keyboard.press('Delete');
  await expect(row(page, 'resources')).toHaveCount(0);
  await page.reload();
  await expect(target.locator('[data-drop-module="math"]')).toBeVisible();
  await expect(row(page, 'resources')).toHaveCount(0);
  await page.locator('[data-trash-toggle]').click();
  await page.getByRole('button', { name: '资源库。点击恢复到未分组，或拖到其他分组' }).click();
  await expect(row(page, 'resources')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-drop-group="ungrouped"] [data-drop-module="resources"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('layout-restored.png') });
  expect(errors).toEqual([]);
});

test('班级时区失败重试以及详情路由', async ({ page }, info) => {
  await page.route('**/api/modules/schedule/settings', request => request.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: '隔离时区读取失败' } }) }));
  await route(page, '/classes', 'classes');
  await expect(page.getByRole('alert')).toContainText('时区读取失败');
  await page.unroute('**/api/modules/schedule/settings');
  await page.getByRole('button', { name: '重试读取时区' }).click();
  await page.getByRole('button', { name: '创建班级', exact: true }).click();
  await page.getByLabel('班级名称').fill('目录回归班级');
  await page.getByRole('dialog', { name: '创建班级' }).getByRole('button', { name: '创建班级', exact: true }).click();
  await expect(page).toHaveURL(/\/classes\/[^/]+$/);
  const classId = new URL(page.url()).pathname.split('/').at(-1);
  await route(page, `/classes/${classId}`, 'class');
  await expect(row(page, 'classes')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('textbox', { name: '写一句', exact: true }).fill('目录详情课堂记录');
  await page.locator('[data-region=record-composer]').getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.locator('[data-region=record-rows]')).toContainText('目录详情课堂记录');
  const recordId = await page.locator('[data-record-id]').first().getAttribute('data-record-id');
  await route(page, `/classes/${classId}/records/${recordId}`, 'class-record');
  await expect(page.locator('[data-record-id]').first()).toContainText('目录详情课堂记录');
  await page.screenshot({ path: info.outputPath('class-detail.png') });
  expect(errors).toEqual([]);
});

async function create(page, path, data) {
  const response = await page.request.post(world.origin + path, { data, headers: { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

test('题目课稿数学详情、资源一次消费与 Agent 返回现场', async ({ page }, info) => {
  const q = await create(page, '/api/modules/questions/v2/items', question('目录题目'));
  const lesson = await create(page, '/api/modules/lessons/v3', { title: '目录课稿', intro: doc('目录课稿正文'), sections: [], materials: [] });
  const sample = JSON.parse(fs.readFileSync(new URL('../../api/test/fixtures/contracts/math-samples.json', import.meta.url))).find(item => item.id === 'create-formula').value;
  const math = await create(page, '/api/modules/math/v1/works', { ...sample, title: '目录公式' });
  const uploaded = await page.request.post(world.origin + '/api/workbench/files', { multipart: { file: { name: 'catalog.png', mimeType: 'image/png', buffer: fs.readFileSync(new URL('./fixtures/materials-questions/figure.png', import.meta.url)) } }, headers: { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() } });
  expect(uploaded.status()).toBe(201);
  const resource = await create(page, '/api/modules/resources/items', { title: '目录资料', fileId: (await uploaded.json()).id, folderId: null, tagIds: [], note: '' });
  for (const [path, name, id, title] of [[`/questions/${q.id}`, 'question', 'questions', '目录题目'], [`/lessons/${lesson.id}`, 'lesson', 'lessons', '目录课稿'], [`/math?workId=${math.id}`, 'math', 'math', '目录公式'], [`/resources/${resource.id}`, 'resource', 'resources', '目录资料']]) {
    await route(page, path, name);
    await expect(row(page, id)).toHaveAttribute('aria-current', 'page');
    if (id === 'math') await expect(page.getByRole('textbox', { name: '作品名称', exact: true })).toHaveValue(title);
    else await expect(page.locator('[data-region=main]')).toContainText(title);
    await page.reload();
    if (id === 'math') await expect(page.getByRole('textbox', { name: '作品名称', exact: true })).toHaveValue(title);
    else await expect(page.locator('[data-region=main]')).toContainText(title);
    await page.screenshot({ path: info.outputPath(`${id}-detail.png`) });
  }
  await page.getByRole('button', { name: '返回资源库', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '返回资源库', exact: true })).toHaveCount(0);
  await route(page, `/questions/%${q.id.charCodeAt(0).toString(16)}${q.id.slice(1)}`, 'question');
  await expect(page.locator('[data-region=main]')).toContainText('目录题目');
  await page.getByRole('button', { name: 'AI 助理', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveClass(/has-panel/);
  await page.locator('.tb-global-nav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'home');
  await page.getByRole('button', { name: '返回工作', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'question');
  await expect(page.locator('.wb-shell')).toHaveClass(/has-panel/);
  const entry = await create(page, '/api/modules/schedule/entries', { title: '目录日程详情', items: [], time: { date: '2026-09-28', startTime: '10:00', durationMinutes: 45, timeZone: 'Asia/Shanghai' }, repeat: null, course: { classId: null, lessonId: null, recordIds: [] }, reminder: null });
  await route(page, `/calendar?entry=${entry.id}`, 'schedule');
  await expect(page.locator('[name=entry-title]')).toHaveValue('目录日程详情');
  await page.reload();
  await expect(page.locator('[name=entry-title]')).toHaveValue('目录日程详情');
  await page.screenshot({ path: info.outputPath('schedule-detail.png') });
  expect(errors).toEqual([]);
});

test('教程搜索消费目录，窄屏日程入口和侧栏高亮', async ({ page }, info) => {
  await page.getByRole('button', { name: '使用教程', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: '教程完成进度' })).toHaveAttribute('aria-valuemax', '5');
  await expect(page.locator('.tb-popover-tutorial')).toContainText('班级教学');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '全局搜索', exact: true }).click();
  await page.getByRole('searchbox').fill('日程');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'schedule');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
  await expect(page.locator('.tb-mobile-nav').getByRole('link', { name: '日程', exact: true })).toHaveAttribute('aria-current', 'page');
  await row(page, 'questions').click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('narrow-navigation.png') });
  expect(errors).toEqual([]);
});

for (const [name, path, main] of [['classes', '/classes', '[data-region=class-home]'], ['schedule', '/calendar', '.cal-board']]) {
  test(`${name} 主面板和辅助栏上下对齐`, async ({ page }, info) => {
    await route(page, path, name);
    await page.getByRole('button', { name: 'AI 助理', exact: true }).click();
    await expect(page.locator('[data-region=auxiliary]')).toBeVisible();
    for (const width of [1440, 1200, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(async () => {
        const mainBox = await page.locator(main).first().boundingBox();
        const panelBox = await page.locator('[data-region=auxiliary]').boundingBox();
        return Math.max(Math.abs(mainBox.y - panelBox.y), Math.abs(mainBox.y + mainBox.height - panelBox.y - panelBox.height));
      }).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`aligned-panel-${width}.png`) });
    }
  });
}
