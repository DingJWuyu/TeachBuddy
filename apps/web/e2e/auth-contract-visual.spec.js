/*
 * Three-viewport visual and interaction evidence for the account entry. The
 * screenshots are written under test-results/evidence/AUTH-FRONTEND/v1/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  armFault,
  ensureSubstitute,
  latestMail,
  readState,
  requestsFor,
  resetState,
  seedAccount,
} from './fixtures/auth-contract/fixture-control.mjs';

const PORT = 49183;
const BASE = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/*
 * Committed evidence is refreshed explicitly:
 *   AUTH_WRITE_EVIDENCE=1 npx playwright test --config ... auth-contract-visual
 * A normal suite run keeps its captures in the ignored test-results directory
 * so regenerated evidence does not dirty the working tree.
 */
const EVIDENCE_DIR = path.join(REPO_ROOT, 'test-results/evidence/AUTH-FRONTEND/v1/screenshots');
const SHOT_DIR = process.env.AUTH_WRITE_EVIDENCE === '1'
  ? EVIDENCE_DIR
  : path.join(REPO_ROOT, 'apps/web/test-results/auth-contract-screenshots');
const TEACHER = { email: 'teacher@example.com', nickname: '林老师', password: ' TeAcH😀9' };

const VIEWPORTS = [
  { name: 'pc-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'phone-390x844', width: 390, height: 844 },
];

let substitute;

/* Screenshots must be reproducible: reduced motion lands every band on its
 * final state instead of a mid-animation frame. */
test.use({ reducedMotion: 'reduce' });

test.beforeAll(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  substitute = await ensureSubstitute({ port: PORT });
});

test.afterAll(async () => {
  await substitute?.stop();
});

test.beforeEach(async () => {
  await resetState(PORT);
});

async function shoot(page, name) {
  /* Drop the caret and settle two frames so a capture is reproducible. */
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

async function expectNoHorizontalOverflow(page) {
  await expect
    .poll(() => page.evaluate(() => (
      document.documentElement.scrollWidth <= window.innerWidth
      && document.body.scrollWidth <= window.innerWidth
    )))
    .toBe(true);
}

async function expectActionsInsideViewport(page, locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function openEntry(page, query = '') {
  await page.goto(`${BASE}/${query}`);
  await expect(page.getByRole('heading', { name: '登录' })).toBeVisible();
}

async function signInRemotely(page) {
  await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
  await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('正常、字段错、横幅、等待、S45 与注册发码状态可见且不溢出', async ({ page }) => {
      await seedAccount(PORT, TEACHER);

      await openEntry(page);
      await shoot(page, `${viewport.name}-login`);
      await expectActionsInsideViewport(page, page.getByRole('button', { name: '登录', exact: true }));
      await expectNoHorizontalOverflow(page);

      await page.getByRole('button', { name: '登录', exact: true }).click();
      await expect(page.getByText('请填写邮箱。')).toBeVisible();
      await shoot(page, `${viewport.name}-field-error`);
      await expectNoHorizontalOverflow(page);

      await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
      await page.getByLabel('密码', { exact: true }).fill('wrong password');
      await page.getByRole('button', { name: '登录', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: '邮箱或密码不正确，请重试。' })).toBeVisible();
      await shoot(page, `${viewport.name}-banner`);
      await expectNoHorizontalOverflow(page);

      await resetState(PORT);
      await seedAccount(PORT, TEACHER);
      await openEntry(page);
      await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
      await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
      await armFault(PORT, { operation: 'login', kind: 'delay', ms: 3000, times: 1 });
      await page.getByRole('button', { name: '登录', exact: true }).click();
      const waiting = page.getByRole('button', { name: '登录中' });
      await expect(waiting).toBeVisible();
      await expect(waiting).toBeDisabled();
      await shoot(page, `${viewport.name}-waiting`);
      await expectNoHorizontalOverflow(page);

      await resetState(PORT);
      await seedAccount(PORT, TEACHER);
      await openEntry(page);
      await armFault(PORT, {
        operation: 'session-persistence',
        kind: 'problem',
        type: '/problems/auth/session-persistence-unavailable',
        times: 1,
      });
      await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
      await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
      await page.getByRole('button', { name: '登录', exact: true }).click();
      await expect(page.getByRole('heading', { name: '保存登录状态' })).toBeVisible();
      await shoot(page, `${viewport.name}-s45`);
      await expectActionsInsideViewport(page, page.getByRole('button', { name: '继续进入工作台' }));
      await expectNoHorizontalOverflow(page);

      await resetState(PORT);
      await openEntry(page);
      await page.getByRole('button', { name: '创建账户' }).click();
      await page.getByLabel('昵称', { exact: true }).fill('林老师');
      await page.getByLabel('邮箱', { exact: true }).fill('new.teacher@example.com');
      await page.getByLabel('密码', { exact: true }).fill('password-8');
      await page.getByLabel('确认密码', { exact: true }).fill('password-8');
      await page.getByRole('button', { name: '发送验证码' }).click();
      await expect(page.getByLabel('邮箱验证码', { exact: true })).toBeVisible();
      await shoot(page, `${viewport.name}-register-code`);
      await expectNoHorizontalOverflow(page);
      await expectActionsInsideViewport(page, page.getByRole('button', { name: '注册', exact: true }));
    });

    test('恢复等待、恢复失败与结果未确认状态可见且不溢出', async ({ page }) => {
      await seedAccount(PORT, TEACHER);
      await openEntry(page);
      await signInRemotely(page);

      await armFault(PORT, { operation: 'session-post', kind: 'delay', ms: 1500, times: 1 });
      await page.reload();
      await expect(page.getByRole('heading', { name: '恢复登录状态' })).toBeVisible();
      await shoot(page, `${viewport.name}-s46`);
      await expectNoHorizontalOverflow(page);
      await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);

      await armFault(PORT, {
        operation: 'session-post',
        kind: 'problem',
        type: '/problems/auth/session-store-unavailable',
        times: -1,
      });
      await page.reload();
      await expect(page.getByRole('heading', { name: '恢复失败' })).toBeVisible();
      await shoot(page, `${viewport.name}-s47`);
      await expectActionsInsideViewport(page, page.getByRole('button', { name: '重试' }));
      await expectNoHorizontalOverflow(page);

      await resetState(PORT);
      await openEntry(page, '?requestTimeoutMs=1200');
      await page.getByRole('button', { name: '创建账户' }).click();
      await page.getByLabel('昵称', { exact: true }).fill('林老师');
      await page.getByLabel('邮箱', { exact: true }).fill('unknown@example.com');
      await page.getByLabel('密码', { exact: true }).fill('password-8');
      await page.getByLabel('确认密码', { exact: true }).fill('password-8');
      await page.getByRole('button', { name: '发送验证码' }).click();
      const mail = await latestMail(PORT, 'unknown@example.com');
      await page.getByLabel('邮箱验证码', { exact: true }).fill(mail.code);
      await page.getByRole('checkbox', { name: /注册即表示同意/ }).check();
      await armFault(PORT, { operation: 'register', kind: 'hang-after', times: 1 });
      await page.getByRole('button', { name: '注册', exact: true }).click();
      await expect(page.getByText('注册结果暂未确认，请返回登录并尝试使用刚提交的邮箱和密码。')).toBeVisible();
      await shoot(page, `${viewport.name}-s44`);
      await expectNoHorizontalOverflow(page);
    });
  });
}

