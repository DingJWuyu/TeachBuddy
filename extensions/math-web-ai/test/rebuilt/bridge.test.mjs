import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTestDirectory } from '../../../../apps/api/test/support/directories.js';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';

const extension = path.resolve('extensions/math-web-ai');
const fixture = fs.readFileSync(path.join(extension, 'test/deepseek.fixture.html'), 'utf8');

async function send(page, type, { requestId = randomUUID(), sessionId = 'math-session', prompt } = {}) {
  await page.evaluate(message => window.postMessage({ source: 'teachbuddy-workbench', ...message }, location.origin), { type, requestId, sessionId, ...(prompt ? { prompt } : {}) });
  return requestId;
}
async function response(page, requestId, types, extensionVersion) {
  const match = ({ requestId, types, extensionVersion }) => window.responses.some(message =>
    message.requestId === requestId && types.includes(message.type) && (!extensionVersion || message.extensionVersion === extensionVersion));
  await page.waitForFunction(match, { requestId, types, extensionVersion }, { timeout: 30000 });
  return page.evaluate(({ requestId, types, extensionVersion }) => window.responses.find(message =>
    message.requestId === requestId && types.includes(message.type) && (!extensionVersion || message.extensionVersion === extensionVersion)), { requestId, types, extensionVersion });
}

