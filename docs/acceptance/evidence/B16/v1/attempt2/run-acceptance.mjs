/**
 * B16 independent acceptance runner.
 *
 * Product code comes from B16_RUNTIME_ROOT, which must be a clean checkout of
 * the fixed candidate. All mutable state and evidence stay in the B16 report
 * worktree. The primary flow uses visible controls and ordinary Playwright
 * keyboard, pointer and wheel input. Direct HTTP writes only create enough
 * extra list content for the scroll-isolation check.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const reportRoot = path.resolve(here, '../../../../../..');
const runtimeRoot = path.resolve(
  process.env.B16_RUNTIME_ROOT ?? path.join(reportRoot, '.scratch', 'B16', 'attempt2', 'candidate-run')
);
const scratchRoot = path.join(reportRoot, '.scratch', 'B16', 'attempt2');
const dataRoot = path.join(scratchRoot, 'data');
const builtWebDist = path.join(runtimeRoot, 'apps', 'web', 'dist');
// express/send cannot serve an absolute SPA fallback path containing non-ASCII
// segments in this environment. Keep the files in the report worktree, but
// expose the same directory through the ASCII /proc/self/cwd path.
process.chdir(runtimeRoot);
const webDist = '/proc/self/cwd/apps/web/dist';
const ports = { primary: 47216, legacy: 48216, failure: 49216 };
const origin = `https://localhost:${ports.primary}`;
const candidateSha = process.env.B16_CANDIDATE_SHA
  ?? '612f0a9868743a1d5eea7e6f236d3ff903752439';
const startedAt = new Date().toISOString();

fs.mkdirSync(here, { recursive: true });
fs.rmSync(dataRoot, { recursive: true, force: true });
fs.mkdirSync(dataRoot, { recursive: true });

const playwright = await import(pathToFileURL(path.join(runtimeRoot, 'node_modules', 'playwright', 'index.mjs')));
const runnerModule = await import(pathToFileURL(path.join(runtimeRoot, 'scripts', 'first-flow', 'lib', 'runner.mjs')));
const identityModule = await import(pathToFileURL(path.join(
  runtimeRoot,
  'apps', 'web', 'e2e', 'fixtures', 'first-flow', 'identity.js'
)));
const { chromium } = playwright;
const { startFirstFlowRunner } = runnerModule;
const { bootstrapPrincipal } = identityModule;

const accounts = { a: 'fixture-teacher-a', b: 'fixture-teacher-b' };
const checks = [];
const network = [];
const screenshots = [];
const visual = {};
let browser;
let runner;
let activeContext;
let activePage;
let failed = null;

function record(id, status, detail, artifacts = []) {
  checks.push({ id, status, detail, artifacts });
  process.stdout.write(`[${status}] ${id}: ${detail}\n`);
}

function evidencePath(name) {
  return path.join(here, name);
}

async function screenshot(page, name) {
  const target = evidencePath(name);
  await page.screenshot({ path: target, fullPage: false });
  screenshots.push(name);
}

function attachNetwork(page, label) {
  page.on('response', (response) => {
    if (!response.url().startsWith(origin)) return;
    const request = response.request();
    network.push({
      at: new Date().toISOString(),
      page: label,
      method: request.method(),
      url: response.url().replace(origin, ''),
      status: response.status(),
      resourceType: request.resourceType()
    });
  });
  page.on('requestfailed', (request) => {
    if (!request.url().startsWith(origin)) return;
    network.push({
      at: new Date().toISOString(),
      page: label,
      method: request.method(),
      url: request.url().replace(origin, ''),
      status: 'requestfailed',
      failure: request.failure()?.errorText ?? 'unknown',
      resourceType: request.resourceType()
    });
  });
}

async function waitFor(check, message, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ''}`);
}

async function waitVisible(locator, message) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
  return locator;
}

async function waitText(locator, text, message) {
  return waitFor(async () => (await locator.textContent())?.includes(text), message);
}

async function waitCount(locator, count, message) {
  return waitFor(async () => (await locator.count()) === count, message);
}

function field(page, label) {
  return page.locator(`input[aria-label="${label}"], textarea[aria-label="${label}"]`);
}

async function waitSaved(page) {
  const status = page.locator('[data-save-status]').first();
  await waitText(status, '已保存', '保存状态未变为已保存');
  await waitFor(async () => /^(saved|clean)$/.test(await status.getAttribute('data-save-status')), '保存状态标识不正确');
}

async function fillParagraph(page, editor, label, text) {
  await page.locator(`[data-document-editor="${editor}"]`).getByRole('button', { name: '段落', exact: true }).click();
  await field(page, label).fill(text);
}

async function addFormula(page, editor, label, latex) {
  await page.locator(`[data-document-editor="${editor}"]`).getByRole('button', { name: '公式', exact: true }).click();
  await field(page, label).fill(latex);
}

async function apiRead(page, apiPath) {
  const response = await page.request.get(`${origin}${apiPath}`);
  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function apiWrite(page, method, apiPath, body, key = crypto.randomUUID()) {
  const response = await page.request.fetch(`${origin}${apiPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'X-TeachBuddy-Request': '1',
      Origin: origin,
      'Idempotency-Key': key
    },
    data: body
  });
  return { status: response.status(), body: await response.json().catch(() => null) };
}

function documentBody(text, latex = null) {
  return {
    version: 1,
    blocks: [
      { type: 'paragraph', runs: [{ type: 'text', text }] },
      ...(latex ? [{ type: 'math', latex }] : [])
    ]
  };
}

function requestJson(baseOrigin, requestPath, options = {}) {
  const url = new URL(baseOrigin);
  const body = options.body === undefined ? null : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: url.hostname,
      port: url.port,
      path: requestPath,
      method: options.method ?? 'GET',
      rejectUnauthorized: false,
      agent: false,
      headers: {
        Origin: baseOrigin,
        Connection: 'close',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers ?? {})
      }
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        let parsed = raw;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* keep text */ }
        resolve({ status: response.statusCode, body: parsed });
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function runPrimaryFlow() {
  const dataDir = path.join(dataRoot, 'primary');
  runner = await startFirstFlowRunner({
    dataDir,
    port: ports.primary,
    fixtures: [],
    web: webDist,
    reset: true,
    quiet: true
  });
  assert.equal(runner.sha, candidateSha, '运行器 SHA 与固定候选不一致');

  browser = await chromium.launch();
  activeContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    baseURL: origin,
    viewport: { width: 1440, height: 900 }
  });
  await activeContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  await bootstrapPrincipal(activeContext, accounts.a, { origin, dataDir });
  activePage = await activeContext.newPage();
  attachNetwork(activePage, 'desktop-a');

  await activePage.goto('/questions');
  await waitVisible(activePage.locator('.wb-nav-row').first(), '工作台未启动');
  await waitText(activePage.locator('[data-region="list-empty"]'), '题库为空', '空库状态未出现');

  // Record one question entirely through visible controls.
  await activePage.locator('button[name="new-manual"]').click();
  await field(activePage, '标题').fill('B16 独立验收 - 圆锥曲线焦点');
  await fillParagraph(activePage, '题面', '题面段落 1', '已知椭圆的两个焦点在 x 轴上，求右焦点坐标。');
  await addFormula(activePage, '题面', '题面公式 1源', '\\frac{x^2}{25}+\\frac{y^2}{9}=1');
  await fillParagraph(activePage, '答案', '答案段落 1', '由 c^2=25-9 得 c=4，右焦点为 (4,0)。');
  await field(activePage, '教学笔记').fill('先让学生说明 a、b、c 的关系。');
  await waitVisible(activePage.locator('.wb-math-block-preview .katex').first(), '公式预览未出现');
  await activePage.locator('button[name="save"]').click();
  await waitVisible(activePage.locator('[data-region="question-reader"]'), '保存后未进入题目阅读');
  await waitSaved(activePage);
  const questionId = activePage.url().split('/questions/')[1];
  assert.match(questionId, /^[0-9a-f-]{36}$/);
  const storedQuestion = await apiRead(activePage, `/api/modules/questions/items/${questionId}`);
  assert.equal(storedQuestion.status, 200);
  assert.equal(storedQuestion.body.body.blocks[1].latex, '\\frac{x^2}{25}+\\frac{y^2}{9}=1');
  assert.equal(storedQuestion.body.note, '先让学生说明 a、b、c 的关系。');

  // Overlay motion, focus return and copy-draft recovery are observed in this browser.
  const more = activePage.getByRole('button', { name: '更多操作' });
  await more.click();
  const menu = activePage.getByRole('menu');
  await waitVisible(menu, '更多操作菜单未出现');
  visual.overlay = await menu.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      transformOrigin: style.transformOrigin
    };
  });
  assert.notEqual(visual.overlay.animationName, 'none');
  assert.equal(visual.overlay.animationDuration, '0.18s');
  await activePage.keyboard.press('Escape');
  assert.equal(await more.evaluate((node) => document.activeElement === node), true, 'Esc 未把焦点还给触发按钮');
  await more.click();
  await activePage.getByRole('menuitem', { name: '复制修改' }).click();
  await waitVisible(activePage.locator('[data-region="copy-compare"]'), '改编对照未出现');
  await field(activePage, '题面公式 1源').fill('\\frac{x^2}{36}+\\frac{y^2}{20}=1');
  await field(activePage, '答案段落 1').fill('由 c^2=36-20 得 c=4，右焦点仍为 (4,0)。');
  await activePage.locator('.wb-nav-row', { hasText: '题库' }).click();
  await waitText(activePage.locator('[data-region="drafts"]'), '改编草稿', '返回后未找到改编草稿');
  await activePage.locator('[data-region="drafts"] .wb-draft-row').click();
  assert.equal(await field(activePage, '题面公式 1源').inputValue(), '\\frac{x^2}{36}+\\frac{y^2}{20}=1');
  await activePage.reload();
  assert.equal(await field(activePage, '题面公式 1源').inputValue(), '\\frac{x^2}{36}+\\frac{y^2}{20}=1');
  await activePage.locator('button[name="save"]').click();
  await waitVisible(activePage.locator('[data-region="question-reader"]'), '改编保存后未进入阅读');
  await waitSaved(activePage);
  const copyId = activePage.url().split('/questions/')[1];
  assert.notEqual(copyId, questionId);
  const storedCopy = await apiRead(activePage, `/api/modules/questions/items/${copyId}`);
  assert.equal(storedCopy.body.source.questionId, questionId);
  assert.equal(storedCopy.body.source.snapshot.body.blocks[1].latex, '\\frac{x^2}{25}+\\frac{y^2}{9}=1');
  assert.equal((await apiRead(activePage, `/api/modules/questions/items/${questionId}`)).body.version, 1);

  // Create a lesson and pick the copy followed by the original through visible controls.
  await activePage.locator('.wb-nav-row', { hasText: '备课' }).click();
  await waitVisible(activePage.locator('button[name="new-lesson"]'), '备课列表未出现');
  await activePage.locator('button[name="new-lesson"]').click();
  await field(activePage, '课题').fill('B16 圆锥曲线首条流程');
  await activePage.locator('button[name="add-section"]').click();
  await field(activePage, '环节名称 1').fill('变式对照');
  await fillParagraph(activePage, '环节文稿 1', '环节文稿 1段落 1', '先比较两个标准方程，再讨论焦距为何不变。');
  await activePage.locator('button[name="pick-section"]').click();
  await waitVisible(activePage.locator('[data-region="question-picker"]'), '取题页未出现');
  await activePage.locator(`[data-question-id="${copyId}"] .wb-row-select input`).check();
  await activePage.locator(`[data-question-id="${questionId}"] .wb-row-select input`).check();
  assert.equal(await activePage.locator(`[data-question-id="${copyId}"] [data-select-index]`).textContent(), '1');
  assert.equal(await activePage.locator(`[data-question-id="${questionId}"] [data-select-index]`).textContent(), '2');
  await activePage.reload();
  assert.equal(await activePage.locator(`[data-question-id="${copyId}"] [data-select-index]`).textContent(), '1');
  await activePage.locator('button[name="picker-confirm"]').click();
  await waitCount(activePage.locator('[data-region="section-references"] [data-reference-id]'), 2, '两道题未原子加入环节');
  assert.equal(await field(activePage, '环节文稿 1段落 1').inputValue(), '先比较两个标准方程，再讨论焦距为何不变。');
  await activePage.locator('button[name="save"]').click();
  await waitSaved(activePage);
  const lessonId = activePage.url().split('/lessons/')[1];
  await screenshot(activePage, 'desktop-core-flow.png');

  // Return, refresh and retained-data restart.
  await activePage.locator('.wb-nav-row', { hasText: '题库' }).click();
  await activePage.locator(`[data-question-id="${questionId}"] [data-row-open]`).click();
  await waitText(activePage.locator('[data-region="question-reader"]'), '已知椭圆', '返回题库未读到原题');
  await activePage.locator('.wb-nav-row', { hasText: '备课' }).click();
  await activePage.locator('[data-region="lesson-rows"] button').first().click();
  await waitCount(activePage.locator('[data-region="section-references"] [data-reference-id]'), 2, '返回备课后引用丢失');
  await activePage.reload();
  await waitCount(activePage.locator('[data-region="section-references"] [data-reference-id]'), 2, '刷新后引用丢失');
  await runner.close();
  runner = null;
  runner = await startFirstFlowRunner({
    dataDir,
    port: ports.primary,
    fixtures: [],
    web: webDist,
    reset: false,
    quiet: true
  });
  await activePage.reload();
  await waitVisible(activePage.locator('[data-region="lesson-editor"]'), 'API 重启后备课未恢复');
  assert.ok(activePage.url().includes(lessonId));
  await waitCount(activePage.locator('[data-region="section-references"] [data-reference-id]'), 2, 'API 重启后引用丢失');
  const afterRestartQuestion = await apiRead(activePage, `/api/modules/questions/items/${questionId}`);
  const afterRestartCopy = await apiRead(activePage, `/api/modules/questions/items/${copyId}`);
  const afterRestartLesson = await apiRead(activePage, `/api/modules/lessons/items/${lessonId}`);
  assert.equal(afterRestartQuestion.status, 200);
  assert.equal(afterRestartCopy.body.source.questionId, questionId);
  assert.equal(afterRestartLesson.body.sections[0].references.length, 2);

  const freshContext = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: origin, viewport: { width: 1440, height: 900 } });
  await bootstrapPrincipal(freshContext, accounts.a, { origin, dataDir });
  const freshPage = await freshContext.newPage();
  attachNetwork(freshPage, 'fresh-after-restart');
  await freshPage.goto(`/lessons/${lessonId}`);
  await waitCount(freshPage.locator('[data-region="section-references"] [data-reference-id]'), 2, '新浏览器上未读回两个引用');
  await screenshot(freshPage, 'desktop-fresh-context-after-restart.png');
  await freshContext.close();
  record('core-flow', 'PASS', `录题 ${questionId}，改编 ${copyId}，备课 ${lessonId}；返回、刷新、保留库重启和新上下文均读回`, ['desktop-core-flow.png', 'desktop-fresh-context-after-restart.png']);

  // WB-010: real browser scene, selection, independent scroll and AI draft.
  for (let index = 0; index < 28; index += 1) {
    const result = await apiWrite(activePage, 'POST', '/api/modules/questions/items', {
      title: `B16 滚动样本 ${String(index + 1).padStart(2, '0')}`,
      body: documentBody(`用于独立滚动验收的题目 ${index + 1}`),
      solution: documentBody(`答案 ${index + 1}`),
      note: '',
      starred: false,
      source: { kind: 'manual' }
    });
    assert.equal(result.status, 201);
  }
  await activePage.goto('/questions');
  await waitCount(activePage.locator('[data-region="question-rows"] [data-question-id]'), 30, '滚动样本未读全');
  await field(activePage, '搜索题目').fill('B16 滚动样本');
  await waitCount(activePage.locator('[data-region="question-rows"] [data-question-id]'), 28, '搜索结果不正确');
  await activePage.locator('[data-region="question-rows"] .wb-row-select input').nth(0).check();
  await activePage.locator('[data-region="question-rows"] .wb-row-select input').nth(1).check();
  const listScroll = activePage.locator('[data-region="question-list-scroll"]');
  await listScroll.hover();
  await activePage.mouse.wheel(0, 1400);
  const listScrollTop = await waitFor(async () => {
    const top = await listScroll.evaluate((node) => node.scrollTop);
    return top > 0 ? top : false;
  }, '鼠标滚轮未使题库列表独立滚动');
  const readerScrollTop = await activePage.locator('[data-region="question-pane"]').evaluate((node) => node.scrollTop);
  const documentScrollTop = await activePage.evaluate(() => window.scrollY);
  assert.equal(readerScrollTop, 0);
  assert.equal(documentScrollTop, 0);
  const mainBefore = (await activePage.locator('[data-region="main"]').boundingBox()).width;
  await activePage.locator('.wb-sidebar').getByRole('button', { name: 'AI 助理' }).click();
  await waitVisible(activePage.locator('.wb-aux'), '右侧辅助栏未打开');
  const mainAfter = (await activePage.locator('[data-region="main"]').boundingBox()).width;
  assert.ok(mainAfter < mainBefore, '右栏未占用布局空间');
  await field(activePage, 'AI 输入').fill('B16 现场：保留这句未发送草稿');
  await activePage.locator('.wb-nav-row', { hasText: '备课' }).click();
  await activePage.locator('.wb-nav-row', { hasText: '题库' }).click();
  await activePage.reload();
  assert.equal(await field(activePage, '搜索题目').inputValue(), 'B16 滚动样本');
  assert.equal(await activePage.locator('[data-region="question-rows"] .wb-row-select input:checked').count(), 2);
  assert.equal(await field(activePage, 'AI 输入').inputValue(), 'B16 现场：保留这句未发送草稿');
  const restoredScroll = await activePage.locator('[data-region="question-list-scroll"]').evaluate((node) => node.scrollTop);
  assert.ok(restoredScroll > 0, '刷新后列表滚动现场未恢复');
  visual.desktop = {
    listScrollTop,
    restoredScroll,
    readerScrollTop,
    documentScrollTop,
    mainWidthBefore: mainBefore,
    mainWidthAfter: mainAfter,
    pageOverflow: await activePage.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  };
  assert.ok(visual.desktop.pageOverflow <= 1);
  await screenshot(activePage, 'desktop-scene-scroll-aux.png');
  record('wb-010-desktop-scene', 'PASS', `搜索、多选、列表滚动 ${Math.round(listScrollTop)}px、右栏和 AI 草稿在切模块与刷新后恢复`, ['desktop-scene-scroll-aux.png']);

  // A second account must not see A's server data or local scene.
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: origin, viewport: { width: 1440, height: 900 } });
  await bootstrapPrincipal(otherContext, accounts.b, { origin, dataDir });
  const otherPage = await otherContext.newPage();
  attachNetwork(otherPage, 'desktop-b');
  await otherPage.goto('/questions');
  await waitText(otherPage.locator('[data-region="list-empty"]'), '题库为空', '账户 B 的题库不为空');
  assert.equal((await apiRead(otherPage, `/api/modules/questions/items/${questionId}`)).status, 404);
  assert.equal(await otherPage.locator('[data-region="drafts"]').count(), 0);
  await screenshot(otherPage, 'desktop-account-b-isolated.png');
  await otherContext.close();
  record('two-account-isolation', 'PASS', '账户 B 的列表为空，读取 A 的题目返回 404，且无 A 的草稿现场', ['desktop-account-b-isolated.png']);

  // WB-011 local-storage refusal in an actual browser, followed by online save.
  const storageContext = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: origin, viewport: { width: 1440, height: 900 } });
  await storageContext.addInitScript(() => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (String(key).startsWith('tb.workbench.v1')) throw new DOMException('B16 quota refusal', 'QuotaExceededError');
      return originalSet.call(this, key, value);
    };
  });
  await bootstrapPrincipal(storageContext, accounts.a, { origin, dataDir });
  const storagePage = await storageContext.newPage();
  attachNetwork(storagePage, 'storage-refusal');
  await storagePage.goto('/questions/new-manual');
  await waitText(storagePage.locator('[data-region="storage-warning"]'), '草稿无法保留，请先保存', '本地存储拒绝时未明确提示');
  await fillParagraph(storagePage, '题面', '题面段落 1', '本地不可写时仍可在线保存的题面');
  await screenshot(storagePage, 'failure-local-storage-refused.png');
  assert.equal(await storagePage.locator('button[name="save"]').isEnabled(), true);
  await storagePage.locator('button[name="save"]').click();
  await waitVisible(storagePage.locator('[data-region="question-reader"]'), '本地存储故障后在线保存未成功');
  await waitSaved(storagePage);
  await screenshot(storagePage, 'recovered-local-storage-online-save.png');
  await storageContext.close();
  record('wb-011-local-storage', 'PASS', '实际浏览器拒绝 workbench localStorage 写入时给出明确警告，仍可通过在线保存恢复', ['failure-local-storage-refused.png', 'recovered-local-storage-online-save.png']);

  // B15 real storage fault reproduced independently at the actual transaction boundary.
  const faultContext = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: origin, viewport: { width: 1440, height: 900 } });
  await bootstrapPrincipal(faultContext, accounts.a, { origin, dataDir });
  const faultPage = await faultContext.newPage();
  attachNetwork(faultPage, 'sqlite-refusal');
  await faultPage.goto('/questions/new-manual');
  await fillParagraph(faultPage, '题面', '题面段落 1', 'B16 SQLite 拒写后必须保留的题面');
  const beforeRows = runner.workbench.db.prepare('SELECT COUNT(*) AS count FROM question_items').get().count;
  const beforeKeys = runner.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_mutation_keys').get().count;
  runner.workbench.db.pragma('query_only = ON');
  await faultPage.locator('button[name="save"]').click();
  const status = faultPage.locator('[data-save-status]').first();
  await waitFor(async () => (await status.getAttribute('data-save-status')) === 'unconfirmed', '拒写后未进入结果未确认');
  await waitText(status, '暂时无法确认是否保存', '拒写后出现伪成功或错误反馈');
  assert.equal(await field(faultPage, '题面段落 1').inputValue(), 'B16 SQLite 拒写后必须保留的题面');
  assert.equal(runner.workbench.db.prepare('SELECT COUNT(*) AS count FROM question_items').get().count, beforeRows);
  assert.equal(runner.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_mutation_keys').get().count, beforeKeys);
  await waitFor(
    async () => network.some((entry) => entry.page === 'sqlite-refusal' && entry.method === 'POST' && entry.status === 503),
    '网络记录中未看到真实 503'
  );
  await screenshot(faultPage, 'failure-sqlite-write-refused.png');
  runner.workbench.db.pragma('query_only = OFF');
  await faultPage.reload();
  assert.equal(await field(faultPage, '题面段落 1').inputValue(), 'B16 SQLite 拒写后必须保留的题面');
  await faultPage.locator('button[name="retry-confirm"]').click();
  await waitVisible(faultPage.locator('[data-region="question-reader"]'), '恢复写入后原请求重试未成功');
  await waitSaved(faultPage);
  assert.equal(runner.workbench.db.prepare('SELECT COUNT(*) AS count FROM question_items').get().count, beforeRows + 1);
  assert.equal(runner.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_mutation_keys').get().count, beforeKeys + 1);
  await screenshot(faultPage, 'recovered-sqlite-write.png');
  await faultContext.close();
  record('real-write-failure-recovery', 'PASS', '真实 SQLite 拒写返回 503，业务行与幂等记录均无部分写；恢复后原键重试只新增 1 题和 1 记录', ['failure-sqlite-write-refused.png', 'recovered-sqlite-write.png', 'network.jsonl']);

  // Pad visual behavior, reduced motion, compare switch and horizontal containment.
  const padContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    baseURL: origin,
    viewport: { width: 768, height: 1024 },
    reducedMotion: 'reduce'
  });
  await bootstrapPrincipal(padContext, accounts.a, { origin, dataDir });
  const padPage = await padContext.newPage();
  attachNetwork(padPage, 'pad');
  await padPage.goto('/questions');
  await waitVisible(padPage.locator('[data-region="question-list"]'), 'Pad 题库列表未出现');
  assert.equal(await padPage.locator('[data-region="question-pane"]').isVisible(), false);
  await screenshot(padPage, 'pad-question-list.png');
  await padPage.locator(`[data-question-id="${questionId}"] [data-row-open]`).click();
  await waitVisible(padPage.locator('[data-region="question-reader"]'), 'Pad 题目阅读未出现');
  assert.equal(await padPage.locator('[data-region="question-list"]').isVisible(), false);
  assert.ok((await padPage.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  const padMore = padPage.getByRole('button', { name: '更多操作' });
  await padMore.click();
  await waitVisible(padPage.getByRole('menu'), 'Pad 更多菜单未出现');
  visual.reducedMotionDuration = await padPage.getByRole('menu').evaluate((node) => getComputedStyle(node).animationDuration);
  assert.equal(visual.reducedMotionDuration, '0s');
  await padPage.keyboard.press('Escape');
  await padPage.locator('.wb-sidebar').getByRole('button', { name: 'AI 助理' }).click();
  const padAux = padPage.locator('.wb-aux');
  await waitVisible(padAux, 'Pad 辅助栏未出现');
  const padAuxBox = await padAux.boundingBox();
  const padWorkspaceBox = await padPage.locator('.wb-workspace').boundingBox();
  assert.ok(Math.abs(padAuxBox.width - padWorkspaceBox.width) <= 2, 'Pad 辅助栏未独占当前内容区');
  await screenshot(padPage, 'pad-aux-exclusive.png');
  await padPage.locator('.wb-aux').getByRole('button', { name: '关闭辅助栏' }).click();
  await padPage.getByRole('button', { name: '更多操作' }).click();
  await padPage.getByRole('menuitem', { name: '复制修改' }).click();
  await waitVisible(padPage.locator('[data-region="compare-target"]'), 'Pad 改编区未出现');
  assert.equal(await padPage.locator('[data-region="compare-source"]').isVisible(), false);
  await padPage.locator('button[name="compare-source-tab"]').click();
  await waitVisible(padPage.locator('[data-region="compare-source"]'), 'Pad 原题对照切换失败');
  assert.equal(await padPage.locator('[data-region="compare-target"]').isVisible(), false);
  assert.ok((await padPage.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  await screenshot(padPage, 'pad-copy-compare.png');
  visual.pad = { auxWidth: padAuxBox.width, workspaceWidth: padWorkspaceBox.width, pageOverflow: await padPage.evaluate(() => document.documentElement.scrollWidth - innerWidth) };
  await padContext.close();
  record('pad-visual', 'PASS', '768×1024 下列表/阅读/改编对照按区切换，右栏独占内容区，长公式无页面横向溢出，reduced-motion 动画时长为 0s', ['pad-question-list.png', 'pad-aux-exclusive.png', 'pad-copy-compare.png']);

  // Narrow desktop still uses the desktop split and keeps the auxiliary rail in layout.
  const narrowContext = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: origin, viewport: { width: 1100, height: 800 } });
  await bootstrapPrincipal(narrowContext, accounts.a, { origin, dataDir });
  const narrowPage = await narrowContext.newPage();
  attachNetwork(narrowPage, 'narrow-desktop');
  await narrowPage.goto(`/questions/${questionId}`);
  await waitVisible(narrowPage.locator('[data-region="question-reader"]'), '窄桌面题目未加载');
  await narrowPage.locator('.wb-sidebar').getByRole('button', { name: 'AI 助理' }).click();
  await waitVisible(narrowPage.locator('.wb-aux'), '窄桌面右栏未出现');
  visual.narrowDesktop = { pageOverflow: await narrowPage.evaluate(() => document.documentElement.scrollWidth - innerWidth) };
  assert.ok(visual.narrowDesktop.pageOverflow <= 1);
  await screenshot(narrowPage, 'narrow-desktop-aux.png');
  await narrowContext.close();
  record('narrow-desktop-visual', 'PASS', '1100×800 下题目与右栏同时可操作，页面无横向溢出', ['narrow-desktop-aux.png']);

  await activeContext.tracing.stop();
  await activeContext.close();
  activeContext = null;
  activePage = null;
  await runner.close();
  runner = null;
  await browser.close();
  browser = null;

  return { dataDir, questionId, copyId, lessonId };
}

async function runLegacyUpgrade() {
  const dataDir = path.join(dataRoot, 'legacy');
  const legacyOrigin = `https://localhost:${ports.legacy}`;
  const layout = {
    hiddenModuleIds: [],
    groups: [{ id: 'focus', name: 'B16 旧布局', moduleIds: [] }],
    ungroupedModuleIds: []
  };
  let legacyRunner = null;
  try {
    legacyRunner = await startFirstFlowRunner({
      dataDir,
      port: ports.legacy,
      fixtures: [],
      mode: 'none',
      web: 'none',
      reset: true,
      quiet: true
    });
    const registration = await requestJson(legacyOrigin, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'B16 Old Teacher',
        email: 'b16-old-teacher@example.test',
        password: 'b16 old teacher password',
        passwordConfirmation: 'b16 old teacher password'
      }
    });
    assert.equal(registration.status, 201);
    const savedLayout = await requestJson(legacyOrigin, '/api/workspace/layout', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${registration.body.token}` },
      body: layout
    });
    assert.equal(savedLayout.status, 200);
    await legacyRunner.close();
    legacyRunner = null;
    legacyRunner = await startFirstFlowRunner({
      dataDir,
      port: ports.legacy,
      fixtures: [],
      mode: 'test-principal',
      web: webDist,
      reset: false,
      quiet: true
    });
    const login = await requestJson(legacyOrigin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'b16-old-teacher@example.test', password: 'b16 old teacher password' }
    });
    assert.equal(login.status, 200);
    const readLayout = await requestJson(legacyOrigin, '/api/workspace/layout', {
      headers: { Authorization: `Bearer ${login.body.token}` }
    });
    assert.deepEqual(readLayout.body, layout);
    const migrations = legacyRunner.workbench.db.prepare('SELECT id FROM workbench_migrations ORDER BY id').all().map((row) => row.id);
    assert.ok(migrations.some((id) => id.startsWith('questions_')));
    assert.ok(migrations.some((id) => id.startsWith('lessons_')));
    record('old-database-upgrade', 'PASS', '固定基线旧账户和布局在工作台迁移后保留，questions/lessons 迁移均已执行', ['run.json']);
  } finally {
    if (legacyRunner) await legacyRunner.close();
  }
}

function runStartupGuards() {
  const brokenData = path.join(dataRoot, 'broken');
  const broken = spawnSync(process.execPath, [
    'scripts/first-flow/start.mjs',
    '--data-dir', brokenData,
    '--port', String(ports.failure),
    '--fixtures', 'workbench-broken',
    '--web', 'none'
  ], { cwd: runtimeRoot, encoding: 'utf8' });
  fs.writeFileSync(evidencePath('broken-migration.log'), `${broken.stdout ?? ''}\n${broken.stderr ?? ''}\nexit=${broken.status}\n`);
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /fixture migration failed on purpose/);

  const productionData = path.join(dataRoot, 'production');
  const production = spawnSync(process.execPath, ['apps/api/src/server.js'], {
    cwd: runtimeRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(ports.failure),
      SQLITE_PATH: path.join(productionData, 'workspace.sqlite'),
      WORKBENCH_IDENTITY_MODE: 'test-principal',
      WORKBENCH_TEST_PRINCIPALS: accounts.a,
      WORKBENCH_TRUSTED_ORIGINS: `https://localhost:${ports.failure}`
    }
  });
  fs.writeFileSync(evidencePath('production-refusal.log'), `${production.stdout ?? ''}\n${production.stderr ?? ''}\nexit=${production.status}\n`);
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /Refusing to start/);
  record('startup-guards', 'PASS', '故意破损迁移和 production test-principal 均非零退出，原因可定位', ['broken-migration.log', 'production-refusal.log']);
}

