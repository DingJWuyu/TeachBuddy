import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';

const E = '/api/modules/schedule/entries';
const N = '/api/modules/schedule/notifications';
let world, client, now, pageErrors;
const input = (title, extra = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 60, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, calendar: { allDay: false, notes: '', tags: [] }, ...extra });
async function call(method, url, body) {
  const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
}
async function saved(title) { return (await call('GET', E)).items.find(x => x.title === title); }
async function login(page, email = 'schedule-capabilities@example.test') {
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.cal-page')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.locator('.cal-loading')).toHaveCount(0);
}
async function action(page, name) {
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
async function close(page) { await page.getByRole('button', { name: '关闭任务', exact: true }).click(); await expect(page.locator('.cal-editor')).toHaveCount(0); }
async function open(page, title) { await page.locator('.cal-upcoming-row').filter({ hasText: title }).click(); }
async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator('.cal-overlay-presence:not([inert])').evaluateAll(nodes => nodes.every(node => node.dataset.state === 'open' && Number(getComputedStyle(node).opacity) === 1))).toBeTruthy();
  await expect(page.locator('.cal-overlay-presence:not([inert]) [role=status]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), animations: 'disabled' });
}
test.beforeEach(async ({ page }) => {
  if (!process.env.WORKBENCH_WEB_DIST) throw new Error('Use an isolated production build.');
  now = '2026-09-25T06:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-capabilities-')), workbenchClock: () => new Date(now) });
  ({ client } = await registerMath(world, 'schedule-capabilities@example.test'));
  await login(page);
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world?.close();
  if (info.status === info.expectedStatus && !pageErrors.length) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(pageErrors).toEqual([]);
});

test('通知长标题不溢出，已读可切回未读，顶部空白关闭', async ({ page }) => {
  const title = '通知区域长标题：函数概念与表示方法以及定义域的完整课堂准备';
  await call('POST', E, input(title, { reminder: { side: 'before', minutes: 1 } }));
  now = '2026-09-25T08:00:00Z';
  await page.clock.setFixedTime(new Date(now)); await page.reload();
  await page.getByRole('button', { name: '通知', exact: true }).click();
  const panel = page.locator('.tb-popover-notifications');
  const row = panel.getByRole('button', { name: new RegExp(title) });
  await expect(row).toBeVisible();
  const bounds = await panel.boundingBox(), box = await row.boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  await row.click();
  await page.getByRole('button', { name: '通知', exact: true }).click();
  await expect(row).toHaveClass(/is-read/);
  await row.click();
  await expect.poll(async () => (await call('GET', N)).items[0].readAt).toBeNull();
  if (!await panel.isVisible()) await page.getByRole('button', { name: '通知', exact: true }).click();
  await expect(row).not.toHaveClass(/is-read/);
  await page.locator('.tb-topbar').click({ position: { x: 350, y: 20 } });
  await expect(panel).toHaveCount(0);
});

test('重复改星期后定位新日期，月和年可选日期且摘要显示规则', async ({ page }) => {
  const entry = await call('POST', E, input('调整重复日期', { repeat: { until: '2100-12-31', frequency: 'weekly', interval: 1, weekdays: [5], monthly: 'date', count: 0 } }));
  await page.reload(); await open(page, entry.title);
  await page.locator('.cal-repeat-summary').click();
  const dialog = page.getByRole('dialog', { name: '重复', exact: true });
  await dialog.getByRole('button', { name: '周五', exact: true }).click();
  await dialog.getByRole('button', { name: '周四', exact: true }).click();
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-10-01');
  await expect(page.locator('.cal-repeat-summary')).toContainText('周四');
  await expect(page.locator('.fc-timegrid-event').filter({ hasText: entry.title })).toHaveCount(1);
  await page.locator('.cal-repeat-summary').click();
  await dialog.getByLabel('重复单位', { exact: true }).selectOption('monthly');
  await dialog.getByLabel('每月日期', { exact: true }).selectOption('15');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-10-15');
  await expect(page.locator('.cal-repeat-summary')).toContainText('15 日');
  await close(page); await page.reload();
  await page.goto(`${world.origin}/calendar?entry=${entry.id}&on=2026-10-15`);
  await page.locator('.cal-repeat-summary').click();
  await dialog.getByLabel('重复单位', { exact: true }).selectOption('yearly');
  await dialog.getByLabel('每年月份', { exact: true }).selectOption('12');
  await dialog.getByLabel('每年日期', { exact: true }).selectOption('20');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-12-20');
  await expect(page.locator('.cal-repeat-summary')).toContainText('12 月 20 日');
  await expect.poll(async () => (await saved(entry.title))?.time.date).toBe('2026-12-20');
  await shot(page, 'yearly-repeat-summary');
});

