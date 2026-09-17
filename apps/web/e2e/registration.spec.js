import { expect, test } from '@playwright/test';
import { accountFor, loginTeacher } from './helpers.js';

test('teacher can register, enter the workspace, leave, and log in again', async ({ page }, testInfo) => {
  const account = accountFor('browser-teacher', testInfo, 'browser password');
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '教师账户' })).toBeVisible();
  await expect(page.getByLabel('邮箱')).toHaveValue('');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('');

  await page.getByRole('button', { name: '注册' }).click();
  await expect(page.getByLabel('显示名称')).toHaveValue('');
  await expect(page.getByLabel('确认密码')).toHaveValue('');
  await page.getByLabel('显示名称').fill('浏览器教师');
  await page.getByLabel('邮箱').fill(account.email.toUpperCase());
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByLabel('确认密码').fill(account.password);
  await page.getByRole('button', { name: '创建账户' }).click();

  await expect(page.getByRole('button', { name: '工作台首页' })).toBeVisible();
  await expect(page.getByText('浏览器教师', { exact: true })).toBeVisible();
  await expect(page.getByText('可用模板：0')).toBeVisible();
  for (const label of ['即将开始的课程', '待处理提醒', '备课计划', '练习单草稿', '模板', '资源']) {
    await expect(page.getByRole('heading', { name: `${label}：0` })).toBeVisible();
  }

  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('heading', { name: '教师账户' })).toBeVisible();

  await page.getByRole('button', { name: '注册' }).click();
  await page.getByLabel('显示名称').fill('重复教师');
  await page.getByLabel('邮箱').fill(account.email.toUpperCase());
  await page.getByLabel('密码', { exact: true }).fill('another password');
  await page.getByLabel('确认密码').fill('another password');
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByText('该邮箱已注册，请使用其他邮箱。')).toBeVisible();

  await page.getByRole('button', { name: '返回登录' }).click();
  await loginTeacher(page, account);
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
  await expect(page.getByText('浏览器教师', { exact: true })).toBeVisible();
});
