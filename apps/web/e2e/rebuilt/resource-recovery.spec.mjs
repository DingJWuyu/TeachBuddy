import fs from 'node:fs';
import { test, expect, register, navigate } from './fixture.mjs';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

const image = (name, page) => ({ name, mimeType: 'image/png', buffer: sourceImage(page) });

test('B-R3 多文件原件与条目未知回执跨刷新恢复，错原件拒绝且已确认项不重复', async ({ page, world }) => {
  await register(page, world);
  await navigate(page, '/resources');
  const uploadWrites = [], itemWrites = [];
  let lostUpload = false, lostItem = false;
  await page.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname === '/api/workbench/files') {
      uploadWrites.push(request.headers()['idempotency-key']);
      if (uploadWrites.length === 2 && !lostUpload) {
        lostUpload = true; await route.fetch(); await route.abort('connectionreset'); return;
      }
    }
    if (request.method() === 'POST' && pathname === '/api/modules/resources/items') {
      itemWrites.push({ key: request.headers()['idempotency-key'], body: request.postData() });
      if (itemWrites.length === 2 && !lostItem) {
        lostItem = true; await route.fetch(); await route.abort('connectionreset'); return;
      }
    }
    await route.continue();
  });
  await page.getByLabel('上传资料', { exact: true }).setInputFiles([image('已确认原件.png', 'I-1'), image('待确认原件.png', 'I-2')]);
  await expect(page.getByRole('button', { name: '重试确认原请求', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('重新选择原文件', { exact: true })).toBeVisible();
  const wrongBytes = Buffer.from(sourceImage('I-2'));
  wrongBytes[wrongBytes.length - 5] ^= 1;
  await page.getByLabel('重新选择原文件', { exact: true }).setInputFiles({ name: '待确认原件.png', mimeType: 'image/png', buffer: wrongBytes });
  await expect(page.getByText(/文件名称、长度或内容不匹配/)).toBeVisible();
  expect(uploadWrites).toHaveLength(2);
  await page.getByLabel('重新选择原文件', { exact: true }).setInputFiles(image('待确认原件.png', 'I-2'));
  await expect(page.getByRole('button', { name: '重试确认原请求', exact: true })).toBeVisible();
  expect(uploadWrites[2]).toBe(uploadWrites[1]);
  await page.reload();
  await page.getByRole('button', { name: '重试确认原请求', exact: true }).click();
  await expect(page.getByText('已处理 2 / 2 份资料', { exact: true })).toBeVisible();
  expect(itemWrites).toHaveLength(3);
  expect(itemWrites[2]).toEqual(itemWrites[1]);
  await page.reload();
  await expect(page.locator('.tbx-res-card').filter({ hasText: '已确认原件.png' })).toHaveCount(1);
  await expect(page.locator('.tbx-res-card').filter({ hasText: '待确认原件.png' })).toHaveCount(1);
  await page.locator('.tbx-res-card').filter({ hasText: '待确认原件.png' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载原件', exact: true }).click();
  expect(fs.readFileSync(await (await downloading).path())).toEqual(sourceImage('I-2'));
});

test('B-R4 多页PDF由浏览器翻页并通过真实文字层选择复制第二页', async ({ page, context, world }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: world.origin });
  await register(page, world);
  await navigate(page, '/resources');
  await page.getByLabel('上传资料', { exact: true }).setInputFiles({
    name: '多页原题.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync('test/fixtures/questions/P.pdf'),
  });
  await expect(page.getByText('文件已保存', { exact: true })).toBeVisible();
  await page.getByText('多页原题.pdf', { exact: true }).first().click();
  await expect(page.locator('.res-pdf-text')).toContainText('Q1', { timeout: 30_000 });
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '跳转页码', exact: true })).toHaveValue('2');
  const layer = page.locator('.res-pdf-text');
  await expect(layer).toContainText('Q3');
  await expect(layer).toContainText('Q4');
  const selectable = layer.locator('span[role=presentation]').filter({ hasText: /^Q3\./ }).last();
  await selectable.click({ clickCount: 3 });
  await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toContain('Q3');
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Q3');
  await page.getByRole('button', { name: '复制本页文字', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('分段结构与不等号');
});
