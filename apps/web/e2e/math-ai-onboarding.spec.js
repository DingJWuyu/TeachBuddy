import { test as base, chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';
import { installMathProbe, enterMath, savedMath } from './math-unified-helpers.mjs';

const webDist = process.env.MATH_ONBOARDING_WEB_DIST;
if (!webDist) throw new Error('Set MATH_ONBOARDING_WEB_DIST to an isolated production build.');
const extensionRoot = path.resolve(process.env.MATH_ONBOARDING_EXTENSION_DIR ?? 'extensions/math-web-ai');
const providerFixture = (await fs.readFile(path.join(extensionRoot, 'test/deepseek.fixture.html'), 'utf8')).replace(
  "commands: ['f(x)=a*x^2', `A=(${number},0)`], round: number,",
  'message: "离线完成", changes: number === 1 ? { formulas: [{ id: "onboarding-formula", latex: "y=x^2", caption: "", includeCaption: true, color: "#1e293b", fontSize: 32 }] } : {},',
);
const signedOut = '<!doctype html><textarea hidden></textarea><button onclick="location.href=\'/a/chat/s/fixture-conversation?fixture-login\'">Log in</button>';
const providers = context => context.pages().filter(page => page.url().startsWith('https://chat.deepseek.com'));

const test = base.extend({
  world: async ({}, use, info) => {
    const directory = info.outputPath('instance'); await fs.mkdir(directory, { recursive: true });
    const world = await createIntegration({ directory, webDist: path.resolve(info.title.includes('商店') ? process.env.MATH_ONBOARDING_STORE_DIST ?? webDist : webDist) });
    world.provider = { signedOut: false, missingInput: false, hold: null };
    world.createRequests = [];
    await use(world);
    await world.close();
  },
  context: async ({ world }, use, info) => {
    const browserConfig = info.outputPath('browser-config'); await fs.mkdir(browserConfig, { recursive: true });
    const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
      executablePath: info.project.use.launchOptions?.executablePath,
      channel: 'chromium', headless: true, ignoreHTTPSErrors: true,
      ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1440, height: 900 },
      env: { ...process.env, XDG_CONFIG_HOME: browserConfig },
      args: ['--enable-unsafe-extension-debugging', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'],
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === world.origin) return route.continue();
      if (url.hostname !== 'chat.deepseek.com') return route.abort();
      if (world.provider.hold) await world.provider.hold;
      if (url.searchParams.has('fixture-login')) world.provider.signedOut = false;
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: world.provider.missingInput ? '<!doctype html><p>Loading</p>' : world.provider.signedOut ? signedOut : providerFixture });
    });
    await context.addInitScript(() => {
      window.onboardingDocument = crypto.randomUUID(); window.onboardingMessages = []; window.onboardingFocus = [];
      window.addEventListener('focus', event => window.onboardingFocus.push({ trusted: event.isTrusted, focus: document.hasFocus() }));
      window.addEventListener('message', event => {
        if (event.source === window && event.origin === location.origin && ['teachbuddy-workbench', 'teachbuddy-web-ai'].includes(event.data?.source)) window.onboardingMessages.push(event.data);
      });
    });
    await use(context);
    const page = context.pages().find(page => page.url().startsWith(world.origin));
    if (page) {
      await fs.writeFile(info.outputPath('messages.json'), JSON.stringify(await page.evaluate(() => window.onboardingMessages).catch(() => []), null, 2));
      await page.screenshot({ path: info.outputPath('final.png'), animations: 'disabled' }).catch(() => {});
    }
    await fs.writeFile(info.outputPath('environment.json'), JSON.stringify({ browser: info.project.name, version: context.browser().version(), origin: world.origin, directory: world.directory, createRequests: world.createRequests, focus: await page?.evaluate(() => window.onboardingFocus).catch(() => []) }, null, 2));
    await context.close();
  },
});

