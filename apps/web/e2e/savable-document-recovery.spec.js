import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, headers } from './teaching-time-auth/helpers.mjs';
import { C, R, record } from '../../api/test/teaching-time-classes-materials-fixture.js';
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
async function adopt(page, region = page) {
  await region.getByRole('button', { name: '查看服务器版本', exact: true }).click();
  await region.getByRole('button', { name: '采用服务器版本', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '采用服务器版本', exact: true }).click();
  await expect(region.locator('[data-region="conflict"]')).toHaveCount(0);
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

test('共享保存：新备课请求确认后迁移草稿，刷新和冲突仍保留后续输入', async ({ page }) => {
  await page.goto(world.origin + '/lessons/new');
  await page.getByRole('textbox', { name: '课题', exact: true }).fill('首次备课');
  const writes = []; let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/modules/lessons/v3', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    writes.push(route.request().postDataJSON());
    const response = await route.fetch(); await gate; await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  await page.getByRole('textbox', { name: '课题', exact: true }).fill('保存期间的新课题');
  release();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  const path = '/api/modules/lessons/v3/' + page.url().split('/').at(-1);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '课题', exact: true })).toHaveValue('保存期间的新课题');
  const current = await call(page, 'GET', path);
  expect(current.title).toBe('首次备课');
  const remote = await call(page, 'PUT', path, { ...writes[0], title: '远端课题', baseVersion: current.version });
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  for (let n = 0; n < 2; n++) {
    await expect(page.locator('[data-region="conflict"]')).toBeVisible(); await page.reload();
  }
  await expect(page.getByRole('textbox', { name: '课题', exact: true })).toHaveValue('保存期间的新课题');
  await adopt(page);
  await expect(page.getByRole('textbox', { name: '课题', exact: true })).toHaveValue('远端课题');
  expect(await call(page, 'GET', path)).toEqual(remote);
});

