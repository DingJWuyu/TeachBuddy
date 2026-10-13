/**
 * T52 browser suite: the schedule grid, real pointer selection, unscheduled
 * items, priority view, weekly exceptions, scene recovery and the unconfirmed
 * save protocol.
 *
 * The stack is started by this spec: one isolated HTTPS origin serving the built
 * schedule page and the real workbench API composed with the T52 fixtures. No
 * synthetic DragEvent is used; selection is a real pointer trajectory.
 */
import assert from 'node:assert/strict';
import request from 'supertest';
import { expect, test } from '@playwright/test';
import { resetFixtureRuntime } from '../../api/test/fixtures/teaching-time-schedule/runtime.js';
import {
  buildScheduleWeb,
  SCHEDULE_PAGE,
  startScheduleRunner
} from './teaching-time-schedule-runner.mjs';

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });

let runner;
let sequence = 0;

function nextKey() {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function api(accountKey) {
  const cookie = runner.cookieFor(accountKey);
  const origin = runner.origin;
  function send(method, url, { body, key } = {}) {
    let req = request(runner.app.app)[method](url)
      .set('Cookie', `${cookie.name}=${cookie.value}`)
      .set('Origin', origin);
    if (method !== 'get') req = req.set('X-TeachBuddy-Request', '1');
    if (key) req = req.set('Idempotency-Key', key);
    if (body !== undefined) req = req.send(body);
    return req;
  }
  return {
    get: (url) => send('get', url),
    post: (url, body, key = nextKey()) => send('post', url, { body, key }),
    put: (url, body, key = nextKey()) => send('put', url, { body, key })
  };
}

function entryBody(overrides = {}) {
  return {
    title: '备课',
    items: [{ id: overrides.itemId ?? '50000000-0000-4000-8000-000000000001', text: '选例题', priority: 'normal' }],
    time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 },
    repeat: null,

    reminder: null,
    ...overrides
  };
}

async function openPage(page, accountKey = 'teacher-a') {
  const cookie = runner.cookieFor(accountKey);
  await page.context().addCookies([{
    name: cookie.name,
    value: cookie.value,
    url: runner.origin,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  }]);
  await page.goto(`${runner.origin}${SCHEDULE_PAGE}`);
  await expect(page.locator('[data-region="schedule"]')).toBeVisible();
  await expect(page.locator('[data-region="day-column"]').first()).toBeVisible();
}

async function setRange(page, from, to) {
  await page.locator('input[name="range-from"]').fill(from);
  await page.locator('input[name="range-to"]').fill(to);
  await page.locator('[data-action="apply-range"]').click();
  await expect(page.locator(`[data-region="day-column"][data-day="${from}"]`)).toBeVisible();
}

/**
 * Point inside the real hour cell, so the grid's own geometry is the oracle.
 * The +5 minute offset keeps the pointer away from the exact bucket boundary.
 */
async function dayPoint(page, day, hour, minute) {
  const cell = page.locator(`[data-region="day-column"][data-day="${day}"] [data-hour="${hour}"]`);
  const box = await cell.boundingBox();
  return {
    x: box.x + Math.min(box.width - 12, Math.max(12, box.width / 2)),
    y: box.y + ((minute + 5) / 60) * box.height
  };
}

/** Real pointer trajectory: down, several moves, up. Returns the selection. */
async function dragSelect(page, day, fromHour, fromMinute, toHour, toMinute) {
  const start = await dayPoint(page, day, fromHour, fromMinute);
  const end = await dayPoint(page, day, toHour, toMinute);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 8, { steps: 2 });
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

test.beforeAll(async () => {
  buildScheduleWeb();
  runner = await startScheduleRunner({ port: 47113 });
});

// Every scenario starts from the same fixed clock and an empty schedule.
test.beforeEach(() => {
  resetFixtureRuntime();
  runner.resetData();
});

test.afterAll(async () => {
  await runner?.close();
});

