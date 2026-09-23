import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startFirstFlowRunner } from '../../../scripts/first-flow/lib/runner.mjs';
import { bootstrapPrincipal } from './fixtures/first-flow/identity.js';

const root = process.cwd();
const dataDir = path.join(root, 'test-results/teaching-time/t53');
const evidence = path.join(root, 'test-results/evidence/T53/v1');
const origin = 'https://localhost:47153';
const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
let runner;
let now;
const input = {
  title: '函数单调性课程', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, lessonId: null, recordIds: [] }, reminder: { side: 'before', minutes: 10 }
};
const emptyDoc = { version: 1, blocks: [] };
async function start(reset = false) {
  runner = await startFirstFlowRunner({ dataDir, port: 47153, fixtures: [], web: 'auto', reset, quiet: true, clock: () => new Date(now) });
}
async function stop() { if (runner) { await runner.close(); runner = null; } }
async function write(page, url, body, method = 'POST') {
  const response = await page.request.fetch(`${origin}${url}`, {
    method, data: body, headers: { Origin: origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() }
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function read(page, url) { const response = await page.request.get(`${origin}${url}`); expect(response.ok()).toBeTruthy(); return response.json(); }
async function shot(page, name) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true, animations: 'disabled' });
}
async function notifications(page) { await page.getByRole('button', { name: /^通知/ }).click(); return page.locator('[data-region="notifications"]'); }

test.use({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, trace: 'on' });
test.beforeAll(() => {
  fs.mkdirSync(evidence, { recursive: true });
  execFileSync('npm', ['run', 'build:web'], { cwd: root, stdio: 'pipe', env: { ...process.env, VITE_API_BASE_URL: '/api' } });
});
test.beforeEach(async ({ context }) => {
  now = '2026-09-21T06:00:00.000Z';
  await start(true);
  await bootstrapPrincipal(context, 'fixture-teacher-a', { origin, dataDir });
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
  await bootstrapPrincipal(context, 'fixture-teacher-a', { origin, dataDir });
  const reopened = await context.newPage();
  await reopened.goto(origin);
  const panel = await notifications(reopened);
  await expect(panel.locator('[data-notification-id]')).toHaveCount(1);
  await expect(panel.locator('time')).toHaveAttribute('datetime', '2026-09-21T08:20:00Z');
  await shot(reopened, 'desktop-catch-up');
  await panel.getByRole('button', { name: /函数单调性课程/ }).click();
  await expect(reopened).toHaveURL(new RegExp(`entry=${entry.id}`));
  await expect(reopened.locator('[name="entry-title"]')).toHaveValue(input.title);
  await expect(reopened.locator('[data-region="time-preview"]')).toContainText('2026-09-21 15:00');
  await expect.poll(async () => (await read(reopened, notices)).unreadCount).toBe(0);
  expect((await read(reopened, `${entries}/${entry.id}`)).version).toBe(1);
  await shot(reopened, 'desktop-notification-target');
  await notifications(reopened);
  await reopened.getByRole('button', { name: '清空', exact: true }).click();
  await expect(reopened.getByText('暂无通知', { exact: true })).toBeVisible();
  await stop(); await start();
  await reopened.reload();
  await notifications(reopened);
  await expect(reopened.locator('[data-notification-id]')).toHaveCount(0);
  await context.close();
});

