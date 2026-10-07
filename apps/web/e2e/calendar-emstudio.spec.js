import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';

const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
const date = '2026-09-25';
let world, client, pageErrors;
const content = (title, time = '01:10') => ({ title, items: [], time: { date, startTime: time, durationMinutes: 70, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, lessonId: null, recordIds: [] }, reminder: null, calendar: { allDay: false, notes: '', tags: [] } });
async function call(method, url, body) {
  const result = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(result.status, JSON.stringify(result.json)).toBeLessThan(300);
  return result.json;
}
async function entries() { return (await call('GET', E)).items; }
async function saved(title) { return (await entries()).find(x => x.title === title); }
async function closeEditor(page) { await page.getByRole('button', { name: '关闭任务', exact: true }).click(); await expect(page.locator('.cal-editor')).toHaveCount(0); }
async function view(page, name) { await page.getByRole('button', { name: '日历视图', exact: true }).click(); await page.getByRole('menuitemradio', { name: new RegExp(`^${name}\\s`) }).click(); }
async function capture(page, name) {
  const dir = path.resolve('test-results/calendar-visual'); fs.mkdirSync(dir, { recursive: true });
  await page.mouse.move(280, 80);
  await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-25T06:00:00Z'));
  pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-e2e-')), workbenchClock: () => new Date('2026-09-25T06:00:00Z') });
  ({ client } = await registerMath(world, 'calendar@example.test'));
  const work = await call('POST', L, { name: '工作', color: '#ff6b75' });
  const study = await call('POST', L, { name: '学习', color: '#3edc81' });
  await call('POST', E, { ...content('上课'), calendar: { allDay: false, notes: '你好', tags: [work.id] } });
  await call('POST', E, { ...content('学习函数', '02:50'), time: { ...content('').time, startTime: '02:50', durationMinutes: 45 }, calendar: { allDay: false, notes: '', tags: [study.id] } });
  await page.goto(world.origin);
  await page.getByLabel('邮箱', { exact: true }).fill('calendar@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('.cal-loading')).toHaveCount(0);
  await expect(page.locator('.cal-page')).toBeVisible();
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world?.close();
  if (info.status === info.expectedStatus && !pageErrors.length) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(pageErrors).toEqual([]);
});