test('从后续实例改星期保留系列起点和已有日期', async ({ page }) => {
  const entry = await call('POST', E, input('后续实例改规则', { repeat: { until: '2100-12-31', frequency: 'weekly', interval: 1, weekdays: [5], monthly: 'date', count: 0 } }));
  await page.goto(`${world.origin}/calendar?entry=${entry.id}&on=2026-10-09`);
  await page.locator('.cal-repeat-summary').click();
  const dialog = page.getByRole('dialog', { name: '重复', exact: true });
  await dialog.getByRole('button', { name: '周五', exact: true }).click();
  await dialog.getByRole('button', { name: '周四', exact: true }).click();
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-10-15');
  await expect.poll(async () => (await saved(entry.title))?.repeat?.weekdays).toEqual([4]);
  expect((await saved(entry.title)).time.date).toBe('2026-09-25');
  const occurrences = await call('GET', '/api/modules/schedule/occurrences?from=2026-09-25&to=2026-10-15');
  expect(occurrences.items.filter(x => x.key.entryId === entry.id).map(x => x.time.date)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
  await close(page);
  await page.goto(`${world.origin}/calendar?entry=${entry.id}&on=2026-10-22`);
  await page.locator('.cal-repeat-summary').click();
  await dialog.getByLabel('重复间隔', { exact: true }).fill('3');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-11-05');
  await expect.poll(async () => (await saved(entry.title))?.repeat?.interval).toBe(3);
  expect((await saved(entry.title)).time.date).toBe('2026-09-25');
  const selected = await call('GET', `${E}/${entry.id}/occurrence?originDate=2026-11-05`);
  expect(selected.state).toBe('active');
});

test('月末和闰日重复只生成有效日期', async ({ page }) => {
  const entry = await call('POST', E, input('月末与闰日', { repeat: { until: '2100-12-31', frequency: 'monthly', interval: 1, weekdays: [5], monthly: 'date', count: 3 } }));
  await page.reload(); await open(page, entry.title);
  await page.locator('.cal-repeat-summary').click();
  const dialog = page.getByRole('dialog', { name: '重复', exact: true });
  await dialog.getByLabel('每月日期', { exact: true }).selectOption('31');
  await shot(page, 'monthly-date-picker');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-10-31');
  await expect.poll(async () => (await saved(entry.title))?.time.date).toBe('2026-10-31');
  let occurrences = await call('GET', '/api/modules/schedule/occurrences?from=2026-10-01&to=2027-02-01');
  expect(occurrences.items.filter(x => x.key.entryId === entry.id).map(x => x.time.date)).toEqual(['2026-10-31', '2026-12-31', '2027-01-31']);
  await page.locator('.cal-repeat-summary').click();
  await dialog.getByLabel('重复单位', { exact: true }).selectOption('yearly');
  await dialog.getByLabel('每年月份', { exact: true }).selectOption('2');
  await dialog.getByLabel('每年日期', { exact: true }).selectOption('29');
  await shot(page, 'yearly-leap-day-picker');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2028-02-29');
  await expect.poll(async () => (await saved(entry.title))?.time.date).toBe('2028-02-29');
  occurrences = await call('GET', '/api/modules/schedule/occurrences?from=2028-01-01&to=2036-12-31');
  expect(occurrences.items.filter(x => x.key.entryId === entry.id).map(x => x.time.date)).toEqual(['2028-02-29', '2032-02-29', '2036-02-29']);
});

test('每月可选择第几个星期几', async ({ page }) => {
  const entry = await call('POST', E, input('每月教研', { repeat: { until: '2100-12-31', frequency: 'monthly', interval: 1, weekdays: [5], monthly: 'date', count: 3 } }));
  await page.reload(); await open(page, entry.title);
  await page.locator('.cal-repeat-summary').click();
  const dialog = page.getByRole('dialog', { name: '重复', exact: true });
  await dialog.getByRole('combobox').filter({ has: page.locator('option[value=weekday]') }).selectOption('weekday');
  await dialog.getByLabel('每月第几周', { exact: true }).selectOption('3');
  await dialog.getByLabel('每月星期', { exact: true }).selectOption('4');
  await shot(page, 'monthly-weekday-picker');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-10-15');
  await expect(page.locator('.cal-repeat-summary')).toContainText('第三个周四');
  await expect.poll(async () => (await saved(entry.title))?.time.date).toBe('2026-10-15');
  const occurrences = await call('GET', '/api/modules/schedule/occurrences?from=2026-10-01&to=2027-01-01');
  expect(occurrences.items.filter(x => x.key.entryId === entry.id).map(x => x.time.date)).toEqual(['2026-10-15', '2026-11-19', '2026-12-17']);
});

test('重复任务编辑后成为独立任务，连续输入及后续排期保持独立', async ({ page }) => {
  const entry = await call('POST', E, input('流畅编辑重复课堂', { repeat: { until: '2026-10-09' } }));
  await page.reload(); await open(page, entry.title);
  const notes = page.getByRole('textbox', { name: '备注', exact: true });
  await notes.click(); await notes.pressSequentially('这次课堂备注', { delay: 750 });
  await expect(notes).toHaveText('这次课堂备注');
  await expect(page.locator('.cal-repeat-summary')).toHaveCount(0);
  await expect(page.locator('.cal-scope-bar')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await call('GET', E)).items.find(x => x.id !== entry.id && x.title === entry.title)?.calendar.notes).toBe('这次课堂备注');
  const independent = (await call('GET', E)).items.find(x => x.id !== entry.id && x.title === entry.title);
  expect(independent.repeat).toBeNull();
  expect((await call('GET', `${E}/${entry.id}/occurrence?originDate=2026-09-25`)).state).toBe('cancelled');
  expect((await call('GET', `${E}/${entry.id}/occurrence?originDate=2026-10-02`)).calendar.notes).toBe('');
  await action(page, '设置提醒');
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('button', { name: '完成', exact: true }).click();
  await close(page); await page.reload(); await open(page, entry.title);
  await expect(page.locator('.cal-repeat-summary')).toHaveCount(0);
  await page.locator('.cal-reminder-summary').click();
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('spinbutton').fill('5');
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${independent.id}`)).reminder?.minutes).toBe(5);
  await page.locator('.cal-editor-heading').getByRole('button', { name: '移回待安排', exact: true }).click();
  await page.getByRole('dialog', { name: '移回待安排', exact: true }).getByRole('button', { name: '移回待安排', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${independent.id}`)).time).toBeNull();
  expect((await call('GET', `${E}/${entry.id}/occurrence?originDate=2026-10-02`)).state).toBe('active');
  await shot(page, 'independent-task-editor');
});

for (const selected of [false, true]) test(`拖动重复任务直接调整这一次，不弹范围框，任务${selected ? '已选中' : '未选中'}`, async ({ page }) => {
  const entry = await call('POST', E, input('拖动重复课堂', { repeat: { until: '2026-10-09' } }));
  await page.reload();
  if (selected) await open(page, entry.title);
  const card = page.locator('.fc-timegrid-event').filter({ hasText: entry.title });
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 52, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: '调整重复任务', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await call('GET', E)).items.find(x => x.id !== entry.id && x.title === entry.title)?.time.startTime).not.toBe('15:00');
  expect((await call('GET', `${E}/${entry.id}/occurrence?originDate=2026-09-25`)).state).toBe('cancelled');
  expect((await call('GET', `${E}/${entry.id}/occurrence?originDate=2026-10-02`)).time.startTime).toBe('15:00');
});

test('单次重复提醒摘要明确范围并保存后重开', async ({ page }) => {
  const entry = await call('POST', E, input('单次提醒课堂', { repeat: { until: '2026-10-09' } }));
  await page.reload(); await open(page, '单次提醒课堂');
  await action(page, '设置提醒');
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '编辑重复任务', exact: true })).toHaveCount(0);
  await expect(page.locator('.cal-reminder-summary')).toHaveText('结束前 10 分钟提醒');
  await shot(page, 'reminder-inline-scope');
  await close(page); await page.reload(); await open(page, '单次提醒课堂');
  await expect(page.locator('.cal-reminder-summary')).toHaveText('结束前 10 分钟提醒');
  expect((await call('GET', `${E}/${entry.id}`)).reminder).toBeNull();
});

