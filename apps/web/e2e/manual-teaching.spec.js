import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, seedLegacy, C, R, record } from '../../api/test/teaching-time-classes-materials-fixture.js';

const evidence = path.resolve('docs/acceptance/evidence/MANUAL-TEACHING/v1/browser');
const E = '/api/modules/schedule/entries';
let world, call, client, businessNow;
const workbenchClock = () => new Date(businessNow);
test.beforeEach(async ({ page }) => {
  businessNow = '2026-09-23T06:00:00Z';
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'mt-')), workbenchClock });
  world.clock.set('2026-09-23T06:00:00Z');
  ({ client } = await registerMath(world, 'manual-teaching@example.test'));
  call = http(client);
  await page.goto(world.origin);
  await page.getByLabel('邮箱', { exact: true }).fill('manual-teaching@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
});
test.afterEach(async ({ context }) => { await context.close(); await world?.close(); });
const entry = (overrides = {}) => ({ title: '函数课程', items: [],
  time: { date: '2026-09-23', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, lessonId: null, recordIds: [] }, reminder: null, ...overrides });
async function open(page, value, on = null) {
  await page.goto(`${world.origin}/calendar?entry=${value.id}${on ? `&on=${on}` : ''}`);
  await expect(page.locator('[name=entry-title]')).toHaveValue(value.title);
}
async function save(page) {
  await page.locator('[data-region=entry-editor]').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('[data-region=save-state]')).toHaveText('已保存');
}
async function shot(page, name) {
  fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, `${name}.png`), animations: 'disabled' });
}

test('任意提醒分钟可编辑并保存重开', async ({ page }) => {
  const value = await call('POST', E, entry(), 201);
  await open(page, value);
  await page.getByLabel('提醒方式').selectOption('after');
  await shot(page, 'reminder-control');
  await expect(page.getByRole('spinbutton', { name: '提醒分钟', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: '提醒分钟', exact: true }).fill('20');
  await save(page);
  await page.reload();
  await expect(page.getByLabel('提醒分钟', { exact: true })).toHaveValue('20');
  expect((await call('GET', `${E}/${value.id}`)).reminder).toEqual({ side: 'after', minutes: 20 });
});

test('重复课程整组可以调整班级和备课，单次例外保持原关联', async ({ page }) => {
  const first = await call('POST', C, { name: '高一一班' }, 201);
  const second = await call('POST', C, { name: '高一二班' }, 201);
  const value = await call('POST', E, entry({ repeat: { until: '2026-10-21' },
    course: { classId: first.id, lessonId: null, recordIds: [] } }), 201);
  await open(page, value, '2026-09-23');
  await page.locator('[name=entry-title]').fill('本次临时课程');
  await save(page);
  await page.getByRole('button', { name: '整组', exact: true }).click();
  await shot(page, 'repeating-group');
  await expect(page.locator('[name=class-select]')).toBeVisible();
  await page.locator('[name=class-select]').selectOption(second.id);
  await save(page);
  expect((await call('GET', `${E}/${value.id}`)).course.classId).toBe(second.id);
  expect((await call('GET', `${E}/${value.id}/occurrence?originDate=2026-09-23`)).course.classId).toBe(first.id);
});

test('已设提醒和实际记录的安排可以移回未排期', async ({ page }) => {
  const classroom = await call('POST', C, { name: '高一一班' }, 201);
  const note = await call('POST', R, record(classroom.id, [], '例二待补充'), 201);
  const value = await call('POST', E, entry({ reminder: { side: 'before', minutes: 10 },
    course: { classId: classroom.id, lessonId: null, recordIds: [note.id] } }), 201);
  await open(page, value);
  await page.getByRole('checkbox', { name: '暂不安排时间' }).check();
  await save(page);
  const saved = await call('GET', `${E}/${value.id}`);
  expect(saved.time).toBeNull(); expect(saved.reminder).toBeNull(); expect(saved.course.recordIds).toEqual([]);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '暂不安排时间' })).toBeChecked();
});

