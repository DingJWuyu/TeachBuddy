import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, headers } from './teaching-time-auth/helpers.mjs';

let world, errors, retiredRequests;
test.beforeEach(async ({ page }) => {
  if (!process.env.WORKBENCH_WEB_DIST) throw new Error('Use an isolated production build.');
  world = await createIntegration();
  errors = []; retiredRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/modules/lessons')) retiredRequests.push(request.url()); });
  await register(page, world);
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world?.close();
  if (info.status === info.expectedStatus && !errors.length) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(errors).toEqual([]);
  expect(retiredRequests).toEqual([]);
});
async function get(page, endpoint) {
  const response = await page.request.get(world.origin + endpoint, { headers: headers(page) });
  expect(response.status()).toBe(200); return response.json();
}
async function shot(page, info, name) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(name + '.png'), animations: 'disabled' });
}

test('退役导航、旧设备现场、搜索与旧路由正常兜底', async ({ page }, info) => {
  await expect(page.locator('[data-navigation-status]')).toHaveCount(0);
  const context = await get(page, '/api/workbench/context');
  const navigation = await get(page, '/api/workbench/navigation');
  const legacy = structuredClone(navigation.layout);
  legacy.groups[0].moduleIds.push('lessons');
  const saved = await page.request.put(world.origin + '/api/workbench/navigation', {
    headers: { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() },
    data: { baseVersion: navigation.version, layout: legacy },
  });
  expect(saved.status()).toBe(200);
  // Previous-version storage is a compatibility input, not a UI action.
  await page.evaluate(account => {
    for (const key of Object.keys(localStorage).filter(key => key.endsWith(':scene:shell'))) {
      const value = JSON.parse(localStorage.getItem(key));
      const shell = value.formatVersion === 2 ? value.value : value;
      shell.lastWorkPath = '/lessons/retired';
      localStorage.setItem(key, JSON.stringify(value));
    }
    localStorage.setItem(`tb.workbench.v1:${account}:scene:material-navigation`, JSON.stringify({ lessonPath: '/lessons/retired', sourcePath: '/questions' }));
    localStorage.setItem(`tb.workbench.v1:${account}:scene:math-return`, JSON.stringify({ target: { lessonId: 'retired', label: '旧课稿' } }));
  }, context.accountKey);
  await page.reload();
  await expect(page.locator('[data-drop-module="lessons"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '返回工作', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '全局搜索', exact: true }).click();
  await page.getByRole('searchbox').fill('备课');
  await expect(page.locator('.tb-search-empty')).toContainText('没有匹配「备课」的结果');
  await expect(page.locator('.tb-search-panel a')).toHaveCount(0);
  await page.keyboard.press('Escape');
  for (const [url, name] of [['/questions', 'questions'], ['/resources', 'resources'], ['/math', 'math'], ['/classes', 'classes'], ['/calendar', 'schedule']]) {
    await page.goto(world.origin + url);
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', name);
    await expect(page.locator('[data-region=main]')).not.toContainText('加入备课');
    await expect(page.locator('[data-region=main]')).not.toContainText('返回备课');
    await shot(page, info, name);
  }
  for (const route of ['/lessons', '/lessons/retired']) {
    await page.goto(world.origin + route);
    await expect(page.locator('[data-region=not-found]')).toBeVisible();
    await page.locator('[data-region=not-found] a').click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
  }
  await page.goto(world.origin + '/help');
  await expect(page.locator('[data-region=main]')).not.toContainText('备课');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, info, 'help-narrow');
});

test('班级记录与日程关联保存刷新读回，深浅色保持可用', async ({ page }, info) => {
  await page.goto(world.origin + '/classes');
  await page.getByRole('button', { name: '创建班级', exact: true }).click();
  await page.getByLabel('班级名称').fill('退役回归班级');
  await page.getByRole('dialog', { name: '创建班级' }).getByRole('button', { name: '创建班级', exact: true }).click();
  await page.getByRole('textbox', { name: '写一句', exact: true }).fill('函数定义已经讲清');
  await page.locator('[data-region=record-composer]').getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.locator('[data-region=record-rows]')).toContainText('函数定义已经讲清');
  const classId = new URL(page.url()).pathname.split('/').at(-1);
  const recordId = await page.locator('[data-record-id]').first().getAttribute('data-record-id');
  await page.goto(world.origin + '/calendar');
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('函数课堂复习');
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '教学关联', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '教学关联', exact: true });
  await dialog.getByLabel('班级', { exact: true }).selectOption(classId);
  await dialog.getByRole('checkbox', { name: /函数定义已经讲清/ }).check();
  await expect(dialog.getByLabel('备课', { exact: true })).toHaveCount(0);
  await shot(page, info, 'course-light');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  const saved = async () => (await get(page, '/api/modules/schedule/entries')).items.find(item => item.title === '函数课堂复习');
  await expect.poll(async () => (await saved())?.course).toEqual({ classId, recordIds: [recordId] });
  const entry = await saved();
  await page.reload();
  await expect(page.locator('[name=entry-title]')).toHaveValue('函数课堂复习');
  await page.getByRole('button', { name: '教学关联', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: /函数定义已经讲清/ })).toBeChecked();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.goto(world.origin + '/settings');
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  await page.goto(world.origin + `/calendar?entry=${entry.id}`);
  await page.getByRole('button', { name: '教学关联', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: /函数定义已经讲清/ })).toBeChecked();
  await shot(page, info, 'course-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, info, 'course-dark-narrow');
  const record = await get(page, `/api/modules/classes/v2/records/${recordId}`);
  expect(record.note).toBe('函数定义已经讲清');
});
