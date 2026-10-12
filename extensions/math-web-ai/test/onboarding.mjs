import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';

const directory = fileURLToPath(new URL('.', import.meta.url));
const executablePath = process.argv[2] || '/usr/bin/google-chrome-stable';
const temporary = await mkdtemp(join(tmpdir(), 'teachbuddy-onboarding-'));
const extension = join(temporary, 'extension');
await cp(resolve(directory, '..'), extension, { recursive: true });
const fixture = await readFile(join(directory, 'deepseek.fixture.html'), 'utf8');
let context;
let workbench;
let passed = false;
const log = [];
try {
  context = await chromium.launchPersistentContext(join(temporary, 'profile'), {
    executablePath, headless: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP * ~NOTFOUND'],
  });
  await context.route('**/*', async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'chat.deepseek.com') await route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture });
    else if (host === 'localhost') await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><textarea id="draft">保留输入</textarea>' });
    else await route.abort();
  });
  const page = await context.newPage();
  workbench = page;
  await page.goto('http://localhost:45999/');
  await page.evaluate(() => {
    window.replies = [];
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'teachbuddy-web-ai') window.replies.push(event.data);
    });
  });
  const send = (type, requestId, prompt) => page.evaluate((data) => window.postMessage(data, location.origin),
    { source: 'teachbuddy-workbench', type, requestId, sessionId: 'onboarding', prompt });
  const wait = async (type, requestId) => {
    await page.waitForFunction(({ type, requestId }) => window.replies.some((r) => r.type === type && r.requestId === requestId),
      { type, requestId }, { timeout: 20000 });
    return page.evaluate(({ type, requestId }) => window.replies.find((r) => r.type === type && r.requestId === requestId), { type, requestId });
  };
  await send('STATUS', 'absent');
  await page.waitForTimeout(1900);
  assert.equal(await page.evaluate(() => window.replies.length), 0);
  const management = await context.newPage();
  const edge = /(?:microsoft-edge|msedge)/.test(executablePath);
  await management.goto(edge ? 'edge://extensions/' : 'chrome://extensions/');
  await management.locator(edge ? '#dev-switch:visible' : '#devMode').first().click();
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension });
  await page.waitForFunction(() => window.replies.some((r) => r.type === 'AVAILABILITY'));
  assert.equal(await page.locator('#draft').inputValue(), '保留输入');
  await send('STATUS', 'installed');
  assert.equal((await wait('STATUS', 'installed')).connectionState, 'available');
  log.push({ check: '打开工作台后真实安装，无刷新发现且输入保留', passed: true, extensionId: id });
  const worker = context.serviceWorkers().find((w) => w.url().startsWith(`chrome-extension://${id}/`));
  assert.ok(worker);
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'http://localhost/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['workbench.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['workbench.js'] });
  });
  await send('STATUS', 'single-status');
  await wait('STATUS', 'single-status');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.replies.filter((r) => r.requestId === 'single-status').length), 1);
  const providerOpened = context.waitForEvent('page');
  await send('CONNECT', 'connect');
  const provider = await providerOpened;
  await provider.goto('https://chat.deepseek.com/');
  await wait('CONNECTED', 'connect');
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://chat.deepseek.com/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['deepseek.js'] });
  });
  await send('SEND', 'pending', 'slow fixture-context');
  await provider.waitForFunction(() => document.querySelectorAll('.ds-message[data-message-author-role="user"]').length > 0);
  const before = await provider.locator('.ds-message[data-message-author-role="user"]').count();
  const manifestPath = join(extension, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = '0.2.1';
  await writeFile(manifestPath, JSON.stringify(manifest));
  await management.evaluate((id) => new Promise((resolve, reject) => {
    chrome.developerPrivate.reload(id, { failQuietly: true }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve();
    });
  }), id);
  const updated = await wait('ERROR', 'pending');
  assert.equal(updated.code, 'EXTENSION_UPDATED');
  await page.waitForFunction(() => window.replies.some((r) => r.type === 'AVAILABILITY' && r.extensionVersion === '0.2.1'));
  await send('STATUS', 'updated');
  const state = await wait('STATUS', 'updated');
  assert.equal(state.extensionVersion, '0.2.1');
  assert.equal(state.connectionState, 'ready');
  assert.equal(await page.locator('#draft').inputValue(), '保留输入');
  await page.waitForTimeout(6500);
  assert.equal(await provider.locator('.ds-message[data-message-author-role="user"]').count(), before);
  assert.equal(await page.evaluate(() => window.replies.filter((r) => r.requestId === 'pending' && r.type === 'DONE').length), 0);
  assert.equal(context.pages().filter((p) => p.url().startsWith('https://chat.deepseek.com')).length, 1);
  log.push({ check: '重复注入单响应，运行时真实重载升级，保留绑定/输入，中止待处理请求且不重发/无迟到DONE', passed: true });
  await send('SEND', 'after-update', 'fixture-context next round');
  assert.ok((await wait('DONE', 'after-update')).text);
  await provider.reload();
  await send('CONNECT', 'refresh-connect');
  await wait('CONNECTED', 'refresh-connect');
  assert.equal(context.pages().filter((p) => p.url().startsWith('https://chat.deepseek.com')).length, 1);
  await provider.close();
  await send('STATUS', 'closed');
  assert.equal((await wait('STATUS', 'closed')).connectionState, 'disconnected');
  const reopened = context.waitForEvent('page');
  await send('CONNECT', 'reconnect');
  const newProvider = await reopened;
  await newProvider.goto('https://chat.deepseek.com/');
  await wait('CONNECTED', 'reconnect');
  log.push({ check: '升级后再次SEND、provider刷新复用、关闭准确断连及重连', passed: true });
  passed = true;
  console.log(JSON.stringify({ passed, executablePath, browserVersion: context.browser().version(),
    scope: '真实浏览器隔离profile + CDP安装/扩展管理页本机重载，离线DeepSeek夹具；未验证商店发布/商店自动更新', log }, null, 2));
} catch (error) {
  console.error('失败时回复:', await workbench?.evaluate(() => window.replies).catch(() => null));
  throw error;
} finally {
  await context?.close();
  if (passed) await rm(temporary, { recursive: true, force: true });
  else console.error('失败现场保留:', temporary, JSON.stringify(log));
}
