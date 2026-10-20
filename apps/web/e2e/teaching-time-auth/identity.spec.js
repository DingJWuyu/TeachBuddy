import { confirmLogout } from './helpers.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { startTeachingAuth } from './service.mjs';
import { register, login, logout, headers } from './helpers.mjs';
const evidence = path.resolve(process.env.T53_AUTH_EVIDENCE || 'test-results/t53-auth/evidence', 'identity');
let world, now, directory, network;
const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
const input = { title: '甲账户安排', items: [], time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' }, repeat: null, reminder: { side: 'before', minutes: 10 } };
async function api(page, endpoint, data, method = 'POST') {
  const response = await page.request.fetch(world.origin + endpoint, { method: data ? method : 'GET', data,
    headers: { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() } });
  return { status: response.status(), body: await response.json() };
}
async function shot(page, name) { await page.screenshot({ path: path.join(evidence, name + '.png'), animations: 'disabled' }); }
test.beforeEach(async ({ page }) => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 't53-auth-identity-'));
  now = '2026-09-21T06:00:00Z';
  world = await startTeachingAuth({ directory, port: 49657, now: () => now });
  fs.mkdirSync(evidence, { recursive: true });
  network = [];
  page.on('response', response => {
    const request = response.request(), endpoint = new URL(response.url()).pathname;
    if (endpoint.startsWith('/api/')) network.push({ method: request.method(), path: endpoint, status: response.status(), pageHeader: /^[a-f0-9]{32}$/.test(request.headers()['x-teachbuddy-page'] || ''), protection: request.headers()['x-teachbuddy-request'] === '1' });
  });
  await register(page, world);
});
test.afterEach(async ({}, info) => {
  fs.writeFileSync(path.join(evidence, info.title.replace(/[^a-z0-9]/gi, '-') + '.json'), JSON.stringify({ title: info.title, status: info.status, directory, network }, null, 2));
  await world.close();
});

test('AUTH-T01: UI create save, expiry login recovery, account isolation and preserved database restart', async ({ page }) => {
  const entry = (await api(page, entries, input)).body;
  await page.goto(world.origin + '/calendar?entry=' + entry.id);
  await page.locator('[name=entry-title]').fill('真实认证安排已修改');
  await page.locator('[data-action=save]').click();
  await expect.poll(async () => (await api(page, entries + '/' + entry.id)).body.title).toBe('真实认证安排已修改');
  now = '2026-09-21T09:00:00Z';
  await page.reload();
  await page.getByRole('button', { name: /^通知/ }).click();
  await expect(page.locator('[data-notification-id]')).toHaveCount(1);
  const notificationId = await page.locator('[data-notification-id]').getAttribute('data-notification-id');
  await page.locator('[data-notification-id]').click();
  await expect.poll(async () => (await api(page, notices)).body.unreadCount).toBe(0);
  await shot(page, 'saved-notification-target');
  // Real server expiry, not an injected principal or a fabricated HTTP result.
  now = '2026-09-29T09:00:00Z';
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await shot(page, 'expired');
  await login(page);
  await page.goto(world.origin + '/calendar?entry=' + entry.id);
  await expect(page.locator('[name=entry-title]')).toHaveValue('真实认证安排已修改');
  await logout(page);
  expect((await api(page, entries)).status).toBe(401);
  await register(page, world, 'teacher-b@example.test');
  for (const endpoint of [entries + '/' + entry.id]) expect((await api(page, endpoint)).status).toBe(404);
  expect((await api(page, notices)).body.items).toEqual([]);
  await page.goto(world.origin + '/calendar');
  await expect(page.locator('[name=entry-title]')).toHaveCount(0);
  await shot(page, 'account-b-empty');
  await logout(page); await login(page);
  await world.close();
  world = await startTeachingAuth({ directory, port: 49657, now: () => now });
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible();
  expect((await api(page, entries + '/' + entry.id)).body.title).toBe('真实认证安排已修改');
  const persisted = (await api(page, notices)).body;
  expect(persisted.items).toHaveLength(1); expect(persisted.items[0].id).toBe(notificationId); expect(persisted.unreadCount).toBe(0);
  await page.goto(world.origin + '/calendar?entry=' + entry.id);
  await expect(page.locator('[name=entry-title]')).toHaveValue('真实认证安排已修改');
  await shot(page, 'database-restart');
  expect(network.filter(x => x.path.startsWith('/api/modules')).every(x => x.pageHeader)).toBe(true);
});

test('AUTH-T02: late schedule response is discarded after logout and another account login', async ({ page }) => {
  const entry = (await api(page, entries, input)).body;
  let release, arrived;
  const gate = new Promise(resolve => { release = resolve; });
  const received = new Promise(resolve => { arrived = resolve; });
  await page.route('**' + entries + '/' + entry.id, async route => {
    const response = await route.fetch(); arrived(); await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.goto(world.origin + '/calendar?entry=' + entry.id); await received;
  // Client navigation keeps the pending response in this document.
  await page.getByRole('link', { name: /^账户：/ }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  // Register directly from the current document, preserving the late-response race.
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('乙老师');
  await page.getByLabel('邮箱', { exact: true }).fill('teacher-b@example.test');
  await page.getByLabel('密码', { exact: true }).fill('teaching-auth-password');
  await page.getByLabel('确认密码', { exact: true }).fill('teaching-auth-password');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect.poll(() => world.mailer.lastCode('registration', 'teacher-b@example.test')).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'teacher-b@example.test'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-account-chip')).toContainText('乙老师');
  release();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('[data-region=schedule]')).toBeVisible();
  await expect(page.locator('.wb-shell')).not.toContainText('甲账户安排');
  expect((await api(page, entries)).body.items).toEqual([]);
  await shot(page, 'late-schedule-account-b');
});
