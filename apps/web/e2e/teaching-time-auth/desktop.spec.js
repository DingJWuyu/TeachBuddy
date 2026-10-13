import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { startTeachingAuth } from './service.mjs';
import { register, login, logout, headers } from './helpers.mjs';


const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't53-auth-desktop-'));
let dataDir;
const port = 49656;
const origin = `https://127.0.0.1:${port}`;
const evidence = path.resolve(process.env.T53_AUTH_EVIDENCE || 'test-results/t53-auth/evidence', 'desktop');
const entries = '/api/modules/schedule/entries';
let runner;
let network;
test.beforeEach(async ({ page }) => {
  network = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) network.push({ method: response.request().method(), path: url.pathname, status: response.status() });
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) network.push({ method: request.method(), path: url.pathname, error: request.failure()?.errorText });
  });
});

const entryInput = {
  title: '定向回归课程', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null,
  reminder: { side: 'before', minutes: 10 }
};
async function write(page, url, data) {
  const response = await page.request.post(origin + url, {
    data, headers: { ...headers(page), Origin: origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() }
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), animations: 'disabled' });
}
test.use({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }, testInfo) => {
  fs.mkdirSync(evidence, { recursive: true });
  dataDir = path.join(dataRoot, `${testInfo.testId}-${testInfo.repeatEachIndex}`);
  runner = await startTeachingAuth({ directory: dataDir, port, now: () => '2026-09-21T06:00:00Z' });
  await register(page, runner);
});
test.afterEach(async ({ page, browser }, testInfo) => {
  const state = await page.evaluate(() => ({
    shell: {x: scrollX, y: scrollY, width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth},
    regions: [...document.querySelectorAll('.sch-page, .sch-lists, .sch-grid-scroll, [data-region=auxiliary]')].map(n => ({class: n.className, top: n.scrollTop, left: n.scrollLeft, height: n.clientHeight, total: n.scrollHeight})),
    scenes: Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.endsWith(':scene:schedule')).map(([key,value])=>[key,JSON.parse(value)]))
  })).catch(() => null);
  fs.writeFileSync(path.join(evidence, `audit-${testInfo.testId}.json`), JSON.stringify({test: testInfo.title, status: testInfo.status, browser: browser.version(), state, network}, null, 2));
  await runner?.close();
});