function copyServiceLogs(primaryDataDir) {
  const logDir = path.join(primaryDataDir, 'logs');
  if (!fs.existsSync(logDir)) return [];
  const copied = [];
  for (const name of fs.readdirSync(logDir)) {
    const targetName = `service-${name}`;
    fs.copyFileSync(path.join(logDir, name), evidencePath(targetName));
    copied.push(targetName);
  }
  return copied;
}

try {
  assert.equal(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: runtimeRoot, encoding: 'utf8' }).stdout.trim(), candidateSha);
  assert.equal(fs.existsSync(webDist), true, '隔离生产构建不存在');
  const primary = await runPrimaryFlow();
  await runLegacyUpgrade();
  runStartupGuards();
  const serviceLogs = copyServiceLogs(primary.dataDir);
  record('build-isolation', 'PASS', '固定候选的生产构建 exit 0，使用临时 API 数据库，未创建 apps/api/src/data/refatos.sqlite', ['build.log']);
  assert.equal(fs.existsSync(path.join(runtimeRoot, 'apps', 'api', 'src', 'data', 'refatos.sqlite')), false);
  record('service-log-index', 'PASS', `脱敏服务日志已复制：${serviceLogs.join(', ')}`, serviceLogs);
} catch (error) {
  failed = error;
  record('acceptance-run', 'FAIL', error.stack ?? error.message, []);
  if (activePage) {
    try { await screenshot(activePage, 'failure-unexpected.png'); } catch { /* preserve other evidence */ }
  }
  if (activeContext) {
    try { await activeContext.tracing.stop({ path: evidencePath('failure-trace.zip') }); } catch { /* preserve other evidence */ }
  }
} finally {
  try { if (runner) runner.workbench.db.pragma('query_only = OFF'); } catch { /* best effort */ }
  try { if (runner) await runner.close(); } catch { /* best effort */ }
  try { if (activeContext) await activeContext.close(); } catch { /* best effort */ }
  try { if (browser) await browser.close(); } catch { /* best effort */ }
  fs.writeFileSync(evidencePath('network.jsonl'), `${network.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  const result = {
    task: 'B16@1',
    attempt: 2,
    candidate_sha: candidateSha,
    product_code_sha: '723ec00ee47599517302fcdcf61226500c82de0b',
    runtime_root: runtimeRoot,
    identity_mode: 'test-principal',
    origin,
    ports,
    data_root: dataRoot,
    web_dist: builtWebDist,
    served_web_dist: webDist,
    accounts: Object.values(accounts),
    started_at_utc: startedAt,
    finished_at_utc: new Date().toISOString(),
    status: failed ? 'FAIL' : 'PASS',
    checks,
    screenshots,
    visual,
    failure: failed ? { message: failed.message, stack: failed.stack } : null
  };
  fs.writeFileSync(evidencePath('run.json'), `${JSON.stringify(result, null, 2)}\n`);
}

if (failed) process.exitCode = 1;
