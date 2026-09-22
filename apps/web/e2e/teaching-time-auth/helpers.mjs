import { expect } from '@playwright/test';
const pageKeys = new WeakMap();
export function track(page) {
  page.on('request', request => {
    const key = request.headers()['x-teachbuddy-page'];
    if (key) pageKeys.set(page, key);
  });
}
export function headers(page) {
  const key = pageKeys.get(page);
  if (!key) throw new Error('No page context observed from real UI authentication');
  return { 'X-TeachBuddy-Page': key };
}
export async function register(page, world, email = 'teacher-a@example.test') {
  track(page);
  if (!await page.getByRole('heading', { name: '登录', exact: true }).isVisible()) await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill(email.startsWith('teacher-a') ? '甲老师' : '乙老师');
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('teaching-auth-password');
  await page.getByLabel('确认密码', { exact: true }).fill('teaching-auth-password');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect.poll(() => world.mailer.lastCode('registration', email)).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', email));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
}
export async function login(page, email = 'teacher-a@example.test') {
  track(page);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('teaching-auth-password');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
}
export async function logout(page) {
  const settings = page.locator('.wb-sidebar').getByRole('link', { name: '设置', exact: true });
  if (!await settings.isVisible()) await page.getByRole('button', { name: '展开侧栏', exact: true }).click();
  await settings.click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
}
