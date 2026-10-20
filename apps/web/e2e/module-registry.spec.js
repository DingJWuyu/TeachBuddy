import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, headers } from './teaching-time-auth/helpers.mjs';

let world;
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  await register(page, world);
  await page.getByRole('button', { name: '知道了', exact: true }).click();
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});

test('前端导航与可信目录一致，班级入口可实际访问', async ({ page }) => {
  const response = await page.request.get(world.origin + '/api/modules', { headers: headers(page) });
  expect(response.status()).toBe(200);
  const catalog = await response.json();
  const sidebar = catalog.items.filter(item => item.webEnabled && item.navigation === 'sidebar');
  await expect(page.locator('.tbx-side-nav [data-row]')).toHaveCount(sidebar.length);
  for (const item of sidebar) await expect(page.locator(`.tbx-side-nav [data-row="${item.id}"]`)).toHaveAttribute('href', item.path);
  await page.locator('.tbx-side-nav [data-row="classroom"]').click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'classroom');
  await page.reload();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'classroom');
  await expect(page.locator('[data-region=not-found]')).toHaveCount(0);
});