test('月历实际拖选、日周月视图、任务样式与独立滚动', async ({ page }) => {
  await capture(page, 'initial');
  const start = await page.locator('.cal-mini [data-date="2026-09-24"]').boundingBox();
  const end = await page.locator('.cal-mini [data-date="2026-09-27"]').boundingBox();
  await page.mouse.move(start.x + 18, start.y + 18); await page.mouse.down();
  await page.mouse.move(end.x + 18, end.y + 18, { steps: 20 }); await page.mouse.up();
  await expect(page.getByRole('button', { name: '日历视图', exact: true })).toHaveText('4 天');
  await expect(page.locator('.fc-col-header-cell')).toHaveCount(4);
  await capture(page, 'date-range');
  await page.reload(); await expect(page.locator('.fc-col-header-cell')).toHaveCount(4);
  await view(page, '月'); await expect(page.locator('.cal-grid-wrap.is-month')).toBeVisible();
  await expect.poll(() => page.locator('.is-month').evaluate(node => node.scrollTop)).toBeGreaterThan(250);
  await capture(page, 'month');
  const monthGrid = page.locator('.cal-grid-wrap.is-month');
  await monthGrid.hover(); await page.mouse.wheel(0, 800);
  await expect(page.locator('.cal-toolbar h1')).toContainText('十月');
  const monthTop = await monthGrid.evaluate(node => node.scrollTop);
  await page.reload();
  await expect(page.locator('.cal-toolbar h1')).toContainText('十月');
  await expect.poll(() => monthGrid.evaluate((node, top) => Math.abs(node.scrollTop - top), monthTop)).toBeLessThan(2);
  const last = await page.locator('.fc-daygrid-day').last().getAttribute('data-date');
  await page.mouse.wheel(0, 1800);
  await expect.poll(() => page.locator('.fc-daygrid-day').last().getAttribute('data-date')).not.toBe(last);
  await page.getByRole('button', { name: '今天', exact: true }).click();
  await expect(page.locator('.cal-toolbar h1')).toContainText('九月');
  await view(page, '周'); await expect(page.locator('.fc-col-header-cell')).toHaveCount(7);
  await view(page, '日'); await expect(page.locator('.fc-col-header-cell')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('直接拖动任务和拉伸结束时间保持真实数据', async ({ page }) => {
  await view(page, '日');
  const event = page.locator('.fc-timegrid-event').filter({ hasText: '上课' });
  const rect = await event.boundingBox();
  await page.mouse.move(rect.x + 40, rect.y + 25); await page.mouse.down();
  await page.mouse.move(rect.x + 40, rect.y + 129, { steps: 20 }); await page.mouse.up();
  await expect.poll(async () => (await saved('上课')).time.startTime).toBe('02:10');
  await expect(event).toContainText('2:10');
  await event.locator('.fc-event-resizer-end').hover({ position: { x: 15, y: 4 } });
  const handle = await event.locator('.fc-event-resizer-end').boundingBox();
  await page.mouse.move(handle.x + 15, handle.y + 4); await page.mouse.down();
  await page.mouse.move(handle.x + 15, handle.y + 56, { steps: 20 }); await page.mouse.up();
  await expect.poll(async () => (await saved('上课')).time.durationMinutes).toBe(100);
  expect((await saved('学习函数')).time.startTime).toBe('02:50');
  await page.reload(); await expect(event).toContainText('2:10');
});

test('保存响应中断时保留原请求和后续输入，刷新后重试只创建一次', async ({ page }) => {
  await page.route(`**${E}`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch(); await route.abort('failed');
  });
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('断网前标题');
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.locator('[name=entry-title]').fill('恢复后的标题');
  await page.reload();
  await expect(page.locator('[name=entry-title]')).toHaveValue('恢复后的标题');
  await page.unroute(`**${E}`);
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect.poll(async () => Boolean(await saved('恢复后的标题'))).toBeTruthy();
  expect((await entries()).filter(x => /断网前|恢复后/.test(x.title))).toHaveLength(1);
});

test('冲突保留输入且显式保存，窄屏可编辑和返回相邻模块', async ({ page }) => {
  await page.locator('.cal-upcoming-row').filter({ hasText: '上课' }).click();
  const task = await saved('上课');
  await call('PUT', `${E}/${task.id}`, { ...content('另一窗口的修改'), expectedVersion: task.version });
  await page.locator('[name=entry-title]').fill('保留我的输入');
  await expect(page.getByRole('button', { name: '读取最新版本', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '读取最新版本', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('保留我的输入');
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('仍需确认保存');
  expect((await call('GET', `${E}/${task.id}`)).title).toBe('另一窗口的修改');
  await page.getByRole('button', { name: '重新保存', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).title).toBe('保留我的输入');
  await closeEditor(page);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole('button', { name: '打开月份与任务', exact: true }).click();
  await page.locator('.cal-upcoming-row').filter({ hasText: '学习函数' }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('学习函数');
  await capture(page, 'tablet');
  await closeEditor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开月份与任务', exact: true }).click();
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('手机日程');
  await expect.poll(async () => Boolean(await saved('手机日程'))).toBeTruthy();
  await capture(page, 'mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await closeEditor(page);
  await page.setViewportSize({ width: 1675, height: 858 });
  await page.getByRole('link', { name: /^题库。/ }).click();
  await expect(page.locator('.cal-page')).toHaveCount(0);
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('.cal-page')).toBeVisible();
  await expect(page.locator('.cal-upcoming-row').filter({ hasText: '手机日程' })).toBeVisible();
});

test('拖选时间、自动保存、标签与备注、刷新和删除', async ({ page }) => {
  await view(page, '日');
  const slot = page.locator('.fc-timegrid-slot-lane[data-time="09:00:00"]');
  await slot.scrollIntoViewIfNeeded();
  const box = await slot.boundingBox();
  await page.mouse.move(box.x + 110, box.y + 2); await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 104, { steps: 18 }); await page.mouse.up();
  await expect(page.locator('[name=entry-start]')).toHaveValue('09:00');
  await page.locator('[name=entry-title]').fill('课堂准备');
  await expect.poll(async () => Boolean(await saved('课堂准备'))).toBeTruthy();
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('讲清函数的定义\n准备两个例子');
  await page.getByRole('button', { name: '标签', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: '学习', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await saved('课堂准备'))?.calendar.notes).toContain('准备两个例子');
  await expect.poll(async () => (await saved('课堂准备'))?.calendar.tags.length).toBe(1);
  await capture(page, 'editor');
  await page.reload(); await expect(page.locator('[name=entry-title]')).toHaveValue('课堂准备');
  await expect(page.getByRole('textbox', { name: '备注', exact: true })).toContainText('准备两个例子');
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '删除任务', exact: true }).click();
  await page.getByRole('dialog', { name: '删除任务', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect.poll(async () => Boolean(await saved('课堂准备'))).toBeFalsy();
});

test('全天、重复规则、单次改动和自建标签真实保存', async ({ page }) => {
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('工作日备课');
  await expect.poll(async () => Boolean(await saved('工作日备课'))).toBeTruthy();
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: '全天', exact: true }).click();
  await expect.poll(async () => (await saved('工作日备课'))?.calendar.allDay).toBeTruthy();
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '重复', exact: true }).hover();
  await page.getByRole('menuitem', { name: '每个工作日', exact: true }).click();
  await expect.poll(async () => (await saved('工作日备课'))?.repeat?.frequency).toBe('weekly');
  await page.getByRole('button', { name: '标签', exact: true }).click();
  await page.getByRole('menuitem', { name: '+ 创建标签', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '创建标签', exact: true });
  await modal.getByLabel('标签名称', { exact: true }).fill('教学');
  await modal.getByRole('button', { name: '颜色 #5b9cf5', exact: true }).click();
  await modal.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('dialog', { name: '编辑重复任务', exact: true }).getByRole('button', { name: '所有重复任务', exact: true }).click();
  await expect.poll(async () => (await saved('工作日备课'))?.calendar.tags.length).toBe(1);
  await capture(page, 'repeat');
  await closeEditor(page);
  const task = await saved('工作日备课');
  await page.goto(`${world.origin}/calendar?entry=${task.id}&on=2026-09-28`);
  await expect(page.locator('[name=entry-title]')).toHaveValue('工作日备课');
  await page.locator('[name=entry-title]').fill('周一调整');
  await page.getByRole('dialog', { name: '编辑重复任务', exact: true }).getByRole('button', { name: '仅此任务', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-28`)).title).toBe('周一调整');
  expect((await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-29`)).title).toBe('工作日备课');
});