test('重复任务这一次移回待安排，保留内容及后续排期', async ({ page }) => {
  const item = { id: randomUUID(), text: '课堂清单', priority: 'normal' };
  const value = input('待调整重复课堂', { repeat: { until: '2026-10-09' }, items: [item], calendar: { allDay: false, notes: '保留课堂笔记', tags: [] } });
  let entry = await call('POST', E, value);
  const { repeat, ...instance } = value;
  await call('PUT', `${E}/${entry.id}/exceptions/2026-10-02`, { expectedVersion: entry.version, mode: 'override', content: { ...instance, title: '旧单次例外' } });
  await page.reload(); await open(page, value.title);
  await page.locator('.cal-editor-heading').getByRole('button', { name: '移回待安排', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '移回待安排', exact: true });
  await expect(dialog).toContainText('移除这项任务的时间和提醒');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  expect((await saved(value.title)).repeat).not.toBeNull();
  await page.locator('.cal-editor-heading').getByRole('button', { name: '移回待安排', exact: true }).click();
  await dialog.getByRole('button', { name: '移回待安排', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '编辑重复任务', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await call('GET', E)).items.find(x => x.id !== entry.id && x.title === value.title)?.time).toBeNull();
  await close(page); await page.reload();
  await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: new RegExp(value.title) }).click();
  const originalId = entry.id;
  entry = (await call('GET', E)).items.find(x => x.id !== originalId && x.title === value.title);
  expect(entry.repeat).toBeNull(); expect(entry.reminder).toBeNull();
  expect(entry.items).toEqual([item]); expect(entry.calendar.notes).toBe('保留课堂笔记');
  expect((await call('GET', `${E}/${entry.id}/exceptions`)).items).toEqual([]);
  await page.getByRole('button', { name: '安排时间', exact: true }).click();
  await expect.poll(async () => Boolean((await call('GET', `${E}/${entry.id}`)).time)).toBeTruthy();
  await close(page);
  expect((await call('GET', `${E}/${originalId}/occurrence?originDate=2026-10-02`)).title).toBe('旧单次例外');
});

test('提醒按需配置，关闭浏览器后补呈现原时间，计划不被通知改写', async ({ page, browser }) => {
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('函数课堂');
  await page.locator('[name=entry-start]').fill('15:00');
  await expect.poll(async () => (await saved('函数课堂'))?.time.startTime).toBe('15:00');
  await action(page, '设置提醒');
  const dialog = page.getByRole('dialog', { name: '提醒', exact: true });
  await dialog.getByLabel('提醒时机').selectOption('end-after');
  await dialog.getByLabel('分钟数').click(); await dialog.getByLabel('分钟数').fill('15');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await saved('函数课堂'))?.reminder).toEqual({ side: 'after', minutes: 15 });
  await page.getByRole('button', { name: '结束后 15 分钟提醒', exact: true }).click();
  await dialog.getByLabel('提醒时机').selectOption('end-before'); await dialog.getByLabel('分钟数').fill('10');
  await shot(page, 'reminder-desktop');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await saved('函数课堂'))?.reminder).toEqual({ side: 'before', minutes: 10 });
  const task = await saved('函数课堂');
  await page.reload(); await expect(page.getByRole('button', { name: '结束前 10 分钟提醒', exact: true })).toBeVisible();
  await page.close(); now = '2026-09-25T09:00:00Z';
  const context = await browser.newContext({ ignoreHTTPSErrors: true }); const reopened = await context.newPage();
  await reopened.clock.setFixedTime(new Date(now)); await login(reopened);
  await reopened.getByRole('button', { name: /^通知/ }).click();
  const notices = reopened.getByRole('dialog').filter({ has: reopened.getByRole('heading', { name: '通知', exact: true }) });
  await expect(notices.getByRole('button', { name: /函数课堂/ })).toHaveCount(1);
  await expect(notices.getByRole('button', { name: /函数课堂/ })).toContainText('9/25 15:50');
  expect((await call('GET', N)).items[0].dueAt).toBe('2026-09-25T07:50:00Z');
  await notices.getByRole('button', { name: /函数课堂/ }).click();
  await expect(reopened.locator('[name=entry-title]')).toHaveValue('函数课堂');
  expect((await call('GET', `${E}/${task.id}`)).version).toBe(task.version);
  await context.close();
});