test('备课显示分班反馈并回到原教学记录', async ({ page }) => {
  const lesson = await call('POST', '/api/modules/lessons/v3', {
    title: '函数单调性', intro: { version: 1, blocks: [] }, sections: [], materials: []
  }, 201);
  for (const [name, note] of [['高一一班', '例二待补充'], ['高一二班', '定义已讲完']]) {
    const classroom = await call('POST', C, { name }, 201);
    await call('POST', R, record(classroom.id, [{ kind: 'lesson', id: lesson.id }], note), 201);
  }
  await page.goto(`${world.origin}/lessons/${lesson.id}`);
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('函数单调性');
  await shot(page, 'lesson-feedback-entry');
  await page.getByText('教学反馈', { exact: true }).click();
  const panel = page.locator('[data-region=source-records-panel]');
  await expect(panel).toContainText('高一一班'); await expect(panel).toContainText('高一二班');
  await panel.getByRole('button').filter({ hasText: '例二待补充' }).click();
  await expect(page.getByLabel('编辑记录内容', { exact: true })).toHaveValue('例二待补充');
});

test('日程可选当前备课与含数学作品的实际记录', async ({ page }) => {
  const seeded = await seedLegacy(client);
  const value = await call('POST', E, entry({ course: { classId: seeded.classroom.id, lessonId: null, recordIds: [] } }), 201);
  await open(page, value);
  await expect(page.locator('[name=lesson-select] option').filter({ hasText: seeded.lesson.title })).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: /旧库数学引用/ })).toBeVisible();
  await page.locator('[name=lesson-select]').selectOption(seeded.lesson.id);
  await page.getByRole('checkbox', { name: /旧库数学引用/ }).check();
  await save(page);
  const saved = await call('GET', `${E}/${value.id}`);
  expect(saved.course.lessonId).toBe(seeded.lesson.id);
  expect(saved.course.recordIds).toContain(seeded.mixed.id);
});

async function range(page, from, to) {
  await page.locator('[name=range-from]').fill(from);
  await page.locator('[name=range-to]').fill(to);
  await page.locator('[data-action=apply-range]').click();
  await expect(page.locator('[data-region=range-label]')).toContainText(`${Number(from.slice(5, 7))}月${Number(from.slice(8))}日`);
}
async function dragTime(page, date, hour = 15) {
  const column = page.locator(`[data-region=day-column][data-day="${date}"]`);
  await column.locator(`[data-hour="${hour}"]`).scrollIntoViewIfNeeded();
  const start = await column.locator(`[data-hour="${hour}"]`).boundingBox();
  const end = await column.locator(`[data-hour="${hour + 1}"]`).boundingBox();
  await page.mouse.move(start.x + 40, start.y + start.height / 12);
  await page.mouse.down();
  await page.mouse.move(end.x + 40, end.y + end.height * 35 / 60, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('[name=entry-duration]')).toHaveValue('90');
}

test('任意连续日期拖选、多事项顺序与优先级、未排期移入移出、保存重开', async ({ page }) => {
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await range(page, '2026-09-23', '2026-10-03');
  await expect(page.locator('[name=range-days]')).toHaveValue('11');
  await dragTime(page, '2026-09-23');
  await page.locator('[name=entry-title]').fill('多事项备课');
  await page.getByLabel('事项 1', { exact: true }).fill('先看教材');
  await page.getByLabel('优先级 1', { exact: true }).selectOption('low');
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 2', { exact: true }).fill('再选例题');
  await page.getByLabel('优先级 2', { exact: true }).selectOption('high');
  await page.getByRole('button', { name: '上移', exact: true }).nth(1).click();
  await save(page);
  const saved = (await call('GET', E)).items.find(x => x.title === '多事项备课');
  expect(saved.items.map(x => [x.text, x.priority])).toEqual([['再选例题', 'high'], ['先看教材', 'low']]);
  await page.reload();
  await expect(page.getByLabel('事项 1', { exact: true })).toHaveValue('再选例题');
  await expect(page.getByLabel('优先级 2', { exact: true })).toHaveValue('low');
  await page.locator('[data-action=new-unscheduled]').click();
  await page.getByLabel('事项 1', { exact: true }).fill('打印练习');
  await save(page);
  const pending = page.locator('[data-region=unscheduled] [data-item-id]').filter({ hasText: '打印练习' });
  await expect(pending).toBeVisible();
  await pending.getByRole('combobox').selectOption(saved.id);
  await pending.getByRole('button', { name: '移入', exact: true }).click();
  await expect(pending).toHaveCount(0);
  await page.getByRole('button', { name: '15:00 多事项备课', exact: true }).click();
  await expect(page.getByLabel('事项 3', { exact: true })).toHaveValue('打印练习');
  await page.getByRole('button', { name: '移回未排期', exact: true }).nth(2).click();
  await expect(page.locator('[data-region=unscheduled]')).toContainText('打印练习');
  await shot(page, 'items-priority-move');
});

