import { test as base, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createIntegration } from '../../../api/test/support/application.js';

export const test = base.extend({
  applicationOptions: [{}, { option: true }],
  world: async ({ applicationOptions }, use, info) => {
    const directory = info.outputPath('application');
    const world = await createIntegration({ ...applicationOptions, directory });
    try { await use(world); } finally { await world.close(); if (info.status === info.expectedStatus) await fs.rm(directory, { recursive: true, force: true }); }
  },
});
export { expect };

export async function register(page, world, email = 'browser@example.test', nickname = '流程老师') {
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill(nickname);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('browser-password-2026');
  await page.getByLabel('确认密码', { exact: true }).fill('browser-password-2026');
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect.poll(() => world.mailer.lastCode('registration', email)).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', email));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.isVisible()) await coach.click();
}
export async function navigate(page, path) {
  await page.locator(`a[href="${path}"]`).filter({ visible: true }).first().click();
}
export async function createQuestion(page, title, body) {
  await navigate(page, '/questions');
  await page.getByRole('button', { name: '新建题目', exact: true }).first().click();
  await page.getByRole('textbox', { name: '题目标题', exact: true }).fill(title);
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill(body);
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}
export async function logout(page) {
  await page.getByRole('link', { name: /^账户：/ }).click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await page.locator('dialog.settings-logout-dialog').getByRole('button', { name: '退出登录', exact: true }).click();
}

// A second device has the authentication Cookie, without this device's drafts or scenes.
export async function onNewDevice(page, world, visit) {
  const context = await page.context().browser().newContext({
    ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 },
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  try {
    const fresh = await context.newPage();
    await fresh.goto(world.origin);
    await expect(fresh.locator('.wb-shell')).toBeVisible();
    const coach = fresh.getByRole('button', { name: '知道了', exact: true });
    if (await coach.isVisible()) await coach.click();
    await visit(fresh);
  } finally { await context.close(); }
}
