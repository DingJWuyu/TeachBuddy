/**
 * B14 UI self-verification: first-flow question bank and the
 * shared shell, driven through a substitute that implements the frozen OpenAPI on
 * one origin and serves the production build.
 *
 * The substitute is test infrastructure; a passing run here is `self` evidence
 * for the UI and does not claim the real service link. B15/B16 repeat this on the
 * real API.
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { startWorkbenchSubstitute } from './first-flow-ui-substitute.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = 47114;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.B14_SHOTS_DIR
  ? path.resolve(process.env.B14_SHOTS_DIR)
  : path.join(ROOT, 'test-results/evidence/B14/v1/screenshots');

let substitute;

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (process.env.B14_SKIP_BUILD !== '1') {
    execFileSync('npm', ['run', 'build:web'], { cwd: ROOT, stdio: 'inherit' });
  }
  substitute = await startWorkbenchSubstitute({
    port: PORT,
    staticDir: path.join(ROOT, 'apps/web/dist')
  });
});

test.afterAll(async () => {
  await substitute?.close();
});

test.use({ baseURL: ORIGIN, viewport: { width: 1440, height: 900 } });

/* ------------------------------------------------------------------ helpers */

const uuid = () => crypto.randomUUID();

async function signIn(page, account) {
  const response = await page.request.post(`${ORIGIN}/__test__/bootstrap`, { data: { account } });
  expect(response.ok()).toBe(true);
}

async function signOut(page) {
  await page.request.post(`${ORIGIN}/__test__/signout`);
}

async function reset(page) {
  await page.request.post(`${ORIGIN}/__test__/reset`);
}

async function stats(page) {
  const response = await page.request.get(`${ORIGIN}/__test__/stats`);
  return response.json();
}

