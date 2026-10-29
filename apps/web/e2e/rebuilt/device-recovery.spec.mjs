import { test, expect, register } from './fixture.mjs';

for (const failure of ['archive-readback', 'upload-migration']) {
  test(`恢复点变化先锁账户并保全，${failure}失败不挂业务，页面重试保留原件`, async ({ page, context, world }, info) => {
    await register(page, world);
    const account = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts WHERE email = ?').get('browser@example.test').accountKey;
    const draftKey = `tb.workbench.v1:${account}:draft:keep`;
    const archiveKey = `teachbuddy:data-recovery-archive:${account}:restored`;
    const original = '{"input":"教师未提交的原始草稿"}';
    await page.evaluate(async ({ account, draftKey, original }) => {
      localStorage.setItem(draftKey, original);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('teachbuddy-resources-pending', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('requests');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      try { await new Promise((resolve, reject) => {
        const tx = db.transaction('requests', 'readwrite');
        tx.objectStore('requests').put({ key: 'old-upload', file: new File(['original bytes'], 'original.txt'), body: { keep: 'request' } }, account);
        tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error);
      }); } finally { db.close(); }
    }, { account, draftKey, original });
    let contexts = 0, moduleReads = 0;
    await page.route('**/api/reliability/v1/context', async route => {
      const response = await route.fetch();
      contexts++;
      await route.fulfill({ response, json: { ...await response.json(), recoveryId: 'restored', recoveredFrom: 'before' } });
    });
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/modules') moduleReads++; });
    await page.addInitScript(({ failure, archiveKey }) => {
      window.deviceFault = true;
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        const value = get.call(this, key);
        if (failure === 'archive-readback' && window.deviceFault && key === archiveKey && value !== null) return null;
        return value;
      };
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args) => {
        if (failure === 'upload-migration' && window.deviceFault && args[0] === 'teachbuddy-resources-pending') throw new Error('Injected unavailable upload database');
        return open(...args);
      };
    }, { failure, archiveKey });
    const lock = await context.newPage();
    await lock.route('**/device-lock-test', route => route.fulfill({ contentType: 'text/html', body: '<html>account lock</html>' }));
    await lock.goto(world.origin + '/device-lock-test');
    await lock.evaluate(account => {
      navigator.locks.request(`teachbuddy-recovery:${account}`, async () => {
        window.holding = true;
        await new Promise(resolve => { window.release = resolve; });
      });
    }, account);
    await expect.poll(() => lock.evaluate(() => window.holding)).toBe(true);
    await page.reload();
    await expect.poll(() => contexts).toBe(1);
    await expect(page.getByRole('heading', { name: '正在加载工作台', exact: true })).toBeVisible();
    expect(moduleReads).toBe(0);
    expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(original);
    await lock.evaluate(() => window.release());
    await expect(page.getByRole('heading', { name: '暂时无法连接服务', exact: true })).toBeVisible();
    await expect(page.locator('.wb-shell')).toHaveCount(0);
    expect(moduleReads).toBe(0);
    await page.evaluate(() => { window.deviceFault = false; });
    const archivedBefore = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), archiveKey);
    expect(archivedBefore.records[draftKey]).toBe(original);
    expect(await page.evaluate(key => localStorage.getItem(key), draftKey)).toBe(original);
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.locator('.wb-shell')).toBeVisible();
    const result = await page.evaluate(async ({ account, draftKey, archiveKey }) => {
      const db = await new Promise(resolve => { const open = indexedDB.open('teachbuddy-resources-pending', 1); open.onsuccess = () => resolve(open.result); });
      try {
        const read = key => new Promise(resolve => { const request = db.transaction('requests').objectStore('requests').get(key); request.onsuccess = () => resolve(request.result); });
        const archived = await read(`${account}:recovery:restored`);
        return { active: await read(account) ?? null, draft: localStorage.getItem(draftKey), archive: JSON.parse(localStorage.getItem(archiveKey)), key: archived.key, body: archived.body, name: archived.file.name, bytes: await archived.file.text() };
      } finally { db.close(); }
    }, { account, draftKey, archiveKey });
    expect(result.active).toBeNull();
    expect(result.draft).toBeNull();
    expect(result.archive).toEqual(archivedBefore);
    expect(result).toMatchObject({ key: 'old-upload', body: { keep: 'request' }, name: 'original.txt', bytes: 'original bytes' });
    await page.screenshot({ path: info.outputPath('restored-workbench.png'), animations: 'disabled' });
    await lock.close();
  });
}

test('可信账户不匹配时不读取恢复上下文、不迁移设备草稿、不挂业务', async ({ page, world }) => {
  await register(page, world);
  let recoveryReads = 0;
  await page.route('**/api/workbench/context', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), accountKey: 'another-account' } });
  });
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/reliability/v1/context') recoveryReads++; });
  await page.reload();
  await expect(page.getByRole('heading', { name: '暂时无法连接服务', exact: true })).toBeVisible();
  await expect(page.locator('.wb-shell')).toHaveCount(0);
  expect(recoveryReads).toBe(0);
});