test('无标题未排期事项可从列表直接编辑', async ({ page }) => {
  const value = await call('POST', E, entry({ title: '', time: null,
    items: [{ id: randomUUID(), text: '准备教具', priority: 'normal' }] }), 201);
  await page.goto(world.origin + '/calendar');
  const pending = page.locator('[data-region=unscheduled]');
  await expect(pending.getByRole('button', { name: '准备教具', exact: true })).toBeVisible();
  await pending.getByRole('button', { name: '准备教具', exact: true }).click();
  await page.getByLabel('事项 1', { exact: true }).fill('准备三角板');
  await save(page);
  expect((await call('GET', `${E}/${value.id}`)).items[0].text).toBe('准备三角板');
});

test('保存后恢复某次原安排不会显示旧的已保存草稿', async ({ page }) => {
  const value = await call('POST', E, entry({ repeat: { until: '2026-10-07' } }), 201);
  await open(page, value, '2026-09-23');
  await page.locator('[name=entry-title]').fill('单次调课');
  await page.locator('[name=entry-date]').fill('2026-09-24');
  await save(page);
  await page.getByRole('button', { name: '恢复原安排', exact: true }).first().click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('函数课程');
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-09-23');
  await page.reload();
  await expect(page.locator('[name=entry-title]')).toHaveValue('函数课程');
});

