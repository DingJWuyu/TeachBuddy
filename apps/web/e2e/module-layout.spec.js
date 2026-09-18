import { expect, test } from '@playwright/test';
import {
  accountFor,
  expectNoHorizontalOverflow,
  expectWithinViewport,
  loginTeacher,
  registerTeacher
} from './helpers.js';

function moduleItem(page, title) {
  return page.getByRole('listitem').filter({ hasText: title });
}

function groupRegion(page, name) {
  return page.getByRole('region', { name: `模块分组：${name}` });
}

async function touchDrag(page, source, target) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const client = await page.context().newCDPSession(page);
  try {
    const sourcePoint = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
    const targetPoint = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...sourcePoint, id: 1 }]
    });
    await page.waitForTimeout(100);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...targetPoint, id: 1 }]
    });
    await page.waitForTimeout(100);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await client.detach();
  }
}

test('teacher can arrange grouped modules, preserve hidden placement, and persist after login', async ({ page, browser }, testInfo) => {
  const account = accountFor('module-layout', testInfo, 'module layout password');
  await registerTeacher(page, account);

  await page.getByLabel('新分组名称').fill('备课组');
  await page.getByRole('button', { name: '创建分组' }).click();
  await page.getByLabel('新分组名称').fill('内容组');
  await page.getByRole('button', { name: '创建分组' }).click();

  await groupRegion(page, '备课组').getByLabel('重命名分组 备课组').fill('规划');
  await groupRegion(page, '备课组').getByLabel('重命名分组 备课组').press('Enter');
  await expect(groupRegion(page, '规划')).toBeVisible();

  await groupRegion(page, '内容组').getByLabel('拖动分组 内容组').dragTo(groupRegion(page, '规划').getByRole('list'));
  const groupNames = await page.getByRole('region').evaluateAll((regions) => regions
    .map((region) => region.getAttribute('aria-label'))
    .filter((label) => label?.startsWith('模块分组：')));
  expect(groupNames).toEqual(['模块分组：内容组', '模块分组：规划']);

  await moduleItem(page, '备课规划').getByLabel('拖动此模块').dragTo(groupRegion(page, '规划').getByRole('list'));
  await moduleItem(page, '排课管理').getByRole('combobox').selectOption({ label: '规划' });
  await moduleItem(page, '排课管理').getByRole('button', { name: '上移模块' }).click();
  await moduleItem(page, '资源库').getByRole('combobox').selectOption({ label: '内容组' });

  const planningItems = await groupRegion(page, '规划').getByRole('listitem').allTextContents();
  expect(planningItems[0]).toContain('排课管理');
  expect(planningItems[1]).toContain('备课规划');
  await expect(groupRegion(page, '内容组').getByRole('listitem').filter({ hasText: '资源库' })).toBeVisible();

  await page.getByRole('button', { name: '设置' }).click();
  const lessonVisibility = page.getByRole('checkbox', { name: '备课规划', exact: true });
  await lessonVisibility.uncheck();
  await expect(lessonVisibility).not.toBeChecked();
  await expect(page.locator('aside').getByRole('button', { name: '备课规划', exact: true })).not.toBeVisible();
  await lessonVisibility.check();
  await expect(lessonVisibility).toBeChecked();
  await expect(page.locator('aside').getByRole('button', { name: '备课规划', exact: true })).toBeVisible();

  await groupRegion(page, '内容组').getByRole('button', { name: '删除分组 内容组' }).click();
  await expect(groupRegion(page, '内容组')).not.toBeVisible();
  await expect(page.getByRole('region', { name: '未分组模块' }).getByRole('listitem').filter({ hasText: '资源库' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: '设置' })).toBeVisible();
  await expect(groupRegion(page, '规划')).toBeVisible();
  await expect(groupRegion(page, '规划').getByRole('listitem').filter({ hasText: '排课管理' })).toBeVisible();
  await expect(groupRegion(page, '规划').getByRole('listitem').filter({ hasText: '备课规划' })).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await loginTeacher(page, account);
  await expect(groupRegion(page, '规划')).toBeVisible();
  await expect(groupRegion(page, '规划').getByRole('listitem').filter({ hasText: '排课管理' })).toBeVisible();

  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const otherPage = await otherContext.newPage();
  try {
    await otherPage.goto('/');
    await loginTeacher(otherPage, account);
    await expect(groupRegion(otherPage, '规划')).toBeVisible();
    await expect(groupRegion(otherPage, '规划').getByRole('listitem').filter({ hasText: '排课管理' })).toBeVisible();
    await expect(otherPage.getByRole('region', { name: '未分组模块' }).getByRole('listitem').filter({ hasText: '资源库' })).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test('module layout controls remain usable in a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerTeacher(page, accountFor('module-layout-narrow', testInfo, 'module narrow password'));

  await expectNoHorizontalOverflow(page);
  await page.getByLabel('新分组名称').fill('移动端分组');
  await expectWithinViewport(page, page.getByRole('button', { name: '创建分组' }));
  await page.getByRole('button', { name: '创建分组' }).click();
  await moduleItem(page, '提醒中心').getByRole('combobox').selectOption({ label: '移动端分组' });
  await expect(groupRegion(page, '移动端分组').getByRole('listitem').filter({ hasText: '提醒中心' })).toBeVisible();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('checkbox', { name: '提醒中心', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('group drag works with real touch input in a narrow viewport', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5183',
    viewport: { width: 390, height: 844 },
    hasTouch: true
  });
  const page = await context.newPage();
  try {
    await registerTeacher(page, accountFor('module-layout-touch', testInfo, 'module touch password'));

    await page.getByLabel('新分组名称').fill('第一组');
    await page.getByRole('button', { name: '创建分组' }).click();
    await page.getByLabel('新分组名称').fill('第二组');
    await page.getByRole('button', { name: '创建分组' }).click();

    await touchDrag(
      page,
      groupRegion(page, '第二组').getByLabel('拖动分组 第二组'),
      groupRegion(page, '第一组').getByRole('list')
    );

    const groupNames = await page.getByRole('region').evaluateAll((regions) => regions
      .map((region) => region.getAttribute('aria-label'))
      .filter((label) => label?.startsWith('模块分组：')));
    expect(groupNames).toEqual(['模块分组：第二组', '模块分组：第一组']);
  } finally {
    await context.close();
  }
});

test('workspace layout has no horizontal overflow on desktop and narrow screens', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await registerTeacher(page, accountFor('module-layout-visual', testInfo, 'layout visual password'));
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: '设置' }).click();
  await expectNoHorizontalOverflow(page);
  await expectWithinViewport(page, page.getByLabel('新分组名称'));
  await expectWithinViewport(page, page.getByRole('button', { name: '创建分组' }));
  await expectWithinViewport(page, page.getByRole('checkbox', { name: '资源库', exact: true }).last());
  await page.getByLabel('新分组名称').fill('视觉分组');
  await page.getByRole('button', { name: '创建分组' }).click();
  await expect(page.getByText('模块分组已创建。')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await expectWithinViewport(page, page.getByLabel('新分组名称'));
  await expectWithinViewport(page, page.getByRole('button', { name: '创建分组' }));
  await expectWithinViewport(page, page.getByRole('checkbox', { name: '资源库', exact: true }).last());
  await expect(page.getByRole('region', { name: '模块分组：视觉分组' })).toBeVisible();
});

test('sidebar stays fixed while its overflowing navigation scrolls independently', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await registerTeacher(page, accountFor('sidebar-scroll', testInfo, 'sidebar scroll password'));

  const sidebar = page.locator('aside');
  const navigation = page.getByRole('navigation', { name: '工作台导航' });
  const initialSidebarBox = await sidebar.boundingBox();
  expect(initialSidebarBox).not.toBeNull();
  const initialNavigationMetrics = await navigation.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    overflowY: getComputedStyle(node).overflowY
  }));
  expect(initialNavigationMetrics.overflowY).toBe('auto');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const afterPageScrollBox = await sidebar.boundingBox();
  expect(afterPageScrollBox).not.toBeNull();
  expect(afterPageScrollBox.y).toBeCloseTo(initialSidebarBox.y, 0);

  for (let index = 1; index <= 8; index += 1) {
    await page.getByLabel('新分组名称').fill(`滚动分组 ${index}`);
    await page.getByRole('button', { name: '创建分组' }).click();
  }

  const overflowingNavigationMetrics = await navigation.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    scrollTop: node.scrollTop,
    overflowY: getComputedStyle(node).overflowY
  }));
  expect(overflowingNavigationMetrics.scrollHeight).toBeGreaterThan(overflowingNavigationMetrics.clientHeight);
  expect(overflowingNavigationMetrics.overflowY).toBe('auto');

  await navigation.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect.poll(() => navigation.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  const afterNavigationScrollBox = await sidebar.boundingBox();
  expect(afterNavigationScrollBox).not.toBeNull();
  expect(afterNavigationScrollBox.y).toBeCloseTo(initialSidebarBox.y, 0);
  await expectNoHorizontalOverflow(page);
});
