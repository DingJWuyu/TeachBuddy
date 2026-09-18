import { expect, test } from '@playwright/test';
import { accountFor, registerTeacher } from './helpers.js';

test('registered modules compose the sidebar, core entry, and module switching', async ({ page }, testInfo) => {
  await registerTeacher(page, accountFor('module-registry', testInfo, 'module registry password'));

  const sidebar = page.locator('aside');
  for (const title of ['排课管理', '提醒中心', '备课规划', '练习单设计', '资源库']) {
    await expect(sidebar.getByRole('button', { name: title, exact: true })).toBeVisible();
  }

  for (const label of ['即将开始的课程', '待处理提醒', '备课计划', '练习单草稿', '模板', '资源']) {
    await expect(page.getByRole('heading', { name: `${label}：0` })).toBeVisible();
  }
  for (const title of ['提醒概览', '排课概览', '最近课程', '最近练习单']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  for (const action of ['规划课程', '起草练习单', '打开资源库']) {
    await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible();
  }

  await sidebar.getByRole('button', { name: '排课管理', exact: true }).click();
  await expect(page.getByRole('heading', { name: '排课管理' })).toBeVisible();
  await sidebar.getByRole('button', { name: '备课规划', exact: true }).click();
  await expect(page.getByRole('heading', { name: '备课规划' })).toBeVisible();
  await sidebar.getByRole('button', { name: '工作台首页' }).click();
  await expect(page.getByRole('heading', { name: '选择下一步' })).toBeVisible();
});
