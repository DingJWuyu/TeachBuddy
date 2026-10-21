import { setScheduleField, expectScheduleField, scheduleAction } from './controls.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createScheduleWorld, loginSchedule, closeScheduleWorld } from './fixture.mjs';

test.describe('日历视图与编辑流程', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });
  test.use({ viewport: { width: 1675, height: 858 } });
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

  async function closeEditor(page) { await page.locator('.tbx-sheet').getByRole('button', { name: '关闭', exact: true }).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  async function view(page, name) { await page.getByRole('button', { name: '日历视图', exact: true }).click(); await page.getByRole('menuitemradio', { name: new RegExp(`^${name}\\s`) }).click(); }

  async function capture(page, name) {
    const dir = path.resolve('test-results/calendar-visual'); fs.mkdirSync(dir, { recursive: true });
    await page.mouse.move(280, 80);
    await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' });
  }

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-25T06:00:00Z'));
    pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
    ({ world, client } = await createScheduleWorld(() => new Date('2026-09-25T06:00:00Z'), 'calendar@example.test'));
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
    await closeScheduleWorld(context, world, pageErrors, info);
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
    await expectScheduleField(page, '开始时间', '14:00');
    await page.locator('#calendar-entry-title').pressSequentially('右侧新任务');
    await closeEditor(page);
    expect(await saved('右侧新任务')).toBeDefined();
    await expect(upcoming.locator('.cal-upcoming-title')).toContainText(['右侧新任务']);
    await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('等待排期的任务');
    await closeEditor(page);
    await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: '等待排期的任务', exact: true }).click();
    await page.getByRole('button', { name: '放进日历，变成任务', exact: true }).click();
    await closeEditor(page);
    await expect(upcoming.locator('.cal-upcoming-title')).toContainText(['等待排期的任务']);
  });

  test('已保存的待安排任务点击安排时间后进入当日列表', async ({ page }) => {
    await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('排期入口检查');
    await closeEditor(page);
    await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: '排期入口检查', exact: true }).click();
    await page.getByRole('button', { name: '放进日历，变成任务', exact: true }).click();
    await closeEditor(page);
    expect((await saved('排期入口检查')).time).not.toBeNull();
    await expect(page.getByRole('region', { name: '即将到来', exact: true }).locator('.cal-upcoming-title')).toContainText(['排期入口检查']);
  });

  test('临近午夜新建仍在今天，默认结束时间正确跨日', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-25T15:58:00Z'));
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await expectScheduleField(page, '开始日期', date);
    await expectScheduleField(page, '开始时间', '23:55');
    await expectScheduleField(page, '结束日期', '2026-09-26');
    await page.locator('#calendar-entry-title').fill('午夜前的安排');
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
      await expect(notes).toHaveValue('');
      await expect(notes).toHaveAttribute('placeholder', '备注');
      await notes.pressSequentially('重新输入');
      await expect(notes).toHaveValue('重新输入');
      await notes.press('ControlOrMeta+A');
      await notes.press('Backspace');
      await closeEditor(page);
    }
  });

  test('空白快速输入不创建事项，命名任务仍可保存与关闭', async ({ page }) => {
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    const adding = page.getByRole('textbox', { name: '添加事项', exact: true });
    await adding.fill('   '); await adding.press('Enter'); await closeEditor(page);
    expect((await entries()).filter(x => !x.title.trim())).toHaveLength(0);
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('有标题的安排');
    await adding.fill('   '); await page.locator('#calendar-entry-title').click(); await closeEditor(page);
    expect((await saved('有标题的安排')).items).toEqual([]);
  });

  test('待安排编辑器按需显示排期控件，备注与清单独立滚动', async ({ page }, info) => {
    await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('完整编辑布局');
    const editor = page.locator('.tbx-sheet');
    await expect(editor.getByRole('button', { name: '放进日历，变成任务', exact: true })).toBeVisible();
    await expect(editor.getByRole('button', { name: '开始时间', exact: true })).toHaveCount(0);
    const notes = editor.getByRole('textbox', { name: '备注', exact: true });
    await notes.fill('可编辑的备注'); await notes.press('Enter');
    await expect(notes).not.toBeFocused();
    await editor.getByRole('button', { name: '放进日历，变成任务', exact: true }).click();
    for (const name of ['开始日期', '开始时间', '结束时间']) await expect(editor.getByRole('button', { name, exact: true })).toBeVisible();
    expect(await editor.evaluate(node => node.scrollWidth <= node.clientWidth)).toBeTruthy();
    await page.screenshot({ path: info.outputPath('task-sheet-layout.png'), animations: 'disabled' });
    await closeEditor(page); await page.reload();
    expect((await saved('完整编辑布局')).calendar.notes).toBe('可编辑的备注');
  });

  test('空白点击不创建任务，拖选后点击空白同步取消新建和选段', async ({ page }) => {
    await view(page, '日');
    const blank = page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');
    await blank.click({ position: { x: 100, y: 6 } });
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    await expect(page.locator('.fc-highlight')).toHaveCount(0);
    const task = page.locator('.fc-timegrid-event').filter({ hasText: '上课' });
    await task.click();
    await blank.click({ position: { x: 100, y: 6 } });
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    await expect(task).not.toHaveClass(/is-selected/);
    const rect = await blank.boundingBox();
    await page.mouse.move(rect.x + 120, rect.y + 3); await page.mouse.down();
    await page.mouse.move(rect.x + 120, rect.y + 107, { steps: 18 }); await page.mouse.up();
    await expectScheduleField(page, '开始时间', '04:00');
    await expect(page.locator('.cal-draft-event')).toBeVisible();
    await page.locator('.fc-timegrid-slot-lane[data-time="06:00:00"]').click({ position: { x: 100, y: 6 } });
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    await expect(page.locator('.fc-highlight')).toHaveCount(0);
    expect(await entries()).toHaveLength(2);
    await view(page, '月');
    await page.locator('.fc-daygrid-day[data-date="2026-09-24"]').click({ position: { x: 30, y: 60 } });
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
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
    await expect(page.locator('#calendar-entry-title')).toHaveValue('移入今天的实例');
    await expectScheduleField(page, '开始日期', date);
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
    expect(guide.x + guide.width).toBeGreaterThanOrEqual(grid.x + grid.width - 2);
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
    expect(narrowGuide.x + narrowGuide.width).toBeGreaterThanOrEqual(narrowGrid.x + narrowGrid.width - 2);
    await page.screenshot({ path: info.outputPath('now-time-tablet-dark.png'), animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });

  test('小月历鼠标点选日期不画外圈，键盘可定位日期', async ({ page }, info) => {
    // 从文本输入切到日期，覆盖浏览器保留键盘焦点状态的路径。
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('');
    await closeEditor(page);
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
    await expect(page.locator('#calendar-entry-title')).toHaveValue('上课');
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
    await expect(page.locator('#calendar-entry-title')).toHaveValue('拥挤任务 8');
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
    await expect(page.locator('#calendar-entry-title')).toHaveValue('拥挤任务 8');
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

  test('小月历拖选整周和整月采用对应视图，其他范围保留实际天数', async ({ page }) => {
    const select = async (from, to) => {
      const start = await page.locator(`.cal-mini [data-date="${from}"]`).boundingBox();
      const end = await page.locator(`.cal-mini [data-date="${to}"]`).boundingBox();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
      await page.mouse.up();
    };
    const view = page.getByRole('button', { name: '日历视图', exact: true });
    await select('2026-09-21', '2026-09-27');
    await expect(view).toHaveText('周');
    await expect(page.locator('.fc-col-header-cell')).toHaveCount(7);
    await page.reload();
    await expect(view).toHaveText('周');

    await select('2026-09-01', '2026-09-30');
    await expect(view).toHaveText('月');
    await expect(page.locator('.cal-grid-wrap.is-month')).toBeVisible();
    await page.reload();
    await expect(view).toHaveText('月');

    await select('2026-09-22', '2026-09-27');
    await expect(view).toHaveText('6 天');
    await expect(page.locator('.fc-col-header-cell')).toHaveCount(6);
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

  test('标签胶囊选择和事项拖拽排序保存读回', async ({ page }) => {
    await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('拖拽事项');
    await page.locator('.tbx-labels').getByRole('button', { name: '学习', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: '搜索标签', exact: true })).toHaveCount(0);
    for (const text of ['第一项', '第二项', '第三项']) {
      const adding = page.getByRole('textbox', { name: '添加事项', exact: true });
      await adding.fill(text); await adding.press('Enter');
    }
    const rows = page.locator('.tbx-item:not(.is-add)');
    const grip = rows.last().locator('.tbx-item-grip');
    await rows.last().hover(); await grip.hover();
    await page.screenshot({ path: test.info().outputPath('item-handle-hover.png'), animations: 'disabled' });
    const from = await grip.boundingBox(), to = await rows.first().boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    const pointerX = from.x + from.width / 2 + 80;
    await page.mouse.move(pointerX, from.y + from.height / 2, { steps: 10 });
    const ghost = page.locator('.tbx-drag-ghost.is-item');
    await expect(ghost).toBeVisible();
    const ghostBox = await ghost.boundingBox();
    expect(Math.abs(ghostBox.x - pointerX), '事项跟手卡应留在抓取点附近').toBeLessThan(40);
    await page.screenshot({ path: test.info().outputPath('item-ghost-under-pointer.png') });
    await page.mouse.move(to.x + 10, to.y + 2, { steps: 15 }); await page.mouse.up();
    await expect.poll(() => rows.locator('input').evaluateAll(nodes => nodes.map(node => node.value))).toEqual(['第三项', '第一项', '第二项']);
    await closeEditor(page); await page.reload();
    await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: /拖拽事项/ }).click();
    await expect.poll(() => rows.locator('input').evaluateAll(nodes => nodes.map(node => node.value))).toEqual(['第三项', '第一项', '第二项']);
    await expect(page.locator('.tbx-labels').getByRole('button', { name: '学习', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const label = (await call('GET', L)).items.find(x => x.name === '学习');
    expect((await saved('拖拽事项')).calendar.tags).toEqual([label.id]);
  });

  test('直接拖动任务和拉伸结束时间保持真实数据', async ({ page }) => {
    await view(page, '日');
    const event = page.locator('.fc-timegrid-event').filter({ hasText: '上课' });
    await event.scrollIntoViewIfNeeded();
    await event.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const rect = await event.boundingBox();
    const hourHeight = await page.locator('.fc-timegrid-slot-lane').first().evaluate(node => node.getBoundingClientRect().height * 4);
    await page.mouse.move(rect.x + 40, rect.y + 25); await page.mouse.down();
    await page.mouse.move(rect.x + 40, rect.y + 25 + hourHeight, { steps: 20 }); await page.mouse.up();
    await expect.poll(async () => (await saved('上课')).time.startTime).toBe('02:10');
    await expect(event).toContainText('2:10');
    await event.locator('.fc-event-resizer-end').hover({ position: { x: 15, y: 4 } });
    const handle = await event.locator('.fc-event-resizer-end').boundingBox();
    await page.mouse.move(handle.x + 15, handle.y + 4); await page.mouse.down();
    await page.mouse.move(handle.x + 15, handle.y + 4 + hourHeight / 2, { steps: 20 }); await page.mouse.up();
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
    await page.locator('#calendar-entry-title').fill('断网前标题');
    await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
    await page.locator('#calendar-entry-title').fill('恢复后的标题');
    await page.reload();
    await expect(page.locator('#calendar-entry-title')).toHaveValue('恢复后的标题');
    await page.unroute(`**${E}`);
    await page.getByRole('button', { name: '重试确认', exact: true }).click();
    await expect.poll(async () => Boolean(await saved('恢复后的标题'))).toBeTruthy();
    expect((await entries()).filter(x => /断网前|恢复后/.test(x.title))).toHaveLength(1);
  });

  test('冲突保留输入且显式保存，窄屏可编辑和返回相邻模块', async ({ page }) => {
    await page.locator('.fc-timegrid-event').filter({ hasText: '上课' }).click();
    const task = await saved('上课');
    await call('PUT', `${E}/${task.id}`, { ...content('另一窗口的修改'), expectedVersion: task.version });
    await page.locator('#calendar-entry-title').fill('保留我的输入');
    await expect(page.getByRole('button', { name: '读取最新版本', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '读取最新版本', exact: true }).click();
    await expect(page.locator('#calendar-entry-title')).toHaveValue('保留我的输入');
    await page.getByRole('textbox', { name: '备注', exact: true }).fill('仍需确认保存');
    expect((await call('GET', `${E}/${task.id}`)).title).toBe('另一窗口的修改');
    await page.getByRole('button', { name: '重新保存', exact: true }).click();
    await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).title).toBe('保留我的输入');
    await closeEditor(page);
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.locator('.fc-timegrid-event').filter({ hasText: '学习函数' }).click();
    await expect(page.locator('#calendar-entry-title')).toHaveValue('学习函数');
    await capture(page, 'tablet');
    await closeEditor(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '打开月份与任务', exact: true }).click();
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('手机日程');
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
    await expectScheduleField(page, '开始时间', '09:00');
    await page.locator('#calendar-entry-title').fill('课堂准备');
    await expect.poll(async () => Boolean(await saved('课堂准备'))).toBeTruthy();
    await page.getByRole('textbox', { name: '备注', exact: true }).fill('讲清函数的定义\n准备两个例子');
    await page.locator('.tbx-labels').getByRole('button', { name: '学习', exact: true }).click();
    await expect.poll(async () => (await saved('课堂准备'))?.calendar.notes).toContain('准备两个例子');
    await expect.poll(async () => (await saved('课堂准备'))?.calendar.tags.length).toBe(1);
    await capture(page, 'editor');
    await page.reload(); await expect(page.locator('#calendar-entry-title')).toHaveValue('课堂准备');
    await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveValue('讲清函数的定义\n准备两个例子');
    await page.locator('.tbx-sheet-delete').click(); await page.locator('.tbx-sheet-delete').click();

    await expect.poll(async () => Boolean(await saved('课堂准备'))).toBeFalsy();
  });

  test('全天、重复规则、单次改动和自建标签真实保存', async ({ page }) => {
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('工作日备课');
    await expect.poll(async () => Boolean(await saved('工作日备课'))).toBeTruthy();
    await page.locator('.tbx-sheet').getByRole('switch',{name:'全天',exact:true}).click();
    await expect.poll(async () => (await saved('工作日备课'))?.calendar.allDay).toBeTruthy();
    await page.getByRole('button', { name: '新标签', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '创建标签', exact: true });
    await modal.getByLabel('标签名称', { exact: true }).fill('教学');
    await modal.getByRole('button', { name: '颜色 #5b9cf5', exact: true }).click();
    await modal.getByRole('button', { name: '保存', exact: true }).click();
    await expect.poll(async () => (await saved('工作日备课'))?.calendar.tags.length).toBe(1);
    await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();
    await page.getByRole('menuitemradio', { name: '每个工作日', exact: true }).click();
    await expect.poll(async () => (await saved('工作日备课'))?.repeat?.frequency).toBe('weekly');
    await capture(page, 'repeat');
    await closeEditor(page);
    const task = await saved('工作日备课');
    await page.goto(`${world.origin}/calendar?entry=${task.id}&on=2026-09-28`);
    await expect(page.locator('#calendar-entry-title')).toHaveValue('工作日备课');
    await page.locator('#calendar-entry-title').fill('周一调整');
    await expect(page.getByRole('dialog', { name: '编辑重复任务', exact: true })).toHaveCount(0);
    await expect.poll(async () => Boolean(await saved('周一调整'))).toBeTruthy();
    expect((await saved('周一调整')).repeat).toBeNull();
    await expect(page).toHaveURL(new RegExp(`entry=${(await saved('周一调整')).id}`));
    await page.reload(); await expect(page.locator('#calendar-entry-title')).toHaveValue('周一调整');
    await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ })).toContainText('不重复');
    expect((await call('GET', `${E}/${task.id}/occurrence?originDate=2026-09-29`)).title).toBe('工作日备课');
  });

  test('自定义重复次数、标签改名删除和跨月日期段', async ({ page }) => {
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await page.locator('#calendar-entry-title').fill('隔周教研');
    await expect.poll(async () => Boolean(await saved('隔周教研'))).toBeTruthy();
    await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();
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
    await page.locator('.tbx-labels').getByRole('button',{name:'工作',exact:true}).dblclick();
    let label = page.getByRole('dialog', { name: '编辑标签', exact: true });
    await label.getByLabel('标签名称', { exact: true }).fill('课堂');
    await label.getByRole('button', { name: '保存', exact: true }).click();
    await page.locator('.tbx-labels').getByRole('button',{name:'课堂',exact:true}).dblclick();
    label = page.getByRole('dialog', { name: '编辑标签', exact: true });
    await label.getByRole('button', { name: '删除标签', exact: true }).click(); await label.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect.poll(async () => (await call('GET', L)).items.map(x => x.name)).toEqual(['学习']);
    await closeEditor(page);
    const start = await page.locator('.cal-mini [data-date="2026-09-29"]').boundingBox();
    const end = await page.locator('.cal-mini [data-date="2026-10-04"]').boundingBox();
    await page.mouse.move(start.x + 18, start.y + 18); await page.mouse.down();
    await page.mouse.move(end.x + 18, end.y + 18, { steps: 18 }); await page.mouse.up();
    await expect(page.getByRole('button', { name: '日历视图', exact: true })).toHaveText('6 天');
    await expect(page.locator('.fc-col-header-cell')).toHaveCount(6);
  });
});

