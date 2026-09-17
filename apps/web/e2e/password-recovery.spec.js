import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const captureFile = path.resolve(process.cwd(), 'apps/web/e2e/.password-recovery-mail.jsonl');

test.afterAll(() => {
  fs.rmSync(captureFile, { force: true });
});

function readLatestMail() {
  if (!fs.existsSync(captureFile)) return null;
  const lines = fs.readFileSync(captureFile, 'utf-8').trim().split('\n').filter(Boolean);
  if (!lines.length) return null;
  return JSON.parse(lines.at(-1));
}

async function waitForRecoveryCode() {
  let code = '';
  await expect.poll(() => {
    const message = readLatestMail();
    code = message?.text?.match(/\b\d{6}\b/)?.[0] || '';
    return code;
  }, { timeout: 10_000 }).toMatch(/^\d{6}$/);
  return code;
}

test('teacher can recover a password from the login entry through a captured email', async ({ page }) => {
  const email = 'browser.recovery@example.test';
  const oldPassword = 'browser old password';
  const newPassword = 'browser new password';

  await page.goto('/');
  await page.getByRole('button', { name: '注册' }).click();
  await page.getByLabel('显示名称').fill('浏览器找回教师');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(oldPassword);
  await page.getByLabel('确认密码').fill(oldPassword);
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('heading', { name: '教师账户' })).toBeVisible();
  await page.getByRole('button', { name: '忘记密码？' }).click();
  await expect(page.getByRole('heading', { name: '找回密码' })).toBeVisible();
  await page.getByLabel('邮箱').fill(email);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  const code = await waitForRecoveryCode();
  await page.getByLabel('验证码').fill(code);
  await page.getByLabel('新密码', { exact: true }).fill(newPassword);
  await page.getByLabel('确认新密码', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: '重置密码' }).click();
  await expect(page.getByRole('heading', { name: '教师账户' })).toBeVisible();
  await expect(page.getByText('密码已重置，请使用新密码登录。')).toBeVisible();

  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(oldPassword);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByText('邮箱或密码错误。')).toBeVisible();

  await page.getByLabel('密码', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
  await expect(page.getByText('浏览器找回教师', { exact: true })).toBeVisible();
});
