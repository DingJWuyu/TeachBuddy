import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './teaching-time-auth/helpers.mjs';
import { moduleRow } from './catalog-navigation.helpers.mjs';
let world;
test.beforeEach(async ({ page }) => {
  world = await createIntegration(); await register(page, world);
  await page.getByRole('button', { name: '知道了', exact: true }).click();
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});

test('侧栏隐藏模块后支持和首页入口仍可用，并可从垃圾桶恢复', async ({ page }) => {
  await moduleRow(page, 'resources').press('Delete');
  await expect(moduleRow(page, 'resources')).toHaveCount(0);
  await page.locator('.tb-account-row').click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'settings');
  await page.locator('.tb-global-nav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'home');
  await page.reload();
  await expect(moduleRow(page, 'resources')).toHaveCount(0);
  await page.getByRole('button', { name: /^垃圾桶/ }).click();
  await page.getByRole('button', { name: '恢复 资源库', exact: true }).click();
  await expect(moduleRow(page, 'resources')).toBeVisible();
});
