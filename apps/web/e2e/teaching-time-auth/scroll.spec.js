import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { startTeachingAuth } from './service.mjs';
import { register, login, logout, headers } from './helpers.mjs';


const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't53-auth-scroll-'));
let dataDir;
const port = 49655;
const origin = `https://127.0.0.1:${port}`;
const evidence = path.resolve(process.env.T53_AUTH_EVIDENCE || 'test-results/t53-auth/evidence', 'scroll');
const entries = '/api/modules/schedule/entries';
let runner;

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
test.afterEach(async () => { await runner?.close(); });

test('D04: tablet long list scrolls in its main region and restores after navigation', async ({ page }) => {
  await write(page, entries, { ...entryInput, title: '', time: null, reminder: null,
    items: Array.from({ length: 30 }, (_, i) => ({ id: randomUUID(), text: `区域滚动第${i + 1}项`, priority: 'normal' })) });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/calendar');
  const region = page.locator('.sch-page');
  const last = page.locator('[data-region=unscheduled] [data-item-id]').last();
  await expect(last).toHaveCount(1);
  const before = await region.evaluate(n => ({ top:n.scrollTop, height:n.clientHeight, total:n.scrollHeight }));
  expect(before.total).toBeGreaterThan(before.height);
  await page.locator('[data-region=unscheduled]').hover({position:{x:20,y:60}});
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => region.evaluate(n => n.scrollTop)).toBeGreaterThan(0);
  await expect(last).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const position = await region.evaluate(n => n.scrollTop);
  await shot(page, 'independent-main-region-scroll');
  const storedBefore = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.endsWith(':scene:schedule')).map(([key, value]) => [key, JSON.parse(value)])));
  await page.locator('a[href="/questions"]').click();
  await page.getByRole('link', {name:'日程',exact:true}).click();
  await expect(page.locator('[data-region=unscheduled] [data-item-id]')).toHaveCount(30);
  await shot(page, 'independent-main-region-returned');
  fs.writeFileSync(path.join(evidence, 'region-scroll.json'), JSON.stringify({storedBefore, before, scrolled:position, afterReturn:await region.evaluate(n => n.scrollTop), shellScroll:await page.evaluate(() => window.scrollY), lastItemVisible:await last.evaluate(n => {const r=n.getBoundingClientRect();return r.top >= 0 && r.bottom <= innerHeight;})}, null, 2));
  await expect.poll(() => region.evaluate(n => n.scrollTop)).toBe(position);
  await expect(last).toBeInViewport();
  await shot(page, 'independent-main-region-restored');
});

