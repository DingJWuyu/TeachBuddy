import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';

const evidence = path.resolve(process.env.A11_EVIDENCE_DIR || 'test-results/a11/evidence');
let world;
test.beforeEach(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  world = await createIntegration();
});
test.afterEach(async ({}, info) => {
  await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true });
  else console.log('保留测试现场：' + world.directory);
});

async function register(page, email = 'browser@example.test', nickname = '林老师') {
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill(nickname);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('password-a11');
  await page.getByLabel('确认密码', { exact: true }).fill('password-a11');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect.poll(() => world.mailer.lastCode('registration', email)).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', email));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
}
async function login(page, remember = true, email = 'browser@example.test') {
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('password-a11');
  await page.getByRole('checkbox').setChecked(remember);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
}
async function settings(page) { await page.getByRole('link', { name: /^账户：/ }).click(); }

test('真实注册、Cookie、账号行、remembered 刷新、退出和 page 登录刷新', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().includes('/api/')) requests.push({ path: new URL(request.url()).pathname, method: request.method(), page: request.headers()['x-teachbuddy-page'] }); });
  await register(page);
  const cookie = (await page.context().cookies()).find(item => item.name === '__Host-teachbuddy_session');
  expect(cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax', path: '/' });
  await expect(page.locator('.tb-account-row')).toHaveAccessibleName('账户：林老师');
  await settings(page);
  await expect(page.locator('[data-field="account-key"]')).toHaveText('林老师');
  await page.screenshot({ path: path.join(evidence, 'desktop-settings.png') });
  const firstPage = requests.find(item => item.path === '/api/workbench/context').page;
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible();
  expect(requests.filter(item => item.path === '/api/workbench/context').at(-1).page).not.toBe(firstPage);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await page.reload();
  await login(page, false);
  await page.reload();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  expect(requests.every(item => /^[a-f0-9]{32}$/.test(item.page))).toBe(true);
  fs.writeFileSync(path.join(evidence, 'browser-requests.json'), JSON.stringify(requests, null, 2));
});

test('设置退出已知失败、结果未知和同目标重试', async ({ page }) => {
  await register(page);
  await settings(page);
  world.workbench.db.exec("CREATE TRIGGER a11_logout_failure BEFORE UPDATE ON auth_sessions BEGIN SELECT RAISE(ABORT, 'isolated logout failure'); END");
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('退出失败');
  world.workbench.db.exec('DROP TRIGGER a11_logout_failure');
  let target;
  await page.route('**/api/auth/logout', async route => {
    target = route.request().postDataJSON().sessionId;
    await route.fetch();
    await route.abort();
  });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  await page.screenshot({ path: path.join(evidence, 'logout-unconfirmed.png') });
  await page.unroute('**/api/auth/logout');
  const retry = page.waitForRequest('**/api/auth/logout');
  await page.getByRole('button', { name: '重试确认退出' }).click();
  expect((await retry).postDataJSON().sessionId).toBe(target);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
});

