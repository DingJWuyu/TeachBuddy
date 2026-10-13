import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startTeachingAuth } from './service.mjs';
import { register, login, track, headers } from './helpers.mjs';


let dataDir;
const evidence = path.resolve(process.env.T53_AUTH_EVIDENCE || 'test-results/t53-auth/evidence', 'flows');
const origin = 'https://127.0.0.1:49653';
const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
let runner;
let now;
const input = {
  title: '函数单调性课程', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: { side: 'before', minutes: 10 }
};
const emptyDoc = { version: 1, blocks: [] };
async function start() {
  runner = await startTeachingAuth({ directory: dataDir, port: 49653, now: () => now });
}
async function stop() { if (runner) { await runner.close(); runner = null; } }
async function write(page, url, body, method = 'POST') {
  const response = await page.request.fetch(`${origin}${url}`, {
    method, data: body, headers: { ...headers(page), Origin: origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() }
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function read(page, url) { const response = await page.request.get(`${origin}${url}`, { headers: headers(page) }); expect(response.ok()).toBeTruthy(); return response.json(); }
async function shot(page, name) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true, animations: 'disabled' });
}
async function notifications(page) { await page.getByRole('button', { name: /^通知/ }).click(); return page.locator('[data-region="notifications"]'); }

test.use({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'off' });
test.beforeAll(() => {
  fs.mkdirSync(evidence, { recursive: true });
});
test.beforeEach(async ({ page }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't53-auth-flow-'));
  now = '2026-09-21T06:00:00.000Z';
  await start();
  await register(page, runner);
});
test.afterEach(async ({}, info) => {
  if (fs.existsSync(path.join(dataDir, 'logs'))) fs.cpSync(path.join(dataDir, 'logs'), path.join(evidence, 'logs', String(info.testId).replace(/[^a-z0-9]/gi, '-')), { recursive: true });
  await stop();
});

test('WB-T012/014/015: close browser, stop API, reopen original reminder and dismiss without regeneration', async ({ page, browser }) => {
  const entry = await write(page, entries, input);
  await page.goto('/');
  await expect(page.getByRole('link', { name: '日程', exact: true })).toHaveCount(1);
  await page.close();
  await stop();
  now = '2026-09-21T09:00:00.000Z';
  await start();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const reopened = await context.newPage();
  track(reopened);
  await reopened.goto(origin);
  await login(reopened);
  await reopened.getByRole('button', { name: '知道了', exact: true }).click();
  await reopened.getByRole('button', { name: '通知', exact: true }).click();
  const panel = reopened.getByRole('dialog', { name: '通知', exact: true });
  await expect(panel.locator('.tb-notification')).toHaveCount(1);
  await expect(panel.locator('.tb-row-meta')).toHaveText('9/21 16:20');
  const caught = await read(reopened, notices);
  expect(caught.items).toHaveLength(1);
  expect(caught.items[0].dueAt).toBe('2026-09-21T08:20:00Z');
  fs.writeFileSync(path.join(evidence, 'original-dueAt.json'), JSON.stringify(caught, null, 2));
  await shot(reopened, 'desktop-catch-up');
  await panel.getByRole('button', { name: /函数单调性课程/ }).click();
  await expect(reopened).toHaveURL(new RegExp(`entry=${entry.id}`));
  await expect(reopened.locator('[name="entry-title"]')).toHaveValue(input.title);
  await expect(reopened.locator('[name="entry-date"]')).toHaveValue('2026-09-21');
  await expect(reopened.locator('[name="entry-start"]')).toHaveValue('15:00');
  await expect.poll(async () => (await read(reopened, notices)).unreadCount).toBe(0);
  expect((await read(reopened, `${entries}/${entry.id}`)).version).toBe(1);
  await shot(reopened, 'desktop-notification-target');
  await reopened.getByRole('button', { name: '通知', exact: true }).click();
  await expect(panel.locator('.tb-notification')).toHaveAttribute('draggable', 'true');
  await panel.locator('.tb-notification').dragTo(panel.locator('.tb-notification-trash'));
  await expect(panel.getByText('暂无通知', { exact: true })).toBeVisible();
  await expect.poll(async () => (await read(reopened, notices)).items.length).toBe(0);
  await shot(reopened, 'desktop-dismissed');
  await stop(); await start();
  await reopened.reload();
  await reopened.getByRole('button', { name: '通知', exact: true }).click();
  await expect(panel.locator('.tb-notification')).toHaveCount(0);
  await expect(panel.getByText('暂无通知', { exact: true })).toBeVisible();
  expect((await read(reopened, notices)).items).toHaveLength(0);
  expect((await read(reopened, `${entries}/${entry.id}`)).version).toBe(1);
  await shot(reopened, 'desktop-restarted-no-regeneration');
  await context.close();
});

