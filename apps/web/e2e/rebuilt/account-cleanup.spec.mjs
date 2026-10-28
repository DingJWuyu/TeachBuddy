import { createHash } from 'node:crypto';
import { test, expect, register, navigate, logout } from './fixture.mjs';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

// Read the browser's real pending Blob bytes, rather than treating pointer removal as cleanup.
async function deviceBytes(page, database = 'teachbuddy-resources-pending', storeName = 'requests') {
  return page.evaluate(async ({ database, storeName }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(database, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      const read = method => new Promise((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName)[method]();
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const [keys, values] = await Promise.all([read('getAllKeys'), read('getAll')]);
      return Promise.all(values.map(async (value, index) => {
        const file = value.file ?? value.input;
        return { key: keys[index], name: file?.name, sha256: file instanceof Blob
          ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(byte => byte.toString(16).padStart(2, '0')).join('')
          : null };
      }));
    } finally { db.close(); }
  }, { database, storeName });
}

async function leavePendingOriginal(page, name, pageName) {
  await navigate(page, '/resources');
  await page.route('**/api/workbench/files', async route => { await route.fetch(); await route.abort('connectionreset'); }, { times: 1 });
  await page.getByLabel('上传资料', { exact: true }).setInputFiles({ name, mimeType: 'image/png', buffer: sourceImage(pageName) });
  await expect(page.getByRole('button', { name: '重试确认原请求', exact: true })).toBeVisible();
}

test('B-R5 危险确认和原请求核实删除后清理本账户原字节，保留另一账户并拒绝迟到写回', async ({ page, context, world }) => {
  test.setTimeout(90_000);
  await register(page, world, 'keep-device@example.test', '保留老师');
  const keep = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts WHERE email = ?').get('keep-device@example.test').accountKey;
  await leavePendingOriginal(page, '另一账户原件.png', 'I-1');
  const keptBytes = (await deviceBytes(page)).filter(item => item.key.startsWith(keep + ':'));
  expect(keptBytes[0].sha256).toBe(createHash('sha256').update(sourceImage('I-1')).digest('hex'));
  await logout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await register(page, world, 'delete-device@example.test', '删除老师');
  const owner = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts WHERE email = ?').get('delete-device@example.test').accountKey;
  await leavePendingOriginal(page, '待删账户原件.png', 'I-2');
  expect((await deviceBytes(page)).find(item => item.key.startsWith(owner + ':')).sha256).toBe(createHash('sha256').update(sourceImage('I-2')).digest('hex'));

  const other = await context.newPage();
  await other.goto(world.origin + '/questions');
  await other.getByRole('button', { name: '从资料收录', exact: true }).first().click();
  await other.getByRole('button', { name: /^上传图片/ }).click();
  await other.getByLabel('选择原稿').setInputFiles({ name: '删除后迟到原件.png', mimeType: 'image/png', buffer: sourceImage('I-1') });
  await other.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      File.prototype.arrayBuffer = original;
      window.pendingReadStarted = true;
      await new Promise(resolve => { window.releasePendingRead = resolve; });
      return original.call(this);
    };
  });
  await other.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect.poll(() => other.evaluate(() => window.pendingReadStarted)).toBe(true);

  const deletions = [];
  await page.route('**/api/auth/account-deletion', async route => {
    deletions.push(route.request().postDataJSON());
    if (deletions.length === 1) { await route.fetch(); await route.abort('connectionreset'); }
    else await route.continue();
  });
  await page.getByRole('link', { name: /^账户：/ }).click();
  await page.getByRole('button', { name: '删除账户…', exact: true }).click();
  const confirmation = page.locator('dialog[open]');
  await expect(confirmation).toContainText('此操作无法撤销');
  await expect(confirmation.getByRole('button', { name: '永久删除账户', exact: true })).toBeDisabled();
  await confirmation.getByRole('textbox').fill('keep-device@example.test');
  await expect(confirmation.getByRole('button', { name: '永久删除账户', exact: true })).toBeDisabled();
  expect(deletions).toHaveLength(0);
  await confirmation.getByRole('textbox').fill('delete-device@example.test');
  await confirmation.getByRole('button', { name: '永久删除账户', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试核实删除', exact: true })).toBeVisible();
  expect((await deviceBytes(page)).some(item => item.key.startsWith(owner + ':'))).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: '重试核实删除', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  expect(deletions[1]).toEqual(deletions[0]);
  expect(await deviceBytes(page)).toEqual(keptBytes);

  await other.evaluate(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      const result = get.call(this, key);
      if (key.startsWith('tb.account.deleted:') && result === '1') window.lateReadReachedDeletionGuard = true;
      return result;
    };
    window.releasePendingRead();
  });
  await expect.poll(() => other.evaluate(() => window.lateReadReachedDeletionGuard)).toBe(true);
  expect(await deviceBytes(page, 'teachbuddy.questions.uploads', 'pending')).toEqual([]);
  expect(await deviceBytes(page)).toEqual(keptBytes);
  await other.close();
});