async function browser(t, legacy = false) {
  const directory = createTestDirectory('teachbuddy-bridge-');
  const extensionDirectory = legacy ? path.join(directory, 'extension') : extension;
  if (legacy) {
    fs.mkdirSync(extensionDirectory);
    for (const file of ['manifest.json', 'background.js', 'workbench.js', 'deepseek.js'])
      fs.copyFileSync(path.join(extension, 'test/fixtures/legacy-0.1', file), path.join(extensionDirectory, file));
    fs.cpSync(path.join(extension, 'icons'), path.join(extensionDirectory, 'icons'), { recursive: true });
  }
  const context = await chromium.launchPersistentContext(path.join(directory, 'profile'), {
    channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensionDirectory}`, `--load-extension=${extensionDirectory}`, '--proxy-server=http://127.0.0.1:9', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'],
  });
  let passed = false;
  t.after(async () => {
    if (!passed) {
      t.diagnostic(JSON.stringify(await Promise.all(context.pages().map(async page => ({
        url: page.url(), responses: page.url().startsWith('http://127.0.0.1:49189') ? await page.evaluate(() => window.responses) : undefined,
      })))));
    }
    await context.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else t.diagnostic(`保留扩展现场 ${directory}`);
  });
  context.setDefaultTimeout(15000);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://chat.deepseek.com') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture });
    if (url.origin === 'http://127.0.0.1:49189') return route.fulfill({ contentType: 'text/html', body: '<meta charset="utf-8"><textarea id="draft">未发送的作品请求</textarea>' });
    return route.abort();
  });
  await context.addInitScript(() => { window.responses = []; window.addEventListener('message', event => { if (event.source === window && event.origin === location.origin && event.data?.source === 'teachbuddy-web-ai') window.responses.push(event.data); }); });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto('http://127.0.0.1:49189/');
  return { context, page, extensionDirectory, complete() { passed = true; } };
}

test('C5 真实 MV3 桥两轮完整回复保留代码乘号，取消后迟到回复不发布', { timeout: 120000 }, async t => {
  const world = await browser(t);
  const { page, context } = world;
  const status = await response(page, await send(page, 'STATUS'), ['STATUS']);
  assert.equal(status.connectionState, 'available');
  assert.equal(context.pages().filter(page => page.url().startsWith('https://chat.deepseek.com')).length, 0, '状态探测不得创建模型标签页');
  const providerCreated = context.waitForEvent('page');
  const connectId = await send(page, 'CONNECT');
  const initialProvider = await providerCreated;
  await initialProvider.goto('https://chat.deepseek.com/');
  const connected = await response(page, connectId, ['CONNECTED', 'ERROR']);
  assert.equal(connected.type, 'CONNECTED', JSON.stringify({ connected, pages: await Promise.all(context.pages().map(async page => ({ url: page.url(), body: (await page.content()).slice(0, 500) }))) }));
  assert.equal(connected.loginRequired, false);
  await response(page, await send(page, 'CONNECT'), ['CONNECTED']);
  assert.equal(context.pages().filter(page => page.url().startsWith('https://chat.deepseek.com')).length, 1, '重复连接应复用专用标签页');
  for (const round of [1, 2]) {
    const result = await response(page, await send(page, 'SEND', { prompt: `round ${round} footer-delay` }), ['DONE', 'ERROR']);
    assert.equal(result.type, 'DONE');
    const data = JSON.parse(result.text);
    assert.equal(data.round, round, '不得把上一轮回复作为当前完整回复');
    assert.deepEqual(data.commands, ['f(x)=a*x^2', `A=(${round},0)`], '代码块须精确保留乘号，排除语言标题');
  }
  const id = await send(page, 'SEND', { prompt: 'slow cancel this request' });
  const provider = context.pages().find(page => page.url().startsWith('https://chat.deepseek.com'));
  await provider.waitForFunction(() => document.querySelectorAll('[data-message-author-role="user"]').length === 3);
  await send(page, 'CANCEL', { requestId: id });
  const cancelled = await response(page, id, ['ERROR']);
  assert.equal(cancelled.code, 'CANCELLED');
  // Wait on the fixture's actual delayed reply rather than an arbitrary quiet interval.
  await provider.waitForFunction(() => document.querySelectorAll('pre code').length === 3);
  assert.equal(await page.evaluate(id => window.responses.filter(message => message.requestId === id && message.type === 'DONE').length, id), 0, '取消请求不得发布迟到完成');
  assert.equal(await page.locator('#draft').inputValue(), '未发送的作品请求');
  world.complete();
});

test('C5 真实扩展重载接回已打开页面，中止在途请求且不自动重发', { timeout: 120000 }, async t => {
  const world = await browser(t);
  const { page, context } = world;
  const providerCreated = context.waitForEvent('page');
  const connectId = await send(page, 'CONNECT');
  const initialProvider = await providerCreated;
  await initialProvider.goto('https://chat.deepseek.com/');
  await response(page, connectId, ['CONNECTED']);
  const pending = await send(page, 'SEND', { prompt: 'slow update in progress' });
  const provider = context.pages().find(page => page.url().startsWith('https://chat.deepseek.com'));
  await provider.waitForFunction(() => document.querySelectorAll('[data-message-author-role="user"]').length === 1);
  await reload(context);
  const interrupted = await response(page, pending, ['ERROR']);
  assert.equal(interrupted.code, 'EXTENSION_UPDATED', '更新应明确中止在途请求');
  const status = await response(page, await send(page, 'STATUS'), ['STATUS']);
  assert.equal(status.connectionState, 'ready', '无需刷新原工作台即可重新探测连接');
  await provider.waitForFunction(() => document.querySelectorAll('pre code').length === 1);
  assert.equal(await provider.locator('[data-message-author-role="user"]').count(), 1, '更新不得自动重发原请求');
  assert.equal(await page.evaluate(id => window.responses.filter(message => message.requestId === id && message.type === 'DONE').length, pending), 0);
  const next = await response(page, await send(page, 'SEND', { prompt: 'new request after update' }), ['DONE', 'ERROR']);
  assert.equal(next.type, 'DONE');
  assert.equal(JSON.parse(next.text).round, 2, '更新后须可发送新请求');
  assert.equal(await page.locator('#draft').inputValue(), '未发送的作品请求');
  world.complete();
});

async function reload(context) {
  const management = await context.newPage();
  await management.goto('chrome://extensions/');
  const developerMode = management.locator('#devMode');
  if (await developerMode.getAttribute('aria-pressed') !== 'true') await developerMode.click();
  await management.locator('extensions-item').filter({ hasText: 'TeachBuddy' }).getByRole('button', { name: 'Reload', exact: true }).click();
  await management.close();
}

test('C5 固定 0.1 升级后原页面接收当前版本回复，新请求不发往旧连接', { timeout: 120000 }, async t => {
  const world = await browser(t, true);
  const { page, context, extensionDirectory } = world;
  const providerCreated = context.waitForEvent('page');
  const connectId = await send(page, 'CONNECT');
  const oldProvider = await providerCreated;
  await oldProvider.goto('https://chat.deepseek.com/');
  await response(page, connectId, ['CONNECTED']);
  for (const file of ['manifest.json', 'background.js', 'workbench.js', 'deepseek.js'])
    fs.copyFileSync(path.join(extension, file), path.join(extensionDirectory, file));
  await reload(context);
  const currentVersion = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'))).version;
  await page.waitForFunction(version => window.responses.some(message => message.type === 'AVAILABILITY' && message.extensionVersion === version), currentVersion);
  const status = await response(page, await send(page, 'STATUS'), ['STATUS']);
  assert.equal(status.extensionVersion, JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'))).version);
  assert.equal(status.connectionState, 'available', '0.1 会话失效后应要求明确重连');
  assert.equal(oldProvider.isClosed(), false, '升级不能关闭老师已有的 DeepSeek 网页');
  assert.equal(await oldProvider.locator('[data-message-author-role="user"]').count(), 0, '升级不应自行发送消息');
  const newProviderCreated = context.waitForEvent('page');
  const reconnectId = await send(page, 'CONNECT');
  const newProvider = await newProviderCreated;
  await newProvider.goto('https://chat.deepseek.com/');
  await response(page, reconnectId, ['CONNECTED'], currentVersion);
  const result = await response(page, await send(page, 'SEND', { prompt: 'new after legacy update' }), ['DONE', 'ERROR'], currentVersion);
  assert.equal(result.type, 'DONE', JSON.stringify(result));
  assert.deepEqual(JSON.parse(result.text).commands, ['f(x)=a*x^2', 'A=(1,0)']);
  assert.equal(await oldProvider.locator('[data-message-author-role="user"]').count(), 0, '新请求不能发到失效的旧连接');
  assert.equal(await page.locator('#draft').inputValue(), '未发送的作品请求');
  world.complete();
});
