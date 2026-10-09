import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';

// Real-auth/fake-mail and the real official GeoGebra CDN; no AI/model calls.
let world;
let activePage;
test.beforeEach(async ({ page }, info) => {
  activePage = page;
  world = await createIntegration();
  await register(page, world, `ggb-${info.testId.replace(/[^a-z0-9]/gi, '')}@example.test`);
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
  await module(page, '数学工坊');
  await page.getByRole('button', { name: '新建GeoGebra 数学画布', exact: true }).click();
  await ready(page);
});
test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus && activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: info.outputPath('failure.png') });
    await info.attach('isolated-world', { body: world.directory, contentType: 'text/plain' });
  }
  if (world) {
    await world.close();
    if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
    world = null;
  }
});
async function module(page, name) {
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: new RegExp(`^${name}`) }).click();
}
async function ready(page) {
  await expect(page.locator('.math-geogebra-credit')).toBeVisible({ timeout: 90000 });
}
async function enter(page, expression, name) {
  const activeInput = page.getByLabel(/^在此处输入方程或代数式/);
  if (await activeInput.count()) await page.locator('.math-geogebra').getByRole('treeitem').filter({ has: activeInput }).click();
  else await page.getByText(/^输入/).first().click();
  await page.keyboard.type(expression);
  await page.keyboard.press('Enter');
  // Mechanism probe observes the result; all mutations use native UI controls.
  await page.waitForFunction(name => {
    const id = document.querySelector('[data-param-id]')?.getAttribute('data-param-id');
    return id && window[id]?.exists(name);
  }, name);
}
async function coordinates(page, name) {
  return page.evaluate(name => {
    const api = window[document.querySelector('[data-param-id]').getAttribute('data-param-id')];
    return [api.getXcoord(name), api.getYcoord(name)];
  }, name);
}
async function save(page, status = 200) {
  const pending = page.waitForResponse(response => response.url().includes('/api/modules/math/v1/works') && ['POST', 'PUT'].includes(response.request().method()));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const response = await pending;
  expect(response.status(), await response.text()).toBe(status);
  if (status !== 409) await expect(page.locator('.math-ggb-status')).toContainText('已保存');
  return response;
}
async function advanceServer(page, saved, pageHeader) {
  const response = await page.request.put(`${world.origin}/api/modules/math/v1/works/${saved.id}`, {
    headers: { 'X-TeachBuddy-Page': pageHeader, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': crypto.randomUUID(), Origin: world.origin },
    data: { baseVersion: saved.version, title: saved.title, source: saved.source },
  });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

test('即时返回、切模块、刷新和正常关闭保留原生画布，已保存稿保持保存状态', async ({ page, context }, info) => {
  await enter(page, 'A=(2,3)', 'A');
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.getByRole('button', { name: '继续制作', exact: true }).click();
  await ready(page);
  expect(await coordinates(page, 'A')).toEqual([2, 3]);

  await enter(page, 'B=(5,7)', 'B');
  await module(page, '资源库');
  await module(page, '数学工坊');
  await ready(page);
  expect(await coordinates(page, 'B')).toEqual([5, 7]);

  await enter(page, 'C=(9,10)', 'C');
  await page.reload();
  await ready(page);
  expect(await coordinates(page, 'B')).toEqual([5, 7]);
  expect(await coordinates(page, 'C')).toEqual([9, 10]);

  await enter(page, 'D=(11,12)', 'D');
  const address = page.url();
  const closed = page.waitForEvent('close');
  await page.close({ runBeforeUnload: true });
  await closed;
  page = await context.newPage();
  activePage = page;
  await page.goto(address);
  await ready(page);
  expect(await coordinates(page, 'D')).toEqual([11, 12]);

  await save(page, 201);
  await module(page, '资源库');
  await module(page, '数学工坊');
  await ready(page);
  await expect(page.locator('.math-ggb-status')).toContainText('已保存');
  expect(await coordinates(page, 'A')).toEqual([2, 3]);
  expect(await coordinates(page, 'D')).toEqual([11, 12]);

  await enter(page, 'a=Slider(-100,100,0.1)', 'a');
  await page.locator('.math-geogebra').getByRole('button', { name: '播放', exact: true }).click();
  const animationResponse = await save(page);
  const animatedSaved = await animationResponse.json();
  const numericValue = async base64 => {
    const xml = await (await JSZip.loadAsync(base64, { base64: true })).file('geogebra.xml').async('string');
    const match = xml.match(/<element type="numeric" label="a">[\s\S]*?<value val="([^"]+)"/);
    expect(match).toBeTruthy();
    return Number(match[1]);
  };
  const savedValue = await numericValue(animatedSaved.source.base64);
  // Observe native playback without another pointer gesture in the canvas.
  await expect.poll(() => page.evaluate(() => {
    const api = window[document.querySelector('[data-param-id]').getAttribute('data-param-id')];
    return api.getValue('a');
  })).not.toBe(savedValue);
  await module(page, '资源库');
  const deviceSource = await page.evaluate(id => Object.entries(localStorage)
    .filter(([key]) => key.endsWith(':math-workspace'))
    .map(([, value]) => JSON.parse(value))
    .find(value => value.draft?.id === id)?.draft.source.base64, animatedSaved.id);
  const capturedValue = await numericValue(deviceSource);
  expect(capturedValue).not.toBe(savedValue);
  fs.writeFileSync(info.outputPath('animation-after-save.json'), JSON.stringify({ savedValue, capturedValue, nativePlayback: true, newCanvasGestureAfterSave: false }, null, 2));
});

test('409 后可保留本地稿提交新版本、确认读取服务器或另存作品', async ({ page }) => {
  await enter(page, 'A=(2,3)', 'A');
  const firstResponse = await save(page, 201);
  const first = await firstResponse.json();
  const header = firstResponse.request().headers()['x-teachbuddy-page'];
  const second = await advanceServer(page, first, header);
  await enter(page, 'A=(8,9)', 'A');
  await save(page, 409);
  await page.getByRole('button', { name: '以服务器版本为基线保留本地稿', exact: true }).click();
  const thirdResponse = await save(page);
  const third = await thirdResponse.json();
  expect(third.id).toBe(first.id);
  expect(third.version).toBe(second.version + 1);
  expect(await coordinates(page, 'A')).toEqual([8, 9]);

  await advanceServer(page, third, header);
  await enter(page, 'A=(10,11)', 'A');
  await save(page, 409);
  await page.getByRole('button', { name: '读取服务器作品', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  expect(await coordinates(page, 'A')).toEqual([10, 11]);
  await page.getByRole('button', { name: '读取服务器作品', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '继续', exact: true }).click();
  await ready(page);
  await expect(page.locator('.math-ggb-status')).toContainText('已保存');
  expect(await coordinates(page, 'A')).toEqual([8, 9]);

  const currentResponse = await save(page);
  const current = await currentResponse.json();
  const currentHeader = currentResponse.request().headers()['x-teachbuddy-page'];
  const remote = await advanceServer(page, current, currentHeader);
  await enter(page, 'A=(11,12)', 'A');
  await save(page, 409);
  const copyPending = page.waitForResponse(response => response.url().endsWith('/works') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '另存作品', exact: true }).click();
  const copyResponse = await copyPending;
  expect(copyResponse.status(), await copyResponse.text()).toBe(201);
  const copied = await copyResponse.json();
  expect(copied.id).not.toBe(first.id);
  await expect(page.locator('.math-ggb-status')).toContainText('已保存');
  expect(await coordinates(page, 'A')).toEqual([11, 12]);
  const original = await page.request.get(`${world.origin}/api/modules/math/v1/works/${first.id}`, { headers: { 'X-TeachBuddy-Page': currentHeader } });
  expect(original.status()).toBe(200);
  expect((await original.json()).version).toBe(remote.version);
});
