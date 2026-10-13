import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { startTeachingAuth } from './service.mjs';
import { register, login, logout, headers } from './helpers.mjs';


let dataDir;
const origin = 'https://127.0.0.1:49654';
const evidence = path.resolve(process.env.T53_AUTH_EVIDENCE || 'test-results/t53-auth/evidence', 'repairs');
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
    data, headers: { ...headers(page), Origin: origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() }
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function read(page, url) {
  const response = await page.request.get(origin + url, { headers: headers(page) });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), animations: 'disabled' });
}
test.use({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => {
  now = '2026-09-21T06:00:00Z';
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't53-auth-repairs-'));
  fs.mkdirSync(evidence, { recursive: true });
  runner = await startTeachingAuth({ directory: dataDir, port: 49654, now: () => now });
  await register(page, runner);
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
