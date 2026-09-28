import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import sharp from 'sharp';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { moduleCatalog } from '@refatos/shared';
import { moduleImplementations } from '../../api/src/workbench/moduleImplementations.js';
import { prepareMathAssets } from '../../../scripts/math-support/prepare-assets.mjs';

const require = createRequire(import.meta.url);
const output = path.resolve('test-results/r31-math-support');
const webDist = path.join(output, 'web');
const evidence = path.resolve(process.env.R31_SUPPORT_EVIDENCE_DIR || path.join(output, 'evidence'));
test.beforeAll(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  await prepareMathAssets();
  await build({ configFile: false, root: path.resolve('apps/web/e2e/fixtures/r31-math-support'),
    publicDir: path.resolve('apps/web/public'), plugins: [react()], logLevel: 'warn',
    build: { outDir: webDist, emptyOutDir: true } });
});

test('local distribution renders MathJax and Chinese fonts in a network-disabled cold browser', async ({ browser }) => {
  const offline = path.join(output, 'offline');
  await prepareMathAssets(path.join(offline, 'vendor'));
  fs.writeFileSync(path.join(offline, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
    <link rel="stylesheet" href="vendor/noto-sans-sc/400.css">
    <style>body {padding:32px;font:24px 'Noto Sans SC';} mjx-container {font-size:160%;}</style>
    <p>函数图像与中文说明：顶点、零点、三角形</p><div id="formula"></div>
    <script>MathJax={loader:{load:['input/tex','output/svg']},svg:{fontCache:'none'},startup:{typeset:false}};</script>
    <script src="vendor/mathjax-3.2.2/tex-svg.js"></script></html>`);
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  const remote = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
  try {
    await page.goto(pathToFileURL(path.join(offline, 'index.html')).href);
    const result = await page.evaluate(async () => {
      await MathJax.startup.promise;
      document.querySelector('#formula').textContent = String.raw`\[x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}\]`;
      await MathJax.typesetPromise([document.querySelector('#formula')]);
      await document.fonts.load('24px "Noto Sans SC"', '函数图像与中文说明');
      return { version: MathJax.version, font: document.fonts.check('24px "Noto Sans SC"', '函数图像'),
        paths: document.querySelectorAll('#formula svg path').length };
    });
    expect(result.version).toBe('3.2.2');
    expect(result.font).toBe(true);
    expect(result.paths).toBeGreaterThan(10);
    expect(remote).toEqual([]);
    await page.screenshot({ path: path.join(evidence, 'offline-assets.png') });
    fs.writeFileSync(path.join(evidence, 'offline-assets.json'), JSON.stringify({ ...result, remote }, null, 2));
  } finally { await context.close(); }
});

test('real A11 page transport uploads, displays, downloads and restores R31 files; logout rejects old binding', async ({ page }) => {
  const world = await createIntegration({ webDist, workbench: { catalogOverride: moduleCatalog, extraImplementations: moduleImplementations } });
  const observed = [];
  let pageId;
  page.on('request', request => {
    if (!request.url().includes('/api/')) return;
    pageId = request.headers()['x-teachbuddy-page'] || pageId;
    observed.push({ path: new URL(request.url()).pathname, method: request.method(), hasPage: Boolean(request.headers()['x-teachbuddy-page']) });
  });
  try {
    await page.goto(world.origin);
    await page.getByRole('button', { name: '创建账户' }).click();
    await page.getByLabel('昵称', { exact: true }).fill('数学教师');
    await page.getByLabel('邮箱', { exact: true }).fill('support-ui@example.test');
    await page.getByLabel('密码', { exact: true }).fill('support-password');
    await page.getByLabel('确认密码', { exact: true }).fill('support-password');
    await page.getByRole('button', { name: '发送验证码' }).click();
    await expect.poll(() => world.mailer.lastCode('registration', 'support-ui@example.test')).toBeTruthy();
    await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'support-ui@example.test'));
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '注册', exact: true }).click();
    await expect(page.getByRole('heading', { name: '公共文件身份验证' })).toBeVisible();
    await expect(page.getByLabel('隔离模块映射')).toHaveText('题库、备课、数学工坊、资源库、班级教学、日程');
    const catalog = await page.request.get(`${world.origin}/api/modules`, { headers: { 'X-TeachBuddy-Page': pageId } });
    expect(catalog.status()).toBe(200);
    expect((await catalog.json()).items.map(item => item.id)).toEqual(['questions', 'lessons', 'math', 'resources', 'classes', 'schedule']);
    const fontfile = require.resolve('@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff');
    const png = await sharp({ text: { text: '函数图像与中文说明', font: 'Noto Sans SC 24', fontfile, rgba: true, dpi: 144 } }).png().toBuffer();
    await page.getByLabel('上传图片').setInputFiles({ name: 'poster.png', mimeType: 'image/png', buffer: png });
    const image = page.getByRole('img', { name: '本地公式海报' });
    await expect(image).toBeVisible();
    expect(await image.evaluate(node => node.naturalWidth)).toBeGreaterThan(100);
    const fileId = new URL(page.url()).searchParams.get('file');
    const firstPage = pageId;
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载原件' }).click();
    const download = await downloadEvent;
    expect(fs.readFileSync(await download.path())).toEqual(png);
    await page.reload();
    await expect(image).toBeVisible();
    expect(pageId).not.toBe(firstPage);
    await page.screenshot({ path: path.join(evidence, 'real-page-files.png') });
    const boundPage = pageId;
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
    const denied = await page.request.get(`${world.origin}/api/workbench/files/${fileId}/content`, { headers: { 'X-TeachBuddy-Page': boundPage } });
    expect(denied.status()).toBe(401);
    const fileRequests = observed.filter(item => item.path.startsWith('/api/workbench/files'));
    expect(fileRequests.length).toBeGreaterThanOrEqual(4);
    expect(fileRequests.every(item => item.hasPage)).toBe(true);
    fs.writeFileSync(path.join(evidence, 'page-files.json'), JSON.stringify({ fileRequests, restoredWithNewPage: pageId !== firstPage, logoutStatus: denied.status(), downloadMatches: true }, null, 2));
  } finally {
    await world.close();
    fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
