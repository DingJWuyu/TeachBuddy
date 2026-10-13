import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { startRealMath } from './fixtures/math-static/real.mjs';
const evidence = path.resolve(process.env.M41_EVIDENCE_DIR || 'test-results/m41/real-output');
const works = '/api/modules/math/v1/works';
const rootFormula = String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`;
const piecewise = String.raw`f(x)=\begin{cases}-x^2 & x<0\\ x-1 & x\ge0\end{cases}`;
async function register(page, world, email) {
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await page.getByLabel('昵称', { exact: true }).fill('数学教师');
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByLabel('确认密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect.poll(() => world.mailer.lastCode('registration', email)).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', email));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByText('数学工坊', { exact: true })).toBeVisible();
}
async function login(page, email) {
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('数学工坊', { exact: true })).toBeVisible();
}
async function save(page) {
  const response = page.waitForResponse(r => r.url().includes(works) && ['PUT', 'POST'].includes(r.request().method()));
  await page.getByRole('button', { name: /^(保存|确认保存结果)$/ }).click();
  const result = await response;
  expect(result.ok()).toBe(true);
  await expect(page.getByRole('status')).toHaveText('已保存');
  return result.json();
}
async function download(page, format, name) {
  await page.getByLabel('导出格式').selectOption(format);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载', exact: true }).click();
  const file = await event;
  const target = path.join(evidence, `${name}.${format === 'source' ? 'json' : format}`);
  await file.saveAs(target);
  return target;
}
test.beforeAll(async () => { fs.mkdirSync(evidence, { recursive: true }); });

test('real teacher creates, restarts, edits formulas, invalidates and repairs cases, downloads offline outputs', async ({ page, browser }) => {
  let world = await startRealMath();
  const directory = world.directory;
  let passed = false;
  const requests = [], remote = [];
  page.on('request', r => {
    const url = new URL(r.url());
    if (url.pathname.startsWith('/api/modules/math') || url.pathname.startsWith('/api/workbench/files'))
      requests.push({ method: r.method(), path: url.pathname, page: Boolean(r.headers()['x-teachbuddy-page']) });
    if (/^https?:/.test(url.protocol) && url.hostname !== '127.0.0.1') remote.push(r.url());
  });
  try {
    await page.goto(world.origin);
    await register(page, world, 'math-browser@example.test');
    await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
    await page.getByLabel('作品名称').fill('求根公式与判别式');
    await page.getByLabel('LaTeX', { exact: true }).fill(rootFormula);
    await page.getByLabel('中文说明').fill('判别式决定实数根的个数');
    await expect(page.getByRole('img', { name: '当前公式预览' })).toBeVisible();
    const first = await save(page);
    expect(first.render.state).toBe('ready');
    await world.close(); world = await startRealMath({ directory });
    await page.goto(world.origin);
    await expect(page.getByRole('button', { name: /求根公式与判别式 v1/ })).toBeVisible();
    await page.getByRole('button', { name: /求根公式与判别式 v1/ }).click();
    await expect(page.getByLabel('LaTeX', { exact: true })).toHaveValue(rootFormula);
    await page.getByLabel('中文说明').fill('判别式大于零时有两个不相等的实数根');
    await page.getByLabel('颜色', { exact: true }).fill('#2855a6');
    await page.getByLabel('字号', { exact: true }).fill('40');
    const second = await save(page); expect(second.version).toBe(2);
    const png = await download(page, 'png', 'root-browser');
    const svg = await download(page, 'svg', 'root-browser');
    await download(page, 'source', 'root-browser');
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(1600);
    expect(data.some((v, i) => i % 4 === 3 && v === 0)).toBe(true);
    expect(data.some((v, i) => i % 4 === 3 && v === 255)).toBe(true);
    await page.screenshot({ path: path.join(evidence, 'formula-desktop.png') });
    for (const [width, height] of [[1024, 768], [390, 844]]) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(evidence, `formula-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
    await page.getByLabel('作品名称').fill('两行分段式');
    await page.getByLabel('LaTeX', { exact: true }).fill(piecewise);
    await page.getByLabel('中文说明').fill('当参数 a 等于负一');
    const cases = await save(page); expect(cases.render.state).toBe('ready');
    await page.getByLabel('LaTeX', { exact: true }).fill(String.raw`\frac{1`);
    const invalid = await save(page);
    expect(invalid.render.state).toBe('invalid'); expect(invalid.render.posterFileId).toBeNull();
    await expect(page.getByText(/源码已保存，渲染失败/)).toBeVisible();
    const denied = page.waitForResponse(r => r.url().endsWith('/exports'));
    await page.getByLabel('导出格式').selectOption('png');
    await page.getByRole('button', { name: '下载', exact: true }).click();
    expect((await denied).status()).toBe(422);
    const source = await download(page, 'source', 'invalid-browser');
    expect(JSON.parse(fs.readFileSync(source)).latex).toBe(String.raw`\frac{1`);
    await page.getByLabel('LaTeX', { exact: true }).fill(piecewise);
    const repaired = await save(page); expect(repaired.version).toBe(3);
    await page.reload();
    await expect(page.getByLabel('LaTeX', { exact: true })).toHaveValue(piecewise);
    const casesSvg = await download(page, 'svg', 'cases-browser');
    await download(page, 'png', 'cases-browser');
    await page.screenshot({ path: path.join(evidence, 'cases-desktop.png') });
    // Standalone images must render in a cold browser with no server or network.
    await world.close(); world = null;
    const offline = await browser.newContext({ offline: true });
    const viewer = await offline.newPage();
    await viewer.setViewportSize({ width: 1800, height: 1200 });
    for (const [file, name] of [[svg, 'root-offline'], [casesSvg, 'cases-offline']]) {
      await viewer.goto(pathToFileURL(file).href);
      await viewer.evaluate(() => document.fonts.ready);
      expect(await viewer.locator('svg path').count()).toBeGreaterThan(10);
      await viewer.screenshot({ path: path.join(evidence, `${name}.png`) });
    }
    await offline.close();
    expect(remote).toEqual([]); expect(requests.every(r => r.page)).toBe(true);
    fs.writeFileSync(path.join(evidence, 'real-browser.json'), JSON.stringify({ requests, remote, first: first.version, second: second.version, invalid: invalid.render, repaired: repaired.version, offline: true }, null, 2));
    passed = true;
  } finally { if (world) await world.close(); if (passed) fs.rmSync(directory, { recursive: true, force: true }); }
});

