/*
 * Transport and protected-request seam: the fifteen workbench operations, the
 * page header, source/protection rejection, cross-origin attempts and the
 * logout exchange.
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  armFault,
  ensureForeignOrigin,
  ensureSubstitute,
  readState,
  requestsFor,
  resetState,
  seedAccount,
} from './fixtures/auth-contract/fixture-control.mjs';
import { WORKBENCH_OPERATIONS } from './fixtures/auth-contract/workbench-operations.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const PORT = 49182;
const FOREIGN_PORT = 48183;
const BASE = `http://127.0.0.1:${PORT}`;
const TEACHER = { email: 'teacher@example.com', nickname: '林老师', password: ' TeAcH😀9' };

let substitute;
let foreign;

test.beforeAll(async () => {
  substitute = await ensureSubstitute({ port: PORT });
  foreign = await ensureForeignOrigin({ port: FOREIGN_PORT, target: BASE });
});

test.afterAll(async () => {
  await foreign?.stop();
  await substitute?.stop();
});

test.beforeEach(async () => {
  await resetState(PORT);
});

/*
 * Direct HTTP calls do not inherit the browser cookie jar or an Origin header,
 * so the seam checks add both explicitly; leaving one out is the test input.
 */
async function apiHeaders(page, extra = {}) {
  const cookies = await page.context().cookies();
  const cookie = cookies.map((entry) => `${entry.name}=${entry.value}`).join('; ');
  return {
    Origin: BASE,
    ...(cookie ? { Cookie: cookie } : {}),
    ...extra,
  };
}

async function signIn(page, query = '') {
  await seedAccount(PORT, TEACHER);
  await page.goto(`${BASE}/${query}`);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
}

