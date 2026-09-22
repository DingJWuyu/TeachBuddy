import { expect, test } from '@playwright/test';
import { accountFor, registerTeacher } from './helpers.js';

test('the legacy shell keeps stable core navigation without a server module directory', async ({ page }, testInfo) => {
  await registerTeacher(page, accountFor('empty-module-directory', testInfo, 'empty directory password'));

  // The old bearer module directory is retired: `GET /api/modules` is now the
  // workbench catalog and is same-origin only, so this shell no longer reads a
  // server list at all. Its own registry is empty by design.
  await expect(page.locator('aside').getByRole('button', { name: '工作台首页', exact: true })).toBeVisible();
  await expect(page.locator('aside').getByRole('button', { name: '设置', exact: true })).toBeVisible();
  await expect(page.locator('[data-layout-module]')).toHaveCount(0);
  await expect(page.getByText('暂无模块')).toHaveCount(0);
  await expect(page.getByText('选择下一步')).toHaveCount(0);
});