test('real identity expiry locks drafts; same account recovers; late export cannot download into another account', async ({ page }) => {
  const world = await startRealMath();
  let passed = false, release = () => {};
  try {
    await page.goto(world.origin); await register(page, world, 'math-race@example.test');
    await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
    await page.getByLabel('作品名称').fill('账户 A 的公式');
    await page.getByLabel('LaTeX', { exact: true }).fill(rootFormula);
    await save(page);
    await page.getByLabel('中文说明').fill('账户 A 未保存说明');
    world.clock.advance(8 * 86400000);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
    await expect(page.getByLabel('LaTeX', { exact: true })).toHaveCount(0);
    await login(page, 'math-race@example.test');
    await expect(page.getByLabel('中文说明')).toHaveValue('账户 A 未保存说明');
    await save(page);
    let reached;
    const gate = new Promise(resolve => { release = resolve; });
    const arrived = new Promise(resolve => { reached = resolve; });
    await page.route('**/api/workbench/files/*/content', async route => {
      const response = await route.fetch(); reached(); await gate;
      await route.fulfill({ response }).catch(() => {});
    });
    let downloads = 0; page.on('download', () => downloads++);
    await page.getByRole('button', { name: '下载', exact: true }).click();
    await arrived;
    world.clock.advance(8 * 86400000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
    await register(page, world, 'math-new-account@example.test');
    release();
    await expect(page.getByRole('heading', { name: '制作数学作品', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /账户 A 的公式/ })).toHaveCount(0);
    expect(downloads).toBe(0);
    await page.screenshot({ path: path.join(evidence, 'account-switch.png') });
    world.clock.advance(8 * 86400000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
    await login(page, 'math-race@example.test');
    await expect(page.getByLabel('中文说明')).toHaveValue('账户 A 未保存说明');
    await page.unroute('**/api/workbench/files/*/content');
    await expect(page.getByRole('button', { name: '确认导出结果', exact: true })).toBeVisible();
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: '确认导出结果', exact: true }).click(); await event;
    fs.writeFileSync(path.join(evidence, 'identity-browser.json'), JSON.stringify({ expiredLocks: true, sameAccountDraft: true, otherAccountIsolated: true, staleDownloads: 0, pendingExportConfirmed: true }, null, 2));
    passed = true;
  } finally { release(); await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {}); await world.close(); if (passed) fs.rmSync(world.directory, { recursive: true, force: true }); }
});

