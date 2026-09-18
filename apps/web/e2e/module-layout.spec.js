import { expect, test } from '@playwright/test';
import {
  accountFor,
  expectNoHorizontalOverflow,
  expectWithinViewport,
  loginTeacher,
  registerTeacher
} from './helpers.js';

function groupRegion(page, name) {
  return page.getByRole('region', { name: '模块分组：' + name });
}

test('teacher can persist empty workspace groups through the sidebar and settings', async ({ page, browser }, testInfo) => {
  const account = accountFor('empty-layout', testInfo, 'empty layout password');
  await registerTeacher(page, account);

  await page.getByLabel('新分组名称').fill('第一组');
  await page.getByRole('button', { name: '创建分组' }).click();
  await page.getByLabel('新分组名称').fill('第二组');
  await page.getByRole('button', { name: '创建分组' }).click();

  await groupRegion(page, '第一组').getByLabel('重命名分组 第一组').fill('近期安排');
  await groupRegion(page, '第一组').getByLabel('重命名分组 第一组').press('Enter');
  await expect(groupRegion(page, '近期安排')).toBeVisible();

  await groupRegion(page, '第二组').getByLabel('拖动分组 第二组').dragTo(
    groupRegion(page, '近期安排').getByRole('list')
  );
  const groupNames = await page.getByRole('region').evaluateAll((regions) => regions
    .map((region) => region.getAttribute('aria-label'))
    .filter((label) => label?.startsWith('模块分组：')));
  expect(groupNames).toEqual(['模块分组：第二组', '模块分组：近期安排']);

  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '工作台设置' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: '工作台首页' }).click();
  await expect(page.locator('[data-layout-module]')).toHaveCount(0);

  await groupRegion(page, '第二组').getByRole('button', { name: '删除分组 第二组' }).click();
  await expect(groupRegion(page, '第二组')).not.toBeVisible();
  await page.reload();
  await expect(groupRegion(page, '近期安排')).toBeVisible();
  await expect(page.locator('[data-layout-module]')).toHaveCount(0);

  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const otherPage = await otherContext.newPage();
  try {
    await otherPage.goto('/');
    await loginTeacher(otherPage, account);
    await expect(groupRegion(otherPage, '近期安排')).toBeVisible();
    await expect(otherPage.locator('[data-layout-module]')).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
});

test('empty workspace layout remains usable at a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerTeacher(page, accountFor('empty-layout-narrow', testInfo, 'narrow layout password'));

  await expectNoHorizontalOverflow(page);
  await page.getByLabel('新分组名称').fill('移动端分组');
  await expectWithinViewport(page, page.getByRole('button', { name: '创建分组' }));
  await page.getByRole('button', { name: '创建分组' }).click();
  await expect(groupRegion(page, '移动端分组')).toBeVisible();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '工作台设置' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
