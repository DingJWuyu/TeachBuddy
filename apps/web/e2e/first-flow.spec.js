import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, login, logout, headers } from './teaching-time-auth/helpers.mjs';
import { loseCommittedResponses } from './first-flow/faults.js';

let world;
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  await register(page, world);
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
  await page.goto(world.origin + '/questions');
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
  else if (world) fs.writeFileSync(info.outputPath('fixture-directory.txt'), world.directory);
});
async function createQuestion(page, title = '真实保存的函数题', body = '求函数 $f(x)=x^2$ 的最小值。') {
  await page.locator('.q-finder').getByRole('button', { name: '新建题目', exact: true }).click();
  await page.getByLabel('题目标题', { exact: true }).fill(title);
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill(body);
}
async function save(page, title) {
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}
async function items(page) {
  const response = await page.request.get(world.origin + '/api/modules/questions/v2/items', { headers: headers(page) });
  expect(response.status()).toBe(200);
  return (await response.json()).items;
}

test('真实录题与复制改编：刷新、跨模块返回和服务重启后读回独立题目', async ({ page }, info) => {
  await createQuestion(page);
  await save(page, '真实保存的函数题');
  const [original] = await items(page);
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  await page.getByLabel('题目标题', { exact: true }).fill('改编后的函数题');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('求函数 $f(x)=x^2+3$ 的最小值。');
  await save(page, '改编后的函数题');
  const copied = (await items(page)).find(item => item.id !== original.id);
  expect(copied.source.questionId).toBe(original.id);
  expect(copied.body).not.toEqual(original.body);
  await page.goto(world.origin + '/resources');
  await page.goto(world.origin + '/questions/' + copied.id);
  await page.reload();
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('求函数 $f(x)=x^2+3$ 的最小值。');
  const { directory, origin } = world;
  await world.close();
  world = await createIntegration({ directory, port: Number(new URL(origin).port) });
  await page.reload();
  await expect(page.getByLabel('题目标题', { exact: true })).toHaveValue('改编后的函数题');
  expect((await items(page)).find(item => item.id === original.id).body).toEqual(original.body);
  await page.screenshot({ path: info.outputPath('first-flow-reopened.png'), animations: 'disabled' });
});

test('录题丢响应后刷新确认同一请求，只保存一份真实题目', async ({ page }) => {
  await createQuestion(page, '待确认题目');
  const writes = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/modules/questions/v2/items')
      writes.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
  });
  const fault = await loseCommittedResponses(page, '**/api/modules/questions/v2/items');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认上次请求', exact: true })).toBeVisible();
  expect(fault.dropped()).toBeGreaterThan(0);
  expect(await items(page)).toHaveLength(1);
  await fault.clear();
  await page.reload();
  await page.getByRole('button', { name: '确认上次请求', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认上次请求', exact: true })).toHaveCount(0);
  expect(await items(page)).toHaveLength(1);
  expect(writes.length).toBeGreaterThanOrEqual(2);
  expect(writes.every(write => JSON.stringify(write) === JSON.stringify(writes[0]))).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '待确认题目', exact: true })).toBeVisible();
});

test('真实账户切换隔离题目和本地草稿，返回原账户继续输入', async ({ page }) => {
  await createQuestion(page, '甲的私人题目');
  await save(page, '甲的私人题目');
  await createQuestion(page, '甲的未保存草稿', '甲未上传的输入');
  await logout(page);
  await register(page, world, 'teacher-b@example.test');
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
  await page.goto(world.origin + '/questions');
  expect(await items(page)).toEqual([]);
  await expect(page.getByRole('button', { name: '继续未完成的题目', exact: true })).toHaveCount(0);
  await expect(page.getByText('甲的私人题目', { exact: true })).toHaveCount(0);
  await logout(page);
  await login(page);
  await page.goto(world.origin + '/questions');
  await expect(page.getByLabel('题目标题', { exact: true })).toHaveValue('甲的未保存草稿');
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('甲未上传的输入');
  expect((await items(page)).map(item => item.title)).toEqual(['甲的私人题目']);
});