for (const mode of ['login', 'register']) {
  test(`last session logout then same-document ${mode} can use math`, async ({ page }) => {
    const world = await startRealMath();
    const network = [];
    let passed = false;
    page.on('response', response => {
      const request = response.request(), pathname = new URL(response.url()).pathname;
      if (pathname.startsWith('/api/auth/')) network.push({
        method: request.method(), path: pathname, status: response.status(),
        action: pathname.endsWith('/session') ? request.postDataJSON()?.action ?? null : null,
      });
    });
    try {
      await page.goto(world.origin);
      await register(page, world, 'logout-owner@example.test');
      await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
      await page.getByLabel('作品名称').fill('退出前的账户作品');
      await page.getByLabel('LaTeX', { exact: true }).fill('x^2');
      await save(page);
      const documentId = await page.evaluate(() => window.mathDocumentId = crypto.randomUUID());
      network.length = 0;
      await page.getByRole('button', { name: '退出登录', exact: true }).click();
      await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
      await expect(page.getByLabel('LaTeX', { exact: true })).toHaveCount(0);
      if (mode === 'login') await login(page, 'logout-owner@example.test');
      else await register(page, world, 'logout-new@example.test');
      expect(await page.evaluate(() => window.mathDocumentId)).toBe(documentId);
      if (mode === 'login') {
        await expect(page.getByRole('button', { name: /退出前的账户作品 v1/ })).toBeVisible();
      } else {
        await expect(page.getByRole('button', { name: /退出前的账户作品/ })).toHaveCount(0);
      }
      await page.getByRole('button', { name: '新建公式', exact: true }).first().click();
      await page.getByLabel('作品名称').fill('同页重新认证后保存');
      await page.getByLabel('LaTeX', { exact: true }).fill('y=x+1');
      expect((await save(page)).version).toBe(1);
      const logoutIndex = network.findIndex(row => row.path.endsWith('/logout') && row.status === 204);
      const bootstrapIndex = network.findIndex((row, i) => i > logoutIndex && row.action === 'bootstrap' && row.status === 200);
      const confirmIndex = network.findIndex((row, i) => i > bootstrapIndex && row.path.endsWith('/session') && row.method === 'GET' && row.status === 200);
      const entryIndex = network.findIndex(row => row.path.endsWith(`/${mode}`));
      expect(logoutIndex).toBeGreaterThanOrEqual(0);
      expect(bootstrapIndex).toBeGreaterThan(logoutIndex);
      expect(confirmIndex).toBeGreaterThan(bootstrapIndex);
      expect(entryIndex).toBeGreaterThan(confirmIndex);
      expect(network.some(row => row.action === 'restore')).toBe(false);
      passed = true;
    } finally {
      await page.screenshot({ path: path.join(evidence, `same-document-${mode}.png`) });
      fs.writeFileSync(path.join(evidence, `same-document-${mode}.json`), JSON.stringify({ passed, network }, null, 2));
      await world.close();
      if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
    }
  });
}

for (const method of ['POST', 'GET']) {
  test(`post-logout preparation ${method} failure keeps entry closed and retries`, async ({ page }) => {
    const world = await startRealMath();
    let passed = false, blocked = 0;
    try {
      await page.goto(world.origin);
      await register(page, world, 'retry@example.test');
      const marker = await page.evaluate(() => window.mathDocumentId = crypto.randomUUID());
      await page.route('**/api/auth/session', route => {
        if (route.request().method() === method) { blocked++; return route.abort('failed'); }
        return route.continue();
      });
      await page.getByRole('button', { name: '退出登录', exact: true }).click();
      await expect(page.getByRole('heading', { name: '暂时无法准备登录', exact: true })).toBeVisible();
      expect(blocked).toBe(1);
      await expect(page.getByRole('button', { name: '登录', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '创建账户', exact: true })).toHaveCount(0);
      await expect(page.getByText('数学工坊', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: path.join(evidence, `prepare-${method}-failed.png`) });
      await page.unroute('**/api/auth/session');
      await page.getByRole('button', { name: '重试', exact: true }).click();
      await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
      await login(page, 'retry@example.test');
      expect(await page.evaluate(() => window.mathDocumentId)).toBe(marker);
      fs.writeFileSync(path.join(evidence, `prepare-${method}.json`), JSON.stringify({ blocked, entryClosed: true, sameDocument: true, retryLogin: true }, null, 2));
      passed = true;
    } finally {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await world.close();
      if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
    }
  });
}

test('post-logout preparation does not restore another remembered account', async ({ page, context }) => {
  const world = await startRealMath();
  const other = await context.newPage();
  let passed = false;
  const actions = [];
  try {
    await page.goto(world.origin);
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
    await other.goto(world.origin);
    await expect(other.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
    await register(page, world, 'page-a@example.test');
    await register(other, world, 'page-b@example.test');
    await other.getByRole('button', { name: '新建公式', exact: true }).first().click();
    await other.getByLabel('作品名称').fill('账户 B 的独立作品');
    await other.getByLabel('LaTeX', { exact: true }).fill('b=2');
    await save(other);
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/auth/session' && request.method() === 'POST') actions.push(request.postDataJSON().action);
    });
    const marker = await page.evaluate(() => window.mathDocumentId = crypto.randomUUID());
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
    await expect(other.getByLabel('LaTeX', { exact: true })).toHaveValue('b=2');
    await other.getByLabel('中文说明').fill('A 退出后 B 继续保存');
    expect((await save(other)).version).toBe(2);
    await login(page, 'page-a@example.test');
    await expect(page.getByRole('button', { name: /账户 B 的独立作品/ })).toHaveCount(0);
    expect(await page.evaluate(() => window.mathDocumentId)).toBe(marker);
    expect(actions).toEqual(['bootstrap', 'activate']);
    fs.writeFileSync(path.join(evidence, 'remembered-account.json'), JSON.stringify({ actions, sameDocument: true, otherAccountContinues: true, isolated: true }, null, 2));
    passed = true;
  } finally {
    await other.close();
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
