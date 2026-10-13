import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';

let world;
test.afterEach(async ({ context }) => { await context.close(); await world?.close(); });
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  await registerMath(world, 'ui-modules@example.test');
  await page.goto(world.origin);
  await page.getByLabel('邮箱', { exact: true }).fill('ui-modules@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
});

test('班级低频操作菜单可改名并保留教学记录', async ({ page }) => {
  await page.getByRole('complementary', { name: '工作台导航' }).locator('a[href="/classes"]').click();
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('高一一班');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByLabel('写一句', { exact: true }).fill('例题二尚需巩固。');
  await page.locator('[data-region="record-composer"]').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('例题二尚需巩固。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '班级操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '重命名', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('高一实验班');
  await page.locator('[name="save-class-name"]').click();
  await expect(page.getByRole('heading', { name: '高一实验班', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('例题二尚需巩固。', { exact: true })).toBeVisible();
});
