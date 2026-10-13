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
let world, client, errors, now;
const content = (title, pending = false) => ({ title, items: [],
  time: pending ? null : { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, course: { classId: null, recordIds: [] },
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
  now = '2026-09-25T06:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  errors = []; page.on('pageerror', error => errors.push(error.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-dialog-keyboard-')),
    workbenchClock: () => new Date(now) });
  ({ client } = await registerMath(world, 'schedule-dialog-keyboard@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-dialog-keyboard@example.test');
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


for (const focus of ['default', '取消', '关闭']) test(`移回待安排 Enter ${focus} 确认操作并刷新读回`, async ({page}) => {
  const task=await call('POST',E,content('移动确认')); await open(page,task);
  await page.getByRole('button',{name:'移回待安排',exact:true}).click();
  const d=page.getByRole('dialog',{name:'移回待安排',exact:true}); await expect(d).toBeVisible();
  if(focus !== 'default') await d.getByRole('button',{name:focus,exact:true}).focus();
  await page.keyboard.press('Enter'); await expect(d).toHaveCount(0);
  await expect(page.locator('.cal-editor')).toBeVisible();
  await expect.poll(async()=> (await call('GET',`${E}/${task.id}`)).time).toBeNull();
  await page.reload(); await expect(page.getByRole('button',{name:'安排时间',exact:true})).toBeVisible();
});

const dialogKinds = ['自定义天数', '重复', '创建标签', '编辑标签', '提醒', '教学关联',
  '移动事项', '采用服务器内容', '删除任务', '移回待安排', '提醒时间已过去'];

// Public APIs only seed the preconditions; every confirmation uses actual keyboard input.
async function prepareDialog(page, kind, pending = false) {
  const value = content('弹窗确认任务', pending);
  if (kind === '移动事项') value.items = [{ id: randomUUID(), text: '要移动的事项', priority: 'normal' }];
  if (kind === '提醒时间已过去') value.reminder = { side: 'before', minutes: 10 };
  const task = await call('POST', E, value);
  await open(page, task);
  let target, label, course;
  if (kind === '自定义天数') {
    await page.getByRole('button', { name: '日历视图', exact: true }).click();
    await page.getByRole('menuitem', { name: '天数', exact: true }).hover();
    await page.getByRole('menuitem', { name: '其他…', exact: true }).click();
    await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('天数', { exact: true }).fill('3');
  } else if (kind === '重复') {
    await page.getByRole('button', { name: '任务操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '重复', exact: true }).hover();
    await page.getByRole('menuitem', { name: '自定义…', exact: true }).click();
    await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('重复间隔').fill('2');
  } else if (kind === '创建标签' || kind === '编辑标签') {
    if (kind === '编辑标签') label = await call('POST', L, { name: '原标签', color: '#579bfc' });
    // Reload so the new label is present in the real picker.
    if (label) await open(page, task);
    await page.getByRole('button', { name: '标签', exact: true }).click();
    if (label) await page.getByRole('button', { name: '编辑标签 原标签', exact: true }).click();
    else await page.getByRole('menuitem', { name: '+ 创建标签', exact: true }).click();
    await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('标签名称').fill('已确认标签');
  } else if (kind === '提醒') {
    await action(page, '设置提醒');
    await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('分钟数').fill('5');
  } else if (kind === '教学关联') {
    const classroom = await call('POST', '/api/modules/classes/items', { name: '键盘班级' });
    await action(page, '教学关联');
    const d = page.getByRole('dialog', { name: kind, exact: true });
    await d.getByLabel('班级', { exact: true }).selectOption(classroom.id);
    course = { classId: classroom.id, recordIds: [] };
  } else if (kind === '移动事项') {
    target = await call('POST', E, content('移动目标', true));
    await open(page, task);
    await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
    await page.getByRole('dialog', { name: kind, exact: true }).getByLabel('移到', { exact: true }).selectOption(target.id);
  } else if (kind === '采用服务器内容') {
    await call('PUT', `${E}/${task.id}`, { ...value, expectedVersion: task.version,
      calendar: { ...value.calendar, notes: '服务器备注' } });
    await page.locator('[name=entry-title]').fill('未保存的本地标题');
    await page.locator('[name=entry-title]').press('Enter');
    await page.getByRole('button', { name: '读取最新版本', exact: true }).click();
    await page.getByText('查看服务器内容', { exact: true }).click();
    await page.getByRole('button', { name: '采用服务器内容', exact: true }).click();
  } else if (kind === '删除任务') await action(page, '删除任务');
  else if (kind === '移回待安排') await page.getByRole('button', { name: '移回待安排', exact: true }).click();
  else if (kind === '提醒时间已过去') {
    now = '2026-09-25T07:17:00Z'; await page.clock.setFixedTime(new Date(now));
    await page.locator('[name=entry-end]').fill('15:25');
    await page.locator('[name=entry-end]').press('Enter');
  }
  const d = page.getByRole('dialog', { name: kind, exact: true });
  await expect(d).toBeVisible();
  return { d, task, value, target, label, course };
}

async function verifyOperation(page, kind, scene, saved) {
  const { task, target, course, value, label } = scene;
  if (kind === '删除任务') {
    await expect.poll(async () => (await call('GET', E)).items.length).toBe(saved ? 0 : 1);
    return;
  }
  const read = () => call('GET', `${E}/${task.id}`);
  if (kind === '自定义天数') await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(saved ? 3 : 7);
  else if (kind === '重复') await expect.poll(async () => (await read()).repeat?.interval ?? null).toBe(saved ? 2 : null);
  else if (kind === '创建标签' || kind === '编辑标签') {
    await expect.poll(async () => (await call('GET', L)).items.map(x => x.name)).toEqual(saved ? ['已确认标签'] : label ? ['原标签'] : []);
  } else if (kind === '提醒') await expect.poll(async () => (await read()).reminder).toEqual(saved ? { side: 'before', minutes: 5 } : null);
  else if (kind === '教学关联') await expect.poll(async () => (await read()).course).toEqual(saved ? course : value.course);
  else if (kind === '移动事项') {
    await expect.poll(async () => (await read()).items.length).toBe(saved ? 0 : 1);
    expect((await call('GET', `${E}/${target.id}`)).items).toEqual(saved ? value.items : []);
  } else if (kind === '移回待安排') await expect.poll(async () => (await read()).time).toEqual(saved ? null : value.time);
  else if (kind === '提醒时间已过去') {
    await expect.poll(async () => (await read()).reminder).toEqual(saved ? null : value.reminder);
    await expect.poll(async () => (await read()).time.durationMinutes).toBe(saved ? 25 : 30);
    await expect(page.locator('[name=entry-end]')).toHaveValue(saved ? '15:25' : '15:30');
  } else if (kind === '采用服务器内容') {
    await expect(page.locator('[name=entry-title]')).toHaveValue(saved ? task.title : '未保存的本地标题');
    await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveText(saved ? '服务器备注' : '');
    expect((await read()).calendar.notes).toBe('服务器备注');
  }
}

for (const kind of dialogKinds) for (const key of ['Enter', 'Escape']) {
  test(`${kind} ${key} ${key === 'Enter' ? '完成操作' : '取消不提交'}`, async ({ page }) => {
    const scene = await prepareDialog(page, kind);
    await page.keyboard.press(key);
    await expect(scene.d).toHaveCount(0);
    await verifyOperation(page, kind, scene, key === 'Enter');
    if (key === 'Enter') {
      await page.reload();
      if (kind !== '提醒时间已过去' && kind !== '采用服务器内容') await verifyOperation(page, kind, scene, true);
    }
  });
}

for (const kind of ['重复', '创建标签', '提醒', '教学关联', '移动事项']) {
  test(`${kind} 聚焦取消后 Enter 仍确认，鼠标取消保留原行为`, async ({ page }) => {
    let scene = await prepareDialog(page, kind);
    await scene.d.getByRole('button', { name: '取消', exact: true }).click();
    await expect(scene.d).toHaveCount(0); await verifyOperation(page, kind, scene, false);
    scene = await prepareDialog(page, kind);
    await scene.d.getByRole('button', { name: '取消', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(scene.d).toHaveCount(0); await verifyOperation(page, kind, scene, true);
  });
}

for (const [kind, field, invalid, valid] of [
  ['重复', '重复间隔', '0', '2'], ['创建标签', '标签名称', '', '已确认标签'],
  ['提醒', '分钟数', '-1', '5'], ['自定义天数', '天数', '0', '3'],
]) test(`${kind} 无效输入时 Enter 不提交也不关闭，修正后确认`, async ({ page }) => {
  const scene = await prepareDialog(page, kind);
  await scene.d.getByLabel(field, { exact: true }).fill(invalid);
  await scene.d.getByRole('button', { name: '关闭', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(scene.d).toBeVisible(); await verifyOperation(page, kind, scene, false);
  await scene.d.getByLabel(field, { exact: true }).fill(valid);
  await scene.d.getByRole('button', { name: '取消', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(scene.d).toHaveCount(0); await verifyOperation(page, kind, scene, true);
});

test('教学关联加载时 Enter 不误关，Escape 取消不写入', async ({ page }, info) => {
  const task = await call('POST', E, content('等待教学选项')); await open(page, task);
  let release, hit;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve);
  await page.route('**/api/modules/classes/items', async route => {
    hit(); await gate; await route.continue();
  });
  try {
    await action(page, '教学关联'); await started;
    const d = page.getByRole('dialog', { name: '教学关联', exact: true });
    await expect(d).toBeFocused();
    await expect(d.locator('[data-dialog-confirm]')).toBeDisabled();
    expect(await d.evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none');
    await page.keyboard.press('Enter'); await expect(d).toBeVisible();
    await expect(d.locator('..').locator('..')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('loading-dialog-focus.png') });
    await page.keyboard.press('Escape'); await expect(d).toHaveCount(0);
    expect((await call('GET', `${E}/${task.id}`)).course).toEqual(task.course);
  } finally { release(); }
});

test('教学关联复选框 Space 勾选，Enter 保存当前关联不反选', async ({ page }) => {
  const scene = await prepareDialog(page, '教学关联');
  const record = await call('POST', '/api/modules/classes/v2/records', {
    classId: scene.course.classId, recordedOn: '2026-09-25', note: '键盘教学记录',
    position: '', unfinished: '', commonIssues: '', nextNote: '', sources: [] });
  await page.keyboard.press('Escape'); await expect(scene.d).toHaveCount(0); await action(page, '教学关联');
  const d = page.getByRole('dialog', { name: '教学关联', exact: true });
  await d.getByLabel('班级', { exact: true }).selectOption(scene.course.classId);
  const box = d.getByRole('checkbox'); await expect(box).toHaveCount(1);
  await box.focus(); await page.keyboard.press('Space'); await expect(box).toBeChecked();
  await page.keyboard.press('Enter'); await expect(d).toHaveCount(0);
  await expect.poll(async () => (await call('GET', `${E}/${scene.task.id}`)).course.recordIds).toEqual([record.id]);
  await page.reload(); await expect(page.locator('.cal-course-summary')).toContainText('1 条记录');
});

test('编辑标签即使聚焦删除标签，Enter 保存而非误删', async ({ page }) => {
  const scene = await prepareDialog(page, '编辑标签');
  await scene.d.getByRole('button', { name: '删除标签', exact: true }).focus();
  await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
  await verifyOperation(page, '编辑标签', scene, true);
  expect((await call('GET', L)).items[0].id).toBe(scene.label.id);
});

test('提醒冲突即使聚焦放弃，Enter 关闭提醒并保存新的时间', async ({ page }) => {
  const scene = await prepareDialog(page, '提醒时间已过去');
  await scene.d.getByRole('button', { name: '放弃本次修改', exact: true }).focus();
  await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
  await verifyOperation(page, '提醒时间已过去', scene, true);
});

test('保存等待中聚焦取消再按 Enter 不关闭或重复请求，长按同样不重放', async ({ page }) => {
  const scene = await prepareDialog(page, '创建标签');
  let release, hit, writes = 0;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve);
  await page.route(`**${L}`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes++; const response = await route.fetch(); hit(); await gate; await route.fulfill({ response });
  });
  try {
    await page.keyboard.press('Enter'); await started;
    await scene.d.getByRole('button', { name: '取消', exact: true }).focus();
    await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
    await expect(scene.d).toBeVisible(); expect(writes).toBe(1);
  } finally { release(); }
  await expect(scene.d).toHaveCount(0); await verifyOperation(page, '创建标签', scene, true);
  expect(writes).toBe(1);
});

test('输入法与带修饰键 Enter 不确认或误关，普通 Enter 最后完成', async ({ page }) => {
  const scene = await prepareDialog(page, '创建标签');
  const input = scene.d.getByLabel('标签名称');
  // Mechanism probes only: real OS IME is outside this browser automation.
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
  await input.dispatchEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true });
  await scene.d.getByRole('button', { name: '关闭', exact: true }).focus();
  for (const key of ['Shift+Enter', 'Alt+Enter', 'Control+Enter', 'Meta+Enter']) {
    await page.keyboard.press(key); await expect(scene.d).toBeVisible();
  }
  expect((await call('GET', L)).items).toEqual([]);
  await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
  await verifyOperation(page, '创建标签', scene, true);
});

for (const scope of ['series', 'instance']) test(`移动事项重复目标 ${scope} 未选范围不误关，选定后 Enter 完成`, async ({ page }) => {
  const value = content('移动到重复'); value.items = [{ id: randomUUID(), text: '可重复事项', priority: 'normal' }];
  const source = await call('POST', E, value);
  const targetValue = content('重复目标');
  targetValue.repeat = { frequency: 'weekly', interval: 1, weekdays: [5], monthly: 'date', until: '2026-10-09', count: 0 };
  const target = await call('POST', E, targetValue); await open(page, source);
  await page.getByRole('button', { name: '事项 1 操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移到其他安排…', exact: true }).click();
  const d = page.getByRole('dialog', { name: '移动事项', exact: true });
  await d.getByLabel('移到', { exact: true }).selectOption(target.id);
  await d.getByRole('button', { name: '取消', exact: true }).focus();
  await page.keyboard.press('Enter'); await expect(d).toBeVisible();
  const radio = d.getByRole('radio', { name: scope === 'series' ? '每次重复都需要' : '只在某一次需要', exact: true });
  await radio.focus(); await page.keyboard.press('Space'); await expect(radio).toBeChecked();
  if (scope === 'instance') await expect(d.getByLabel('任务日期')).toHaveValue('2026-09-25');
  await page.keyboard.press('Enter'); await expect(d).toHaveCount(0);
  await expect.poll(async () => (await call('GET', `${E}/${source.id}`)).items).toEqual([]);
  if (scope === 'series') expect((await call('GET', `${E}/${target.id}`)).items).toEqual(value.items);
  else {
    const items = (await call('GET', E)).items;
    expect(items.find(x => x.id !== target.id && x.title === target.title)?.items).toEqual(value.items);
    expect((await call('GET', `${E}/${target.id}`)).items).toEqual([]);
  }
});

for (const pending of [false, true]) test(`教学关联 ${pending ? '待安排' : '任务'}聚焦叉号后 Enter 保存`, async ({ page }) => {
  const scene = await prepareDialog(page, '教学关联', pending);
  await scene.d.getByRole('button', { name: '关闭', exact: true }).focus();
  await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
  await verifyOperation(page, '教学关联', scene, true);
  await expect(page.locator('.cal-editor')).toBeVisible();
});

for (const theme of ['浅色', '深色']) for (const width of [390, 1675]) {
  test(`确认弹窗 ${theme} ${width} 焦点无外框且布局完整`, async ({ page }, info) => {
    await page.getByRole('link', { name: /^账户：/ }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.getByRole('link', { name: '日程', exact: true }).click();
    await page.setViewportSize({ width, height: 950 });
    const scene = await prepareDialog(page, '移回待安排');
    const confirm = scene.d.locator('[data-dialog-confirm]'); await expect(confirm).toBeFocused();
    expect(await confirm.evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none');
    const bounds = await scene.d.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(scene.d.locator('..').locator('..')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('confirmation-focus.png') });
    await page.keyboard.press('Enter'); await expect(scene.d).toHaveCount(0);
    await verifyOperation(page, '移回待安排', scene, true);
  });
}

test('Escape 后立即重开教学关联，不复用已取消的选择', async ({ page }) => {
  const scene = await prepareDialog(page, '教学关联');
  await page.keyboard.press('Escape');
  // Deliberately reopen before the outgoing 180ms presence animation unmounts.
  await action(page, '教学关联');
  const d = page.getByRole('dialog', { name: '教学关联', exact: true });
  await expect(d.getByLabel('班级', { exact: true })).toHaveValue('');
  await page.keyboard.press('Enter'); await expect(d).toHaveCount(0);
  expect((await call('GET', `${E}/${scene.task.id}`)).course).toEqual(scene.value.course);
});

test('刷新后立即清空备注并 Enter 保存，迟到旧读取不恢复原内容', async ({ page }) => {
  const value = content('清空备注竞态'); value.calendar.notes = '已保存的备注';
  const task = await call('POST', E, value); await open(page, task);
  const notes = page.getByRole('textbox', { name: '备注', exact: true });
  await expect(notes).toHaveText(value.calendar.notes);
  let release, hit, delivered, reads = 0;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve), finished = new Promise(resolve => delivered = resolve);
  await page.route(`**${E}/${task.id}`, async route => {
    if (route.request().method() !== 'GET' || ++reads !== 2) return route.continue(); const response = await route.fetch(); hit(); await gate; await route.fulfill({ response }); delivered();
  });
  try {
    await page.reload(); await started; await expect(notes).toHaveText(value.calendar.notes);
    await notes.fill(''); await notes.press('Enter');
    await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).calendar.notes.trim()).toBe('');
  } finally { release(); }
  await finished;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(notes).toHaveAttribute('data-empty', 'true');
  await page.reload(); await expect(notes).toHaveAttribute('data-empty', 'true');
});

for (const field of ['备注', '标题']) test(`刷新读取返回时保留正在编辑${field}的光标，Enter 保存继续输入`, async ({ page }) => {
  const value = content('读取期间编辑'); value.calendar.notes = '原备注';
  const task = await call('POST', E, value); await open(page, task);
  let release, hit, delivered, reads = 0;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => hit = resolve),
    finished = new Promise(resolve => delivered = resolve);
  await page.route(`**${E}/${task.id}`, async route => {
    if (route.request().method() !== 'GET' || ++reads !== 2) return route.continue();
    const response = await route.fetch(); hit(); await gate; await route.fulfill({ response }); delivered();
  });
  const input = field === '备注' ? page.getByRole('textbox', { name: '备注', exact: true }) : page.locator('[name=entry-title]');
  try {
    await page.reload(); await started; await input.click(); await expect(input).toBeFocused();
  } finally { release(); }
  await finished;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(input).toBeFocused();
  await input.fill('读取后继续输入'); await input.press('Enter');
  await expect.poll(async () => {
    const saved = await call('GET', `${E}/${task.id}`);
    return field === '备注' ? saved.calendar.notes : saved.title;
  }).toBe('读取后继续输入');
  await expect(page.locator('.cal-editor')).toBeVisible();
});
