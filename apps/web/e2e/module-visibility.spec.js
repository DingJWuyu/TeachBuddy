import { expect, test } from '@playwright/test';
import { accountFor, loginTeacher, registerTeacher } from './helpers.js';

test('teacher can hide and restore a module without losing its workspace position', async ({ page, browser }, testInfo) => {
  const account = accountFor('module-visibility', testInfo, 'module visibility password');
  await registerTeacher(page, account);
  const sidebar = page.locator('aside');

  await expect(sidebar.getByRole('button', { name: '备课规划', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '备课计划：0' })).toBeVisible();
  await expect(page.getByRole('button', { name: '规划课程', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '工作台设置' })).toBeVisible();
  const lessonVisibility = page.getByRole('checkbox', { name: '备课规划', exact: true });
  await expect(lessonVisibility).toBeChecked();
  await lessonVisibility.uncheck();
  await expect(lessonVisibility).not.toBeChecked();

  await page.getByRole('button', { name: '工作台首页' }).click();
  await expect(sidebar.getByRole('button', { name: '备课规划', exact: true })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '备课计划：0' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '最近课程' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: '规划课程', exact: true })).not.toBeVisible();
  await expect(sidebar.getByRole('button', { name: '提醒中心', exact: true })).toBeVisible();

  await page.reload();
  await expect(sidebar.getByRole('button', { name: '备课规划', exact: true })).not.toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await loginTeacher(page, account);
  await expect(page.locator('aside').getByRole('button', { name: '备课规划', exact: true })).not.toBeVisible();

  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const otherPage = await otherContext.newPage();
  try {
    await otherPage.goto('/');
    await loginTeacher(otherPage, account);
    await expect(otherPage.locator('aside').getByRole('button', { name: '备课规划', exact: true })).not.toBeVisible();
  } finally {
    await otherContext.close();
  }

  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('checkbox', { name: '备课规划', exact: true }).check();
  await page.getByRole('button', { name: '工作台首页' }).click();
  await expect(sidebar.getByRole('button', { name: '备课规划', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '备课计划：0' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '最近课程' })).toBeVisible();
  await expect(page.getByRole('button', { name: '规划课程', exact: true })).toBeVisible();
});
