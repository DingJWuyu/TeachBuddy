import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, doc } from '../../api/test/teaching-time-classes-materials-fixture.js';

// Browser checks for presentation and interrupted-job recovery only.
// Controlled recognizers exercise Jobs and fixed UI content, never a GPU or
// model accuracy. The real OCR chain lives in lessons-page-real.spec.js.
let world;
const pendingRecognizer = { revision: 'controlled-pending-ui', run: ({ signal }) => new Promise((resolve, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
}) };
test.afterEach(async ({ context }, info) => {
  await context.close(); await world?.close();
  if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});
async function setup(page, recognizer, sample = 'materials-resources/samples/page.png') {
  if (!process.env.WORKBENCH_WEB_DIST) throw new Error('Set WORKBENCH_WEB_DIST to the isolated build');
  world = await createIntegration({ workbench: { recognition: { recognizer } } });
  const email = 'lesson-page-ui@example.test';
  const { client } = await registerMath(world, email), call = http(client);
  const boundary = `page-${randomUUID()}`, bytes = fs.readFileSync(new URL(`./fixtures/${sample}`, import.meta.url));
  const filename = sample.split('/').at(-1), mediaType = sample.endsWith('.pdf') ? 'application/pdf' : 'image/png';
  const upload = await client.request('POST', '/api/workbench/files', {
    headers: { 'Idempotency-Key': randomUUID() }, contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mediaType}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]),
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

test('恢复：重启及引擎更新后，重新识别直接请求固定页', async ({ page }) => {
  const { fileId, call } = await setup(page, pendingRecognizer);
  await selectPage(page);
  const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/files/${fileId}/recognition`));
  await page.getByRole('button', { name: '识别这一页', exact: true }).click();
  const previous = await (await accepted).json();
  await expect.poll(async () => (await call('GET', `/api/workbench/jobs/${previous.id}`)).state).toBe('running');
  const directory = world.directory, port = Number(new URL(world.origin).port);
  await world.close();
  let runs = 0;
  world = await createIntegration({ directory, port, workbench: { recognition: { recognizer: {
    revision: 'controlled-next-engine-ui', run: input => { runs++; return pendingRecognizer.run(input); },
  } } } });
  await page.reload();
  await expect.poll(async () => (await call('GET', `/api/workbench/jobs/${previous.id}`)).state).toBe('interrupted');
  const retry = page.getByRole('button', { name: '重新识别这一页', exact: true });
  await expect(retry).toBeEnabled();
  expect(runs).toBe(0);
  const requests = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/(recognition|retry)$/.test(new URL(request.url()).pathname))
      requests.push({ url: request.url(), body: request.postDataJSON() });
  });
  await retry.click();
  await expect.poll(() => runs).toBe(1);
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(`${world.origin}/api/workbench/files/${fileId}/recognition`);
  expect(requests[0].body.pages).toEqual([1]);
  await page.getByRole('button', { name: '停止识别', exact: true }).click();
  await expect(page.getByText('识别已停止，原资料和课稿仍保留。', { exact: true })).toBeVisible();
});

test('恢复：停止清理未确认后重新识别，未知受理回执仍按原键确认', async ({ page }, info) => {
  let runs = 0, complete;
  const recognizer = { revision: 'controlled-cleanup-ui', run: ({ signal, width, height }) => new Promise((resolve, reject) => {
    const attempt = ++runs;
    if (attempt === 2) complete = () => resolve({ width, height, assets: [], markdown: '仅用于回执恢复验证的固定正文', raw: {
      width, height, parsing_res_list: [{ block_id: 0, block_label: 'text', block_content: '仅用于回执恢复验证的固定正文', block_bbox: [0, 0, width, height] }],
    } });
    const abort = () => reject(attempt === 1
      ? Object.assign(new Error('Controlled cleanup failure'), { code: 'recognition-cleanup' }) : signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  }) };
  const { fileId, call, lesson } = await setup(page, recognizer);
  const requests = [], posts = [];
  let cleanupMessage;
  page.on('response', response => {
    const request = response.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && /\/(recognition|retry)$/.test(pathname))
      requests.push({ pathname, status: response.status() });
  });
  try {
    await selectPage(page);
    const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/files/${fileId}/recognition`));
    await page.getByRole('button', { name: '识别这一页', exact: true }).click();
    const first = await (await accepted).json();
    await expect.poll(() => runs).toBe(1);
    await page.getByRole('button', { name: '停止识别', exact: true }).click();
    await expect.poll(async () => (await call('GET', `/api/workbench/jobs/${first.id}`)).state).toBe('failed');
    const failed = await call('GET', `/api/workbench/jobs/${first.id}`);
    expect(failed.issues[0].unitId).toBeNull();
    expect(failed.issues[0].detail).toContain('尚未确认识别进程停止');
    const retry = page.getByRole('button', { name: '重新识别这一页', exact: true });
    await expect(retry).toBeEnabled();
    cleanupMessage = await page.getByRole('alert').innerText();
    await page.screenshot({ path: info.outputPath('cleanup-failed.png'), animations: 'disabled' });

    // The real server accepts the replacement request, but its first response
    // is lost. Neither the next load nor confirmation may start a third run.
    await page.route(`**/api/workbench/files/${fileId}/recognition`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      posts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
      if (posts.length === 1) { await route.fetch(); await route.abort('failed'); }
      else await route.continue();
    });
    await retry.click();
    await expect.poll(() => runs, { message: 'Explicit retry must reach a new recognition request after cleanup failed' }).toBe(2);
    await expect(page.getByRole('button', { name: '确认识别请求', exact: true })).toBeVisible();
    await page.reload();
    expect(runs).toBe(2);
    await expect(page.getByRole('button', { name: '停止识别', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '确认识别请求', exact: true })).toBeEnabled();
    complete();
    await expect(page.getByLabel('识别正文段落 1', { exact: true })).toHaveValue('仅用于回执恢复验证的固定正文');
    await page.getByRole('button', { name: '确认识别请求', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认识别请求', exact: true })).toHaveCount(0);
    expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]);
    expect(posts[0].body.pages).toEqual([1]); expect(runs).toBe(2);
    expect(requests.filter(request => request.pathname.endsWith('/retry'))).toHaveLength(0);
    expect(cleanupMessage).toContain('尚未确认识别进程停止');
    await expect(page.getByRole('img', { name: '原资料第 1 页', exact: true })).toBeVisible();
    expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections).toHaveLength(0);
  } finally {
    await info.attach('recovery-requests', { body: JSON.stringify({ runs, cleanupMessage, requests, posts }, null, 2), contentType: 'application/json' });
  }
});

