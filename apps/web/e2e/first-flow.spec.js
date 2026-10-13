/**
 * B15 integration E2E: the first flow on the real service.
 *
 * Every test runs against this worktree's real composition - production Web
 * build, real API, real SQLite, one HTTPS origin, runner-bound test identities -
 * started in-process by `first-flow/service.js`. Nothing is substituted: the
 * question writes go through the frozen HTTP contract, the faults act on
 * the real transaction boundary, and the API stop/restart keeps the same
 * database directory.
 *
 * Identity is `test-principal` (A11 real authentication is a separate,
 * unfinished deliverable); a pass here is B15 self evidence for the integrated
 * candidate and does not replace B16 independent acceptance.
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bootstrapPrincipal } from './fixtures/first-flow/identity.js';
import { loseCommittedResponses } from './first-flow/faults.js';
import {
  B15_ACCOUNTS,
  B15_DATA_DIR,
  B15_ORIGIN,
  B15_PORT,
  B15_REPO_ROOT,
  B15_WEB_DIST,
  createFirstFlowService
} from './first-flow/service.js';

const EVIDENCE = path.join(B15_REPO_ROOT, 'test-results', 'evidence', 'B15', 'v1');
const PASS_SHOTS = path.join(EVIDENCE, 'pass');
const FAULT_SHOTS = path.join(EVIDENCE, 'failures');

const service = createFirstFlowService();
const uuid = () => crypto.randomUUID();
let sidecarWritten = false;

/** Evidence sidecar: which candidate, identity, ports and fault switches ran. */
function writeRunSidecar(runner) {
  fs.writeFileSync(path.join(EVIDENCE, 'run.json'), `${JSON.stringify({
    task: 'B15@1',
    identity_mode: 'test-principal',
    origin: B15_ORIGIN,
    port: B15_PORT,
    data_dir: B15_DATA_DIR,
    web_dist: B15_WEB_DIST,
    accounts: Object.values(B15_ACCOUNTS),
    candidate_sha: runner.sha,
    database: path.join(B15_DATA_DIR, 'data', 'workspace.sqlite'),
    faults: {
      real_write_failure: "runner.workbench.db.pragma('query_only = ON')",
      committed_response_loss: 'Playwright route.fetch() then route.abort() on matching writes',
      api_stop: 'runner.close() then a new runner on the same data directory'
    }
  }, null, 2)}\n`, 'utf-8');
  sidecarWritten = true;
}

test.beforeAll(async () => {
  fs.mkdirSync(PASS_SHOTS, { recursive: true });
  fs.mkdirSync(FAULT_SHOTS, { recursive: true });
  if (process.env.B15_SKIP_BUILD !== '1') {
    // Build into this suite's isolated directory: `npm run test:e2e` may run
    // another spec that rebuilds `apps/web/dist` at the same time.
    fs.rmSync(B15_WEB_DIST, { recursive: true, force: true });
    execFileSync(path.join(B15_REPO_ROOT, 'node_modules', '.bin', 'vite'), [
      'build', '--outDir', B15_WEB_DIST, '--emptyOutDir'
    ], {
      cwd: path.join(B15_REPO_ROOT, 'apps', 'web'),
      env: { ...process.env, VITE_API_BASE_URL: '/api' },
      stdio: 'inherit'
    });
  }
  if (!fs.existsSync(path.join(B15_WEB_DIST, 'index.html'))) {
    throw new Error(`No frozen Web build at ${B15_WEB_DIST}; run without B15_SKIP_BUILD=1 first.`);
  }
});

test.afterAll(async () => {
  await service.stop();
});

test.use({
  baseURL: B15_ORIGIN,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  video: 'on'
});

test.beforeEach(async ({ context }) => {
  const runner = await service.start({ reset: true });
  if (!sidecarWritten) writeRunSidecar(runner);
  await bootstrapPrincipal(context, B15_ACCOUNTS.a, { origin: B15_ORIGIN, dataDir: B15_DATA_DIR });
});

