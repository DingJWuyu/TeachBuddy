import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { convertFile } from '../../../../api/src/workbench/files/converter.js';
import { execFileSync } from 'node:child_process';
const destination = path.resolve(process.env.PAGINATION_EVIDENCE);
fs.mkdirSync(destination, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(process.env.PAGINATION_ORIGIN ?? 'https://127.0.0.1:49644');
  await page.getByLabel('邮箱', { exact: true }).fill(process.env.PAGINATION_EMAIL);
  await page.getByLabel('密码', { exact: true }).fill(process.env.PAGINATION_PASSWORD);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  await page.locator('.wb-sidebar').getByRole('link', { name: '备课', exact: true }).click();
  await page.getByRole('button', { name: /R35 丢响应后保留/ }).click();
  const historyResponse = page.waitForResponse(r => r.request().method() === 'GET' && r.url().endsWith('/exports'));
  await page.getByRole('button', { name: '输出', exact: true }).click();
  const history = await (await historyResponse).json();
  await expect(page.locator('.r34-output-list article')).toHaveCount(history.items.length);
  const kind = process.env.PAGINATION_KIND ?? 'practice';
  const format = process.env.PAGINATION_FORMAT ?? 'pdf';
  await page.getByRole('combobox', { name: '成果', exact: true }).selectOption(kind);
  await page.getByRole('combobox', { name: '格式', exact: true }).selectOption(format);
  await expect(page.getByLabel('作答空白行')).toHaveValue('4');
  const previousCount = await page.locator('.r34-output-list article').count();
  const accepted = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/exports'));
  await page.getByRole('button', { name: '保存并生成', exact: true }).click();
  const record = await (await accepted).json();
  fs.writeFileSync(path.join(destination, 'export.json'), JSON.stringify(record, null, 2));
  expect(record.options).toMatchObject({ answerSpaceLines: 4, includeAnswers: false, includeTeacherNotes: false });
  await expect(page.locator('.r34-output-list article')).toHaveCount(previousCount + 1);
  const output = page.locator('.r34-output-list article').first();
  await expect(output.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 60000 });
  const download = page.waitForEvent('download');
  await output.getByRole('button', { name: '下载', exact: true }).click();
  const downloaded = path.join(destination, `${kind}.${format}`);
  await (await download).saveAs(downloaded);
  const pdf = path.join(destination, `${kind}.pdf`);
  if (format === 'docx') {
    const converted = await convertFile({ bytes: fs.readFileSync(downloaded), mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', directory: path.join(destination, 'conversions') });
    fs.writeFileSync(pdf, converted.pdf);
  }
  await output.getByRole('button', { name: '预览成品', exact: true }).click();
  await expect(page.getByAltText('成品第 1 页')).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: path.join(destination, 'output-ui.png') });
  const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
  const count = Number(info.match(/Pages:\s+(\d+)/)[1]);
  execFileSync('pdftoppm', ['-scale-to', '1100', '-png', pdf, path.join(destination, 'page')]);
  const blankPages = [];
  for (let number = 1; number <= count; number++) {
    const { channels } = await sharp(path.join(destination, `page-${String(number).padStart(String(count).length, "0")}.png`)).stats();
    if (channels.every(channel => channel.min === 255)) blankPages.push(number);
  }
  const result = { pages: count, blankPages, browser: await browser.version(), identity: 'real-auth, copied retained database, fresh UI login' };
  fs.writeFileSync(path.join(destination, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  expect(blankPages, '默认练习不应有纯空白页').toEqual([]);
} finally { await browser.close(); }