test('恢复：其他入口重新识别同页后，备课跟随当前任务并可停止', async ({ page }, info) => {
  let runs = 0;
  const recognizer = { revision: 'controlled-other-consumer-ui', run: async ({ signal }) => {
    if (++runs === 1) throw new Error('Controlled first failure');
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      if (signal.aborted) reject(signal.reason);
    });
  } };
  const { fileId, call, lesson } = await setup(page, recognizer);
  await selectPage(page);
  const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/files/${fileId}/recognition`));
  await page.getByRole('button', { name: '识别这一页', exact: true }).click();
  const original = await (await accepted).json();
  await expect.poll(async () => (await call('GET', `/api/workbench/jobs/${original.id}`)).state).toBe('failed');
  await expect(page.getByRole('button', { name: '重新识别这一页', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '返回课稿', exact: true }).click();

  // A second consumer uses the actual shared endpoint. No page result or Job
  // status is mocked: reopening lessons must discover this running request.
  const preview = await call('GET', `/api/workbench/files/${fileId}/preview`);
  const current = await call('POST', `/api/workbench/files/${fileId}/recognition`, { renditionFileId: preview.renditionFileId, pages: [1] }, 202);
  expect(current.id).not.toBe(original.id);
  await expect.poll(() => runs).toBe(2);
  await page.getByRole('button', { name: '从资料提取正文', exact: true }).click();
  await expect(page.getByRole('button', { name: '停止识别', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新识别这一页', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('following-current-job.png'), animations: 'disabled' });
  const stopped = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith(`/jobs/${current.id}/cancel`));
  await page.getByRole('button', { name: '停止识别', exact: true }).click();
  await stopped;
  await expect.poll(async () => (await call('GET', `/api/workbench/jobs/${current.id}`)).state).toBe('cancelled');
  expect((await call('GET', `/api/workbench/jobs/${original.id}`)).state).toBe('failed');
  expect(runs).toBe(2);
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections).toHaveLength(0);
});

for (const newerPage of [1, 2]) test(`恢复：旧任务已取消，其他入口第 ${newerPage} 页清理失败后重开保持本页状态`, async ({ page }, info) => {
  let runs = 0;
  const recognizer = { revision: 'controlled-terminal-following-ui', run: ({ signal }) => new Promise((resolve, reject) => {
    const attempt = ++runs;
    const abort = () => reject(attempt === 2
      ? Object.assign(new Error('Controlled newer cleanup failure'), { code: 'recognition-cleanup' }) : signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  }) };
  const { fileId, call, lesson } = await setup(page, recognizer,
    newerPage === 1 ? 'materials-resources/samples/page.png' : 'materials-questions/P.pdf');
  await selectPage(page);
  const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/files/${fileId}/recognition`));
  await page.getByRole('button', { name: '识别这一页', exact: true }).click();
  const original = await (await accepted).json();
  await expect.poll(() => runs).toBe(1);
  await page.getByRole('button', { name: '停止识别', exact: true }).click();
  await expect(page.getByText('识别已停止，原资料和课稿仍保留。', { exact: true })).toBeVisible();
  expect((await call('GET', `/api/workbench/jobs/${original.id}`)).state).toBe('cancelled');
  await page.getByRole('button', { name: '返回课稿', exact: true }).click();

  const preview = await call('GET', `/api/workbench/files/${fileId}/preview`);
  expect(preview.pages.some(item => item.page === newerPage)).toBe(true);
  const current = await call('POST', `/api/workbench/files/${fileId}/recognition`, { renditionFileId: preview.renditionFileId, pages: [newerPage] }, 202);
  await expect.poll(() => runs).toBe(2);
  await call('POST', `/api/workbench/jobs/${current.id}/cancel`, {});
  await expect.poll(async () => (await call('GET', `/api/workbench/jobs/${current.id}`)).state).toBe('failed');
  expect((await call('GET', `/api/workbench/files/${fileId}/recognition/pages/${newerPage}?renditionFileId=${preview.renditionFileId}`)).issues[0].code).toBe('recognition-cleanup');

  await page.getByRole('button', { name: '从资料提取正文', exact: true }).click();
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    if (newerPage === 1) {
      await expect(page.getByRole('alert')).toContainText('尚未确认识别进程停止');
      await expect(page.getByText('识别已停止，原资料和课稿仍保留。', { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText('识别已停止，原资料和课稿仍保留。', { exact: true })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
  }
  await page.screenshot({ path: info.outputPath('latest-failed-page.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '重新识别这一页', exact: true }).click();
  await expect.poll(() => runs).toBe(3);
  await page.getByRole('button', { name: '停止识别', exact: true }).click();
  await expect(page.getByText('识别已停止，原资料和课稿仍保留。', { exact: true })).toBeVisible();
  expect((await call('GET', `/api/workbench/jobs/${current.id}`)).state).toBe('failed');
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections).toHaveLength(0);
});
