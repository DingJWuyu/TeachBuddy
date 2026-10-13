import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { startFirstFlowRunner } from '../../../scripts/first-flow/lib/runner.mjs';
import { bootstrapPrincipal } from './fixtures/first-flow/identity.js';

const dataDir = path.resolve('test-results/t53-attempt3/data');
const origin = 'https://localhost:47653';
const evidence = path.resolve(process.env.T53_REPAIR_EVIDENCE ?? 'test-results/t53-attempt3/evidence');
const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
let runner;
let now;
const entryInput = {
  title: '定向回归课程', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null,
  reminder: { side: 'before', minutes: 10 }
};
async function write(page, url, data) {
  const response = await page.request.post(origin + url, {
    data, headers: { Origin: origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() }
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function read(page, url) {
  const response = await page.request.get(origin + url);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), animations: 'disabled' });
}
test.use({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ context }) => {
  now = '2026-09-21T06:00:00Z';
  runner = await startFirstFlowRunner({ dataDir, port: 47653, fixtures: [], web: 'auto', reset: true, quiet: true, clock: () => new Date(now) });
  await bootstrapPrincipal(context, 'fixture-teacher-a', { origin, dataDir });
});
test.afterEach(async () => { await runner.close(); });


for (const panel of ['closed', 'AI 助理', '安排']) {
  test(`D01: tablet notifications remain operable with ${panel}`, async ({ page }) => {
    const entry = await write(page, entries, entryInput);
    now = '2026-09-21T09:00:00Z';
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/calendar');
    if (panel !== 'closed') {
      await page.getByRole('button', { name: 'AI 助理', exact: true }).first().click();
      await page.getByRole('textbox', { name: 'AI 输入' }).fill('保留 AI 草稿');
      if (panel === '安排') await page.getByRole('tab', { name: '安排', exact: true }).click();
    }
    const bell = page.getByRole('button', { name: /^通知/ });
    await bell.click();
    await expect(page.locator('[data-notification-id]')).toHaveCount(1);
    await shot(page, `notifications-${panel}`);
    await page.getByRole('button', { name: '全部已读', exact: true }).click({ timeout: 2500 });
    await expect.poll(async () => (await read(page, notices)).unreadCount).toBe(0);
    await page.keyboard.press('Escape'); await expect(bell).toBeFocused();
    await bell.click();
    await page.locator('[data-notification-id]').click();
    await expect(page).toHaveURL(new RegExp(`entry=${entry.id}`));
    await expect(page.locator('[name=entry-title]')).toHaveValue(entryInput.title);
    await bell.click(); await page.getByRole('button', { name: '清空', exact: true }).click();
    await expect(page.getByText('暂无通知', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    if (panel !== 'closed') {
      await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('保留 AI 草稿');
    }
  });
}

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
