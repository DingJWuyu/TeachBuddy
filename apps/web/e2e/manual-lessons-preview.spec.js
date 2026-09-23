import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';

const evidence = path.resolve(process.env.MANUAL_LESSONS_PREVIEW_EVIDENCE || 'test-results/manual-lessons-preview-evidence');
let world;
test.afterEach(async ({ context }, testInfo) => {
  await context.close();
  await world?.close();
  if (world && testInfo.status === 'passed') fs.rmSync(world.directory, { recursive: true, force: true });
});

async function settle(page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
  });
}

async function checkPage(page, label) {
  const image = page.locator('.r34-preview-scroll img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await settle(page);
  const visibility = await image.evaluate(img => {
    const rect = img.getBoundingClientRect();
    const points = [0.02, 0.5, 0.98].flatMap(x => [0.02, 0.5, 0.98].map(y => ({
      x: rect.left + rect.width * x, y: rect.top + rect.height * y,
    })));
    return { rect: rect.toJSON(), visiblePoints: points.filter(point => document.elementFromPoint(point.x, point.y) === img).length, totalPoints: points.length };
  });
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, `${label}.json`), JSON.stringify(visibility, null, 2));
  await page.screenshot({ path: path.join(evidence, `${label}.png`) });
  expect(visibility.visiblePoints, `${label}: 页图四角、边缘和中心均应可见`).toBe(visibility.totalPoints);
}

const nav = (page, name) => page.locator('.wb-sidebar').getByRole('link', { name, exact: true }).click();
test('MF-UI-01 更新对照新旧文件完整阅读及采用保存', async ({ page }) => {
  test.setTimeout(180000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  world = await createIntegration();
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await page.getByLabel('昵称', { exact: true }).fill('预览回归老师');
  await page.getByLabel('邮箱', { exact: true }).fill('preview-regression@example.test');
  await page.getByLabel('密码', { exact: true }).fill('Preview-test-123');
  await page.getByLabel('确认密码', { exact: true }).fill('Preview-test-123');
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect.poll(() => world.mailer.lastCode('registration', 'preview-regression@example.test')).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'preview-regression@example.test'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  await nav(page, '备课');
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('新旧课件完整阅读');
  await page.getByRole('button', { name: '添加环节', exact: true }).click();
  await page.getByLabel('环节名称 1', { exact: true }).fill('对照讲解');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('已保存');
  await nav(page, '资源库');
  await page.getByLabel('上传资料', { exact: true }).setInputFiles('apps/web/e2e/fixtures/materials/samples/c22.pptx');
  await expect(page.getByAltText('第 1 页', { exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: '加入备课', exact: true }).click();
  await page.getByLabel('选择备课').selectOption({ label: '新旧课件完整阅读' });
  await page.getByLabel('放入位置').selectOption({ label: '对照讲解' });
  await page.getByRole('button', { name: '确认加入', exact: true }).click();
  await expect(page.locator('.res-usage')).toContainText('新旧课件完整阅读');
  await page.getByLabel('更新文件', { exact: true }).setInputFiles('apps/web/e2e/fixtures/materials/samples/c22.pdf');
  await page.getByRole('button', { name: '确认更新', exact: true }).click();
  await expect(page.locator('.res-file-info strong')).toHaveText('c22.pdf');
  await page.locator('.res-usage').click();
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('新旧课件完整阅读');
  const previewPaths = {};
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: '有更新 · 查看', exact: true }).click();
    for (const [version, name] of [['current', '预览来源当前文件'], ['adopted', '预览本课采用文件']]) {
      const loaded = page.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith('/preview'));
      await page.getByRole('button', { name, exact: true }).click();
      const previewPath = new URL((await loaded).url()).pathname;
      if (previewPaths[version]) expect(previewPath).toBe(previewPaths[version]);
      previewPaths[version] = previewPath;
      await checkPage(page, `${width}-${version}-page1`);
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await expect(page.getByAltText('成品第 2 页', { exact: true })).toBeVisible();
      await checkPage(page, `${width}-${version}-page2`);
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await expect(page.getByAltText('成品第 3 页', { exact: true })).toBeVisible();
      await checkPage(page, `${width}-${version}-page3`);
      await expect(page.getByRole('button', { name: '下一页', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: '上一页', exact: true }).click();
      await page.getByRole('button', { name: '上一页', exact: true }).click();
      await expect(page.getByAltText('成品第 1 页', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '上一页', exact: true })).toBeDisabled();
      await checkPage(page, `${width}-${version}-page1-restored`);
      const image = page.locator('.r34-preview-scroll img');
      const originalWidth = await image.evaluate(img => img.getBoundingClientRect().width);
      await page.getByLabel('预览缩放', { exact: true }).selectOption('75');
      await expect.poll(() => image.evaluate(img => img.getBoundingClientRect().width)).toBeLessThan(originalWidth);
      await checkPage(page, `${width}-${version}-zoom75`);
      await page.getByLabel('预览缩放', { exact: true }).selectOption('150');
      await expect.poll(() => image.evaluate(img => img.getBoundingClientRect().width)).toBeGreaterThan(originalWidth);
      const scroll = page.locator('.r34-preview-scroll');
      await scroll.evaluate(node => { node.scrollLeft = node.scrollWidth; node.scrollTop = node.scrollHeight; });
      expect(await image.evaluate(img => {
        const rect = img.getBoundingClientRect();
        return document.elementFromPoint(rect.right - 5, rect.bottom - 5) === img;
      }), '放大后可以滚动读到页图右下角').toBe(true);
      await page.getByLabel('预览缩放', { exact: true }).selectOption('100');
      await checkPage(page, `${width}-${version}-zoom100`);
      await page.getByRole('button', { name: '关闭预览', exact: true }).click();
      await expect(page.getByRole('dialog', { name: '成品预览', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: '采用更新', exact: true })).toBeVisible();
    }
    expect(previewPaths.current).not.toBe(previewPaths.adopted);
    await page.getByRole('button', { name: '取消', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: '有更新 · 查看', exact: true }).click();
  await page.getByRole('button', { name: '采用更新', exact: true }).click();
  await expect(page.getByRole('button', { name: 'c22.pdf · 预览采用文件', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('已保存');
  await page.reload();
  await expect(page.getByRole('button', { name: 'c22.pdf · 预览采用文件', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '有更新 · 查看', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('环节名称 1', { exact: true })).toHaveValue('对照讲解');
  const reopenedPreview = page.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith('/preview'));
  await page.getByRole('button', { name: 'c22.pdf · 预览采用文件', exact: true }).click();
  expect(new URL((await reopenedPreview).url()).pathname).toBe(previewPaths.current);
  await checkPage(page, '1280-reopened-adopted');
  await page.getByRole('button', { name: '关闭预览', exact: true }).click();
  expect(pageErrors).toEqual([]);
});
