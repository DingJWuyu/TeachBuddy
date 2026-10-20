import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { expect } from '@playwright/test';

export function accountFor(base, testInfo, password) {
  const identity = [
    testInfo.testId,
    testInfo.repeatEachIndex,
    testInfo.retry,
    testInfo.workerIndex
  ].join(':');
  const suffix = crypto.createHash('sha1').update(identity).digest('hex').slice(0, 12);
  return {
    name: base + '教师',
    email: base + '.' + suffix + '@example.test',
    password
  };
}

async function capturedCode(email, verificationCode) {
  if (verificationCode) return typeof verificationCode === 'function' ? verificationCode() : verificationCode;
  const capture = path.resolve('apps/web/e2e/.password-recovery-mail.jsonl');
  if (!fs.existsSync(capture)) return '';
  const message = fs.readFileSync(capture, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).reverse().find(item => item.to === email.toLowerCase());
  return message?.text?.match(/\b\d{6}\b/)?.[0] || '';
}

export async function registerTeacher(page, { name, email, password, verificationCode }) {
  await page.goto('/');
  await page.getByRole('button', { name: /^创建账户(?: ›)?$/ }).click();
  await page.getByLabel('昵称', { exact: true }).fill(name);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  let code;
  await expect.poll(async () => { code = await capturedCode(email, verificationCode); return code; }).toMatch(/^\d{6}$/);
  await page.getByLabel('邮箱验证码', { exact: true }).fill(code);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const coach = page.locator('.tb-coach-scrim');
  if (await coach.isVisible()) await coach.click({ position: { x: 1, y: 1 } });
}

export async function loginTeacher(page, { email, password }) {
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const coach = page.locator('.tb-coach-scrim');
  if (await coach.isVisible()) await coach.click({ position: { x: 1, y: 1 } });
}

export async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
      && document.body.scrollWidth <= window.innerWidth
  ))).toBe(true);
}

export async function expectWithinViewport(page, locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
}