test.describe('月视图布局与全天任务', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });
  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, now, errors;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
    const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
  }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  async function close(page) { await page.getByRole('button', { name: '关闭', exact: true }).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  async function view(page, name) {
    await page.getByRole('button', { name: '日历视图', exact: true }).click();
    await page.getByRole('menuitemradio', { name: new RegExp(`^${name}\\s`) }).click();
  }

  test.beforeEach(async ({ page }) => {
    now = '2026-09-25T06:00:00Z';
    await page.clock.setFixedTime(new Date(now));
    errors = []; page.on('pageerror', e => errors.push(e.message));
    ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-polish@example.test'));
    await loginSchedule(page, world, 'schedule-polish@example.test');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  test('多日全天任务在月和周视图横跨两天', async ({ page }) => {
    const task = await call('POST', E, entry('两天的全天备忘', { time: { ...entry('').time, startTime: '00:00', durationMinutes: 2880 }, calendar: { ...entry('').calendar, allDay: true } }));
    await page.reload(); await view(page, '月');
    const card = page.locator('.fc-daygrid-event').filter({hasText: task.title}).first();
    const cell = page.locator('.fc-daygrid-day[data-date="2026-09-25"]');
    await expect(card).toBeVisible();
    expect((await card.boundingBox()).width / (await cell.boundingBox()).width).toBeGreaterThan(1.8);
    await view(page, '周');
    expect((await page.locator('.fc-daygrid-event').filter({hasText: task.title}).first().boundingBox()).width / (await page.locator('.fc-col-header-cell').first().boundingBox()).width).toBeGreaterThan(1.8);
  });

  test('月视图更多任务长标题收纳、紧凑布局、渐进打开并立即关闭', async ({ page }) => {
    for(let i=0;i<6;i++) await call('POST', E, entry(i === 0 ? '③ 夜间整理：课堂反馈、明日讲义与打印清单以及其他很长的任务内容' : `折叠任务${i}`));
    await page.reload(); await view(page, '月');
    const more = page.locator('[data-date="2026-09-25"] .fc-daygrid-more-link');
    await more.click();
    await expect(page.locator('.fc-more-popover')).toBeVisible();
    const enter=await page.locator('.fc-more-popover').evaluate(el=>new Promise(resolve=>{const values=[];const start=performance.now();function sample(){values.push(Number(getComputedStyle(el).opacity));if(performance.now()-start<220)requestAnimationFrame(sample);else resolve(values);}sample();}));
    expect(enter.some(x=>x>0&&x<1)).toBe(true);
    expect(enter.at(-1)).toBe(1);
    const panel = page.locator('.cal-month-more-popover');
    const layout = await panel.evaluate(el => ({width:el.getBoundingClientRect().width, client:el.clientWidth, scroll:el.scrollWidth}));
    expect(layout.scroll).toBeLessThanOrEqual(layout.client);
    expect(layout.width).toBeLessThanOrEqual(302);
    const title = panel.locator('.cal-month-more-event span').first();
    await expect(title).toHaveCSS('text-overflow', 'ellipsis');
    const closeButton = panel.getByRole('button', {name:'关闭',exact:true});
    await expect(closeButton).toHaveCSS('outline-style', 'none');
    await page.screenshot({path:test.info().outputPath('month-more.png')});
    await more.click();
    expect(await page.locator('.fc-more-popover').count()).toBe(0);
    await more.click();await more.click();await more.click();
    await expect(page.locator('.fc-more-popover')).toBeVisible();
    await page.keyboard.press('Escape');await expect(page.locator('.fc-more-popover')).toHaveCount(0);
    await more.click(); await closeButton.click();
    expect(await panel.count()).toBe(0);
    await more.click(); await page.locator('.cal-page').click({position:{x:4,y:4}});
    expect(await panel.count()).toBe(0);
  });

  test('事项点击完成和撤销，拖动完成事项保留状态并刷新读回', async ({page}) => {
    const task=await call('POST', E, entry('事项测试',{items:[{id:randomUUID(),text:'准备讲义',priority:'normal'},{id:randomUUID(),text:'整理反馈',priority:'normal'}]}));
    await page.reload();await open(page,task.title);
    const first=page.locator('.tbx-item-check').first();await first.click();
    await expect(page.locator('.tbx-item:not(.is-add)').first()).toHaveClass(/is-done/);
    await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[0].completed).toBe(true);
    await page.screenshot({path:test.info().outputPath('completed-item.png')});
    const a=await page.locator('.tbx-item-grip').first().boundingBox(),b=await page.locator('.tbx-item:not(.is-add)').last().boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+12,b.y+b.height-2,{steps:10});await page.mouse.up();
    await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[1].text).toBe('准备讲义');
    expect((await call('GET',`${E}/${task.id}`)).items[1].completed).toBe(true);
    await close(page);await page.reload();await open(page,task.title);
    await expect(page.locator('.tbx-item:not(.is-add)').last()).toHaveClass(/is-done/);
    await page.locator('.tbx-item-check').last().click();
    await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[1].completed).toBe(false);
  });

  test('过期提醒明确展示修改后的完整时段和提醒设定', async ({page})=>{
    const task=await call('POST',E,entry('提醒测试',{reminder:{side:'before',minutes:10}}));
    await page.reload();await open(page,task.title);
    await setScheduleField(page, '开始时间', '14:00');
    await setScheduleField(page, '结束时间', '14:05');
    const dialog=page.getByRole('dialog',{name:'提醒时间已过去',exact:true});await expect(dialog).toBeVisible();
    await expect(dialog.locator('.cal-reminder-decision')).toContainText('14:00 - 14:05');
    await expect(dialog.locator('.cal-reminder-decision')).toContainText('结束前 10 分钟');
    await page.screenshot({path:test.info().outputPath('reminder-time-range.png')});
    await dialog.getByRole('button',{name:'放弃本次修改',exact:true}).click();
  });

  test('跨午夜十分钟任务与当天其他任务共存时，月视图仍完整横跨两天', async({page})=>{
    await call('POST',E,entry('当天全天任务',{time:{...entry('').time,startTime:'00:00',durationMinutes:1440},calendar:{...entry('').calendar,allDay:true}}));
    await call('POST',E,entry('当天时间段任务'));
    const task=await call('POST',E,entry('夜间整理',{time:{...entry('').time,startTime:'23:50',durationMinutes:20}}));
    await page.reload();await view(page,'月');
    const card=page.locator('.fc-daygrid-event').filter({hasText:task.title}).first();await expect(card).toBeVisible();
    expect((await card.boundingBox()).width/(await page.locator('.fc-daygrid-day[data-date="2026-09-25"]').boundingBox()).width).toBeGreaterThan(1.8);
    expect(await card.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.right-12,r.top+r.height/2));})).toBe(true);
    await page.screenshot({path:test.info().outputPath('night-spans-days.png')});
  });

  test('跨天全天拖入时间网格为一小时，再拖回全天只保留一天', async({page})=>{
    const task=await call('POST',E,entry('全天转时段',{time:{...entry('').time,startTime:'00:00',durationMinutes:2880},calendar:{...entry('').calendar,allDay:true}}));
    await page.reload();await view(page,'周');
    await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible();

    const card=page.locator('.fc-daygrid-event').filter({hasText:task.title}).first();await expect(card).toBeVisible();
    const target=page.locator('.fc-timegrid-slot-lane[data-time="09:00:00"]').first();
    await target.scrollIntoViewIfNeeded();await expect(card).toHaveClass(/fc-event-draggable/);await card.hover({position:{x:25,y:12}});const slot=await target.boundingBox();const box=await card.boundingBox();
    await page.mouse.down();await page.mouse.move(box.x+25,slot.y+3,{steps:24});await page.mouse.up();
    await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.allDay).toBe(false);
    let saved=await call('GET',`${E}/${task.id}`);expect(saved.time.durationMinutes).toBe(60);
    const timed=page.locator('.fc-timegrid-event').filter({hasText:task.title});await expect(timed).toBeVisible();await expect(timed.locator('.cal-event-time')).toHaveText('9:00 - 10:00');await expect(timed).toHaveClass(/fc-event-draggable/);await expect(page.getByRole('region',{name:'即将到来',exact:true}).locator('.cal-upcoming-row')).toHaveCount(0);await timed.hover({position:{x:25,y:20}});
    const allDay=await page.locator('.fc-daygrid-day[data-date="2026-09-25"]').boundingBox();
    await page.mouse.down();await page.mouse.move(allDay.x+allDay.width/2,allDay.y+allDay.height/2,{steps:24});await page.mouse.up();
    await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.allDay).toBe(true);
    saved=await call('GET',`${E}/${task.id}`);expect(saved.time.durationMinutes).toBe(1440);expect(saved.time.date).toBe('2026-09-25');
  });

  for(const pending of [false,true]) test(`${pending?'待安排':'时间段任务'}无标题填写备注和标签后关闭或删除直接丢弃`, async({page})=>{
    await call('POST',L,{name:'准备',color:'#3edc81'});await page.reload();
    const section=page.getByRole('region',{name:pending?'待安排':'即将到来',exact:true});
    const create=async()=>{await section.getByRole('button',{name:pending?'新建待安排任务':'新建任务',exact:true}).click();await page.getByRole('textbox',{name:'备注',exact:true}).fill('尚未确定的想法');await page.locator('.tbx-labels').getByRole('button',{name:'准备',exact:true}).click();};
    await create();await close(page);expect((await call('GET',E)).items).toHaveLength(0);
    await create();await page.getByRole('textbox',{name:'添加事项',exact:true}).fill('没有标题也不保存');await page.getByRole('textbox',{name:'添加事项',exact:true}).press('Enter');
    await page.locator('.tbx-sheet-delete').click(); await page.locator('.tbx-sheet-delete').click();
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);expect((await call('GET',E)).items).toHaveLength(0);
  });

  for(const pending of [false,true]) test(`${pending?'待安排':'任务'}无标题草稿可点空白取消或切换对象，已保存对象可删除未完成编辑`,async({page})=>{
    const existing=await call('POST',E,entry('已保存对象',pending?{time:null}:{}));await page.reload();
    const section=page.getByRole('region',{name:pending?'待安排':'即将到来',exact:true});
    const create=async()=>{await section.getByRole('button',{name:pending?'新建待安排任务':'新建任务',exact:true}).click();await page.getByRole('textbox',{name:'备注',exact:true}).fill('不要保存');};
    await create();await page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]').click({position:{x:100,y:6}});await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    await create();if(pending){await close(page);await open(page,existing.title);}else await page.locator('.fc-event').filter({hasText:existing.title}).first().click();
    await expect(page.locator('#calendar-entry-title')).toHaveValue(existing.title);expect((await call('GET',E)).items).toHaveLength(1);
    await page.locator('#calendar-entry-title').fill('');await page.getByRole('textbox',{name:'备注',exact:true}).fill('尚未保存的备注');
    await page.locator('.tbx-sheet-delete').click(); await page.locator('.tbx-sheet-delete').click();

    await expect(page.locator('.tbx-sheet')).toHaveCount(0);expect((await call('GET',E)).items).toHaveLength(0);
  });

  for (const kind of ['时间段', '跨日全天', '重复']) test(`月视图弹层中的${kind}任务可拖到其他日期且不误打开或重复创建`, async ({page}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for(let i=0;i<5;i++) await call('POST',E,entry(`折叠占位${i}`));
    const task=await call('POST',E,entry(`需要拖动的${kind}`,kind==='跨日全天' ? {time:{...entry('').time,startTime:'00:00',durationMinutes:2880},calendar:{...entry('').calendar,allDay:true}} : kind==='重复' ? {repeat:{frequency:'weekly',interval:1,weekdays:[5],monthly:'date',count:0,until:'2026-10-30'}} : {}));
    await page.reload();await view(page,'月');
    await page.locator('[data-date="2026-09-25"] .fc-daygrid-more-link').click();
    const row=page.locator('.cal-month-more-event').filter({hasText:task.title});
    await expect(row).toBeVisible();
    let releaseRefresh, refreshStarted;
    if(kind==='时间段') {
      const gate=new Promise(resolve=>{releaseRefresh=resolve;});
      refreshStarted=new Promise(resolve=>{
        page.route('**/api/modules/schedule/occurrences?**',async route=>{resolve();await gate;await route.continue();});
      });
    }
    const from=await row.boundingBox(),to=await page.locator('.fc-daygrid-day[data-date="2026-09-26"]').boundingBox();
    const target = { x: to.x + to.width / 2, y: to.y + 50 };
    expect(await page.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y)?.closest('.cal-month-more-popover')), target)).toBe(true);
    await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
    // Drag to the adjacent date currently covered by the overflow panel.
    await page.mouse.move(target.x,target.y,{steps:20});
    await page.screenshot({ path: test.info().outputPath('month-more-adjacent-drag.png') });
    await page.mouse.up();
    await expect(page.locator('.cal-month-more-popover')).toHaveCount(0);
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    if(refreshStarted) {
      await refreshStarted;
      try { await expect(page.locator('.cal-loading')).toHaveCount(0); }
      finally { releaseRefresh(); }
    }
    await expect.poll(async()=>{
      const list=(await call('GET',E)).items.filter(x=>x.title===task.title);
      return list.some(x=>x.time.date==='2026-09-26');
    }).toBe(true);
    const list=(await call('GET',E)).items.filter(x=>x.title===task.title);
    const moved=list.find(x=>x.time.date==='2026-09-26');
    expect(moved.time.startTime).toBe(task.time.startTime);
    expect(moved.time.durationMinutes).toBe(task.time.durationMinutes);
    expect(moved.calendar.allDay).toBe(task.calendar.allDay);
    expect(list).toHaveLength(kind==='重复'?2:1);
    if(kind==='重复') expect(moved.repeat).toBeNull();
    await expect(page.locator('.cal-loading')).toHaveCount(0);
  });

  test('月视图更多任务拖动取消或放回原日期，保留父编辑器和原任务', async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (let index = 0; index < 5; index++) await call('POST', E, entry(`取消拖动占位${index}`));
    const task = await call('POST', E, entry('更多拖动取消'));
    await page.reload(); await open(page, task.title); await view(page, '月');
    await page.locator('[data-date="2026-09-25"] .fc-daygrid-more-link').click();
    const panel = page.locator('.cal-month-more-popover');
    const row = panel.locator('.cal-month-more-event').filter({ hasText: task.title });
    const dragTo = async date => {
      await row.hover();
      const from = await row.boundingBox();
      const to = await page.locator(`.fc-daygrid-day[data-date="${date}"]`).boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + 50, { steps: 20 });
    };
    await dragTo('2026-09-26');
    await page.screenshot({ path: info.outputPath('month-more-cancel-mid-drag.png') });
    await page.keyboard.press('Escape');
    await expect(panel).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
    expect((await call('GET', `${E}/${task.id}`)).version).toBe(task.version);
    await dragTo('2026-09-25');
    await page.mouse.up();
    await expect(panel).toHaveCount(0);
    await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
    const saved = await call('GET', `${E}/${task.id}`);
    expect(saved.time).toEqual(task.time);
    expect(saved.version).toBe(task.version);
  });
});

