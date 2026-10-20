import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './teaching-time-auth/helpers.mjs';

test('真实工作台设置在模块导航和刷新后保持已保存外观', async ({ page, context }) => {
  const world = await createIntegration();
  let passed = false;
  try {
    await register(page, world);
    const coach = page.getByRole('button', { name: '知道了', exact: true });
    if (await coach.count()) await coach.click();
    await page.goto(world.origin + '/settings');
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await expect(page.locator('.settings-save-status')).toHaveText('已保存');
    await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
    await page.goto(world.origin + '/settings');
    await expect(page.getByRole('button', { name: '深色', exact: true })).toHaveAttribute('aria-pressed', 'true');
    passed = true;
  } finally {
    await context.close();
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
    else console.error(`保留工作台失败现场: ${world.directory}`);
  }
});
