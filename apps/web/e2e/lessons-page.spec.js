import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, doc } from '../../api/test/teaching-time-classes-materials-fixture.js';

// Browser checks for presentation and interrupted-job recovery only.
// The controlled pending recognizer never returns OCR output or starts a GPU.
let world;
const pendingRecognizer = { revision: 'controlled-pending-ui', run: ({ signal }) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
}) };
test.afterEach(async ({ context }, info) => {
  await context.close(); await world?.close();
  if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});
async function setup(page, recognizer) {
  if (!process.env.WORKBENCH_WEB_DIST) throw new Error('Set WORKBENCH_WEB_DIST to the isolated build');
  world = await createIntegration({ workbench: { recognition: { recognizer } } });
  const email = 'lesson-page-ui@example.test';
  const { client } = await registerMath(world, email), call = http(client);
  const boundary = `page-${randomUUID()}`, png = fs.readFileSync(new URL('./fixtures/materials-resources/samples/page.png', import.meta.url));
  const upload = await client.request('POST', '/api/workbench/files', {
    headers: { 'Idempotency-Key': randomUUID() }, contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="page.png"\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from(`\r\n--${boundary}--\r\n`)]),
  });
  expect(upload.status).toBe(201);
  const resource = await call('POST', '/api/modules/resources/items', { title: '单页资料', fileId: upload.json.id,
    folderId: null, tagIds: [], note: '' }, 201);
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '整页校对课稿', intro: doc('原课稿保持'), sections: [], materials: [] }, 201);
  await page.goto(`${world.origin}/lessons/${lesson.id}`);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
  await page.goto(`${world.origin}/lessons/${lesson.id}`);
  await page.getByRole('button', { name: '编辑备课', exact: true }).click();
  return { call, lesson, resource, fileId: upload.json.id };
}
async function selectPage(page) {
  await page.getByRole('button', { name: '从资料提取正文', exact: true }).click();
  await page.getByRole('button', { name: '单页资料', exact: true }).click();
  await page.getByRole('button', { name: '预览并选择一页', exact: true }).click();
  await expect(page.getByRole('img', { name: '资料第 1 页', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '提取这一页', exact: true }).click();
}

test('UI：普通预览名称保持，固定疑点可展开并在刷新后保留校对', async ({ page }, info) => {
  const { fileId, call, lesson } = await setup(page);
  await page.getByRole('button', { name: '备用材料', exact: true }).click();
  await page.locator('[data-region="materials"]').getByRole('button', { name: '加入材料', exact: true }).click();
  await page.getByRole('menuitem', { name: '加入资源', exact: true }).click();
  await page.getByRole('button', { name: '单页资料', exact: true }).click();
  await page.getByRole('button', { name: '预览 page.png', exact: true }).click();
  await expect(page.getByRole('img', { name: '成品第 1 页', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭预览', exact: true }).click();
  await page.getByRole('button', { name: '返回课稿', exact: true }).click();
  // A read-only response fixture isolates disclosure rendering. No adoption or
  // recognition request is sent, and this test is not a recognition success.
  let recognitionWrites = 0;
  page.on('request', req => { if (req.method() === 'POST' && /\/recognition$/.test(req.url())) recognitionWrites++; });
  await page.route(`**/files/${fileId}/recognition/pages/1?*`, route => route.fulfill({ json: {
    state: 'ready', resultId: randomUUID(), document: { ...doc('校对显示用的固定文本'), version: 2 },
    issues: [{ code: 'unparsed-math', detail: '第一个公式的分母请对照原页核对。' }, { code: 'layout' }],
  } }));
  await selectPage(page);
  const disclosure = page.getByRole('button', { name: '这一页有识别疑点，请对照原页核对', exact: true });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('第一个公式的分母请对照原页核对。', { exact: true })).toBeVisible();
  await expect(page.getByText('请检查原页与识别正文是否一致。', { exact: true })).toBeVisible();
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  const collapsed = disclosure.locator('..').locator('.wb-module-disclosure-grid');
  await expect(collapsed).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => collapsed.evaluate(node => node.getBoundingClientRect().height)).toBe(0);
  await disclosure.click();
  await page.getByLabel('识别正文段落 1', { exact: true }).fill('保留我校对后的文本');
  await page.reload();
  await expect(page.getByLabel('识别正文段落 1', { exact: true })).toHaveValue('保留我校对后的文本');
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('link', { name: /账户：/ }).click();
    await page.getByRole('button', { name: theme === 'dark' ? '深色' : '浅色', exact: true }).click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', theme);
    await page.goto(`${world.origin}/lessons/${lesson.id}`);
    await expect(page.getByLabel('识别正文段落 1', { exact: true })).toHaveValue('保留我校对后的文本');
    const original = page.getByRole('button', { name: '原资料 · 第 1 页', exact: true });
    if (await original.getAttribute('aria-expanded') !== 'true') await original.click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('button', { name: '加入为教学环节', exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 1440) {
        const panels = await page.locator('.lesson-page-import-body > *').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
        expect(Math.abs(panels[0] - panels[1])).toBeLessThan(1);
      } else {
        const panels = await page.locator('.lesson-page-import-body > *').evaluateAll(nodes => nodes.map(n => ({ top: n.getBoundingClientRect().top, bottom: n.getBoundingClientRect().bottom })));
        expect(panels[1].top).toBeGreaterThanOrEqual(panels[0].bottom);
        await original.click();
        await page.getByLabel('识别正文段落 1', { exact: true }).click();
        await expect(page.getByLabel('识别正文段落 1', { exact: true })).toBeFocused();
      }
      await page.screenshot({ path: info.outputPath(`issues-${theme}-${width}.png`), animations: 'disabled' });
    }
  }
  expect(recognitionWrites).toBe(0);
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections).toHaveLength(0);
});