test('15 个受保护操作都携带当前页面头并保留 body 与 Idempotency-Key（C19）', async ({ page }) => {
  await signIn(page);
  await page.locator('[data-harness-run-all]').click();
  await expect
    .poll(async () => (await page.locator('[data-harness-results]').textContent()).split('\n').filter(Boolean).length, {
      timeout: 15_000,
    })
    .toBe(15);
  const results = (await page.locator('[data-harness-results]').textContent()).split('\n');
  expect(results).toEqual(WORKBENCH_OPERATIONS.map((operation) => `${operation.id}:${operation.status}`));

  const workbenchRequests = (await requestsFor(PORT, {}))
    .filter((request) => request.path.startsWith('/api/workbench') || request.path.startsWith('/api/modules'));
  expect(workbenchRequests).toHaveLength(15);

  const pageIds = new Set(workbenchRequests.map((request) => request.page));
  expect(pageIds.size).toBe(1);
  const [pageId] = [...pageIds];
  expect(pageId).toMatch(/^[0-9a-f]{32}$/);

  for (const request of workbenchRequests) {
    if (request.method === 'GET') {
      expect(request.protection).toBeNull();
    } else {
      expect(request.protection).toBe('1');
      expect(request.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    }
  }
  const created = workbenchRequests.find((request) => request.path === '/api/modules/questions/items' && request.method === 'POST');
  expect(created.body).toEqual({ title: '契约替身题目', prompt: '题面', answer: '答案' });

  const accountKey = await page.locator('[data-harness-account-key]').textContent();
  const contextResponse = await page.context().request.get(`${BASE}/api/workbench/context`, {
    headers: await apiHeaders(page, { 'X-TeachBuddy-Page': pageId }),
  });
  expect(contextResponse.status()).toBe(200);
  expect((await contextResponse.json()).accountKey).toBe(accountKey);
});

test('页面头缺失或未绑定页面时受保护操作 401（C20）', async ({ page }) => {
  await signIn(page);
  const state = await readState(PORT);
  const boundPage = Object.keys(state.containers[0].pages)[0];

  const missing = await page.context().request.get(`${BASE}/api/workbench/context`, {
    headers: await apiHeaders(page),
  });
  expect(missing.status()).toBe(401);
  expect((await missing.json()).type).toBe('/problems/workbench/unauthenticated');

  const unbound = await page.context().request.get(`${BASE}/api/workbench/context`, {
    headers: await apiHeaders(page, { 'X-TeachBuddy-Page': 'fedcba9876543210fedcba9876543210' }),
  });
  expect(unbound.status()).toBe(401);

  const bound = await page.context().request.get(`${BASE}/api/workbench/context`, {
    headers: await apiHeaders(page, { 'X-TeachBuddy-Page': boundPage }),
  });
  expect(bound.status()).toBe(200);
});

test('认证操作缺失或形状非法的页面头返回 409（P06 / C20）', async ({ page }) => {
  await signIn(page);
  const body = { email: TEACHER.email };
  const cases = [
    { method: 'get', path: '/api/auth/session', data: undefined },
    { method: 'post', path: '/api/auth/registration-codes', data: body },
    { method: 'post', path: '/api/auth/password-reset-codes', data: body },
    { method: 'post', path: '/api/auth/password-reset', data: { verificationCode: '000000', password: 'password-8', challengeId: 'chal-x', email: TEACHER.email } },
    { method: 'post', path: '/api/auth/session', data: { action: 'activate', sessionId: 'sess-x', rememberMe: false } },
    { method: 'post', path: '/api/auth/logout', data: { sessionId: null } },
  ];
  for (const header of [undefined, 'a'.repeat(31), 'z'.repeat(32)]) {
    for (const entry of cases) {
      const headers = await apiHeaders(page, {
        'Content-Type': 'application/json',
        'X-TeachBuddy-Request': '1',
        ...(header === undefined ? {} : { 'X-TeachBuddy-Page': header }),
      });
      const response = entry.method === 'get'
        ? await page.context().request.get(`${BASE}${entry.path}`, { headers })
        : await page.context().request.post(`${BASE}${entry.path}`, { headers, data: JSON.stringify(entry.data) });
      expect(response.status()).toBe(409);
      expect((await response.json()).type).toBe('/problems/auth/browser-context-required');
    }
  }
});

test('认证响应 no-store、204 无响应体（P05）', async ({ page }) => {
  await signIn(page);
  const session = await page.context().request.get(`${BASE}/api/auth/session`, {
    headers: await apiHeaders(page, { 'X-TeachBuddy-Page': '0123456789abcdef0123456789abcdef' }),
  });
  expect(session.status()).toBe(200);
  expect(session.headers()['cache-control']).toBe('no-store');

  const rejected = await page.context().request.post(`${BASE}/api/auth/login`, {
    headers: {
      Origin: 'http://127.0.0.1:48183',
      'Content-Type': 'application/json',
      'X-TeachBuddy-Request': '1',
      'X-TeachBuddy-Page': '0123456789abcdef0123456789abcdef',
    },
    data: JSON.stringify({ email: TEACHER.email, password: TEACHER.password, rememberMe: true }),
  });
  expect(rejected.status()).toBe(403);
  expect(rejected.headers()['cache-control']).toBe('no-store');

  const sessionId = (await readState(PORT)).sessions[0].id;
  const logout = await page.context().request.post(`${BASE}/api/auth/logout`, {
    headers: await apiHeaders(page, {
      'X-TeachBuddy-Page': '0123456789abcdef0123456789abcdef',
      'X-TeachBuddy-Request': '1',
      'Content-Type': 'application/json',
    }),
    data: JSON.stringify({ sessionId }),
  });
  expect(logout.status()).toBe(204);
  expect(await logout.text()).toBe('');
  expect(logout.headers()['cache-control']).toBe('no-store');
});

test('写请求缺来源或保护头先于身份被拒，GET 不要求（C20）', async ({ page }) => {
  await signIn(page);
  const boundPage = Object.keys((await readState(PORT)).containers[0].pages)[0];
  const body = JSON.stringify({ title: '题' });

  const noProtection = await page.context().request.post(`${BASE}/api/modules/questions/items`, {
    headers: await apiHeaders(page, { 'X-TeachBuddy-Page': boundPage, 'Content-Type': 'application/json' }),
    data: body,
  });
  expect(noProtection.status()).toBe(403);
  expect((await noProtection.json()).type).toBe('/problems/workbench/request-not-allowed');

  const protection = await page.context().request.post(`${BASE}/api/modules/questions/items`, {
    headers: await apiHeaders(page, {
      'X-TeachBuddy-Page': boundPage,
      'X-TeachBuddy-Request': '1',
      'Content-Type': 'application/json',
      'Idempotency-Key': '88888888-8888-4888-8888-888888888888',
    }),
    data: body,
  });
  expect(protection.status()).toBe(201);

  const read = await page.context().request.get(`${BASE}/api/workbench/context`, {
    headers: await apiHeaders(page, { 'X-TeachBuddy-Page': boundPage }),
  });
  expect(read.status()).toBe(200);
});

test('跨源请求被来源保护拒绝且没有账户副作用（P01 / P05）', async ({ page }) => {
  await seedAccount(PORT, TEACHER);
  const foreignPage = await page.context().newPage();
  await foreignPage.goto(`http://127.0.0.1:${FOREIGN_PORT}/`);
  /* No CORS headers are exposed, so the browser reports a blocked fetch; the
   * server-side answer is checked through a direct request below. */
  await expect.poll(async () => foreignPage.evaluate(() => document.body.dataset.status)).toBe('network-error');
  await foreignPage.close();

  const state = await readState(PORT);
  expect(state.sessions).toHaveLength(0);
  expect(state.challenges).toHaveLength(0);

  const direct = await page.context().request.post(`${BASE}/api/auth/login`, {
    headers: {
      Origin: 'http://127.0.0.1:48183',
      'Content-Type': 'application/json',
      'X-TeachBuddy-Request': '1',
      'X-TeachBuddy-Page': '0123456789abcdef0123456789abcdef',
    },
    data: JSON.stringify({ email: TEACHER.email, password: TEACHER.password, rememberMe: true }),
  });
  expect(direct.status()).toBe(403);
  expect(direct.headers()['access-control-allow-origin']).toBeUndefined();
});

test('transport 只接受同源 /api，其他地址直接拒绝（工作台 transport 约定）', async ({ page }) => {
  await signIn(page);
  const crossOrigin = await page.evaluate(async () => {
    try {
      await window.__authHarness.request('https://example.com/api/workbench/context');
      return 'allowed';
    } catch (error) {
      return `${error.name}:${error.message}`;
    }
  });
  expect(crossOrigin).toContain('TypeError');

  const nonApi = await page.evaluate(async () => {
    try {
      await window.__authHarness.request('/not-api');
      return 'allowed';
    } catch (error) {
      return `${error.name}:${error.message}`;
    }
  });
  expect(nonApi).toContain('TypeError');

  const allowed = await page.evaluate(() => window.__authHarness.request('/api/workbench/context'));
  expect(allowed.status).toBe(200);
});

test('退出确认后回登录，重复退出仍为 204（O01 / WB-AUTH-017）', async ({ page }) => {
  await signIn(page, '?requestTimeoutMs=1500');
  await page.locator('[data-harness-logout]').click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();

  const revoked = (await readState(PORT)).sessions[0];
  expect(revoked.revoked).toBe(true);

  const again = await page.context().request.post(`${BASE}/api/auth/logout`, {
    headers: await apiHeaders(page, {
      'X-TeachBuddy-Page': '0123456789abcdef0123456789abcdef',
      'X-TeachBuddy-Request': '1',
      'Content-Type': 'application/json',
    }),
    data: JSON.stringify({ sessionId: revoked.id }),
  });
  expect(again.status()).toBe(204);
});

test('退出结果未确认时锁住业务并重试同一目标（O02 / WB-AUTH-017）', async ({ page }) => {
  await signIn(page, '?requestTimeoutMs=1200');
  const sessionId = (await readState(PORT)).sessions[0].id;

  await armFault(PORT, { operation: 'logout', kind: 'hang-after', times: 1 });
  await page.locator('[data-harness-logout]').click();
  await expect(page.locator('[data-harness-logout-error]')).toHaveText('退出结果暂未确认');
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);

  const locked = await page.evaluate(async () => {
    try {
      await window.__authHarness.request('/api/workbench/context');
      return 'allowed';
    } catch (error) {
      return error.kind || error.name;
    }
  });
  expect(locked).toBe('auth-locked');

  await page.locator('[data-harness-logout]').click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  const logouts = await requestsFor(PORT, { method: 'POST', path: '/api/auth/logout' });
  expect(logouts.length).toBeGreaterThanOrEqual(2);
  expect(logouts.every((request) => request.body.sessionId === sessionId)).toBe(true);
});