test('WB-T010/015/016: moved occurrence opens actual date; read failure still opens; deleted and outside-series are explicit', async ({ page }) => {
  const series = await write(page, entries, { ...input, repeat: { until: '2026-10-05' } });
  const content = { ...input, time: { ...input.time, date: '2026-09-29', startTime: '16:00' } };
  delete content.repeat;
  await write(page, `${entries}/${series.id}/exceptions/2026-09-28`, { expectedVersion: 1, mode: 'override', content }, 'PUT');
  now = '2026-09-29T09:30:00.000Z';
  await page.goto('/');
  await login(page);
  await notifications(page);
  await expect(page.locator('[data-notification-id]')).toHaveCount(2);
  runner.workbench.db.pragma('query_only = ON');
  await page.locator('[data-notification-id]').first().click();
  await expect(page.locator('[name="entry-title"]')).toHaveValue(input.title);
  await expect(page.locator('[data-region="time-preview"]')).toContainText('2026-09-29 16:00');
  await expect(page.getByRole('alert')).toContainText('仍可打开安排');
  await expect.poll(() => page.locator('.sch-notification-error').evaluate(node => getComputedStyle(node).animationName)).toBe('wb-pop-in');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.locator('.sch-notification-error').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  runner.workbench.db.pragma('query_only = OFF');
  await shot(page, 'read-failure-target');
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect.poll(async () => (await read(page, notices)).unreadCount).toBe(1);
  await write(page, `${entries}/${series.id}`, { ...input, reminder: null, repeat: { until: '2026-09-21' }, expectedVersion: 2 }, 'PUT');
  await page.reload();
  await expect(page.getByText('这次已不在重复范围内', { exact: true })).toBeVisible();
  await shot(page, 'outside-series-target');
  await write(page, `${entries}/${series.id}/deletion`, { expectedVersion: 3, deleted: true });
  await page.reload();
  await expect(page.getByText('安排已删除', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '恢复安排', exact: true })).toBeVisible();
});


test('WB-T008: tablet navigation and notification selection preserve AI draft', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('保留讲课问题');
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('[data-region="schedule"]')).toBeVisible();
  await shot(page, 'tablet-schedule');
  const entry = await write(page, entries, input);
  now = '2026-09-21T09:00:00.000Z';
  await page.reload();
  await notifications(page);
  await shot(page, 'tablet-notifications');
  await page.locator('[data-notification-id]').click();
  await expect(page.locator('[name="entry-title"]')).toHaveValue(input.title);
  await shot(page, 'tablet-notification-target');
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('保留讲课问题');
  expect((await read(page, `${entries}/${entry.id}`)).version).toBe(1);
});

test('WB-T005: actual pointer selection in the integrated shell preserves AI and eleven-day range', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('拖选后仍保留');
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await page.getByRole('button', { name: 'AI 助理', exact: true }).first().click();
  await page.locator('[name="range-from"]').fill('2026-09-21');
  await page.locator('[name="range-to"]').fill('2026-10-01');
  await page.locator('[data-action="apply-range"]').click();
  await expect(page.locator('[data-region="range-label"]')).toContainText('11 天');
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('拖选后仍保留');
  const column = page.locator('[data-region="day-column"][data-day="2026-09-21"]');
  const start = await column.locator('[data-hour="15"]').boundingBox();
  const end = await column.locator('[data-hour="16"]').boundingBox();
  await page.mouse.move(start.x + 50, start.y + start.height / 12);
  await page.mouse.down();
  await page.mouse.move(end.x + 50, end.y + end.height * 35 / 60, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('[name="entry-duration"]')).toHaveValue('90');
  await expect(page.locator('[name="entry-date"]')).toHaveValue('2026-09-21');
  await shot(page, 'desktop-pointer-selection');
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('拖选后仍保留');
});

test('review: old notification opens a now-unscheduled entry and keeps the task accessible', async ({ page }) => {
  const body = { ...input };
  const entry = await write(page, entries, body);
  now = '2026-09-21T09:00:00.000Z';
  await read(page, notices);
  await write(page, `${entries}/${entry.id}`, { ...body, time: null, reminder: null, expectedVersion: 1 }, 'PUT');
  await page.goto('/');
  await notifications(page);
  await page.locator('[data-notification-id]').click();
  await expect(page.locator('[name="entry-title"]')).toHaveValue(input.title);
  await expect(page.locator('[data-region="course-feedback"]')).toHaveCount(0);
  await expect(page.getByText('实际记录', { exact: true })).toHaveCount(0);
  await shot(page, 'unscheduled-notification-target');
});