test('WB-T010/015/016: moved occurrence opens actual date; read failure still opens; deleted and outside-series are explicit', async ({ page }) => {
  const series = await write(page, entries, { ...input, repeat: { until: '2026-10-05' } });
  const content = { ...input, time: { ...input.time, date: '2026-09-29', startTime: '16:00' } };
  delete content.repeat;
  await write(page, `${entries}/${series.id}/exceptions/2026-09-28`, { expectedVersion: 1, mode: 'override', content }, 'PUT');
  now = '2026-09-29T09:30:00.000Z';
  await page.goto('/');
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

test('WB-T003/004/017: real class and lesson feedback, separate linking failure and retry after committed response loss', async ({ page }) => {
  const classroom = await write(page, '/api/modules/classes/items', { name: '高一(1)班' });
  const lesson = await write(page, '/api/modules/lessons/items', { title: '函数单调性', intro: emptyDoc, sections: [], materials: [] });
  const entry = await write(page, entries, { ...input, course: { classId: classroom.id, lessonId: lesson.id, recordIds: [] } });
  await page.goto(`/calendar?entry=${entry.id}`);
  await page.getByRole('button', { name: '记课后情况' }).click();
  await page.getByRole('textbox', { name: '写一句', exact: true }).fill('例2没讲，任意性还需强调');
  await page.locator('[data-region="record-composer"]').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('记录已保存，尚未关联安排', { exact: true })).toBeVisible();
  let dropped = false;
  await page.route(`**${entries}/${entry.id}`, async route => {
    if (route.request().method() === 'PUT' && !dropped) { dropped = true; await route.fetch(); await route.abort(); }
    else await route.continue();
  });
  await page.getByRole('button', { name: '关联回本次安排' }).click();
  await expect(page.getByRole('button', { name: '重试关联' })).toBeVisible();
  await shot(page, 'link-unconfirmed');
  const saved = await read(page, `/api/modules/classes/records?classId=${classroom.id}`);
  expect(saved.items).toHaveLength(1);
  await stop(); await start();
  await page.getByRole('button', { name: '重试关联' }).click();
  await expect(page.getByText('记录已保存并关联安排', { exact: true })).toBeVisible();
  expect((await read(page, `${entries}/${entry.id}`)).course.recordIds).toEqual([saved.items[0].id]);
  expect((await read(page, `/api/modules/classes/records?classId=${classroom.id}`)).items).toHaveLength(1);
  await page.goto(`/lessons/${lesson.id}`);
  if (await page.getByRole('button', { name: 'AI 助理', exact: true }).count()) await page.getByRole('button', { name: 'AI 助理', exact: true }).first().click();
  await page.getByRole('tab', { name: '班级反馈', exact: true }).click();
  await expect(page.locator('[data-region="source-records-panel"]')).toContainText('例2没讲');
  await shot(page, 'lesson-feedback');
  await page.locator('[data-source-record-id]').click();
  await expect(page).toHaveURL(new RegExp(`/classes/${classroom.id}/records/`));
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

test('WB-T001/002/003/019: two real classes keep feedback separate and source round-trip preserves lesson draft', async ({ page }) => {
  const c1 = await write(page, '/api/modules/classes/items', { name: '高一(1)班' });
  const c2 = await write(page, '/api/modules/classes/items', { name: '高一(2)班' });
  const lesson = await write(page, '/api/modules/lessons/items', { title: '共用备课', intro: emptyDoc, sections: [], materials: [] });
  const q = await write(page, '/api/modules/questions/items', {
    title: '共用题目', body: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '证明单调性' }] }] },
    solution: emptyDoc, note: '', starred: false, source: { kind: 'manual' }
  });
  const records = [];
  for (const [c, note] of [[c1, '一班需要强调任意性'], [c2, '二班已讲例2']]) {
    records.push(await write(page, '/api/modules/classes/records', {
      classId: c.id, recordedOn: '2026-09-21', note, position: '函数单调性', unfinished: '', commonIssues: '', nextNote: '',
      sources: [{ kind: 'lesson', id: lesson.id }, { kind: 'question', id: q.id }]
    }));
  }
  await page.goto(`/classes/${c1.id}`);
  await page.getByRole('textbox', { name: '写一句', exact: true }).fill('一句话真实保存');
  await page.locator('[data-region="record-composer"]').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('一句话真实保存', { exact: true })).toBeVisible();
  await stop(); await start(); await page.reload();
  await expect(page.getByText('一句话真实保存', { exact: true })).toBeVisible();
  await shot(page, 'classes-real-records');
  await page.goto(`/lessons/${lesson.id}`);
  await page.locator('input[aria-label="课题"]').fill('尚未保存的备课草稿');
  await page.getByRole('button', { name: 'AI 助理', exact: true }).first().click();
  await page.getByRole('tab', { name: '班级反馈', exact: true }).click();
  await expect(page.locator('[data-source-record-id]')).toHaveCount(2);
  await page.locator(`[data-source-record-id="${records[0].id}"]`).click();
  await expect(page).toHaveURL(new RegExp(records[0].id));
  await page.goBack();
  await expect(page.locator('input[aria-label="课题"]')).toHaveValue('尚未保存的备课草稿');
  await page.goto(`/questions/${q.id}`);
  await page.getByRole('tab', { name: '班级反馈', exact: true }).click();
  await expect(page.locator('[data-source-record-id]')).toHaveCount(2);
  await shot(page, 'question-two-class-feedback');
  await write(page, `/api/modules/classes/records/${records[0].id}/deletion`, { expectedVersion: 1, deleted: true });
  await page.reload();
  await expect(page.locator('[data-source-record-id]')).toHaveCount(1);
  await expect(page.locator('[data-region="source-records-panel"]')).toContainText('二班已讲例2');
  await write(page, `/api/modules/classes/records/${records[0].id}/deletion`, { expectedVersion: 2, deleted: false });
  await page.reload();
  await expect(page.locator('[data-source-record-id]')).toHaveCount(2);
});

test('review: class timezone network failure is explicit and recoverable', async ({ page }) => {
  await page.route('**/api/modules/schedule/settings', route => route.abort());
  await page.goto('/classes');
  await expect(page.getByRole('alert')).toContainText('时区读取失败');
  await shot(page, 'timezone-read-failure');
  await page.unroute('**/api/modules/schedule/settings');
  await page.getByRole('button', { name: '重试读取时区' }).click();
  await expect(page.getByRole('button', { name: '新建班级', exact: true })).toBeVisible();
});

test('review: old notification opens a now-unscheduled entry without impossible record linking', async ({ page }) => {
  const classroom = await write(page, '/api/modules/classes/items', { name: '高一(1)班' });
  const body = { ...input, course: { classId: classroom.id, lessonId: null, recordIds: [] } };
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