test.beforeEach(async ({ page, world }, info) => {
  await installMathProbe(page);
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/modules\/math\/v1\/works$/.test(request.url())) world.createRequests.push(request.postData()); });
  await register(page, world, `onboarding-${info.testId.replace(/[^a-z0-9]/gi, '').slice(0, 24)}@example.test`);
  const tutorial = page.getByRole('button', { name: '知道了', exact: true }); if (await tutorial.isVisible()) await tutorial.click();
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
  if (!await page.locator('.math-web-assistant').isVisible()) await page.getByRole('banner').getByRole('button', { name: 'AI 助理', exact: true }).click();
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-missing/);
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true, animations: 'disabled' }).catch(() => {});
});

async function install(context, info, legacy = false) {
  const extension = info.outputPath('extension'); await fs.cp(extensionRoot, extension, { recursive: true });
  if (legacy) for (const file of ['manifest.json', 'background.js', 'workbench.js', 'deepseek.js']) await fs.copyFile(path.join(extensionRoot, 'test/fixtures/legacy-0.1', file), path.join(extension, file));
  const management = await context.newPage();
  const edge = info.project.name === 'edge';
  await management.goto(edge ? 'edge://extensions/' : 'chrome://extensions/');
  await management.locator(edge ? '#dev-switch:visible' : '#devMode').first().click();
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension });
  return { id, extension, management, cdp };
}
async function openSetup(page) {
  const provider = page.locator('.math-ai-provider');
  if (await provider.getAttribute('aria-expanded') !== 'true') await provider.click();
  const popover = page.locator('.math-ai-setup-popover'); await expect(popover).toBeVisible(); return popover;
}
async function screenshot(page, info, name) {
  await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: info.outputPath(name), animations: 'disabled' });
}
async function returnTo(page) {
  // Headless Playwright keeps all tabs focused. CDP generates trusted native
  // blur/focus events, so this tests browser focus without DOM dispatchEvent.
  const session = await page.context().newCDPSession(page);
  const previous = await page.evaluate(() => window.onboardingFocus.length);
  const other = page.context().pages().find(candidate => candidate !== page && !candidate.isClosed());
  if (other) await other.bringToFront();
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.bringToFront();
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await expect.poll(() => page.evaluate(() => window.onboardingFocus.length)).toBeGreaterThan(previous);
  expect(await page.evaluate(() => window.onboardingFocus.at(-1)?.trusted)).toBe(true);
}

test('未发布与不支持浏览器：中英窄屏、焦点、热安装和登录返回后首页自动起稿', async ({ page, context, world }, info) => {
  const unsupported = info.project.name === 'unsupported-chromium';
  let popover = await openSetup(page);
  await expect(popover).toContainText(unsupported ? '仅支持 Chrome 与 Edge 桌面浏览器' : '暂未在应用商店上架');
  await expect(popover.locator('a')).toHaveCount(0);
  await expect(popover).not.toContainText(/开发者模式|ZIP|manifest|0\.\d/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await popover.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await screenshot(page, info, 'zh-narrow.png');
  await page.keyboard.press('Escape'); await expect(page.locator('.math-ai-provider')).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '简体中文', exact: true }).click(); await page.getByRole('menuitemradio', { name: /English/ }).click();
  popover = await openSetup(page); await expect(popover).toContainText(unsupported ? /Chrome.*Edge.*desktop/ : 'not yet in store');
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, info, 'en-narrow.png');
  const focusables = popover.locator('button:not(:disabled), a[href]');
  await focusables.last().focus(); await page.keyboard.press('Tab'); await expect(focusables.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(focusables.last()).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('.math-ai-provider')).toBeFocused();
  if (unsupported) return;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByRole('menuitemradio', { name: /简体中文/ }).click();
  const input = page.getByLabel('向数学助理提问', { exact: true }); await input.click(); await input.pressSequentially('制作一条抛物线');
  const marker = await page.evaluate(() => window.onboardingDocument);
  world.provider.signedOut = true;
  await install(context, info); await returnTo(page);
  await expect(page.locator('.math-ai-connection')).toHaveClass(/is-available/);
  expect(await page.evaluate(() => window.onboardingDocument)).toBe(marker); await expect(input).toHaveValue('制作一条抛物线');
  popover = await openSetup(page);
  const opened = context.waitForEvent('page'); await popover.getByRole('button', { name: '连接助理', exact: true }).click();
  const provider = await opened;
  // tabs.create may navigate before Playwright attaches the context route.
  await provider.goto('https://chat.deepseek.com/');
  await provider.bringToFront();
  await expect(provider.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.locator('.math-ai-setup-popover')).toContainText('请先登录 DeepSeek');
  await screenshot(page, info, 'login-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('.math-ai-setup-popover').evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await screenshot(page, info, 'login-narrow.png'); await page.setViewportSize({ width: 1440, height: 900 });
  await returnTo(page); await page.locator('.math-ai-setup-popover').getByRole('button', { name: '打开登录', exact: true }).click();
  expect(providers(context)).toHaveLength(1);
  await provider.getByRole('button', { name: 'Log in', exact: true }).click(); await provider.waitForURL('**/*fixture-login');
  await returnTo(page); await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  await expect(page.locator('.math-ai-setup-popover')).toHaveCount(0); await expect(page.locator('.math-ai-provider')).toBeFocused();
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  await expect(page.locator('.math-ai-message.is-user')).toHaveCount(1); await expect(page.locator('.mw-formula-row')).toHaveCount(1);
  await expect(page.locator('.math-ai-message.is-assistant').last()).toContainText('离线完成');
  await savedMath(page); expect(providers(context)).toHaveLength(1);
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await enterMath(page, 'f(x)=x^2', 'f'); await savedMath(page);
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await page.setViewportSize({ width: 1280, height: 800 }); await screenshot(page, info, 'store-material-1280x800.png');
  await page.getByRole('banner').getByRole('button', { name: 'AI 助理', exact: true }).click();
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  await expect(page.locator('.math-ai-message.is-assistant').last()).toContainText('离线完成');
  await screenshot(page, info, 'store-extension-purpose-1280x800.png');
});