test.describe('字段校验与编辑可达性', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });
  const E = '/api/modules/schedule/entries';

  let world, client, now, errors;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
    const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
  }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page }) => {
    now = '2026-09-25T06:00:00Z';
    await page.clock.setFixedTime(new Date(now));
    errors = []; page.on('pageerror', e => errors.push(e.message));
    ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-polish@example.test'));
    await loginSchedule(page, world, 'schedule-polish@example.test');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  test('无效结束时间就地提示不挤动布局，关闭保留原时间且不阻塞',async({page})=>{
    const task=await call('POST',E,entry('关闭交互待核对'));
    await page.reload();await open(page,task.title);
    const notes=page.getByRole('textbox',{name:'备注',exact:true});
    await notes.click();
    const before=await notes.boundingBox();
    await setScheduleField(page, '结束时间', '14:55');
    await expect(page.locator('.tbx-sheet').getByRole('button', { name: '结束时间', exact: true })).toHaveAttribute('aria-invalid','true');
    await expect(page.locator('.tbx-sheet-hint.is-error')).toContainText('结束时间要晚于开始时间');
    await expect(page.locator('.tbx-sheet-hint.is-error')).toHaveCSS('color','rgb(215, 0, 21)');
    await expect(page.locator('.tbx-sheet-hint.is-error')).toHaveCSS('font-size','12.5px');
    expect((await notes.boundingBox()).y).toBe(before.y);
    await expect(page.locator('.tbx-sheet > .cal-error')).toHaveCount(0);
    await page.screenshot({path:test.info().outputPath('invalid-time-inline.png')});
    await page.getByRole('textbox',{name:'备注',exact:true}).fill('无效时间不妨碍保留这条备注');
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    const saved=await call('GET',`${E}/${task.id}`);
    expect(saved.time).toEqual(task.time);
    expect(saved.calendar.notes).toBe('无效时间不妨碍保留这条备注');
    await open(page,task.title);
    await expectScheduleField(page, '结束时间', '15:30');
    await setScheduleField(page, '结束时间', '14:55');
    await setScheduleField(page, '结束时间', '15:45');
    await expect(page.locator('.tbx-sheet-hint.is-error')).toHaveCount(0);
    await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).time.durationMinutes).toBe(45);
  });
});

