import { test, expect, register, navigate } from './fixture.mjs';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

test('资源上传留在列表，信息修改经刷新读回并保留原件入口', async ({ page, world }, info) => {
  await register(page, world);
  await navigate(page, '/resources');
  await page.getByLabel('上传资料', { exact: true }).setInputFiles({ name: '函数讲义.png', mimeType: 'image/png', buffer: sourceImage('I-1') });
  await expect(page.getByText('文件已保存', { exact: false })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '资源名称', exact: true })).toHaveCount(0);
  await page.getByText('函数讲义.png', { exact: true }).first().click();
  await page.getByRole('textbox', { name: '资源名称', exact: true }).fill('函数备课资料');
  await page.getByRole('textbox', { name: '资源笔记', exact: true }).fill('用于讲解函数定义域。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '资源名称', exact: true })).toHaveValue('函数备课资料');
  await expect(page.getByRole('textbox', { name: '资源笔记', exact: true })).toHaveValue('用于讲解函数定义域。');
  await expect(page.getByRole('button', { name: '下载原件', exact: true })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: info.outputPath('resource-detail.png') });
});

test('数学未加入公式在跨模块和刷新后保留，返回取消不丢输入', async ({ page, world }) => {
  await register(page, world);
  await navigate(page, '/math');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: /写公式/ }).click();
  const formula = page.locator('math-field[aria-label="可视化公式输入"]');
  await formula.pressSequentially('x+1');
  const source = await formula.evaluate(el => el.value);
  expect(source).toContain('x');
  await navigate(page, '/questions');
  await navigate(page, '/math');
  await expect.poll(() => formula.evaluate(el => el.value)).toBe(source);
  await page.reload();
  await expect.poll(() => formula.evaluate(el => el.value)).toBe(source);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('还有内容未加入作品');
  await page.getByRole('alertdialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect.poll(() => formula.evaluate(el => el.value)).toBe(source);
});
