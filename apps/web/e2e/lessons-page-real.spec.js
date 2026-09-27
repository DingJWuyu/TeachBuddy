import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http } from '../../api/test/teaching-time-classes-materials-fixture.js';

// Opt-in only after the coordinator releases the GPU and supplies the production
// runtime. There is no recognizer substitute, seeded OCR result or HTTP mock.
test('真实 OCR：I1 原页校对后保存刷新，并下载可编辑 Word 与 PDF', async ({ page, context }, info) => {
  test.skip(process.env.LESSONS_REAL_OCR !== '1', '等待共享真实 runtime 与 GPU 执行授权');
  test.setTimeout(600000);
  for (const name of ['WORKBENCH_WEB_DIST', 'MATERIALS_OCR_HOME', 'LESSONS_OCR_INPUT', 'MATERIALS_PANDOC_PATH'])
    if (!process.env[name]) throw new Error(`Missing ${name}`);
  const input = path.resolve(process.env.LESSONS_OCR_INPUT);
  const sha256 = createHash('sha256').update(fs.readFileSync(input)).digest('hex');
  expect(sha256).toBe('01e9e0e7b5b2aba69ade66c7b8241276ac1560cac53f183d77e046e850a0eba7');
  const world = await createIntegration();
  fs.writeFileSync(info.outputPath('test-instance.json'), JSON.stringify({ directory: world.directory, origin: world.origin }, null, 2));
  let passed = false;
  try {
    const email = 'lesson-page-real@example.test';
    const { client } = await registerMath(world, email), call = http(client);
    await page.goto(`${world.origin}/resources`);
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill('math-password');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.wb-shell')).toBeVisible();
    const coach = page.getByRole('button', { name: '知道了', exact: true });
    if (await coach.count()) await coach.click();
    await page.goto(`${world.origin}/resources`);
    await page.getByLabel('上传第一份资料', { exact: true }).setInputFiles(input);
    await expect(page.locator('.res-status')).toContainText('文件已保存');
    await expect(page.getByAltText('第 1 页', { exact: true })).toBeVisible();
    const resources = (await call('GET', '/api/modules/resources/items?state=active')).items;
    expect(resources).toHaveLength(1);
    const resource = resources[0];
    const source = await call('GET', `/api/modules/resources/items/${resource.id}/for-reference`);
    const preview = await call('GET', `/api/workbench/files/${source.snapshot.fileId}/preview`);
    const status = await call('GET', `/api/workbench/files/${source.snapshot.fileId}/recognition?renditionFileId=${preview.renditionFileId}`);
    expect(status.available, '真实运行环境必须已启用，不能以未识别状态通过').toBe(true);
    expect(status.pages[0].state, '独立账户必须实际识别新上传的页').toBe('unprocessed');

    await page.getByRole('complementary', { name: '工作台导航' }).getByRole('link', { name: /^备课/ }).click();
    await page.getByRole('button', { name: '新建备课', exact: true }).click();
    await page.getByLabel('课题', { exact: true }).fill('扫描资料真实校对');
    await page.getByRole('button', { name: '从资料提取正文', exact: true }).click();
    await page.getByRole('button', { name: resource.title, exact: true }).click();
    await page.getByRole('button', { name: '预览并选择一页', exact: true }).click();
    await expect(page.getByRole('img', { name: '资料第 1 页', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('original-page.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '提取这一页', exact: true }).click();
    const started = Date.now();
    await page.getByRole('button', { name: '识别这一页', exact: true }).click();
    await expect(page.getByLabel('提取后的环节名称', { exact: true })).toBeVisible({ timeout: 300000 });
    const machine = await call('GET', `/api/workbench/files/${source.snapshot.fileId}/recognition/pages/1?renditionFileId=${preview.renditionFileId}`);
    expect(machine.state).toBe('ready'); expect(machine.document.version).toBe(2);
    expect(machine.text).toContain('定义域'); expect(machine.text).toContain('零点');
    expect(JSON.stringify(machine.document)).toContain('"type":"math"');
    expect(machine.assetFileIds.length).toBeGreaterThan(0);
    fs.writeFileSync(info.outputPath('machine-page.json'), JSON.stringify({ input, sha256, durationMs: Date.now() - started, result: machine }, null, 2));
    const raw = await client.request('GET', `/api/workbench/files/${machine.rawFileId}/content`);
    expect(raw.status, raw.text).toBe(200); fs.writeFileSync(info.outputPath('raw-ocr.json'), raw.text);
    const figures = page.locator('[data-document-editor="识别正文"] img');
    expect(await figures.count()).toBeGreaterThan(0);
    for (let i = 0; i < await figures.count(); i++) {
      await figures.nth(i).scrollIntoViewIfNeeded();
      await figures.nth(i).screenshot({ path: info.outputPath(`recognized-figure-${i + 1}.png`) });
    }
    await page.screenshot({ path: info.outputPath('machine-before-review.png'), fullPage: true, animations: 'disabled' });

    const marker = '教师校对确认';
    await page.getByLabel('提取后的环节名称', { exact: true }).fill('从扫描页采用');
    const paragraph = page.getByLabel('识别正文段落 1', { exact: true });
    await paragraph.click(); await paragraph.press('ControlOrMeta+End'); await paragraph.press('Enter');
    await paragraph.pressSequentially(marker);
    // Explicit teacher addition, kept separate from machine-page.json.
    const editor = page.locator('[data-document-editor="识别正文"]');
    await editor.getByRole('button', { name: '插入内容', exact: true }).click();
    await page.getByRole('menuitem', { name: '公式', exact: true }).click();
    await editor.getByRole('group', { name: /识别正文公式 .*内容块/ }).last().getByRole('textbox').fill('x=\\frac{1}{2}');
    await page.getByRole('button', { name: '加入为教学环节', exact: true }).click();
    await expect(page.locator('[data-section-id]')).toHaveCount(1);
    const lessonId = page.url().split('/').at(-1);
    const adopted = await call('GET', `/api/modules/lessons/v3/${lessonId}`);
    expect(adopted.sections[0].pageSource.machineDocument).toEqual(machine.document);
    expect(adopted.sections[0].pageSource.adoptedDocument).toEqual(adopted.sections[0].content);
    expect(adopted.sections[0].pageSource.fileId).toBe(source.snapshot.fileId);
    expect(JSON.stringify(adopted.sections[0].content)).toContain(marker);
    await page.reload();
    await expect(page.locator('[data-section-id]')).toHaveCount(1);
    expect((await call('GET', `/api/modules/lessons/v3/${lessonId}`)).sections).toEqual(adopted.sections);
    expect((await call('GET', `/api/modules/lessons/v3/${lessonId}/history/${adopted.version}`)).sections).toEqual(adopted.sections);
    await page.getByRole('button', { name: '查看导入原稿', exact: true }).click();
    await page.getByRole('button', { name: '查看原页', exact: true }).click();
    await expect(page.getByRole('img', { name: '导入原稿第 1 页', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('saved-source.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '生成教学资料', exact: true }).click();
    for (const format of ['docx', 'pdf']) {
      await page.getByRole('radio', { name: /^教案/ }).check();
      await page.getByRole('radio', { name: format === 'docx' ? /^Word/ : /^PDF/ }).check();
      const count = await page.locator('.r34-output-list article').count();
      await page.getByRole('button', { name: '保存并生成', exact: true }).click();
      await expect(page.locator('.r34-output-list article')).toHaveCount(count + 1);
      const row = page.locator('.r34-output-list article').first();
      await expect(row.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 60000 });
      const downloading = page.waitForEvent('download');
      await row.getByRole('button', { name: '下载', exact: true }).click();
      const output = info.outputPath(`recognized.${format}`);
      await (await downloading).saveAs(output);
      if (format === 'docx') {
        const zip = await JSZip.loadAsync(fs.readFileSync(output)), xml = await zip.file('word/document.xml').async('string');
        expect(xml).toContain(marker); expect(xml).toContain('<m:oMath'); expect(xml).toContain('<w:drawing>');
        expect(execFileSync(process.env.MATERIALS_PANDOC_PATH, ['-f', 'docx', '-t', 'json', output], { encoding: 'utf8' })).toContain('"Math"');
      } else {
        expect(execFileSync('pdftotext', ['-layout', output, '-'], { encoding: 'utf8' })).toContain(marker);
        expect(execFileSync('pdfimages', ['-list', output], { encoding: 'utf8' })).toMatch(/image/);
        execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '1600', '-png', output, info.outputPath('recognized-page1')]);
      }
      await row.getByRole('button', { name: '预览成品', exact: true }).click();
      await expect(page.getByRole('img', { name: '成品第 1 页', exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`preview-${format}.png`), animations: 'disabled' });
      await page.getByRole('button', { name: '关闭预览', exact: true }).click();
    }
    fs.writeFileSync(info.outputPath('adopted-lesson.json'), JSON.stringify(adopted, null, 2));
    passed = true;
  } finally {
    await context.close(); await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