// D05 uses real wheel input over the list after scrolling both grid axes.
// Cover each responsive row shape with and without the shared auxiliary panel.
for (const count of [0, 3, 12, 30]) {
  for (const openAI of [false, true]) {
    test(`D05: desktop ${count} items, AI ${openAI ? 'open' : 'closed'}, full access and restoration`, async ({ page }) => {
      if (count) await write(page, entries, { ...entryInput, title: '', time: null, reminder: null,
        items: Array.from({ length: count }, (_, i) => ({ id: randomUUID(), text: `区域隔离第${i + 1}项`, priority: 'normal' })) });
      await page.goto('/');
      await page.getByRole('textbox', { name: 'AI 输入' }).fill('区域隔离检查草稿');
      await page.getByRole('link', { name: '日程', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'AI 输入' });
      async function setAI(open) {
        if (open === await input.isVisible()) return;
        if (open) await page.getByRole('button', { name: 'AI 助理', exact: true }).first().click();
        else await page.locator('[data-region=auxiliary]').getByRole('button', { name: '关闭辅助栏', exact: true }).click();
        await expect(input).toBeVisible({ visible: open });
      }
      await setAI(openAI);
      const list = page.locator('[data-region=unscheduled]');
      await expect(list.locator('[data-item-id]')).toHaveCount(count);
      const last = count ? list.locator('[data-item-id]').last() : list.locator('.wb-empty-note');
      const measure = () => page.evaluate(() => {
        const p = document.querySelector('.sch-page'), g = document.querySelector('.sch-grid-scroll');
        if (!p || !g) return null;
        const lists = document.querySelector('.sch-lists');
        const a = document.querySelector('[data-region=auxiliary]');
        const bounds = n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const rect = a?.getBoundingClientRect();
        return { shell: { x: scrollX, y: scrollY }, main: p.scrollTop,
          lists: lists.scrollTop,
          grid: { x: g.scrollLeft, y: g.scrollTop },
          gridRect: bounds(g), toolbarRect: bounds(document.querySelector('.sch-toolbar')),
          auxiliary: a ? { x: a.scrollLeft, y: a.scrollTop, left: rect.x, top: rect.y } : null };
      });
      const before = await measure();
      await page.locator('.sch-grid-scroll').hover({ position: { x: 180, y: 120 } });
      await page.mouse.wheel(250, 180);
      await expect.poll(async () => (await measure()).grid.x).toBeGreaterThan(before.grid.x);
      await expect.poll(async () => (await measure()).grid.y).toBeGreaterThan(before.grid.y);
      const gridMoved = await measure();
      expect(gridMoved.main).toBe(before.main);
      expect(gridMoved.lists).toBe(before.lists);
      expect(gridMoved.auxiliary).toEqual(before.auxiliary);
      expect(gridMoved.shell).toEqual({ x: 0, y: 0 });
      // Hover visible content; locator auto-scrolling must not expose the final row for us.
      await list.hover({ position: { x: 20, y: count ? 60 : 40 } });
      await page.mouse.wheel(0, 1600);
      await expect(last).toBeInViewport({ ratio: 1 });
      const maxTop = await page.locator('.sch-lists').evaluate(n => n.scrollHeight - n.clientHeight);
      await expect.poll(async () => (await measure()).lists).toBe(Math.min(1600, maxTop));
      const listMoved = await measure();
      expect(listMoved.grid).toEqual(gridMoved.grid);
      expect(listMoved.main).toBe(0);
      expect(listMoved.gridRect).toEqual(gridMoved.gridRect);
      expect(listMoved.toolbarRect).toEqual(gridMoved.toolbarRect);
      expect(listMoved.auxiliary).toEqual(gridMoved.auxiliary);
      expect(listMoved.shell).toEqual({ x: 0, y: 0 });
      expect(await page.locator('.sch-list').evaluateAll(nodes => nodes.every(n => !['auto', 'scroll'].includes(getComputedStyle(n).overflowY)))).toBeTruthy();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      const name = `desktop-${count}-ai-${openAI ? 'open' : 'closed'}`;
      await shot(page, `${name}-bottom`);
      await page.locator('a[href="/questions"]').click();
      await page.getByRole('link', { name: '日程', exact: true }).click();
      await expect.poll(measure).toEqual(listMoved);
      await expect(last).toBeInViewport({ ratio: 1 });
      await page.reload();
      await expect.poll(measure).toEqual(listMoved);
      await expect(last).toBeInViewport({ ratio: 1 });
      if (openAI) await expect(input).toHaveValue('区域隔离检查草稿');
      await shot(page, `${name}-restored`);
      const restored = await measure();
      // Width changes reflow rows and native scroll anchoring can adjust pixels.
      // Keep a visible item in view, then wheel to the new bottom.
      const anchorId = await list.locator('[data-item-id]').evaluateAll(nodes => nodes.find(n => {
        const r = n.getBoundingClientRect(), region = n.closest('.sch-lists').getBoundingClientRect();
        return r.top >= region.top && r.bottom <= region.bottom;
      })?.dataset.itemId);
      await setAI(!openAI);
      const toggledMax = await page.locator('.sch-lists').evaluate(n => n.scrollHeight - n.clientHeight);
      if (anchorId) await expect(list.locator(`[data-item-id="${anchorId}"]`)).toBeInViewport({ ratio: 1 });
      const afterToggle = await measure();
      const listBox = await page.locator('.sch-lists').boundingBox();
      await page.mouse.move(listBox.x + 20, listBox.y + 40);
      await page.mouse.wheel(0, 1600);
      await expect(last).toBeInViewport({ ratio: 1 });
      await expect.poll(async () => (await measure()).lists).toBe(toggledMax);
      const toggled = await measure();
      const gridLimits = await page.locator('.sch-grid-scroll').evaluate(n => ({ x: n.scrollWidth - n.clientWidth, y: n.scrollHeight - n.clientHeight }));
      expect(toggled.grid).toEqual({ x: Math.min(listMoved.grid.x, gridLimits.x), y: Math.min(listMoved.grid.y, gridLimits.y) });
      expect(toggled.shell).toEqual({ x: 0, y: 0 });
      await page.reload();
      await expect.poll(measure).toEqual(toggled);
      await expect(last).toBeInViewport({ ratio: 1 });
      await setAI(true);
      await expect(input).toHaveValue('区域隔离检查草稿');
      fs.writeFileSync(path.join(evidence, `${name}.json`), JSON.stringify({ before, gridMoved, listMoved, restored, afterToggle, toggled }, null, 2));
    });
  }
}

