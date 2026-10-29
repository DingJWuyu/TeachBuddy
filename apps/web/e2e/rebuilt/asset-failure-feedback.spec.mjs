import { chromium } from '@playwright/test';
import { test, expect, register, navigate } from './fixture.mjs';
import { json, finished } from '../../../api/test/rebuilt-outputs/helpers.js';
import { question, questions } from '../../../api/test/rebuilt/helpers.js';

test('题面生成对运行失败允许重新生成，对坏公式明确提示修改', async ({ page, world }, info) => {
  await register(page, world);
  const observed = page.waitForRequest(request => new URL(request.url()).pathname === '/api/modules/questions/v2/items');
  await navigate(page, '/questions');
  const client = world.client();
  client.pageId = (await observed).headers()['x-teachbuddy-page'];
  for (const cookie of await page.context().cookies()) client.jar.set(cookie.name, cookie.value);
  await json(client, 'POST', questions, question({ title: '运行失败恢复题' }), 201);
  await json(client, 'POST', questions, question({ title: '公式需要修改题', body: { version: 2, blocks: [{ type: 'math', latex: '\\unknownProbeCommand{x}' }] } }), 201);
  await navigate(page, '/resources');
  await navigate(page, '/questions');
  await page.getByText('运行失败恢复题', { exact: true }).click();
  await page.getByRole('button', { name: '复制文字或下载图片', exact: true }).click();
  const generate = page.getByRole('button', { name: '生成题面图片', exact: true });
  const launch = chromium.launch;
  chromium.launch = async () => { throw Error('/private/path secret'); };
  try {
    await generate.click();
    await expect(page.getByText('生成未完成，可重新生成', { exact: true })).toBeVisible();
    await expect(generate).toBeEnabled();
  } finally { chromium.launch = launch; }
  const accepted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/assets'));
  await generate.click();
  const job = await (await accepted).json();
  expect((await finished(client, job.id)).state).toBe('succeeded');
  await page.getByRole('button', { name: '刷新生成结果', exact: true }).click();
  await expect(page.getByText('素材已生成', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('asset-runtime-recovered.png'), animations: 'disabled' });
  await navigate(page, '/resources');
  await navigate(page, '/questions');
  await page.getByText('公式需要修改题', { exact: true }).click();
  await page.getByRole('button', { name: '复制文字或下载图片', exact: true }).click();
  await page.getByRole('button', { name: '生成题面图片', exact: true }).click();
  await expect(page.getByText('公式无法排版，请修改后重新生成。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '生成题面图片', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('asset-formula-feedback.png'), animations: 'disabled' });
});