test('真实 CONNECT 的焦点竞态、ready 后登录过期及错误均保留首页输入', async ({ page, context, world }, info) => {
  test.skip(info.project.name === 'unsupported-chromium', 'Desktop Chrome and Edge MV3 only');
  const installed = await install(context, info); await returnTo(page);
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-available/);
  let release; world.provider.hold = new Promise(resolve => { release = resolve; });
  const popover = await openSetup(page); const opened = context.waitForEvent('page');
  await popover.getByRole('button', { name: '连接助理', exact: true }).click(); const provider = await opened;
  await installed.management.bringToFront(); await returnTo(page);
  world.provider.hold = null; release();
  await provider.goto('https://chat.deepseek.com/');
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  expect(providers(context)).toHaveLength(1);
  const input = page.getByLabel('向数学助理提问', { exact: true }); await input.fill('过期时保留这条请求');
  world.provider.signedOut = true; await provider.goto('https://chat.deepseek.com/?signed-out');
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  await expect(page.locator('.math-ai-setup-popover')).toContainText('请先登录 DeepSeek'); await expect(input).toHaveValue('过期时保留这条请求');
  expect(world.createRequests).toHaveLength(0); await expect(page.locator('.math-ai-message.is-user')).toHaveCount(0);
  world.provider.signedOut = false; await provider.goto('https://chat.deepseek.com/'); await returnTo(page);
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  world.provider.missingInput = true; await provider.goto('https://chat.deepseek.com/?missing-input');
  await page.getByRole('button', { name: '开始制作', exact: true }).click();
  await expect(page.locator('.math-ai-error')).toContainText('未找到 DeepSeek 消息输入框', { timeout: 25000 });
  await expect(input).toHaveValue('过期时保留这条请求'); expect(world.createRequests).toHaveLength(0);
  await expect(page.locator('.math-ai-message.is-user')).toHaveCount(0); await screenshot(page, info, 'connect-error-input-kept.png');
  // Observe the separate SEND rejection boundary, without claiming CONNECT lost input.
  world.provider.missingInput = false; await provider.goto('https://chat.deepseek.com/'); await returnTo(page);
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await provider.locator('textarea').fill('provider已有草稿');
  await input.fill('被拒绝的制作请求'); await input.press('Enter');
  await expect(page.locator('.math-ai-error')).toContainText('草稿');
  await fs.writeFile(info.outputPath('send-rejection-observation.json'), JSON.stringify({ composer: await input.inputValue(), userMessages: await page.locator('.math-ai-message.is-user').allTextContents(), error: await page.locator('.math-ai-error').innerText(), connection: await page.locator('.math-ai-provider .math-ai-connection').getAttribute('class') }, null, 2));
  await screenshot(page, info, 'send-rejected-draft-preserved-in-thread.png');
  await provider.locator('textarea').fill('');
  await input.fill('slow 发送中登录过期'); await input.press('Enter');
  await expect(provider.locator('[data-message-author-role=user]')).toHaveCount(1);
  // The offline page changes to a signed-out view during a real MV3 request.
  await provider.evaluate(() => {
    document.querySelector('textarea').hidden = true;
    const login = document.createElement('button'); login.textContent = 'Log in'; document.body.append(login);
  });
  await expect(page.locator('.math-ai-error')).toContainText('请在 DeepSeek 标签页完成登录');
  await expect(page.locator('.math-ai-message.is-user').last()).toContainText('slow 发送中登录过期');
  await page.waitForTimeout(6500);
  await expect(provider.locator('[data-message-author-role=user]')).toHaveCount(1);
  await expect(page.locator('.mw-formula-row')).toHaveCount(0);
  await expect(page.locator('.math-ai-message.is-assistant')).toHaveCount(0);
  await fs.writeFile(info.outputPath('send-login-expiry-observation.json'), JSON.stringify({ composer: await input.inputValue(), userMessages: await page.locator('.math-ai-message.is-user').allTextContents(), error: await page.locator('.math-ai-error').innerText(), connection: await page.locator('.math-ai-provider .math-ai-connection').getAttribute('class') }, null, 2));
  await screenshot(page, info, 'send-login-expired.png');
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-login/);
});

