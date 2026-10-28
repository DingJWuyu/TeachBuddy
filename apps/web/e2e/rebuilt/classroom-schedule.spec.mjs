import { test, expect, register, navigate, onNewDevice } from './fixture.mjs';

test('班级学生和自由记录经过保存、离开与刷新仍归属正确', async ({ page, world }) => {
  await register(page, world);
  await navigate(page, '/classroom');
  await page.getByRole('button', { name: '新建班级', exact: true }).first().click();
  await page.getByLabel('班级名称').fill('高一二班');
  await page.getByRole('button', { name: '创建班级', exact: true }).click();
  await page.getByRole('tab', { name: '学生', exact: true }).click();
  await page.getByRole('button', { name: '添加学生', exact: true }).first().click();
  await page.getByLabel('姓名', { exact: true }).fill('林同学');
  await page.getByRole('dialog').getByRole('textbox', { name: '学号 选填', exact: true }).fill('002');
  await page.getByRole('button', { name: '添加', exact: true }).click();
  await page.getByRole('tab', { name: '记录', exact: true }).click();
  await page.getByRole('textbox', { name: /今天讲到哪里了/ }).fill('下一节课用图像讨论函数最值。');
  await page.getByRole('button', { name: '记下', exact: true }).click();
  await expect(page.locator('.cr-entry-card')).toContainText('下一节课用图像讨论函数最值。');
  await navigate(page, '/questions');
  await navigate(page, '/classroom');
  await page.reload();
  await expect(page.getByRole('heading', { name: '高一二班', exact: true })).toBeVisible();
  await expect(page.locator('.cr-entry-card')).toContainText('下一节课用图像讨论函数最值。');
  await page.getByRole('tab', { name: '学生', exact: true }).click();
  await expect(page.locator('.cr-roster')).toContainText('林同学');
  await page.getByRole('button', { name: '考试', exact: false }).first().click();
  await expect(page.getByRole('button', { name: '新建考试', exact: true }).first()).toBeVisible();
});

test('日程待安排转成定时任务，事项完成与时间刷新后保留', async ({ page, world }) => {
  await register(page, world);
  await navigate(page, '/calendar');
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('准备函数课');
  await page.getByRole('textbox', { name: '标题', exact: true }).press('Enter');
  await page.getByRole('textbox', { name: '添加事项', exact: true }).fill('整理例题');
  await page.getByRole('textbox', { name: '添加事项', exact: true }).press('Enter');
  const completedSave = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/api/modules/schedule/entries/') && response.ok());
  await page.locator('button[aria-label="完成"][aria-pressed]').click();
  await completedSave;
  await expect(page.getByRole('button', { name: '标为未完成', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tbx-sheet')).toContainText('自动保存');
  const arrangedSave = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/api/modules/schedule/entries/') && response.ok());
  await page.getByRole('button', { name: '放进日历，变成任务', exact: true }).click();
  await arrangedSave;
  await expect(page.getByRole('button', { name: '开始时间', exact: true })).toBeVisible();
  await navigate(page, '/resources');
  await navigate(page, '/calendar');
  await page.reload();
  await expect(page.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('准备函数课');
  await expect(page.getByRole('textbox', { name: '事项 1', exact: true })).toHaveValue('整理例题');
  await expect(page.getByRole('button', { name: '标为未完成', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await onNewDevice(page, world, async fresh => {
    await navigate(fresh, '/calendar');
    await fresh.getByText('准备函数课', { exact: true }).filter({ visible: true }).first().click();
    await expect(fresh.getByRole('button', { name: '开始时间', exact: true })).toBeVisible();
    await expect(fresh.getByRole('textbox', { name: '事项 1', exact: true })).toHaveValue('整理例题');
    await expect(fresh.getByRole('button', { name: '标为未完成', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});
