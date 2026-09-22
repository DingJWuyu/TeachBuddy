import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
const evidence = path.resolve(process.env.R33_LOCAL5_EVIDENCE ?? 'test-results/r33-attempt5/screenshots');
let world;
test.beforeEach(async ({ page }) => {
  fs.mkdirSync(evidence, { recursive: true });
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'r33-local5-browser-')) });
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('分类管理老师');
  await page.getByLabel('邮箱', { exact: true }).fill('local5@example.test');
  await page.getByLabel('密码', { exact: true }).fill('local5-password');
  await page.getByLabel('确认密码', { exact: true }).fill('local5-password');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect.poll(() => world.mailer.lastCode('registration', 'local5@example.test')).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'local5@example.test'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  await page.locator('.wb-sidebar').getByRole('link', { name: '题库', exact: true }).click();
});
test.afterEach(async ({ page }, info) => {
  await page.screenshot({ path: path.join(evidence, `${info.title}.png`) });
  await page.context().close();
  await world.close();
});

test('LOCAL002-open-tool', async ({ page }) => {
  await page.getByRole('button', { name: '分类管理', exact: true }).click();
  await expect(page.getByLabel('新分类名称')).toBeVisible();
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  await page.getByLabel('AI 输入').fill('保留 AI 草稿');
  await page.getByLabel('搜索题目').fill('普通浏览');
  await expect(page.getByLabel('AI 输入')).toBeVisible();
  await page.getByRole('button', { name: '分类管理', exact: true }).click();
  await expect(page.getByLabel('新分类名称')).toBeVisible();
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  await expect(page.getByLabel('AI 输入')).toHaveValue('保留 AI 草稿');
});

test('LOCAL004-single-line-controls', async ({ page }) => {
  // Open the tool explicitly so this assertion remains independent of LOCAL002.
  await page.locator('header').getByRole('button', { name: 'AI 助理', exact: true }).click();
  await page.getByRole('tab', { name: '分类与标签', exact: true }).click();
  await page.getByRole('button', { name: '分类管理', exact: true }).click();
  await page.getByLabel('新分类名称').fill('几何证明');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await page.getByLabel('分类类别').selectOption('tags');
  await page.getByLabel('新分类名称').fill('长名称标签边界检验');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  const measurements = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    const sizes = await page.getByRole('button', { name: '删除', exact: true }).evaluateAll(buttons => buttons.map(button => {
      const range = document.createRange(); range.selectNodeContents(button);
      return { textHeight: range.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(button).lineHeight), width: button.getBoundingClientRect().width };
    }));
    measurements.push({ viewport, sizes });
    await page.screenshot({ path: path.join(evidence, `taxonomy-${viewport.width}.png`) });
    fs.writeFileSync(path.join(evidence, 'taxonomy-measurements.json'), JSON.stringify(measurements, null, 2));
    expect(sizes.length).toBe(2);
    for (const size of sizes) expect(size.textHeight).toBeLessThanOrEqual(size.lineHeight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const saved = page.waitForResponse(r => r.url().endsWith('/questions/v2/taxonomy') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  expect((await saved).status()).toBe(200);
  // M43 routes the real module to /questions; this isolated auth fixture serves
  // its SPA entry at /. Re-enter through that entry for a full-page reload.
  await page.goto(world.origin);
  await page.locator('.wb-sidebar').getByRole('link', { name: '题库', exact: true }).click();
  // The frozen shell uses a full workspace overlay at 1024px.
  await page.getByRole('complementary', { name: '辅助栏', exact: true }).getByRole('button', { name: '关闭辅助栏', exact: true }).click();
  await page.getByRole('button', { name: '分类管理', exact: true }).click();
  await expect(page.getByLabel('分类名称', { exact: true }).first()).toHaveValue('几何证明');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除', exact: true }).first().click();
  await expect(page.getByLabel('分类名称', { exact: true })).toHaveCount(1);
  const deleted = page.waitForResponse(r => r.url().endsWith('/questions/v2/taxonomy') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存分类', exact: true }).click();
  const response = await deleted;
  expect(response.status()).toBe(200);
  expect((await response.json()).types).toEqual([]);
});
