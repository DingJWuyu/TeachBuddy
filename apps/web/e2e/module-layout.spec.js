import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, login } from './teaching-time-auth/helpers.mjs';
import { addNavigationGroup, navigationGroup, pointerDrag } from './catalog-navigation.helpers.mjs';
let world;
test.beforeEach(async ({ page }) => {
  world = await createIntegration(); await register(page, world);
  await page.getByRole('button', { name: '知道了', exact: true }).click();
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});

test('空分组重命名、重排与解散在独立设备读回', async ({ page, browser }) => {
  await addNavigationGroup(page, '第一组');
  await addNavigationGroup(page, '第二组');
  await navigationGroup(page, '第一组').getByRole('button', { name: '分组选项', exact: true }).click();
  await page.getByRole('menuitem', { name: '重命名分组', exact: true }).click();
  const rename = page.getByRole('textbox', { name: '重命名分组', exact: true });
  await rename.fill('近期安排'); await rename.press('Enter');
  await pointerDrag(page, navigationGroup(page, '第二组').locator('.tbx-group-head'), navigationGroup(page, '近期安排').locator('.tbx-group-head'), { top: true });
  await expect.poll(() => page.locator('.tbx-group-name').allTextContents()).toEqual(['教学', '第二组', '近期安排']);
  await page.reload();
  await expect.poll(() => page.locator('.tbx-group-name').allTextContents()).toEqual(['教学', '第二组', '近期安排']);
  await navigationGroup(page, '第二组').getByRole('button', { name: '分组选项', exact: true }).click();
  await page.getByRole('menuitem', { name: '解散分组', exact: true }).click();
  await page.getByRole('menuitem', { name: '确认解散', exact: true }).click();
  await expect(navigationGroup(page, '第二组')).toHaveCount(0);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const other = await context.newPage(); await other.goto(world.origin); await login(other);
    await other.getByRole('button', { name: '知道了', exact: true }).click();
    await expect(navigationGroup(other, '近期安排')).toBeVisible();
    await expect(navigationGroup(other, '第二组')).toHaveCount(0);
  } finally { await context.close(); }
});

test('窄屏抽屉可新建分组并前往设置', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
  await addNavigationGroup(page, '移动端分组');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.tb-account-row').click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'settings');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
