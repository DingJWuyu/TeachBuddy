import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { startTeachingAuth } from './teaching-time-auth/service.mjs';
import { register, login } from './teaching-time-auth/helpers.mjs';
let world, directory;
test.beforeEach(async ({ page }) => {
  fs.mkdirSync('.scratch/settings-test', { recursive: true });
  directory = fs.mkdtempSync(path.resolve('.scratch/settings-test/account-'));
  world = await startTeachingAuth({ directory });
  await register(page, world);
  const coach = page.getByRole('button', { name: /知道了/ });
  if (await coach.count()) await coach.first().click();
  await page.goto(world.origin + '/settings');
  await expect(page.locator('[data-region="settings"]')).toBeVisible();
});
test.afterEach(async ({}, info) => {
  await world?.close();
  if (info.status === info.expectedStatus) fs.rmSync(directory, { recursive: true, force: true });
});
test('设置外观、占位边界、真实导出和退出', async ({ page }) => {
  const settings = page.locator('[data-region="settings"]');
  const writes = [];
  page.on('request', request => { if (request.url().includes('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await expect(settings).toContainText('teacher-a@example.test');
  for (const removed of ['阅读字号', '界面动效', '保存偏好', '本设备草稿与现场', '备份与还原', '当前学期', '当前套餐', '每周开始于', '最近删除'])
    await expect(settings.getByText(removed, { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '.scratch/settings-test/settings-light.png', animations: 'disabled' });
  await settings.locator('.settings-danger-section').screenshot({ path: '.scratch/settings-test/settings-danger.png', animations: 'disabled' });
  await settings.getByRole('button', { name: '深色', exact: true }).click();
  await expect(settings.getByRole('button', { name: '深色', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '.scratch/settings-test/settings-dark.png', animations: 'disabled' });
  await settings.getByRole('button', { name: '浅色', exact: true }).click();
  await settings.getByRole('button', { name: '语言', exact: true }).click();
  await expect(page.getByRole('menu', { name: '选择语言' })).toBeVisible();
  await expect(page.getByRole('menuitemradio')).toHaveCount(20);
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(settings.getByRole('button', { name: '语言', exact: true })).toContainText('English');
  await settings.getByRole('button', { name: '羊皮纸', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'parchment');
  await settings.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('.wb-workspace')).toHaveCSS('background-color', 'rgb(41, 37, 31)');
  await settings.getByRole('button', { name: '浅色', exact: true }).click();
  await settings.getByRole('button', { name: '签署协议', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settings.getByRole('button', { name: '删除账户', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /删除/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes.length).toBeGreaterThan(0);
  expect(writes.every(url => url.endsWith('/api/reliability/v1/preferences'))).toBe(true);
  await settings.getByRole('button', { name: '导出数据', exact: true }).click();
  const downloadButton = page.getByRole('button', { name: '下载资料包', exact: true });
  await expect(downloadButton.first()).toBeVisible({ timeout: 30000 });
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.first().click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/TeachBuddy.*zip/);
  expect(fs.statSync(await download.path()).size).toBeGreaterThan(100);
  await page.keyboard.press('Escape');
  await settings.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
});
test('窄屏设置可阅读且不横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const settings = page.locator('[data-region="settings"]');
  await expect(settings.getByRole('button', { name: '深色', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await settings.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: '.scratch/settings-test/settings-mobile.png', animations: 'disabled' });
});

test('外观和背景覆盖外壳与全部页面并在刷新后保留', async ({ page }) => {
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '条纹', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  for (const route of ['/', '/questions', '/lessons', '/math', '/classes', '/resources', '/calendar', '/settings', '/help', '/releases']) {
    await page.goto(world.origin + route);
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'stripes');
    for (const selector of ['.tb-topbar', '.tb-sidebar'])
      await expect(page.locator(selector)).toHaveCSS('background-color', 'rgb(37, 38, 43)');
    await expect(page.locator('.wb-workspace')).toHaveCSS('background-image', /repeating-linear-gradient/);
    expect(await page.locator('.wb-workspace').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `.scratch/settings-test/dark-${route.slice(1) || 'home'}.png`, animations: 'disabled' });
  }
  await page.goto(world.origin + '/settings');
  await expect(page.getByText('结束当前会话', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '最近删除' })).toHaveCount(0);
  await page.getByRole('button', { name: '浅色', exact: true }).click();
  await expect(page.locator('.tb-topbar')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
test('头像上传删除同步侧栏、刷新保留，弹层退出连续', async ({ page, browser }) => {
  const settings = page.locator('[data-region="settings"]');
  const avatar = await sharp({ create: { width: 48, height: 64, channels: 3, background: '#927acb' } }).png().toBuffer();
  await settings.locator('input[type="file"]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: avatar });
  await expect(settings.getByAltText('账户头像')).toBeVisible();
  await expect(page.locator('.tb-account-row img')).toHaveAttribute('src', await settings.getByAltText('账户头像').getAttribute('src'));
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const secondPage = await other.newPage();
    await secondPage.goto(world.origin);
    await login(secondPage);
    await expect(secondPage.locator('.tb-account-row img')).toHaveAttribute('src', await settings.getByAltText('账户头像').getAttribute('src'));
  } finally { await other.close(); }
  await page.reload();
  await expect(settings.getByAltText('账户头像')).toBeVisible();
  await expect(page.locator('.tb-account-row img')).toBeVisible();
  await settings.locator('.settings-avatar').hover();
  await settings.getByRole('button', { name: '删除头像' }).click();
  await expect(settings.getByAltText('账户头像')).toHaveCount(0);
  await expect(page.locator('.tb-account-row img')).toHaveCount(0);
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  await page.reload();
  await expect(page.locator('.tb-account-row img')).toHaveCount(0);
  await settings.getByRole('button', { name: '签署协议', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => {
    window.settingsFrames = [];
    const sample = () => {
      const element = document.querySelector('dialog.settings-confirm');
      window.settingsFrames.push(element ? Number(getComputedStyle(element).opacity) : -1);
      if (window.settingsFrames.length < 60) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => settingsFrames.some(value => value > 0 && value < 1))).toBe(true);
  const language = settings.getByRole('button', { name: '语言', exact: true });
  await language.click(); await language.click(); await language.click();
  await expect(page.getByRole('menu', { name: '选择语言' })).toBeVisible();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(language).toContainText('English');
  await language.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(language).toBeFocused();
});

test('外观保存回执丢失后原键确认并保存后续选择', async ({ page }) => {
  const keys = [];
  let lost = false;
  await page.route('**/api/reliability/v1/preferences', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试保存', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '圆形', exact: true }).click();
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  expect(keys).toHaveLength(3);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(keys[2]).not.toBe(keys[0]);
  await page.reload();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'circles');
});

test('导出回执丢失后刷新可确认并下载同一资料包', async ({ page }) => {
  const keys = [];
  let lost = false;
  await page.route('**/api/reliability/v1/exports', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: '导出数据', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认操作', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '重试确认操作', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载资料包', exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  await expect(page.getByRole('list', { name: '个人资料导出记录' }).locator('li')).toHaveCount(1);
});
