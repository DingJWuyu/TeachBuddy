import fs from 'node:fs';
import { test, expect, register, navigate } from './fixture.mjs';

// Only the model reply is controlled. Authentication, editing, persistence and
// the pinned local GGB engine all run through the real application.
async function installBridge(page) {
  await page.addInitScript(() => {
    window.mathEditingRequests = [];
    window.replyMathEditing = (request, text) => window.postMessage({ source: 'teachbuddy-web-ai', type: 'DONE',
      requestId: request.requestId, sessionId: request.sessionId, extensionVersion: '0.2.0', connectionState: 'available', text }, location.origin);
    window.addEventListener('message', event => {
      const request = event.data;
      if (event.source !== window || request?.source !== 'teachbuddy-workbench') return;
      if (request.type === 'STATUS' || request.type === 'CONNECT') {
        window.postMessage({ source: 'teachbuddy-web-ai', type: request.type === 'STATUS' ? 'STATUS' : 'CONNECTED',
          requestId: request.requestId, sessionId: request.sessionId, extensionVersion: '0.2.0', connectionState: 'available' }, location.origin);
      }
      if (request.type !== 'SEND') return;
      const body = JSON.parse(request.prompt.slice(request.prompt.lastIndexOf('\n\n') + 2));
      window.mathEditingRequests.push(body);
      if (body.execution) { window.replyMathEditing(request, JSON.stringify({ message: '核对结束', changes: {} })); return; }
      if (body.request === '等待期间我会修改') { window.heldMathEditing = request; return; }
      const changes = body.current.source ? { formulas: body.current.source.formulas.map(formula => ({ ...formula, latex: 'x+99' })) }
        : { operations: body.request === '建立新点后停止' ? [{ type: 'define', name: 'Q', expression: '(2,3)' }] : [{ type: 'setValue', name: 'a', value: 2 }] };
      window.replyMathEditing(request, JSON.stringify({ message: '应用修改', changes }));
    });
  });
}

async function ask(page, text) {
  const open = page.getByRole('button', { name: '打开 AI 助理', exact: true });
  if (await open.isVisible()) await open.click();
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  await page.getByRole('textbox', { name: '向数学助理提问', exact: true }).fill(text);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
}

async function replaceFormula(page, text) {
  const field = page.locator('math-field');
  await field.press('ControlOrMeta+A');
  await field.press('Backspace');
  await field.pressSequentially(text);
  await expect.poll(() => field.evaluate(input => input.value)).toBe(text);
}

test('M-L1 已提交公式让位于同 ID AI 修改，后续手动输入跨防抖、离开与刷新保持一致', async ({ page, world }, info) => {
  await installBridge(page);
  await register(page, world);
  await navigate(page, '/math');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: /写公式/ }).click();
  await page.locator('math-field').pressSequentially('x+1');
  await page.getByRole('button', { name: '加入作品', exact: true }).click();
  await page.locator('.mw-formula-edit math-field').press('Enter');
  await expect(page.locator('.mw-save-state')).toHaveText('已保存');
  await page.getByRole('button', { name: '编辑公式 1', exact: true }).click();
  await replaceFormula(page, 'x+2');
  await expect(page.locator('.mw-save-state')).toHaveText('等待保存');
  await expect(page.locator('.mw-save-state')).toHaveText('已保存');
  await ask(page, '把同一个公式改成x+99');
  await expect(page.getByText('核对结束', { exact: true })).toBeVisible();
  await expect.poll(() => page.locator('math-field').evaluate(input => input.value)).toBe('x+99');
  expect(await page.evaluate(() => window.mathEditingRequests[1].current.source.formulas[0].latex)).toBe('x+99');
  expect(await page.evaluate(() => window.mathEditingRequests[1].execution.saved)).toBe(false);
  await page.screenshot({ path: info.outputPath('formula-ai.png') });
  await navigate(page, '/resources');
  await navigate(page, '/math');
  await page.getByRole('button', { name: '编辑公式 1', exact: true }).click();
  await expect.poll(() => page.locator('math-field').evaluate(input => input.value)).toBe('x+99');

  // Drive the debounce boundary explicitly, without depending on Runner speed.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await replaceFormula(page, 'x+3');
  await page.clock.runFor(640);
  await page.locator('math-field').pressSequentially('+4');
  await page.clock.runFor(20);
  await expect.poll(() => page.locator('math-field').evaluate(input => input.value)).toBe('x+3+4');
  await page.clock.runFor(650);
  await page.clock.resume();
  await expect(page.locator('.mw-save-state')).toHaveText('已保存');
  await page.reload();
  await page.getByRole('button', { name: '编辑公式 1', exact: true }).click();
  await expect.poll(() => page.locator('math-field').evaluate(input => input.value)).toBe('x+3+4');
  await page.screenshot({ path: info.outputPath('formula-reopened.png') });
});

