/**
 * T51 browser self-verification on the real service.
 *
 * Every scenario runs against this worktree's real classes module: real HTTP,
 * real SQLite, real idempotency ledger and real account sessions on one HTTPS
 * origin (`teaching-time-classes/service.js`). The page is the real
 * `features/classes` feature mounted by a minimal test shell, because the
 * product shell assembly is T53's exclusive work; that limitation is recorded in
 * the T51 receipt.
 *
 * Scenarios map to WB-T001, WB-T002, WB-T003, WB-T017, WB-T018 and WB-T019 in
 * docs/acceptance/teaching-time.feature. Identity is `test-principal`
 * (A11 real authentication is a separate, unfinished deliverable).
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { bootstrapPrincipal } from './fixtures/first-flow/identity.js';
import { loseCommittedResponses } from './first-flow/faults.js';
import {
  T51_ACCOUNTS,
  T51_DATA_DIR,
  T51_ORIGIN,
  T51_PORT,
  T51_REPO_ROOT,
  T51_WEB_DIST,
  createTeachingTimeClassesService
} from './teaching-time-classes/service.js';

const EVIDENCE = path.join(T51_REPO_ROOT, 'test-results', 'evidence', 'T51-MATH', 'v1', 'regression');
const PASS_SHOTS = path.join(EVIDENCE, 'pass');
const FAULT_SHOTS = path.join(EVIDENCE, 'failures');

const service = createTeachingTimeClassesService();
const uuid = () => crypto.randomUUID();

test.beforeAll(() => {
  fs.mkdirSync(PASS_SHOTS, { recursive: true });
  fs.mkdirSync(FAULT_SHOTS, { recursive: true });
  if (process.env.T51_SKIP_BUILD !== '1') {
    fs.rmSync(T51_WEB_DIST, { recursive: true, force: true });
    execFileSync(path.join(T51_REPO_ROOT, 'node_modules', '.bin', 'vite'), [
      'build',
      '--config',
      path.join(T51_REPO_ROOT, 'apps', 'web', 'e2e', 'teaching-time-classes', 'vite.config.mjs')
    ], {
      cwd: T51_REPO_ROOT,
      env: { ...process.env, T51_WEB_DIST },
      stdio: 'inherit'
    });
  }
  const candidateSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: T51_REPO_ROOT, encoding: 'utf-8' }).trim();
  fs.writeFileSync(path.join(EVIDENCE, 'run.json'), `${JSON.stringify({
    task: 'T51-MATH@1',
    candidate_sha: candidateSha,
    identity_mode: 'test-principal',
    origin: T51_ORIGIN,
    port: T51_PORT,
    data_dir: T51_DATA_DIR,
    web_dist: T51_WEB_DIST,
    accounts: Object.values(T51_ACCOUNTS),
    database: path.join(T51_DATA_DIR, 'data', 'workspace.sqlite'),
    fixture: 'apps/api/test/fixtures/teaching-time-classes (real classes module + real questions service read port)',
    faults: {
      committed_response_loss: 'Playwright route.fetch() then route.abort() on POST records',
      api_stop: 'service.stop() then start() on the same data directory',
      storage_refusal: "runner.workbench.db.pragma('query_only = ON')"
    }
  }, null, 2)}\n`, 'utf-8');
});

test.afterAll(async () => {
  await service.stop();
});

test.use({
  baseURL: T51_ORIGIN,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  video: 'on'
});

test.beforeEach(async ({ context }) => {
  await service.start({ reset: true });
  await bootstrapPrincipal(context, T51_ACCOUNTS.a, { origin: T51_ORIGIN, dataDir: T51_DATA_DIR });
});

test.afterEach(async () => {
  try {
    service.allowWrites();
  } finally {
    await service.stop();
  }
});

/* ------------------------------------------------------------------ helpers */

function field(page, name) {
  return page.locator(`input[aria-label="${name}"], textarea[aria-label="${name}"]`);
}

