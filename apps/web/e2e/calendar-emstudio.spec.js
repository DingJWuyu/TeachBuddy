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
  repeat: null, reminder: null, calendar: { allDay: false, notes: '', tags: [] } });
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

test('待安排与即将到来统一标题和空态，标签视图独立切换并恢复', async ({ page }, info) => {
  const upcoming = page.getByRole('region', { name: '即将到来', exact: true });
  const pending = page.getByRole('region', { name: '待安排', exact: true });
  await expect(page.getByRole('button', { name: '日程管理', exact: true })).toHaveCount(0);
  await expect(pending.locator('.cal-empty svg')).toBeVisible();
  expect(await pending.locator('.cal-empty svg').innerHTML()).toBe(await pending.getByRole('button', { name: '待安排：按标签分组', exact: true }).locator('svg').innerHTML());
  await expect(pending.locator('.cal-empty p')).toHaveText('先记下要做的事，之后再安排时间。');
  expect(await pending.locator('h2').evaluate(el => getComputedStyle(el).fontSize)).toBe(await upcoming.locator('h2').evaluate(el => getComputedStyle(el).fontSize));
  await page.evaluate(() => document.fonts.ready);
  const description = await pending.locator('.cal-empty p').boundingBox();
  const viewport = await page.locator('.cal-upcoming').boundingBox();
  expect(description.y + description.height).toBeLessThanOrEqual(viewport.y + viewport.height);
  await page.screenshot({ path: info.outputPath('sidebar-empty.png'), animations: 'disabled' });
  const label = (await call('GET', L)).items.find(x => x.name === '工作');
  await call('POST', E, { ...content('准备函数习题'), time: null, calendar: { allDay: false, notes: '', tags: [label.id] } });
  await call('POST', E, { ...content('预约体检'), time: null });
  await page.reload();
  await expect(pending.locator('.cal-upcoming-title')).toHaveCount(2);
  const flatTitles = await pending.locator('.cal-upcoming-title').allTextContents();
  await pending.getByRole('button', { name: '待安排：按标签分组', exact: true }).click();
  await expect(pending.locator('.cal-group-name')).toHaveText(['工作', '无标签']);
  await expect(upcoming.getByRole('button', { name: '按标签分组', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(pending.getByRole('button', { name: '待安排：按列表显示', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await pending.locator('.cal-group-name').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('sidebar-grouped.png'), animations: 'disabled' });
  await pending.getByRole('button', { name: '待安排：按列表显示', exact: true }).click();
  await expect(pending.locator('.cal-upcoming-title')).toHaveText(flatTitles);
});

test('右侧加号和待安排转排期采用未过期的时间，保存后当日列表可见', async ({ page }) => {
  const upcoming = page.getByRole('region', { name: '即将到来', exact: true });
  await upcoming.getByRole('button', { name: '新建任务', exact: true }).click();
  await expect(page.locator('.cal-save-dot')).toHaveCount(0);
  await expect(page.locator('[name=entry-start]')).toHaveValue('14:00');
  await page.locator('[name=entry-title]').pressSequentially('右侧新任务');
  await closeEditor(page);
  expect(await saved('右侧新任务')).toBeDefined();
  await expect(upcoming.locator('.cal-upcoming-title')).toContainText(['右侧新任务']);
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('等待排期的任务');
  await closeEditor(page);
  await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: '等待排期的任务', exact: true }).click();
  await page.getByRole('button', { name: '安排时间', exact: true }).click();
  await closeEditor(page);
  await expect(upcoming.locator('.cal-upcoming-title')).toContainText(['等待排期的任务']);
});

test('已保存的待安排任务点击安排时间后进入当日列表', async ({ page }) => {
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('排期入口检查');
  await closeEditor(page);
  await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: '排期入口检查', exact: true }).click();
  await page.getByRole('button', { name: '安排时间', exact: true }).click();
  await closeEditor(page);
  expect((await saved('排期入口检查')).time).not.toBeNull();
  await expect(page.getByRole('region', { name: '即将到来', exact: true }).locator('.cal-upcoming-title')).toContainText(['排期入口检查']);
});