test('退出失败（已回滚）保留现场可重试，不锁业务（O02）', async ({ page }) => {
  await signIn(page);
  /* The store fault is applied before the revoke, so the rollback is real. */
  await armFault(PORT, {
    operation: 'session-store-write',
    kind: 'problem',
    type: '/problems/auth/session-store-unavailable',
    times: 1,
  });
  await page.locator('[data-harness-logout]').click();
  await expect(page.locator('[data-harness-logout-error]')).toHaveText('退出失败，请重试');
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
  const business = await page.evaluate(() => window.__authHarness.request('/api/workbench/context'));
  expect(business.status).toBe(200);

  await page.locator('[data-harness-logout]').click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
});

test('受保护操作清单与工作台契约的 operationId 一致（15 个）', () => {
  const openapi = fs.readFileSync(
    path.join(REPO_ROOT, 'apps/api/src/contracts/workbench.openapi.yaml'),
    'utf8',
  );
  const declared = [...openapi.matchAll(/operationId: (\w+)/g)].map((match) => match[1]);
  expect(declared).toHaveLength(15);
  expect(new Set(declared)).toEqual(new Set(WORKBENCH_OPERATIONS.map((operation) => operation.id)));
  expect(WORKBENCH_OPERATIONS).toHaveLength(15);
  expect(WORKBENCH_OPERATIONS.filter((operation) => operation.method !== 'GET')).toHaveLength(7);
});