test('共享保存：课堂记录丢响应同键确认，冲突刷新保留记录草稿', async ({ page }) => {
  const cls = await call(page, 'POST', C, { name: '保存回归班' }, 201);
  const input = record(cls.id, [], '课堂原文');
  const saved = await call(page, 'POST', R, input, 201), path = `${R}/${saved.id}`;
  await page.goto(world.origin + `/classes/${cls.id}/records/${saved.id}`);
  const editor = page.locator('[data-region="record-editor"]');
  const writes = []; let lose = true;
  await page.route('**' + path, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (lose) { lose = false; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await editor.getByLabel('编辑记录内容').fill('已提交未确认记录');
  await editor.getByRole('button', { name: '保存修改', exact: true }).click();
  await editor.getByRole('button', { name: '重试确认', exact: true }).waitFor();
  await editor.getByLabel('编辑记录内容').fill('本机后续记录');
  const current = await call(page, 'GET', path);
  const remote = await call(page, 'PUT', path, { ...input, note: '远端课堂记录', expectedVersion: current.version });
  await editor.getByRole('button', { name: '重试确认', exact: true }).click();
  expect(writes[1]).toEqual(writes[0]);
  for (let n = 0; n < 2; n++) {
    await expect(editor.locator('[data-region="conflict"]')).toBeVisible(); await page.reload();
  }
  await expect(editor.getByLabel('编辑记录内容')).toHaveValue('本机后续记录');
  await adopt(page, editor);
  await expect(editor.getByLabel('编辑记录内容')).toHaveValue('远端课堂记录');
  expect(await call(page, 'GET', path)).toEqual(remote);
});

for (const lostResponse of [false, true]) test(`共享保存：备课归档和恢复${lostResponse ? '丢回执刷新确认' : '成功'}后保留未保存草稿及正确入口`, async ({ page }, info) => {
  await page.goto(world.origin + '/lessons/new');
  await page.getByLabel('课题', { exact: true }).fill('归档基线课题');
  await page.getByLabel('开头文稿段落 1', { exact: true }).fill('服务器已保存正文');
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  const id = page.url().split('/').at(-1), path = '/api/modules/lessons/v3/' + id;
  await page.getByLabel('课题', { exact: true }).fill('归档后继续的草稿课题');
  await page.getByLabel('开头文稿段落 1', { exact: true }).fill('不能被归档或恢复丢弃的正文草稿');
  const snapshots = [], requests = [], lost = new Set();
  async function snapshot(stage) {
    const draft = await page.evaluate(id => {
      const pointer = Object.keys(sessionStorage).find(key => key.includes(':continue:') && key.endsWith(`:draft:lesson:${id}`));
      return pointer ? JSON.parse(localStorage.getItem(sessionStorage.getItem(pointer)))?.value : null;
    }, id);
    snapshots.push({ stage, draft, server: await call(page, 'GET', path) });
  }
  if (lostResponse) await page.route('**' + path + '/deletion', async route => {
    const body = route.request().postDataJSON();
    requests.push({ key: route.request().headers()['idempotency-key'], body });
    const response = await route.fetch(); expect(response.status()).toBe(200);
    if (!lost.has(body.deleted)) { lost.add(body.deleted); await route.abort('failed'); }
    else await route.fulfill({ response });
  });
  async function confirmLost(stage) {
    if (!lostResponse) return;
    await expect(page.locator('[data-region="lesson-delete-problem"]').getByRole('button', { name: '重试确认', exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.locator('[data-region="lesson-delete-problem"]').getByRole('button', { name: '重试确认', exact: true })).toBeEnabled();
    await snapshot(stage + '-before-confirm');
    await page.locator('[data-region="lesson-delete-problem"]').getByRole('button', { name: '重试确认', exact: true }).click();
  }
  try {
    await snapshot('before-archive');
    await page.getByRole('button', { name: '备课操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '归档备课', exact: true }).click();
    await page.getByRole('dialog', { name: '归档备课', exact: true }).getByRole('button', { name: '归档备课', exact: true }).click();
    await confirmLost('archive');
    await expect(page).toHaveURL(/\/lessons$/);
    await snapshot('archived');
    const archived = snapshots.at(-1).server;
    expect(archived.deletedAt).toBeTruthy(); expect(archived.version).toBe(2);
    expect(archived.title).toBe('归档基线课题');
    await page.getByRole('button', { name: '备课列表选项', exact: true }).click();
    await page.getByRole('menuitem', { name: '查看已归档备课', exact: true }).click();
    await page.getByRole('button', { name: /^归档基线课题/ }).click();
    await expect(page.getByRole('heading', { name: '归档基线课题', exact: true })).toBeVisible();
    await snapshot('archived-reopened');
    await page.screenshot({ path: info.outputPath('archived.png'), animations: 'disabled' });
    await expect(page.locator('[data-region="lesson-archived"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '彻底删除', exact: true })).toBeVisible();
    await expect(page.locator('[data-region="conflict"]')).toHaveCount(0);
    await expect(page.locator('.wb-lesson textarea')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: '恢复备课', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '恢复备课', exact: true }).click();
    await confirmLost('restore');
    await expect(page).toHaveURL(/\/lessons$/);
    await snapshot('restored');
    expect(snapshots.at(-1).server.deletedAt).toBeNull();
    expect(snapshots.at(-1).server.version).toBe(3);
    await page.getByRole('button', { name: /^归档基线课题/ }).click();
    await page.getByRole('button', { name: '继续编辑草稿', exact: true }).first().click();
    await expect(page.getByLabel('课题', { exact: true })).toHaveValue('归档后继续的草稿课题');
    await expect(page.getByLabel('开头文稿段落 1', { exact: true })).toHaveValue('不能被归档或恢复丢弃的正文草稿');
    await expect(page.locator('[data-region="conflict"]')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('课题', { exact: true })).toHaveValue('归档后继续的草稿课题');
    await page.getByRole('button', { name: '保存备课', exact: true }).click();
    await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', 'saved');
    const saved = await call(page, 'GET', path);
    expect(saved.version).toBe(4); expect(saved.title).toBe('归档后继续的草稿课题');
    expect(JSON.stringify(saved.intro)).toContain('不能被归档或恢复丢弃的正文草稿');
    if (lostResponse) {
      expect(requests).toHaveLength(4);
      expect(requests[1]).toEqual(requests[0]); expect(requests[3]).toEqual(requests[2]);
      expect(requests[2].key).not.toBe(requests[0].key);
    }
  } finally {
    fs.writeFileSync(info.outputPath('archive-snapshots.json'), JSON.stringify(snapshots, null, 2));
  }
});

test('共享保存：归档与恢复不会解除已有的课稿内容冲突', async ({ page }, info) => {
  await page.goto(world.origin + '/lessons/new');
  await page.getByLabel('课题', { exact: true }).fill('原始课题');
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  const path = '/api/modules/lessons/v3/' + page.url().split('/').at(-1);
  await page.getByLabel('课题', { exact: true }).fill('本机冲突课题');
  const saved = await call(page, 'GET', path);
  const remote = await call(page, 'PUT', path, { baseVersion: saved.version, title: '远端已改课题',
    intro: saved.intro, sections: saved.sections, materials: saved.materials });
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await page.getByRole('button', { name: '查看服务器版本', exact: true }).click();
  await expect(page.locator('[data-region="server-version"]')).toContainText('远端已改课题');
  await page.getByRole('button', { name: '备课操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档备课', exact: true }).click();
  await page.getByRole('dialog', { name: '归档备课', exact: true }).getByRole('button', { name: '归档备课', exact: true }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await page.getByRole('button', { name: '备课列表选项', exact: true }).click();
  await page.getByRole('menuitem', { name: '查看已归档备课', exact: true }).click();
  await page.getByRole('button', { name: /^远端已改课题/ }).click();
  await expect(page.locator('[data-region="lesson-archived"]')).toBeVisible();
  await page.getByRole('button', { name: '恢复备课', exact: true }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await page.getByRole('button', { name: /^远端已改课题/ }).click();
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await page.getByRole('button', { name: '继续编辑草稿', exact: true }).first().click();
  for (let n = 0; n < 2; n++) {
    await page.reload();
    await expect(page.getByLabel('课题', { exact: true })).toHaveValue('本机冲突课题');
    await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  }
  const current = await call(page, 'GET', path);
  expect(current.version).toBe(remote.version + 2);
  expect(current.deletedAt).toBeNull(); expect(current.title).toBe(remote.title);
  expect(current.intro).toEqual(remote.intro);
  await page.screenshot({ path: info.outputPath('content-conflict-preserved.png'), animations: 'disabled' });
});