test('临近午夜新建仍在今天，默认结束时间正确跨日', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-25T15:58:00Z'));
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveValue(date);
  await expect(page.locator('[name=entry-start]')).toHaveValue('23:55');
  await expect(page.locator('[name=entry-end-date]')).toHaveValue('2026-09-26');
  await page.locator('[name=entry-title]').fill('午夜前的安排');
  await closeEditor(page);
  await expect(page.getByRole('region', { name: '即将到来', exact: true }).locator('.cal-upcoming-title')).toContainText(['午夜前的安排']);
});

test('备注用键盘清空后恢复占位文字，任务和待安排均可继续输入', async ({ page }) => {
  for (const entry of ['新建任务', '新建待安排任务']) {
    await page.getByRole('button', { name: entry, exact: true }).click();
    const notes = page.getByRole('textbox', { name: '备注', exact: true });
    await notes.click();
    await notes.pressSequentially('临时备注');
    await notes.press('ControlOrMeta+A');
    await notes.press('Backspace');
    await expect(notes).toHaveText('');
    await expect.poll(() => notes.evaluate(el => getComputedStyle(el, '::before').content)).toBe('"添加备注…"');
    await notes.pressSequentially('重新输入');
    await expect(notes).toHaveText('重新输入');
    await notes.press('ControlOrMeta+A');
    await notes.press('Backspace');
    await closeEditor(page);
  }
});

test('空白事项不会阻止取消空任务或保存有标题的任务', async ({ page }) => {
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await closeEditor(page);
  expect(await entries()).toHaveLength(2);
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('准备练习');
  await page.getByRole('button', { name: '添加事项', exact: true }).click();
  await closeEditor(page);
  expect((await saved('准备练习')).items).toEqual([]);
});

test('待安排入口、紧凑备注和贴合输入框的焦点样式', async ({ page }, info) => {
  await expect(page.getByRole('button', { name: '优先事项', exact: true })).toHaveCount(0);
  await expect(page.locator('.cal-zone-link')).toHaveCount(0);
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await expect(page.locator('[name=entry-date]')).toHaveCount(0);
  await page.locator('[name=entry-title]').pressSequentially('找几道函数辨析题');
  await closeEditor(page);
  await page.reload();
  await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: '找几道函数辨析题', exact: true }).click();
  await page.getByRole('button', { name: '安排时间', exact: true }).click();
  const notes = page.getByRole('textbox', { name: '备注', exact: true });
  const height = (await notes.boundingBox()).height;
  expect(height).toBeLessThanOrEqual(44);
  for (const name of ['entry-title', 'entry-date', 'entry-end-date', 'entry-start', 'entry-end']) {
    const input = page.locator(`[name=${name}]`);
    await input.click();
    const style = await input.evaluate(el => ({ outline: getComputedStyle(el).outlineStyle, shadow: getComputedStyle(el).boxShadow, width: el.getBoundingClientRect().width, parentWidth: el.parentElement.getBoundingClientRect().width }));
    expect(style.outline).toBe('none');
    expect(style.shadow).toContain('inset');
    expect(style.width).toBeLessThanOrEqual(style.parentWidth);
  }
  await notes.click();
  await notes.pressSequentially('第一步：查看教材');
  await page.screenshot({ path: info.outputPath('editor-desktop.png') });
  await notes.fill(Array.from({ length: 8 }, (_, i) => `第${i + 1}步：准备教学材料`).join('\n'));
  expect((await notes.boundingBox()).height).toBeGreaterThan(height + 80);
  await notes.fill('');
  expect((await notes.boundingBox()).height).toBeLessThanOrEqual(44);
  await closeEditor(page);
  expect((await saved('找几道函数辨析题')).time).not.toBeNull();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator('.fc-timegrid-event').filter({ hasText: '找几道函数辨析题' }).click();
  await expect(page.locator('.cal-sidebar')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('editor-tablet.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('空白点击不创建任务，拖选后点击空白同步取消新建和选段', async ({ page }) => {
  await view(page, '日');
  const blank = page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');
  await blank.click({ position: { x: 100, y: 6 } });
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  await expect(page.locator('.fc-highlight')).toHaveCount(0);
  const task = page.locator('.fc-timegrid-event').filter({ hasText: '上课' });
  await task.click();
  await blank.click({ position: { x: 100, y: 6 } });
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  await expect(task).not.toHaveClass(/is-selected/);
  const rect = await blank.boundingBox();
  await page.mouse.move(rect.x + 120, rect.y + 3); await page.mouse.down();
  await page.mouse.move(rect.x + 120, rect.y + 107, { steps: 18 }); await page.mouse.up();
  await expect(page.locator('[name=entry-start]')).toHaveValue('04:00');
  await expect(page.locator('.fc-highlight')).toHaveCount(1);
  await page.locator('.fc-timegrid-slot-lane[data-time="06:00:00"]').click({ position: { x: 100, y: 6 } });
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  await expect(page.locator('.fc-highlight')).toHaveCount(0);
  expect(await entries()).toHaveLength(2);
  await view(page, '月');
  await page.locator('.fc-daygrid-day[data-date="2026-09-24"]').click({ position: { x: 30, y: 60 } });
  await expect(page.locator('.cal-editor')).toHaveCount(0);
});