test('自定义重复次数、标签改名删除和跨月日期段', async ({ page }) => {
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('隔周教研');
  await expect.poll(async () => Boolean(await saved('隔周教研'))).toBeTruthy();
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '重复', exact: true }).hover();
  await page.getByRole('menuitem', { name: '自定义…', exact: true }).click();
  const rule = page.getByRole('dialog', { name: '重复', exact: true });
  await rule.getByLabel('重复间隔', { exact: true }).fill('2');
  await rule.getByRole('button', { name: '周二', exact: true }).click();
  await rule.getByRole('radio', { name: /次数/ }).check();
  await rule.getByLabel('重复次数', { exact: true }).fill('3');
  await rule.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await saved('隔周教研'))?.repeat?.count).toBe(3);
  const task = await saved('隔周教研');
  const occurrences = await call('GET', '/api/modules/schedule/occurrences?from=2026-09-25&to=2026-11-01');
  expect(occurrences.items.filter(x => x.key.entryId === task.id).map(x => x.time.date)).toEqual(['2026-09-25', '2026-10-06', '2026-10-09']);
  await page.getByRole('button', { name: '标签', exact: true }).click();
  await page.getByRole('button', { name: '编辑标签 工作', exact: true }).click();
  let label = page.getByRole('dialog', { name: '编辑标签', exact: true });
  await label.getByLabel('标签名称', { exact: true }).fill('课堂');
  await label.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '标签', exact: true }).click();
  await page.getByRole('button', { name: '编辑标签 课堂', exact: true }).click();
  label = page.getByRole('dialog', { name: '编辑标签', exact: true });
  await label.getByRole('button', { name: '删除标签', exact: true }).click();
  await expect.poll(async () => (await call('GET', L)).items.map(x => x.name)).toEqual(['学习']);
  await closeEditor(page);
  const start = await page.locator('.cal-mini [data-date="2026-09-29"]').boundingBox();
  const end = await page.locator('.cal-mini [data-date="2026-10-04"]').boundingBox();
  await page.mouse.move(start.x + 18, start.y + 18); await page.mouse.down();
  await page.mouse.move(end.x + 18, end.y + 18, { steps: 18 }); await page.mouse.up();
  await expect(page.getByRole('button', { name: '日历视图', exact: true })).toHaveText('6 天');
  await expect(page.locator('.fc-col-header-cell')).toHaveCount(6);
});
