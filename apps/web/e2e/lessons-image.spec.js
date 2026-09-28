import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, doc } from '../../api/test/teaching-time-classes-materials-fixture.js';
import { loadRegionReplay, blankCells } from '../../api/test/fixtures/lessons-region-replay.js';
import { images } from '../../api/src/modules/questions/materials-content.js';

// Public UI and HTTP against an isolated account. Parent machine result is
// seeded from genuine E7 evidence; child recognizer replays a digest-bound raw
// response through actual Jobs. This proves adoption/recovery, not a model run.
test.beforeEach(() => {
  test.skip(!process.env.LESSONS_REGION_REPLAY_ROOT, 'Requires genuine E7 replay evidence');
  expect(process.env.WORKBENCH_WEB_DIST).toBeTruthy();
});
let world;
test.afterEach(async ({ context }, info) => {
  await context.close(); await world?.close();
  if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});
async function setup(page, info) {
  const replay = loadRegionReplay();
  world = await createIntegration({ workbench: { recognition: { home: null, recognizer: replay.recognizer } } });
  fs.writeFileSync(info.outputPath('instance.json'), JSON.stringify({ directory: world.directory, mode: 'recorded-raw-replay', modelCalls: 0 }));
  const email = 'lesson-image-ui@example.test';
  const { client, session } = await registerMath(world, email), call = http(client);
  const { parent } = replay.seed(world, session.account.accountKey);
  const resource = await call('POST', '/api/modules/resources/items', { title: 'E7 教学资料', fileId: replay.binding.fileId, folderId: null, tagIds: [], note: '' }, 201);
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '配图表格课稿', intro: doc('保留原课稿'), sections: [], materials: [] }, 201);
  await page.goto(`${world.origin}/lessons/${lesson.id}`);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const coach = page.getByRole('button', { name: '知道了', exact: true }); if (await coach.count()) await coach.click();
  await page.goto(`${world.origin}/lessons/${lesson.id}`);
  await page.getByRole('button', { name: '编辑备课', exact: true }).click();
  await page.getByRole('button', { name: '从资料提取正文', exact: true }).click();
  await page.getByRole('button', { name: resource.title, exact: true }).click();
  await page.getByRole('button', { name: '预览并选择一页', exact: true }).click();
  for (let i = 1; i < 7; i++) await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByRole('img', { name: '资料第 7 页', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '提取这一页', exact: true }).click();
  await expect(page.getByLabel('提取后的环节名称', { exact: true })).toBeVisible();
  expect(replay.replays).toBe(0);
  const imageNumber = [...new Set(images(parent.document))].indexOf(replay.imageId) + 1;
  expect(imageNumber).toBeGreaterThan(0);
  return { replay, call, lesson, parent, imageNumber };
}
async function selectImage(page, number) {
  const disclosure = page.getByRole('button', { name: '识别配图中的文字或表格', exact: true });
  if (await disclosure.getAttribute('aria-expanded') !== 'true') await disclosure.click();
  await page.getByRole('button', { name: `选择配图 ${number}`, exact: true }).click();
}
async function loseFirstResponse(page, pattern) {
  const requests = [];
  await page.route(pattern, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (requests.length === 1) { await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  return requests;
}

test('配图：E7 真实结果回放，预览/识别/采用丢失回执，独立表格与父稿保存，Word/PDF', async ({ page }, info) => {
  test.setTimeout(180000);
  const { replay, call, lesson, parent, imageNumber } = await setup(page, info);
  await page.getByLabel('提取后的环节名称', { exact: true }).fill('整页校对稿保留');
  const editor = page.locator('[data-document-editor="识别正文"]');
  await editor.getByRole('button', { name: '插入内容', exact: true }).click();
  await page.getByRole('menuitem', { name: '段落', exact: true }).click();
  await page.getByLabel('识别正文段落 1', { exact: true }).fill('这段整页校对不能被配图覆盖');
  const previewRequests = await loseFirstResponse(page, `**/files/${replay.imageId}/preview`);
  await selectImage(page, imageNumber);
  await expect(page.getByRole('button', { name: '重试确认预览', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '重试确认预览', exact: true }).click();
  await expect(page.getByRole('button', { name: '校对这张配图', exact: true })).toBeEnabled();
  expect(previewRequests).toHaveLength(2); expect(previewRequests[1]).toEqual(previewRequests[0]);
  await page.getByRole('button', { name: '校对这张配图', exact: true }).click();
  const recognitionRequests = await loseFirstResponse(page, `**/files/${replay.imageId}/recognition`);
  await page.getByRole('button', { name: '识别这张图', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认识别请求', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '确认识别请求', exact: true }).click();
  await expect(page.getByLabel('提取后的环节名称', { exact: true })).toBeVisible();
  expect(recognitionRequests).toHaveLength(2); expect(recognitionRequests[1]).toEqual(recognitionRequests[0]);
  expect(replay.replays).toBe(1);
  const table = page.locator('[data-document-editor="识别正文"] table').first();
  await expect(table.locator('tbody > tr')).toHaveCount(3);
  for (const row of await table.locator('tbody > tr').all()) await expect(row.locator(':scope > td')).toHaveCount(10);
  const targetCell = table.locator('tbody > tr').nth(1).locator(':scope > td').nth(2);
  await targetCell.getByRole('button', { name: '段落', exact: true }).click();
  const cell = targetCell.locator('textarea').first();
  await expect(cell).toHaveValue(''); await cell.click(); await expect(cell).toBeFocused(); await cell.pressSequentially('9');
  await page.getByLabel('提取后的环节名称', { exact: true }).fill('独立数值表');
  await page.reload(); await expect(cell).toHaveValue('9');
  await page.getByRole('button', { name: '返回整页校对', exact: true }).click();
  await expect(page.getByLabel('提取后的环节名称', { exact: true })).toHaveValue('整页校对稿保留');
  await expect(page.getByLabel('识别正文段落 1', { exact: true })).toHaveValue('这段整页校对不能被配图覆盖');
  await selectImage(page, imageNumber);
  await expect(cell).toHaveValue('9'); expect(replay.replays).toBe(1);
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('link', { name: /账户：/ }).click();
    await page.getByRole('button', { name: theme === 'dark' ? '深色' : '浅色', exact: true }).click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', theme);
    await page.goto(`${world.origin}/lessons/${lesson.id}`);
    await expect(cell).toHaveValue('9');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: '加入为教学环节', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`table-${theme}-${width}.png`), animations: 'disabled' });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const adoptionRequests = await loseFirstResponse(page, '**/sections/adopt-page');
  await page.getByRole('button', { name: '加入为教学环节', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认加入结果', exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '确认加入结果', exact: true }).click();
  await expect(page.locator('.lesson-page-import')).toHaveCount(0);
  expect(adoptionRequests).toHaveLength(2); expect(adoptionRequests[1]).toEqual(adoptionRequests[0]);
  const saved = await call('GET', `/api/modules/lessons/v3/${lesson.id}`);
  expect(saved.sections).toHaveLength(1); expect(blankCells(saved.sections[0].content)).toBe(13);
  const expected = structuredClone(replay.child.document); expected.blocks[0].rows[1][2].blocks = doc('9').blocks;
  expect(saved.sections[0].content).toEqual(expected);
  expect(saved.sections[0].pageSource.machineDocument).toEqual(parent.document);
  expect(saved.sections[0].pageSource.recognizedImage.machineDocument).toEqual(replay.child.document);
  expect(saved.sections[0].pageSource.page).toBe(7);
  await page.reload(); await expect(page.locator('[data-section-id]')).toHaveCount(1);
  await page.getByRole('button', { name: '查看导入原稿', exact: true }).click();
  for (const title of ['查看原页', '查看所选配图', '配图机器识别原文', '整页机器识别原文'])
    await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByRole('img', { name: '导入原稿第 7 页', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '原稿第 7 页中的配图', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('provenance.png'), animations: 'disabled' });
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
    const download = page.waitForEvent('download'); await row.getByRole('button', { name: '下载', exact: true }).click();
    const output = info.outputPath(`table.${format}`); await (await download).saveAs(output);
    if (format === 'docx') {
      const zip = await JSZip.loadAsync(fs.readFileSync(output)), xml = await zip.file('word/document.xml').async('string');
      expect(xml.match(/<w:tr>/g)).toHaveLength(3); expect(xml.match(/<w:tc>/g)).toHaveLength(30);
      expect(xml).toContain('<m:oMath'); expect(xml).toContain('>9<');
    } else {
      const text = execFileSync('pdftotext', ['-layout', output, '-'], { encoding: 'utf8' });
      expect(text).toContain('独立数值表'); expect(text).toContain('9'); expect(text).toContain('-3');
      expect(text.split('\n').some(line => line.includes('-3') && line.includes('-2') && line.includes('-1')),
        'Numeric columns must stay on the same row after real Office conversion').toBe(true);
      expect(text).toMatch(/f\s*\(\s*x\s*\)\s*=\s*x\s+\.\.\./);
      expect(execFileSync('pdfinfo', [output], { encoding: 'utf8' })).toMatch(/Pages:\s+1\b/);
      execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '1600', '-png', output, info.outputPath('table-pdf')]);
    }
    await row.getByRole('button', { name: '预览成品', exact: true }).click();
    await expect(page.getByRole('img', { name: '成品第 1 页', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`preview-${format}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: '关闭预览', exact: true }).click();
  }
  fs.writeFileSync(info.outputPath('saved.json'), JSON.stringify(saved, null, 2));
  await page.getByRole('button', { name: '返回课稿', exact: true }).click();
  await page.getByRole('button', { name: '从资料提取正文', exact: true }).click();
  await expect(page.getByLabel('提取后的环节名称', { exact: true })).toHaveValue('整页校对稿保留');
  await expect(page.getByLabel('识别正文段落 1', { exact: true })).toHaveValue('这段整页校对不能被配图覆盖');
  expect(replay.replays).toBe(1);
});

test('配图恢复：停止回执丢失后刷新确认，返回整页保留校对并可重新识别', async ({ page }, info) => {
  const { replay, imageNumber, call, lesson } = await setup(page, info);
  replay.beforeReplay = ({ signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  await page.getByLabel('提取后的环节名称', { exact: true }).fill('父稿保持');
  await selectImage(page, imageNumber);
  await page.getByRole('button', { name: '校对这张配图', exact: true }).click();
  await page.getByRole('button', { name: '识别这张图', exact: true }).click();
  await expect.poll(() => replay.replays).toBe(1);
  const cancel = await loseFirstResponse(page, '**/api/workbench/jobs/*/cancel');
  await page.getByRole('button', { name: '停止识别', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认停止结果', exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: '确认停止结果', exact: true }).click();
  await expect(page.getByText('识别已停止，原资料和课稿仍保留。', { exact: true })).toBeVisible();
  expect(cancel).toHaveLength(2); expect(cancel[1]).toEqual(cancel[0]);
  await page.getByRole('button', { name: '返回整页校对', exact: true }).click();
  await expect(page.getByLabel('提取后的环节名称', { exact: true })).toHaveValue('父稿保持');
  await selectImage(page, imageNumber);
  replay.beforeReplay = null;
  await page.getByRole('button', { name: '重新识别这张图', exact: true }).click();
  await expect(page.getByLabel('提取后的环节名称', { exact: true })).toBeVisible();
  expect(replay.replays).toBe(2);
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('recovered.png'), animations: 'disabled' });
});
