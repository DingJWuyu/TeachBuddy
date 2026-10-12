import fs from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { createIntegration } from '../../../api/test/fixtures/auth-integration/harness.js';

export { expect };
export const password = 'auth-regression-password';
export const test = base.extend({
  world: async ({}, use, testInfo) => {
    const directory = testInfo.outputPath('runtime');
    fs.mkdirSync(directory, { recursive: true });
    const world = await createIntegration({ directory });
    try { await use(world); }
    finally {
      await world.close();
      if (testInfo.status === testInfo.expectedStatus) fs.rmSync(directory, { recursive: true, force: true });
    }
  },
});

export function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve, release: resolve };
}

export async function registrationForm(page, world, email = 'teacher@example.test') {
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await page.getByLabel('昵称', { exact: true }).fill('核查教师');
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect.poll(() => world.mailer.lastCode('registration', email)).toBeTruthy();
  await expect(page.getByRole('button', { name: /后重发/ })).toBeVisible();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', email));
  await page.getByRole('checkbox').check();
}

export async function register(page, world, email = 'teacher@example.test') {
  await registrationForm(page, world, email);
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
}

export async function signIn(page, email, options = {}) {
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(options.password ?? password);
  await page.getByLabel('记住我', { exact: true }).setChecked(options.remember ?? true);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
}

export async function openSettings(page) {
  await page.getByRole('link', { name: /^账户：/ }).click();
  await expect(page.getByRole('button', { name: '删除账户', exact: true })).toBeVisible();
}

export async function removeAccount(page, email) {
  await openSettings(page);
  await page.getByRole('button', { name: '删除账户', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '删除账户？', exact: true });
  await dialog.getByLabel('输入账户邮箱以确认').fill(email);
  await dialog.getByRole('button', { name: '永久删除账户', exact: true }).click();
}