async function apiRead(page, apiPath) {
  const response = await page.request.get(`${T51_ORIGIN}${apiPath}`);
  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function apiWrite(page, method, apiPath, body, key = uuid()) {
  const response = await page.request.fetch(`${T51_ORIGIN}${apiPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'X-TeachBuddy-Request': '1',
      Origin: T51_ORIGIN,
      'Idempotency-Key': key
    },
    data: body
  });
  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function seedClass(page, name) {
  const created = await apiWrite(page, 'POST', '/api/modules/classes/items', { name });
  expect(created.status).toBe(201);
  return created.body;
}

async function seedQuestion(page, title) {
  const created = await apiWrite(page, 'POST', '/api/modules/questions/items', {
    title,
    body: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: title }] }] },
    solution: { version: 1, blocks: [] }, note: '', starred: false, source: { kind: 'manual' }
  });
  expect(created.status).toBe(201);
  return created.body;
}

async function seedRecord(page, { classId, recordedOn, note, position = '', sources = [] }) {
  const created = await apiWrite(page, 'POST', '/api/modules/classes/v2/records', {
    classId,
    recordedOn,
    note,
    position,
    unfinished: '',
    commonIssues: '',
    nextNote: '',
    sources
  });
  expect(created.status).toBe(201);
  return created.body;
}

async function shot(page, dir, name) {
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - window.innerWidth
  ))).toBeLessThanOrEqual(1);
}

/* ------------------------------------------------------------ 一句话与现场 */

test('WB-T001/TT-U2 一句话就是有效记录，刷新与保留库重启后仍在', async ({ page }) => {
  await page.goto('/classes');
  await expect(page.locator('[data-region="class-empty"]')).toContainText('还没有班级');

  await page.locator('button[name="new-class"]').click();
  await field(page, '班级名称').fill('高一(1)班');
  await page.locator('button[name="create-class"]').click();
  await expect(page.locator('[data-region="class-detail"]')).toContainText('高一(1)班');
  expect(page.url()).toContain('/classes/');

  const composer = page.locator('[data-region="record-composer"]');
  await expect(composer).toBeVisible();
  await expect(composer.locator('textarea[aria-label="写一句"]')).toBeVisible();
  await expect(page.locator('[data-region="record-empty"]')).toContainText('先写一句');
  await shot(page, PASS_SHOTS, 'PC-班级-空态与快记');

  await field(page, '写一句').fill('例2没讲，任意性还需强调');
  await page.locator('button[name="save-record"]').click();
  await expect(page.locator('[data-region="composer-status"]')).toContainText('已保存');
  await expect(page.locator('[data-region="record-rows"] [data-record-id]')).toHaveCount(1);
  await expect(page.locator('[data-region="record-rows"]')).toContainText('例2没讲，任意性还需强调');
  await expect(field(page, '写一句')).toHaveValue('');
  // The date defaulted without any extra action; only a sentence and one save were needed.
  const today = await field(page, '记录日期').inputValue();
  expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await shot(page, PASS_SHOTS, 'PC-一句话已保存');

  await page.reload();
  await expect(page.locator('[data-region="record-rows"]')).toContainText('例2没讲，任意性还需强调');

  await service.restart();
  await page.reload();
  await expect(page.locator('[data-region="record-rows"]')).toContainText('例2没讲，任意性还需强调');
  const stored = await apiRead(page, '/api/modules/classes/items');
  expect(stored.body.items.map((item) => item.name)).toContain('高一(1)班');
  expect(service.countRows('classes_records')).toBe(1);
  await shot(page, PASS_SHOTS, 'PC-重启后同一记录');

  await expectNoHorizontalOverflow(page);
});

test('WB-T002/TT-U2 补充字段、最近实际位置、删除回退与恢复', async ({ page }) => {
  const classroom = await seedClass(page, '高一(1)班');
  const first = await seedRecord(page, {
    classId: classroom.id,
    recordedOn: '2026-09-19',
    note: '第一次课',
    position: '定义讲完'
  });
  await seedRecord(page, { classId: classroom.id, recordedOn: '2026-09-21', note: '第二次课' });

  await page.goto(`/classes/${classroom.id}`);
  await expect(page.locator('[data-region="latest-position"]')).toContainText('定义讲完');
  await expect(page.locator('[data-region="record-rows"] [data-record-id]')).toHaveCount(2);

  // Supplement the newest record through the real editor.
  await page.locator(`[data-record-id="${first.id}"] button[name="record-open"]`).click();
  await expect(page.locator(`[data-record-id="${first.id}"] [data-region="record-editor"]`)).toBeVisible();
  await field(page, '未讲内容').fill('例2');
  await field(page, '共性问题').fill('忽略任意性');
  await page.locator(`[data-record-id="${first.id}"] button[name="save"]`).click();
  await expect(page.locator(`[data-record-id="${first.id}"] [data-save-status]`)).toContainText('已保存');
  const updated = await apiRead(page, `/api/modules/classes/v2/records/${first.id}`);
  expect(updated.body.version).toBe(2);
  expect(updated.body.unfinished).toBe('例2');
  expect(updated.body.position).toBe('定义讲完');
  await shot(page, PASS_SHOTS, 'PC-补充实际位置');

  // Deleting the position-bearing record falls back to the recent excerpt.
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator(`[data-record-id="${first.id}"] button[aria-label="记录操作"]`).click();
  await page.locator(`[data-record-id="${first.id}"] button[name="record-delete"]`).click();
  await page.locator('button[name="dialog-confirm"]').click();
  await expect(page.locator('[data-region="record-rows"] [data-record-id]')).toHaveCount(1);
  await expect(page.locator('[data-region="latest-position"]')).toContainText('第二次课');

  // The deleted list restores the original record with its position back.
  const recordFilter = page.getByRole('group', { name: '记录过滤' });
  await recordFilter.getByRole('button', { name: '已删除' }).click();
  await expect(page.locator(`[data-record-id="${first.id}"]`)).toHaveAttribute('data-record-state', 'deleted');
  await page.locator(`[data-record-id="${first.id}"] button[aria-label="记录操作"]`).click();
  await page.locator(`[data-record-id="${first.id}"] button[name="record-restore"]`).click();
  await recordFilter.getByRole('button', { name: '教学记录' }).click();
  await expect(page.locator('[data-region="record-rows"] [data-record-id]')).toHaveCount(2);
  await expect(page.locator('[data-region="latest-position"]')).toContainText('定义讲完');
  const restored = await apiRead(page, `/api/modules/classes/v2/records/${first.id}`);
  expect(restored.body.deletedAt).toBeNull();
  expect(restored.body.id).toBe(first.id);
  await shot(page, PASS_SHOTS, 'PC-删除后恢复');
});

/* ------------------------------------------------------------ 反馈与双向 */

test('WB-T003/TT-U3 同一题目两班反馈独立，改删来源仍可回看', async ({ page }) => {
  const question = await seedQuestion(page, '函数单调性');
  const first = await seedClass(page, '高一(1)班');
  const second = await seedClass(page, '高一(2)班');
  const firstRecord = await seedRecord(page, {
    classId: first.id,
    recordedOn: '2026-09-21',
    note: '一班：例2没讲',
    sources: [{ kind: 'question', id: question.id }]
  });
  await seedRecord(page, {
    classId: second.id,
    recordedOn: '2026-09-20',
    note: '二班：例2讲完了',
    sources: [{ kind: 'question', id: question.id }]
  });

  // The exported reverse-feedback panel (T53 assembles it into 题目 pages).
  await page.goto(`/panel/question/${question.id}`);
  await expect(page.locator('[data-region="source-record-rows"] [data-source-record-id]')).toHaveCount(2);
  await expect(page.locator('[data-region="source-records-panel"]')).toContainText('高一(1)班');
  await expect(page.locator('[data-region="source-records-panel"]')).toContainText('一班：例2没讲');
  await expect(page.locator('[data-region="source-records-panel"]')).toContainText('二班：例2讲完了');
  await shot(page, PASS_SHOTS, 'PC-题目反馈面板');

  // Opening one class's record lands on the class page with that record open.
  await page.locator(`[data-source-record-id="${firstRecord.id}"]`).click();
  await expect(page.locator('[data-region="class-detail"]')).toContainText('高一(1)班');
  await expect(page.locator(`[data-record-id="${firstRecord.id}"] [data-region="record-editor"]`)).toBeVisible();
  expect(page.url()).toContain(`/classes/${first.id}/records/${firstRecord.id}`);
  await shot(page, PASS_SHOTS, 'PC-从反馈打开记录');

  // Renaming the question updates the current label but keeps the saved title.
  const renamed = await apiWrite(page, 'PUT', `/api/modules/questions/items/${question.id}`, {
    baseVersion: question.version,
    title: '函数单调性（修订）',
    body: question.body, solution: question.solution, note: question.note, starred: question.starred
  });
  expect(renamed.status).toBe(200);
  await page.goto(`/classes/${first.id}`);
  await expect(page.locator(`[data-record-id="${firstRecord.id}"]`)).toContainText('函数单调性（修订）');
  await expect(page.locator(`[data-record-id="${firstRecord.id}"]`)).toContainText('记录时：函数单调性');

  // The record opens the material it linked; returning keeps the class page.
  await page.locator(`[data-record-id="${firstRecord.id}"] button[name="open-source"]`).click();
  await expect.poll(() => page.url()).toContain(`/questions/${question.id}`);
  await page.goBack();
  await expect(page.locator('[data-region="record-rows"]')).toContainText('一班：例2没讲');

  // Deleting the question keeps the record text and marks the link deleted.
  const deleted = await apiWrite(page, 'POST', `/api/modules/questions/items/${question.id}/deletion`, {
    baseVersion: 2,
    deleted: true
  });
  expect(deleted.status).toBe(200);
  await page.reload();
  await expect(page.locator(`[data-record-id="${firstRecord.id}"]`)).toContainText('一班：例2没讲');
  await expect(page.locator(`[data-record-id="${firstRecord.id}"] .c-source-chip`)).toHaveAttribute('data-source-state', 'deleted');
  await expect(page.locator(`[data-record-id="${firstRecord.id}"]`)).toContainText('已删除');

  // Editing unrelated text with the stored link still saves.
  await page.locator(`[data-record-id="${firstRecord.id}"] button[name="record-open"]`).click();
  await field(page, '编辑记录内容').fill('一班：例2没讲，下次先辨析反例');
  await page.locator(`[data-record-id="${firstRecord.id}"] button[name="save"]`).click();
  await expect(page.locator(`[data-record-id="${firstRecord.id}"] [data-save-status]`)).toContainText('已保存');
  const after = await apiRead(page, `/api/modules/classes/v2/records/${firstRecord.id}`);
  expect(after.body.note).toBe('一班：例2没讲，下次先辨析反例');
  expect(after.body.sources[0].deleted).toBe(true);
  // The other class is untouched.
  const secondList = await apiRead(page, `/api/modules/classes/v2/records?classId=${second.id}`);
  expect(secondList.body.items[0].note).toBe('二班：例2讲完了');
  await shot(page, PASS_SHOTS, 'PC-来源删除后回看');
});


/* ------------------------------------------------------- 故障、冲突与身份 */

test('WB-T017 提交后响应丢失：不冒充已保存，同键重试只写一次', async ({ page }) => {
  const classroom = await seedClass(page, '高一(1)班');
  await page.goto(`/classes/${classroom.id}`);
  await field(page, '写一句').fill('响应丢失也要保住的那句话');

  const loss = await loseCommittedResponses(page, '**/api/modules/classes/v2/records', { method: 'POST' });
  await page.locator('button[name="save-record"]').click();
  await expect(page.locator('[data-region="composer-status"]')).toContainText('暂时无法确认是否保存');
  await expect(field(page, '写一句')).toHaveValue('响应丢失也要保住的那句话');
  expect(loss.dropped()).toBeGreaterThanOrEqual(1);
  expect(service.countRows('classes_records')).toBe(1);
  await shot(page, FAULT_SHOTS, 'F-未确认保存');

  await loss.clear();
  await page.reload();
  await expect(field(page, '写一句')).toHaveValue('响应丢失也要保住的那句话');
  await page.locator('button[name="retry-confirm"]').click();
  await expect(page.locator('[data-region="composer-status"]')).toContainText('已保存');
  await expect(page.locator('[data-region="record-rows"] [data-record-id]')).toHaveCount(1);
  expect(service.countRows('classes_records')).toBe(1);
  const listed = await apiRead(page, `/api/modules/classes/v2/records?classId=${classroom.id}`);
  expect(listed.body.items[0].note).toBe('响应丢失也要保住的那句话');
  expect(listed.body.items[0].version).toBe(1);
  await shot(page, PASS_SHOTS, 'PC-重试确认后唯一记录');
});

test('WB-T017/WB-T018 真实写失败 503 与版本冲突保留草稿', async ({ page }) => {
  const classroom = await seedClass(page, '高一(1)班');
  const record = await seedRecord(page, { classId: classroom.id, recordedOn: '2026-09-21', note: '原句' });

  // Real write refusal: the SQLite connection rejects writes.
  service.refuseWrites();
  const blocked = await apiWrite(page, 'POST', '/api/modules/classes/v2/records', {
    classId: classroom.id,
    recordedOn: '2026-09-21',
    note: '被存储拒绝',
    position: '',
    unfinished: '',
    commonIssues: '',
    nextNote: '',
    sources: []
  });
  expect(blocked.status).toBe(503);
  expect(service.countRows('classes_records')).toBe(1);
  const mutationsAfterFailure = service.countRows('workbench_mutation_keys');
  service.allowWrites();

  // Version conflict: another device saves first.
  await page.goto(`/classes/${classroom.id}/records/${record.id}`);
  await expect(page.locator('[data-region="record-editor"]')).toBeVisible();
  await field(page, '编辑记录内容').fill('本页的修改');
  const other = await apiWrite(page, 'PUT', `/api/modules/classes/v2/records/${record.id}`, {
    expectedVersion: 1,
    classId: classroom.id,
    recordedOn: '2026-09-21',
    note: '别处改成的记录',
    position: '',
    unfinished: '',
    commonIssues: '',
    nextNote: '',
    sources: []
  });
  expect(other.status).toBe(200);

  await page.locator('button[name="save"]').click();
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await expect(field(page, '编辑记录内容')).toHaveValue('本页的修改');
  await page.getByRole('button', { name: '查看服务器版本' }).click();
  await expect(page.locator('[data-region="server-version"]')).toContainText('别处改成的记录');
  await shot(page, FAULT_SHOTS, 'F-版本冲突对照');

  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('button[name="adopt-server"]').click();
  await expect(field(page, '编辑记录内容')).toHaveValue('别处改成的记录');
  expect(service.countRows('classes_records')).toBe(1);
  expect(mutationsAfterFailure).toBeLessThanOrEqual(service.countRows('workbench_mutation_keys'));
  await shot(page, PASS_SHOTS, 'PC-冲突后采用服务器版本');
});

test('WB-T018 身份失效隐藏内容并保留未上传草稿，重新验证后接续', async ({ page, context }) => {
  const classroom = await seedClass(page, '高一(1)班');
  await page.goto(`/classes/${classroom.id}`);
  await field(page, '写一句').fill('身份失效也不能丢的草稿');

  await context.clearCookies();
  await page.reload();
  await expect(page.locator('[data-region="identity-gate"]')).toContainText('身份已失效');
  await expect(page.locator('[data-region="class-detail"]')).toHaveCount(0);
  await shot(page, FAULT_SHOTS, 'F-身份失效');

  await bootstrapPrincipal(context, T51_ACCOUNTS.a, { origin: T51_ORIGIN, dataDir: T51_DATA_DIR });
  await page.getByRole('button', { name: '重新检查身份' }).click();
  await expect(page.locator('[data-region="class-detail"]')).toBeVisible();
  await expect(field(page, '写一句')).toHaveValue('身份失效也不能丢的草稿');
  await shot(page, PASS_SHOTS, 'PC-身份恢复后草稿仍在');
});

test('WB-T018 另一账户看不到班级、记录与草稿', async ({ page, context }) => {
  const classroom = await seedClass(page, '高一(1)班');
  await seedRecord(page, { classId: classroom.id, recordedOn: '2026-09-21', note: 'A 的记录' });
  await page.goto(`/classes/${classroom.id}`);
  await expect(page.locator('[data-region="record-rows"]')).toContainText('A 的记录');

  await context.clearCookies();
  await bootstrapPrincipal(context, T51_ACCOUNTS.b, { origin: T51_ORIGIN, dataDir: T51_DATA_DIR });
  await page.goto('/classes');
  await expect(page.locator('[data-region="class-empty"]')).toContainText('还没有班级');
  await page.goto(`/classes/${classroom.id}`);
  await expect(page.locator('[data-region="class-placeholder"]')).toContainText('未找到这个班级');
  const otherView = await page.evaluate(async () => {
    const response = await fetch('/api/modules/classes/items', { credentials: 'same-origin' });
    return response.json();
  });
  expect(otherView.items).toHaveLength(0);
  await shot(page, PASS_SHOTS, 'PC-另一账户隔离');
});

/* --------------------------------------------------------------- 平板视口 */

test.describe('平板 768×1024', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('TT-U1/U2 平板：列表与详情切换、快记可用、无横向溢出', async ({ page }) => {
    const classroom = await seedClass(page, '高一(1)班');
    await seedRecord(page, { classId: classroom.id, recordedOn: '2026-09-21', note: '平板上的记录' });

    await page.goto('/classes');
    await expect(page.locator('[data-region="class-list"]')).toBeVisible();
    await expect(page.locator('[data-region="class-placeholder"]')).toBeHidden();
    await page.locator(`[data-class-id="${classroom.id}"]`).click();
    await expect(page.locator('[data-region="class-detail"]')).toBeVisible();
    await expect(page.locator('[data-region="class-list"]')).toBeHidden();
    await expect(page.locator('[data-region="record-rows"]')).toContainText('平板上的记录');
    await expect(field(page, '写一句')).toBeVisible();
    await shot(page, PASS_SHOTS, 'Pad-班级详情');

    await page.locator('button[name="back-to-classes"]').click();
    await expect(page.locator('[data-region="class-list"]')).toBeVisible();
    await expect(page.locator('[data-region="class-detail"]')).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });
});

/* T51-MATH: frozen TeachingWork adapter, not the real M41/M42 provider. */
// Source payloads copied from M40 1a5dd015863d749e5244346f4eaad24ac506670d math/samples.json.
const mathSamples = JSON.parse(fs.readFileSync(new URL('./teaching-time-classes/math-samples.json', import.meta.url), 'utf8'));
const MATH_ID = '60000000-0000-4000-8000-000000000001';
function seedMathAdapter() {
  const db = service.runner.workbench.db;
  ['formula', 'plane', 'space', 'dynamic', 'html'].forEach((kind, index) => {
    db.prepare('INSERT INTO t51_math_adapter(id,accountKey,title,kind,render) VALUES(?,?,?,?,?)')
      .run(MATH_ID.slice(0,-1)+(index+1),T51_ACCOUNTS.a,`${kind} 函数作品`,kind,index===0?'invalid':'ready');
  });
}
async function mockMathDirectory(page) {
  await page.route('**/api/modules/math/v1/works?*', async route => {
    const url = new URL(route.request().url());
    const rows = service.runner.workbench.db.prepare('SELECT * FROM t51_math_adapter WHERE accountKey=? AND deletedAt IS NULL').all(T51_ACCOUNTS.a);
    const items = rows.filter(row => (!url.searchParams.get('kind') || row.kind===url.searchParams.get('kind')) && row.title.includes(url.searchParams.get('q')||'')).map(row => ({
      ...mathSamples[row.kind], id:row.id, version:row.version, title:row.title,
      createdAt:'2026-09-21T06:00:00Z', updatedAt:'2026-09-21T06:00:00Z', deletedAt:row.deletedAt,
      rendererVersion:'t51-frozen-adapter',
      render:row.render==='invalid'
        ? {state:'invalid',posterFileId:null,presentationFileId:null,reason:'invalid-formula'}
        : {state:'ready',posterFileId:'70000000-0000-4000-8000-000000000001',presentationFileId:null,reason:null}
    }));
    await route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify({items})});
  });
}
for (const viewport of [{width:1440,height:900},{width:768,height:1024}]) {
  test(`WB-TM001/002/005/008 adapter ${viewport.width}: select, cancel, failure, feedback and draft return`, async ({page}) => {
    await page.setViewportSize(viewport);
    seedMathAdapter(); await mockMathDirectory(page);
    const one = await seedClass(page,'一班'), two = await seedClass(page,'二班');
    await page.goto(`/classes/${one.id}`);
    await field(page,'写一句').fill('作品反馈原文');
    await page.locator('[name="toggle-supplement"]').click();
    await page.locator('[name="pick-sources"]').click();
    await page.locator('[name="picker-kind-math"]').click();
    await expect(page.locator('.c-picker-row')).toHaveCount(5);
    await page.getByLabel('作品类型').selectOption('space');
    await expect(page.locator('.c-picker-row')).toHaveCount(1);
    await page.getByLabel('作品类型').selectOption('');
    await page.locator(`.c-picker-row[data-source-id="${MATH_ID}"]`).click();
    await page.locator('[name="picker-cancel"]').click();
    await expect(page.locator('[name="pick-sources"]')).toBeFocused();
    expect(service.countRows('classes_records')).toBe(0);
    await expect(page.locator('.c-composer [data-source-kind="math"]')).toHaveCount(0);
    await page.locator('[name="pick-sources"]').click();
    await page.locator(`.c-picker-row[data-source-id="${MATH_ID}"]`).click();
    await page.screenshot({path:path.join(PASS_SHOTS,`math-${viewport.width}-picker.png`)});
    await expectNoHorizontalOverflow(page);
    await page.locator('[name="picker-confirm"]').click();
    service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=503 WHERE id=?').run(MATH_ID);
    await page.locator('[name="save-record"]').click();
    await expect(page.locator('[data-region="composer-status"]')).toContainText('暂时无法');
    await expect(field(page,'写一句')).toHaveValue('作品反馈原文');
    expect(service.countRows('classes_records')).toBe(0);
    service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=NULL WHERE id=?').run(MATH_ID);
    await page.locator('[name="retry-confirm"]').click();
    await expect(page.locator('[data-region="record-rows"]')).toContainText('作品反馈原文');
    const r = (await apiRead(page,`/api/modules/classes/v2/records?classId=${one.id}`)).body.items[0];
    await seedRecord(page,{classId:two.id,recordedOn:r.recordedOn,note:'二班独立反馈',sources:[{kind:'math',id:MATH_ID}]});
    await page.locator(`[data-record-id="${r.id}"] [name="record-open"]`).click();
    await field(page,'编辑记录内容').fill('尚未保存的现场');
    await page.locator('[data-region="record-editor"] [name="open-source"]').click();
    await expect(page).toHaveURL(new RegExp(`/math\\?workId=${MATH_ID}`));
    await expect(page.locator('[data-region="source-record-rows"]')).toContainText('一班');
    await expect(page.locator('[data-region="source-record-rows"]')).toContainText('二班');
    await page.screenshot({path:path.join(PASS_SHOTS,`math-${viewport.width}-feedback.png`)});
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button',{name:'返回记录',exact:true}).click();
    await expect(field(page,'编辑记录内容')).toHaveValue('尚未保存的现场');
    expect((await apiRead(page,`/api/modules/classes/v2/records/${r.id}`)).body.note).toBe('作品反馈原文');
    await service.restart(); await page.reload();
    await expect(field(page,'编辑记录内容')).toHaveValue('尚未保存的现场');
    await page.screenshot({path:path.join(PASS_SHOTS,`math-${viewport.width}-returned.png`)});
  });
}

test('WB-TM007 old pending create confirms on original path and preserves newer draft', async ({page}) => {
  seedMathAdapter();
  const c = await seedClass(page,'兼容班');
  const body={classId:c.id,recordedOn:'2026-09-21',note:'原成功内容',position:'',unfinished:'',commonIssues:'',nextNote:'',sources:[]};
  const key=uuid();
  const old=await apiWrite(page,'POST','/api/modules/classes/records',body,key);
  expect(old.status).toBe(201);
  await apiWrite(page,'PUT',`/api/modules/classes/v2/records/${old.body.id}`,{...body,expectedVersion:1,sources:[{kind:'math',id:MATH_ID}]});
  await page.goto(`/classes/${c.id}`);
  await page.evaluate(({account,c,body,key})=>{
    localStorage.setItem(`tb.workbench.v1:${account}:pending:class-record-new:${c}`,JSON.stringify({key,payload:body}));
    localStorage.setItem(`tb.workbench.v1:${account}:draft:class-record-new:${c}`,JSON.stringify({input:{...body,note:'新的草稿'}}));
  },{account:T51_ACCOUNTS.a,c:c.id,body,key});
  await page.reload();
  const confirmed=page.waitForRequest(req=>req.method()==='POST' && req.url().endsWith('/api/modules/classes/records'));
  await page.locator('[name="retry-confirm"]').click();
  await confirmed;
  await expect(page.locator('[data-region="composer-status"]')).toContainText('新输入仍为草稿');
  await expect(field(page,'写一句')).toHaveValue('新的草稿');
  await expect(page.locator('[data-region="record-rows"] [data-source-kind="math"]')).toHaveCount(1);
  expect(service.countRows('classes_records')).toBe(1);
});

test('WB-TM008 math directory failure retries without discarding selection; source 404 keeps draft', async ({page}) => {
  seedMathAdapter(); await mockMathDirectory(page);
  const c=await seedClass(page,'故障班');
  await page.goto(`/classes/${c.id}`);
  await field(page,'写一句').fill('保留文字');
  await page.locator('[name="toggle-supplement"]').click();
  await page.locator('[name="pick-sources"]').click();
  await page.locator('[name="picker-kind-math"]').click();
  await page.locator(`.c-picker-row[data-source-id="${MATH_ID}"]`).click();
  await page.route('**/api/modules/math/v1/works?*', route=>route.fulfill({status:503,contentType:'application/problem+json',body:JSON.stringify({type:'/problems/workbench/temporarily-unavailable'})}));
  await page.getByLabel('搜索资料').fill('函数');
  await expect(page.getByText('未能加载作品')).toBeVisible();
  await page.screenshot({path:path.join(FAULT_SHOTS,'math-directory-unavailable.png')});
  await page.unroute('**/api/modules/math/v1/works?*'); await mockMathDirectory(page);
  await page.getByRole('button',{name:'重试',exact:true}).click();
  await expect(page.locator(`.c-picker-row[data-source-id="${MATH_ID}"]`)).toHaveAttribute('aria-pressed','true');
  await page.locator('[name="picker-confirm"]').click();
  service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=404 WHERE id=?').run(MATH_ID);
  await page.locator('[name="save-record"]').click();
  await expect(page.locator('[data-region="composer-status"]')).toContainText('未找到内容');
  await expect(field(page,'写一句')).toHaveValue('保留文字');
  await page.getByRole('button',{name:'移除作品关联'}).click();
  await page.locator('[name="save-record"]').click();
  await expect(page.locator('[data-region="record-rows"]')).toContainText('保留文字');
});

test('WB-TM003/004/008 current label, tombstone and failed refresh preserve complete feedback', async ({page}) => {
  seedMathAdapter();
  const c = await seedClass(page,'来源生命周期');
  const r = await seedRecord(page,{classId:c.id,recordedOn:'2026-09-21',note:'原反馈',sources:[{kind:'math',id:MATH_ID}]});
  service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET title=?,version=2 WHERE id=?').run('长标题'.repeat(90),MATH_ID);
  await page.goto(`/classes/${c.id}`);
  await expect(page.locator('[data-region="record-rows"]')).toContainText('记录时：formula 函数作品');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({path:path.join(PASS_SHOTS,'math-long-current-title.png')});
  service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET deletedAt=? WHERE id=?').run('2026-09-22T00:00:00Z',MATH_ID);
  await page.reload();
  await expect(page.locator('[data-source-state="deleted"]')).toContainText('已删除');
  await page.locator('[name="open-source"]').click();
  await expect(page.locator('[data-region="source-record-rows"]')).toContainText('原反馈');
  service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=404 WHERE id=?').run(MATH_ID);
  await page.getByRole('button',{name:'刷新反馈'}).click();
  await expect(page.locator('[data-region="source-records-error"]')).toContainText('未能更新反馈');
  await expect(page.locator('[data-region="source-record-rows"]')).toContainText('原反馈');
  await expect(page.getByText('还没有班级记录关联这份资料')).toHaveCount(0);
  await page.screenshot({path:path.join(FAULT_SHOTS,'math-feedback-read-failure.png')});
  expect(service.runner.workbench.db.prepare('SELECT version FROM classes_records WHERE id=?').get(r.id).version).toBe(1);
});

test('T53-D03 inherited slow response retains new draft with math selection', async ({page}) => {
  const c=await seedClass(page,'慢响应班');
  await page.goto(`/classes/${c.id}`);
  await field(page,'写一句').fill('先提交的句子');
  let release, committed;
  const gate=new Promise(resolve=>{release=resolve;});
  const done=new Promise(resolve=>{committed=resolve;});
  await page.route('**/api/modules/classes/v2/records',async route=>{
    if(route.request().method()!=='POST') return route.continue();
    const response=await route.fetch(); committed(); await gate; await route.fulfill({response});
  });
  await page.locator('[name="save-record"]').click(); await done;
  await field(page,'写一句').fill('保存期间的新草稿');
  await page.locator('[name="toggle-supplement"]').click();
  await field(page,'教学位置').fill('新位置'); release();
  await expect(page.locator('[data-region="composer-status"]')).toContainText('新输入仍为草稿');
  await expect(field(page,'写一句')).toHaveValue('保存期间的新草稿');
  await expect(field(page,'教学位置')).toHaveValue('新位置');
  await page.unroute('**/api/modules/classes/v2/records');
  await page.locator('[name="save-record"]').click();
  await expect(page.locator('[data-region="record-rows"] [data-record-id]')).toHaveCount(2);
});

test('TM-C6 existing draft can remove missing source after reopening editor', async ({page}) => {
  seedMathAdapter();
  const c=await seedClass(page,'既有草稿恢复');
  const r=await seedRecord(page,{classId:c.id,recordedOn:'2026-09-21',note:'原文',sources:[{kind:'math',id:MATH_ID}]});
  await page.goto(`/classes/${c.id}/records/${r.id}`);
  await field(page,'编辑记录内容').fill('需要保留的旧草稿');
  await page.locator('[name="record-close"]').click();
  service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=404 WHERE id=?').run(MATH_ID);
  await page.locator(`[data-record-id="${r.id}"] [name="record-open"]`).click();
  await expect(field(page,'编辑记录内容')).toHaveValue('需要保留的旧草稿');
  await page.getByRole('button',{name:'移除作品关联'}).click();
  await expect(page.locator('[data-region="record-editor"] [name="save"]')).toBeEnabled();
  await page.locator('[data-region="record-editor"] [name="save"]').click();
  await expect(page.locator('[data-region="record-editor"] [data-save-status]')).toContainText('已保存');
  const saved=(await apiRead(page,`/api/modules/classes/v2/records/${r.id}`)).body;
  expect(saved.note).toBe('需要保留的旧草稿'); expect(saved.sources).toEqual([]);
});

for (const fault of [404,503]) {
  test(`TM-C6 existing record without a local draft recovers from source ${fault}`, async ({page}) => {
    seedMathAdapter();
    const c=await seedClass(page,'保留已知基线');
    const r=await seedRecord(page,{classId:c.id,recordedOn:'2026-09-21',note:'已知记录',sources:[{kind:'math',id:MATH_ID}]});
    await page.goto(`/classes/${c.id}`);
    await expect(page.locator('[data-region="record-rows"]')).toContainText('已知记录');
    service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=? WHERE id=?').run(fault,MATH_ID);
    await page.locator(`[data-record-id="${r.id}"] [name="record-open"]`).click();
    await expect(page.locator('[data-region="record-read-warning"]')).toContainText('上次内容');
    await expect(field(page,'编辑记录内容')).toHaveValue('已知记录');
    await field(page,'编辑记录内容').fill('重读时也保留');
    service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=NULL WHERE id=?').run(MATH_ID);
    await page.getByRole('button',{name:'重试读取'}).click();
    await expect(page.locator('[data-region="record-read-warning"]')).toHaveCount(0);
    await expect(field(page,'编辑记录内容')).toHaveValue('重读时也保留');
  });
}

test('TM-C6 projection 404 does not clear an existing unconfirmed update', async ({page}) => {
  seedMathAdapter();
  const c=await seedClass(page,'原键确认班');
  const r=await seedRecord(page,{classId:c.id,recordedOn:'2026-09-21',note:'原文',sources:[{kind:'math',id:MATH_ID}]});
  await page.goto(`/classes/${c.id}/records/${r.id}`);
  await field(page,'编辑记录内容').fill('已经提交');
  let originalKey;
  await page.route(`**/api/modules/classes/v2/records/${r.id}`,async route=>{
    if(route.request().method()!=='PUT') return route.continue();
    originalKey=route.request().headers()['idempotency-key'];
    await route.fetch(); await route.abort('failed');
  });
  await page.locator('[data-region="record-editor"] [name="save"]').click();
  await expect(page.locator('[data-region="record-editor"] [data-save-status]')).toContainText('暂时无法确认');
  await page.locator('[name="record-close"]').click();
  await page.unroute(`**/api/modules/classes/v2/records/${r.id}`);
  service.runner.workbench.db.prepare('UPDATE t51_math_adapter SET fault=404 WHERE id=?').run(MATH_ID);
  await page.locator(`[data-record-id="${r.id}"] [name="record-open"]`).click();
  await expect(page.locator('[data-region="record-read-warning"]')).toBeVisible();
  const request=page.waitForRequest(req=>req.method()==='PUT' && req.url().endsWith(r.id));
  await page.locator('[data-region="record-editor"] [name="retry-confirm"]').click();
  expect((await request).headers()['idempotency-key']).toBe(originalKey);
  await expect(page.locator('[data-region="record-editor"] [data-save-status]')).toContainText('已保存');
  await expect(page.locator('[data-region="record-read-warning"]')).toBeVisible();
  await page.getByRole('button',{name:'重试读取'}).click();
  await expect(field(page,'编辑记录内容')).toHaveValue('已经提交');
  expect(service.runner.workbench.db.prepare('SELECT version FROM classes_records WHERE id=?').get(r.id).version).toBe(2);
});
