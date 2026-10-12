import fs from 'node:fs';
import path from 'node:path';
import { test, expect, register, removeAccount, signIn, openSettings } from './fixtures/auth-completeness.js';

async function uploadKeys(page, database, storeName = 'pending') {
  return page.evaluate(async ({ database, storeName }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName).getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }, { database, storeName });
}

test('删除账户清除真实题库未确认上传的原文件，并保留其他账户', async ({ page, world }) => {
  const email = 'question-delete@example.test';
  await register(page, world, email);
  const owner = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts').get().accountKey;
  await page.locator('a[href^="/questions"]').first().click();
  await page.locator('.q-finder').getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: /上传图片 截图/ }).click();
  await page.route('**/api/workbench/files', async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByLabel('选择原稿').setInputFiles({ name: '私有题面.png', mimeType: 'image/png',
    buffer: fs.readFileSync(new URL('./fixtures/materials-resources/samples/page.png', import.meta.url)) });
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始整理', exact: true })).toBeEnabled();
  await expect.poll(() => uploadKeys(page, 'teachbuddy.questions.uploads')).toContainEqual(expect.stringMatching(`^${owner}:`));
  await page.evaluate(async owner => {
    for (const [database, storeName] of [['teachbuddy.questions.uploads', 'pending'], ['teachbuddy.math.uploads', 'pending'], ['teachbuddy-resources-pending', 'requests']]) {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put({ file: new Blob(['其他账户资料']) }, 'other-account:original');
        store.put({ file: new Blob(['历史原稿']) }, owner + ':recovery:archive');
        tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error);
      });
      db.close();
    }
    for (const account of [owner, 'other-account']) {
      localStorage.setItem(`teachbuddy.math.${account}`, '数学草稿');
      localStorage.setItem(`teachbuddy:agent:${account}:draft`, '对话草稿');
      localStorage.setItem(`teachbuddy:data-recovery-archive:${account}:old`, '恢复资料');
      localStorage.setItem(`tb.workbench.v1:${account}:draft`, '设备草稿');
    }
  }, owner);
  await page.getByRole('dialog', { name: '从资料收录题目' }).getByRole('button', { name: /关闭/ }).click();
  await removeAccount(page, email);
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
  for (const [database, storeName] of [['teachbuddy.questions.uploads', 'pending'], ['teachbuddy.math.uploads', 'pending'], ['teachbuddy-resources-pending', 'requests']])
    expect(await uploadKeys(page, database, storeName)).toEqual(['other-account:original']);
  expect(await page.evaluate(owner => Object.keys(localStorage).filter(key => key.includes(owner) && !key.startsWith('tb.account.deleted:')), owner)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('tb.workbench.v1:other-account:draft'))).toBe('设备草稿');
});

test('真实删除清理故障后关页重开仍使用原请求完成核实', async ({ page, context, world }, testInfo) => {
  const email = 'close-delete@example.test';
  await register(page, world, email);
  const pageId = world.workbench.db.prepare('SELECT pageId FROM auth_page_bindings').get().pageId;
  const uploaded = await page.request.post(world.origin + '/api/workbench/files', {
    headers: { 'X-TeachBuddy-Page': pageId, 'X-TeachBuddy-Request': '1', Origin: world.origin, 'Idempotency-Key': crypto.randomUUID() },
    multipart: { file: { name: 'cleanup.txt', mimeType: 'text/plain', buffer: Buffer.from('原资料') } },
  });
  expect(uploaded.status()).toBe(201);
  const file = await uploaded.json();
  const blobName = world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.id).blobName;
  const blob = path.join(world.directory, 'files', 'blobs', blobName);
  const bytes = fs.readFileSync(blob); fs.unlinkSync(blob); fs.mkdirSync(blob);
  let original;
  page.on('request', request => { if (request.url().endsWith('/api/auth/account-deletion')) original = request.postDataJSON(); });
  await removeAccount(page, email);
  await expect(page.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('deletion-verification.png') });
  await page.close();
  fs.rmdirSync(blob); fs.writeFileSync(blob, bytes);
  const reopened = await context.newPage();
  await reopened.goto(world.origin);
  await expect(reopened.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
  const repeated = reopened.waitForRequest(request => request.url().endsWith('/api/auth/account-deletion'));
  await reopened.getByRole('button', { name: '重试核实删除', exact: true }).click();
  expect((await repeated).postDataJSON()).toEqual(original);
  await expect(reopened.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
  expect(fs.existsSync(blob)).toBe(false);
});

