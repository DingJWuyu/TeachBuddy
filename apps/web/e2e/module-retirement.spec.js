import { moduleRow, navigationGroup, pointerDrag } from './catalog-navigation.helpers.mjs';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { requestFingerprint } from '../../api/src/workbench/mutations.js';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, headers } from './teaching-time-auth/helpers.mjs';

let world, errors, retiredRequests;
test.beforeEach(async ({ page }) => {
  if (!process.env.WORKBENCH_WEB_DIST) throw new Error('Use an isolated production build.');
  world = await createIntegration();
  errors = []; retiredRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/api\/modules\/(lessons|classes)/.test(request.url())) retiredRequests.push(request.url()); });
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
  legacy.groups[0].moduleIds.push('lessons', 'classes');
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
      shell.lastWorkPath = '/classes/retired';
      localStorage.setItem(key, JSON.stringify(value));
    }
    localStorage.setItem(`tb.workbench.v1:${account}:scene:material-navigation`, JSON.stringify({ lessonPath: '/lessons/retired', sourcePath: '/questions' }));
    localStorage.setItem(`tb.workbench.v1:${account}:scene:math-return`, JSON.stringify({ target: { lessonId: 'retired', label: '旧课稿' } }));
    localStorage.setItem(`tb.workbench.v1:${account}:scene:class-search:retired:active`, JSON.stringify({ draft: '旧记录' }));
  }, context.accountKey);
  await page.reload();
  await expect(page.locator('[data-row="lessons"], [data-row="classes"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '返回工作', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '全局搜索', exact: true }).click();
  await page.getByRole('searchbox').fill('备课');
  await expect(page.locator('.tb-search-empty')).toContainText('没有匹配「备课」的结果');
  await expect(page.locator('.tb-search-panel a')).toHaveCount(0);
  await page.keyboard.press('Escape');
  for (const [url, name] of [['/questions', 'questions'], ['/resources', 'resources'], ['/math', 'math'], ['/calendar', 'schedule']]) {
    await page.goto(world.origin + url);
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', name);
    await expect(page.locator('[data-region=main]')).not.toContainText('加入备课');
    await expect(page.locator('[data-region=main]')).not.toContainText('返回备课');
    await shot(page, info, name);
  }
  for (const route of ['/lessons', '/lessons/retired', '/classes', '/classes/retired', '/classes/retired/records/retired']) {
    await page.goto(world.origin + route);
    await expect(page.locator('[data-region=not-found]')).toBeVisible();
    await page.locator('[data-region=not-found] a').click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
  }
  await page.goto(world.origin + '/help');
  await expect(page.locator('[data-region=main] a[href^="/lessons"], [data-region=main] a[href^="/classes"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, info, 'help-narrow');
});


test('独立日程保存刷新读回，深浅色和窄屏保持可用', async ({ page }, info) => {
  await page.goto(world.origin + '/calendar');
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('#calendar-entry-title').fill('函数课堂复习');
  await page.locator('#calendar-entry-title').press('Enter');
  const saved = async () => (await get(page, '/api/modules/schedule/entries')).items.find(item => item.title === '函数课堂复习');
  await expect.poll(async () => Boolean((await saved())?.id)).toBe(true);
  const entry = await saved();
  expect(entry).not.toHaveProperty('course');
  expect(entry).not.toHaveProperty('courseState');
  await expect(page.getByRole('button', { name: '教学关联', exact: true })).toHaveCount(0);
  await shot(page, info, 'schedule-light');
  await page.reload();
  await expect(page.locator('#calendar-entry-title')).toHaveValue('函数课堂复习');
  await page.goto(world.origin + '/settings');
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  await page.goto(world.origin + `/calendar?entry=${entry.id}`);
  await expect(page.locator('#calendar-entry-title')).toHaveValue('函数课堂复习');
  await shot(page, info, 'schedule-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, info, 'schedule-dark-narrow');
});

test('旧日程成功回执丢失后原键确认，保留后续输入且不重复创建', async ({ page }, info) => {
  await page.goto(world.origin + '/calendar');
  let lose = true, originalKey;
  await page.route('**/api/modules/schedule/entries', async route => {
    if (route.request().method() === 'POST' && lose) {
      lose = false;
      originalKey = route.request().headers()['idempotency-key'];
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('#calendar-entry-title').fill('旧待确认创建');
  await page.locator('#calendar-entry-title').press('Enter');
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  const before = (await get(page, '/api/modules/schedule/entries')).items;
  expect(before).toHaveLength(1);
  await page.locator('#calendar-entry-title').fill('确认期间的新输入');
  // Previous-version input: the browser payload and committed server fingerprint
  // describe the same legacy request, whose original receipt was lost.
  const legacyBody = await page.evaluate(() => {
    let body;
    for (const key of Object.keys(localStorage).filter(key => key.includes('pending:schedule-calendar'))) {
      const value = JSON.parse(localStorage.getItem(key));
      const pending = value.formatVersion === 2 ? value.value : value;
      if (!pending?.payload?.content) continue;
      pending.payload.content.course = { classId: null, recordIds: [] };
      localStorage.setItem(key, JSON.stringify(value));
      body = pending.payload.content;
    }
    return body;
  });
  expect(legacyBody).toBeTruthy();
  const row = world.workbench.db.prepare('SELECT body FROM workbench_mutation_keys WHERE key = ?').get(originalKey);
  const receipt = { ...JSON.parse(row.body), course: legacyBody.course, courseState: { classroom: null, records: [] } };
  world.workbench.db.prepare('UPDATE workbench_mutation_keys SET requestHash = ?, body = ? WHERE key = ?').run(
    requestFingerprint({ method: 'POST', path: '/api/modules/schedule/entries', body: legacyBody }), JSON.stringify(receipt), originalKey);
  await page.reload();
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toHaveCount(0);
  await expect(page.locator('#calendar-entry-title')).toHaveValue('确认期间的新输入');
  expect((await get(page, '/api/modules/schedule/entries')).items.map(item => item.id)).toEqual([before[0].id]);
  await page.locator('#calendar-entry-title').press('Enter');
  await expect.poll(async () => (await get(page, '/api/modules/schedule/entries')).items.map(item => ({ id: item.id, title: item.title })))
    .toEqual([{ id: before[0].id, title: '确认期间的新输入' }]);
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#calendar-entry-title')).toHaveValue('确认期间的新输入');
  await shot(page, info, 'legacy-pending-confirmed');
});