for (const count of [0, 1, 3, 12]) {
  test(`D02: tablet list ${count} items is readable and movable with priority expanded or collapsed`, async ({ page }) => {
    const target = await write(page, entries, { ...entryInput, reminder: null });
    if (count) await write(page, entries, { ...entryInput, title: '', time: null, reminder: null,
      items: Array.from({ length: count }, (_, i) => ({ id: randomUUID(), text: i === 0 ? '长文本'.repeat(50) : `未排期第${i + 1}项`, priority: 'normal' })) });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/calendar');
    await page.getByLabel('开始', { exact: true }).fill('2026-09-21');
    await page.getByLabel('结束', { exact: true }).fill('2026-09-27');
    await page.locator('[data-action=apply-range]').click();
    const list = page.locator('[data-region=unscheduled]');
    await expect(list.locator('[data-item-id]')).toHaveCount(count);
    for (let i = 0; i < 2; i++) {
      if (i) await page.locator('[data-region=priority]').getByRole('button').first().click();
      const content = count ? list.locator('[data-item-id]').last() : list.locator('.wb-empty-note');
      const bounds = await list.evaluate(node => ({ outer: node.getBoundingClientRect().bottom,
        contents: [...node.querySelectorAll('[data-item-id], .wb-empty-note')].map(x => x.getBoundingClientRect().bottom) }));
      expect(bounds.contents.every(bottom => bottom <= bounds.outer)).toBeTruthy();
      await page.locator('.sch-page').hover({ position: { x: 20, y: 200 } });
      await page.mouse.wheel(0, 1200);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.locator('.sch-list').evaluateAll(nodes => nodes.every(n => !['auto', 'scroll'].includes(getComputedStyle(n).overflowY)))).toBeTruthy();
      await expect(content).toBeInViewport();
      await shot(page, `list-${count}-priority-${i}`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    if (count) {
      const priority = page.locator('[data-region=priority]');
      await priority.locator('.sch-priority-row').first().click();
      await expect(page.locator('[name=item-text]').first()).toHaveValue('长文本'.repeat(50));
      await page.locator('[data-region=auxiliary]').getByRole('button', { name: '关闭辅助栏', exact: true }).click();
      const row = list.locator('[data-item-id]').last();
      const id = await row.getAttribute('data-item-id');
      await row.getByRole('combobox').selectOption(target.id);
      await row.getByRole('button', { name: '移入', exact: true }).click();
      await expect(list.locator('[data-item-id]')).toHaveCount(count - 1);
      expect((await read(page, `${entries}/${target.id}`)).items.some(item => item.id === id)).toBeTruthy();
    }
  });
}


async function read(page, url) {
  const response = await page.request.get(origin + url, { headers: headers(page) });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function longList(page) {
  await write(page, entries, { ...entryInput, title: '', time: null, reminder: null,
    items: Array.from({ length: 30 }, (_, i) => ({ id: randomUUID(), text: `恢复第${i + 1}项`, priority: 'normal' })) });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/calendar');
  await expect(page.locator('[data-region=unscheduled] [data-item-id]')).toHaveCount(30);
  await page.locator('[data-region=unscheduled]').hover({ position: { x: 20, y: 60 } });
  await page.mouse.wheel(0, 1000);
  await expect(page.locator('[data-region=unscheduled] [data-item-id]').last()).toBeInViewport();
  return page.locator('.sch-page').evaluate(node => node.scrollTop);
}

async function expectTop(page, top) {
  await expect.poll(() => page.locator('.sch-page').evaluate(node => node.scrollTop)).toBe(top);
}

function scene(page) {
  return page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.endsWith(':scene:schedule'))?.[1]));
}

test('D04: delayed refresh and failed load retry retain the saved main-region position', async ({ page }) => {
  const top = await longList(page);
  expect(top).toBeGreaterThan(0);
  let release;
  let reached;
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
  expect((await scene(page)).pageScrollTop).toBe(top);
  release();
  await expectTop(page, top);
  await page.unroute(pattern);
  await shot(page, 'delayed-refresh-restored');

  await page.route(pattern, route => route.abort('failed'));
  await page.reload();
  await expect(page.locator('[data-region=stale-notice]')).toBeVisible();
  expect((await scene(page)).pageScrollTop).toBe(top);
  await page.unroute(pattern);
  await page.locator('[data-region=stale-notice]').getByRole('button', { name: '重试' }).click();
  await expectTop(page, top);
  await shot(page, 'failed-load-retry-restored');

  // A subsequent user scroll must replace, rather than snap back to, the restored position.
  await page.locator('.sch-page').hover({ position: { x: 10, y: 200 } });
  await page.mouse.wheel(0, -250);
  await expect.poll(() => page.locator('.sch-page').evaluate(node => node.scrollTop)).toBeLessThan(top);
  const changed = await page.locator('.sch-page').evaluate(node => node.scrollTop);
  await page.reload();
  await expectTop(page, changed);
  fs.writeFileSync(path.join(evidence, 'reload-scroll.json'), JSON.stringify({ top, changed, restored: await page.locator('.sch-page').evaluate(node => node.scrollTop) }, null, 2));
});

test('D04: account B starts at its own position and account A restores its list', async ({ page, context }) => {
  const top = await longList(page);
  await logout(page);
  await register(page, runner, 'teacher-b@example.test');
  await page.goto(origin + '/calendar');
  await expect(page.locator('[data-region=unscheduled-empty]')).toBeVisible();
  await expectTop(page, 0);
  await logout(page);
  await login(page);
  await page.goto(origin + '/calendar');
  await expect(page.locator('[data-region=unscheduled] [data-item-id]')).toHaveCount(30);
  await expectTop(page, top);
  await shot(page, 'account-a-restored');
});

