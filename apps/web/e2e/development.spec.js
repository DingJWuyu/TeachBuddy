import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import { startServer } from '../../api/src/server.js';
import { createClient, createMailer, generateSelfSignedCertificate } from '../../api/test/fixtures/auth-contract/harness.js';
import { registerMath } from '../../api/test/fixtures/math-real.mjs';

let world, directory, failed = false;
test.beforeAll(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'teachbuddy-dev-e2e-'));
  generateSelfSignedCertificate(directory);
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const mailer = createMailer();
  world = await startServer({
    dev: true,
    env: {
      nodeEnv: 'development', port, sqlitePath: path.join(directory, 'workspace.sqlite'),
      authCodeSecret: 'isolated-development-e2e',
      workbench: {
        publicOrigin: `https://localhost:${port}`, filesDir: path.join(directory, 'files'),
        tls: { cert: path.join(directory, 'tls-cert.pem'), key: path.join(directory, 'tls-key.pem') },
      },
    },
    sendCode: mailer.sendCode,
  });
  world.mailer = mailer;
  world.client = () => createClient(world.origin, { transport: https });
});
test.afterEach(async ({}, info) => { failed ||= info.status !== info.expectedStatus; });
test.afterAll(async () => {
  await world?.close();
  if (directory && !failed && world) fs.rmSync(directory, { recursive: true });
  else if (directory) console.log('保留测试现场：' + directory);
});
test.beforeEach(async ({ page }) => {
  const email = `development-${crypto.randomUUID()}@example.test`;
  await registerMath(world, email);
  await page.goto(world.origin);
  await expect(page.locator('script[src="/@vite/client"]')).toHaveCount(1);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('navigation', { name: '功能模块' })).toBeVisible();
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
});

test('开发模式资源上传、PDF 中文文字层与重新进入页面', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const modules = page.getByRole('navigation', { name: '功能模块' });
  await modules.getByRole('link', { name: /^资源库/ }).click();
  await expect(page.locator('.tbx-res-main')).toHaveAttribute('aria-busy', 'false');
  const upload = page.getByLabel('上传资料', { exact: true });
  await expect(upload).toBeEnabled();
  await upload.setInputFiles(
    path.resolve('test/fixtures/materials/c22.pdf'),
  );
  await expect(page.locator('.res-status')).toContainText('文件已保存');
  await expect(page.locator('.res-detail')).toHaveCount(0);
  await page.locator('.tbx-res-open').filter({ hasText: 'c22.pdf' }).click();
  await expect(page.getByAltText('第 1 页', { exact: true })).toBeVisible();
  await expect.poll(() => page.getByAltText('第 1 页', { exact: true }).evaluate(img => img.naturalWidth)).toBeGreaterThan(100);
  await expect(page.locator('.res-pdf-text')).toContainText('二次函数');
  await modules.getByRole('link', { name: /^题库/ }).click();
  await modules.getByRole('link', { name: /^资源库/ }).click();
  await expect(page.locator('.res-pdf-text')).toContainText('二次函数');
  await page.reload();
  await expect(page.locator('.res-pdf-text')).toContainText('二次函数');
  await page.screenshot({ path: info.outputPath('development-pdf.png') });
  expect(errors).toEqual([]);
});

test('开发模式题库加载、手动录题保存与刷新', async ({ page }) => {
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
  await expect(page.getByText('正在读取题库…', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '新建题目', exact: true }).first().click();
  await page.getByLabel('题目标题').fill('开发模式保存验证');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).pressSequentially('已知 $x^2=9$，求实数 $x$ 的值。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '开发模式保存验证', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '开发模式保存验证', exact: true })).toBeVisible();
  await expect(page.locator('.q-reading-body .katex').first()).toBeVisible();
});
