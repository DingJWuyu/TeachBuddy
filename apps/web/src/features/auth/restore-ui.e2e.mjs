// Run after npm run build:web: node apps/web/src/features/auth/restore-ui.e2e.mjs
// Real HTTPS/Cookie authentication, isolated SQLite and local-only mail delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createIntegration } from '../../../../api/test/fixtures/auth-integration/harness.js';

const evidence = path.resolve(process.env.AUTH_RESTORE_EVIDENCE || '.scratch/restore-auth');
fs.mkdirSync(evidence, { recursive: true });
const prototype = await createServer({ root: path.resolve('prototype'), server: { host: '127.0.0.1', port: 0 } });
await prototype.listen();
const referenceUrl = prototype.resolvedUrls.local[0];
const world = await createIntegration();
const browser = await chromium.launch();
const metrics = [];
let passed = false;
async function geometry(page) {
  return page.evaluate(() => Object.fromEntries(['.ae-brand', '.ae-card', '.ae-form', '.ae-switch', '.ae-primary'].map(selector => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return [selector, [rect.x, rect.y, rect.width, rect.height]];
  })));
}
async function screenshot(page, name) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
  await page.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
}
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const reference = await context.newPage();
    await page.goto(world.origin);
    await reference.goto(referenceUrl);
    for (const mode of ['login', 'register', 'recovery']) {
      for (const current of [page, reference]) {
        await current.locator('.ae-form').waitFor();
        if (mode === 'register') await current.getByRole('button', { name: '创建账户', exact: true }).click();
        if (mode === 'recovery') {
          await current.locator('.ae-switch button').click();
          await current.getByRole('button', { name: '忘记密码？' }).click();
        }
      }
      const actual = await geometry(page), expected = await geometry(reference);
      assert.deepEqual(actual, expected, `${viewport.width} ${mode} matches prototype geometry`);
      metrics.push({ width: viewport.width, mode, actual, expected });
      await screenshot(page, `${viewport.width}-${mode}`);
      await screenshot(reference, `${viewport.width}-${mode}-reference`);
    }
    await page.locator('.ae-switch button').click();
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('邮箱');
    await page.getByRole('button', { name: '创建账户', exact: true }).click();
    const email = `restore-${viewport.width}@example.test`;
    await page.getByLabel('昵称', { exact: true }).fill('恢复验收');
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill('restore-password');
    await page.getByRole('button', { name: '显示密码' }).click();
    await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: '隐藏密码' }).click();
    await page.getByLabel('确认密码', { exact: true }).fill('restore-password');
    await page.getByRole('button', { name: '发送验证码', exact: true }).click();
    await expect(page.getByRole('button', { name: /s 后重发/ })).toBeDisabled();
    await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', email) === '000000' ? '111111' : '000000');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: '注册', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', email));
    await screenshot(page, `${viewport.width}-register-code`);
    await page.getByRole('button', { name: '注册', exact: true }).click();
    await expect(page.locator('.wb-shell')).toBeVisible();
    assert.ok((await context.cookies()).some(cookie => cookie.name === '__Host-teachbuddy_session' && cookie.secure && cookie.httpOnly));
    await page.goto(`${world.origin}/settings`);
    await page.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(page.locator('.ae-form')).toBeVisible();
    await page.getByRole('button', { name: '忘记密码？' }).click();
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByRole('button', { name: '发送验证码', exact: true }).click();
    await expect(page.getByLabel('邮箱', { exact: true })).toHaveAttribute('readonly', '');
    await expect(page.getByRole('button', { name: /s 后重发/ })).toBeDisabled();
    await screenshot(page, `${viewport.width}-recovery-confirm`);
    await reference.locator('input[autocomplete="email"]').fill('example@example.com');
    await reference.getByRole('button', { name: '发送验证码', exact: true }).click();
    await expect(reference.getByRole('heading', { name: '设置新密码' })).toBeVisible();
    await screenshot(reference, `${viewport.width}-recovery-confirm-reference`);
    const actual = await geometry(page), expected = await geometry(reference);
    assert.deepEqual(actual, expected, `${viewport.width} recovery-confirm matches prototype geometry`);
    metrics.push({ width: viewport.width, mode: 'recovery-confirm', actual, expected });
    await page.getByLabel('验证码', { exact: true }).fill(world.mailer.lastCode('password-reset', email));
    await page.getByLabel('新密码', { exact: true }).fill('restored-password');
    await page.getByLabel('确认新密码', { exact: true }).fill('restored-password');
    await page.getByRole('button', { name: '重置密码', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('密码已重置');
    await page.getByLabel('密码', { exact: true }).fill('restored-password');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page.locator('.wb-shell')).toBeVisible();
    await page.reload();
    await expect(page.locator('.wb-shell')).toBeVisible();
    await context.close();
  }
  fs.writeFileSync(path.join(evidence, 'geometry.json'), JSON.stringify(metrics, null, 2));
  passed = true;
  console.log('PASS: desktop/mobile prototype geometry, validation, password toggle, local mail registration, cooldown, wrong code, Cookie, logout, reset, login and remembered reload');
} finally {
  await browser.close();
  await world.close();
  await prototype.close();
  if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
}