test('即将到来仅列当日未结束实例，按起始时间排序且编辑不改变顺序', async ({ page }) => {
  await call('POST', E, { ...content('昨天的安排'), time: { ...content('').time, date: '2026-09-24' } });
  await call('POST', E, { ...content('明天的安排'), time: { ...content('').time, date: '2026-09-26' } });
  await call('POST', E, content('今天下午', '17:00'));
  await call('POST', E, content('今日较早', '14:30'));
  const series = await call('POST', E, { ...content('每日复习', '15:30'),
    time: { ...content('').time, date: '2026-09-24', startTime: '15:30' },
    repeat: { until: '2026-09-26', frequency: 'daily', interval: 1, weekdays: [4], monthly: 'date', count: 0 } });
  const { repeat, ...exception } = content('移入今天的实例', '16:45');
  await call('PUT', `${E}/${series.id}/exceptions/2026-09-26`, { expectedVersion: series.version, mode: 'override', content: exception });
  await call('POST', E, { ...content('无日期准备'), time: null });
  await page.reload();
  const list = page.getByRole('region', { name: '即将到来', exact: true });
  await expect(list).toBeVisible();
  const titles = ['今日较早', '每日复习', '移入今天的实例', '今天下午'];
  await expect(list.locator('.cal-upcoming-title')).toHaveText(titles);
  await expect(list.locator('time')).toHaveText(['14:30', '15:30', '16:45', '17:00']);
  await expect(page.getByRole('region', { name: '待安排', exact: true }).locator('.cal-upcoming-title')).toHaveText(['无日期准备']);
  await list.locator('.cal-upcoming-row').filter({ hasText: '今日较早' }).click();
  await page.getByRole('textbox', { name: '备注', exact: true }).fill('调整备注不影响排序');
  await expect.poll(async () => (await saved('今日较早')).calendar.notes).toBe('调整备注不影响排序');
  await closeEditor(page);
  await expect(list.locator('.cal-upcoming-title')).toHaveText(titles);
  await page.getByRole('button', { name: '下一段', exact: true }).click();
  await expect(list.locator('.cal-upcoming-title')).toHaveText(titles);
  await list.locator('.cal-upcoming-row').filter({ hasText: '移入今天的实例' }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('移入今天的实例');
  await expect(page.locator('[name=entry-date]')).toHaveValue(date);
});

test('当前时间与任务选择清晰呈现，月视图同步高亮日期', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.cal-mini-weekday')).toHaveText(['一', '二', '三', '四', '五', '六', '日']);
  const marker = page.locator('.cal-now-time');
  await expect(marker).toHaveText('14:00');
  await marker.scrollIntoViewIfNeeded();
  const guide = await page.locator('.cal-now-guide').boundingBox();
  const grid = await page.locator('.fc-timegrid-cols').boundingBox();
  const firstDay = await page.locator('.fc-timegrid-col[data-date]').first().boundingBox();
  expect(Math.abs(guide.x - firstDay.x)).toBeLessThan(2);
  expect(Math.abs(guide.x + guide.width - grid.x - grid.width)).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('now-time.png'), animations: 'disabled' });
  const task = page.locator('.fc-timegrid-event').filter({ hasText: '上课' });
  const normal = await task.evaluate(node => getComputedStyle(node).backgroundColor);
  await task.click();
  await expect(task).toHaveClass(/is-selected/);
  await expect(task).toHaveCSS('background-color', 'rgb(255, 107, 117)');
  await expect(task.locator('.cal-event-title')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: info.outputPath('selected-time.png'), animations: 'disabled' });
  await closeEditor(page);
  await expect(task).toHaveCSS('background-color', normal);
  await view(page, '月');
  const day = page.locator(`.fc-daygrid-day[data-date="${date}"]`);
  const monthlyTask = day.locator('.fc-event').filter({ hasText: '上课' });
  await monthlyTask.click();
  await expect(monthlyTask).toHaveCSS('background-color', 'rgb(255, 107, 117)');
  await expect(day).toHaveClass(/cal-selected-day/);
  await expect(day).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: info.outputPath('selected-month.png'), animations: 'disabled' });
  await closeEditor(page);
  await expect(page.locator('.cal-selected-day')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.goto(`${world.origin}/settings`);
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await monthlyTask.click();
  await expect(day).toHaveClass(/cal-selected-day/);
  await expect(day).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: info.outputPath('selected-month-dark.png'), animations: 'disabled' });
  await closeEditor(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await view(page, '周');
  await expect(marker).toHaveText('14:00');
  await marker.scrollIntoViewIfNeeded();
  const narrowGuide = await page.locator('.cal-now-guide').boundingBox();
  const narrowGrid = await page.locator('.fc-timegrid-cols').boundingBox();
  expect(Math.abs(narrowGuide.x + narrowGuide.width - narrowGrid.x - narrowGrid.width)).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('now-time-tablet-dark.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('小月历鼠标点选日期不画外圈，键盘可定位日期', async ({ page }, info) => {
  // 从文本输入切到日期，覆盖浏览器保留键盘焦点状态的路径。
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.locator('[name=entry-title]').fill('');
  const previous = page.locator('.cal-mini [data-date="2026-09-24"]');
  await previous.click();
  await page.mouse.move(280, 80);
  await page.screenshot({ path: info.outputPath('mini-pointer-selection.png'), animations: 'disabled' });
  await expect(previous).toHaveCSS('outline-style', 'none');
  await page.locator('.cal-mini [data-date="2026-09-25"]').click();
  await expect(page.locator('.cal-mini [data-date="2026-09-25"]')).toHaveCSS('outline-style', 'none');
  await page.getByRole('button', { name: '上个月', exact: true }).click();
  await page.getByRole('button', { name: '下个月', exact: true }).click();
  await page.keyboard.press('Tab');
  await expect(page.locator('.cal-mini [data-date="2026-08-31"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.cal-mini [data-date="2026-09-01"]')).toBeFocused();
});