test.describe('视图范围与字段边界', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, now, errors;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
      repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
      const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
      expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
    }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page }) => {
      now = '2026-09-25T06:00:00Z';
      await page.clock.setFixedTime(new Date(now));
      errors = []; page.on('pageerror', e => errors.push(e.message));
      ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-graph@example.test'));
      await loginSchedule(page, world, 'schedule-graph@example.test');
      await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
    });

  test.afterEach(async ({ context }, info) => {
      await closeScheduleWorld(context, world, errors, info);
    });

  async function action(page, name) { await scheduleAction(page, name); }

  async function closed(page) { await page.getByRole('button',{name:'关闭',exact:true}).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];

  async function reloadOpen(page,task){await page.reload();await open(page,task.title);}

  async function view(page,name){await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:new RegExp(`^${name}\\s`)}).click();}

  async function named(page){const task=await call('POST',E,entry('课堂准备',{items:row()}));await reloadOpen(page,task);return task;}

  test('G3 无效结束时间关闭后恢复原时间并保存有效备注',async({page})=>{
    const task=await named(page);await page.getByRole('textbox',{name:'备注',exact:true}).fill('有效备注应保留');
    await setScheduleField(page,'结束时间','14:59');await closed(page);
    const saved=await call('GET',`${E}/${task.id}`);expect(saved.time).toEqual(task.time);expect(saved.calendar.notes).toBe('有效备注应保留');
  });

  for(const shape of ['普通任务','待安排','重复实例'])test(`G4 ${shape}长备注保存错误不会藏在屏幕之外`,async({page})=>{
     const task=await call('POST',E,entry('备注边界',{...(shape==='待安排'?{time:null}:{}),...(shape==='重复实例'?{repeat:{until:'2026-10-09'}}:{})}));await reloadOpen(page,task);await page.getByRole('textbox',{name:'备注',exact:true}).fill('字'.repeat(50001));await page.getByRole('button',{name:'关闭',exact:true}).click();
     await expect(page.locator('.tbx-sheet-error')).toBeVisible();const feedback=await page.locator('.tbx-sheet-error').boundingBox(),side=await page.locator('.cal-sidebar').boundingBox();expect(feedback.y).toBeGreaterThanOrEqual(side.y);expect(feedback.y+feedback.height).toBeLessThanOrEqual(side.y+side.height);
     expect((await call('GET',`${E}/${task.id}`)).calendar.notes).toBe('');
    });

  for(const target of ['标题','备注','时间','完成','添加事项'])test(`G5 修改${target}取消快速新建时，不创建空标题对象`,async({page})=>{
     await page.getByRole('button',{name:'新建任务',exact:true}).click();
     if(target==='标题')await page.locator('#calendar-entry-title').fill('   ');
     if(target==='备注')await page.getByRole('textbox',{name:'备注',exact:true}).fill('没有标题的备注');
     if(target==='时间')await setScheduleField(page, '开始时间', '22:00');
     if(target==='完成'){await page.getByRole('textbox',{name:'添加事项',exact:true}).fill('没有标题的事项');await page.getByRole('textbox',{name:'添加事项',exact:true}).press('Enter');await page.locator('.tbx-item-check').first().click();}
     if(target==='添加事项')await page.getByRole('textbox',{name:'添加事项',exact:true}).click();
     await closed(page);expect((await call('GET',E)).items).toHaveLength(0);
    });

  for(const width of [1675,1100,768,390])for(const theme of ['浅色','深色'])test(`K1 ${width} ${theme}任务菜单和提醒浮层在可视区域内，字段与焦点不溢出`,async({page})=>{
     const task=await call('POST',E,entry('较长的课堂准备标题：函数概念、定义域与值域',{items:row(),calendar:{allDay:false,notes:'多行备注\n第二行',tags:[]}}));
     await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:theme,exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();await page.setViewportSize({width,height:950});if(width<=950)await page.getByRole('button',{name:'打开月份与任务',exact:true}).click();await open(page,task.title);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await expect(d).toBeVisible();await expect(d).toHaveCSS('opacity','1');const b=await d.boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(950);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await d.getByLabel('分钟数',{exact:true}).click();await page.screenshot({path:test.info().outputPath('dialog-field.png')});
    });

  for(const count of ['','0','32','1.5'])test(`K2 自定义视图天数${count||'空'}不可提交`,async({page})=>{
     await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitem',{name:'天数',exact:true}).hover();await page.getByRole('menuitem',{name:'其他…',exact:true}).click();const d=page.getByRole('dialog',{name:'自定义天数',exact:true});await d.getByLabel('天数',{exact:true}).fill(count);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.tbx-sheet')).toHaveCount(0);
    });

  for(const count of ['1','9','31'])test(`K3 自定义${count}天视图与翻段、今天、刷新一致`,async({page})=>{
     await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitem',{name:'天数',exact:true}).hover();await page.getByRole('menuitem',{name:'其他…',exact:true}).click();const d=page.getByRole('dialog',{name:'自定义天数',exact:true});await d.getByLabel('天数',{exact:true}).fill(count);await d.getByRole('button',{name:'完成',exact:true}).click();await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(Number(count));const first=await page.locator('.fc-timegrid-col[data-date]').first().getAttribute('data-date');await page.getByRole('button',{name:'下一段',exact:true}).click();await page.getByRole('button',{name:'上一段',exact:true}).click();await expect(page.locator('.fc-timegrid-col[data-date]').first()).toHaveAttribute('data-date',first);await page.getByRole('button',{name:'今天',exact:true}).click();await page.reload();await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(Number(count));
    });

  test('K4 标签达到30个后不允许静默选入第31个导致任务无法保存',async({page})=>{
     const labels=[];for(let i=0;i<31;i++)labels.push(await call('POST',L,{name:`标签${String(i+1).padStart(2,'0')}`,color:'#63c6ec'}));const task=await call('POST',E,entry('标签数量边界',{calendar:{allDay:false,notes:'',tags:labels.slice(0,30).map(x=>x.id)}}));await reloadOpen(page,task);const option=page.locator('.tbx-labels').getByRole('button',{name:'标签31',exact:true});
     await expect(option).toBeDisabled();await page.locator('.tbx-sheet').getByRole('button',{name:'关闭',exact:true}).click();await expect(page.locator('.tbx-sheet')).toHaveCount(0);expect((await call('GET',`${E}/${task.id}`)).calendar.tags).toHaveLength(30);
    });

  for(const year of ['1900-01-01','2100-12-31'])test(`K5 浏览边界日期${year}的日周月视图不会失败或跳出支持范围`,async({page})=>{
     const task=await call('POST',E,entry('边界任务',{time:{...entry('').time,date:year}}));await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expectScheduleField(page, '开始日期', year);
     for(const name of ['日','周','月']){await view(page,name);await expect(page.locator('.cal-load-error')).toHaveCount(0);await expect(page.locator('.fc-event').filter({hasText:task.title}).first()).toBeVisible();}
    });

  for(const viewName of ['周','月'])test(`K6 跨两周全天在${viewName}视图保留连续范围、标题截断和更多入口`,async({page})=>{
     const task=await call('POST',E,entry('跨两周全天标题：备课与教研任务长内容重复重复重复',{time:{...entry('').time,date:'2026-09-22',startTime:'00:00',durationMinutes:1440*14},calendar:{allDay:true,notes:'',tags:[]}}));await page.reload();await view(page,viewName);const cards=page.locator('.fc-daygrid-event').filter({hasText:task.title});await expect(cards.first()).toBeVisible();for(const card of await cards.all()){const b=await card.boundingBox();if(!b)continue;const title=card.locator('.cal-event-title');expect(await title.evaluate(el=>getComputedStyle(el).textOverflow)).toBe('ellipsis');}
     expect((await call('GET',`${E}/${task.id}`)).time.durationMinutes).toBe(20160);
    });

  test('K7 创建标签后切换到标签分组，两区都正确出现新分类',async({page})=>{
     await named(page);await page.getByRole('button', { name: '新标签', exact: true }).click();const d=page.getByRole('dialog',{name:'创建标签',exact:true});await d.getByLabel('标签名称',{exact:true}).fill('新建分类');await d.getByRole('button',{name:'保存',exact:true}).click();await closed(page);const upcoming=page.getByRole('region',{name:'即将到来',exact:true});await upcoming.getByRole('button',{name:'按标签分组',exact:true}).click();await expect(upcoming.locator('.cal-upcoming-group')).toContainText('新建分类');
    });

  for(const until of ['', '2026-09-24','2101-01-01'])test(`K10 重复结束日期${until||'空'}不可提交且取消可用`,async({page})=>{
     await named(page);await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});await d.locator('input[name=repeat-end]').nth(1).check();await d.getByLabel('重复结束日期',{exact:true}).fill(until);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.tbx-sheet')).toBeVisible();
    });

  for(const placement of ['普通任务','待安排','重复任务'])test(`K11 删除${placement}已使用的标签后继续改标题并保存，不残留失效引用`,async({page})=>{
     const label=await call('POST',L,{name:'准备删除',color:'#63c6ec'});const task=await call('POST',E,entry('标签生命周期',{...(placement==='待安排'?{time:null}:{}),...(placement==='重复任务'?{repeat:{until:'2026-10-09'}}:{}),calendar:{allDay:false,notes:'保留备注',tags:[label.id]}}));await page.goto(`${world.origin}/calendar?entry=${task.id}${placement==='重复任务'?'&on=2026-09-25':''}`);await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);await page.locator('.tbx-labels').getByRole('button',{name:'准备删除',exact:true}).dblclick();await page.getByRole('dialog',{name:'编辑标签',exact:true}).getByRole('button',{name:'删除标签',exact:true}).click();await page.getByRole('dialog',{name:'编辑标签',exact:true}).getByRole('button',{name:'确认删除',exact:true}).click();await expect(page.getByRole('dialog',{name:'编辑标签',exact:true})).toHaveCount(0);await page.locator('#calendar-entry-title').fill('删除标签后继续编辑');await closed(page);const rows=(await call('GET',E)).items;const changed=rows.find(x=>x.title==='删除标签后继续编辑');expect(changed,JSON.stringify(rows)).toBeTruthy();expect(changed.calendar.notes).toBe('保留备注');await page.reload();await expect(page.locator('.cal-load-error')).toHaveCount(0);
    });

  for(const date of ['1900-01-01','2100-12-31'])for(const viewName of ['日','周','月'])test(`K12 支持范围端点${date}在${viewName}视图正常加载`,async({page},info)=>{
     const task=await call('POST',E,entry('范围端点',{time:{...entry('').time,date}}));const bad=[];page.on('response',async r=>{if(r.status()>=400&&r.url().includes('/schedule/'))bad.push({status:r.status(),url:r.url()});});await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expectScheduleField(page, '开始日期', date);await view(page,viewName);await expect(page.getByRole('button',{name:'日历视图',exact:true})).toContainText(viewName);try{await expect(page.locator('.cal-load-error')).toHaveCount(0);await expect(page.locator('.fc-event').filter({hasText:task.title}).first()).toBeVisible();}finally{fs.writeFileSync(info.outputPath('range-http.json'),JSON.stringify({date,viewName,bad},null,2));}
    });

  for(const placement of ['任务','待安排'])test(`K13 ${placement}标题与事项达到输入上限，备注多行纯文本保持原样`,async({page})=>{
     const task=await call('POST',E,entry('输入边界',{...(placement==='待安排'?{time:null}:{}),items:row()}));await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);const title='题'.repeat(300),item='事'.repeat(4000),notes='第一行\n第二行 <b>字面文本</b>\n🙂';await page.locator('#calendar-entry-title').fill(title+'多');await expect(page.locator('#calendar-entry-title')).toHaveValue(title);await page.getByLabel('事项 1',{exact:true}).fill(item+'多');await expect(page.getByLabel('事项 1',{exact:true})).toHaveValue(item);await page.getByRole('textbox',{name:'备注',exact:true}).fill(notes);await closed(page);const saved=await call('GET',`${E}/${task.id}`);expect(saved.title).toBe(title);expect(saved.items[0].text).toBe(item);expect(saved.calendar.notes).toBe(notes);await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText(notes);
    });

  test('K14 越界重复结束日期不能把编辑器困在泛化错误中',async({page})=>{
     const task=await named(page);await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});await d.locator('input[name=repeat-end]').nth(1).check();await d.getByLabel('重复结束日期',{exact:true}).fill('2101-01-01');const done=d.getByRole('button',{name:'完成',exact:true});if(await done.isDisabled()){await d.getByRole('button',{name:'取消',exact:true}).click();return;}await done.click();await page.getByRole('button',{name:'关闭',exact:true}).click();await expect(page.locator('.tbx-sheet')).toHaveCount(0);expect((await call('GET',`${E}/${task.id}`)).repeat).toBeNull();
    });

  test('K15 八个标签颜色均可选择保存，取消改色保留已保存颜色',async({page})=>{
     let label=await call('POST',L,{name:'颜色检查',color:'#ff6b75'});await named(page);
     for(const color of ['#ff6b75','#3edc81','#5b9cf5','#a78bfa','#ffb454','#f27ab8','#43c6c6','#9ba0aa']){await page.locator('.tbx-labels').getByRole('button',{name:'颜色检查',exact:true}).dblclick();const d=page.getByRole('dialog',{name:'编辑标签',exact:true});await d.getByRole('button',{name:`颜色 ${color}`,exact:true}).click();await expect(d.getByRole('button',{name:`颜色 ${color}`,exact:true})).toHaveAttribute('aria-pressed','true');await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d).toHaveCount(0);label=(await call('GET',L)).items.find(x=>x.id===label.id);expect(label.color).toBe(color);}
     await page.locator('.tbx-labels').getByRole('button',{name:'颜色检查',exact:true}).dblclick();const d=page.getByRole('dialog',{name:'编辑标签',exact:true});await d.getByRole('button',{name:'颜色 #ff6b75',exact:true}).click();await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',L)).items.find(x=>x.id===label.id).color).toBe('#9ba0aa');
    });

  test('K16 六种重复快捷设置执行并显示实际保存的规则',async({page})=>{
     const task=await named(page);
     for(const [name,frequency,interval,weekdays]of [['每天','daily',1,null],['每个工作日','weekly',1,[1,2,3,4,5]],['每周','weekly',1,[5]],['每两周','weekly',2,[5]],['每月（日期）','monthly',1,null],['不重复',null,null,null]]){await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();await page.getByRole('menuitemradio',{name,exact:true}).click();await expect.poll(async()=>{const head=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.endsWith(':head:scene:schedule-calendar'));const branch=key&&JSON.parse(localStorage.getItem(key));return branch?JSON.parse(localStorage.getItem(branch)).value.draft:null;});return Boolean(head&&JSON.stringify(head.content)===JSON.stringify(head.baseline));}).toBe(true);const saved=await call('GET',`${E}/${task.id}`);if(!frequency){expect(saved.repeat).toBeNull();await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ })).toContainText('不重复');}else{expect(saved.repeat.frequency).toBe(frequency);expect(saved.repeat.interval).toBe(interval);if(weekdays)expect(saved.repeat.weekdays).toEqual(weekdays);await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ })).toBeVisible();}}
    });

  test('K17 标签名上限与空白校验可取消，不创建空标签',async({page})=>{
     await call('POST',L,{name:'课堂',color:'#63c6ec'});await named(page);await expect(page.getByRole('searchbox',{name:'搜索标签',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'新标签',exact:true}).click();const d=page.getByRole('dialog',{name:'创建标签',exact:true});await d.getByLabel('标签名称',{exact:true}).fill('   ');await expect(d.getByRole('button',{name:'保存',exact:true})).toBeDisabled();await d.getByLabel('标签名称',{exact:true}).fill('名'.repeat(61));await expect(d.getByLabel('标签名称',{exact:true})).toHaveValue('名'.repeat(60));await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',L)).items).toHaveLength(1);
    });
});

