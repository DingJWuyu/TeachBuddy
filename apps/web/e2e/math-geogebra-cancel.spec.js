import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';

async function sourceA(base64) {
  const xml = await (await JSZip.loadAsync(base64, { base64: true })).file('geogebra.xml').async('text');
  const point = xml.match(/<element type="point" label="A">[\s\S]*?<coords x="([^"]+)" y="([^"]+)" z="([^"]+)"/);
  return point ? [+point[1] / +point[3], +point[2] / +point[3]] : null;
}
async function deviceSource(page) {
  return page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.endsWith(':math-workspace'))
    .map(([, value]) => JSON.parse(value)).find(value => value.draft?.source.kind === 'geogebra')?.draft.source.base64);
}
async function save(page) {
  const pending = page.waitForResponse(response => response.url().includes('/api/modules/math/v1/works') && ['POST', 'PUT'].includes(response.request().method()));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const response = await pending;
  expect(response.status(), await response.text()).toBeLessThan(300);
  await expect(page.locator('.math-ggb-status')).toContainText('已保存');
  return response.json();
}
async function restored(page) {
  return page.evaluate(() => {
    const api = window[document.querySelector('[data-param-id]').getAttribute('data-param-id')];
    return { A: [api.getXcoord('A'), api.getYcoord('A')], hasB: api.exists('B') };
  });
}

// Real product and official GeoGebra; a fixed local reply isolates cancellation
// from website/model timing. This does not validate a real DeepSeek session.
test('停止执行保留批次前即时编辑，切模块及保存刷新后恢复，迟到构造被隔离', async ({ page }, info) => {
  const world = await createIntegration();
  let passed = false;
  try {
    await page.route('https://chat.deepseek.com/**', route => route.abort());
    await page.addInitScript(() => {
      window.addEventListener('message', event => {
        const request = event.data;
        if (event.source !== window || request?.source !== 'teachbuddy-workbench') return;
        const type = { STATUS: 'STATUS', CONNECT: 'CONNECTED', SEND: 'DONE' }[request.type];
        if (!type) return;
        window.postMessage({ source: 'teachbuddy-web-ai', type, requestId: request.requestId,
          sessionId: request.sessionId, text: JSON.stringify({ message: '修改 A 并添加 B', operations: [
            { type: 'setCoords', name: 'A', coords: [8, 9] },
            { type: 'define', name: 'B', expression: '(7,8)' },
          ] }) }, location.origin);
      });
    });
    await register(page, world, 'ggb-cancel@example.test');
    const tutorial = page.getByRole('button', { name: '知道了', exact: true });
    if (await tutorial.isVisible()) await tutorial.click();
    await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
    await page.getByRole('button', { name: '新建GeoGebra 数学画布', exact: true }).click();
    await expect(page.locator('.math-geogebra-credit')).toBeVisible({ timeout: 90000 });
    await page.getByText(/^输入/).first().click();
    await page.keyboard.type('A=(2,3)');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const id = document.querySelector('[data-param-id]')?.getAttribute('data-param-id');
      return id && window[id]?.exists('A');
    });
    const first = await save(page);
    expect(await sourceA(first.source.base64)).toEqual([2, 3]);
    await page.reload();
    await expect(page.locator('.math-geogebra-credit')).toBeVisible({ timeout: 90000 });
    await expect(page.locator('.math-ggb-status')).toContainText('已保存');
    await page.getByRole('button', { name: 'AI 助理', exact: true }).click();
    await page.getByLabel('向数学助理提问').fill('修改 A 并添加 B');
    await page.evaluate(() => {
      const api = window[document.querySelector('[data-param-id]').getAttribute('data-param-id')];
      const original = api.asyncEvalCommandGetLabels.bind(api);
      api.asyncEvalCommandGetLabels = command => command.startsWith('B=') ? new Promise((resolve, reject) => {
        window.cancelTestRelease = () => original(command).then(
          labels => { resolve(labels); return { labels }; },
          error => { reject(error); return { error: error.message || String(error) }; },
        );
      }) : original(command);
    });
    const input = page.getByLabel(/^在此处输入方程或代数式/);
    if (await input.count()) await page.locator('.math-geogebra').getByRole('treeitem').filter({ has: input }).click();
    else await page.getByText(/^输入/).first().click();
    await page.keyboard.type('A=(4,5)');
    await page.keyboard.press('Enter');
    // Observe the unsynchronized edit before sending with the real UI button.
    const beforeAI = await restored(page);
    const beforeSource = await deviceSource(page);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    expect(beforeAI.A).toEqual([4, 5]);
    expect(await sourceA(beforeSource)).toEqual([2, 3]);
    await page.waitForFunction(() => typeof window.cancelTestRelease === 'function');
    expect(await page.evaluate(() => {
      const api = window[document.querySelector('[data-param-id]').getAttribute('data-param-id')];
      return [api.getXcoord('A'), api.getYcoord('A')];
    })).toEqual([8, 9]);
    await page.getByRole('button', { name: '停止生成', exact: true }).click();
    expect(await sourceA(await deviceSource(page))).toEqual([4, 5]);
    await expect(page.locator('.math-ai-stage')).toHaveText('已停止');
    await expect(page.locator('.math-geogebra-credit')).toBeVisible({ timeout: 90000 });
    const release = await page.evaluate(() => window.cancelTestRelease()).catch(error => ({ error: error.message }));
    expect(release.error).toMatch(/removed/i);
    expect(await restored(page)).toEqual({ A: [4, 5], hasB: false });
    await expect.poll(async () => sourceA(await deviceSource(page))).toEqual([4, 5]);
    await expect(page.locator('.math-ai-message.is-tool[data-state="applied"]')).toHaveCount(0);
    const navigation = page.getByRole('navigation', { name: '功能模块', exact: true });
    await navigation.getByRole('link', { name: /^资源库/ }).click();
    await navigation.getByRole('link', { name: /^数学工坊/ }).click();
    await expect(page.locator('.math-geogebra-credit')).toBeVisible({ timeout: 90000 });
    expect(await restored(page)).toEqual({ A: [4, 5], hasB: false });
    const saved = await save(page);
    expect(saved.id).toBe(first.id);
    expect(saved.version).toBe(2);
    expect(await sourceA(saved.source.base64)).toEqual([4, 5]);
    await page.reload();
    await expect(page.locator('.math-geogebra-credit')).toBeVisible({ timeout: 90000 });
    expect(await restored(page)).toEqual({ A: [4, 5], hasB: false });
    await expect(page.locator('.math-ggb-status')).toContainText('已保存');
    passed = true;
  } finally {
    if (!passed) {
      await page.screenshot({ path: info.outputPath('failure.png') }).catch(() => {});
      console.error(`Retained GeoGebra cancellation fixture: ${world.directory}`);
    }
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