test('删除任务不保留，响应丢失后刷新原键确认，单次删除不影响整组', async ({ page }) => {
  const task = await call('POST', E, input('永久删除的课堂'));
  await page.reload(); await open(page, task.title); await action(page, '删除任务');
  const writes = [];
  await page.route(`**${E}/${task.id}/delete`, async route => {
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    await route.fetch(); await route.abort('failed');
  });
  await page.getByRole('dialog', { name: '删除任务', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  expect((await client.request('GET', `${E}/${task.id}`)).status).toBe(404);
  await page.unroute(`**${E}/${task.id}/delete`); await page.reload();
  await page.route(`**${E}/${task.id}/delete`, async route => {
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    await route.continue();
  });
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
  expect((await call('GET', `${E}?state=deleted`)).items).toEqual([]);
  const series = await call('POST', E, input('每周课堂', { repeat: { until: '2026-10-09' } }));
  await page.reload(); await open(page, series.title); await action(page, '删除任务');
  await page.getByRole('dialog', { name: '删除任务', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  expect((await call('GET', `${E}/${series.id}/occurrence?originDate=2026-09-25`)).state).toBe('cancelled');
  expect((await call('GET', `${E}/${series.id}/occurrence?originDate=2026-10-02`)).state).toBe('active');
  await page.goto(`${world.origin}/calendar?entry=${series.id}&on=2026-09-25`);
  await expect(page.getByRole('button', { name: '恢复这次任务', exact: true })).toHaveCount(0);
});

test('待安排、多事项排序，原子移动只搬单项且未知结果可恢复', async ({ page }) => {
  const before = (await call('GET', E)).items.length;
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click(); await close(page);
  expect((await call('GET', E)).items).toHaveLength(before);
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('周末准备');
  expect(await page.locator('.cal-add-first-item').evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('solid');
  await shot(page, 'items-solid-border');
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 1', { exact: true }).pressSequentially('整理函数例题');
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 2', { exact: true }).fill('准备练习讲义');
  await expect.poll(async () => (await saved('周末准备'))?.items.length).toBe(2);
  expect((await saved('周末准备')).time).toBeNull();
  const from = await page.locator('.cal-item-bullet').nth(1).boundingBox();
  const to = await page.locator('.cal-item-row').first().boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(to.x + 10, to.y + 2, { steps: 15 }); await page.mouse.up();
  await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('准备练习讲义');
  await expect.poll(async () => (await saved('周末准备'))?.items[0].text).toBe('准备练习讲义');
  await page.getByRole('button', { name: '安排时间', exact: true }).click();
  await expect.poll(async () => Boolean((await saved('周末准备'))?.time)).toBeTruthy();
  await page.locator('.cal-editor-heading').getByRole('button', { name: '移回待安排', exact: true }).click();
  await page.getByRole('dialog', { name: '移回待安排' }).getByRole('button', { name: '移回待安排', exact: true }).click();
  await expect.poll(async () => (await saved('周末准备'))?.time).toBeNull();
  const source = await saved('周末准备');
  const target = await call('POST', E, input('课堂安排', { items: [{ id: randomUUID(), text: '讲解定义', priority: 'normal' }], reminder: { side: 'before', minutes: 5 } }));
  await page.reload();
  await page.getByRole('button', { name: '事项 2 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '移动事项' });
  await dialog.getByLabel('移到', { exact: true }).selectOption(target.id);
  await shot(page, 'move-item-desktop');
  const writes = [];
  await page.route('**/api/modules/schedule/item-moves', async route => {
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    await route.fetch(); await route.abort('failed');
  });
  await dialog.getByRole('button', { name: '移动事项', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.unroute('**/api/modules/schedule/item-moves'); await page.reload();
  await page.route('**/api/modules/schedule/item-moves', async route => { writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() }); await route.continue(); });
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('课堂安排');
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
  const moved = await call('GET', `${E}/${target.id}`);
  expect(moved.items[1]).toEqual(source.items[1]); expect(moved.time).toEqual(target.time); expect(moved.reminder).toEqual(target.reminder);
  expect((await call('GET', `${E}/${source.id}`)).items).toEqual([source.items[0]]);
  await page.getByRole('button', { name: '事项 2 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '删除事项', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${target.id}`)).items.length).toBe(1);
  await page.reload(); await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('讲解定义');
});

test('系统时区同步保留当地钟点，新建任务采用系统时区', async ({ page }) => {
  const task = await call('POST', E, input('跨时区课堂', { repeat: { until: '2026-10-09' } }));
  const original = await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-25`);
  const settings = await call('GET', '/api/modules/schedule/settings');
  await call('PUT', '/api/modules/schedule/settings', { expectedVersion: settings.version, timeZone: 'America/New_York' });
  await page.reload();
  await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
  await expect.poll(async () => (await call('GET', '/api/modules/schedule/settings')).timeZone).toBe('Asia/Shanghai');
  const after = await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-25`);
  expect(after.startsAt).toBe(original.startsAt); expect(after.time).toEqual(original.time); expect(after.entryVersion).toBe(original.entryVersion + 2);
  await open(page, task.title); await expect(page.getByText('排课时区：Asia/Shanghai', { exact: true })).toHaveCount(0); await close(page);
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('系统时区新任务');
  await expect.poll(async () => (await saved('系统时区新任务'))?.time.timeZone).toBe('Asia/Shanghai');
  await close(page);
});

test('主题真实切换、窄屏展开字段可达，账户草稿和未知请求隔离', async ({ page }) => {
  const task = await call('POST', E, input('一班长标题课堂', { items: [{ id: randomUUID(), text: '准备较长的函数定义与图像讲解材料', priority: 'high' }] }));
  await page.reload(); await open(page, task.title);
  await action(page, '设置提醒'); await shot(page, 'light-desktop-details');
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('button', { name: '取消', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.cal-page')).toHaveClass(/sidebar-open/);
  await action(page, '设置提醒'); await shot(page, 'light-mobile-details');
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('button', { name: '取消', exact: true }).click();
  await page.setViewportSize({ width: 1675, height: 950 });
  await page.getByRole('link', { name: /^账户：/ }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', 'dark');
  await page.locator('.cal-editor').evaluate(node => node.scrollTop = 0); await shot(page, 'dark-desktop-editor');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开月份与任务', exact: true }).click();
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 2', { exact: true }).click(); await page.getByLabel('事项 2', { exact: true }).pressSequentially('窄屏补充');
  await expect.poll(async () => (await saved(task.title))?.items[1]?.text).toBe('窄屏补充');
  await shot(page, 'dark-mobile-items');
  await page.setViewportSize({ width: 1675, height: 950 });
  await page.route(`**${E}/${task.id}`, async route => { if (route.request().method() !== 'PUT') return route.continue(); await route.fetch(); await route.abort('failed'); });
  await page.locator('[name=entry-title]').fill('账户甲未确认标题');
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.locator('[name=entry-title]').fill('账户甲后续草稿');
  // Finish logout and anonymous context preparation before navigating to another login.
  await page.getByRole('link', { name: /^账户：/ }).click(); await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();
  await registerMath(world, 'schedule-other@example.test'); await login(page, 'schedule-other@example.test');
  await expect(page.locator('[name=entry-title]')).toHaveCount(0); await expect(page.getByRole('button', { name: '重试确认', exact: true })).toHaveCount(0);
  await expect(page.locator('.cal-upcoming-row')).toHaveCount(0);
  await page.getByRole('link', { name: /^账户：/ }).click(); await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();
  await page.unroute(`**${E}/${task.id}`); await login(page);
  await expect(page.locator('[name=entry-title]')).toHaveValue('账户甲后续草稿');
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).title).toBe('账户甲后续草稿');
});

test('通知地址进入后删除返回日历，刷新不重新打开已删除任务', async ({ page }) => {
  const task = await call('POST', E, input('通知打开的任务'));
  await page.goto(`${world.origin}/calendar?entry=${task.id}`);
  await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);
  await action(page, '删除任务');
  await page.getByRole('dialog', { name: '删除任务', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  await expect(page).toHaveURL(`${world.origin}/calendar`);
  await page.reload(); await expect(page.locator('.cal-editor')).toHaveCount(0);
});

test('提醒弹窗退出动效、Escape焦点和快速反向', async ({ page }) => {
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('动效检查');
  await page.locator('[name=entry-start]').fill('15:00');
  await expect.poll(async () => Boolean(await saved('动效检查'))).toBeTruthy();
  await action(page, '设置提醒');
  const dialog = page.getByRole('dialog', { name: '提醒', exact: true });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(node => Number(getComputedStyle(node.closest('.cal-overlay-presence') || node).opacity))).toBe(1);
  await page.evaluate(() => {
    window.calendarExitFrames = [];
    let count = 0;
    function frame() {
      const node = [...document.querySelectorAll('[role=dialog]')].find(x => x.getAttribute('aria-label') === '提醒');
      if (node) {
        const owner = node.closest('.cal-overlay-presence') || node;
        window.calendarExitFrames.push({ inert: Boolean(node.closest('[inert]')), opacity: Number(getComputedStyle(owner).opacity) });
      }
      if (++count < 60) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.calendarExitFrames.some(x => x.inert && x.opacity > 0 && x.opacity < 1))).toBeTruthy();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '任务操作', exact: true })).toBeFocused();
  await action(page, '设置提醒'); await page.keyboard.press('Escape');
  await action(page, '设置提醒'); await expect(dialog).toBeVisible();
  await page.getByLabel('分钟数').fill('23');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await saved('动效检查'))?.reminder).toEqual({ side: 'before', minutes: 23 });
});

test('提醒明确拒绝可修正，事项移动冲突回滚并能核对后继续', async ({ page }) => {
  const source = await call('POST', E, input('移动源', { items: [{ id: randomUUID(), text: '原事项', priority: 'normal' }] }));
  const target = await call('POST', E, input('移动目标'));
  await page.reload(); await open(page, source.title);
  await action(page, '设置提醒'); const reminder = page.getByRole('dialog', { name: '提醒', exact: true });
  await reminder.getByLabel('分钟数').fill('180'); await reminder.getByRole('button', { name: '完成', exact: true }).click();
  const expired = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(expired).toBeVisible();
  expect((await call('GET', `${E}/${source.id}`)).reminder).toBeNull();
  await expired.getByRole('button', { name: '放弃本次修改', exact: true }).click();
  await action(page, '设置提醒');
  await reminder.getByLabel('分钟数').fill('5'); await reminder.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${source.id}`)).reminder?.minutes).toBe(5);
  await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
  const move = page.getByRole('dialog', { name: '移动事项', exact: true });
  await move.getByLabel('移到', { exact: true }).selectOption(target.id);
  await call('PUT', `${E}/${target.id}`, { ...input('另一窗口的目标'), expectedVersion: target.version });
  await move.getByRole('button', { name: '移动事项', exact: true }).click();
  await expect(move.getByRole('alert')).toBeVisible();
  expect((await call('GET', `${E}/${source.id}`)).items).toHaveLength(1);
  expect((await call('GET', `${E}/${target.id}`)).items).toHaveLength(0);
  await move.getByRole('button', { name: '读取最新安排', exact: true }).click();
  await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
  await move.getByLabel('移到', { exact: true }).selectOption(target.id);
  await move.getByRole('button', { name: '移动事项', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('另一窗口的目标');
  expect((await call('GET', `${E}/${target.id}`)).items).toEqual(source.items);
});

test('源事项冲突必须核对，不因再次打开移动而覆盖另一窗口的内容', async ({ page }) => {
  const source = await call('POST', E, input('源冲突', { items: [{ id: randomUUID(), text: '本地事项', priority: 'normal' }] }));
  const target = await call('POST', E, input('冲突目标'));
  await page.reload(); await open(page, source.title);
  await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '移动事项', exact: true });
  await dialog.getByLabel('移到', { exact: true }).selectOption(target.id);
  const changed = await call('PUT', `${E}/${source.id}`, { ...input(source.title), expectedVersion: source.version,
    items: [{ ...source.items[0], text: '另一窗口改过的事项' }, { id: randomUUID(), text: '另一窗口新事项', priority: 'high' }] });
  await dialog.getByRole('button', { name: '移动事项', exact: true }).click();
  await dialog.getByRole('button', { name: '读取最新安排', exact: true }).click();
  await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
  expect((await call('GET', `${E}/${source.id}`)).items).toEqual(changed.items);
  await expect(page.getByRole('alert')).toContainText('先核对');
  await page.getByText('查看服务器内容', { exact: true }).click();
  await expect(page.locator('.cal-conflict-preview')).toContainText('另一窗口新事项');
  await page.locator('.cal-conflict-preview').scrollIntoViewIfNeeded(); await shot(page, 'conflict-desktop');
  await page.getByRole('button', { name: '采用服务器内容', exact: true }).click();
  await page.getByRole('dialog', { name: '采用服务器内容' }).getByRole('button', { name: '采用', exact: true }).click();
  await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('另一窗口改过的事项');
  await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
  await dialog.getByLabel('移到', { exact: true }).selectOption(target.id); await dialog.getByRole('button', { name: '移动事项', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue(target.title);
  expect((await call('GET', `${E}/${target.id}`)).items).toEqual([changed.items[0]]);
  expect((await call('GET', `${E}/${source.id}`)).items).toEqual([changed.items[1]]);
  await close(page); await open(page, source.title);
  const current = await call('GET', `${E}/${source.id}`);
  await call('PUT', `${E}/${source.id}`, { ...input('服务器标题'), items: current.items, expectedVersion: current.version });
  await page.locator('[name=entry-title]').fill('核对后保留本地标题');
  await page.getByRole('button', { name: '读取最新版本', exact: true }).click();
  await page.getByRole('button', { name: '关闭任务', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('先核对');
  expect((await call('GET', `${E}/${source.id}`)).title).toBe('服务器标题');
  await page.getByRole('button', { name: '重新保存', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${source.id}`)).title).toBe('核对后保留本地标题');
});

test('系统时区覆盖旧账户设置，通知和日历同步当地时间', async ({ page }) => {
  await call('POST', E, input('时区通知', { reminder: { side: 'before', minutes: 10 } }));
  const settings = await call('GET', '/api/modules/schedule/settings');
  await call('PUT', '/api/modules/schedule/settings', { expectedVersion: settings.version, timeZone: 'UTC' });
  await page.reload();
  await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
  await expect.poll(async () => (await call('GET', '/api/modules/schedule/settings')).timeZone).toBe('Asia/Shanghai');
  now = '2026-09-25T09:00:00Z';
  await page.waitForResponse(response => response.url().endsWith(N) && response.ok(), { timeout: 35000 });
  await page.getByRole('button', { name: /^通知/ }).click();
  const notices = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '通知', exact: true }) });
  await expect(notices.getByRole('button', { name: /时区通知/ })).toContainText('9/25 15:50');
});