test('设备清理失败保留核实记录，并可重试完成', async ({ page, world }) => {
  const email = 'device-retry@example.test';
  await register(page, world, email);
  await page.evaluate(() => {
    window.originalRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      if (key.startsWith('teachbuddy.math.')) throw new Error('设备清理拒绝');
      return window.originalRemove.call(this, key);
    };
  });
  await removeAccount(page, email);
  await expect(page.getByRole('button', { name: '重试清理本设备', exact: true })).toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('teachbuddy:account-deletion:v1:')).length)).toBe(1);
  await page.evaluate(() => { Storage.prototype.removeItem = window.originalRemove; delete window.originalRemove; });
  await page.getByRole('button', { name: '重试清理本设备', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('teachbuddy:account-deletion:v1:')))).toEqual([]);
});

test('稍后核实保留A删除记录，B正常登录与刷新后不被A锁定', async ({ page, browser, world }) => {
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
  try { await register(await otherContext.newPage(), world, 'delete-other@example.test'); }
  finally { await otherContext.close(); }
  await register(page, world, 'delete-pending@example.test');
  await page.route('**/api/auth/account-deletion', route => route.abort('failed'));
  await removeAccount(page, 'delete-pending@example.test');
  await expect(page.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '稍后核实，登录其他账户', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await signIn(page, 'delete-other@example.test');
  const tutorial = page.getByRole('button', { name: '知道了', exact: true });
  if (await tutorial.isVisible()) await tutorial.click();
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('teachbuddy:account-deletion:v1:')).length)).toBe(1);
  await openSettings(page);
  await page.getByRole('button', { name: '继续核实账户删除', exact: true }).click();
  await expect(page.getByText('delete-pending@example.test', { exact: true })).toBeVisible();
});

test('另一标签页已开始读取的题库原稿不能在删除后重新写回设备', async ({ page, context, world }) => {
  await register(page, world, 'late-device@example.test');
  const other = await context.newPage();
  await other.goto(world.origin);
  await expect(other.locator('.wb-shell')).toBeVisible();
  await other.locator('a[href^="/questions"]').first().click();
  await other.locator('.q-finder').getByRole('button', { name: '从资料收录', exact: true }).click();
  await other.getByRole('button', { name: /上传图片 截图/ }).click();
  await other.getByLabel('选择原稿').setInputFiles({ name: '迟到题面.png', mimeType: 'image/png',
    buffer: fs.readFileSync(new URL('./fixtures/materials-resources/samples/page.png', import.meta.url)) });
  await other.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function() {
      File.prototype.arrayBuffer = original;
      window.fileReadStarted = true;
      await new Promise(resolve => { window.releaseFileRead = resolve; });
      return original.call(this);
    };
  });
  await other.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect.poll(() => other.evaluate(() => window.fileReadStarted)).toBe(true);
  await removeAccount(page, 'late-device@example.test');
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await other.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      const value = original.call(this, key);
      if (key.startsWith('tb.account.deleted:') && value === '1') window.deletedAccountWriteChecked = true;
      return value;
    };
    window.releaseFileRead();
  });
  await expect.poll(() => other.evaluate(() => window.deletedAccountWriteChecked)).toBe(true);
  await expect.poll(() => uploadKeys(page, 'teachbuddy.questions.uploads')).toEqual([]);
  expect(world.workbench.db.prepare('SELECT count(*) n FROM materials_files').get().n).toBe(0);
});