test('WB-T005: an arbitrary range, a real pointer selection and the AI draft survive', async ({ page }) => {
  await openPage(page);
  await setRange(page, '2026-09-21', '2026-10-01');
  await expect(page.locator('[data-region="day-column"]')).toHaveCount(11);
  await expect(page.locator('[data-region="range-label"]')).toContainText('11 天');

  // Open the AI panel and leave a draft in it.
  await page.locator('[data-action="toggle-panel"]').click();
  await expect(page.locator('[data-region="ai-workspace"]')).toBeVisible();
  await page.locator('[data-region="ai-workspace"] textarea').fill('帮我准备函数单调性的例题');
  await expect(page.locator('[data-region="harness-shell"]')).toHaveAttribute('data-panel-mode', 'ai');

  // Changing the visible range must not steal the panel or lose the draft.
  await setRange(page, '2026-09-21', '2026-09-27');
  await expect(page.locator('[data-region="day-column"]')).toHaveCount(7);
  await expect(page.locator('[data-region="harness-shell"]')).toHaveAttribute('data-panel-mode', 'ai');
  await expect(page.locator('[data-region="ai-workspace"] textarea')).toHaveValue('帮我准备函数单调性的例题');

  // A real pointer selection from 15:00 to 16:30 on 2026-09-21.
  await dragSelect(page, '2026-09-21', 15, 0, 16, 30);
  const selection = page.locator('[data-region="selection"]');
  await expect(selection).toHaveCount(1);
  await expect(selection).toHaveAttribute('data-day', '2026-09-21');
  await expect(selection).toHaveAttribute('data-start', '15:00');
  await expect(selection).toHaveAttribute('data-end', '16:30');
  await expect(page.locator('[data-region="selection"][data-day="2026-09-22"]')).toHaveCount(0);

  // The panel switches to the schedule tool and keeps the AI draft.
  await expect(page.locator('[data-region="harness-shell"]')).toHaveAttribute('data-panel-mode', 'schedule');
  await expect(page.locator('[data-region="entry-editor"]')).toBeVisible();
  await expect(page.locator('input[name="entry-date"]')).toHaveValue('2026-09-21');
  await expect(page.locator('input[name="entry-start"]')).toHaveValue('15:00');
  await expect(page.locator('input[name="entry-duration"]')).toHaveValue('90');
  await page.locator('[role="tab"]', { hasText: 'AI 助理' }).click();
  await expect(page.locator('[data-region="ai-workspace"] textarea')).toHaveValue('帮我准备函数单调性的例题');

  // The grid scrolls inside itself; the shell and the page never scroll sideways.
  const overflow = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    shellTop: document.querySelector('.wb-shell').getBoundingClientRect().top
  }));
  assert.ok(overflow.pageWidth <= overflow.viewport + 1, `page overflows horizontally: ${overflow.pageWidth}`);
  const scrollBefore = await page.evaluate(() => {
    const node = document.querySelector('[data-region="time-grid"] .sch-grid-scroll');
    node.scrollTop = 400;
    node.scrollLeft = 120;
    return { top: node.scrollTop, left: node.scrollLeft, docTop: window.scrollY };
  });
  assert.ok(scrollBefore.top > 0 && scrollBefore.left > 0);
  assert.equal(scrollBefore.docTop, 0);

  // The scene is written by the scroll handler, so wait for the store rather
  // than assuming the event already flushed.
  await page.waitForFunction(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.includes(':scene:schedule')) continue;
      const value = JSON.parse(window.localStorage.getItem(key));
      return Number(value.gridScrollTop) > 100 && Number(value.gridScrollLeft) > 0;
    }
    return false;
  });
  const afterReload = await page.evaluate(() => {
    const node = document.querySelector('[data-region="time-grid"] .sch-grid-scroll');
    return { top: node.scrollTop, left: node.scrollLeft };
  });
  await page.reload();
  await expect(page.locator('[data-region="day-column"]').first()).toBeVisible();
  const restored = await page.evaluate(() => {
    const node = document.querySelector('[data-region="time-grid"] .sch-grid-scroll');
    return { top: node.scrollTop, left: node.scrollLeft };
  });
  assert.ok(Math.abs(restored.top - afterReload.top) < 4, `grid scrollTop not restored: ${restored.top}`);
  assert.ok(Math.abs(restored.left - afterReload.left) < 4, `grid scrollLeft not restored: ${restored.left}`);
  // The selected segment and the editor draft belong to the same scene.
  await expect(page.locator('[data-region="selection"][data-day="2026-09-21"]')).toHaveCount(1);
});

