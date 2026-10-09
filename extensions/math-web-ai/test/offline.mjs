import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const extension = process.argv[2] ? resolve(process.argv[2]) : resolve(testDir, '..');
const fixture = await readFile(join(testDir, 'deepseek.fixture.html'), 'utf8');
const profile = await mkdtemp(join(tmpdir(), 'teachbuddy-web-ai-test-'));
const log = [];
let context;
let passed = false;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    // tabs.create can navigate before Playwright attaches its route. Deny DNS too.
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
      '--host-resolver-rules=MAP * ~NOTFOUND'],
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'chat.deepseek.com') {
      await route.fulfill({ contentType: 'text/html', body: url.searchParams.has('signed-out')
        ? '<!doctype html><body><textarea id="chat-input" hidden></textarea><button>Log in</button></body>' : fixture });
    } else if (url.hostname === 'localhost') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>offline workbench</body>' });
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  await page.goto('http://localhost:45999/');
  await page.evaluate(() => {
    window.replies = [];
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'teachbuddy-web-ai') window.replies.push(event.data);
    });
  });
  const send = (type, requestId, prompt, sessionId = 'fixture') => page.evaluate(
    (message) => window.postMessage(message, location.origin),
    { source: 'teachbuddy-workbench', type, requestId, sessionId, prompt },
  );
  const wait = async (type, requestId) => {
    await page.waitForFunction(({ type, requestId }) => window.replies.some(
      (reply) => reply.type === type && reply.requestId === requestId,
    ), { type, requestId }, { timeout: 20000 });
    return page.evaluate(({ type, requestId }) => window.replies.find(
      (reply) => reply.type === type && reply.requestId === requestId,
    ), { type, requestId });
  };

  await send('STATUS', 'status');
  const available = await wait('STATUS', 'status');
  assert.equal(available.connectionState, 'available');
  log.push(available);
  const firstProvider = context.waitForEvent('page');
  await send('CONNECT', 'connect');
  const provider = await firstProvider;
  await provider.waitForLoadState('domcontentloaded');
  await provider.goto('https://chat.deepseek.com/');
  log.push(await wait('CONNECTED', 'connect'));
  await send('STATUS', 'ready');
  assert.equal((await wait('STATUS', 'ready')).connectionState, 'ready');
  await provider.goto('https://chat.deepseek.com/?signed-out');
  await send('STATUS', 'login-overlay');
  assert.equal((await wait('STATUS', 'login-overlay')).connectionState, 'login');
  await provider.goto('https://chat.deepseek.com/sign_in');
  await send('STATUS', 'login');
  assert.equal((await wait('STATUS', 'login')).connectionState, 'login');
  await send('CONNECT', 'login-connect');
  assert.equal((await wait('CONNECTED', 'login-connect')).loginRequired, true);
  await provider.goto('https://chat.deepseek.com/');
  await send('STATUS', 'after-login');
  assert.equal((await wait('STATUS', 'after-login')).connectionState, 'ready');
  log.push({ check: '安装发现、登录页识别、完成登录后自动探测', passed: true });

  await send('SEND', 'round1', 'fixture-context first round');
  const first = await wait('DONE', 'round1');
  assert.deepEqual(JSON.parse(first.text), { commands: ['f(x)=a*x^2', 'A=(1,0)'], round: 1 });
  log.push(first);

  await send('SEND', 'round2', 'fixture-context footer-delay second round');
  await page.waitForTimeout(3600);
  assert.equal(await page.evaluate(() => window.replies.some(
    (reply) => reply.requestId === 'round2' && reply.type === 'DONE',
  )), false, '旧回复的兄弟 footer 不能提前结束当前请求');
  const secondReply = await wait('DONE', 'round2');
  assert.deepEqual(JSON.parse(secondReply.text), { commands: ['f(x)=a*x^2', 'A=(2,0)'], round: 2 });
  assert.equal(secondReply.providerSessionUrl, first.providerSessionUrl);
  log.push(secondReply, { check: '兄弟 footer 隔离、连续会话、乘号与纯 JSON 提取', passed: true });

  await send('SEND', 'cancel', 'slow fixture-context');
  await page.waitForTimeout(850);
  await send('CANCEL', 'cancel');
  const cancelled = await wait('ERROR', 'cancel');
  assert.equal(cancelled.code, 'CANCELLED');
  log.push(cancelled);
  await page.waitForTimeout(6500);
  assert.equal(await page.evaluate(() => window.replies.filter(
    (reply) => reply.requestId === 'cancel' && reply.type === 'DONE',
  ).length), 0, '取消后不能回传迟到 DONE');
  log.push({ check: '取消后无迟到 DONE', passed: true });

  const nextProvider = context.waitForEvent('page');
  await send('CONNECT', 'new-session', null, 'fixture-2');
  const second = await nextProvider;
  await second.waitForLoadState('domcontentloaded');
  await second.goto('https://chat.deepseek.com/');
  log.push(await wait('CONNECTED', 'new-session'));
  const providers = context.pages().filter((candidate) => candidate.url().startsWith('https://chat.deepseek.com'));
  assert.equal(providers.length, 2, '不同工作台会话必须创建不同 provider tab');
  log.push({ check: '会话专属标签页', passed: true });

  await send('SEND', 'closed', 'slow fixture-context');
  await page.waitForTimeout(850);
  await provider.close();
  const closed = await wait('ERROR', 'closed');
  assert.ok(['PROVIDER_RELOADED', 'PROVIDER_CLOSED'].includes(closed.code));
  log.push(closed);
  await send('STATUS', 'closed-state');
  assert.equal((await wait('STATUS', 'closed-state')).connectionState, 'disconnected');
  const reopenedProvider = context.waitForEvent('page');
  await send('CONNECT', 'reconnect');
  const reopened = await reopenedProvider;
  await reopened.waitForLoadState('domcontentloaded');
  await reopened.goto('https://chat.deepseek.com/');
  assert.equal((await wait('CONNECTED', 'reconnect')).loginRequired, false);
  await send('STATUS', 'reconnected-state');
  assert.equal((await wait('STATUS', 'reconnected-state')).connectionState, 'ready');
  // Reloading the provider must recover without making another dedicated tab.
  await reopened.reload();
  await send('CONNECT', 'reload-connect');
  assert.equal((await wait('CONNECTED', 'reload-connect')).loginRequired, false);
  assert.equal(context.pages().filter((candidate) => candidate.url().startsWith('https://chat.deepseek.com')).length, 2);
  log.push({ check: '关闭后的准确状态、重连及刷新后复用专用标签页', passed: true });
  passed = true;
  console.log(JSON.stringify({ passed: true, scope: '离线 Chromium MV3 集成，不代表真实 DeepSeek 成功', log }, null, 2));
} catch (error) {
  console.error('失败前回执：', JSON.stringify(log));
  for (const page of context?.pages() || []) {
    console.error(page.url(), await page.evaluate(() => ({ html: document.body.innerHTML, replies: window.replies }))
      .catch(() => '页面已关闭'));
  }
  throw error;
} finally {
  try { await context?.close(); } finally {
    if (passed) await rm(profile, { recursive: true, force: true });
    else console.error('失败现场保留于：', profile);
  }
}
