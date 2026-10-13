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
const records = '/api/modules/classes/records';
const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
let runner;
let now;
const entryInput = {
  title: '定向回归课程', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, recordIds: [] },
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
async function composer(page) {
  const classroom = await write(page, '/api/modules/classes/items', { name: '快记回归班' });
  await page.goto(origin + '/classes/' + classroom.id);
  return classroom;
}
// Hold the actual committed response, never synthesize a business success.
async function holdSave(page) {
  let release;
  let committed;
  const done = new Promise(resolve => { committed = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const requests = [];
  await page.route('**' + records, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    const response = await route.fetch();
    committed();
    const action = await gate;
    if (action === 'abort') await route.abort('failed');
    else await route.fulfill({ response }).catch(() => {});
  });
  return { done, release, requests };
}
const input = page => page.getByRole('textbox', { name: '写一句', exact: true });
const save = page => page.locator('[data-region=record-composer]').getByRole('button', { name: '保存', exact: true });
const status = page => page.locator('[data-region=composer-status]');

test.use({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => {
  now = '2026-09-21T06:00:00Z';
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 't53-auth-repairs-'));
  fs.mkdirSync(evidence, { recursive: true });
  runner = await startTeachingAuth({ directory: dataDir, port: 49654, now: () => now });
  await register(page, runner);
});
test.afterEach(async () => { await runner.close(); });

test('D03: slow committed response preserves new text and supplementary draft, then saves it separately', async ({ page }) => {
  const classroom = await composer(page);
  await input(page).fill('原始提交');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await input(page).fill('保存期间的新草稿');
  await page.getByRole('button', { name: '补充', exact: true }).click();
  await page.getByRole('textbox', { name: '教学位置', exact: true }).fill('新位置');
  await shot(page, 'slow-before-response');
  held.release();
  await expect(page.locator('[data-region=record-rows]')).toContainText('原始提交');
  await expect(input(page)).toHaveValue('保存期间的新草稿');
  await expect(page.getByRole('textbox', { name: '教学位置', exact: true })).toHaveValue('新位置');
  await expect(status(page)).toContainText('新输入');
  expect((await read(page, records + '?classId=' + classroom.id)).items.map(x => x.note)).toEqual(['原始提交']);
  await shot(page, 'slow-after-response');
  await page.reload();
  await expect(input(page)).toHaveValue('保存期间的新草稿');
  await page.unroute('**' + records);
  await save(page).click();
  await expect(input(page)).toHaveValue('');
  await expect.poll(async () => (await read(page, records + '?classId=' + classroom.id)).items.length).toBe(2);
});

test('D03: lost response survives reload and original-key retry without deleting the new draft', async ({ page }) => {
  const classroom = await composer(page);
  await input(page).fill('丢响应的原句');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await input(page).fill('丢响应期间的新句'); held.release('abort');
  await expect(status(page)).toContainText('暂时无法确认');
  await page.unroute('**' + records);
  await page.reload();
  await expect(input(page)).toHaveValue('丢响应期间的新句');
  const retry = page.waitForRequest(request => request.url().endsWith(records) && request.method() === 'POST');
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  const request = await retry;
  expect(request.headers()['idempotency-key']).toBe(held.requests[0].key);
  expect(request.postDataJSON()).toEqual(held.requests[0].body);
  await expect(status(page)).toContainText('已保存');
  await expect(input(page)).toHaveValue('丢响应期间的新句');
  expect((await read(page, records + '?classId=' + classroom.id)).items).toHaveLength(1);
  await shot(page, 'lost-response-retried');
});

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

test('D03: late response after identity loss cannot erase account A draft or appear in account B', async ({ page, context }) => {
  const classroom = await composer(page);
  await input(page).fill('A 已提交的句子');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await input(page).fill('A 仍未提交的草稿');
  await logout(page);
  await register(page, runner, 'teacher-b@example.test');
  held.release();
  await page.locator('a[href="/classes"]').click();
  await expect(page.locator('[data-region=class-empty]')).toBeVisible();
  await expect(page.getByText('A 已提交的句子', { exact: true })).toHaveCount(0);
  expect((await page.request.get(origin + records + '?classId=' + classroom.id, { headers: headers(page) })).status()).toBe(404);
  await shot(page, 'account-b-after-late-response');
  await logout(page);
  await login(page);
  await page.locator('a[href="/classes"]').click();
  await page.locator(`[data-class-id="${classroom.id}"]`).click();
  await expect(input(page)).toHaveValue('A 仍未提交的草稿');
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(status(page)).toContainText('已保存');
  await expect(input(page)).toHaveValue('A 仍未提交的草稿');
  expect((await read(page, records + '?classId=' + classroom.id)).items).toHaveLength(1);
  await shot(page, 'account-a-restored-draft');
});

test('D03: changing only the record date and supplementary field keeps the whole draft', async ({ page }) => {
  await composer(page);
  await input(page).fill('正文保持相同');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await page.getByLabel('记录日期', { exact: true }).fill('2026-09-20');
  await page.getByRole('button', { name: '补充', exact: true }).click();
  await page.getByLabel('下次备注', { exact: true }).fill('保存期间补写');
  held.release();
  await expect(status(page)).toContainText('新输入');
  await expect(input(page)).toHaveValue('正文保持相同');
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue('2026-09-20');
  await expect(page.getByLabel('下次备注', { exact: true })).toHaveValue('保存期间补写');
  await shot(page, 'supplementary-only-draft');
});