test('相对结束提醒随调时变化，关闭后补提醒保留原时刻并定位返回', async ({ page, browser }) => {
  const value = await call('POST', E, entry(), 201);
  await open(page, value);
  await page.getByLabel('提醒方式').selectOption('before');
  await page.getByLabel('提醒分钟', { exact: true }).fill('10');
  await save(page);
  await page.locator('[name=entry-start]').fill('16:00');
  await save(page);
  await expect(page.locator('[data-region=reminder-instant]')).toContainText('17:20');
  await call('POST', E, entry({ title: '课后整理', reminder: { side: 'after', minutes: 20 } }), 201);
  await call('POST', E, entry({ title: '静默安排' }), 201);
  const storageState = await page.context().storageState();
  const directory = world.directory;
  await page.close();
  await world.close();
  businessNow = '2026-09-23T09:30:00Z';
  world = await createIntegration({ directory, workbenchClock });
  world.clock.set('2026-09-23T09:30:00Z');
  const context = await browser.newContext({ storageState, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  try {
    const reopened = await context.newPage();
    await reopened.goto(world.origin + '/classes');
    await reopened.getByRole('button', { name: /^通知/ }).click();
    const notices = reopened.locator('[data-notification-id]');
    await expect(notices).toHaveCount(2);
    await expect(notices.filter({ hasText: '函数课程' }).locator('time')).toHaveAttribute('datetime', '2026-09-23T09:20:00Z');
    await expect(notices.filter({ hasText: '课后整理' }).locator('time')).toHaveAttribute('datetime', '2026-09-23T08:50:00Z');
    await shot(reopened, 'catch-up-notifications');
    await notices.filter({ hasText: '函数课程' }).click();
    await expect(reopened).toHaveURL(new RegExp(`entry=${value.id}`));
    await expect(reopened.locator('[name=entry-start]')).toHaveValue('16:00');
    await reopened.locator('[data-action=cancel]').click();
    await reopened.getByRole('button', { name: /^通知/ }).click();
    await reopened.locator('[data-notification-id]').filter({ hasText: '函数课程' }).click();
    await expect(reopened.locator('[name=entry-start]')).toHaveValue('16:00');
    await reopened.getByRole('button', { name: /^通知/ }).click();
    await expect(reopened.locator('[data-notification-id][data-unread=false]')).toHaveCount(1);
    await reopened.getByRole('button', { name: '清空', exact: true }).click();
    await expect(reopened.getByText('暂无通知', { exact: true })).toBeVisible();
    await reopened.reload();
    await reopened.getByRole('button', { name: /^通知/ }).click();
    await expect(reopened.getByText('暂无通知', { exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test('班级管理、一句话后补充进度问题和三类关联、保存重开', async ({ page }) => {
  const seeded = await seedLegacy(client);
  await page.locator('.wb-sidebar').getByRole('link', { name: '班级教学', exact: true }).click();
  await page.getByRole('button', { name: '新建班级', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('高二一班');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByLabel('写一句', { exact: true }).fill('定义中的任意性还需强调');
  await page.locator('[data-region=record-composer]').getByRole('button', { name: '保存', exact: true }).click();
  const row = page.locator('[data-region=record-rows] [data-record-id]').first();
  await expect(row).toContainText('定义中的任意性还需强调');
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  const editor = page.locator('[data-region=record-editor]');
  await editor.getByLabel('教学位置', { exact: true }).fill('第一章例2');
  await editor.getByLabel('未讲内容', { exact: true }).fill('例3');
  await editor.getByLabel('共性问题', { exact: true }).fill('量词与定义域');
  await editor.getByLabel('下次备注', { exact: true }).fill('补充反例');
  await editor.getByRole('button', { name: '关联资料', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '关联资料' });
  await picker.locator(`[data-source-id="${seeded.lesson.id}"]`).click();
  await picker.getByRole('tab', { name: '题目', exact: true }).click();
  await picker.locator(`[data-source-id="${seeded.item.id}"]`).click();
  await picker.getByRole('tab', { name: '数学作品', exact: true }).click();
  await picker.locator(`[data-source-id="${seeded.math.id}"]`).click();
  await picker.getByRole('button', { name: '确定', exact: true }).click();
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await expect(editor).toContainText('已保存');
  const recordId = await row.getAttribute('data-record-id');
  const saved = await call('GET', `${R}/${recordId}`);
  expect(saved.sources.map(s => s.kind)).toEqual(['lesson', 'question', 'math']);
  await page.reload();
  await expect(page.getByLabel('教学位置', { exact: true })).toHaveValue('第一章例2');
  await expect(page.getByLabel('共性问题', { exact: true })).toHaveValue('量词与定义域');
  await expect(page.locator('[data-region=latest-position]')).toContainText('第一章例2');
  await page.getByRole('button', { name: '改名', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('高二实验班');
  await page.locator('[name=save-class-name]').click();
  await expect(page.getByRole('heading', { name: '高二实验班', exact: true })).toBeVisible();
  await shot(page, 'class-complete-record');
  await page.locator('[name=delete-class]').click();
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('[data-region=class-deleted-note]')).toBeVisible();
  await expect(page.locator('[data-region=record-editor]')).toHaveCount(0);
  await expect(page.locator('[name=record-open]')).toHaveCount(0);
  await page.getByRole('button', { name: '恢复班级', exact: true }).click();
  await expect(page.locator('[data-region=class-deleted-note]')).toHaveCount(0);
  expect((await call('GET', `${R}/${recordId}`)).note).toBe('定义中的任意性还需强调');
});

test('日程删除后有可发现的恢复入口', async ({ page }) => {
  const value = await call('POST', E, entry(), 201);
  await open(page, value);
  await page.getByRole('button', { name: '删除安排', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复安排', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  // Leave the notification/deep-link route to check the ordinary page entry.
  await page.goto(world.origin + '/calendar');
  await expect(page.getByRole('button', { name: /^已删除安排/ })).toBeVisible();
  await page.getByRole('button', { name: /^已删除安排/ }).click();
  await page.locator('[data-region=deleted-entries]').getByRole('button', { name: '函数课程', exact: true }).click();
  await page.getByRole('button', { name: '恢复安排', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('函数课程');
  expect((await call('GET', `${E}/${value.id}`)).deletedAt).toBeNull();
});

test('编辑日期与提醒时的暂时空值保留页面和草稿', async ({ page }) => {
  const value = await call('POST', E, entry({ reminder: { side: 'before', minutes: 10 } }), 201);
  await open(page, value);
  await page.locator('[name=entry-date]').fill('');
  await expect(page.locator('[name=entry-title]')).toHaveValue('函数课程');
  await page.locator('[name=entry-date]').fill('2026-09-24');
  await page.getByLabel('提醒分钟', { exact: true }).fill('');
  await page.locator('[data-action=save]').click();
  await expect(page.locator('[data-region=save-state]')).toContainText('提醒间隔');
  await page.getByLabel('提醒分钟', { exact: true }).fill('1e20');
  await expect(page.locator('[name=entry-title]')).toHaveValue('函数课程');
  await page.getByLabel('提醒分钟', { exact: true }).fill('25');
  await save(page);
  expect((await call('GET', `${E}/${value.id}`)).reminder.minutes).toBe(25);
});

test('重复课程课后记录独立保存并关联回本次安排与备课', async ({ page }) => {
  const classroom = await call('POST', C, { name: '高一反馈班' }, 201);
  const lesson = await call('POST', '/api/modules/lessons/v3', {
    title: '本周备课', intro: { version: 2, blocks: [] }, sections: [], materials: []
  }, 201);
  const value = await call('POST', E, entry({ repeat: { until: '2026-10-07' },
    course: { classId: classroom.id, lessonId: lesson.id, recordIds: [] } }), 201);
  await open(page, value, '2026-09-23');
  await page.getByRole('button', { name: '记课后情况', exact: true }).click();
  await page.getByLabel('写一句', { exact: true }).fill('本班例二未讲，需补充反例');
  await page.locator('[data-region=record-composer]').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('记录已保存，尚未关联安排', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关联回本次安排', exact: true }).click();
  await expect(page.getByText('记录已保存并关联安排', { exact: true })).toBeVisible();
  const actual = await call('GET', `${E}/${value.id}/occurrence?originDate=2026-09-23`);
  expect(actual.course.recordIds).toHaveLength(1);
  expect((await call('GET', `${E}/${value.id}/occurrence?originDate=2026-09-30`)).course.recordIds).toEqual([]);
  await page.goto(`${world.origin}/lessons/${lesson.id}`);
  await page.getByText('教学反馈', { exact: true }).click();
  await expect(page.locator('[data-region=source-records-panel]')).toContainText('本班例二未讲，需补充反例');
});

test('日程保存慢响应不会串写后来打开的安排', async ({ page }) => {
  const first = await call('POST', E, entry({ title: '先保存的安排' }), 201);
  const second = await call('POST', E, entry({ title: '后打开的安排', time: { ...entry().time, startTime: '18:00' } }), 201);
  await open(page, first);
  let release, committed;
  const gate = new Promise(resolve => { release = resolve; });
  const done = new Promise(resolve => { committed = resolve; });
  await page.route(`**${E}/${first.id}`, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    const response = await route.fetch(); committed(); await gate;
    await route.fulfill({ response });
  });
  await page.locator('[name=entry-title]').fill('先保存的安排已修改');
  await page.locator('[data-action=save]').click();
  await done;
  await page.getByRole('button', { name: '18:00 后打开的安排', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('后打开的安排');
  const delivered = page.waitForResponse(r => r.url().endsWith(`${E}/${first.id}`) && r.request().method() === 'PUT');
  release(); await delivered;
  await page.locator('[name=entry-title]').fill('后打开的安排已修改');
  await save(page);
  expect((await call('GET', `${E}/${first.id}`)).title).toBe('先保存的安排已修改');
  expect((await call('GET', `${E}/${second.id}`)).title).toBe('后打开的安排已修改');
});

test('日程关联读取失败明确提示并允许原地重试', async ({ page }) => {
  const seeded = await seedLegacy(client);
  const value = await call('POST', E, entry({ course: { classId: seeded.classroom.id, lessonId: null, recordIds: [] } }), 201);
  await page.route('**/api/modules/classes/v2/records?**', route => route.abort('failed'));
  await open(page, value);
  await expect(page.getByText('实际记录读取失败', { exact: true })).toBeVisible();
  await expect(page.getByText('本班还没有实际记录', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/modules/classes/v2/records?**');
  await page.getByRole('button', { name: '重试关联资料', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /旧库数学引用/ })).toBeVisible();
});

test('页面新建周重复课程、单次调课与取消恢复不改其他周', async ({ page }) => {
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await range(page, '2026-09-23', '2026-10-08');
  await dragTime(page, '2026-09-23');
  await page.locator('[name=entry-title]').fill('每周数学课');
  await page.getByRole('checkbox', { name: '每周重复', exact: true }).check();
  await page.locator('[name=repeat-until]').fill('2026-10-07');
  await save(page);
  const value = (await call('GET', E)).items.find(x => x.title === '每周数学课');
  let occurrences = (await call('GET', '/api/modules/schedule/occurrences?from=2026-09-23&to=2026-10-08')).items;
  expect(occurrences.map(x => x.key.originDate)).toEqual(['2026-09-23', '2026-09-30', '2026-10-07']);
  await open(page, value, '2026-09-30');
  await page.locator('[name=entry-date]').fill('2026-10-01');
  await page.locator('[name=entry-start]').fill('10:00');
  await save(page);
  await page.reload();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-10-01');
  expect((await call('GET', `${E}/${value.id}/occurrence?originDate=2026-10-07`)).time.startTime).toBe('15:00');
  await page.locator('[data-action=cancel-instance]').click();
  await expect(page.getByText('安排已取消', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '恢复原安排', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue('2026-09-30');
  await expect(page.locator('[name=entry-start]')).toHaveValue('15:00');
  await shot(page, 'weekly-single-restore');
});

test('移回未排期丢响应后用原请求确认，不重复移动', async ({ page }) => {
  const value = await call('POST', E, entry({ items: [{ id: randomUUID(), text: '待调整事项', priority: 'high' }] }), 201);
  await open(page, value);
  const requests = [];
  let dropped = false;
  await page.route('**/api/modules/schedule/item-moves', async route => {
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (dropped) return route.continue();
    dropped = true; await route.fetch(); await route.abort('failed');
  });
  await page.getByRole('button', { name: '移回未排期', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试移回未排期', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试移回未排期', exact: true }).click();
  await expect(page.locator('[data-region=unscheduled]')).toContainText('待调整事项');
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]);
  expect((await call('GET', E + '?placement=unscheduled')).items).toHaveLength(1);
});

test('日程丢失保存响应后刷新保留新输入，并用原键原体确认', async ({ page }) => {
  const value = await call('POST', E, entry(), 201);
  await open(page, value);
  let release, committed;
  const gate = new Promise(resolve => { release = resolve; });
  const done = new Promise(resolve => { committed = resolve; });
  const requests = [];
  await page.route(`**${E}/${value.id}`, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (requests.length > 1) return route.continue();
    await route.fetch(); committed(); await gate; await route.abort('failed');
  });
  await page.locator('[name=entry-title]').fill('原提交');
  await page.locator('[data-action=save]').click(); await done;
  await page.locator('[name=entry-title]').fill('保存期间的新输入'); release();
  await expect(page.getByRole('button', { name: '用原请求重试', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('[name=entry-title]')).toHaveValue('保存期间的新输入');
  await page.getByRole('button', { name: '用原请求重试', exact: true }).click();
  await expect(page.locator('[data-region=save-state]')).toContainText('仍有未保存修改');
  expect(requests[1]).toEqual(requests[0]);
  expect((await call('GET', `${E}/${value.id}`)).title).toBe('原提交');
  await save(page);
  expect((await call('GET', `${E}/${value.id}`)).title).toBe('保存期间的新输入');
});

test('平板日程编辑与通知布局可操作且无整页横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const value = await call('POST', E, entry({ items: [
    { id: randomUUID(), text: '第一件事项', priority: 'high' },
    { id: randomUUID(), text: '第二件事项', priority: 'normal' }
  ] }), 201);
  await open(page, value);
  await page.getByLabel('提醒方式').selectOption('after');
  await page.getByLabel('提醒分钟', { exact: true }).fill('20');
  await save(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await shot(page, 'schedule-tablet');
  await page.getByRole('button', { name: /^通知/ }).click();
  await expect(page.getByText('暂无通知', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('离开后返回的未保存日程草稿不能覆盖期间的服务器变更', async ({ page }) => {
  const value = await call('POST', E, entry(), 201);
  await open(page, value);
  await page.locator('[name=entry-title]').fill('本地未保存改名');
  await page.locator('[data-action=cancel]').click();
  await call('PUT', `${E}/${value.id}`, { ...entry({ title: '另一窗口修改' }), expectedVersion: value.version });
  await page.reload();
  // Deep-link opening reads the current server object while restoring the draft.
  await expect(page.locator('[name=entry-title]')).toHaveValue('本地未保存改名');
  await page.locator('[data-action=save]').click();
  await expect(page.locator('[data-region=save-state]')).toContainText('内容已在别处修改');
  expect((await call('GET', `${E}/${value.id}`)).title).toBe('另一窗口修改');
});

test('新建保存慢响应后切换安排，后写草稿跟随真实ID恢复', async ({ page }) => {
  const other = await call('POST', E, entry({ title: '另一安排', time: { ...entry().time, startTime: '18:00' } }), 201);
  await open(page, other);
  await page.locator('[data-action=new-unscheduled]').click();
  await page.locator('[name=entry-title]').fill('临时安排已提交');
  let release, committed;
  const gate = new Promise(resolve => { release = resolve; });
  const done = new Promise(resolve => { committed = resolve; });
  await page.route(`**${E}`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); committed(); await gate; await route.fulfill({ response });
  });
  await page.locator('[data-action=save]').click(); await done;
  await page.locator('[name=entry-title]').fill('提交期间后写标题');
  await page.getByRole('button', { name: '18:00 另一安排', exact: true }).click();
  const delivered = page.waitForResponse(r => r.url().endsWith(E) && r.request().method() === 'POST');
  release(); await delivered;
  await page.locator('[data-region=unscheduled]').getByRole('button', { name: '临时安排已提交', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('提交期间后写标题');
  await save(page);
  expect((await call('GET', E + '?placement=unscheduled')).items[0].title).toBe('提交期间后写标题');
});

test('移入请求途中刷新后即使源事项已消失仍可按原键原体确认', async ({ page }) => {
  const target = await call('POST', E, entry(), 201);
  await call('POST', E, entry({ title: '', time: null, items: [{ id: randomUUID(), text: '待移入事项', priority: 'normal' }] }), 201);
  await open(page, target);
  let release, committed;
  const gate = new Promise(resolve => { release = resolve; });
  const done = new Promise(resolve => { committed = resolve; });
  const requests = [];
  await page.route('**/api/modules/schedule/item-moves', async route => {
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (requests.length > 1) return route.continue();
    const response = await route.fetch(); committed(); await gate;
    await route.fulfill({ response }).catch(() => {}); // Original document was closed by the user.
  });
  const row = page.locator('[data-region=unscheduled] [data-item-id]');
  await row.getByRole('combobox').selectOption(target.id);
  await row.getByRole('button', { name: '移入', exact: true }).click(); await done;
  await page.reload(); release();
  await expect(page.locator('[data-region=unscheduled] [data-item-id]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试移入时间段', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试移入时间段', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试移入时间段', exact: true })).toHaveCount(0);
  expect(requests[1]).toEqual(requests[0]);
  expect((await call('GET', `${E}/${target.id}`)).items).toHaveLength(1);
});
