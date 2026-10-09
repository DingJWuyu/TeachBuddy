import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';

// Real product and official GeoGebra; a fixed local reply isolates cancellation
// from website/model timing. This does not validate a real DeepSeek session.
test('停止执行撤回当前批次，旧实例的迟到构造不能修改恢复的画布', async ({ page }, info) => {
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
    await page.getByRole('button', { name: 'AI 助理', exact: true }).click();
    await page.getByLabel('向数学助理提问').fill('修改 A 并添加 B');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.waitForFunction(() => typeof window.cancelTestRelease === 'function');
    expect(await page.evaluate(() => {
      const api = window[document.querySelector('[data-param-id]').getAttribute('data-param-id')];
      return [api.getXcoord('A'), api.getYcoord('A')];
    })).toEqual([8, 9]);
    await page.getByRole('button', { name: '停止生成', exact: true }).click();
    await expect(page.locator('.math-ai-stage')).toHaveText('已停止');
    await expect(page.locator('.math-geogebra-credit')).toBeVisible({ timeout: 90000 });
    const release = await page.evaluate(() => window.cancelTestRelease()).catch(error => ({ error: error.message }));
    expect(release.error).toMatch(/removed/i);
    expect(await page.evaluate(() => {
      const api = window[document.querySelector('[data-param-id]').getAttribute('data-param-id')];
      return { A: [api.getXcoord('A'), api.getYcoord('A')], hasB: api.exists('B') };
    })).toEqual({ A: [2, 3], hasB: false });
    await expect(page.locator('.math-ai-message.is-tool[data-state="applied"]')).toHaveCount(0);
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
