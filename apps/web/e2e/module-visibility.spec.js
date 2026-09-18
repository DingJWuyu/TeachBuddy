import { expect, test } from '@playwright/test';
import { accountFor, registerTeacher } from './helpers.js';

test('the settings entry remains available when no modules are registered', async ({ page }, testInfo) => {
  await registerTeacher(page, accountFor('empty-visibility', testInfo, 'empty visibility password'));

  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '工作台设置' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '模块可见性' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);

  await page.getByRole('button', { name: '工作台首页' }).click();
  await expect(page.getByRole('button', { name: '工作台首页' })).toHaveClass(/active/);
  await expect(page.locator('[data-layout-module]')).toHaveCount(0);
  await expect(page.getByText('暂无模块')).toHaveCount(0);
});
