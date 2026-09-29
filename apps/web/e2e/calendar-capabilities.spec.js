import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { record, C, R } from '../../api/test/teaching-time-classes-materials-fixture.js';

const E = '/api/modules/schedule/entries';
const N = '/api/modules/schedule/notifications';
let world, client, now, pageErrors;
const input = (title, extra = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 60, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, lessonId: null, recordIds: [] }, reminder: null, calendar: { allDay: false, notes: '', tags: [] }, ...extra });
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
async function manage(page, name) {
  await page.getByRole('button', { name: '日程管理', exact: true }).click();
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

test('提醒按需配置，关闭浏览器后补呈现原时间，计划不被通知改写', async ({ page, browser }) => {
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('函数课堂');
  await page.locator('[name=entry-start]').fill('15:00');
  await expect.poll(async () => (await saved('函数课堂'))?.time.startTime).toBe('15:00');
  await action(page, '设置提醒');
  const dialog = page.getByRole('dialog', { name: '提醒', exact: true });
  await dialog.getByLabel('提醒时机').selectOption('after');
  await dialog.getByLabel('分钟数').click(); await dialog.getByLabel('分钟数').fill('15');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await saved('函数课堂'))?.reminder).toEqual({ side: 'after', minutes: 15 });
  await page.getByRole('button', { name: '结束后 15 分钟提醒', exact: true }).click();
  await dialog.getByLabel('提醒时机').selectOption('before'); await dialog.getByLabel('分钟数').fill('10');
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

test('教学关联实际提供方、换班清记录、单次例外保留记录且不改模板', async ({ page }) => {
  const first = await call('POST', C, { name: '高一（1）班' }); const second = await call('POST', C, { name: '高一（2）班' });
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '函数单调性', intro: { version: 1, blocks: [] }, sections: [], materials: [] });
  const actual = await call('POST', R, record(first.id, [], '一班已讲到函数定义'));
  const other = await call('POST', R, record(second.id, [], '二班还需要复习'));
  const task = await call('POST', E, input('重复课堂', { repeat: { until: '2026-10-09' } }));
  await page.reload(); await open(page, '重复课堂'); await action(page, '教学关联');
  let dialog = page.getByRole('dialog', { name: '教学关联', exact: true });
  await dialog.getByLabel('班级', { exact: true }).selectOption(first.id);
  await dialog.getByLabel('备课', { exact: true }).selectOption(lesson.id);
  await dialog.getByRole('checkbox', { name: /一班已讲到函数定义/ }).check();
  await shot(page, 'course-desktop');
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-25`)).course.recordIds).toEqual([actual.id]);
  expect((await call('GET', `${E}/${task.id}`)).course.recordIds).toEqual([]);
  await page.reload(); await action(page, '教学关联');
  await expect(dialog.getByRole('checkbox', { name: /一班已讲到函数定义/ })).toBeChecked();
  await dialog.getByLabel('班级', { exact: true }).selectOption(second.id);
  await expect(dialog.getByRole('checkbox', { name: /一班已讲到函数定义/ })).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: /二班还需要复习/ }).check();
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-25`)).course.recordIds).toEqual([other.id]);
  expect((await call('GET', `${R}/${actual.id}`)).note).toBe(actual.note);
  expect((await call('GET', `${R}/${other.id}`)).version).toBe(other.version);
});

