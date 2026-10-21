import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { startTeachingAuth } from './teaching-time-auth/service.mjs';
import { register, login, confirmLogout, headers } from './teaching-time-auth/helpers.mjs';
let world, directory;
test.beforeEach(async ({ page }) => {
  world = undefined;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-shell-'));
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
  else console.error('Test instance retained:', directory);
});
test('设置外观、占位边界、真实导出和退出', async ({ page }, testInfo) => {
  const settings = page.locator('[data-region="settings"]');
  const writes = [];
  page.on('request', request => { if (request.url().includes('/api/') && !['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await expect(settings).toContainText('teacher-a@example.test');
  for (const removed of ['阅读字号', '界面动效', '保存偏好', '本设备草稿与现场', '备份与还原', '当前学期', '当前套餐', '每周开始于', '最近删除'])
    await expect(settings.getByText(removed, { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('settings-light.png'), animations: 'disabled' });
  await settings.locator('.tbx-danger').screenshot({ path: testInfo.outputPath('settings-danger.png'), animations: 'disabled' });
  await settings.getByRole('button', { name: '深色', exact: true }).click();
  await expect(settings.getByRole('button', { name: '深色', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('settings-dark.png'), animations: 'disabled' });
  await settings.getByRole('button', { name: '浅色', exact: true }).click();
  await settings.getByRole('button', { name: '语言', exact: true }).click();
  await expect(page.getByRole('menu', { name: '选择语言' })).toBeVisible();
  await expect(page.getByRole('menuitemradio')).toHaveCount(2);
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(settings.getByRole('button', { name: 'Language', exact: true })).toContainText('English');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await settings.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /简体中文/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await settings.getByRole('button', { name: '羊皮纸', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'parchment');
  await settings.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await settings.getByRole('button', { name: '浅色', exact: true }).click();
  await settings.getByRole('button', { name: '签署协议', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settings.getByRole('button', { name: '删除账户…', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /删除/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes.length).toBeGreaterThan(0);
  expect(writes.every(url => url.endsWith('/api/reliability/v1/preferences'))).toBe(true);
  await settings.getByRole('button', { name: '导出数据', exact: true }).click();
  const downloadButton = page.getByRole('button', { name: '下载', exact: true });
  await expect(downloadButton.first()).toBeVisible({ timeout: 30000 });
  const downloadEvent = page.waitForEvent('download');
  await downloadButton.first().click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/TeachBuddy.*zip/);
  expect(fs.statSync(await download.path()).size).toBeGreaterThan(100);
  const records = async () => (await (await page.request.get(world.origin + '/api/reliability/v1/exports', { headers: headers(page) })).json()).items;
  await page.getByRole('button', { name: '删除资料包', exact: true }).click();
  await expect(page.getByRole('list', { name: '个人资料导出记录' }).locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('list', { name: '个人资料导出记录' })).toHaveCount(0);
  expect(await records()).toHaveLength(0);
  await page.reload();
  await settings.getByRole('button', { name: '导出数据', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('list', { name: '个人资料导出记录' }).locator('li')).toHaveCount(1);
  expect(await records()).toHaveLength(1);
  await page.keyboard.press('Escape');
  await settings.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
});
test('窄屏设置可阅读且不横向溢出', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const settings = page.locator('[data-region="settings"]');
  await expect(settings.getByRole('button', { name: '深色', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await settings.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  for (const theme of ['浅色', '深色']) {
    await settings.getByRole('button', { name: theme, exact: true }).click();
    const upload = await settings.locator('.tbx-bg-upload em').boundingBox();
    const label = await settings.locator('.tbx-bg-custom > span:last-child').boundingBox();
    expect(upload.y + upload.height, '上传背景提示应完整位于自定义标题上方').toBeLessThanOrEqual(label.y);
  }
  await settings.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  const upload = await settings.locator('.tbx-bg-upload em').boundingBox();
  const label = await settings.locator('.tbx-bg-custom > span:last-child').boundingBox();
  expect(upload.y + upload.height, '英文上传背景提示应完整位于自定义标题上方').toBeLessThanOrEqual(label.y);
  await page.screenshot({ path: testInfo.outputPath('settings-mobile.png'), animations: 'disabled' });
});

test('协议阅读关闭后恢复入口焦点', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '签署协议', exact: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '数据处理协议', exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test('外观和背景覆盖外壳与全部页面并在刷新后保留', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '圆形', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  for (const route of ['/', '/questions', '/math', '/resources', '/calendar', '/settings', '/help', '/releases']) {
    await page.goto(world.origin + route);
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'circles');
    await expect(page.locator('.wb-shell')).toHaveCSS('background-image', /radial-gradient/);
    expect(await page.locator('.wb-workspace').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dark-${route.slice(1) || 'home'}.png`), animations: 'disabled' });
  }
  await page.goto(world.origin + '/settings');
  await expect(page.getByText('结束当前会话', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '最近删除' })).toHaveCount(0);
  await page.getByRole('button', { name: '浅色', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'light');
});
test('头像上传删除同步侧栏、自定义背景按账户跨设备保存，弹层退出连续', async ({ page, browser }, info) => {
  const settings = page.locator('[data-region="settings"]');
  const avatar = await sharp({ create: { width: 48, height: 64, channels: 3, background: '#927acb' } }).png().toBuffer();
  const choosing = page.waitForEvent('filechooser');
  await settings.getByRole('button', { name: '选择头像', exact: true }).click();
  await (await choosing).setFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: avatar });
  await expect(settings.getByAltText('账户头像')).toBeVisible();
  await expect(settings.getByRole('button', { name: '修改昵称', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(settings.getByRole('button', { name: '浅色', exact: true })).toBeFocused();
  await expect(page.locator('.tb-account-row img')).toHaveAttribute('src', await settings.getByAltText('账户头像').getAttribute('src'));
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  await settings.locator('.tbx-bg-options input[type="file"]').setInputFiles({ name: 'background.png', mimeType: 'image/png', buffer: avatar });
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'custom');
  await expect.poll(() => page.locator('.wb-shell').evaluate(el => el.style.getPropertyValue('--tbx-bg-image'))).toContain('data:image/jpeg');
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  const afterBackground = await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json();
  expect(afterBackground.values.background).toBe('custom');
  expect(afterBackground.values.backgroundImage).toMatch(/^data:image\/jpeg;base64,/);
  await page.screenshot({ path: info.outputPath('custom-background-saved.png'), animations: 'disabled' });
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const secondPage = await other.newPage();
    await secondPage.goto(world.origin);
    await login(secondPage);
    await expect(secondPage.locator('.tb-account-row img')).toHaveAttribute('src', await settings.getByAltText('账户头像').getAttribute('src'));
    await expect(secondPage.locator('.wb-shell')).toHaveAttribute('data-background', 'custom');
    await expect.poll(() => secondPage.locator('.wb-shell').evaluate(el => el.style.getPropertyValue('--tbx-bg-image'))).toContain(afterBackground.values.backgroundImage);
  } finally { await other.close(); }
  await page.reload();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'custom');
  await expect(settings.getByAltText('账户头像')).toBeVisible();
  await expect(page.locator('.tb-account-row img')).toBeVisible();
  await settings.locator('.settings-avatar').hover();
  const deleteAvatar = settings.getByRole('button', { name: '删除头像', exact: true });
  await deleteAvatar.click();
  await expect(settings.getByAltText('账户头像')).toBeVisible();
  const avatarConfirmation = page.getByRole('alertdialog', { name: '删除头像', exact: true });
  await expect(avatarConfirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(deleteAvatar).toBeFocused();
  await expect(settings.getByAltText('账户头像')).toBeVisible();
  await deleteAvatar.click();
  await avatarConfirmation.getByRole('button', { name: '删除', exact: true }).click();
  await expect(settings.getByAltText('账户头像')).toHaveCount(0);
  await expect(settings.getByRole('button', { name: '选择头像', exact: true })).toBeFocused();
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
  const englishLanguage = settings.getByRole('button', { name: 'Language', exact: true });
  await expect(englishLanguage).toContainText('English');
  await englishLanguage.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: /简体中文/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(englishLanguage).toBeFocused();
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
  let releaseRetry;
  const retryGate = new Promise(resolve => { releaseRetry = resolve; });
  await page.route('**/api/reliability/v1/exports', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else { await retryGate; await route.continue(); }
  });
  await page.getByRole('button', { name: '导出数据', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认操作', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看待确认请求', exact: true }).click();
  await expect(page.locator('.reliability-pending pre')).toContainText(keys[0]);
  await expect(page.getByRole('button', { name: '放弃重试', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试确认操作', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '放弃重试', exact: true })).toHaveCount(0);
  await page.reload();
  const retry = page.getByRole('button', { name: '重试确认操作', exact: true });
  const details = page.getByRole('button', { name: '查看待确认请求', exact: true });
  await retry.click();
  try {
    await expect(retry).toBeDisabled();
    await expect(details).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.reliability-pending pre')).toBeVisible();
  } finally { releaseRetry(); }
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  await expect(page.getByRole('list', { name: '个人资料导出记录' }).locator('li')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '导出数据', exact: true })).toBeEnabled();
});


test('删除资料包丢失回执后刷新用原键确认，下载权限已撤销', async ({ page }) => {
  await page.getByRole('button', { name: '导出数据', exact: true }).click();
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 30000 });
  const record = (await (await page.request.get(world.origin + '/api/reliability/v1/exports', { headers: headers(page) })).json()).items[0];
  const keys = [];
  await page.route('**/api/reliability/v1/exports/*/deletion', async route => {
    keys.push(route.request().headers()['idempotency-key']);
    await route.fetch(); await route.abort('failed');
  });
  await page.getByRole('button', { name: '删除资料包', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认操作', exact: true })).toBeVisible();
  expect((await page.request.get(world.origin + record.downloadPath, { headers: headers(page) })).status()).toBe(404);
  await page.unroute('**/api/reliability/v1/exports/*/deletion');
  await page.reload();
  page.on('request', request => { if (request.url().endsWith('/deletion')) keys.push(request.headers()['idempotency-key']); });
  await page.getByRole('button', { name: '重试确认操作', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认操作', exact: true })).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect((await (await page.request.get(world.origin + '/api/reliability/v1/exports', { headers: headers(page) })).json()).items).toHaveLength(0);
  await expect(page.getByRole('button', { name: '导出数据', exact: true })).toBeFocused();
});


test('旧设备自定义背景保留供选择且不覆盖服务器较新偏好', async ({ page }) => {
  await page.getByRole('button', { name: '羊皮纸', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  const before = await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json();
  const accountKey = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts').get().accountKey;
  const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#927acb' } }).jpeg().toBuffer();
  const image = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  await page.evaluate(({ accountKey, image }) => {
    localStorage.setItem(`tb.workbench.v1:${accountKey}:scene:custom-appearance`, JSON.stringify({ customBackground: true, backgroundImage: image }));
    sessionStorage.removeItem(`tb.workbench.v1:continue:${accountKey}:scene:custom-appearance`);
  }, { accountKey, image });
  await page.reload();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'parchment');
  await expect(page.getByRole('button', { name: '自定义背景', exact: true })).toBeVisible();
  const unchanged = await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json();
  expect(unchanged).toEqual(before);
  await page.getByRole('button', { name: '自定义背景', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  const after = await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json();
  expect(after.values.background).toBe('custom');
  expect(after.values.backgroundImage).toBe(image);
});


test('未设置服务器偏好的账户采用旧设备自定义背景并真实保存', async ({ page }) => {
  const accountKey = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts').get().accountKey;
  const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#927acb' } }).webp().toBuffer();
  const image = `data:image/webp;base64,${bytes.toString('base64')}`;
  await page.evaluate(({ accountKey, image }) => {
    localStorage.setItem(`tb.workbench.v1:${accountKey}:scene:custom-appearance`, JSON.stringify({ customBackground: true, backgroundImage: image }));
    sessionStorage.removeItem(`tb.workbench.v1:continue:${accountKey}:scene:custom-appearance`);
  }, { accountKey, image });
  await page.reload();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-background', 'custom');
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  const after = await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json();
  expect(after.values.background).toBe('custom');
  expect(after.values.backgroundImage).toBe(image);
});