test('真实 SEND CANCEL、发送中扩展更新、绑定与草稿保持及断线重连', async ({ page, context, world }, info) => {
  test.skip(info.project.name === 'unsupported-chromium', 'Desktop Chrome and Edge MV3 only');
  const installed = await install(context, info); await returnTo(page); await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-available/);
  const popover = await openSetup(page); const opened = context.waitForEvent('page'); await popover.getByRole('button', { name: '连接助理', exact: true }).click();
  const provider = await opened; await provider.goto('https://chat.deepseek.com/'); await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  const input = page.getByLabel('向数学助理提问', { exact: true }); await input.fill('slow 请制作抛物线'); await input.press('Enter');
  await expect(provider.locator('[data-message-author-role=user]')).toHaveCount(1); await page.getByRole('button', { name: '停止生成', exact: true }).click();
  await expect(page.locator('.math-ai-stage')).toHaveText('已停止'); await page.waitForTimeout(6500); await expect(page.locator('.mw-formula-row')).toHaveCount(0);
  await input.fill('slow 更新期间的请求'); await input.press('Enter'); await expect(provider.locator('[data-message-author-role=user]')).toHaveCount(2);
  await input.fill('更新期间保留草稿'); const marker = await page.evaluate(() => window.onboardingDocument);
  const manifestPath = path.join(installed.extension, 'manifest.json'); const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); manifest.version = '0.2.1'; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await installed.management.evaluate(id => new Promise((resolve, reject) => chrome.developerPrivate.reload(id, { failQuietly: true }, () => chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve())), installed.id);
  await expect(page.locator('.math-ai-error')).toContainText('扩展已更新'); await expect(page.getByRole('button', { name: '停止生成', exact: true })).toHaveCount(0);
  await expect(input).toHaveValue('更新期间保留草稿'); expect(await page.evaluate(() => window.onboardingDocument)).toBe(marker);
  await page.waitForTimeout(6500); await expect(provider.locator('[data-message-author-role=user]')).toHaveCount(2); await expect(page.locator('.mw-formula-row')).toHaveCount(0);
  await returnTo(page); await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/); expect(providers(context)).toHaveLength(1);
  await input.fill('升级后再次发送'); await input.press('Enter'); await expect(page.locator('.math-ai-message.is-assistant').last()).toContainText('离线完成');
  await provider.close(); await installed.management.bringToFront(); await returnTo(page); await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-disconnected/);
  const reconnect = await openSetup(page); const reopened = context.waitForEvent('page'); await reconnect.getByRole('button', { name: '重新连接', exact: true }).click(); const nextProvider = await reopened; await nextProvider.goto('https://chat.deepseek.com/');
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/); expect(providers(context)).toHaveLength(1);
  await page.getByRole('button', { name: '简体中文', exact: true }).click(); await page.getByRole('menuitemradio', { name: /English/ }).click();
  await page.getByLabel('Ask Math Assistant', { exact: true }).fill('slow English update');
  await page.getByLabel('Ask Math Assistant', { exact: true }).press('Enter');
  await expect(providers(context)[0].locator('[data-message-author-role=user]')).toHaveCount(1);
  manifest.version = '0.2.2'; await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await installed.management.evaluate(id => new Promise((resolve, reject) => chrome.developerPrivate.reload(id, { failQuietly: true }, () => chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve())), installed.id);
  await expect(page.locator('.math-ai-error')).toBeVisible();
  await fs.writeFile(info.outputPath('english-update-observation.json'), JSON.stringify({ error: await page.locator('.math-ai-error').innerText() }, null, 2));
  await screenshot(page, info, 'updated-reconnected.png');
  await expect(page.locator('.math-ai-error')).toContainText(/updated/i);
});