test('系统时区同步后全天卡片真实拖动和拉伸，日期和天数正确', async ({ page }) => {
  const settings = await call('GET', '/api/modules/schedule/settings');
  await call('PUT', '/api/modules/schedule/settings', { expectedVersion: settings.version, timeZone: 'America/New_York' });
  const task = await call('POST', E, input('全天时区', { time: { date: '2026-09-25', startTime: '00:00', durationMinutes: 1440, timeZone: 'Asia/Shanghai' }, calendar: { allDay: true, notes: '', tags: [] } }));
  await page.reload();
  await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
  await expect.poll(async () => (await call('GET', '/api/modules/schedule/settings')).timeZone).toBe('Asia/Shanghai');
  await page.getByRole('button', { name: '日历视图', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /^周\s/ }).click();
  const event = page.locator('.fc-daygrid-event').filter({ hasText: task.title });
  await expect(event).toBeVisible();
  await expect(event).toHaveClass(/fc-event-draggable/);
  await event.hover();
  const box = await event.boundingBox(); const col = await page.locator('.fc-col-header-cell').first().boundingBox();
  await page.mouse.move(box.x + 35, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + 35 + col.width, box.y + box.height / 2, { steps: 24 }); await page.mouse.up();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).time.date).toBe('2026-09-26');
  const changed = await call('GET', `${E}/${task.id}`); expect(changed.time.timeZone).toBe('Asia/Shanghai'); expect(changed.time.durationMinutes).toBe(1440);
  await page.reload(); await expect(event).toBeVisible();
  await event.hover(); const handle = await event.locator('.fc-event-resizer-end').boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + col.width, handle.y + handle.height / 2, { steps: 24 }); await page.mouse.up();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).time.durationMinutes).toBe(2880);
  expect((await call('GET', `${E}/${task.id}`)).time.date).toBe('2026-09-26');
});