async function scrollDesktopList(page) {
  await write(page, entries, { ...entryInput, title: '', time: null, reminder: null,
    items: Array.from({ length: 30 }, (_, i) => ({ id: randomUUID(), text: `持久位置第${i + 1}项`, priority: 'normal' })) });
  await page.goto('/calendar');
  await expect(page.locator('[data-region=unscheduled] [data-item-id]')).toHaveCount(30);
  await page.locator('[data-region=unscheduled]').hover({ position: { x: 20, y: 60 } });
  await page.mouse.wheel(0, 1600);
  await expect(page.locator('[data-region=unscheduled] [data-item-id]').last()).toBeInViewport({ ratio: 1 });
  return page.locator('.sch-lists').evaluate(n => n.scrollTop);
}

const listTop = page => page.locator('.sch-lists').evaluate(n => n.scrollTop);
const savedListTop = page => page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.endsWith(':scene:schedule'))?.[1]).listsScrollTop);

test('D05: desktop list position survives delayed loading, failure, retry and subsequent scrolling', async ({ page }) => {
  const top = await scrollDesktopList(page);
  expect(top).toBeGreaterThan(0);
  let release, reached;
  const gate = new Promise(resolve => { release = resolve; });
  const intercepted = new Promise(resolve => { reached = resolve; });
  const pattern = '**/api/modules/schedule/entries?*placement=unscheduled*';
  await page.route(pattern, async route => {
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  await page.reload();
  await intercepted;
  await expect(page.getByText('正在加载日程…')).toBeVisible();
  expect(await savedListTop(page)).toBe(top);
  release();
  await expect.poll(() => listTop(page)).toBe(top);
  await page.unroute(pattern);
  await page.route(pattern, route => route.abort('failed'));
  await page.reload();
  await expect(page.locator('[data-region=stale-notice]')).toBeVisible();
  expect(await savedListTop(page)).toBe(top);
  await page.unroute(pattern);
  await page.locator('[data-region=stale-notice]').getByRole('button', { name: '重试' }).click();
  await expect.poll(() => listTop(page)).toBe(top);
  await shot(page, 'desktop-load-retry-restored');
  await page.locator('.sch-lists').hover({ position: { x: 20, y: 60 } });
  await page.mouse.wheel(0, -200);
  await expect.poll(() => listTop(page)).toBe(top - 200);
  await page.reload();
  await expect.poll(() => listTop(page)).toBe(top - 200);
  fs.writeFileSync(path.join(evidence, 'desktop-retry.json'), JSON.stringify({ top, afterScrollAndRefresh: await listTop(page) }, null, 2));
});

test('D05: desktop list scene is isolated by account', async ({ page, context }) => {
  const top = await scrollDesktopList(page);
  await logout(page);
  await register(page, runner, 'teacher-b@example.test');
  await page.goto(origin + '/calendar');
  await expect(page.locator('[data-region=unscheduled-empty]')).toBeVisible();
  await expect.poll(() => listTop(page)).toBe(0);
  await logout(page);
  await login(page);
  await page.goto(origin + '/calendar');
  await expect(page.locator('[data-region=unscheduled] [data-item-id]')).toHaveCount(30);
  await expect.poll(() => listTop(page)).toBe(top);
  await shot(page, 'desktop-account-a-restored');
});