test('月视图展开列表不重复日期，选中任务后保持不透明', async ({ page }, info) => {
  await view(page, '月');
  const cell = page.locator('.fc-daygrid-day[data-date="2026-09-25"]');
  await cell.scrollIntoViewIfNeeded();
  await cell.locator('.fc-daygrid-more-link').click();
  const popup = page.locator('.fc-more-popover');
  await expect(popup).toBeVisible();
  await expect.soft(popup.locator('.fc-more-popover-misc')).not.toBeVisible();
  await popup.locator('.fc-event').filter({ hasText: '上课' }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('上课');
  await page.screenshot({ path: info.outputPath('selected-more-list.png'), animations: 'disabled' });
  const alpha = await popup.evaluate(node => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = getComputedStyle(node).backgroundColor;
    ctx.fillRect(0, 0, 1, 1); return ctx.getImageData(0, 0, 1, 1).data[3];
  });
  expect(alpha).toBe(255);
});

test('月视图任务留在日期格内，更多入口展示隐藏任务', async ({ page }, info) => {
  for (let i = 0; i < 8; i++) await call('POST', E, content(`拥挤任务 ${i + 1}`, `${String(8 + i).padStart(2, '0')}:00`));
  await page.reload(); await view(page, '月');
  const cell = page.locator('.fc-daygrid-day[data-date="2026-09-25"]');
  await cell.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('crowded-month.png'), animations: 'disabled' });
  const more = cell.locator('.fc-daygrid-more-link');
  await expect(more).toBeVisible();
  const bounds = await cell.boundingBox();
  const cards = await cell.locator('.fc-daygrid-event:visible').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
  expect(cards.length).toBeLessThan(10);
  for (const card of cards) expect(card.bottom).toBeLessThanOrEqual(bounds.y + bounds.height);
  const moreBounds = await more.boundingBox();
  expect(moreBounds.y + moreBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  await more.click();
  const popover = page.locator('.fc-more-popover');
  await expect(popover).toBeVisible();
  await expect(popover.locator('.fc-daygrid-event')).toHaveCount(10);
  await page.screenshot({ path: info.outputPath('more-tasks-popover.png'), animations: 'disabled' });
  await popover.locator('.fc-event').filter({ hasText: '拥挤任务 8' }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('拥挤任务 8');
  await closeEditor(page);
  await page.goto(`${world.origin}/settings`);
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 1280, height: 640 });
  await cell.scrollIntoViewIfNeeded();
  await expect(more).toBeVisible();
  const smallBounds = await cell.boundingBox();
  const smallMore = await more.boundingBox();
  expect(smallMore.y + smallMore.height).toBeLessThanOrEqual(smallBounds.y + smallBounds.height);
  await more.click();
  await expect(popover.locator('.fc-daygrid-event')).toHaveCount(10);
  const popupBounds = await popover.boundingBox();
  expect(popupBounds.y).toBeGreaterThanOrEqual(0);
  expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(640);
  expect(await popover.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgb(255, 255, 255)');
  await page.screenshot({ path: info.outputPath('more-tasks-small-dark.png'), animations: 'disabled' });
  await popover.locator('.fc-event').filter({ hasText: '拥挤任务 8' }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('拥挤任务 8');
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

test('两分钟短任务从卡片主体拖动而非拉伸', async ({ page }) => {
  await call('POST', E, { ...content('短任务', '14:05'), time: { ...content('').time, startTime: '14:05', durationMinutes: 2 } });
  await page.reload(); await view(page, '日');
  const event = page.locator('.fc-timegrid-event').filter({ hasText: '短任务' });
  await event.scrollIntoViewIfNeeded();
  const box = await event.boundingBox();
  await page.mouse.move(box.x + 35, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + 35, box.y + box.height / 2 + 104, { steps: 20 }); await page.mouse.up();
  await expect.poll(async () => (await saved('短任务')).time.startTime).toBe('15:05');
  expect((await saved('短任务')).time.durationMinutes).toBe(2);
  const handle = await event.locator('.fc-event-resizer-end').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 26, { steps: 12 }); await page.mouse.up();
  await expect.poll(async () => (await saved('短任务')).time.durationMinutes).toBeGreaterThan(2);
  expect((await saved('短任务')).time.startTime).toBe('15:05');
});

test('当前时间线在任务下方，卡片背景不透出红线', async ({ page }, info) => {
  await call('POST', E, { ...content('遮住时间线', '13:55'), time: { ...content('').time, startTime: '13:55', durationMinutes: 20 } });
  await page.reload(); await view(page, '日');
  const event = page.locator('.fc-timegrid-event').filter({ hasText: '遮住时间线' });
  await event.scrollIntoViewIfNeeded();
  const alpha = await event.evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1); return ctx.getImageData(0, 0, 1, 1).data[3];
  });
  expect(alpha).toBe(255);
  const eventsLayer = await event.evaluate(el => Number(getComputedStyle(el.closest('.fc-timegrid-col-events')).zIndex));
  const lineLayer = await page.locator('.fc-timegrid-col .fc-timegrid-now-indicator-container').first().evaluate(el => Number(getComputedStyle(el).zIndex));
  expect(eventsLayer).toBeGreaterThan(lineLayer);
  await page.screenshot({ path: info.outputPath('now-line-below-card.png'), animations: 'disabled' });
});