test.describe('keyboard and pointer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('键盘顺序、Enter 单次提交与指针操作保持既定行为', async ({ page }) => {
    await seedAccount(PORT, TEACHER);
    await openEntry(page);
    await page.getByLabel('邮箱', { exact: true }).focus();
    await page.keyboard.press('Tab');
    expect((await page.evaluate(() => document.activeElement?.textContent))?.trim()).toBe('忘记密码？');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('ae-password');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('显示密码');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.type)).toBe('checkbox');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.className)).toContain('ae-primary');

    await page.getByLabel('邮箱', { exact: true }).fill(TEACHER.email);
    await page.getByLabel('密码', { exact: true }).fill(TEACHER.password);
    await page.getByLabel('密码', { exact: true }).press('Enter');
    await expect(page.locator('[data-harness-nickname]')).toHaveText(TEACHER.nickname);
    expect(await requestsFor(PORT, { method: 'POST', path: '/api/auth/login' })).toHaveLength(1);

    await page.locator('[data-harness-logout]').click();
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible();
    await page.getByLabel('密码', { exact: true }).fill('pointer-secret');
    await page.getByRole('button', { name: '显示密码' }).click();
    await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text');
    await shoot(page, 'pc-1440x900-pointer-password-visible');

    /* The terms link only exists on the register card; the pointer click must
     * not navigate anywhere. */
    const url = page.url();
    await page.getByRole('button', { name: '创建账户' }).click();
    await expect(page.getByRole('heading', { name: '注册' })).toBeVisible();
    await page.getByRole('link', { name: '服务条款' }).click();
    expect(page.url()).toBe(url);
    await expect(page.getByRole('heading', { name: '注册' })).toBeVisible();
  });
});

test.describe('touch input', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('触摸点击可完成注册发码并保持卡片布局', async ({ page }) => {
    await openEntry(page);
    await page.getByRole('button', { name: '创建账户' }).tap();
    await expect(page.getByRole('heading', { name: '注册' })).toBeVisible();
    await page.getByLabel('昵称', { exact: true }).tap();
    await page.getByLabel('昵称', { exact: true }).fill('触摸教师');
    await page.getByLabel('邮箱', { exact: true }).fill('touch@example.com');
    await page.getByLabel('密码', { exact: true }).fill('password-8');
    await page.getByLabel('确认密码', { exact: true }).fill('password-8');
    await page.getByRole('button', { name: '发送验证码' }).tap();
    await expect(page.getByLabel('邮箱验证码', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shoot(page, 'phone-390x844-touch-register-code');
  });
});

test.describe('long content', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('长邮箱与长昵称不撑开卡片且全文可访问', async ({ page }) => {
    const longEmail = `${'a'.repeat(64)}@example.com`;
    await openEntry(page);
    await page.getByRole('button', { name: '创建账户' }).click();
    await page.getByLabel('昵称', { exact: true }).fill('😀'.repeat(40));
    await page.getByLabel('邮箱', { exact: true }).fill(longEmail);
    await page.getByLabel('密码', { exact: true }).fill('password-8');
    await page.getByLabel('确认密码', { exact: true }).fill('password-8');
    await page.getByRole('button', { name: '发送验证码' }).click();
    await expect(page.getByLabel('邮箱验证码', { exact: true })).toBeVisible();

    const address = page.locator('.ae-code-note-address');
    await expect(address).toHaveAttribute('title', longEmail);
    await expect(address).toHaveAttribute('aria-label', longEmail);
    expect(await address.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    await expectNoHorizontalOverflow(page);
    await shoot(page, 'phone-390x844-long-content');

    const cardBox = await page.locator('.ae-card').boundingBox();
    expect(cardBox.width).toBeLessThanOrEqual(390);
    const nicknameCounter = await page.locator('.ae-field-count').first().textContent();
    expect(nicknameCounter).toBe('40/40');
    const state = await readState(PORT);
    expect(state.accounts).toHaveLength(0);
  });
});
