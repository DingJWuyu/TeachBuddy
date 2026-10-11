import { chromium } from '@playwright/test';
import { mkdtemp, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
// This checked-in snapshot requires no local Git objects or browser profile.
const legacyFixture = 'extensions/math-web-ai/test/fixtures/legacy-0.1';
const temporary = await mkdtemp(join(tmpdir(), 'teachbuddy-legacy-'));
const extension = join(temporary, 'extension');
await cp('extensions/math-web-ai', extension, {
  recursive: true
});
for (const file of ['manifest.json', 'background.js', 'workbench.js', 'deepseek.js']) {
  await cp(join(legacyFixture, file), join(extension, file));
}
const fixture = await readFile('extensions/math-web-ai/test/deepseek.fixture.html', 'utf8');
const context = await chromium.launchPersistentContext(join(temporary, 'profile'), {
  executablePath: process.argv[2] || '/usr/bin/google-chrome-stable',
  headless: true,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: ['--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP * ~NOTFOUND']
});
let passed = false;
try {
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return host === 'chat.deepseek.com' ? route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: fixture
    }) : host === 'localhost' ? route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<textarea id="draft">升级前输入</textarea>'
    }) : route.abort();
  });
  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  await manager.locator('#devMode').click();
  const cdp = await context.browser().newBrowserCDPSession();
  const {
    id
  } = await cdp.send('Extensions.loadUnpacked', {
    path: extension
  });
  const page = await context.newPage();
  await page.goto('http://localhost:45999/');
  const bridge = (await readFile('apps/web/src/features/math/web-ai/bridge.js', 'utf8')).replaceAll('export function', 'function');
  await page.evaluate(bridge + ';window.webAiRequest=webAiRequest;');
  const status = await page.evaluate(() => window.webAiRequest('STATUS', 'legacy'));
  assert.equal(status.extensionVersion, '0.1.0');
  const opened = context.waitForEvent('page');
  const connected = page.evaluate(() => window.webAiRequest('CONNECT', 'legacy'));
  const provider = await opened;
  await provider.goto('https://chat.deepseek.com/');
  await connected;
  await page.evaluate(() => {
    window.result = null;
    window.webAiRequest('SEND', 'legacy', {
      prompt: 'slow fixture-context'
    }).then(data => {
      window.result = {
        done: data
      };
    }, error => {
      window.result = {
        code: error.code,
        message: error.message
      };
    });
  });
  await provider.waitForFunction(() => document.querySelectorAll('.ds-message[data-message-author-role="user"]').length === 1);
  await cp('extensions/math-web-ai', extension, {
    recursive: true
  });
  await manager.evaluate(id => new Promise((resolve, reject) => chrome.developerPrivate.reload(id, {
    failQuietly: true
  }, () => chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve())), id);
  await page.waitForFunction(() => window.result !== null, null, {
    timeout: 10000
  });
  const result = await page.evaluate(() => window.result);
  assert.equal(result.code, 'EXTENSION_UPDATED');
  const updated = await page.evaluate(() => window.webAiRequest('STATUS', 'legacy'));
  assert.equal(updated.extensionVersion, '0.2.0');
  assert.equal(updated.connectionState, 'available');
  assert.equal(await page.locator('#draft').inputValue(), '升级前输入');
  await page.waitForTimeout(6500);
  assert.equal(await provider.locator('.ds-message[data-message-author-role="user"]').count(), 1);
  assert.equal((await page.evaluate(() => window.result)).code, 'EXTENSION_UPDATED');
  passed = true;
  console.log(JSON.stringify({
    passed,
    browser: context.browser().version(),
    baseline: '5ce82d8e 0.1.0',
    target: '0.2.0',
    result,
    updated,
    checks: '旧0.1正在生成时真实升级，页面桥及时中止、输入和旧provider保留，不自动重发；旧session绑定清空后诚实available需重连'
  }, null, 2));
} finally {
  await context.close();
  if (passed) await rm(temporary, {
    recursive: true,
    force: true
  });else console.error('保留失败现场', temporary);
}
