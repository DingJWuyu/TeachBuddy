import { expect, test } from '@playwright/test';

async function registerTeacher(page, { name, email, password }) {
  await page.goto('/');
  await page.getByRole('button', { name: '注册' }).click();
  await page.getByLabel('显示名称').fill(name);
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码').fill(password);
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('button', { name: '工作台首页' })).toBeVisible();
}

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

test('teacher can arrange grouped modules, preserve hidden placement, and persist after login', async ({ page, browser }) => {
  await registerTeacher(page, {
    name: '模块布局教师',
    email: 'module.layout@example.test',
    password: 'module layout password'
  });

  await page.getByRole('button', { name: '设置' }).click();
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

  await moduleItem(page, '备课规划').dragTo(groupRegion(page, '规划').getByRole('list'));
  await moduleItem(page, '排课管理').dragTo(groupRegion(page, '规划').getByRole('list'));
  await moduleItem(page, '排课管理').dragTo(moduleItem(page, '备课规划'));
  await moduleItem(page, '资源库').dragTo(groupRegion(page, '内容组').getByRole('list'));

  const planningItems = await groupRegion(page, '规划').getByRole('listitem').allTextContents();
  expect(planningItems[0]).toContain('排课管理');
  expect(planningItems[1]).toContain('备课规划');
  await expect(groupRegion(page, '内容组').getByRole('listitem').filter({ hasText: '资源库' })).toBeVisible();

  const lessonVisibility = page.getByRole('checkbox', { name: '备课规划', exact: true });
  await lessonVisibility.uncheck();
  await expect(lessonVisibility).not.toBeChecked();
  await expect(page.locator('aside').getByRole('button', { name: /备课规划/ })).not.toBeVisible();
  await lessonVisibility.check();
  await expect(lessonVisibility).toBeChecked();
  await expect(page.locator('aside').getByRole('button', { name: /备课规划/ })).toBeVisible();

  await groupRegion(page, '内容组').getByRole('button', { name: '删除分组 内容组' }).click();
  await expect(groupRegion(page, '内容组')).not.toBeVisible();
  await expect(page.getByRole('region', { name: '未分组模块' }).getByRole('listitem').filter({ hasText: '资源库' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: '设置' })).toBeVisible();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(groupRegion(page, '规划')).toBeVisible();
  await expect(groupRegion(page, '规划').getByRole('listitem').filter({ hasText: '排课管理' })).toBeVisible();
  await expect(groupRegion(page, '规划').getByRole('listitem').filter({ hasText: '备课规划' })).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await page.getByLabel('邮箱').fill('module.layout@example.test');
  await page.getByLabel('密码', { exact: true }).fill('module layout password');
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(groupRegion(page, '规划')).toBeVisible();
  await expect(groupRegion(page, '规划').getByRole('listitem').filter({ hasText: '排课管理' })).toBeVisible();

  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5183' });
  const otherPage = await otherContext.newPage();
  try {
    await otherPage.goto('/');
    await otherPage.getByLabel('邮箱').fill('module.layout@example.test');
    await otherPage.getByLabel('密码', { exact: true }).fill('module layout password');
    await otherPage.getByRole('button', { name: '登录' }).click();
    await otherPage.getByRole('button', { name: '设置' }).click();
    await expect(groupRegion(otherPage, '规划')).toBeVisible();
    await expect(groupRegion(otherPage, '规划').getByRole('listitem').filter({ hasText: '排课管理' })).toBeVisible();
    await expect(otherPage.getByRole('region', { name: '未分组模块' }).getByRole('listitem').filter({ hasText: '资源库' })).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test('module layout controls remain usable in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await registerTeacher(page, {
    name: '窄屏布局教师',
    email: 'module.layout.narrow@example.test',
    password: 'module narrow password'
  });

  await page.getByRole('button', { name: '设置' }).click();
  await page.getByLabel('新分组名称').fill('移动端分组');
  await page.getByRole('button', { name: '创建分组' }).click();
  await moduleItem(page, '提醒中心').getByRole('combobox').selectOption({ label: '移动端分组' });
  await expect(groupRegion(page, '移动端分组').getByRole('listitem').filter({ hasText: '提醒中心' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '提醒中心', exact: true })).toBeVisible();
});

test('group drag works with real touch input in a narrow viewport', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5183',
    viewport: { width: 390, height: 844 },
    hasTouch: true
  });
  const page = await context.newPage();
  try {
    await registerTeacher(page, {
      name: '窄屏触控教师',
      email: 'module.layout.touch@example.test',
      password: 'module touch password'
    });

    await page.getByRole('button', { name: '设置' }).click();
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
