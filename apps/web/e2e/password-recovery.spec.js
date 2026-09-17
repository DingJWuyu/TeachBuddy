import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { accountFor, registerTeacher } from './helpers.js';

const captureFile = path.resolve(process.cwd(), 'apps/web/e2e/.password-recovery-mail.jsonl');

test.afterAll(() => {
  fs.rmSync(captureFile, { force: true });
});

function readLatestMail(email) {
  if (!fs.existsSync(captureFile)) return null;
  const lines = fs.readFileSync(captureFile, 'utf-8').trim().split('\n').filter(Boolean);
  if (!lines.length) return null;
  return lines.map((line) => JSON.parse(line)).reverse().find((message) => message.to === email) || null;
}

async function waitForRecoveryCode(email) {
  let code = '';
  await expect.poll(() => {
    const message = readLatestMail(email);
    code = message?.text?.match(/\b\d{6}\b/)?.[0] || '';
    return code;
  }, { timeout: 10_000 }).toMatch(/^\d{6}$/);
  return code;
}

test('teacher can recover a password from the login entry through a captured email', async ({ page }, testInfo) => {
  const oldPassword = 'browser old password';
  const newPassword = 'browser new password';
  const account = accountFor('browser-recovery', testInfo, oldPassword);
  const { email } = account;

  await registerTeacher(page, { ...account, name: '浏览器找回教师' });
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('heading', { name: '教师账户' })).toBeVisible();
  await page.getByRole('button', { name: '忘记密码？' }).click();
  await expect(page.getByRole('heading', { name: '找回密码' })).toBeVisible();
  await page.getByLabel('邮箱').fill(email);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByRole('heading', { name: '设置新密码' })).toBeVisible();

  const code = await waitForRecoveryCode(email);
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