test('旧0.1兼容与活跃请求升级后无需焦点事件即可显示需要重新连接', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'chrome', 'Legacy snapshot checked in real Chrome; Edge current upgrade is covered separately');
  const installed = await install(context, info, true); await page.reload();
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-available/);
  const popover = await openSetup(page); await expect(popover).not.toContainText('更新扩展');
  const opened = context.waitForEvent('page'); await popover.getByRole('button', { name: '连接助理', exact: true }).click();
  const provider = await opened; await provider.goto('https://chat.deepseek.com/');
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  const input = page.getByLabel('向数学助理提问', { exact: true }); await input.fill('slow 旧版发送期间升级'); await input.press('Enter');
  await expect(provider.locator('[data-message-author-role=user]')).toHaveCount(1); await input.fill('升级前保留草稿');
  await fs.cp(extensionRoot, installed.extension, { recursive: true });
  await installed.management.evaluate(id => new Promise((resolve, reject) => chrome.developerPrivate.reload(id, { failQuietly: true }, () => chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve())), installed.id);
  await expect(page.locator('.math-ai-error')).toContainText('扩展已更新'); await expect(input).toHaveValue('升级前保留草稿');
  await fs.writeFile(info.outputPath('legacy-upgrade-observation.json'), JSON.stringify({ connection: await page.locator('.math-ai-provider .math-ai-connection').getAttribute('class'), error: await page.locator('.math-ai-error').innerText(), providerCount: providers(context).length }, null, 2));
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-available/, { timeout: 5000 });
});

test('商店配置按实际浏览器分流，安装后的界面承诺与实际下一步一致', async ({ page, context }, info) => {
  const popover = await openSetup(page);
  if (info.project.name === 'unsupported-chromium') {
    await expect(popover).toContainText('仅支持 Chrome 与 Edge 桌面浏览器'); await expect(popover.locator('a')).toHaveCount(0); return;
  }
  const link = popover.getByRole('link', { name: '前往商店', exact: true });
  await expect(link).toHaveAttribute('href', info.project.name === 'edge' ? 'https://microsoftedge.microsoft.com/addons/detail/teachbuddy-local-test/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' : 'https://chromewebstore.google.com/detail/teachbuddy-local-test/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  await expect(popover.locator('a')).toHaveCount(1);
  await expect(popover).toContainText('安装后切回此页，点击连接。');
  await expect(popover).not.toContainText('自动连接');
  await screenshot(page, info, 'configured-store-entry.png');
  await install(context, info); await returnTo(page);
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-available/);
  expect(providers(context)).toHaveLength(0);
  const installedSetup = await openSetup(page);
  const opened = context.waitForEvent('page');
  await installedSetup.getByRole('button', { name: '连接助理', exact: true }).click();
  const provider = await opened; await provider.goto('https://chat.deepseek.com/');
  await expect(page.locator('.math-ai-provider .math-ai-connection')).toHaveClass(/is-ready/);
  expect(providers(context)).toHaveLength(1);
});