for (const viewport of [{ width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`WB-T005/T008: grid axes and list remain independent at ${viewport.width}`, async ({ page }) => {
    await write(page, entries, { ...entryInput, title: '', time: null, reminder: null,
      items: Array.from({ length: 3 }, (_, i) => ({ id: randomUUID(), text: `列表第${i + 1}项`, priority: 'normal' })) });
    await page.setViewportSize(viewport);
    await page.goto('/calendar');
    await page.getByLabel('开始', { exact: true }).fill('2026-09-21');
    await page.getByLabel('结束', { exact: true }).fill('2026-10-01');
    await page.locator('[data-action=apply-range]').click();
    await expect(page.locator('[data-region=unscheduled] [data-item-id]')).toHaveCount(3);
    const grid = page.locator('.sch-grid-scroll');
    const position = () => grid.evaluate(node => ({ top: node.scrollTop, left: node.scrollLeft }));
    const initial = await position();
    await grid.hover({ position: { x: 180, y: 120 } });
    await page.mouse.wheel(250, 180);
    await expect.poll(async () => (await position()).left).toBeGreaterThan(initial.left);
    await expect.poll(async () => (await position()).top).toBeGreaterThan(initial.top);
    const scrolled = await position();
    await expectTop(page, 0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.locator('a[href="/questions"]').click();
    await page.getByRole('link', { name: '日程', exact: true }).click();
    await expect.poll(position).toEqual(scrolled);
    await expectTop(page, 0);
    await page.reload();
    await expect.poll(position).toEqual(scrolled);
    const last = page.locator('[data-region=unscheduled] [data-item-id]').last();
    await expect(last).toBeInViewport();
    expect(await page.locator('.sch-list').evaluateAll(nodes => nodes.every(node => !['auto', 'scroll'].includes(getComputedStyle(node).overflowY)))).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await shot(page, `grid-restored-${viewport.width}`);
    fs.writeFileSync(path.join(evidence, `grid-${viewport.width}.json`), JSON.stringify({ initial, scrolled, restored: await position(), mainTop: await page.locator('.sch-page').evaluate(node => node.scrollTop) }, null, 2));
  });
}

test('WB-T005: actual pointer selection in the integrated shell preserves AI and eleven-day range', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('拖选后仍保留');
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await page.getByRole('button', { name: 'AI 助理', exact: true }).first().click();
  await page.locator('[name="range-from"]').fill('2026-09-21');
  await page.locator('[name="range-to"]').fill('2026-10-01');
  await page.locator('[data-action="apply-range"]').click();
  await expect(page.locator('[data-region="range-label"]')).toContainText('11 天');
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('拖选后仍保留');
  const column = page.locator('[data-region="day-column"][data-day="2026-09-21"]');
  const start = await column.locator('[data-hour="15"]').boundingBox();
  const end = await column.locator('[data-hour="16"]').boundingBox();
  await page.mouse.move(start.x + 50, start.y + start.height / 12);
  await page.mouse.down();
  await page.mouse.move(end.x + 50, end.y + end.height * 35 / 60, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('[name="entry-duration"]')).toHaveValue('90');
  await expect(page.locator('[name="entry-date"]')).toHaveValue('2026-09-21');
  await page.locator('[name=entry-title]').fill('滚动修复回归草稿');
  await shot(page, 'desktop-pointer-selection');
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('拖选后仍保留');
  await page.locator('a[href="/questions"]').click();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('[data-region=range-label]')).toContainText('11 天');
  await expect(page.locator('[data-region=selection][data-day="2026-09-21"]')).toHaveCount(1);
  await page.getByRole('tab', { name: '安排', exact: true }).click();
  await expect(page.locator('[name=entry-title]')).toHaveValue('滚动修复回归草稿');
  await expect(page.locator('[name=entry-duration]')).toHaveValue('90');
  await shot(page, 'selection-draft-restored');
});
