import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';

// Real HTTP, registration and SQLite. Only the page/extension message boundary is
// controlled here; actual extension installation has its own browser regressions.
let world;
test.beforeEach(async ({ page }, info) => {
  world = undefined;
  await page.addInitScript(() => {
    const bridge = { version: '0.1.0', state: 'ready', requests: [], pending: null };
    window.onboardingBridge = bridge;
    window.addEventListener('message', (event) => {
      const request = event.data;
      if (event.source !== window || event.origin !== location.origin || request?.source !== 'teachbuddy-workbench') return;
      bridge.requests.push(request);
      if (request.type === 'SEND') { bridge.pending = request; return; }
      if (request.type === 'CANCEL') return;
      if (!['STATUS', 'CONNECT'].includes(request.type)) return;
      window.postMessage({ source: 'teachbuddy-web-ai', type: request.type === 'STATUS' ? 'STATUS' : 'CONNECTED',
        requestId: request.requestId, sessionId: request.sessionId, extensionVersion: bridge.version,
        connectionState: bridge.state, loginRequired: bridge.state === 'login' }, location.origin);
    });
  });
  const directory = info.outputPath('instance');
  fs.mkdirSync(directory, { recursive: true });
  world = await createIntegration({ directory,
    webDist: path.resolve(process.env.WORKBENCH_WEB_DIST ?? 'apps/web/dist') });
  await register(page, world, `onboarding-${info.testId.replace(/[^a-z0-9]/gi, '')}@example.test`);
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  if (!await page.locator('.math-web-assistant').isVisible()) {
    await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  }
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
});

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true });
    fs.writeFileSync(info.outputPath('bridge.json'), JSON.stringify(await page.evaluate(() => window.onboardingBridge), null, 2));
  }
  await world?.close();
  if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});

async function sendRequest(page, english = false) {
  if (english) {
    await page.getByRole('button', { name: '简体中文', exact: true }).click();
    await page.getByRole('menuitemradio', { name: /English/ }).click();
  }
  const input = page.getByRole('textbox', { name: english ? 'Ask Math Assistant' : '向数学助理提问', exact: true });
  await input.fill('画出 y=3x-2');
  await page.getByRole('button', { name: english ? 'Send message' : '发送消息', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.onboardingBridge.requests.filter(r => r.type === 'SEND').length)).toBe(1);
  return input;
}

for (const english of [false, true]) {
  test(`发送中升级：${english ? '英文' : '中文'}提示、重查状态、保留新输入且不重发`, async ({ page }, info) => {
    const input = await sendRequest(page, english);
    await input.fill('下一条尚未发送的新输入');
    const statusBefore = await page.evaluate(() => window.onboardingBridge.requests.filter(r => r.type === 'STATUS').length);
    await page.evaluate(() => {
      const bridge = window.onboardingBridge;
      bridge.version = '0.2.0'; bridge.state = 'available';
      window.postMessage({ source: 'teachbuddy-web-ai', type: 'AVAILABILITY', extensionVersion: bridge.version }, location.origin);
    });
    const alert = page.locator('.math-ai-error');
    if (english) {
      await expect(alert).toContainText(/extension.*updated/i);
      await expect(alert).toContainText(/request.*stopp/i);
      await expect(alert).not.toContainText('扩展已更新');
    } else {
      await expect(alert).toHaveText('扩展已更新，请求已停止。请先查看网页。');
    }
    await expect.poll(() => page.evaluate(() => window.onboardingBridge.requests.filter(r => r.type === 'STATUS').length)).toBeGreaterThan(statusBefore);
    await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-available/);
    await expect(input).toHaveValue('下一条尚未发送的新输入');
    await expect(page.locator('.math-ai-message.is-user')).toHaveText('画出 y=3x-2');
    await expect(page.locator('.math-ai-setup-popover').getByRole('button', {
      name: english ? 'Connect assistant' : '连接助理', exact: true,
    })).toBeVisible();
    await page.evaluate(() => {
      const pending = window.onboardingBridge.pending;
      window.postMessage({ source: 'teachbuddy-web-ai', type: 'DONE', requestId: pending.requestId,
        sessionId: pending.sessionId, text: '{"message":"迟到回复不得进入线程","changes":{}}' }, location.origin);
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('.math-ai-thread')).not.toContainText('迟到回复不得进入线程');
    expect(await page.evaluate(() => window.onboardingBridge.requests.filter(r => r.type === 'SEND').length)).toBe(1);
    await page.screenshot({ path: info.outputPath('updated.png') });
  });
}

test('LOGIN_REQUIRED大写错误码：英文登录引导与保留原始请求', async ({ page }, info) => {
  await sendRequest(page, true);
  const rawError = '请先登录 DeepSeek。';
  await page.evaluate((message) => {
    const bridge = window.onboardingBridge;
    bridge.state = 'login';
    window.postMessage({ source: 'teachbuddy-web-ai', type: 'ERROR', requestId: bridge.pending.requestId,
      sessionId: bridge.pending.sessionId, code: 'LOGIN_REQUIRED', message }, location.origin);
  }, rawError);
  await expect(page.locator('.math-ai-setup-popover').getByRole('button', { name: 'Open sign-in', exact: true })).toBeVisible();
  await expect(page.locator('.math-ai-error')).toHaveText(rawError);
  await expect(page.locator('.math-ai-message.is-user')).toHaveText('画出 y=3x-2');
  expect(await page.evaluate(() => window.onboardingBridge.requests.filter(r => r.type === 'SEND').length)).toBe(1);
  await page.screenshot({ path: info.outputPath('login-required.png') });
});