test.afterEach(async ({}, testInfo) => {
  // Keep this scenario's request/error index next to the screenshots, then drop
  // the storage fault and the runner even when the test failed.
  try {
    const runnerLogs = path.join(B15_DATA_DIR, 'logs');
    if (fs.existsSync(runnerLogs)) {
      const target = path.join(EVIDENCE, 'logs', testInfo.title.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 90));
      fs.mkdirSync(target, { recursive: true });
      for (const name of fs.readdirSync(runnerLogs)) {
        fs.copyFileSync(path.join(runnerLogs, name), path.join(target, name));
      }
    }
  } finally {
    await service.allowWrites();
    await service.stop();
  }
});

/* ------------------------------------------------------------------ helpers */

/** Inputs are addressed by their exact aria-label. */
function field(page, name) {
  return page.locator(`input[aria-label="${name}"], textarea[aria-label="${name}"]`);
}

function saveStatus(page) {
  return page.locator('[data-save-status]').first();
}

/**
 * A confirmed save can read as `saved` (same page) or `clean` (after the route
 * switched to the created object and reloaded it). Both must show 已保存.
 */
async function expectSaved(page) {
  await expect(saveStatus(page)).toContainText('已保存');
  await expect.poll(async () => saveStatus(page).getAttribute('data-save-status')).toMatch(/^(saved|clean)$/);
}

async function fillParagraph(page, editor, label, text) {
  await page.locator(`[data-document-editor="${editor}"]`).getByRole('button', { name: '段落', exact: true }).click();
  const input = field(page, label);
  await input.fill(text);
  return input;
}

async function addFormula(page, editor) {
  await page.locator(`[data-document-editor="${editor}"]`).getByRole('button', { name: '公式', exact: true }).click();
}

function documentBody(text, latex) {
  return {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        runs: [{ type: 'text', text }, ...(latex ? [{ type: 'math', latex }] : [])]
      },
      ...(latex ? [{ type: 'math', latex }] : [])
    ]
  };
}