test('WB-T006: an unscheduled item moves atomically and a target conflict leaves both sides', async ({ page }) => {
  const client = api('teacher-a');
  const target = await client.post('/api/modules/schedule/entries', entryBody({
    title: '目标段',
    time: { date: '2026-09-22', startTime: '10:00', timeZone: 'Asia/Shanghai', durationMinutes: 60 },
    items: [{ id: '50000000-0000-4000-8000-000000000009', text: '已有事项', priority: 'low' }]
  }));
  assert.equal(target.status, 201);

  await openPage(page);
  await setRange(page, '2026-09-21', '2026-09-23');

  // 记一件事 -> 保存, then it appears in the unscheduled list.
  await page.locator('[data-action="new-unscheduled"]').click();
  await page.locator('[data-region="editor-items"] input[name="item-text"]').first().fill('印讲义');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');
  await expect(page.locator('[data-region="unscheduled"]')).toContainText('印讲义');

  // Move it into the existing segment.
  const moveRow = page.locator('[data-region="unscheduled"] .sch-unscheduled-item').filter({ hasText: '印讲义' });
  await moveRow.locator('select[name="move-target"]').selectOption(target.body.id);
  await moveRow.locator('[data-action="move-item"]').click();
  await expect(page.locator('[data-region="unscheduled"]')).not.toContainText('印讲义');
  await page.locator(`[data-occurrence="${target.body.id}:single"]`).click();
  await expect(
    page.locator('[data-region="editor-items"] input[name="item-text"]').nth(1)
  ).toHaveValue('印讲义');
  const movedTarget = await client.get(`/api/modules/schedule/entries/${target.body.id}`);
  assert.deepEqual(movedTarget.body.items.map((item) => item.text), ['已有事项', '印讲义']);

  // A second item, with the target edited elsewhere: the move is rejected and
  // the retry input is still there.
  await page.locator('[data-action="new-unscheduled"]').click();
  await page.locator('[data-region="editor-items"] input[name="item-text"]').first().fill('印练习');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');
  const before = await client.get(`/api/modules/schedule/entries/${target.body.id}`);
  const bumped = await client.put(`/api/modules/schedule/entries/${target.body.id}`, {
    expectedVersion: before.body.version,
    ...entryBody({
      title: '目标段',
      time: { date: '2026-09-22', startTime: '10:00', timeZone: 'Asia/Shanghai', durationMinutes: 60 },
      items: before.body.items
    })
  });
  assert.equal(bumped.status, 200);

  const staleRow = page.locator('[data-region="unscheduled"] .sch-unscheduled-item').filter({ hasText: '印练习' });
  await staleRow.locator('select[name="move-target"]').selectOption(target.body.id);
  await staleRow.locator('[data-action="move-item"]').click();
  await expect(staleRow.locator('[data-region="move-state"]')).toBeVisible();
  await expect(page.locator('[data-region="unscheduled"]')).toContainText('印练习');
  await expect(staleRow.locator('select[name="move-target"]')).toHaveValue(target.body.id);

  const targetNow = await client.get(`/api/modules/schedule/entries/${target.body.id}`);
  assert.equal(targetNow.body.items.length, 2);
  assert.ok(!targetNow.body.items.some((item) => item.text === '印练习'));
});

