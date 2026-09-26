import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, doc } from '../../api/test/teaching-time-classes-materials-fixture.js';

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

test('MF-UI-01 更新对照新旧文件完整阅读及采用保存', async ({ page }) => {
  test.setTimeout(180000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  world = await createIntegration();
  const { client } = await registerMath(world, 'preview-regression@example.test');
  const call = http(client);
  async function upload(name, mime) {
    const boundary = `preview-${crypto.randomUUID()}`;
    const result = await client.request('POST', '/api/workbench/files', { headers: { 'Idempotency-Key': crypto.randomUUID() }, contentType: `multipart/form-data; boundary=${boundary}`, rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`), fs.readFileSync(`apps/web/e2e/fixtures/materials/samples/${name}`), Buffer.from(`\r\n--${boundary}--\r\n`)]) });
    expect(result.status).toBe(201); return result.json;
  }
  const oldFile = await upload('c22.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  const resource = await call('POST', '/api/modules/resources/items', { title: '对照课件', fileId: oldFile.id, folderId: null, tagIds: [], note: '' }, 201);
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '新旧课件完整阅读', intro: doc('比较两份课堂资料'), sections: [{ id: crypto.randomUUID(), title: '对照讲解', content: doc('检查完整页面'), references: [{ id: crypto.randomUUID(), kind: 'resource', resourceId: resource.id, resourceVersion: resource.version, note: '' }] }], materials: [] }, 201);
  const newFile = await upload('c22.pdf', 'application/pdf');
  await call('PUT', `/api/modules/resources/items/${resource.id}/file`, { baseVersion: resource.version, fileId: newFile.id });
  await page.goto(`${world.origin}/lessons/${lesson.id}`);
  await page.getByLabel('邮箱', { exact: true }).fill('preview-regression@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '新旧课件完整阅读', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('button', { name: '编辑备课', exact: true }).click();
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
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
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
