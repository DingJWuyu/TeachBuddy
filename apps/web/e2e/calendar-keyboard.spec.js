import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
test.use({ timezoneId: 'Asia/Shanghai' });

const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
let world, client, errors;
const content = (title, pending = false) => ({ title, items: [],
  time: pending ? null : { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, course: { classId: null, lessonId: null, recordIds: [] },
  calendar: { allDay: false, tags: [], notes: '' } });
async function call(method, url, body) {
  const response = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(response.status, JSON.stringify(response.json)).toBeLessThan(300);
  return response.json;
}
async function open(page, task) {
  await page.goto(`${world.origin}/calendar?entry=${task.id}`);
  await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);
}
async function create(page, pending) {
  await page.getByRole('button', { name: pending ? '新建待安排任务' : '新建任务', exact: true }).click();
}
async function action(page, name) {
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-25T06:00:00Z'));
  errors = []; page.on('pageerror', error => errors.push(error.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-keyboard-')),
    workbenchClock: () => new Date('2026-09-25T06:00:00Z') });
  ({ client } = await registerMath(world, 'schedule-keyboard@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-keyboard@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
});
test.afterEach(async ({ context }, info) => {
  const failed = info.status !== info.expectedStatus || errors.length;
  if (failed) {
    fs.writeFileSync(info.outputPath('preserved-case.json'), JSON.stringify({ test: info.title, directory: world.directory,
      origin: world.origin, entries: (await call('GET', E)).items, labels: (await call('GET', L)).items, errors }, null, 2));
    await context.pages()[0]?.screenshot({ path: info.outputPath('preserved-scene.png') }).catch(() => {});
  }
  await context.close(); await world.close();
  if (!failed) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(errors).toEqual([]);
});

for (const pending of [false, true]) for (const existing of [false, true]) test(`Enter ${pending ? '待安排' : '任务'}${existing ? '编辑' : '新建'}标题保存保留编辑器，重开读回`, async ({ page }) => {
  let task;
  if (existing) { task = await call('POST', E, content('原始标题', pending)); await open(page, task); }
  else await create(page, pending);
  const title = page.locator('[name=entry-title]');
  await title.fill('回车确认后的标题'); await title.press('Enter');
  await expect(page.locator('.cal-editor')).toBeVisible(); await expect(title).not.toBeFocused();
  await expect.poll(async () => (await call('GET', E)).items.map(value => value.title)).toEqual(['回车确认后的标题']);
  const entries = (await call('GET', E)).items;
  expect(entries).toHaveLength(1); expect(entries[0].title).toBe('回车确认后的标题');
  expect(Boolean(entries[0].time)).toBe(!pending);
  await open(page, entries[0]); await page.reload(); await expect(title).toHaveValue('回车确认后的标题');
});
for (const pending of [false, true]) test(`Enter 未命名${pending ? '待安排' : '任务'}不创建空对象`, async ({ page }) => {
  await create(page, pending); await page.getByRole('textbox', { name: '备注', exact: true }).fill('仅有备注');
  await page.locator('[name=entry-title]').press('Enter');
  await expect(page.locator('.cal-editor')).toBeVisible(); await expect(page.locator('[name=entry-title]')).not.toBeFocused(); expect((await call('GET', E)).items).toHaveLength(0);
});
for (const pending of [false, true]) test(`Enter ${pending ? '待安排' : '任务'}备注确认移出光标，Shift+Enter换行且重开保持`, async ({ page }) => {
  const task = await call('POST', E, content('备注键盘任务', pending)); await open(page, task);
  const notes = page.getByRole('textbox', { name: '备注', exact: true });
  await notes.click(); await notes.pressSequentially('第一行'); await notes.press('Shift+Enter'); await notes.pressSequentially('第二行');
  await expect(notes).toBeFocused(); await notes.press('Enter'); await expect(notes).not.toBeFocused();
  await expect(page.locator('.cal-editor')).toBeVisible();
  await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).calendar.notes).toBe('第一行\n第二行');
  await page.reload(); await expect(notes).toHaveText('第一行\n第二行');
  await notes.fill(''); await notes.press('Enter'); await expect(notes).not.toBeFocused();
  await expect(notes).toHaveAttribute('data-empty', 'true');
});
for (const pending of [false, true]) test(`Enter ${pending ? '待安排' : '任务'}事项逐条添加，空白回车不留空项`, async ({ page }) => {
  const task = await call('POST', E, content('事项键盘任务', pending)); await open(page, task);
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await page.getByLabel('事项 1', { exact: true }).fill('第一件事'); await page.getByLabel('事项 1', { exact: true }).press('Enter');
  await expect(page.getByLabel('事项 2', { exact: true })).toBeFocused();
  await page.getByLabel('事项 2', { exact: true }).fill('第二件事'); await page.getByLabel('事项 2', { exact: true }).press('Enter');
  const blank = page.getByLabel('事项 3', { exact: true }); await expect(blank).toBeFocused(); await blank.press('Enter');
  await expect(blank).toHaveCount(0); await page.getByRole('button', { name: '关闭任务', exact: true }).click();
  expect((await call('GET', `${E}/${task.id}`)).items.map(item => item.text)).toEqual(['第一件事', '第二件事']);
});
for (const kind of ['标签', '提醒', '重复', '天数']) test(`Enter ${kind}输入确认有效设置`, async ({ page }) => {
  const task = await call('POST', E, content('弹窗键盘任务')); await open(page, task);
  if (kind === '标签') {
    await page.getByRole('button', { name: '标签', exact: true }).click(); await page.getByRole('menuitem', { name: '+ 创建标签', exact: true }).click();
    const d = page.getByRole('dialog', { name: '创建标签', exact: true });
    await d.getByLabel('标签名称', { exact: true }).fill('回车标签'); await d.getByLabel('标签名称', { exact: true }).press('Enter');
    await expect(d).toHaveCount(0); expect((await call('GET', L)).items.map(label => label.name)).toEqual(['回车标签']);
  }
  if (kind === '提醒') {
    await action(page, '设置提醒'); const d = page.getByRole('dialog', { name: '提醒', exact: true });
    await d.getByLabel('分钟数', { exact: true }).fill('5'); await d.getByLabel('分钟数', { exact: true }).press('Enter');
    await expect(d).toHaveCount(0); await expect(page.locator('.cal-reminder-summary')).toContainText('5');
  }
  if (kind === '重复') {
    await page.getByRole('button', { name: '任务操作', exact: true }).click(); await page.getByRole('menuitem', { name: '重复', exact: true }).hover();
    await page.getByRole('menuitem', { name: '自定义…', exact: true }).click(); const d = page.getByRole('dialog', { name: '重复', exact: true });
    await d.getByLabel('重复间隔', { exact: true }).fill('2'); await d.getByLabel('重复间隔', { exact: true }).press('Enter');
    await expect(d).toHaveCount(0); await expect(page.locator('.cal-repeat-summary')).toContainText('2');
  }
  if (kind === '天数') {
    await page.getByRole('button', { name: '日历视图', exact: true }).click(); await page.getByRole('menuitem', { name: '天数', exact: true }).hover();
    await page.getByRole('menuitem', { name: '其他…', exact: true }).click(); const d = page.getByRole('dialog', { name: '自定义天数', exact: true });
    await d.getByLabel('天数', { exact: true }).fill('3'); await d.getByLabel('天数', { exact: true }).press('Enter');
    await expect(d).toHaveCount(0); await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(3);
  }
  await page.getByRole('button', { name: '关闭任务', exact: true }).click(); await page.reload();
  const saved = await call('GET', `${E}/${task.id}`);
  if (kind === '标签') expect(saved.calendar.tags).toHaveLength(1);
  if (kind === '提醒') expect(saved.reminder.minutes).toBe(5);
  if (kind === '重复') expect(saved.repeat.interval).toBe(2);
});
test('Enter 无效提醒不提交，日期与下拉输入不关闭任务', async ({ page }) => {
  const task = await call('POST', E, content('原生控件')); await open(page, task);
  await page.locator('[name=entry-date]').press('Enter'); await expect(page.locator('.cal-editor')).toBeVisible();
  await page.locator('[name=entry-start]').press('Enter'); await expect(page.locator('.cal-editor')).toBeVisible();
  await action(page, '设置提醒'); const d = page.getByRole('dialog', { name: '提醒', exact: true });
  await d.getByLabel('分钟数', { exact: true }).fill('-1'); await d.getByLabel('分钟数', { exact: true }).press('Enter');
  await expect(d).toBeVisible(); await expect(d.getByRole('button', { name: '完成', exact: true })).toBeDisabled();
  await d.getByLabel('提醒时机', { exact: true }).press('Enter'); await expect(d).toBeVisible();
  await d.getByRole('button', { name: '取消', exact: true }).click(); expect((await call('GET', `${E}/${task.id}`)).reminder).toBeNull();
});
for (const field of ['标题', '事项', '备注', '标签']) test(`Enter ${field}输入法候选确认不执行操作`, async ({ page }) => {
  const task = await call('POST', E, content('输入法确认')); await open(page, task);
  let input;
  if (field === '标题') input = page.locator('[name=entry-title]');
  if (field === '备注') input = page.getByRole('textbox', { name: '备注', exact: true });
  if (field === '事项') { await page.getByRole('button', { name: '添加事项', exact: true }).click(); input = page.getByLabel('事项 1', { exact: true }); }
  if (field === '标签') { await page.getByRole('button', { name: '标签', exact: true }).click(); await page.getByRole('menuitem', { name: '+ 创建标签', exact: true }).click(); input = page.getByLabel('标签名称', { exact: true }); }
  await input.fill('中文候选词'); await input.focus();
  // 模拟输入法键盘属性，真实系统输入法不由浏览器自动化控制。
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true });
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, bubbles: true });
  await expect(input).toBeFocused(); await expect(page.locator('.cal-editor')).toBeVisible();
  if (field === '事项') await expect(page.getByLabel('事项 2', { exact: true })).toHaveCount(0);
  if (field === '标签') { await expect(page.getByRole('dialog', { name: '创建标签', exact: true })).toBeVisible(); expect((await call('GET', L)).items).toHaveLength(0); }
});
test('Enter 删除弹窗即使聚焦取消也执行删除确认', async ({ page }) => {
  const task = await call('POST', E, content('删除确认')); await open(page, task); await action(page, '删除任务');
  const d = page.getByRole('dialog', { name: '删除任务', exact: true });
  await d.getByRole('button', { name: '取消', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(d).toHaveCount(0); await expect(page.locator('.cal-editor')).toHaveCount(0);
  expect((await call('GET', E)).items).toHaveLength(0);
});

test('Enter 设置重复响应未返回时编辑标题并确认，保存为独立任务', async ({ page }) => {
  const task = await call('POST', E, content('重复模板')); await open(page, task);
  let release, hit, first = true;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve);
  await page.route(`**${E}/${task.id}`, async route => {
    if (route.request().method() !== 'PUT' || !first) return route.continue();
    first = false; const response = await route.fetch(); hit(); await gate; await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '任务操作', exact: true }).click(); await page.getByRole('menuitem', { name: '重复', exact: true }).hover();
  await page.getByRole('menuitem', { name: '每周', exact: true }).click(); await started;
  await page.locator('[name=entry-title]').fill('本次独立修改'); await page.locator('[name=entry-title]').press('Enter'); release();
  await expect(page.locator('.cal-editor')).toBeVisible(); await expect(page.locator('[name=entry-title]')).not.toBeFocused();
  await expect.poll(async () => (await call('GET', E)).items.some(value => value.title === '本次独立修改')).toBe(true);
  const entries = (await call('GET', E)).items;
  expect(entries.find(value => value.id === task.id).title).toBe('重复模板');
  const detached = entries.filter(value => value.title === '本次独立修改'); expect(detached).toHaveLength(1); expect(detached[0].repeat).toBeNull();
  await open(page, detached[0]); await expect(page.locator('.cal-repeat-summary')).toHaveCount(0);
});
test('Enter 确认后关闭正在保存的任务，等待期间的新输入仍然保存', async ({ page }) => {
  const task = await call('POST', E, content('关闭期间继续输入')); await open(page, task);
  let release, hit, first = true;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve);
  await page.route(`**${E}/${task.id}`, async route => {
    if (route.request().method() !== 'PUT' || !first) return route.continue();
    first = false; const response = await route.fetch(); hit(); await gate; await route.fulfill({ response });
  });
  await page.locator('[name=entry-title]').fill('确认时的标题'); await page.locator('[name=entry-title]').press('Enter'); await started;
  await expect(page.locator('.cal-editor')).toBeVisible(); await page.getByRole('button', { name: '关闭任务', exact: true }).click();
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('等待期间补充的备注'); release();
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  const saved = await call('GET', `${E}/${task.id}`); expect(saved.title).toBe('确认时的标题'); expect(saved.calendar.notes).toBe('等待期间补充的备注');
});
test('Enter 新建标签遇到旧请求待确认，原键原体重试后保存当前新标签', async ({ page }) => {
  const task = await call('POST', E, content('两个标签意图')); await open(page, task);
  const requests = []; let first = true;
  await page.route(`**${L}`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (!first) return route.continue(); first = false; await route.fetch(); await route.abort('failed');
  });
  const labelDialog = async () => {
    await page.getByRole('button', { name: '标签', exact: true }).click(); await page.getByRole('menuitem', { name: '+ 创建标签', exact: true }).click();
    return page.getByRole('dialog', { name: '创建标签', exact: true });
  };
  let d = await labelDialog(); await d.getByLabel('标签名称', { exact: true }).fill('上次标签'); await d.getByLabel('标签名称', { exact: true }).press('Enter');
  await expect(d.getByRole('button', { name: '重试确认', exact: true })).toBeVisible(); await d.getByRole('button', { name: '取消', exact: true }).click();
  d = await labelDialog(); await d.getByLabel('标签名称', { exact: true }).fill('当前标签'); await d.getByLabel('标签名称', { exact: true }).press('Enter');
  await expect(d).toHaveCount(0); expect((await call('GET', L)).items.map(value => value.name).sort()).toEqual(['上次标签', '当前标签']);
  expect(requests).toHaveLength(3); expect(requests[1]).toEqual(requests[0]); expect(requests[2].key).not.toBe(requests[0].key);
  await page.getByRole('button', { name: '关闭任务', exact: true }).click(); expect((await call('GET', `${E}/${task.id}`)).calendar.tags).toHaveLength(1);
});
test('Enter 菜单可用键盘进入重复子菜单并选择，方向键不混入其他菜单项', async ({ page }) => {
  const task = await call('POST', E, content('键盘重复选择')); await open(page, task);
  await page.getByRole('button', { name: '任务操作', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: '重复', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('menuitem', { name: '不重复', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: '每天', exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('.cal-repeat-summary')).toContainText('每天');
  await page.getByRole('button', { name: '关闭任务', exact: true }).click(); expect((await call('GET', `${E}/${task.id}`)).repeat.frequency).toBe('daily');
});