test('WB-T007: the priority view is independent from the segment order', async ({ page }) => {
  const client = api('teacher-a');
  const created = await client.post('/api/modules/schedule/entries', entryBody({
    title: '同段两件事',
    items: [
      { id: '50000000-0000-4000-8000-000000000031', text: '选例题', priority: 'normal' },
      { id: '50000000-0000-4000-8000-000000000032', text: '印讲义', priority: 'high' }
    ]
  }));
  assert.equal(created.status, 201);

  const pending = await client.post('/api/modules/schedule/entries', {
    title: '',
    items: [{ id: '50000000-0000-4000-8000-000000000033', text: '未排期的同级事项', priority: 'normal' }],
    time: null,
    repeat: null,

    reminder: null
  });
  assert.equal(pending.status, 201);

  await openPage(page);
  await setRange(page, '2026-09-21', '2026-09-21');
  await page.locator('[data-action="toggle-panel"]').click();
  await page.locator('[data-region="priority"] .sch-list-head').click();
  const rows = page.locator('[data-region="priority-rows"] .sch-priority-row');
  await expect(rows).toHaveCount(3);
  // The high item first, then the normal level with the unscheduled item ahead
  // of the scheduled one.
  assert.equal(await rows.nth(0).locator('.sch-priority-text').innerText(), '印讲义');
  assert.equal(await rows.nth(1).locator('.sch-priority-text').innerText(), '未排期的同级事项');
  assert.equal(await rows.nth(1).getAttribute('data-kind'), 'unscheduled');
  assert.equal(await rows.nth(2).locator('.sch-priority-text').innerText(), '选例题');

  // Swap the segment order in the editor; priorities must not change.
  await page.locator(`[data-occurrence="${created.body.id}:single"]`).click();
  await expect(page.locator('[data-region="entry-editor"]')).toBeVisible();
  const itemRows = page.locator('[data-region="editor-items"] .sch-item-row');
  await expect(itemRows).toHaveCount(2);
  assert.equal(await itemRows.nth(0).locator('input[name="item-text"]').inputValue(), '选例题');
  await itemRows.nth(0).locator('[data-action="item-down"]').click();
  assert.equal(await itemRows.nth(0).locator('input[name="item-text"]').inputValue(), '印讲义');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');

  const stored = await client.get(`/api/modules/schedule/entries/${created.body.id}`);
  assert.deepEqual(stored.body.items.map((item) => item.text), ['印讲义', '选例题']);
  assert.deepEqual(stored.body.items.map((item) => item.priority), ['high', 'normal']);
  const after = page.locator('[data-region="priority-rows"] .sch-priority-row');
  assert.equal(await after.nth(0).locator('.sch-priority-text').innerText(), '印讲义');
  assert.equal(await after.nth(1).locator('.sch-priority-text').innerText(), '未排期的同级事项');
  assert.equal(await after.nth(2).locator('.sch-priority-text').innerText(), '选例题');
});

