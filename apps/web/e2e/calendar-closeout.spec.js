import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
let world, client, now, errors;
const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });
const content = value => Object.fromEntries(['title', 'items', 'time', 'repeat', 'reminder', 'course', 'calendar'].map(key => [key, value[key]]));
async function call(method, url, body) {
  const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
}
async function open(page, title) { await page.locator('.cal-upcoming-row').filter({ hasText: title }).click(); }
async function close(page) { await page.getByRole('button', { name: '关闭任务', exact: true }).click(); await expect(page.locator('.cal-editor')).toHaveCount(0); }
async function view(page, name) {
  await page.getByRole('button', { name: '日历视图', exact: true }).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}\\s`) }).click();
}
async function dragDates(page, from, to, cancel = false) {
  const a = await page.locator(`.cal-mini [data-date="${from}"]`).boundingBox();
  const b = await page.locator(`.cal-mini [data-date="${to}"]`).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}
test.beforeEach(async ({ page }, info) => {
  now = '2026-09-25T06:00:00Z';
  if (/快速连点|任务读取未完成/.test(info.title)) await page.clock.setFixedTime(new Date(now));
  else await page.clock.install({ time: new Date(now) });
  errors = []; page.on('pageerror', e => errors.push(e.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-closeout-')), workbenchClock: () => new Date(now) });
  ({ client } = await registerMath(world, 'schedule-closeout@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-closeout@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.cal-page')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.locator('.cal-loading')).toHaveCount(0);
});
test.afterEach(async ({ context }, info) => {
  const failed = info.status !== info.expectedStatus || errors.length;
  if (failed) {
    const data = { test: info.title, directory: world.directory, origin: world.origin, time: now, pageErrors: errors, entries: (await call('GET', E)).items };
    fs.writeFileSync(info.outputPath('preserved-case.json'), JSON.stringify(data, null, 2));
  }
  await context.close(); await world.close();
  if (!failed) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(errors).toEqual([]);
});

test('页面跨午夜更新今天、时间线和即将到来，跨夜进行中的任务保留', async ({ page }) => {
  await call('POST', E, entry('跨夜进行中', { time: { ...entry('').time, startTime: '23:50', durationMinutes: 20 } }));
  await call('POST', E, entry('午夜结束', { time: { ...entry('').time, startTime: '23:40', durationMinutes: 20 } }));
  await call('POST', E, entry('次日安排', { time: { ...entry('').time, date: '2026-09-26', startTime: '00:20' } }));
  now = '2026-09-25T15:59:30Z'; await page.clock.setSystemTime(new Date(now)); await page.reload();
  const upcoming = page.getByRole('region', { name: '即将到来', exact: true });
  await expect(upcoming.locator('.cal-upcoming-title')).toHaveText(['午夜结束', '跨夜进行中']);
  now = '2026-09-25T16:00:30Z'; await page.clock.runFor(60000);
  await expect(page.locator('.cal-mini button.is-today')).toHaveAttribute('data-date', '2026-09-26');
  await expect(upcoming.locator('.cal-upcoming-title')).toHaveText(['跨夜进行中', '次日安排']);
  const line = page.locator('.fc-timegrid-now-indicator-line').first();
  await expect(line).toBeAttached();
  expect(await line.evaluate(el => parseFloat(el.style.top))).toBeLessThan(5);
});

test('跨夜任务换日期和视图仍选中正确任务，结束时间跨日保存读回', async ({ page }) => {
  const task = await call('POST', E, entry('夜间整理', { time: { ...entry('').time, startTime: '23:50', durationMinutes: 20 } }));
  await page.reload(); await open(page, task.title);
  await expect(page.locator('.fc-timegrid-event.is-selected')).toHaveCount(2);
  await page.locator('.cal-mini [data-date="2026-09-26"]').click(); await view(page, '日');
  await expect(page.locator('.fc-timegrid-event.is-selected')).toHaveCount(1);
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-09-25');
  await expect(page.locator('[name=entry-end-date]')).toHaveValue('2026-09-26');
  await page.locator('[name=entry-end]').fill('00:15');
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).time.durationMinutes).toBe(25);
  await view(page, '月'); await expect(page.locator('.fc-daygrid-event.is-selected')).toHaveCount(1);
  await expect(page.locator('.cal-selected-day[data-date="2026-09-25"]')).toHaveCount(1);
  await expect(page.locator('.cal-selected-day[data-date="2026-09-26"]')).toHaveCount(1);
  await close(page); await page.reload();
  expect((await call('GET', `${E}/${task.id}`)).time).toEqual({ ...task.time, durationMinutes: 25 });
});

test('小月历只翻月不改主视图，跨年正反拖选及Escape取消一致', async ({ page }) => {
  const before = await page.locator('.fc-col-header-cell[data-date]').evaluateAll(nodes => nodes.map(n => n.dataset.date));
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '下个月', exact: true }).click();
  expect(await page.locator('.fc-col-header-cell[data-date]').evaluateAll(nodes => nodes.map(n => n.dataset.date))).toEqual(before);
  await dragDates(page, '2026-12-30', '2027-01-03');
  await expect(page.locator('.fc-col-header-cell[data-date]')).toHaveCount(5);
  await expect(page.locator('.fc-col-header-cell[data-date]').first()).toHaveAttribute('data-date', '2026-12-30');
  await expect(page.locator('.fc-col-header-cell[data-date]').last()).toHaveAttribute('data-date', '2027-01-03');
  await dragDates(page, '2027-01-03', '2026-12-30');
  await expect(page.locator('.fc-col-header-cell[data-date]')).toHaveCount(5);
  await dragDates(page, '2026-12-28', '2027-01-02', true);
  await expect(page.locator('.fc-col-header-cell[data-date]').first()).toHaveAttribute('data-date', '2026-12-30');
  expect((await call('GET', E)).items).toHaveLength(0);
});

test('快速连点任务遇到读取响应乱序时，以最后点击的任务为准', async ({ page }) => {
  const a = await call('POST', E, entry('先点的任务'));
  const b = await call('POST', E, entry('最后点的任务', { time: { ...entry('').time, startTime: '16:00' } }));
  await page.reload();
  let release, hit;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { hit = resolve; });
  await page.route(`**${E}/${a.id}`, async route => { if (route.request().method() !== 'GET') return route.continue(); hit(); await gate; await route.continue(); });
  await open(page, a.title); await started; await open(page, b.title);
  await expect(page.locator('[name=entry-title]')).toHaveValue(b.title);
  const response = page.waitForResponse(r => r.url().endsWith(`${E}/${a.id}`));
  release(); await (await response).finished(); await page.waitForTimeout(250);
  await expect(page.locator('[name=entry-title]')).toHaveValue(b.title);
});

test('保存响应延迟时跨日换视图和继续输入，最新内容保留且只保存同一任务', async ({ page }) => {
  const task = await call('POST', E, entry('连续编辑'));
  await page.reload(); await open(page, task.title);
  let release, hit; let intercept = true;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { hit = resolve; });
  await page.route(`**${E}/${task.id}`, async route => {
    if (route.request().method() !== 'PUT' || !intercept) return route.continue();
    intercept = false; hit(); await gate; const result = await route.fetch(); await route.fulfill({ response: result });
  });
  await page.locator('[name=entry-title]').fill('第一版'); await started;
  await page.locator('[name=entry-title]').fill('最终标题');
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('等待响应时继续输入');
  await page.locator('.cal-mini [data-date="2026-09-26"]').click(); await view(page, '月');
  release();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).calendar.notes).toBe('等待响应时继续输入');
  await expect(page.locator('[name=entry-title]')).toHaveValue('最终标题');
  await close(page); await page.reload();
  const saved = await call('GET', E); expect(saved.items).toHaveLength(1); expect(saved.items[0].title).toBe('最终标题');
});

test('多标签、无标签、长标题在两种列表中保持分类、计数和滚动', async ({ page }) => {
  const a = await call('POST', L, { name: '教学', color: '#ff6b75' });
  const b = await call('POST', L, { name: '个人', color: '#3edc81' });
  const long = '检查很长的标题是否仍然完整保存，列表里应截断显示'.repeat(8);
  await call('POST', E, entry(long, { time: null, calendar: { allDay: false, notes: '第一行\n第二行', tags: [a.id, b.id] } }));
  await call('POST', E, entry('无标签待安排', { time: null }));
  await call('POST', E, entry('今天未来的任务', { calendar: { allDay: false, notes: '', tags: [a.id, b.id] } }));
  await call('POST', E, entry('已经结束', { time: { ...entry('').time, startTime: '10:00' } }));
  await call('POST', E, entry('未来日期', { time: { ...entry('').time, date: '2026-09-26' } }));
  await page.reload();
  const pending = page.getByRole('region', { name: '待安排', exact: true });
  const upcoming = page.getByRole('region', { name: '即将到来', exact: true });
  await expect(pending.locator('h2')).toHaveText('待安排(2)'); await expect(upcoming.locator('h2')).toHaveText('即将到来(1)');
  await pending.getByRole('button', { name: '待安排：按标签分组', exact: true }).click();
  await upcoming.getByRole('button', { name: '按标签分组', exact: true }).click();
  await expect.poll(async () => (await pending.locator('.cal-group-name').allTextContents()).sort()).toEqual(['个人', '教学', '无标签'].sort());
  await expect(upcoming.locator('.cal-upcoming-row')).toHaveCount(2);
  expect(await page.locator('.cal-upcoming').evaluate(el => getComputedStyle(el).scrollbarWidth)).toBe('none');
  await pending.locator('.cal-upcoming-row').first().click();
  await expect(page.locator('[name=entry-title]')).toHaveValue(long);
  await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveText('第一行\n第二行');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('最大事项数量禁用添加，键盘排序保存后允许删除并继续添加', async ({ page }) => {
  const items = Array.from({ length: 200 }, (_, index) => ({ id: randomUUID(), text: `事项${index + 1}`, priority: 'normal' }));
  const task = await call('POST', E, entry('事项上限', { time: null, items }));
  await page.reload(); await open(page, task.title);
  await expect(page.getByRole('button', { name: '添加事项', exact: true })).toBeDisabled();
  await page.locator('.cal-item-bullet').last().focus(); await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).items[198].text).toBe('事项200');
  await page.getByRole('button', { name: '事项 200 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '删除事项', exact: true }).click();
  await expect(page.getByRole('button', { name: '添加事项', exact: true })).toBeEnabled();
  await close(page); expect((await call('GET', `${E}/${task.id}`)).items).toHaveLength(199);
});

test('无效结束时间不保存，修正后可继续关闭且不会丢失备注', async ({ page }) => {
  const task = await call('POST', E, entry('时间校验'));
  await page.reload(); await open(page, task.title);
  await page.locator('[name=entry-end]').fill('14:00');
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('修正后保留');
  await expect(page.locator('.cal-time-error')).toContainText('时间无效');
  expect((await call('GET', `${E}/${task.id}`)).version).toBe(task.version);
  await page.locator('[name=entry-end]').fill('15:45'); await close(page); await page.reload();
  const saved = await call('GET', `${E}/${task.id}`); expect(saved.time.durationMinutes).toBe(45); expect(saved.calendar.notes).toBe('修正后保留');
});

test('任务读取未完成时点空白取消，晚到响应不重新打开任务', async ({ page }) => {
  const task = await call('POST', E, entry('已取消打开的任务'));
  await page.reload();
  let release, hit;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { hit = resolve; });
  await page.route(`**${E}/${task.id}`, async route => { if (route.request().method() !== 'GET') return route.continue(); hit(); await gate; await route.continue(); });
  await open(page, task.title); await started;
  const cell = page.locator('.fc-timegrid-slot-lane[data-time="01:00:00"]');
  await cell.scrollIntoViewIfNeeded(); const box = await cell.boundingBox();
  await page.mouse.click(box.x + 20, box.y + 5);
  const response = page.waitForResponse(r => r.url().endsWith(`${E}/${task.id}`));
  release(); await (await response).finished(); await page.waitForTimeout(250);
  await expect(page.locator('.cal-editor')).toHaveCount(0);
});

test('月视图窗口缩小和放大时，任务与更多入口不越过日期格', async ({ page }) => {
  for (let index = 0; index < 6; index++) await call('POST', E, entry(`折叠任务${index + 1}`, { time: { ...entry('').time, startTime: `15:${String(index * 5).padStart(2, '0')}`, durationMinutes: 5 } }));
  await page.reload(); await view(page, '月');
  const day = page.locator('.fc-daygrid-day[data-date="2026-09-25"]');
  await day.scrollIntoViewIfNeeded();
  for (const height of [550, 950]) {
    await page.setViewportSize({ width: 1675, height });
    await expect(day.locator('.fc-daygrid-more-link')).toBeVisible();
    await expect.poll(() => day.evaluate(el => {
      const frame = el.querySelector('.fc-daygrid-day-frame').getBoundingClientRect();
      return [...el.querySelectorAll('.fc-daygrid-event, .fc-daygrid-more-link')].filter(n => n.getClientRects().length && getComputedStyle(n.closest('.fc-daygrid-event-harness') ?? n).visibility !== 'hidden').every(n => n.getBoundingClientRect().bottom <= frame.bottom + 1);
    })).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});
