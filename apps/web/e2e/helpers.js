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
    name: `${base}教师`,
    email: `${base}.${suffix}@example.test`,
    password
  };
}

export async function registerTeacher(page, { name, email, password }) {
  await page.goto('/');
  await page.getByRole('button', { name: '注册' }).click();
  await page.getByLabel('显示名称').fill(name);
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('确认密码').fill(password);
  await page.getByRole('button', { name: '创建账户' }).click();
  await expect(page.getByRole('button', { name: '工作台首页' })).toBeVisible();
}

export async function loginTeacher(page, { email, password }) {
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('button', { name: '工作台首页' })).toBeVisible();
}

export async function uploadResource(page, {
  title,
  fileName,
  contents,
  tags = '',
  moduleLinks = ''
}) {
  await page.getByLabel('标题').fill(title);
  if (tags) await page.getByLabel('标签').fill(tags);
  if (moduleLinks) await page.getByLabel('关联模块').fill(moduleLinks);
  await page.getByLabel('选择文件').setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from(contents)
  });
  await page.getByRole('button', { name: '上传资源' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

export function moduleButton(page, title) {
  return page.locator('aside').getByRole('button', { name: title, exact: true });
}

export function itemCard(page, text) {
  return page.locator('.item-card').filter({ hasText: text }).first();
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