test('已删除与单次取消可找回，恢复响应丢失后刷新原键确认', async ({ page }) => {
  const task = await call('POST', E, input('可以找回的课堂'));
  await page.reload(); await open(page, task.title); await action(page, '删除任务');
  await page.getByRole('dialog', { name: '删除任务', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  await manage(page, '已删除任务'); await page.getByRole('dialog', { name: '已删除任务' }).getByRole('button', { name: /可以找回/ }).click();
  await page.route(`**${E}/${task.id}/deletion`, async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: '恢复任务', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.unroute(`**${E}/${task.id}/deletion`); await page.reload();
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);
  expect((await call('GET', `${E}/${task.id}`)).version).toBe(3);
  await close(page);
  const series = await call('POST', E, input('每周课堂', { repeat: { until: '2026-10-09' } }));
  await page.reload(); await open(page, series.title); await action(page, '删除任务');
  await page.getByRole('dialog', { name: '删除任务', exact: true }).getByRole('button', { name: '仅此任务', exact: true }).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0); await manage(page, '已删除任务');
  await page.getByRole('dialog', { name: '已删除任务' }).getByRole('button', { name: /每周课堂/ }).click();
  await page.getByRole('button', { name: '恢复这次任务', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue(series.title);
  expect((await call('GET', `${E}/${series.id}/occurrence?originDate=2026-09-25`)).state).toBe('active');
});

test('未排期、多事项排序与优先级，原子移动只搬单项且未知结果可恢复', async ({ page }) => {
  const before = (await call('GET', E)).items.length;
  await manage(page, '新建未排期任务'); await close(page);
  expect((await call('GET', E)).items).toHaveLength(before);
  await manage(page, '新建未排期任务');
  await page.locator('[name=entry-title]').fill('周末准备');
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 1', { exact: true }).pressSequentially('整理函数例题');
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 2', { exact: true }).fill('准备练习讲义');
  await expect.poll(async () => (await saved('周末准备'))?.items.length).toBe(2);
  expect((await saved('周末准备')).time).toBeNull();
  await page.getByRole('button', { name: '事项 2 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '上移', exact: true }).click();
  await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('准备练习讲义');
  await expect.poll(async () => (await saved('周末准备'))?.items[0].text).toBe('准备练习讲义');
  await close(page); await manage(page, '优先事项');
  await page.getByLabel('优先级 整理函数例题', { exact: true }).selectOption('high');
  await expect.poll(async () => (await saved('周末准备'))?.items[1].priority).toBe('high');
  await page.getByRole('button', { name: '安排时间', exact: true }).click();
  await expect.poll(async () => Boolean((await saved('周末准备'))?.time)).toBeTruthy();
  await action(page, '移回未排期');
  await page.getByRole('dialog', { name: '移回未排期' }).getByRole('button', { name: '移回未排期', exact: true }).click();
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

test('显示时区保存刷新不移动课程，新任务采用新时区，夏令时结束按实际分钟显示', async ({ page }) => {
  const task = await call('POST', E, input('跨时区课堂', { repeat: { until: '2026-10-09' } }));
  const original = await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-25`);
  await manage(page, '显示时区');
  const dialog = page.getByRole('dialog', { name: '显示时区', exact: true });
  await dialog.getByLabel('账户显示时区').selectOption('America/New_York');
  await dialog.getByRole('button', { name: '保存时区', exact: true }).click();
  await expect.poll(async () => (await call('GET', '/api/modules/schedule/settings')).timeZone).toBe('America/New_York');
  await page.reload(); await manage(page, '显示时区');
  await expect(dialog.getByLabel('账户显示时区')).toHaveValue('America/New_York');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  const after = await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-25`);
  expect(after.startsAt).toBe(original.startsAt); expect(after.time).toEqual(original.time); expect(after.entryVersion).toBe(original.entryVersion);
  await open(page, task.title); await expect(page.getByText('排课时区：Asia/Shanghai', { exact: true })).toBeVisible(); await close(page);
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('纽约新任务');
  await expect.poll(async () => (await saved('纽约新任务'))?.time.timeZone).toBe('America/New_York');
  await close(page);
  const dst = await call('POST', E, input('夏令时课堂', { time: { date: '2026-11-01', startTime: '00:30', durationMinutes: 120, timeZone: 'America/New_York' } }));
  await page.goto(`${world.origin}/calendar?entry=${dst.id}`);
  await expect(page.locator('[name=entry-end]')).toHaveValue('01:30');
  await page.locator('[name=entry-end]').fill('03:30');
  await expect.poll(async () => (await call('GET', `${E}/${dst.id}`)).time.durationMinutes).toBe(240);
  await page.reload(); await expect(page.locator('[name=entry-end]')).toHaveValue('03:30');
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
  await action(page, '教学关联'); await shot(page, 'dark-mobile-course');
  await page.getByRole('dialog', { name: '教学关联' }).getByRole('button', { name: '取消', exact: true }).click();
  await page.setViewportSize({ width: 1675, height: 950 });
  await page.route(`**${E}/${task.id}`, async route => { if (route.request().method() !== 'PUT') return route.continue(); await route.fetch(); await route.abort('failed'); });
  await page.locator('[name=entry-title]').fill('账户甲未确认标题');
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.locator('[name=entry-title]').fill('账户甲后续草稿');
  await page.getByRole('link', { name: /^账户：/ }).click(); await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await registerMath(world, 'schedule-other@example.test'); await login(page, 'schedule-other@example.test');
  await expect(page.locator('[name=entry-title]')).toHaveCount(0); await expect(page.getByRole('button', { name: '重试确认', exact: true })).toHaveCount(0);
  await expect(page.locator('.cal-upcoming-row')).toHaveCount(0);
  await page.getByRole('link', { name: /^账户：/ }).click(); await page.getByRole('button', { name: '退出登录', exact: true }).click();
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
  await expect(page.getByRole('alert')).toContainText('提醒时间已过去');
  expect((await call('GET', `${E}/${source.id}`)).reminder).toBeNull();
  await page.getByRole('button', { name: '结束前 180 分钟提醒', exact: true }).click();
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

test('时区旧成功回执确认后读取当前设置，通知和日历使用同一时区', async ({ page }) => {
  await call('POST', E, input('时区通知', { reminder: { side: 'before', minutes: 10 } }));
  await manage(page, '显示时区');
  const dialog = page.getByRole('dialog', { name: '显示时区', exact: true });
  await dialog.getByLabel('账户显示时区').selectOption('America/New_York');
  await page.route('**/api/modules/schedule/settings', async route => { if (route.request().method() !== 'PUT') return route.continue(); await route.fetch(); await route.abort('failed'); });
  await dialog.getByRole('button', { name: '保存时区', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  const settings = await call('GET', '/api/modules/schedule/settings');
  await call('PUT', '/api/modules/schedule/settings', { expectedVersion: settings.version, timeZone: 'UTC' });
  await page.unroute('**/api/modules/schedule/settings');
  await dialog.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.getByRole('button', { name: 'UTC', exact: true })).toBeVisible();
  now = '2026-09-25T09:00:00Z';
  // 通知每 30 秒读取一次；等待真实请求，不伪造 focus/visibility 事件。
  await page.waitForResponse(response => response.url().endsWith(N) && response.ok(), { timeout: 35000 });
  await page.getByRole('button', { name: /^通知/ }).click();
  const notices = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '通知', exact: true }) });
  await expect(notices.getByRole('button', { name: /时区通知/ })).toContainText('9/25 07:50');
});

test('跨时区全天卡片真实向后拖一天，保留排课时区且日期确实移动', async ({ page }) => {
  const settings = await call('GET', '/api/modules/schedule/settings');
  await call('PUT', '/api/modules/schedule/settings', { expectedVersion: settings.version, timeZone: 'America/New_York' });
  const task = await call('POST', E, input('全天时区', { time: { date: '2026-09-25', startTime: '00:00', durationMinutes: 1440, timeZone: 'Asia/Shanghai' }, calendar: { allDay: true, notes: '', tags: [] } }));
  await page.reload();
  await page.getByRole('button', { name: '日历视图', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /^周\s/ }).click();
  const event = page.locator('.fc-daygrid-event').filter({ hasText: task.title });
  await expect(event).toBeVisible();
  const box = await event.boundingBox(); const col = await page.locator('.fc-col-header-cell').first().boundingBox();
  await page.mouse.move(box.x + 35, box.y + 10); await page.mouse.down();
  await page.mouse.move(box.x + 35 + col.width, box.y + 10, { steps: 24 }); await page.mouse.up();
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