test('WB-T008: empty day, overlaps, cross-midnight, draft recovery and tablet input', async ({ page }) => {
  const client = api('teacher-a');
  const overlapA = await client.post('/api/modules/schedule/entries', entryBody({
    title: '长标题的备课安排需要完整辨认',
    time: { date: '2026-09-23', startTime: '09:00', timeZone: 'Asia/Shanghai', durationMinutes: 120 },
    items: [
      { id: '50000000-0000-4000-8000-000000000041', text: '选例题', priority: 'normal' },
      { id: '50000000-0000-4000-8000-000000000042', text: '印讲义', priority: 'low' }
    ]
  }));
  const overlapB = await client.post('/api/modules/schedule/entries', entryBody({
    title: '重叠段',
    time: { date: '2026-09-23', startTime: '10:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 }
  }));
  const crossMidnight = await client.post('/api/modules/schedule/entries', entryBody({
    title: '跨午夜',
    time: { date: '2026-09-23', startTime: '23:30', timeZone: 'Asia/Shanghai', durationMinutes: 120 }
  }));
  assert.equal(overlapA.status, 201);
  assert.equal(overlapB.status, 201);
  assert.equal(crossMidnight.status, 201);

  await openPage(page);
  await setRange(page, '2026-09-22', '2026-09-24');

  // An empty day keeps the day column and shows no invented content.
  const emptyDay = page.locator('[data-region="day-column"][data-day="2026-09-22"]');
  await expect(emptyDay.locator('.sch-event')).toHaveCount(0);

  // Both overlapping segments are recognisable and openable.
  const first = page.locator(`[data-occurrence="${overlapA.body.id}:single"]`);
  const second = page.locator(`[data-occurrence="${overlapB.body.id}:single"]`);
  await expect(first).toContainText('长标题的备课安排需要完整辨认');
  await expect(second).toContainText('重叠段');
  await second.click();
  await expect(page.locator('[data-region="entry-editor"]')).toBeVisible();
  await expect(page.locator('input[name="entry-title"]')).toHaveValue('重叠段');

  // The cross-midnight entry appears on both days with the same identity.
  await expect(page.locator(`[data-occurrence="${crossMidnight.body.id}:single"]`)).toHaveCount(2);

  // A local draft and the scene survive a reload.
  await page.locator('input[name="entry-title"]').fill('重叠段（未保存的草稿）');
  await page.locator('[role="tab"]', { hasText: 'AI 助理' }).click();
  await page.reload();
  await expect(page.locator('[data-region="day-column"]')).toHaveCount(3);
  await expect(page.locator('[data-region="entry-editor"]')).toBeVisible();
  await expect(page.locator('input[name="entry-title"]')).toHaveValue('重叠段（未保存的草稿）');

  // Tablet viewport: the shell switches between main content and the panel, so
  // close the panel before touching the grid, as a teacher would.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator('[data-region="schedule"]')).toBeVisible();
  if (await page.locator('[data-region="auxiliary"]').isVisible()) {
    await page.locator('[data-action="toggle-panel"]').click();
  }
  await expect(page.locator('[data-region="auxiliary"]')).toHaveCount(0);
  const narrowOverflow = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  assert.ok(narrowOverflow.pageWidth <= narrowOverflow.viewport + 1, 'tablet page overflows horizontally');

  await page.locator(`[data-occurrence="${overlapA.body.id}:single"]`).click();
  await expect(page.locator('input[name="entry-date"]')).toBeVisible();
  const items = page.locator('[data-region="editor-items"] .sch-item-row');
  assert.equal(await items.nth(0).locator('input[name="item-text"]').inputValue(), '选例题');
  await items.nth(0).locator('[data-action="item-down"]').click();
  assert.equal(await items.nth(0).locator('input[name="item-text"]').inputValue(), '印讲义');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');
  const stored = await client.get(`/api/modules/schedule/entries/${overlapA.body.id}`);
  assert.deepEqual(stored.body.items.map((item) => item.text), ['印讲义', '选例题']);
  assert.deepEqual(stored.body.items.map((item) => item.priority), ['low', 'normal']);
});

test('WB-T009/T010: a weekly series keeps one identity and edits only this once', async ({ page }) => {
  const client = api('teacher-a');
  await openPage(page);
  await setRange(page, '2026-09-21', '2026-10-12');

  await page.locator('[data-action="new-unscheduled"]').click();
  await page.locator('input[name="entry-title"]').fill('每周备课');
  await page.locator('input[name="entry-unscheduled"]').uncheck();
  await page.locator('input[name="entry-date"]').fill('2026-09-21');
  await page.locator('input[name="entry-start"]').fill('15:00');
  await page.locator('input[name="entry-duration"]').fill('90');
  await page.locator('input[name="entry-weekly"]').check();
  await page.locator('input[name="repeat-until"]').fill('2026-10-05');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');

  // A long range renders only the visible columns, so the third instance
  // appears when the teacher scrolls the grid to October.
  const series = page.locator('.sch-event').filter({ hasText: '每周备课' });
  await expect(series).toHaveCount(2);
  await page.locator('[data-region="time-grid"] .sch-grid-scroll').evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await expect(page.locator('[data-day="2026-10-05"] .sch-event').filter({ hasText: '每周备课' })).toHaveCount(1);
  await page.locator('[data-region="time-grid"] .sch-grid-scroll').evaluate((node) => {
    node.scrollLeft = 0;
  });

  // Open the middle instance; the default scope is 仅这一次.
  await page.locator('.sch-event[data-occurrence$=":2026-09-28"]').click();
  await expect(page.locator('[data-action="scope-instance"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-action="cancel-instance"]')).toBeVisible();
  await expect(page.locator('[data-action="delete-entry"]')).toHaveCount(0);
  await page.locator('input[name="entry-date"]').fill('2026-09-29');
  await page.locator('input[name="entry-start"]').fill('16:00');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');

  // Only that instance moved; its identity is still the original date, so it
  // now renders in the 09-29 column under the same key.
  await expect(page.locator('[data-day="2026-09-29"] [data-occurrence$=":2026-09-28"]')).toHaveCount(1);
  await expect(page.locator('[data-day="2026-09-28"] .sch-event')).toHaveCount(0);
  await page.locator('[data-region="time-grid"] .sch-grid-scroll').evaluate((node) => {
    node.scrollLeft = 0;
  });
  await expect(page.locator('.sch-event').filter({ hasText: '每周备课' })).toHaveCount(2);
  const listed = page.locator('[data-region="exceptions"] .sch-exception[data-origin="2026-09-28"]');
  await expect(listed).toHaveAttribute('data-mode', 'override');

  // Cancel this instance, then restore it from the group's adjusted-dates list.
  await page.locator('.sch-event[data-occurrence$=":2026-09-28"]').click();
  await page.locator('[data-action="cancel-instance"]').click();
  const cancelled = page.locator('[data-region="exceptions"] .sch-exception[data-origin="2026-09-28"]');
  await expect(cancelled).toHaveAttribute('data-mode', 'cancelled');
  const allEntries = await client.get('/api/modules/schedule/entries');
  const weekly = allEntries.body.items.find((item) => item.title === '每周备课');
  const cancelledState = await client.get(
    `/api/modules/schedule/entries/${weekly.id}/occurrence?originDate=2026-09-28`
  );
  assert.equal(cancelledState.body.state, 'cancelled');

  await cancelled.locator('[data-action="restore-exception"]').click();
  await page.locator('[data-region="time-grid"] .sch-grid-scroll').evaluate((node) => {
    node.scrollLeft = 0;
  });
  await expect(page.locator('[data-day="2026-09-28"] .sch-event').filter({ hasText: '每周备课' })).toHaveCount(1);
  await expect(page.locator('[data-day="2026-09-28"] [data-occurrence$=":2026-09-28"]')).toHaveCount(1);
});

test('WB-T011: the account timezone is editable without moving stored instants', async ({ page }) => {
  const client = api('teacher-a');
  const created = await client.post('/api/modules/schedule/entries', entryBody({
    time: { date: '2026-09-21', startTime: '15:00', timeZone: 'Asia/Shanghai', durationMinutes: 90 }
  }));
  assert.equal(created.status, 201);

  await openPage(page);
  await setRange(page, '2026-09-21', '2026-09-21');
  await page.locator('[data-action="toggle-timezone"]').click();
  await page.locator('select[name="timezone-select"]').selectOption('America/New_York');
  await expect(page.locator('[data-action="toggle-timezone"]')).toContainText('America/New_York');

  const stored = await client.get(`/api/modules/schedule/entries/${created.body.id}`);
  assert.equal(stored.body.time.timeZone, 'Asia/Shanghai');
  const occurrences = await client.get('/api/modules/schedule/occurrences?from=2026-09-21&to=2026-09-21');
  assert.equal(occurrences.body.timeZone, 'America/New_York');
  assert.equal(occurrences.body.items[0].startsAt, '2026-09-21T07:00:00Z');

  // A missing DST wall time is never shown silently in the editor.
  await page.locator('[data-action="new-unscheduled"]').click();
  await page.locator('input[name="entry-unscheduled"]').uncheck();
  await page.locator('input[name="entry-date"]').fill('2026-03-08');
  await page.locator('input[name="entry-start"]').fill('02:30');
  await page.locator('select[name="entry-timezone"]').selectOption('America/New_York');
  await expect(page.locator('[data-region="dst-note"]')).toContainText('03:30');
});

test('TT-U8/TT-U6: normal entry items move back to unscheduled', async ({ page }) => {
  const client = api('teacher-a');
  await openPage(page);
  await setRange(page, '2026-09-21', '2026-09-21');
  await dragSelect(page, '2026-09-21', 9, 0, 10, 0);
  await expect(page.locator('[data-region="entry-editor"]')).toBeVisible();
  await page.locator('input[name="entry-title"]').fill('关联课');
  await page.locator('[data-region="editor-items"] input[name="item-text"]').first().fill('选例题');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');

  const stored = await client.get('/api/modules/schedule/entries');
  const linked = stored.body.items.find((item) => item.title === '关联课');

  // The item moves back to a brand-new unscheduled entry in one atomic call.
  await page.locator('[data-region="entry-editor"] [data-action="item-to-unscheduled"]').click();
  await expect(page.locator('[data-region="unscheduled"]')).toContainText('选例题');
  const afterMove = await client.get('/api/modules/schedule/entries');
  const source = afterMove.body.items.find((item) => item.title === '关联课');
  assert.deepEqual(source.items, []);
  const pending = await client.get('/api/modules/schedule/entries?placement=unscheduled');
  assert.deepEqual(pending.body.items.map((item) => item.items[0].text), ['选例题']);
});

test('WB-T018: a second save updates, and a version conflict keeps both sides', async ({ page }) => {
  const client = api('teacher-a');
  await openPage(page);
  await setRange(page, '2026-09-21', '2026-09-21');

  await page.locator('[data-action="new-unscheduled"]').click();
  await page.locator('[data-region="editor-items"] input[name="item-text"]').first().fill('第一次保存');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');

  // Saving again updates the same entry instead of creating a second one.
  await page.locator('[data-region="editor-items"] input[name="item-text"]').first().fill('第二次保存');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');
  const rows = await client.get('/api/modules/schedule/entries?placement=unscheduled');
  assert.equal(rows.body.items.length, 1);
  assert.equal(rows.body.items[0].items[0].text, '第二次保存');
  assert.equal(rows.body.items[0].version, 2);

  // Another device edits the same entry: the save is rejected, the local draft
  // stays, and loading the server version does not discard it.
  const current = rows.body.items[0];
  const elsewhere = await client.put(`/api/modules/schedule/entries/${current.id}`, {
    expectedVersion: current.version,
    title: '',
    items: [{ id: current.items[0].id, text: '另一台设备的修改', priority: 'normal' }],
    time: null,
    repeat: null,

    reminder: null
  });
  assert.equal(elsewhere.status, 200);

  await page.locator('[data-region="editor-items"] input[name="item-text"]').first().fill('本地未提交的修改');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('未覆盖');
  await expect(page.locator('[data-region="editor-items"] input[name="item-text"]').first())
    .toHaveValue('本地未提交的修改');
  await page.locator('[data-region="save-state"] [data-action="reload"]').click();
  // Both sides stay visible: the server copy is shown next to the local draft.
  await expect(page.locator('[data-region="server-version"]')).toContainText('另一台设备的修改');
  await expect(page.locator('[data-region="save-state"]')).toContainText('本地修改保留');
  await expect(page.locator('[data-region="editor-items"] input[name="item-text"]').first())
    .toHaveValue('本地未提交的修改');
});

test('WB-T017: a committed save with a lost response stays unconfirmed and replays once', async ({ page }) => {
  const client = api('teacher-a');
  await openPage(page);
  await setRange(page, '2026-09-21', '2026-09-21');

  // Let the request reach the server, then drop the response.
  let dropped = 0;
  await page.route('**/api/modules/schedule/entries', async (route) => {
    if (route.request().method() !== 'POST' || dropped > 0) return route.continue();
    dropped += 1;
    await route.fetch();
    await route.abort('failed');
  });

  await page.locator('[data-action="new-unscheduled"]').click();
  await page.locator('input[name="entry-title"]').fill('丢响应的安排');
  await page.locator('[data-region="entry-editor"] [data-action="save"]').click();
  await expect(page.locator('[data-region="save-state"] [data-action="retry"]')).toBeVisible();
  await expect(page.locator('[data-region="save-state"]')).toContainText('暂不能确认');
  await expect(page.locator('input[name="entry-title"]')).toHaveValue('丢响应的安排');

  const committed = await client.get('/api/modules/schedule/entries?placement=all');
  assert.equal(committed.body.items.filter((item) => item.title === '丢响应的安排').length, 1);

  // Replaying with the original key confirms the same object and creates no duplicate.
  await page.locator('[data-region="save-state"] [data-action="retry"]').click();
  await expect(page.locator('[data-region="save-state"]')).toContainText('已保存');
  const after = await client.get('/api/modules/schedule/entries?placement=all');
  assert.equal(after.body.items.filter((item) => item.title === '丢响应的安排').length, 1);
});
