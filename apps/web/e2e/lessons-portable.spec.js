import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { doc, question, Q, http } from '../../api/test/teaching-time-classes-materials-fixture.js';

const base = '/api/modules/lessons/v3';
let world;
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});

test('设置导出课稿历史，离线取回正文公式及图片后保存刷新并输出', async ({ page, browser }, info) => {
  world = await createIntegration();
  const email = 'lesson-portable@example.test';
  const { client } = await registerMath(world, email);
  const call = http(client);
  const png = fs.readFileSync(new URL('./fixtures/materials-questions/figure.png', import.meta.url));
  const boundary = `portable-${randomUUID()}`;
  const upload = await client.request('POST', '/api/workbench/files', {
    headers: { 'Idempotency-Key': randomUUID() }, contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="history.png"\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from(`\r\n--${boundary}--\r\n`)]),
  });
  expect(upload.status, upload.text).toBe(201);
  const text = '旧稿独有：先观察图像，再讨论定义域。';
  const latex = 'y=\\frac{1}{x+3}';
  const picture = { type: 'image', fileId: upload.json.id, alt: '历史顺序配图', widthMm: 60 };
  const q = await call('POST', Q, { ...question('旧稿独有的例题'),
    body: { version: 2, blocks: [...doc('题干图片之前').blocks, picture, ...doc('题干图片之后').blocks] },
    solution: { version: 2, blocks: [...doc('答案图片之前').blocks, picture, ...doc('答案图片之后').blocks] },
    answerStatus: 'present',
  }, 201);
  const original = await call('POST', base, {
    title: '函数备课原稿', intro: { version: 2, blocks: [...doc(text).blocks, picture, ...doc('开头图片之后').blocks] }, materials: [],
    sections: [{ id: randomUUID(), title: '旧稿的讲解环节', content: { version: 2, blocks: [
      { type: 'math', latex }, { type: 'image', fileId: upload.json.id, alt: '历史独有配图', widthMm: 60 },
    ] }, references: [{ id: randomUUID(), kind: 'question', questionId: q.id, questionVersion: q.version, note: '原稿讲解备注', afterBlock: 1 }] }],
  }, 201);
  const current = await call('PUT', `${base}/${original.id}`, {
    baseVersion: original.version, title: '函数备课当前稿', intro: doc('当前稿不再包含旧稿材料'), sections: [], materials: [],
  });
  const archived = await call('POST', `${Q}/${q.id}/deletion`, { baseVersion: q.version, deleted: true });
  await call('POST', `${Q}/${q.id}/purge`, { baseVersion: archived.version });

  await page.goto(`${world.origin}/settings`);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
  await page.goto(`${world.origin}/settings`);
  await page.getByRole('button', { name: '导出数据', exact: true }).click();
  const downloadButton = page.getByRole('button', { name: '下载资料包', exact: true });
  await expect(downloadButton).toBeVisible({ timeout: 30000 });
  const downloading = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloading;
  const archivePath = info.outputPath('personal.zip');
  await download.saveAs(archivePath);
  await page.screenshot({ path: info.outputPath('settings-export.png') });
  const zip = await JSZip.loadAsync(fs.readFileSync(archivePath));
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const revisions = manifest.objects.filter(o => o.key.kind === 'lesson-revision' && o.key.id === original.id);
  expect(revisions.map(o => o.key.version).sort()).toEqual([1, 2]);
  const revision = revisions.find(o => o.key.version === 1);
  const data = JSON.parse(await zip.file(revision.dataPath).async('string')).value;
  expect(data.intro).toEqual(original.intro);
  expect(data.sections).toEqual((await call('GET', `${base}/${original.id}/history/1`)).sections);
  expect(data.savedAt).toBe(original.updatedAt);
  const attachment = manifest.objects.find(o => o.key.kind === 'file' && o.key.id === upload.json.id);
  const file = manifest.files.find(f => f.path.startsWith(`files/${upload.json.id}/`));
  expect(await zip.file(file.path).async('nodebuffer')).toEqual(png);
  expect(file.sha256).toBe(createHash('sha256').update(png).digest('hex'));

  const unpacked = info.outputPath('unpacked');
  for (const entry of Object.values(zip.files).filter(entry => !entry.dir)) {
    const target = path.resolve(unpacked, entry.name);
    expect(target.startsWith(`${unpacked}${path.sep}`)).toBe(true);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }
  const offline = await browser.newContext();
  let copiedText, copiedLatex;
  try {
    await offline.setOffline(true);
    const reader = await offline.newPage();
    await reader.goto(pathToFileURL(path.join(unpacked, 'index.html')).href);
    const historyLink = reader.locator(`a[href="${revision.readablePath}"]`);
    await expect(historyLink).toContainText('版本 1');
    await expect(historyLink).toContainText(data.savedAt);
    await historyLink.click();
    await expect(reader.getByRole('heading', { name: '函数备课原稿', exact: true })).toBeVisible();
    await expect(reader.getByRole('heading', { name: '旧稿的讲解环节', exact: true })).toBeVisible();
    await expect(reader.locator('body')).toContainText('原稿讲解备注');
    await reader.screenshot({ path: info.outputPath('offline-order.png'), fullPage: true });
    const readingOrder = locator => locator.locator('pre,img').evaluateAll(nodes => nodes.map(node => node.tagName === 'IMG' ? '[图片]' : node.textContent));
    const intro = reader.getByRole('heading', { name: '开头文稿', exact: true }).locator('..');
    expect(await readingOrder(intro)).toEqual([text, '[图片]', '开头图片之后']);
    const adopted = reader.getByRole('heading', { name: '旧稿独有的例题 · 采用版本 1', exact: true }).locator('..');
    expect((await readingOrder(adopted)).slice(0, 6)).toEqual([
      '题干图片之前', '[图片]', '题干图片之后', '答案图片之前', '[图片]', '答案图片之后',
    ]);
    copiedText = await reader.locator('pre').filter({ hasText: text }).first().innerText();
    copiedLatex = await reader.locator('pre').filter({ hasText: latex }).first().innerText();
    expect(copiedText.trim()).toBe(text);
    expect(copiedLatex.trim()).toBe(latex);
    await reader.screenshot({ path: info.outputPath('offline-history.png'), fullPage: true });
    await reader.setViewportSize({ width: 390, height: 844 });
    expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await reader.screenshot({ path: info.outputPath('offline-history-mobile.png'), fullPage: true });
    await reader.locator(`a[href="../${attachment.readablePath}"]`).first().click();
    await expect(reader.getByRole('link', { name: /下载原文件/ })).toHaveAttribute('href', `../${file.path}`);
    await reader.goto(pathToFileURL(path.join(unpacked, file.path)).href);
    await expect(reader.locator('img')).toBeVisible();
  } finally { await offline.close(); }

  await page.goto(`${world.origin}/lessons`);
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('从历史资料包取回的课稿');
  const editor = page.locator('.lesson-document-editor[data-document-editor="开头文稿"]');
  await page.getByLabel('开头文稿段落 1', { exact: true }).fill(copiedText);
  await editor.getByRole('button', { name: '插入内容', exact: true }).click();
  await page.getByRole('menuitem', { name: '公式', exact: true }).click();
  await editor.getByRole('group', { name: '开头文稿公式 1内容块', exact: true }).getByRole('textbox').fill(copiedLatex);
  await editor.getByRole('button', { name: '插入内容', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: '图片', exact: true }).click();
  await (await chooser).setFiles(path.join(unpacked, file.path));
  await expect(editor.locator('img')).toBeVisible();
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
  const restoredId = page.url().split('/').at(-1);
  expect(restoredId).not.toBe(original.id);
  await page.reload();
  if (await page.getByRole('button', { name: '编辑备课', exact: true }).count()) await page.getByRole('button', { name: '编辑备课', exact: true }).click();
  await expect(page.getByLabel('开头文稿段落 1')).toHaveValue(text);
  await expect(editor.getByRole('group', { name: '开头文稿公式 1内容块', exact: true }).getByRole('textbox')).toHaveValue(latex);
  await expect(editor.locator('img')).toBeVisible();
  const restored = await call('GET', `${base}/${restoredId}`);
  expect(restored.intro.blocks[2].fileId).not.toBe(upload.json.id);
  expect(await call('GET', `${base}/${original.id}`)).toEqual(current);
  await page.screenshot({ path: info.outputPath('retrieved-after-refresh.png') });

  await page.getByRole('button', { name: '生成教学资料', exact: true }).click();
  for (const format of ['docx', 'pdf']) {
    await page.getByRole('radio', { name: /^教案/ }).check();
    await page.getByRole('radio', { name: format === 'docx' ? /^Word/ : /^PDF/ }).check();
    const count = await page.locator('.r34-output-list article').count();
    await page.getByRole('button', { name: '保存并生成', exact: true }).click();
    await expect(page.locator('.r34-output-list article')).toHaveCount(count + 1);
    const row = page.locator('.r34-output-list article').first();
    await expect(row.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 60000 });
    const pending = page.waitForEvent('download');
    await row.getByRole('button', { name: '下载', exact: true }).click();
    const output = info.outputPath(`retrieved.${format}`);
    await (await pending).saveAs(output);
    if (format === 'docx') {
      const document = await JSZip.loadAsync(fs.readFileSync(output));
      const xml = await document.file('word/document.xml').async('string');
      expect(xml).toContain(text);
      expect(xml).toContain('<m:oMath');
      expect(xml).toContain('<m:f>');
      expect(xml).toContain('<w:drawing>');
      expect(execFileSync(process.env.MATERIALS_PANDOC_PATH || 'pandoc', ['-f', 'docx', '-t', 'json', output], { encoding: 'utf8' })).toContain('"Math"');
    } else {
      expect(execFileSync('pdftotext', ['-layout', output, '-'], { encoding: 'utf8' })).toContain('旧稿独有');
      expect(execFileSync('pdfimages', ['-list', output], { encoding: 'utf8' })).toMatch(/image/);
    }
  }
});