for (const [name, viewport] of [['tablet', { width: 820, height: 1180 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`${name} 真实登录长昵称无横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await register(page, `${name}@example.test`, '高中数学教师'.repeat(6));
    // The desktop sidebar toggle appears when the pointer enters the top bar.
    await page.getByRole('banner').hover();
    await page.getByRole('button', { name: /^(打开工作台导航|展开侧栏)$/ }).click();
    await expect(page.getByRole('link', { name: '账户：' + '高中数学教师'.repeat(6), exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.tb-account-name').first().evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(30);
    await expect(page.locator('.tb-account-row')).toHaveAttribute('aria-label', '账户：' + '高中数学教师'.repeat(6));
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    await page.screenshot({ path: path.join(evidence, `${name}-account.png`), animations: 'disabled' });
  });
}

const field = (page, label) => page.locator(`input[aria-label="${label}"], textarea[aria-label="${label}"]`);
async function newQuestion(page, title) {
  await page.goto(`${world.origin}/questions`);
  await page.locator('.q-finder').getByRole('button', { name: '手动录题', exact: true }).click();
  await field(page, '题目标题').fill(title);
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('已知 f(x)=x²-2x，求最小值。');
}
async function saveQuestion(page) {
  const saved = page.waitForResponse(response => /\/questions\/v2\/items(?:\/[a-f0-9-]{36}(?:\/copies)?)?$/.test(new URL(response.url()).pathname) && ['POST', 'PUT'].includes(response.request().method()));
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  const item = await (await saved).json();
  await expect(page.locator('.q-message')).toContainText('已保存');
  return item.id;
}

test('真实业务保存、响应丢失幂等重试、刷新、草稿账户分区与迟到结果', async ({ page }) => {
  await register(page);
  await newQuestion(page, '真实 Cookie 题目');
  let committed;
  await page.route('**/api/modules/questions/v2/items', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    committed = { key: route.request().headers()['idempotency-key'], body: route.request().postData() };
    await route.fetch();
    await route.abort();
  });
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认上次请求' })).toBeVisible();
  await page.unroute('**/api/modules/questions/v2/items');
  const retry = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/questions/v2/items'));
  await page.getByRole('button', { name: '确认上次请求' }).click();
  const repeated = await retry;
  expect(repeated.headers()['idempotency-key']).toBe(committed.key);
  expect(repeated.postData()).toBe(committed.body);
  await expect(page.locator('.q-message')).toContainText('题目已保存');
  const saved = await (await page.request.get(world.origin + '/api/modules/questions/v2/items', { headers: { 'X-TeachBuddy-Page': repeated.headers()['x-teachbuddy-page'] } })).json();
  const matches = saved.items.filter(item => item.title === '真实 Cookie 题目');
  expect(matches).toHaveLength(1);
  const id = matches[0].id;
  await page.goto(`${world.origin}/questions/${id}`);
  await page.reload();
  await expect(page.getByRole('heading', { name: '真实 Cookie 题目', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: '题干', exact: true })).toContainText('已知 f(x)=x²-2x，求最小值。');
  await newQuestion(page, 'A 的未上传草稿');
  await settings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await register(page, 'second@example.test', '第二位教师');
  await page.goto(`${world.origin}/questions`);
  await expect(field(page, '题目标题')).toHaveCount(0);
  await page.locator('.q-finder').getByRole('button', { name: '手动录题', exact: true }).click();
  await expect(field(page, '题目标题')).toHaveValue('');
  await settings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await login(page);
  await page.goto(`${world.origin}/questions`);
  await expect(field(page, '题目标题')).toHaveValue('A 的未上传草稿');
  let release;
  let delivered;
  const completed = new Promise(resolve => { delivered = resolve; });
  let received;
  const arrived = new Promise(resolve => { received = resolve; });
  await page.route(`**/api/modules/questions/v2/items/${id}`, async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    received();
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ response }).catch(() => {});
    delivered();
  });
  await page.goto(`${world.origin}/questions/${id}`);
  await arrived;
  await settings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await login(page, true, 'second@example.test');
  release();
  await completed;
  await expect(page.locator('.tb-account-row')).toContainText('第二位教师');
  await expect(page.locator('.wb-shell')).not.toContainText('真实 Cookie 题目');
  await page.screenshot({ path: path.join(evidence, 'account-isolation.png') });
});

test('工作台题库操作从实际界面经认证 transport 发送页面头', async ({ page }) => {
  const seen = new Map();
  page.on('request', request => {
    const endpoint = new URL(request.url()).pathname;
    if (!endpoint.startsWith('/api/modules') && endpoint !== '/api/workbench/context') return;
    const normalized = endpoint.replace(/[a-f0-9]{8}-[a-f0-9-]{27}/g, ':id');
    const headers = request.headers();
    seen.set(`${request.method()} ${normalized}`, { page: headers['x-teachbuddy-page'], key: headers['idempotency-key'], protection: headers['x-teachbuddy-request'] });
  });
  await register(page);
  await newQuestion(page, '认证操作原题');
  const id = await saveQuestion(page);
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await field(page, '题目标题').fill('认证操作更新');
  expect(await saveQuestion(page)).toBe(id);
  const copied = page.waitForResponse(response => response.url().endsWith(`/questions/v2/items/${id}/copies`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存题目', exact: true })).toBeEnabled();
  await expect(field(page, '题目标题')).toHaveValue('认证操作更新');
  await field(page, '题目标题').fill('认证操作变式');
  const copyId = await saveQuestion(page);
  expect((await copied).status()).toBe(201);
  expect(copyId).not.toBe(id);
  await page.goto(`${world.origin}/questions/${id}`);
  await page.getByRole('button', { name: '更多题目操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档题目', exact: true }).click();
  await page.getByRole('button', { name: '确认归档', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`${world.origin}/questions/${id}`);
  await expect(page.getByRole('button', { name: '恢复题目', exact: true })).toBeVisible();
  const expected = [
    'GET /api/workbench/context', 'GET /api/modules',
    'GET /api/modules/questions/v2/items', 'POST /api/modules/questions/v2/items',
    'GET /api/modules/questions/v2/items/:id', 'PUT /api/modules/questions/v2/items/:id',
    'GET /api/modules/questions/v2/items/:id/copies', 'POST /api/modules/questions/v2/items/:id/copies',
    'POST /api/modules/questions/v2/items/:id/deletion',
  ];
  for (const operation of expected) {
    expect(seen.has(operation), operation).toBe(true);
    expect(seen.get(operation).page).toMatch(/^[a-f0-9]{32}$/);
    if (!operation.startsWith('GET ')) {
      expect(seen.get(operation).key).toMatch(/^[a-f0-9-]{36}$/);
      expect(seen.get(operation).protection).toBe('1');
    }
  }
  fs.writeFileSync(path.join(evidence, 'browser-15-operations.json'), JSON.stringify(Object.fromEntries(seen), null, 2));
});

test('退出响应丢失后 I06 确认失效，同页仍可重新登录', async ({ page }) => {
  await register(page);
  await settings(page);
  await page.route('**/api/auth/logout', async route => { await route.fetch(); await route.abort(); });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('退出结果暂未确认');
  await page.unroute('**/api/auth/logout');
  // Exercise the browser-focus recheck hook; all I06 traffic is real HTTPS.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await login(page);
  await expect(page.locator('.tb-account-row')).toContainText('林老师');
});

test('同浏览器双账户：A 定向退出停在登录，B 的 remembered 会话仍有效', async ({ page, context }) => {
  await register(page);
  await settings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await login(page, false);
  const otherPage = await context.newPage();
  await register(otherPage, 'other-tab@example.test', '另一页教师');
  await settings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await expect(page.locator('.wb-shell')).toHaveCount(0);
  await expect(otherPage.locator('.tb-account-row')).toContainText('另一页教师');
  await otherPage.reload();
  await expect(otherPage.locator('.tb-account-row')).toContainText('另一页教师');
  await login(page);
  await expect(page.locator('.tb-account-row')).toContainText('林老师');
});

test('共享 remembered 双页退出：迟到清理不得破坏登录准备（A12-LOCAL-001）', async ({ page, context }) => {
  await register(page);
  const second = await context.newPage();
  await second.goto(world.origin);
  await expect(second.locator('.wb-shell')).toBeVisible();
  // Hold only the peer's redundant cleanup response until the signing-out
  // page has received its real bootstrap response. No response is fabricated.
  let bootstrapped;
  const bootstrapReceived = new Promise(resolve => { bootstrapped = resolve; });
  let cleanup;
  await page.route('**/api/auth/logout', route => {
    cleanup = (async () => {
      const response = await route.fetch();
      await bootstrapReceived;
      await route.fulfill({ response });
    })();
    return cleanup;
  });
  second.on('response', response => {
    const request = response.request();
    if (request.url().endsWith('/api/auth/session') && request.method() === 'POST'
      && request.postDataJSON().action === 'bootstrap') bootstrapped();
  });
  await second.route('**/api/auth/session', async route => {
    if (route.request().method() === 'GET' && cleanup) await cleanup;
    await route.continue();
  });
  await settings(second);
  const revoked = second.waitForResponse(response => response.url().endsWith('/api/auth/logout') && response.status() === 204);
  await second.getByRole('button', { name: '退出登录', exact: true }).click();
  await revoked;
  await expect(second.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await second.screenshot({ path: path.join(evidence, 'shared-session-logout.png') });
  await login(second);
  await expect(page.locator('.wb-shell')).toHaveCount(0);
});

test('恢复失败卡三视口间距及真实恢复重试（A12-LOCAL-002）', async ({ page }) => {
  await register(page);
  world.workbench.db.exec("CREATE TRIGGER a11_restore_failure BEFORE INSERT ON auth_page_bindings BEGIN SELECT RAISE(ABORT, 'isolated restore failure'); END");
  await page.reload();
  await expect(page.getByRole('heading', { name: '恢复失败', exact: true })).toBeVisible();
  const layouts = [];
  for (const [name, width, height] of [['desktop', 1440, 900], ['pad', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.locator('.ae-restore-message').evaluate(message => {
      const rect = message.getBoundingClientRect();
      const header = document.querySelector('.ae-card-head').getBoundingClientRect();
      const button = document.querySelector('.ae-restore-actions button').getBoundingClientRect();
      return { width: innerWidth, headerGap: rect.top - header.bottom, buttonGap: button.top - rect.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    layouts.push(layout);
    await page.screenshot({ path: path.join(evidence, `${name}-restore.png`), animations: 'disabled' });
    fs.writeFileSync(path.join(evidence, 'restore-layout.json'), JSON.stringify(layouts, null, 2));
    expect(layout).toEqual({ width, headerGap: 16, buttonGap: 18, overflow: false });
  }
  world.workbench.db.exec('DROP TRIGGER a11_restore_failure');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.tb-account-row')).toContainText('林老师');
});