test('恢复：运行中的识别可停止，停止回执丢失后刷新仍用原键确认', async ({ page }, info) => {
  const { call, fileId, lesson } = await setup(page, pendingRecognizer);
  await selectPage(page);
  await page.getByRole('button', { name: '识别这一页', exact: true }).click();
  const stop = page.getByRole('button', { name: '停止识别', exact: true });
  await expect(stop).toBeVisible();
  const attempts = [];
  await page.route('**/api/workbench/jobs/*/cancel', async route => {
    attempts.push({ url: route.request().url(), key: route.request().headers()['idempotency-key'] });
    if (attempts.length === 1) { await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await stop.click();
  await page.reload();
  await page.getByRole('button', { name: '确认停止结果', exact: true }).click();
  await expect(page.getByText('识别已停止，原资料和课稿仍保留。', { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
  await expect(page.getByRole('img', { name: '原资料第 1 页', exact: true })).toBeVisible();
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections).toHaveLength(0);
  expect((await call('GET', `/api/workbench/files/${fileId}/recognition`)).pages[0].state).not.toBe('ready');
  await page.screenshot({ path: info.outputPath('stopped.png'), animations: 'disabled' });
});

test('恢复：旧任务不可重试时，明确重新发起本页识别', async ({ page }) => {
  const { fileId, call } = await setup(page, { revision: 'controlled-failure-ui', run: async () => { throw new Error('controlled failure'); } });
  await selectPage(page);
  await page.getByRole('button', { name: '识别这一页', exact: true }).click();
  await expect.poll(async () => (await call('GET', `/api/workbench/files/${fileId}/recognition`)).pages[0].state).toBe('failed');
  // Exact shared revision-guard response, verifying recovery from this rejection.
  let retries = 0;
  await page.route('**/api/workbench/jobs/*/retry', route => {
    retries++;
    return route.fulfill({ status: 409, contentType: 'application/problem+json', json: {
      type: '/problems/materials/job-not-retryable', field: '', detail: '识别环境已变更，请重新发起识别。',
    } });
  });
  await page.getByRole('button', { name: '重新识别这一页', exact: true }).click();
  const fresh = page.getByRole('button', { name: '重新发起识别', exact: true });
  await expect(fresh).toBeVisible();
  await page.reload();
  await expect(fresh).toBeVisible();
  const posted = page.waitForRequest(req => req.method() === 'POST' && req.url().endsWith(`/files/${fileId}/recognition`));
  await fresh.click(); await posted;
  expect(retries).toBe(1);
});