async function openLegacy(page, world) {
  let pageId;
  page.on('request', request => { const id = request.headers()['x-teachbuddy-page']; if (id) pageId = id; });
  await installBridge(page);
  await page.route('https://www.geogebra.org/apps/deployggb.js', async route => {
    await page.addScriptTag({ url: world.origin + '/vendor/math/geogebra/loader.js' });
    await route.fulfill({ body: '', contentType: 'text/javascript' });
  });
  await page.addInitScript(() => {
    let Constructor;
    Object.defineProperty(window, 'GGBApplet', { configurable: true, get: () => Constructor, set: Value => {
      Constructor = class extends Value {
        constructor(options, ...rest) {
          const loaded = options.appletOnLoad;
          super({ ...options, appletOnLoad(api) { window.mathEditingEngine = api; window.mathEditingGeneration = (window.mathEditingGeneration || 0) + 1; loaded?.(api); } }, ...rest);
        }
      };
    } });
  });
  await register(page, world);
  await navigate(page, '/math');
  const source = JSON.parse(fs.readFileSync(new URL('../../../api/test/fixtures/math-workshop/saved-plane-view-source.json', import.meta.url)));
  const created = await page.evaluate(async ({ base64, pageId }) => {
    const response = await fetch('/api/modules/math/v1/works', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TeachBuddy-Request': '1', 'X-TeachBuddy-Page': pageId, 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ title: '旧源调用语义', source: { schemaVersion: 1, kind: 'geogebra', appName: 'classic', base64 }, originalFileId: null }) });
    return response.status;
  }, { base64: source.graph.base64, pageId });
  expect(created).toBe(201);
  // Seed the legacy loader with this candidate's actual local engine, avoiding
  // an unrelated geogebra.org deployment download in deterministic regression.
  await page.addScriptTag({ url: world.origin + '/vendor/math/geogebra/loader.js' });
  await navigate(page, '/resources');
  await navigate(page, '/math');
  await page.getByText('旧源调用语义', { exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => window.mathEditingEngine?.getValue('a')), { timeout: 90_000 }).toBe(1);
}

test('M-L2 旧 GGB AI 以当前版本修改真实构造，保存后重开仍为新值', async ({ page, world }, info) => {
  test.setTimeout(120_000);
  await openLegacy(page, world);
  await ask(page, '把a改成2');
  await expect(page.getByText('核对结束', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.mathEditingEngine.getValue('a'))).toBe(2);
  const execution = await page.evaluate(() => window.mathEditingRequests[1]);
  expect(execution.execution.ok).toBe(true);
  expect(execution.current.objects.find(object => object.name === 'a').numericValue).toBe(2);
  await expect(page.locator('.mw-save-state')).toHaveText(/^未保存/);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.mw-save-state')).toHaveText(/^已保存/);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.mathEditingEngine?.getValue('a')), { timeout: 90_000 }).toBe(2);
  await page.screenshot({ path: info.outputPath('legacy-reopened.png') });
});

test('M-L2 等待 AI 时真实构造更新仍冲突，保留老师的新值', async ({ page, world }) => {
  test.setTimeout(120_000);
  await openLegacy(page, world);
  await ask(page, '等待期间我会修改');
  await expect.poll(() => page.evaluate(() => !!window.heldMathEditing)).toBe(true);
  await page.evaluate(() => {
    window.mathEditingEngine.setValue('a', 3);
    window.replyMathEditing(window.heldMathEditing, JSON.stringify({ message: '应用过期修改', changes: { operations: [{ type: 'setValue', name: 'a', value: 2 }] } }));
  });
  await expect(page.getByText('核对结束', { exact: true })).toBeVisible();
  const execution = await page.evaluate(() => window.mathEditingRequests[1].execution);
  expect(execution).toMatchObject({ ok: false, code: 'conflict' });
  expect(await page.evaluate(() => window.mathEditingEngine.getValue('a'))).toBe(3);
});

test('M-L2 停止正在执行的旧 GGB 操作会恢复原构造，迟到完成不能重新应用', async ({ page, world }) => {
  test.setTimeout(120_000);
  await openLegacy(page, world);
  await page.evaluate(() => {
    const api = window.mathEditingEngine;
    const execute = api.asyncEvalCommandGetLabels.bind(api);
    api.asyncEvalCommandGetLabels = async command => {
      const labels = await execute(command);
      window.mathEditingCommandFinished = true;
      await new Promise(resolve => { window.finishMathEditingCommand = resolve; });
      return labels;
    };
  });
  await ask(page, '建立新点后停止');
  await expect.poll(() => page.evaluate(() => !!window.mathEditingCommandFinished)).toBe(true);
  const generation = await page.evaluate(() => window.mathEditingGeneration);
  await page.getByRole('button', { name: '停止生成', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.mathEditingGeneration), { timeout: 90_000 }).toBeGreaterThan(generation);
  await page.evaluate(() => window.finishMathEditingCommand());
  await expect.poll(() => page.evaluate(() => window.mathEditingEngine.exists('Q'))).toBe(false);
  expect(await page.evaluate(() => window.mathEditingEngine.getValue('a'))).toBe(1);
});
