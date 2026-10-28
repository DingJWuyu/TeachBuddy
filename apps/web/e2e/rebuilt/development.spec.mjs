import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { startServer } from '../../../api/src/server.js';
import { createClock, createMailer, generateSelfSignedCertificate } from '../../../api/test/fixtures/auth-contract/harness.js';
import { register, navigate, createQuestion } from './fixture.mjs';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

test('D16 开发服务：真实Vite与StrictMode注册、资源上传往返、题目保存刷新读回', async ({ page }, info) => {
  const directory = info.outputPath('application');
  await fs.mkdir(directory, { recursive: true });
  generateSelfSignedCertificate(directory);
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const mailer = createMailer(), clock = createClock();
  const server = await startServer({ dev: true,
    env: { nodeEnv: 'test', port, sqlitePath: path.join(directory, 'workspace.sqlite'), authCodeSecret: 'isolated-development-test-secret', registrationOpen: true,
      agent: { apiKey: '', baseUrl: 'http://127.0.0.1:1' }, smtpHost: '', smtpUser: '', smtpPassword: '', smtpFrom: '',
      workbench: { mode: 'none', publicOrigin: `https://localhost:${port}`, webDist: null,
        filesDir: path.join(directory, 'files'), logDir: path.join(directory, 'logs'), recognition: { home: null },
        tls: { cert: path.join(directory, 'tls-cert.pem'), key: path.join(directory, 'tls-key.pem') } } },
    sendCode: mailer.sendCode, now: clock.now, workbenchClock: () => new Date(clock.now()),
    workbenchLogger: { info() {}, request() {}, error() {} }
  });
  const errors = [], resources = [];
  let passed = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (pathname === '/@vite/client' || pathname === '/src/main.jsx') resources.push({ pathname, status: response.status() });
  });
  try {
    await register(page, { origin: server.origin, mailer }, 'development@example.test');
    expect(resources).toEqual(expect.arrayContaining([{ pathname: '/@vite/client', status: 200 }, { pathname: '/src/main.jsx', status: 200 }]));
    const main = await page.request.get(server.origin + '/src/main.jsx');
    expect(await main.text(), '浏览器实际获取Vite转换的StrictMode入口').toContain('StrictMode');
    await navigate(page, '/resources');
    await expect(page.getByRole('button', { name: '上传资料', exact: true }).first(), 'StrictMode重新挂载后资源上传入口必须可操作').toBeEnabled();
    await page.getByLabel('上传资料', { exact: true }).setInputFiles({ name: '开发入口讲义.png', mimeType: 'image/png', buffer: sourceImage('I-1') });
    await expect(page.getByText('文件已保存', { exact: false })).toBeVisible();
    await page.getByText('开发入口讲义.png', { exact: true }).first().click();
    await expect(page.getByRole('textbox', { name: '资源名称', exact: true })).toHaveValue('开发入口讲义.png');
    await navigate(page, '/questions');
    await navigate(page, '/resources');
    await expect(page.getByRole('textbox', { name: '资源名称', exact: true })).toHaveValue('开发入口讲义.png');
    await expect(page.getByRole('button', { name: '下载原件', exact: true })).toBeVisible();
    await createQuestion(page, '开发入口保存题', '计算 12+30。');
    await page.reload();
    await expect(page.getByRole('heading', { name: '开发入口保存题', exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: '题干', exact: true })).toHaveText('计算 12+30。');
    await expect(page.locator('.q-list').getByText('开发入口保存题', { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors, '开发主路径不应出现浏览器运行异常').toEqual([]);
    const evidence = info.outputPath('development-entry.json');
    await fs.writeFile(evidence, JSON.stringify({ resources, strictMode: true }, null, 2));
    await info.attach('development-entry', { path: evidence, contentType: 'application/json' });
    await page.screenshot({ animations: 'disabled', path: info.outputPath('development-question.png') });
    passed = true;
  } catch (error) {
    await page.screenshot({ animations: 'disabled', path: info.outputPath('development-failure.png') });
    throw error;
  } finally {
    await page.close();
    await server.close();
    if (passed) await fs.rm(directory, { recursive: true, force: true });
  }
});