async function apiWrite(page, method, apiPath, body, key = uuid()) {
  const response = await page.request.fetch(`${ORIGIN}${apiPath}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'X-TeachBuddy-Request': '1',
      Origin: ORIGIN,
      'Idempotency-Key': key
    },
    data: body
  });
  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function apiRead(page, apiPath) {
  const response = await page.request.get(`${ORIGIN}${apiPath}`);
  return { status: response.status(), body: await response.json().catch(() => null) };
}

async function fault(page, options) {
  await page.request.post(`${ORIGIN}/__test__/fault`, { data: options });
}

async function clearFaults(page) {
  await page.request.post(`${ORIGIN}/__test__/clear-faults`);
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

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
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

/** Inputs are addressed by their exact aria-label: previews and block controls share label prefixes. */
function field(page, name) {
  return page.locator(`input[aria-label="${name}"], textarea[aria-label="${name}"]`);
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

async function openQuestion(page, id) {
  await page.goto(`/questions/${id}`);
  await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
}

/* -------------------------------------------------------------------- tests */

test.describe('题库 UI', () => {
  test.beforeEach(async ({ page }) => {
    await reset(page);
    await signIn(page, 'A');
  });

  test('WB-001/002/U0-U2 自建含公式题目，保存后可搜索、刷新仍在、编辑不换 ID', async ({ page }) => {
    await page.goto('/questions');
    await expect(page.locator('[data-region="list-empty"]')).toContainText('题库为空');

    await page.locator('button[name="new-manual"]').click();
    await expect(page.locator('[data-region="question-editor"]')).toBeVisible();
    await field(page, '标题').fill('二次函数最小值');
    await fillParagraph(page, '题面', '题面段落 1', '已知函数 ');
    await addFormula(page, '题面');
    await field(page, '题面公式 1源').fill('f(x)=x^2-2x');
    await expect(page.locator('.wb-math-block-preview .katex').first()).toBeVisible();
    await fillParagraph(page, '答案', '答案段落 1', '当 x=1 时取最小值 -1。');
    await field(page, '教学笔记').fill('先让学生尝试配方。');

    await page.locator('button[name="save"]').click();
    await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
    await expectSaved(page);
    const url = page.url();
    const id = url.split('/questions/')[1];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.locator('.katex').first()).toBeVisible();
    // The list is refreshed by the confirmed create, without a manual reload.
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
    await expect(page.locator('[data-region="list-empty"]')).toHaveCount(0);
    await shot(page, 'PC-U1-阅读题目');

    // 搜索命中教学笔记，服务端重启式刷新后内容仍在
    await field(page, '搜索题目').fill('配方');
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
    await field(page, '搜索题目').fill('不存在的关键词');
    await expect(page.locator('[data-region="list-empty"]')).toBeVisible();
    await field(page, '搜索题目').fill('');
    await page.reload();
    await expect(page.locator('[data-region="question-reader"]')).toContainText('已知函数');
    expect(page.url()).toContain(id);

    // U2 编辑：同一 ID、只增版本
    await page.locator('button[name="edit"]').click();
    await field(page, '题面段落 1').fill('已知函数 f(x)=x^2-2x，求最小值并说明理由。');
    await page.locator('button[name="save"]').click();
    await expectSaved(page);
    expect(page.url()).toContain(id);
    const stored = await apiRead(page, `/api/modules/questions/items/${id}`);
    expect(stored.body.version).toBe(2);
    expect(stored.body.source.kind).toBe('manual');
    await shot(page, 'PC-U2-编辑后已保存');
  });

  test('WB-002 收录文字：原稿逐字保留并可对照，整理后保存', async ({ page }) => {
    const raw = '已知函数 f(x)=x^2-2x，求最小值，并说明理由。\n\n答案：-1；配方求解。';
    await page.goto('/questions/new-paste');
    await field(page, '原始粘贴文字').fill(raw);
    await page.locator('button[name="organize-paste"]').click();
    await expect(field(page, '题面段落 3')).toHaveValue(/答案：-1/);
    await field(page, '题面段落 1').fill('已知函数 $f(x)=x^2-2x$，求最小值，并说明理由。');
    await page.locator('button[name="save"]').click();
    await expectSaved(page);
    await expect(page.locator('[data-region="paste-source"]')).toBeVisible();
    await page.locator('[data-region="paste-source"] summary').click();
    await expect(page.locator('[data-region="paste-source"] pre')).toHaveText(raw);
    await shot(page, 'PC-U3-粘贴原稿对照');
  });

  test('WB-004 复制改编对照：草稿刷新后继续，保存生成独立题目且原题不变', async ({ page }) => {
    const question = await seedQuestion(page, { note: '原题笔记' });
    await openQuestion(page, question.id);
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '复制修改' }).click();
    await expect(page.locator('[data-region="copy-compare"]')).toBeVisible();
    await expect(page.locator('[data-region="compare-source"]')).toContainText('原题采用版本 1');
    await field(page, '题面公式 1源').fill('g(x)=x^2-4x');
    await field(page, '答案段落 1').fill('x=2 时最小值 -4');
    await shot(page, 'PC-U3-改编对照');

    // 返回题库后草稿仍可继续，刷新也不丢
    await page.goto('/questions');
    await expect(page.locator('[data-region="drafts"]')).toContainText('改编草稿');
    await page.locator('[data-region="drafts"] .wb-draft-row').click();
    await expect(field(page, '题面公式 1源')).toHaveValue('g(x)=x^2-4x');
    await page.reload();
    await expect(field(page, '题面公式 1源')).toHaveValue('g(x)=x^2-4x');

    await page.locator('button[name="save"]').click();
    await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
    const copyId = page.url().split('/questions/')[1];
    expect(copyId).not.toBe(question.id);
    const original = await apiRead(page, `/api/modules/questions/items/${question.id}`);
    expect(original.body.version).toBe(1);
    expect(original.body.note).toBe('原题笔记');
    const copy = await apiRead(page, `/api/modules/questions/items/${copyId}`);
    expect(copy.body.source.kind).toBe('copy');
    expect(copy.body.source.questionId).toBe(question.id);
    expect(copy.body.source.snapshot.body.blocks[1].latex).toBe('f(x)=x^2-2x');
    expect(copy.body.note).toBe('');

    // 原题能看到副本，副本能看到出处
    await openQuestion(page, question.id);
    await expect(page.locator('[data-region="derivatives"]')).toContainText('改编');
    await openQuestion(page, copyId);
    await expect(page.locator('[data-field="source"]')).toContainText('改编自');
  });

  test('WB-012 提交后响应丢失：不冒充已保存，同键重试只写一次', async ({ page }) => {
    await page.goto('/questions/new-manual');
    await fillParagraph(page, '题面', '题面段落 1', '响应丢失也要保住的题面');
    // Commit, lose the response, and lose it again on the retry the browser makes
    // by itself: this is the "result unknown" state the teacher must see, with
    // the object already written on the server.
    await fault(page, { mode: 'drop-response-after-commit', match: { method: 'POST', pathIncludes: '/questions/items' } });
    // Chromium re-sends such a write up to two extra times on its own, so the
    // replay has to stay broken for all of them before the result is unknown.
    await fault(page, { mode: 'drop-response-on-replay', times: 5, match: { method: 'POST', pathIncludes: '/questions/items' } });
    await page.locator('button[name="save"]').click();
    await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'unconfirmed');
    await expect(saveStatus(page)).toContainText('暂时无法确认是否保存');
    // B16-UI-002: the state sentence appears exactly once, and a named cause
    // (here the dropped connection) still shows as its own reason.
    const unconfirmed = await saveStatus(page).evaluate((block) => ({
      text: block.textContent.replace(/\s+/g, ''),
      statusText: block.querySelector('.wb-save-status').textContent.trim(),
      reasons: [...block.querySelectorAll('.wb-save-reason')].map((node) => node.textContent.trim())
    }));
    expect(unconfirmed.statusText).toBe('暂时无法确认是否保存');
    expect(unconfirmed.text.split('暂时无法确认是否保存')).toHaveLength(2);
    expect(unconfirmed.reasons.join('')).toContain('无法连接服务');
    await expect(field(page, '题面段落 1')).toHaveValue('响应丢失也要保住的题面');
    const afterDrop = await stats(page);
    expect(afterDrop.objects.A.questions).toBe(1);
    await shot(page, 'PC-未确认保存');

    await clearFaults(page);
    await page.reload();
    await expect(field(page, '题面段落 1')).toHaveValue('响应丢失也要保住的题面');
    await page.locator('button[name="retry-confirm"]').click();
    await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
    const settled = await stats(page);
    expect(settled.objects.A.questions).toBe(1);
    const id = page.url().split('/questions/')[1];
    const stored = await apiRead(page, `/api/modules/questions/items/${id}`);
    expect(stored.status).toBe(200);
    expect(stored.body.version).toBe(1);
    expect(stored.body.body.blocks[0].runs[0].text).toBe('响应丢失也要保住的题面');
  });

  test('WB-012 已确认提交后浏览器重发同键请求也不会重复写入', async ({ page }) => {
    const question = await seedQuestion(page);
    await openQuestion(page, question.id);
    await page.locator('button[name="edit"]').click();
    await field(page, '题面段落 1').fill('改写过的题面');
    await fault(page, { mode: 'drop-response-after-commit', match: { method: 'PUT', pathIncludes: question.id } });
    await page.locator('button[name="save"]').click();
    await expect.poll(async () => saveStatus(page).getAttribute('data-save-status')).toMatch(/^(saved|clean|unconfirmed)$/);
    const stored = await apiRead(page, `/api/modules/questions/items/${question.id}`);
    expect(stored.body.version).toBe(2);
    expect(stored.body.body.blocks[0].runs[0].text).toBe('改写过的题面');
    const counts = await stats(page);
    expect(counts.objects.A.questions).toBe(1);
  });

  test('WB-011 写入前失败给出明确失败，刷新保留草稿后重试成功', async ({ page }) => {
    await page.goto('/questions/new-manual');
    await fillParagraph(page, '题面', '题面段落 1', '服务失败时也不能丢的题面');
    await fault(page, { mode: 'fail-before-commit', match: { method: 'POST', pathIncludes: '/questions/items' } });
    await page.locator('button[name="save"]').click();
    await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'unconfirmed');
    // B16-UI-002: a 503 carries no separate cause, so the block shows the state
    // sentence once instead of printing it again as a red reason.
    const refused = await saveStatus(page).evaluate((block) => ({
      text: block.textContent.replace(/\s+/g, ''),
      statusText: block.querySelector('.wb-save-status').textContent.trim(),
      reasons: block.querySelectorAll('.wb-save-reason').length
    }));
    expect(refused.statusText).toBe('暂时无法确认是否保存');
    expect(refused.text.split('暂时无法确认是否保存')).toHaveLength(2);
    expect(refused.reasons).toBe(0);
    const before = await stats(page);
    expect(before.objects.A.questions).toBe(0);

    await page.reload();
    await expect(field(page, '题面段落 1')).toHaveValue('服务失败时也不能丢的题面');
    await page.locator('button[name="retry-confirm"]').click();
    await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
    const after = await stats(page);
    expect(after.objects.A.questions).toBe(1);
  });

  test('WB-013 版本冲突保留本地输入并可对照采用服务器版本', async ({ page }) => {
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
    await shot(page, 'PC-版本冲突对照');

    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('button[name="adopt-server"]').click();
    await expect(field(page, '题面段落 1')).toHaveValue('别处改成的题面');
    await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'clean');
  });

  test('WB-013 保存期间的新输入不被旧响应标成已保存', async ({ page }) => {
    const question = await seedQuestion(page);
    await openQuestion(page, question.id);
    await page.locator('button[name="edit"]').click();
    await field(page, '题面段落 1').fill('第一次提交的内容');
    await fault(page, { mode: 'delay-ms', ms: 1500, match: { method: 'PUT', pathIncludes: question.id } });
    await page.locator('button[name="save"]').click();
    await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'saving');
    await field(page, '题面段落 1').fill('保存期间继续输入的内容');
    await expect(saveStatus(page)).toHaveAttribute('data-save-status', 'dirty', { timeout: 8000 });
    await expect(field(page, '题面段落 1')).toHaveValue('保存期间继续输入的内容');
    const stored = await apiRead(page, `/api/modules/questions/items/${question.id}`);
    expect(stored.body.body.blocks[0].runs[0].text).toBe('第一次提交的内容');
  });

  test('WB-011 本地存储不可写时如实提示草稿无法保留', async ({ page }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (String(key).startsWith('tb.workbench')) throw new Error('quota');
        return original.call(this, key, value);
      };
    });
    await page.goto('/questions/new-manual');
    await expect(page.locator('[data-region="storage-warning"]')).toContainText('草稿无法保留');
    await fillParagraph(page, '题面', '题面段落 1', '无法本地保留的输入');
    await expect(page.locator('.wb-draft-hint')).toHaveCount(0);
    await shot(page, 'PC-本地存储失败');
  });

  test('WB-009/U7 删除后恢复使用原 ID', async ({ page }) => {
    const question = await seedQuestion(page, { title: '被引用的题目' });
    await openQuestion(page, question.id);
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '删除题目' }).click();
    await page.locator('button[name="dialog-confirm"]').click();
    await expect(page.locator('[data-region="question-deleted"]')).toBeVisible();
    await shot(page, 'PC-U7-已删除可恢复');

    await page.goto('/questions');
    await page.getByRole('button', { name: '已删除' }).click();
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
    await page.locator('[data-region="question-rows"] [data-row-open]').first().click();
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '恢复题目' }).click();
    await expect(page.locator('[data-region="question-deleted"]')).toHaveCount(0);
    expect(page.url()).toContain(question.id);

  });

  test('WB-016/017 身份隔离：另一账户看不到题目与本地草稿，回到原账户草稿仍在', async ({ page }) => {
    const question = await seedQuestion(page, { title: 'A 的题目' });
    await page.goto('/questions/new-manual');
    await fillParagraph(page, '题面', '题面段落 1', 'A 未上传的草稿');
    await expect(page.locator('.wb-draft-hint')).toBeVisible();

    await signOut(page);
    await signIn(page, 'B');
    await page.goto('/questions');
    await expect(page.locator('[data-region="list-empty"]')).toContainText('题库为空');
    await expect(page.locator('[data-region="drafts"]')).toHaveCount(0);
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(0);

    await signOut(page);
    await signIn(page, 'A');
    await page.goto('/questions/new-manual');
    await expect(field(page, '题面段落 1')).toHaveValue('A 未上传的草稿');
    const listAfter = await apiRead(page, '/api/modules/questions/items');
    expect(listAfter.body.items.map((item) => item.id)).toContain(question.id);
  });

  test('WB-017 身份失效隐藏业务内容并保留草稿', async ({ page }) => {
    await page.goto('/questions/new-manual');
    await fillParagraph(page, '题面', '题面段落 1', '身份失效前输入的内容');
    await signOut(page);
    await page.reload();
    await expect(page.locator('[data-region="identity-gate"]')).toContainText('身份已失效');
    await expect(page.locator('[data-region="question-editor"]')).toHaveCount(0);
    await signIn(page, 'A');
    await page.getByRole('button', { name: '重新检查身份' }).click();
    await expect(field(page, '题面段落 1')).toHaveValue('身份失效前输入的内容');
  });

  test('WB-014 公式预览失败仍保留源并允许保存', async ({ page }) => {
    await page.goto('/questions/new-manual');
    await fillParagraph(page, '题面', '题面段落 1', '已知函数 ');
    await addFormula(page, '题面');
    await field(page, '题面公式 1源').fill('\\frac{1}{');
    await expect(page.locator('[data-formula-failed]').first()).toContainText('公式预览失败');
    await expect(page.locator('[data-formula-failed]').first()).toContainText('\\frac{1}{');
    await shot(page, 'PC-公式预览失败');
    await page.locator('button[name="save"]').click();
    await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
    const id = page.url().split('/questions/')[1];
    const stored = await apiRead(page, `/api/modules/questions/items/${id}`);
    expect(stored.body.body.blocks[1].latex).toBe('\\frac{1}{');
  });

  test('WB-014 未知文档版本只读保留，不会被改写', async ({ page }) => {
    const question = await seedQuestion(page);
    const account = substitute.store.accounts.get(substitute.accounts.A);
    const stored = account.questions.get(question.id);
    stored.body = { version: 2, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '来自更新版本的内容' }] }] };

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
    await shot(page, 'PC-未知文档版本只读');
  });

  test('WB-010 读取失败保留已有内容并提供重试', async ({ page }) => {
    await seedQuestion(page, { title: '已有题目' });
    await page.goto('/questions');
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
    // A re-read inside the page fails: the rows the teacher already has stay.
    await fault(page, { mode: 'fail-read', times: 5, match: { pathIncludes: '/questions/items' } });
    await field(page, '搜索题目').fill('已有');
    await expect(page.locator('[data-region="list-error"]')).toBeVisible();
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
    await clearFaults(page);
    await page.locator('[data-region="list-error"] button').click();
    await expect(page.locator('[data-region="list-error"]')).toHaveCount(0);
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(1);
  });

  test('WB-010 列表滚动位置跨刷新恢复', async ({ page }) => {
    for (let index = 0; index < 30; index += 1) await seedQuestion(page, { title: `滚动现场 ${index}` });
    await page.goto('/questions');
    const scrollArea = page.locator('[data-region="question-list-scroll"]');
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(30);
    await scrollArea.evaluate((node) => { node.scrollTop = 240; });
    await expect.poll(() => scrollArea.evaluate((node) => node.scrollTop)).toBeGreaterThan(200);
    // The position is persisted for this account before the refresh.
    await expect.poll(() => page.evaluate(() => (
      JSON.parse(localStorage.getItem('tb.workbench.v1:fixture-teacher-a:scene:questions') || '{}').listScrollTop || 0
    ))).toBeGreaterThan(200);
    await page.reload();
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(30);
    await expect.poll(() => scrollArea.evaluate((node) => node.scrollTop)).toBeGreaterThan(200);
  });

  test('WB-010 Ctrl+S 与就近保存同义', async ({ page }) => {
    const question = await seedQuestion(page);
    await openQuestion(page, question.id);
    await page.locator('button[name="edit"]').click();
    await field(page, '题面段落 1').fill('用快捷键保存的题面');
    await page.keyboard.press('Control+s');
    await expectSaved(page);
    const stored = await apiRead(page, `/api/modules/questions/items/${question.id}`);
    expect(stored.body.version).toBe(2);
    expect(stored.body.body.blocks[0].runs[0].text).toBe('用快捷键保存的题面');
  });

  test('WB-011 删除结果未确认时刷新后仍有重试入口', async ({ page }) => {
    const question = await seedQuestion(page);
    await openQuestion(page, question.id);
    await fault(page, { mode: 'drop-response-after-commit', match: { method: 'POST', pathIncludes: '/deletion' } });
    await fault(page, { mode: 'drop-response-on-replay', times: 5, match: { method: 'POST', pathIncludes: '/deletion' } });
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '删除题目' }).click();
    await page.locator('button[name="dialog-confirm"]').click();
    await expect(page.locator('[data-region="delete-problem"]')).toContainText('确认');
    await clearFaults(page);
    await page.reload();
    await expect(page.locator('[data-region="delete-problem"] button[name="retry-confirm"]')).toBeVisible();
    await page.locator('[data-region="delete-problem"] button[name="retry-confirm"]').click();
    await expect(page.locator('[data-region="question-deleted"]')).toBeVisible();
  });

  test('WB-010/U0-U7 现场：搜索、多选、面板与 AI 草稿跨模块与刷新恢复', async ({ page }) => {
    await seedQuestion(page, { title: '现场题目一' });
    await seedQuestion(page, { title: '现场题目二' });
    await page.goto('/questions');
    await field(page, '搜索题目').fill('现场');
    await page.locator('[data-region="question-rows"] .wb-row-select input').first().check();
    await page.locator('button[name="new-manual"]').click();
    await fillParagraph(page, '题面', '题面段落 1', '临时草稿');
    await page.getByRole('link', { name: '设置', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.locator('.wb-sidebar').getByRole('link', { name: '题库' }).click();
    await expect(field(page, '搜索题目')).toHaveValue('现场');
    await expect(page.locator('[data-region="selection"]')).toContainText('已选 1 题');

    // 普通浏览不抢走 AI；AI 输入现场保留
    await page.locator('.wb-sidebar').getByRole('button', { name: 'AI 助理' }).click();
    await expect(page.getByRole('tab', { name: 'AI 助理' })).toBeVisible();
    await page.locator('[data-region="question-rows"] [data-row-open]').first().click();
    await expect(page.getByRole('tab', { name: 'AI 助理' })).toHaveAttribute('aria-selected', 'true');
    await field(page, 'AI 输入').fill('帮我准备二次函数的引入');
    await expect(page.locator('[data-ai-thread]')).toBeEmpty();

    await page.reload();
    await expect(field(page, '搜索题目')).toHaveValue('现场');
    await expect(page.locator('[data-region="selection"]')).toContainText('已选 1 题');
    await expect(field(page, 'AI 输入')).toHaveValue('帮我准备二次函数的引入');
    await expect(page.locator('.wb-aux')).toBeVisible();
    await shot(page, 'PC-U0-现场恢复');
  });
});

test.describe('平板 768×1024', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test.beforeEach(async ({ page }) => {
    await reset(page);
    await signIn(page, 'A');
  });

  test('WB-004/006/010/014/015 平板区域切换、右栏独占与溢出检查', async ({ page }) => {
    const question = await seedQuestion(page, {
      title: '很长的公式题',
      text: '已知函数 ',
      latex: 'f(x)=\\frac{-b+\\sqrt{b^{2}-4ac}}{2a}+\\sum_{n=1}^{\\infty}\\frac{1}{n^{2}}+\\int_{0}^{1}x^{2}\\,dx'
    });
    await page.goto('/questions');
    await expect(page.locator('[data-region="question-list"]')).toBeVisible();
    await expect(page.locator('[data-region="question-pane"]')).toBeHidden();
    await shot(page, '平板-题库列表');

    await page.locator('[data-region="question-rows"] [data-row-open]').first().click();
    await expect(page.locator('[data-region="question-pane"]')).toBeVisible();
    await expect(page.locator('[data-region="question-list"]')).toBeHidden();
    await shot(page, '平板-题目阅读');
    await page.locator('button[name="back-to-list"]').click();
    await expect(page.locator('[data-region="question-list"]')).toBeVisible();

    // 右栏独占内容区域，关闭后回到原位置
    await page.locator('.wb-sidebar').getByRole('button', { name: 'AI 助理' }).click();
    const aux = page.locator('.wb-aux');
    await expect(aux).toBeVisible();
    const auxBox = await aux.boundingBox();
    const workspaceBox = await page.locator('.wb-workspace').boundingBox();
    expect(Math.abs(auxBox.width - workspaceBox.width)).toBeLessThanOrEqual(2);
    await shot(page, '平板-右栏独占');
    await page.locator('.wb-aux').getByRole('button', { name: '关闭辅助栏' }).click();
    await expect(page.locator('[data-region="question-list"]')).toBeVisible();

    // 改编对照在平板上按区域切换
    await page.locator('[data-region="question-rows"] [data-row-open]').first().click();
    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '复制修改' }).click();
    await expect(page.locator('[data-region="compare-target"]')).toBeVisible();
    await expect(page.locator('[data-region="compare-source"]')).toBeHidden();
    await page.locator('button[name="compare-source-tab"]').click();
    await expect(page.locator('[data-region="compare-source"]')).toBeVisible();
    await expect(page.locator('[data-region="compare-target"]')).toBeHidden();
    await shot(page, '平板-改编对照切换');
    await page.locator('button[name="compare-target-tab"]').click();
    await expect(page.locator('[data-region="compare-target"]')).toBeVisible();

    // 长公式在自己的区域内处理，不撑破页面
    await page.goto(`/questions/${question.id}`);
    await expect(page.locator('[data-region="question-reader"]')).toBeVisible();
    const formulaOverflow = await page.locator('.wb-math-block').first().evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth
    }));
    expect(formulaOverflow.clientWidth).toBeLessThanOrEqual(768);
    // A long formula may scroll inside its own region, never push the page wider.
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(pageOverflow).toBeLessThanOrEqual(1);

  });
});

test.describe('桌面几何与动效', () => {
  test.beforeEach(async ({ page }) => {
    await reset(page);
    await signIn(page, 'A');
  });

  test('U0-U7 中央两区约 35:65、区域间隙、独立滚动与右栏占位', async ({ page }) => {
    await seedQuestion(page, { title: '几何检查题' });
    await page.goto('/questions');
    const listBox = await page.locator('[data-region="question-list"]').boundingBox();
    const contentBox = await page.locator('[data-region="question-pane"]').boundingBox();
    const ratio = listBox.width / (listBox.width + contentBox.width);
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.4);
    const gap = contentBox.x - (listBox.x + listBox.width);
    expect(gap).toBeGreaterThan(6);

    // B16-UI-001: with no question open the current-question column keeps its
    // layout width but must not be painted as a full-height empty frame.
    const emptyPane = await page.locator('[data-region="question-pane"]').evaluate((pane) => {
      const style = getComputedStyle(pane);
      return {
        background: style.backgroundColor,
        boxShadow: style.boxShadow,
        border: style.borderTopStyle + style.borderRightStyle + style.borderBottomStyle + style.borderLeftStyle
      };
    });
    expect(emptyPane.background).toBe('rgba(0, 0, 0, 0)');
    expect(emptyPane.boxShadow).toBe('none');
    expect(emptyPane.border).toBe('nonenonenonenone');

    const mainWidthBefore = (await page.locator('[data-region="main"]').boundingBox()).width;
    await page.locator('.wb-sidebar').getByRole('button', { name: 'AI 助理' }).click();
    await expect(page.locator('.wb-aux')).toBeVisible();
    const mainWidthAfter = (await page.locator('[data-region="main"]').boundingBox()).width;
    expect(mainWidthAfter).toBeLessThan(mainWidthBefore);

    // 列表独立滚动，正文区不受影响
    for (let index = 0; index < 30; index += 1) await seedQuestion(page, { title: `滚动题 ${index}` });
    await page.reload();
    const scrollArea = page.locator('[data-region="question-list-scroll"]');
    await expect(page.locator('[data-region="question-rows"] [data-question-id]')).toHaveCount(31);
    await scrollArea.evaluate((node) => { node.scrollTop = 200; });
    await expect.poll(() => scrollArea.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    const paneScroll = await page.locator('[data-region="question-pane"]').evaluate((node) => node.scrollTop);
    expect(paneScroll).toBe(0);
    await shot(page, 'PC-几何检查');
  });

  test('浮层渐进出现、Esc 关闭并回到触发处，减弱动效直接落终态', async ({ page }) => {
    const question = await seedQuestion(page);
    await openQuestion(page, question.id);
    const trigger = page.getByRole('button', { name: '更多操作' });
    await trigger.click();
    const popover = page.locator('[data-overlay="popover"]');
    await expect(popover).toBeVisible();
    const samples = await page.evaluate(async () => {
      const node = document.querySelector('[data-overlay="popover"]');
      const values = [];
      const start = performance.now();
      return new Promise((resolve) => {
        function frame() {
          const style = getComputedStyle(node);
          values.push({ t: performance.now() - start, opacity: Number(style.opacity), transform: style.transform });
          if (performance.now() - start > 260) resolve(values);
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    });
    expect(samples.some((sample) => sample.opacity < 0.98)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger.click();
    const reduced = await page.evaluate(() => getComputedStyle(document.querySelector('[data-overlay="popover"]')).animationName);
    expect(reduced).toBe('none');
  });
});