/** Same-origin API call through the browser session (never a runner shortcut). */
async function apiRead(page, apiPath) {
  const response = await page.request.get(`${B15_ORIGIN}${apiPath}`);
  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function apiWrite(page, method, apiPath, body, key = uuid()) {
  const response = await page.request.fetch(`${B15_ORIGIN}${apiPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'X-TeachBuddy-Request': '1',
      Origin: B15_ORIGIN,
      'Idempotency-Key': key
    },
    data: body
  });
  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function seedQuestion(page, { title = '二次函数最小值', text = '已知函数 ', latex = 'f(x)=x^2-2x', note = '', solution = '答案 -1' } = {}) {
  const result = await apiWrite(page, 'POST', '/api/modules/questions/items', {
    title,
    body: documentBody(text, latex),
    solution: documentBody(solution),
    note,
    starred: false,
    source: { kind: 'manual' }
  });
  expect(result.status).toBe(201);
  return result.body;
}

async function openQuestion(page, id) {
  await page.goto(`/questions/${id}`);
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
}

async function shot(page, dir, name) {
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function waitForBoot(page) {
  await expect(page.locator('.wb-nav-row').first()).toBeVisible();
}

/** Fill the new-question editor through real UI input; saving is the caller's step. */
async function fillNewQuestion(page, { title, text, latex, solution, note } = {}) {
  await page.goto('/questions/new-manual');
  await waitForBoot(page);
  if (title) await field(page, '标题').fill(title);
  await fillParagraph(page, '题面', '题面段落 1', text);
  if (latex) {
    await addFormula(page, '题面');
    await field(page, '题面公式 1源').fill(latex);
  }
  if (solution) await fillParagraph(page, '答案', '答案段落 1', solution);
  if (note) await field(page, '教学笔记').fill(note);
}

/** Save the open editor, wait for the confirmed reader, and return the object id. */
async function saveQuestion(page) {
  await page.locator('button[name="save"]').click();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  await expectSaved(page);
  return page.url().split('/questions/')[1];
}

/* ------------------------------------------------------- 录题、改编 */

test('WB-001/002/003 录题：真实服务保存含公式题目，搜索、刷新与编辑升版', async ({ page }) => {
  await page.goto('/questions');
  await waitForBoot(page);
  await expect(page.locator('[data-region="list-empty"]')).toContainText('题库为空');

  await fillNewQuestion(page, {
    title: '二次函数最小值',
    text: '已知函数 ',
    latex: 'f(x)=x^2-2x',
    solution: '当 x=1 时取最小值 -1。',
    note: '先让学生尝试配方。'
  });
  await expect(page.locator('.wb-math-block-preview .katex').first()).toBeVisible();
  const id = await saveQuestion(page);
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  await shot(page, PASS_SHOTS, 'PC-录题阅读');

  // The real API is the only source of truth for the stored object.
  const stored = await apiRead(page, `/api/modules/questions/items/${id}`);
  expect(stored.status).toBe(200);
  expect(stored.body.version).toBe(1);
  expect(stored.body.source.kind).toBe('manual');
  expect(stored.body.body.blocks[1].latex).toBe('f(x)=x^2-2x');

  await field(page, '搜索题目').fill('配方');
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  await field(page, '搜索题目').fill('不存在的关键词');
  await expect(page.locator('[data-region="list-empty"]')).toBeVisible();
  await field(page, '搜索题目').fill('');
  await page.reload();
  await expect(page.locator('[data-region="question-reader"]')).toContainText('已知函数');
  expect(page.url()).toContain(id);

  await page.locator('button[name="edit"]').click();
  await field(page, '题面段落 1').fill('已知函数 f(x)=x^2-2x，求最小值并说明理由。');
  await page.locator('button[name="save"]').click();
  await expectSaved(page);
  expect(page.url()).toContain(id);
  const edited = await apiRead(page, `/api/modules/questions/items/${id}`);
  expect(edited.body.version).toBe(2);
  expect(edited.body.source.kind).toBe('manual');
  await shot(page, PASS_SHOTS, 'PC-编辑后已保存');
});

test('WB-004 改编：复制对照、草稿返回后继续、保存生成独立题目且原题不变', async ({ page }) => {
  const question = await seedQuestion(page, { note: '原题笔记' });
  await openQuestion(page, question.id);
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('menuitem', { name: '复制修改' }).click();
  await expect(page.locator('[data-region="copy-compare"]')).toBeVisible();
  await expect(page.locator('[data-region="compare-source"]')).toContainText('原题采用版本 1');
  await field(page, '题面公式 1源').fill('g(x)=x^2-4x');
  await field(page, '答案段落 1').fill('x=2 时最小值 -4');
  await shot(page, PASS_SHOTS, 'PC-改编对照');

  await page.goto('/questions');
  await expect(page.locator('[data-region="drafts"]')).toContainText('改编草稿');
  await page.locator('[data-region="drafts"] .wb-draft-row').click();
  await expect(field(page, '题面公式 1源')).toHaveValue('g(x)=x^2-4x');
  await page.reload();
  await expect(field(page, '题面公式 1源')).toHaveValue('g(x)=x^2-4x');

  await page.locator('button[name="save"]').click();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  await expectSaved(page);
  const copyId = page.url().split('/questions/')[1];
  expect(copyId).not.toBe(question.id);
  const original = await apiRead(page, `/api/modules/questions/items/${question.id}`);
  expect(original.body.version).toBe(1);
  expect(original.body.note).toBe('原题笔记');
  const copy = await apiRead(page, `/api/modules/questions/items/${copyId}`);
  expect(copy.body.source.kind).toBe('copy');
  expect(copy.body.source.questionId).toBe(question.id);
  expect(copy.body.source.snapshot.body.blocks[1].latex).toBe('f(x)=x^2-2x');
  expect(copy.body.body.blocks[1].latex).toBe('g(x)=x^2-4x');

  await openQuestion(page, question.id);
  await expect(page.locator('[data-region="derivatives"]')).toContainText('改编');
  await openQuestion(page, copyId);
  await expect(page.locator('[data-field="source"]')).toContainText('改编自');
  await shot(page, PASS_SHOTS, 'PC-改编来源');
});

test('B15 核心链路：录题 → 改编 → 刷新 → API 重启后同一 ID 继续', async ({ page, browser }) => {
  // 1. 录题
  await fillNewQuestion(page, { title: '核心链路原题', text: '已知函数 ', latex: 'f(x)=x^2-2x' });
  const questionId = await saveQuestion(page);

  // 2. 改编
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('menuitem', { name: '复制修改' }).click();
  await field(page, '题面公式 1源').fill('g(x)=x^2-4x');
  const copyId = await saveQuestion(page);
  expect(copyId).not.toBe(questionId);

  await page.goto(`/questions/${questionId}`);
  await page.reload();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  await service.restart({ reset: false });
  await page.reload();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  const questionAfterRestart = await apiRead(page, `/api/modules/questions/items/${questionId}`);
  expect(questionAfterRestart.body.body.blocks[1].latex).toBe('f(x)=x^2-2x');
  const copyAfterRestart = await apiRead(page, `/api/modules/questions/items/${copyId}`);
  expect(copyAfterRestart.body.source.questionId).toBe(questionId);

  // 7. 新浏览器上下文读同一对象：结果来自服务端，不是本地现场
  const fresh = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: B15_ORIGIN });
  try {
    await bootstrapPrincipal(fresh, B15_ACCOUNTS.a, { origin: B15_ORIGIN, dataDir: B15_DATA_DIR });
    const freshPage = await fresh.newPage();
    await freshPage.goto(`/questions/${questionId}`);
    await expect(freshPage.locator('[data-region="question-reader"]')).toContainText('已知函数');
    await shot(freshPage, PASS_SHOTS, 'PC-重启后新上下文');
  } finally {
    await fresh.close();
  }
});

/* ------------------------------------------------- 保存反馈与故障（真实故障） */

test('WB-012 提交后响应丢失：不冒充已保存，同键重试只写一次', async ({ page }) => {
  await page.goto('/questions/new-manual');
  await waitForBoot(page);
  await fillParagraph(page, '题面', '题面段落 1', '响应丢失也要保住的题面');
  const loss = await loseCommittedResponses(page, '**/api/modules/questions/items', { method: 'POST' });
  await page.locator('button[name="save"]').click();
  await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'unconfirmed');
  await expect(saveStatus(page)).toContainText('暂时无法确认是否保存');
  await expect(field(page, '题面段落 1')).toHaveValue('响应丢失也要保住的题面');
  expect(loss.dropped()).toBeGreaterThanOrEqual(1);
  // The write really committed on the server even though the browser saw a failure.
  expect(service.countRows('question_items')).toBe(1);
  await shot(page, FAULT_SHOTS, 'F-未确认保存');

  await loss.clear();
  await page.reload();
  await expect(field(page, '题面段落 1')).toHaveValue('响应丢失也要保住的题面');
  await page.locator('button[name="retry-confirm"]').click();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  await expectSaved(page);
  expect(service.countRows('question_items')).toBe(1);
  const id = page.url().split('/questions/')[1];
  const stored = await apiRead(page, `/api/modules/questions/items/${id}`);
  expect(stored.body.version).toBe(1);
  expect(stored.body.body.blocks[0].runs[0].text).toBe('响应丢失也要保住的题面');
  await shot(page, PASS_SHOTS, 'PC-响应丢失后重试确认');
});

test('WB-011/018 真实写失败：明确 503、业务与幂等记录都无部分写、恢复后同键重试成功一次', async ({ page }) => {
  // Direct real HTTP proof first: the storage fault must answer the contract
  // 503 and leave neither a business row nor a successful-request record.
  service.refuseWrites();
  const blocked = await apiWrite(page, 'POST', '/api/modules/questions/items', {
    title: '被存储拒绝的题',
    body: documentBody('不会写入的题面'),
    solution: documentBody('不会写入的答案'),
    note: '',
    starred: false,
    source: { kind: 'manual' }
  });
  expect(blocked.status).toBe(503);
  expect(blocked.body.type).toBe('/problems/workbench/temporarily-unavailable');
  expect(service.countRows('question_items')).toBe(0);
  expect(service.countRows('workbench_mutation_keys')).toBe(0);

  await page.goto('/questions/new-manual');
  await waitForBoot(page);
  await fillParagraph(page, '题面', '题面段落 1', '服务失败时也不能丢的题面');
  await page.locator('button[name="save"]').click();
  await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'unconfirmed');
  await expect(saveStatus(page)).toContainText('暂时无法确认是否保存');
  await expect(field(page, '题面段落 1')).toHaveValue('服务失败时也不能丢的题面');
  expect(service.countRows('question_items')).toBe(0);
  expect(service.countRows('workbench_mutation_keys')).toBe(0);
  await shot(page, FAULT_SHOTS, 'F-写入失败未确认');

  service.allowWrites();
  await page.reload();
  await expect(field(page, '题面段落 1')).toHaveValue('服务失败时也不能丢的题面');
  await page.locator('button[name="retry-confirm"]').click();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  await expectSaved(page);
  expect(service.countRows('question_items')).toBe(1);
  expect(service.countRows('workbench_mutation_keys')).toBe(1);
  const id = page.url().split('/questions/')[1];
  expect((await apiRead(page, `/api/modules/questions/items/${id}`)).body.version).toBe(1);
  await shot(page, PASS_SHOTS, 'PC-写入失败后恢复');
});

test('WB-011/019 API 停止：业务内容不冒充可用、草稿保留；重启后继续并读回同一 ID', async ({ page }) => {
  const question = await seedQuestion(page, { title: '重启后还在的题' });
  await page.goto('/questions');
  await waitForBoot(page);
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  await page.locator('button[name="new-manual"]').click();
  await fillParagraph(page, '题面', '题面段落 1', 'API 停止期间编辑的题面');

  await service.stop();
  await page.locator('button[name="save"]').click();
  await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'unconfirmed');
  await expect(field(page, '题面段落 1')).toHaveValue('API 停止期间编辑的题面');
  await shot(page, FAULT_SHOTS, 'F-API停止未确认');

  // A real user action (search) asks the service while it is down: the list
  // keeps the content it already has and reports the failed read instead of
  // silently showing an empty list.
  await page.locator('.wb-nav-row', { hasText: '题库' }).click();
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  await field(page, '搜索题目').fill('重启');
  await expect(page.locator('[data-region="list-error"]')).toBeVisible();
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  await shot(page, FAULT_SHOTS, 'F-API停止读取失败');

  // Restart on the same database: the existing object reads back, the pending
  // draft is replayed with its original key exactly once.
  await service.start({ reset: false });
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.locator('[data-region="list-error"]')).toHaveCount(0);
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  const readBack = await apiRead(page, `/api/modules/questions/items/${question.id}`);
  expect(readBack.status).toBe(200);
  expect(readBack.body.title).toBe('重启后还在的题');

  await page.locator('[data-region="drafts"] .wb-draft-row').first().click();
  await expect(field(page, '题面段落 1')).toHaveValue('API 停止期间编辑的题面');
  await page.locator('button[name="retry-confirm"]').click();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  await expectSaved(page);
  expect(service.countRows('question_items')).toBe(2);
  await shot(page, PASS_SHOTS, 'PC-API重启后继续');
});

/* ------------------------------------------------------- 冲突、删除与身份边界 */

test('WB-013 版本冲突：保留本地输入、对照服务器版本并显式采用', async ({ page }) => {
  const question = await seedQuestion(page);
  await openQuestion(page, question.id);
  await page.locator('button[name="edit"]').click();
  await field(page, '题面段落 1').fill('本页的修改');
  await apiWrite(page, 'PUT', `/api/modules/questions/items/${question.id}`, {
    baseVersion: 1,
    title: question.title,
    body: documentBody('别处改成的题面'),
    solution: documentBody('别处的答案'),
    note: '',
    starred: false
  });
  await page.locator('button[name="save"]').click();
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await expect(field(page, '题面段落 1')).toHaveValue('本页的修改');
  await page.getByRole('button', { name: '查看服务器版本' }).click();
  await expect(page.locator('[data-region="server-version"]')).toContainText('别处改成的题面');
  await shot(page, PASS_SHOTS, 'PC-版本冲突对照');

  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('button[name="adopt-server"]').click();
  await expect(field(page, '题面段落 1')).toHaveValue('别处改成的题面');
  await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'clean');
});

test('WB-009 删除与恢复：恢复使用原 ID 且原题内容保留', async ({ page }) => {
  const question = await seedQuestion(page, { title: '被引用的题目' });
  await openQuestion(page, question.id);
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('menuitem', { name: '删除题目' }).click();
  await page.locator('button[name="dialog-confirm"]').click();
  await expect(page.locator('[data-region="question-deleted"]')).toBeVisible();
  await shot(page, FAULT_SHOTS, 'F-已删除可恢复');

  await page.goto('/questions');
  await page.getByRole('button', { name: '已删除' }).click();
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  await page.locator('[data-region="question-rows"] [data-row-open]').first().click();
  await page.getByRole('button', { name: '更多操作' }).click();
  await page.getByRole('menuitem', { name: '恢复题目' }).click();
  await expect(page.locator('[data-region="question-deleted"]')).toHaveCount(0);
  expect(page.url()).toContain(question.id);
  await shot(page, PASS_SHOTS, 'PC-恢复后同ID');
});

test('WB-014 公式预览失败与未知文档版本：就地提示、源内容仍可保存、未来版本只读保留', async ({ page }) => {
  await page.goto('/questions/new-manual');
  await waitForBoot(page);
  await fillParagraph(page, '题面', '题面段落 1', '已知函数 ');
  await addFormula(page, '题面');
  await field(page, '题面公式 1源').fill('\\frac{1}{');
  await expect(page.locator('[data-formula-failed]').first()).toContainText('公式预览失败');
  await expect(page.locator('[data-formula-failed]').first()).toContainText('\\frac{1}{');
  await shot(page, FAULT_SHOTS, 'F-公式预览失败');
  await page.locator('button[name="save"]').click();
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
  await expectSaved(page);
  const brokenId = page.url().split('/questions/')[1];
  const stored = await apiRead(page, `/api/modules/questions/items/${brokenId}`);
  expect(stored.body.body.blocks[1].latex).toBe('\\frac{1}{');

  // A document written by a later app version is kept readable and read-only;
  // the controlled seed only writes what a future release could have stored.
  const question = await seedQuestion(page);
  service.seedFutureQuestionBody(question.id, {
    version: 2,
    blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '来自更新版本的内容' }] }]
  });
  await openQuestion(page, question.id);
  await expect(page.locator('[data-region="question-reader"]')).toContainText('来自更新版本的内容');
  await page.locator('button[name="edit"]').click();
  await expect(page.locator('[data-region="unsupported-version"]')).toContainText('只读保留');
  await expect(page.locator('[data-document-editor="题面"] textarea')).toHaveCount(0);
  await page.locator('button[name="save"]').click();
  await expect(page.locator('[data-field="body"] .wb-field-error').first()).toContainText('不能保存');
  const after = await apiRead(page, `/api/modules/questions/items/${question.id}`);
  expect(after.body.version).toBe(1);
  expect(after.body.body.version).toBe(2);
  await shot(page, FAULT_SHOTS, 'F-未知文档版本只读');
});

test('WB-018 明确拒绝：空白题面本地定位并保留输入，服务端同样拒绝', async ({ page }) => {
  await page.goto('/questions/new-manual');
  await waitForBoot(page);
  await fillParagraph(page, '题面', '题面段落 1', '   ');
  await page.locator('button[name="save"]').click();
  await expect(page.locator('[data-region="question-editor"]')).toBeVisible();
  await expect(page.locator('[data-field="body"] .wb-field-error')).toContainText('不能只有空白');
  await expect(field(page, '题面段落 1')).toHaveValue('   ');
  await shot(page, FAULT_SHOTS, 'F-空白题面拒绝');
  const empty = await apiWrite(page, 'POST', '/api/modules/questions/items', {
    title: '',
    body: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '   ' }] }] },
    solution: { version: 1, blocks: [] },
    note: '',
    starred: false,
    source: { kind: 'manual' }
  });
  expect(empty.status).toBe(422);
  expect(empty.body.reason).toBe('empty-content');
  expect(service.countRows('question_items')).toBe(0);
});

test('WB-016/018 真实 HTTP 拒绝：无身份、错误来源、缺保护头与同键改体', async ({ page, request }) => {
  // No workbench session at all: contract 401 before anything else.
  const anonymous = await request.get(`${B15_ORIGIN}/api/workbench/context`);
  expect(anonymous.status()).toBe(401);
  expect(await anonymous.json()).toEqual({ type: '/problems/workbench/unauthenticated' });
  const anonymousWrite = await request.post(`${B15_ORIGIN}/api/modules/questions/items`, {
    headers: {
      'content-type': 'application/json',
      'X-TeachBuddy-Request': '1',
      Origin: B15_ORIGIN,
      'Idempotency-Key': uuid()
    },
    data: { title: 'x', body: documentBody('x'), solution: documentBody('y'), note: '', starred: false, source: { kind: 'manual' } }
  });
  expect(anonymousWrite.status()).toBe(401);

  // A write from an untrusted origin and one without the protection header are
  // both 403 request-not-allowed, before identity and before any business change.
  const payload = {
    title: '来源被拒绝的题',
    body: documentBody('不会写入的题面'),
    solution: documentBody('不会写入的答案'),
    note: '',
    starred: false,
    source: { kind: 'manual' }
  };
  const wrongOrigin = await page.request.fetch(`${B15_ORIGIN}/api/modules/questions/items`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-TeachBuddy-Request': '1',
      Origin: 'https://not-the-runner.test',
      'Idempotency-Key': uuid()
    },
    data: payload
  });
  expect(wrongOrigin.status()).toBe(403);
  expect((await wrongOrigin.json()).type).toBe('/problems/workbench/request-not-allowed');

  const missingProtection = await page.request.fetch(`${B15_ORIGIN}/api/modules/questions/items`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Origin: B15_ORIGIN,
      'Idempotency-Key': uuid()
    },
    data: payload
  });
  expect(missingProtection.status()).toBe(403);
  expect(service.countRows('question_items')).toBe(0);

  // Same key, different body: an explicit conflict, and the original object stays.
  const key = uuid();
  const first = await apiWrite(page, 'POST', '/api/modules/questions/items', payload, key);
  expect(first.status).toBe(201);
  const reused = await apiWrite(page, 'POST', '/api/modules/questions/items', {
    ...payload,
    title: '同键的另一份请求体'
  }, key);
  expect(reused.status).toBe(409);
  expect(reused.body.type).toBe('/problems/workbench/idempotency-key-reused');
  expect(service.countRows('question_items')).toBe(1);
  const stored = await apiRead(page, `/api/modules/questions/items/${first.body.id}`);
  expect(stored.body.title).toBe('来源被拒绝的题');
});

test('WB-016/017 身份：另一账户看不到题目与草稿；身份失效隐藏内容并保留草稿', async ({ page, context }) => {
  const question = await seedQuestion(page, { title: 'A 的题目' });
  await page.goto('/questions/new-manual');
  await waitForBoot(page);
  await fillParagraph(page, '题面', '题面段落 1', 'A 未上传的草稿');
  await expect(page.locator('.wb-draft-hint')).toBeVisible();

  await context.clearCookies();
  await bootstrapPrincipal(context, B15_ACCOUNTS.b, { origin: B15_ORIGIN, dataDir: B15_DATA_DIR });
  await page.reload();
  await expect(page.locator('[data-region="list-empty"]')).toContainText('题库为空');
  await expect(page.locator('[data-region="drafts"]')).toHaveCount(0);
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(0);
  const otherView = await page.evaluate(async () => (await (await fetch('/api/modules/questions/items', { credentials: 'same-origin' })).json()));
  expect(otherView.items).toHaveLength(0);
  await shot(page, PASS_SHOTS, 'PC-另一账户隔离');

  // 身份失效：清掉会话后业务内容隐藏，草稿保留
  await context.clearCookies();
  await page.goto('/questions/new-manual');
  await expect(page.locator('[data-region="identity-gate"]')).toContainText('身份已失效');
  await expect(page.locator('[data-region="question-editor"]')).toHaveCount(0);
  await shot(page, FAULT_SHOTS, 'F-身份失效');

  await bootstrapPrincipal(context, B15_ACCOUNTS.a, { origin: B15_ORIGIN, dataDir: B15_DATA_DIR });
  await page.getByRole('button', { name: '重新检查身份' }).click();
  await expect(field(page, '题面段落 1')).toHaveValue('A 未上传的草稿');
  const listAfter = await apiRead(page, '/api/modules/questions/items');
  expect(listAfter.body.items.map((item) => item.id)).toContain(question.id);
});

/* ------------------------------------------------------------- 布局与视觉 */

test('U0-U7 桌面 1440×900：两区约 35:65、区域间隙、独立滚动与右栏占位', async ({ page }) => {
  await seedQuestion(page, { title: '几何检查题' });
  await page.goto('/questions');
  await waitForBoot(page);
  const listBox = await page.locator('[data-region="question-list"]').boundingBox();
  const contentBox = await page.locator('[data-region="question-pane"]').boundingBox();
  const ratio = listBox.width / (listBox.width + contentBox.width);
  expect(ratio).toBeGreaterThan(0.3);
  expect(ratio).toBeLessThan(0.4);
  const gap = contentBox.x - (listBox.x + listBox.width);
  expect(gap).toBeGreaterThan(6);

  const mainWidthBefore = (await page.locator('[data-region="main"]').boundingBox()).width;
  await page.locator('.wb-sidebar').getByRole('button', { name: 'AI 助理' }).click();
  await expect(page.locator('.wb-aux')).toBeVisible();
  const mainWidthAfter = (await page.locator('[data-region="main"]').boundingBox()).width;
  expect(mainWidthAfter).toBeLessThan(mainWidthBefore);
  await shot(page, PASS_SHOTS, 'PC-桌面右栏');

  for (let index = 0; index < 30; index += 1) await seedQuestion(page, { title: `滚动题 ${index}` });
  await page.reload();
  await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(31);
  const scrollArea = page.locator('[data-region="question-list-scroll"]');
  await scrollArea.evaluate((node) => { node.scrollTop = 200; });
  await expect.poll(() => scrollArea.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('[data-region="question-pane"]').evaluate((node) => node.scrollTop)).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, PASS_SHOTS, 'PC-桌面几何');
});

test.describe('平板 768×1024', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

});