test('标签搜索和事项拖拽排序保存读回', async ({ page }) => {
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('拖拽事项');
  await page.getByRole('button', { name: '标签', exact: true }).click();
  const search = page.getByRole('searchbox', { name: '搜索标签', exact: true });
  await search.click(); await search.pressSequentially('学习');
  await expect(search).toBeFocused();
  const ink = await search.evaluate(el => ({ color: getComputedStyle(el).color, caret: getComputedStyle(el).caretColor, menu: getComputedStyle(el.closest('.cal-menu')).color }));
  expect(ink.color).toBe(ink.menu); expect(ink.caret).toBe(ink.color);
  await page.screenshot({ path: test.info().outputPath('tag-search-typed.png'), animations: 'disabled' });
  await expect(page.getByRole('menuitemcheckbox')).toHaveCount(1);
  await page.getByRole('menuitemcheckbox', { name: '学习', exact: true }).click();
  await page.keyboard.press('Escape');
  for (const text of ['第一项', '第二项', '第三项']) {
    await page.getByRole('button', { name: '添加事项', exact: true }).click();
    await page.locator('.cal-item-row input').last().fill(text);
  }
  const rows = page.locator('.cal-item-row');
  await rows.last().locator('.cal-item-bullet').hover();
  await expect.poll(() => rows.last().evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({ path: test.info().outputPath('item-handle-hover.png'), animations: 'disabled' });
  const from = await rows.last().locator('.cal-item-bullet').boundingBox();
  const to = await rows.first().boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(to.x + 10, to.y + 2, { steps: 15 }); await page.mouse.up();
  await expect.poll(() => rows.locator('input').evaluateAll(nodes => nodes.map(node => node.value))).toEqual(['第三项', '第一项', '第二项']);
  await closeEditor(page);
  expect((await saved('拖拽事项')).items.map(x => x.text)).toEqual(['第三项', '第一项', '第二项']);
  await page.reload();
  await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: /拖拽事项/ }).click();
  await expect.poll(() => rows.locator('input').evaluateAll(nodes => nodes.map(node => node.value))).toEqual(['第三项', '第一项', '第二项']);
  await page.getByRole('link', { name: /^账户：/ }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', 'dark');
  await page.getByRole('button', { name: '标签', exact: true }).click();
  await search.click(); await search.pressSequentially('学习');
  await expect(search).toBeFocused();
  const darkInk = await search.evaluate(el => ({ color: getComputedStyle(el).color, caret: getComputedStyle(el).caretColor, menu: getComputedStyle(el.closest('.cal-menu')).color }));
  expect(darkInk.color).toBe(darkInk.menu); expect(darkInk.caret).toBe(darkInk.color);
  await expect(page.getByRole('menuitemcheckbox')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('tag-search-dark.png'), animations: 'disabled' });
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
  await page.locator('.fc-timegrid-event').filter({ hasText: '上课' }).click();
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
  await page.locator('.fc-timegrid-event').filter({ hasText: '学习函数' }).click();
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
  await expect(page.locator('.fc-timegrid-event').filter({ hasText: '手机日程' })).toBeVisible();
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
  await page.getByRole('button', { name: '标签', exact: true }).click();
  await page.getByRole('menuitem', { name: '+ 创建标签', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '创建标签', exact: true });
  await modal.getByLabel('标签名称', { exact: true }).fill('教学');
  await modal.getByRole('button', { name: '颜色 #5b9cf5', exact: true }).click();
  await modal.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(async () => (await saved('工作日备课'))?.calendar.tags.length).toBe(1);
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '重复', exact: true }).hover();
  await page.getByRole('menuitem', { name: '每个工作日', exact: true }).click();
  await expect.poll(async () => (await saved('工作日备课'))?.repeat?.frequency).toBe('weekly');
  await capture(page, 'repeat');
  await closeEditor(page);
  const task = await saved('工作日备课');
  await page.goto(`${world.origin}/calendar?entry=${task.id}&on=2026-09-28`);
  await expect(page.locator('[name=entry-title]')).toHaveValue('工作日备课');
  await page.locator('[name=entry-title]').fill('周一调整');
  await expect(page.getByRole('dialog', { name: '编辑重复任务', exact: true })).toHaveCount(0);
  await expect.poll(async () => Boolean(await saved('周一调整'))).toBeTruthy();
  expect((await saved('周一调整')).repeat).toBeNull();
  await expect(page).toHaveURL(new RegExp(`entry=${(await saved('周一调整')).id}`));
  await page.reload(); await expect(page.locator('[name=entry-title]')).toHaveValue('周一调整');
  await expect(page.locator('.cal-repeat-summary')).toHaveCount(0);
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