test('事项移入重复任务可选每次或指定日期，不复制系列且原子保留其他任务', async ({ page }) => {
  const itemA = { id: randomUUID(), text: '每周整理易错题', priority: 'normal' };
  const itemB = { id: randomUUID(), text: '只在这次补讲定义域', priority: 'normal' };
  const source = await call('POST', E, input('待移动事项', { time: null, items: [itemA, itemB] }));
  const target = await call('POST', E, input('每周教研', { repeat: { until: '2026-10-09' } }));
  await page.reload();
  async function begin() {
    await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: /待移动事项/ }).click();
    await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
    await page.getByRole('dialog', { name: '移动事项', exact: true }).getByLabel('移到', { exact: true }).selectOption(target.id);
  }
  await begin();
  let dialog = page.getByRole('dialog', { name: '移动事项', exact: true });
  await dialog.getByRole('radio', { name: '每次重复都需要', exact: true }).check();
  await shot(page, 'move-item-to-series');
  await dialog.getByRole('button', { name: '移动事项', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const changed = await call('GET', `${E}/${target.id}`);
  expect(changed.items).toEqual([itemA]); expect(changed.repeat).toEqual(target.repeat);
  expect((await call('GET', E)).items.filter(x => x.repeat)).toHaveLength(1);
  expect((await call('GET', `${E}/${target.id}/occurrence?originDate=2026-10-02`)).items).toEqual([itemA]);
  expect((await call('GET', `${E}/${source.id}`)).items).toEqual([itemB]);
  await close(page); await begin();
  dialog = page.getByRole('dialog', { name: '移动事项', exact: true });
  await dialog.getByRole('radio', { name: '只在某一次需要', exact: true }).check();
  await dialog.getByLabel('任务日期', { exact: true }).selectOption('2026-10-02');
  await shot(page, 'move-item-to-occurrence');
  await dialog.getByRole('button', { name: '移动事项', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.cal-repeat-summary')).toHaveCount(0);
  const independent = (await call('GET', E)).items.find(x => x.id !== target.id && x.title === target.title);
  expect(independent.repeat).toBeNull(); expect(independent.items).toEqual([itemA, itemB]);
  expect(independent.time.date).toBe('2026-10-02');
  expect((await call('GET', `${E}/${target.id}/occurrence?originDate=2026-10-02`)).state).toBe('cancelled');
  expect((await call('GET', `${E}/${target.id}/occurrence?originDate=2026-10-09`)).items).toEqual([itemA]);
  expect((await call('GET', `${E}/${source.id}`)).items).toEqual([]);
  await page.reload(); await expect(page.locator('.cal-repeat-summary')).toHaveCount(0);
});

test('缩短任务使提醒过期时立即询问，关闭提醒保存后日程仍可操作', async ({ page }) => {
  const entry = await call('POST', E, input('时间调整测试', { reminder: { side: 'before', minutes: 10 } }));
  await page.reload(); await open(page, entry.title);
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  await page.locator('[name=entry-end]').fill('15:50');
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(prompt).toBeVisible(); await expect(prompt).toBeInViewport();
  expect((await call('GET', `${E}/${entry.id}`)).time.durationMinutes).toBe(60);
  await shot(page, 'expired-reminder-decision');
  await prompt.getByRole('button', { name: '关闭提醒并保存', exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect.poll(async () => (await call('GET', `${E}/${entry.id}`)).time.durationMinutes).toBe(50);
  expect((await call('GET', `${E}/${entry.id}`)).reminder).toBeNull();
  await expect(page.locator('[name=entry-end]')).toHaveValue('15:50');
  await expect(page.locator('.fc-timegrid-event').filter({ hasText: entry.title })).toContainText('15:00 - 15:50');
  await close(page);
  await page.reload();
  await expect(page.locator('.fc-timegrid-event').filter({ hasText: entry.title })).toContainText('15:00 - 15:50');
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('后续可继续操作');
  await expect.poll(() => saved('后续可继续操作')).toBeTruthy();
});

test('放弃过期提醒修改后恢复原任务，可关闭编辑器并拖动到新时间', async ({ page }) => {
  const entry = await call('POST', E, input('放弃修改测试', { reminder: { side: 'before', minutes: 10 } }));
  await page.reload(); await open(page, entry.title);
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  await page.locator('[name=entry-end]').fill('15:50');
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await prompt.getByRole('button', { name: '放弃本次修改', exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator('[name=entry-end]')).toHaveValue('16:00');
  await close(page);
  const card = page.locator('.fc-timegrid-event').filter({ hasText: entry.title });
  await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 52, { steps: 15 }); await page.mouse.up();
  await expect.poll(async () => (await call('GET', `${E}/${entry.id}`)).time.startTime).not.toBe('15:00');
  expect((await call('GET', `${E}/${entry.id}`)).reminder).toEqual(entry.reminder);
});

test('提醒冲突只提供两种选择，遮罩不关闭，Escape 放弃修改', async ({ page }) => {
  const entry = await call('POST', E, input('提醒抉择测试', { reminder: { side: 'before', minutes: 10 } }));
  await page.reload(); await open(page, entry.title);
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  await page.locator('[name=entry-end]').fill('15:50');
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(prompt).toBeVisible();
  await expect(prompt.getByRole('button')).toHaveCount(2);
  await expect(prompt.getByRole('button', { name: '关闭', exact: true })).toHaveCount(0);
  await expect(prompt.getByRole('button', { name: '调整提醒', exact: true })).toHaveCount(0);
  await shot(page, 'reminder-two-choices');
  await page.mouse.click(5, 5); await expect(prompt).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(prompt).toHaveCount(0);
  await expect(page.locator('[name=entry-end]')).toHaveValue('16:00');
  const stored = await call('GET', `${E}/${entry.id}`);
  expect(stored.time).toEqual(entry.time);
  expect(stored.reminder).toEqual(entry.reminder);
});

for (const mode of ['未选中拖动', '选中拖动', '编辑后拖动', '重复任务拖动']) test(`放弃提醒冲突恢复原时段和提醒，不偷偷保存，${mode}`, async ({ page }) => {
  const entry = await call('POST', E, input('恢复原时段测试', { reminder: { side: 'before', minutes: 10 }, ...(mode === '重复任务拖动' ? { repeat: { until: '2026-10-09' } } : {}) }));
  await page.reload(); if (mode !== '未选中拖动') await open(page, entry.title);
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  const writes = [];
  page.on('request', req => { if (['POST', 'PUT'].includes(req.method()) && req.url().includes(`${E}/${entry.id}`)) writes.push(req.postDataJSON()); });
  const card = page.locator('.fc-timegrid-event').filter({ hasText: entry.title });
  await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox();
  if (mode === '编辑后拖动') {
    await page.getByRole('textbox', { name: '备注', exact: true }).fill('这次不要的备注');
    await page.locator('[name=entry-end]').fill('15:50');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 52, { steps: 8 }); await page.mouse.up();
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: '放弃本次修改', exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect(card).toContainText('15:00 - 16:00');
  if (mode !== '未选中拖动') {
    await expect(page.locator('[name=entry-start]')).toHaveValue('15:00');
    await expect(page.locator('[name=entry-end]')).toHaveValue('16:00');
    await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveText('');
    await close(page);
  }
  await page.reload(); await expect(card).toContainText('15:00 - 16:00');
  const saved = await call('GET', `${E}/${entry.id}`);
  expect(saved.time).toEqual(entry.time); expect(saved.reminder).toEqual(entry.reminder);
  expect(saved.calendar.notes).toBe(entry.calendar.notes); expect(saved.version).toBe(entry.version);
  if (mode === '重复任务拖动') {
    expect((await call('GET', E)).items.filter(x => x.title === entry.title)).toHaveLength(1);
    expect((await call('GET', `${E}/${entry.id}/occurrence?originDate=2026-09-25`)).state).toBe('active');
  }
  expect(writes).toHaveLength(1);
});

test('提醒拒绝响应晚到时保留期间的新输入，关闭提醒仍可保存', async ({ page }) => {
  const entry = await call('POST', E, input('晚到响应测试', { reminder: { side: 'before', minutes: 10 } }));
  await page.reload(); await open(page, entry.title);
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const hit = new Promise(resolve => { started = resolve; });
  let intercept = true;
  await page.route(`**${E}/${entry.id}`, async route => {
    if (route.request().method() !== 'PUT' || !intercept) return route.continue();
    intercept = false;
    started(); await gate; const response = await route.fetch(); await route.fulfill({ response });
  });
  await page.locator('[name=entry-end]').fill('15:50'); await hit;
  await action(page, '设置提醒');
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('button', { name: '关闭提醒', exact: true }).click();
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('响应等待期间的备注');
  release();
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await prompt.getByRole('button', { name: '关闭提醒并保存', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${entry.id}`)).calendar.notes).toBe('响应等待期间的备注');
  const saved = await call('GET', `${E}/${entry.id}`);
  expect(saved.reminder).toBeNull(); expect(saved.time.durationMinutes).toBe(50);
});

for (const selected of [false, true]) test(`拖动过期提醒关闭并保存保留新时段，任务${selected ? '已选中' : '未选中'}`, async ({ page }) => {
  const entry = await call('POST', E, input('关闭提醒拖动测试', { reminder: { side: 'before', minutes: 10 } }));
  await page.reload(); if (selected) await open(page, entry.title);
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  const writes = [];
  page.on('request', req => { if (req.method() === 'PUT' && req.url().endsWith(`${E}/${entry.id}`)) writes.push(req.postDataJSON()); });
  const card = page.locator('.fc-timegrid-event').filter({ hasText: entry.title });
  await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 52, { steps: 15 }); await page.mouse.up();
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(prompt).toBeVisible();
  const attempted = writes[0].time;
  expect(attempted.startTime).not.toBe(entry.time.startTime);
  await prompt.getByRole('button', { name: '关闭提醒并保存', exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect.poll(async () => (await call('GET', `${E}/${entry.id}`)).time).toEqual(attempted);
  expect((await call('GET', `${E}/${entry.id}`)).reminder).toBeNull();
  await expect(page.locator('[name=entry-start]')).toHaveValue(attempted.startTime);
  await expect(card).toContainText(attempted.startTime);
  await close(page); await page.reload();
  await expect(card).toContainText(attempted.startTime);
});

test('选中任务拉伸至短时段后关闭提醒保存不恢复原时长', async ({ page }) => {
  const entry = await call('POST', E, input('短时段关闭提醒', { time: { date: '2026-09-25', startTime: '16:40', durationMinutes: 45, timeZone: 'Asia/Shanghai' }, reminder: { side: 'before', minutes: 10 } }));
  await page.reload(); await open(page, entry.title);
  now = '2026-09-25T08:47:00Z'; await page.clock.setFixedTime(new Date(now));
  const writes = []; page.on('request', req => { if (req.method() === 'PUT' && req.url().endsWith(`${E}/${entry.id}`)) writes.push(req.postDataJSON()); });
  const card = page.locator('.fc-timegrid-event').filter({ hasText: entry.title });
  await card.scrollIntoViewIfNeeded(); await card.hover();
  const handle = await card.locator('.fc-event-resizer-end').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 4); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 4 - 61, { steps: 20 }); await page.mouse.up();
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(prompt).toBeVisible();
  const attempted = writes[0].time;
  expect(attempted.durationMinutes).toBeLessThan(20);
  await prompt.getByRole('button', { name: '关闭提醒并保存', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${entry.id}`)).time).toEqual(attempted);
  await expect(page.locator('[name=entry-end]')).toHaveValue('16:50');
  await expect(card).toContainText('16:40 - 16:50');
  await close(page); await page.reload(); await expect(card).toContainText('16:40 - 16:50');
});

test('编辑时间尚未保存就拖动同一任务，关闭提醒保存最后拖动时段', async ({ page }) => {
  const entry = await call('POST', E, input('连续改期测试', { reminder: { side: 'before', minutes: 10 } }));
  await page.reload(); await open(page, entry.title);
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  const writes = [];
  page.on('request', req => { if (req.method() === 'PUT' && req.url().endsWith(`${E}/${entry.id}`)) writes.push(req.postDataJSON()); });
  const card = page.locator('.fc-timegrid-event').filter({ hasText: entry.title });
  await card.scrollIntoViewIfNeeded(); const box = await card.boundingBox();
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('保留这次改期的备注');
  await page.locator('[name=entry-end]').fill('15:50');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 52, { steps: 8 }); await page.mouse.up();
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(prompt).toBeVisible();
  const attempted = writes[0].time;
  expect(attempted.startTime).not.toBe(entry.time.startTime);
  await prompt.getByRole('button', { name: '关闭提醒并保存', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${entry.id}`)).time).toEqual(attempted);
  expect((await call('GET', `${E}/${entry.id}`)).calendar.notes).toBe('保留这次改期的备注');
  await expect(page.locator('[name=entry-start]')).toHaveValue(attempted.startTime);
  await expect(card).toContainText(attempted.startTime);
  await close(page); await page.reload(); await expect(card).toContainText(attempted.startTime);
});

test('新任务提醒冲突选择放弃，取消草稿且不创建任务', async ({ page }) => {
  now = '2026-09-25T07:47:00Z'; await page.clock.setFixedTime(new Date(now));
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-start]').fill('15:00');
  await page.locator('[name=entry-end]').fill('16:00');
  await action(page, '设置提醒');
  await page.getByRole('dialog', { name: '提醒', exact: true }).getByRole('button', { name: '完成', exact: true }).click();
  await page.locator('[name=entry-end]').fill('15:50');
  await page.locator('[name=entry-title]').fill('不保存的冲突草稿');
  const prompt = page.getByRole('dialog', { name: '提醒时间已过去', exact: true });
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: '放弃本次修改', exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator('[name=entry-title]')).toHaveCount(0);
  expect((await call('GET', E)).items.some(x => x.title === '不保存的冲突草稿')).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: '新建任务', exact: true })).toBeVisible();
});

test('空事项离开后自动移除，数量使用括号且保留已填写事项', async ({ page }) => {
  const entry = await call('POST', E, input('事项取消测试', { time: null, items: [{ id: randomUUID(), text: '保留这一项', priority: 'normal' }] }));
  await page.reload(); await open(page, entry.title);
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await expect(page.getByLabel('事项 2', { exact: true })).toBeFocused();
  await page.locator('[name=entry-title]').click();
  await expect(page.locator('.cal-item-row')).toHaveCount(1);
  await expect(page.locator('.cal-items-heading h3')).toHaveText('事项(1)');
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 2', { exact: true }).fill('   ');
  await page.locator('[name=entry-title]').click();
  await expect(page.locator('.cal-item-row')).toHaveCount(1);
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 2', { exact: true }).fill('真正添加的事项');
  await page.locator('[name=entry-title]').click();
  await expect(page.locator('.cal-item-row')).toHaveCount(2);
  await expect(page.locator('.cal-items-heading h3')).toHaveText('事项(2)');
  await close(page); await page.reload(); await open(page, entry.title);
  await expect(page.getByLabel('事项 2', { exact: true })).toHaveValue('真正添加的事项');
  expect((await call('GET', `${E}/${entry.id}`)).items.map(x => x.text)).toEqual(['保留这一项', '真正添加的事项']);
});

test('待安排只在有时间后提供排期选项，移回按钮位于菜单左侧', async ({ page }) => {
  const entry = await call('POST', E, input('安排后反悔测试', { time: null }));
  await page.reload(); await open(page, entry.title);
  await expect(page.locator('.cal-editor-heading').getByRole('button', { name: '移回待安排', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '重复', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitemcheckbox', { name: '全天', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '设置提醒', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '教学关联', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '安排时间', exact: true }).click();
  const undo = page.locator('.cal-editor-heading').getByRole('button', { name: '移回待安排', exact: true });
  await expect(undo).toBeVisible();
  await shot(page, 'visible-unschedule-action');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(undo).toBeVisible();
  expect(await page.locator('.cal-editor-heading').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
  await shot(page, 'mobile-unschedule-action');
  await page.setViewportSize({ width: 1675, height: 950 });
  const buttonBox = await undo.boundingBox(); const menuBox = await page.getByRole('button', { name: '任务操作', exact: true }).boundingBox();
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(menuBox.x);
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '重复', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitemcheckbox', { name: '全天', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '设置提醒', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '移回待安排', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape'); await undo.click();
  await page.getByRole('dialog', { name: '移回待安排', exact: true }).getByRole('button', { name: '移回待安排', exact: true }).click();
  await expect(page.getByRole('button', { name: '安排时间', exact: true })).toBeVisible();
  await expect(undo).toHaveCount(0);
  await close(page); await page.reload(); await open(page, entry.title);
  expect((await call('GET', `${E}/${entry.id}`)).time).toBeNull();
});

test('连续点击添加不堆积空事项，放弃空输入也不删除或保存任务', async ({ page }) => {
  const before = (await call('GET', E)).items.length;
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await expect(page.locator('.cal-item-row')).toHaveCount(1);
  await expect(page.getByLabel('事项 1', { exact: true })).toBeFocused();
  await page.locator('[name=entry-title]').click();
  await expect(page.locator('.cal-item-row')).toHaveCount(0);
  await expect(page.locator('.cal-items-heading h3')).toHaveText('事项');
  await expect(page.getByRole('button', { name: '添加事项', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await close(page);
  expect((await call('GET', E)).items).toHaveLength(before);
});


test('真实指针选九十分钟，自动保存后刷新及服务重启仍可重开', async ({ page, browser }, info) => {
  await page.getByRole('button', { name: '日历视图', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /^周\s/ }).click();
  const startSlot = page.locator('.fc-timegrid-slot-lane[data-time="15:00:00"]');
  const endSlot = page.locator('.fc-timegrid-slot-lane[data-time="16:15:00"]');
  await startSlot.scrollIntoViewIfNeeded();
  const column = await page.locator('.fc-timegrid-col[data-date="2026-09-25"]').boundingBox();
  const start = await startSlot.boundingBox();
  const end = await endSlot.boundingBox();
  expect(column).not.toBeNull(); expect(start).not.toBeNull(); expect(end).not.toBeNull();
  const x = column.x + column.width / 2;
  // Fifteen-minute lanes contain three five-minute hits; selection includes the final hit.
  await page.mouse.move(x, start.y + start.height / 6); await page.mouse.down();
  await page.mouse.move(x, end.y + end.height * 5 / 6, { steps: 15 }); await page.mouse.up();
  await expect(page.locator('[name=entry-start]')).toHaveValue('15:00');
  await expect(page.locator('[name=entry-end]')).toHaveValue('16:30');
  const title = '指针选择的函数备课';
  await page.locator('[name=entry-title]').fill(title);
  await page.locator('[name=entry-title]').press('Tab');
  await expect.poll(async () => (await saved(title))?.time?.durationMinutes).toBe(90);
  await page.reload();
  await expect(page.locator('[name=entry-title]')).toHaveValue(title);
  await expect(page.locator('[name=entry-end]')).toHaveValue('16:30');
  await page.screenshot({ path: info.outputPath('pointer-selection-restored.png') });
  const entry = await saved(title);
  const selectedPath = `/calendar?entry=${entry.id}`;
  const storageState = await page.context().storageState();
  const directory = world.directory;
  await world.close();
  world = await createIntegration({ directory, workbenchClock: () => new Date(now) });
  const reopenedContext = await browser.newContext({ storageState, ignoreHTTPSErrors: true });
  try {
    const reopened = await reopenedContext.newPage();
    await reopened.clock.setFixedTime(new Date(now));
    await reopened.goto(world.origin + selectedPath);
    await expect(reopened.locator('[name=entry-title]')).toHaveValue(title);
    await expect(reopened.locator('[name=entry-start]')).toHaveValue('15:00');
    await expect(reopened.locator('[name=entry-end]')).toHaveValue('16:30');
  } finally { await reopenedContext.close(); }
});
