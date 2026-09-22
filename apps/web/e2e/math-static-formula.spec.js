import { test, expect } from '@playwright/test';
test('formula from empty draft saves a rendered work', async ({ page }) => {
  await page.goto('/fixture/session');
  await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
  await page.getByLabel('LaTeX', { exact: true }).fill(String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`);
  await page.getByLabel('中文说明').fill('判别式决定实数根的个数');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('已保存');
  await expect(page.getByRole('img', { name: '当前公式预览' })).toBeVisible();
});
test('local font failure is visible and retry restores native preview', async ({ page }) => {
  let fail = true;
  await page.route('**/vendor/math/noto-sans-sc/files/*.woff', route => fail ? route.abort() : route.continue());
  await page.goto('/fixture/session');
  await page.getByRole('button', { name: '新建平面图形', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '重试字体', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '当前数学图形预览' })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: '重试字体', exact: true }).click();
  await expect(page.getByRole('img', { name: '当前数学图形预览' })).toBeVisible();
});
test('unclosed brace error locates the source selection', async ({ page }) => {
  await page.goto('/fixture/session');
  await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
  await page.getByLabel('LaTeX', { exact: true }).fill(String.raw`\frac{1`);
  await page.getByRole('button', { name: '定位到第 1 行第 6 列', exact: true }).click();
  expect(await page.getByLabel('LaTeX', { exact: true }).evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([5, 6]);
});