test.describe('手势取消、通知与字段校验', () => {
  // CDP owns runtime timezone changes; a context override would prevent later changes.
  const E = '/api/modules/schedule/entries';

  let world, client, now, errors, cdp;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
      repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
      const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
      expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
    }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page,context }) => {
      cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Shanghai'});
      now = '2026-09-25T06:00:00Z';
      await page.clock.setFixedTime(new Date(now));
      errors = []; page.on('pageerror', e => errors.push(e.message));
      ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-graph@example.test'));
      await loginSchedule(page, world, 'schedule-graph@example.test');
      await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
    });

  test.afterEach(async ({ context }, info) => {
      await closeScheduleWorld(context, world, errors, info);
    });

  async function action(page, name) { await scheduleAction(page, name); }

  async function reloadOpen(page,task){await page.reload();await open(page,task.title);}

  const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];

  async function dayView(page){await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:/^日\s/}).click();}

  const N='/api/modules/schedule/notifications';

  async function due(page){for(let i=0;i<3;i++)await call('POST',E,entry(`通知任务${i+1}`,{reminder:{side:'before',minutes:0}}));now='2026-09-25T07:31:00Z';await page.clock.setFixedTime(new Date(now));await page.reload();await expect.poll(async()=>(await call('GET',N)).items.length).toBe(3);await page.getByRole('button',{name:'通知',exact:true}).click();return page.locator('.tb-popover-notifications');}

  for(const value of ['', '0','-1','1.5','1000'])test(`R6 重复间隔${value||'空'}不可保存且取消可用`,async({page})=>{
     const task=await call('POST',E,entry('课堂准备'));await reloadOpen(page,task);await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});await d.getByLabel('重复间隔',{exact:true}).fill(value);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);
    });

  for(const value of ['', '-1','0.5','10081'])test(`R7 提醒分钟${value||'空'}不可保存且取消可用`,async({page})=>{
     const task=await call('POST',E,entry('课堂准备'));await reloadOpen(page,task);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await d.getByLabel('分钟数',{exact:true}).fill(value);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);
    });

  for(const selected of [false,true])test(`T1 网格任务拖动中按Escape只取消拖动，任务${selected?'已选中':'未选中'}不改期`,async({page})=>{
     const task=await call('POST',E,entry('取消任务拖动'));await page.reload();if(selected)await open(page,task.title);await dayView(page);const card=page.locator('.fc-timegrid-event:not(.fc-event-mirror)').filter({hasText:task.title});await card.scrollIntoViewIfNeeded();const b=await card.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2+104,{steps:16});await expect(page.locator('.fc-event-mirror')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(900);expect((await call('GET',`${E}/${task.id}`)).time).toEqual(task.time);if(selected)await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
    });

  test('T2 时间网格拖选中按Escape，松手后不重新弹出新建任务',async({page})=>{
     await dayView(page);const slot=page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');await slot.scrollIntoViewIfNeeded();const r=await slot.boundingBox();await page.mouse.move(r.x+120,r.y+2);await page.mouse.down();await page.mouse.move(r.x+120,r.y+r.height*4-2,{steps:15});await expect(page.locator('.cal-selection-time')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.tbx-sheet')).toHaveCount(0);await expect(page.locator('.cal-selection-time')).toHaveCount(0);
    });

  test('T3 编辑器替代小月历，关闭后取消日期拖选不会修改任务',async({page})=>{
     const task=await call('POST',E,entry('小月历取消范围'));await reloadOpen(page,task);
     await expect(page.locator('.cal-mini')).toBeHidden();
     await page.locator('.tbx-sheet').getByRole('button',{name:'关闭',exact:true}).click();
     const selected=await page.locator('.cal-mini [aria-pressed=true]').evaluateAll(nodes=>nodes.map(node=>node.dataset.date));
     const a=await page.locator('.cal-mini [data-date="2026-09-25"]').boundingBox(),b=await page.locator('.cal-mini [data-date="2026-09-28"]').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.keyboard.press('Escape');await page.mouse.up();
     expect(await page.locator('.cal-mini [aria-pressed=true]').evaluateAll(nodes=>nodes.map(node=>node.dataset.date))).toEqual(selected);
     await open(page,task.title);await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);
    });

  test('T4 调整结束边缘时按Escape，松手不会提交新的时长',async({page})=>{
     const task=await call('POST',E,entry('取消拉伸'));await reloadOpen(page,task);await dayView(page);const card=page.locator('.fc-timegrid-event:not(.fc-event-mirror)').filter({hasText:task.title});await card.hover();await card.evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))));await page.mouse.wheel(0,260);await expect.poll(async()=>{const box=await card.boundingBox();return box.y+box.height<800;}).toBe(true);await card.hover();const h=await card.locator('.fc-event-resizer-end').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2,h.y+h.height/2+52,{steps:12});await expect(page.locator('.fc-event-mirror')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(900);expect((await call('GET',`${E}/${task.id}`)).time).toEqual(task.time);
    });

  test('T5 通知全部已读、切回未读及拖到垃圾桶只删除那一条',async({page})=>{
     const panel=await due(page);await panel.getByRole('button',{name:'全部已读',exact:true}).click();await expect.poll(async()=>(await call('GET',N)).unreadCount).toBe(0);const first=panel.locator('.tb-notification').first();await expect(first).toHaveClass(/is-read/);await first.click();await expect.poll(async()=>(await call('GET',N)).unreadCount).toBe(1);await panel.getByRole('button',{name:'全部已读',exact:true}).click();await expect.poll(async()=>(await call('GET',N)).unreadCount).toBe(0);await expect(first).toHaveClass(/is-read/);await first.dragTo(panel.locator('.tb-notification-trash'));expect((await call('GET',N)).items).toHaveLength(3);await panel.getByRole('button',{name:'确认删除',exact:true}).click();await expect.poll(async()=>(await call('GET',N)).items.length).toBe(2);expect((await call('GET',E)).items).toHaveLength(3);
    });

  for (const [width,theme] of [[1675,'浅色'],[1675,'深色'],[390,'浅色'],[390,'深色']]) test(`T6 全部已读响应丢失后关闭再打开面板，可确认原请求且不重复通知${width===1675&&theme==='浅色'?'':`，${width}${theme}`}`,async({page},info)=>{
     if(theme==='深色'){await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:theme,exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();}await page.setViewportSize({width,height:950});
     const panel=await due(page);let first=true;await page.route('**/api/modules/schedule/notification-actions',async route=>{if(!first)return route.continue();first=false;await route.fetch();await route.abort('failed');});await panel.getByRole('button',{name:'全部已读',exact:true}).click();await expect(page.locator('.tb-notification-problem')).toBeVisible();await page.locator('.tb-topbar').click({position:{x:350,y:20}});await expect(panel).toHaveCount(0);await page.getByRole('button',{name:'通知',exact:true}).click();
     await expect(panel).toHaveCSS('opacity','1');const frame=await panel.boundingBox(),problem=await page.locator('.tb-notification-problem').boundingBox();expect(problem.x).toBeGreaterThanOrEqual(frame.x);expect(problem.y).toBeGreaterThanOrEqual(frame.y);expect(problem.x+problem.width).toBeLessThanOrEqual(frame.x+frame.width);expect(problem.y+problem.height).toBeLessThanOrEqual(frame.y+frame.height);await page.screenshot({path:info.outputPath('notification-retry.png')});
     await page.locator('.tb-notification-problem').getByRole('button',{name:'重试',exact:true}).click();await expect(page.locator('.tb-notification-problem')).toHaveCount(0);expect((await call('GET',N)).unreadCount).toBe(0);expect((await call('GET',N)).items).toHaveLength(3);
    });

  test('N4 目标已有200条事项时不会用泛化错误代替容量说明',async({page})=>{
     const source=await call('POST',E,entry('需要移动的事项',{items:row()}));const target=await call('POST',E,entry('已经填满的待安排',{time:null,items:Array.from({length:200},(_,i)=>({id:randomUUID(),text:`第${i+1}项`,priority:'normal'}))}));await reloadOpen(page,source);await page.locator('.tbx-item:not(.is-add)').nth(0).getByRole('button', { name: '事项选项', exact: true }).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();const d=page.getByRole('dialog',{name:'移动事项',exact:true});await d.getByLabel('移到',{exact:true}).selectOption(target.id);const move=d.getByRole('button',{name:'移动事项',exact:true});if(await move.isDisabled()){await expect(d).toContainText(/200|已满|上限/);return;}await move.click();await expect(d.getByRole('alert')).toContainText(/200|已满|上限/);expect((await call('GET',`${E}/${source.id}`)).items).toHaveLength(1);expect((await call('GET',`${E}/${target.id}`)).items).toHaveLength(200);
    });

  test('N5 编辑任务时按Escape关闭通知，只关闭通知而保留任务编辑现场',async({page})=>{
     const task=await call('POST',E,entry('通知关闭时保留编辑',{time:{...entry('').time,startTime:'16:00'}}));const panel=await due(page);await page.locator('.tb-topbar').click({position:{x:350,y:20}});await expect(panel).toHaveCount(0);await open(page,task.title);await page.getByRole('textbox',{name:'备注',exact:true}).fill('尚在编辑的备注');await page.getByRole('button',{name:'通知',exact:true}).click();await expect(panel).toBeVisible();await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText('尚在编辑的备注');
    });
});
