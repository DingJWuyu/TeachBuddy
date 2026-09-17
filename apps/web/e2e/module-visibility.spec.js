import { expect, test } from '@playwright/test';

async function registerTeacher(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '注册' }).click();
  await page.getByLabel('显示名称').fill('模块可见性教师');
  await page.getByLabel('邮箱').fill('module.visibility@example.test');
  await page.getByLabel('密码', { exact: true }).fill('module visibility password');
  await page.getByLabel('确认密码').fill('module visibility password');
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('button', { name: '工作台首页' })).toBeVisible();
}

async function loginTeacher(page) {
  await page.getByLabel('邮箱').fill('module.visibility@example.test');
  await page.getByLabel('密码', { exact: true }).fill('module visibility password');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('button', { name: '工作台首页' })).toBeVisible();
}

test('teacher can hide and restore a module without losing its workspace position', async ({ page, browser }) => {
  await registerTeacher(page);
  const sidebar = page.locator('aside');

  await expect(sidebar.getByRole('button', { name: /备课规划/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '备课计划：0' })).toBeVisible();
  await expect(page.getByRole('button', { name: '规划课程', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '工作台设置' })).toBeVisible();
  const lessonVisibility = page.getByLabel('备课规划');
  await expect(lessonVisibility).toBeChecked();
  await lessonVisibility.uncheck();
  await expect(lessonVisibility).not.toBeChecked();

  await page.getByRole('button', { name: '工作台首页' }).click();
  await expect(sidebar.getByRole('button', { name: /备课规划/ })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '备课计划：0' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '最近课程' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: '规划课程', exact: true })).not.toBeVisible();
  await expect(sidebar.getByRole('button', { name: /提醒中心/ })).toBeVisible();

  await page.reload();
  await expect(sidebar.getByRole('button', { name: /备课规划/ })).not.toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await loginTeacher(page);
  await expect(page.locator('aside').getByRole('button', { name: /备课规划/ })).not.toBeVisible();

  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const otherPage = await otherContext.newPage();
  try {
    await otherPage.goto('/');
    await loginTeacher(otherPage);
    await expect(otherPage.locator('aside').getByRole('button', { name: /备课规划/ })).not.toBeVisible();
  } finally {
    await otherContext.close();
  }

  await page.getByRole('button', { name: '设置' }).click();
  await page.getByLabel('备课规划').check();
  await page.getByRole('button', { name: '工作台首页' }).click();
  await expect(sidebar.getByRole('button', { name: /备课规划/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '备课计划：0' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '最近课程' })).toBeVisible();
  await expect(page.getByRole('button', { name: '规划课程', exact: true })).toBeVisible();
});
