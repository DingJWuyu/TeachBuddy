import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, headers } from './teaching-time-auth/helpers.mjs';
let world;
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  await register(page, world);
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
  else fs.writeFileSync(info.outputPath('fixture-directory.txt'), world.directory);
});
async function call(page, method, path, data, status = 200) {
  const response = await page.request.fetch(world.origin + path, { method, data,
    headers: { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() } });
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}
test('共享保存：账户外观丢响应后保留后续选择，冲突刷新后采用远端', async ({ page }) => {
  const path = '/api/reliability/v1/preferences', writes = [];
  await page.goto(world.origin + '/settings');
  let lose = true;
  await page.route('**' + path, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (lose) { lose = false; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试保存', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '圆形', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '确认上次保存', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[2].key).not.toBe(writes[0].key);
  const saved = await call(page, 'GET', path);
  expect(saved.values.theme).toBe('dark'); expect(saved.values.background).toBe('circles');
  const remote = await call(page, 'PUT', path, { baseVersion: saved.version, values: { ...saved.values, theme: 'light' } });
  await page.getByRole('button', { name: '羊皮纸', exact: true }).click();
  for (let n = 0; n < 3; n++) {
    await expect(page.getByText('设置已在其他页面更新。', { exact: false })).toBeVisible();
    await page.reload();
  }
  await page.getByRole('button', { name: '使用已保存设置', exact: true }).click();
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  expect(await call(page, 'GET', path)).toEqual(remote);
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'light');
});
