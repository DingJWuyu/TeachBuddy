import XLSX from 'xlsx';
import { test, expect, register, navigate } from './fixture.mjs';

test('成绩表通过真实校对入库，零分与无总分在成绩页刷新后仍可区分', async ({ page, world }) => {
  await register(page, world);
  await navigate(page, '/classroom');
  await page.getByRole('button', { name: '新建班级', exact: true }).first().click();
  await page.getByLabel('班级名称').fill('高一成绩班');
  await page.getByRole('button', { name: '创建班级', exact: true }).click();
  await page.getByRole('tab', { name: '学生', exact: true }).click();
  for (const [name, number] of [['零同学', '001'], ['待核对同学', '002']]) {
    await page.getByRole('button', { name: '添加学生', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('姓名', { exact: true }).fill(name);
    await dialog.getByRole('textbox', { name: '学号 选填', exact: true }).fill(number);
    await dialog.getByRole('button', { name: '添加', exact: true }).click();
  }
  await page.getByRole('button', { name: '考试', exact: false }).first().click();
  await page.getByRole('button', { name: '新建考试', exact: true }).first().click();
  const exam = page.getByRole('dialog');
  await exam.getByLabel('考试名称', { exact: true }).fill('函数单元考试');
  await exam.getByRole('textbox', { name: '题数', exact: true }).fill('1');
  await exam.getByRole('textbox', { name: '每题满分', exact: true }).fill('10');
  await exam.getByRole('button', { name: '添加', exact: true }).click();
  await exam.getByRole('button', { name: '创建考试', exact: true }).click();
  await page.getByRole('button', { name: /高一成绩班/ }).click();
  await page.getByRole('tab', { name: '成绩', exact: true }).click();
  await page.getByRole('button', { name: '导入成绩', exact: true }).first().click();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['姓名', '学号', '总分', '第1题'], ['零同学', '001', 0, 0], ['待核对同学', '002', null, null],
  ]), '成绩');
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({
    name: '正式考试成绩.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  });
  await page.getByRole('button', { name: '生成校对表', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('没有需要处理的问题');
  await page.getByRole('button', { name: '确认入库', exact: true }).click();
  await expect(page.getByRole('heading', { name: '成绩已保存', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '看看成绩', exact: true }).click();
  await page.reload();
  const zero = page.locator('.cr-ranking li').filter({ hasText: '零同学' });
  const missing = page.locator('.cr-ranking li').filter({ hasText: '待核对同学' });
  await expect(zero.locator('.cr-ranking-score b')).toHaveText('0');
  await expect(missing).toBeVisible();
  await expect(missing.locator('.cr-ranking-score b')).toHaveText('-');
  await expect(missing.locator('.cr-rank')).toHaveText('-');
  await expect(page.getByText('无总分 1', { exact: false })).toBeVisible();
});
