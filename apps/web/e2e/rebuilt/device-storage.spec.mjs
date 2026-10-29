import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';

// Real browser storage through the device module's public interface. This
// source-only host avoids exposing test hooks in the production application.
let server, origin;
test.beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    if (req.url === '/') { res.end('<html><body>Device storage contract</body></html>'); return; }
    if (!req.url.startsWith('/apps/web/src/platform/device/') || req.url.includes('..')) { res.writeHead(404).end(); return; }
    try { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(path.resolve('.' + req.url))); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });

test('五类旧请求、分支与归档保留原键原体原字节，损坏和未来资料不触发回收', async ({ page }) => {
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const { deviceRequestStore: request, clearDeviceRequestAccount: clear } = await import(`${location.origin}/apps/web/src/platform/device/deviceRequestStore.js`);
    const { prepareDeviceRecovery: prepare, archivedUploads, recoveryArchives } = await import(`${location.origin}/apps/web/src/platform/device/deviceRecovery.js`);
    const { writeLocal, markAccountDeleted } = await import(`${location.origin}/apps/web/src/platform/device/storage.js`);
    const account = 'account-a', other = 'account-b';
    const bindings = [
      ['resources', 'teachbuddy-resources-pending', 'requests', 'pending:resources'],
      ['math', 'teachbuddy.math.uploads', 'pending', 'pending:math-upload'],
      ['questions', 'teachbuddy.questions.uploads', 'pending', 'pending:questions-upload'],
      ['classroom', 'teachbuddy-classroom-pending', 'requests', 'pending:classroom-upload'],
      ['sampleWeek', 'teachbuddy-sample-week', 'requests', 'pending:sample-week:upload'],
    ];
    const options = bindings.map(([identity]) => ({ identity, account, slot: identity === 'sampleWeek' ? 'upload' : undefined }));
    const check = (value, message) => { if (!value) throw new Error(message); };
    const raw = async (binding, action, key, value) => {
      const [, database, storeName] = binding;
      const db = await new Promise((resolve, reject) => {
        const open = indexedDB.open(database, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(storeName);
        open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
      });
      try { return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, action === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore(storeName);
        const op = action === 'put' ? store.put(value, key) : store[action](key);
        tx.oncomplete = () => resolve(op.result); tx.onerror = tx.onabort = () => reject(tx.error);
      }); } finally { db.close(); }
    };
    check(await prepare(account, { recoveryId: 'before' }) === false, 'initial context is not a restore');
    // Frozen compatibility inputs use the old physical layout, not today's mapping.
    for (const [i, binding] of bindings.entries()) {
      await raw(binding, 'put', account, { key: `legacy-${i}`, file: new File([`legacy bytes ${i}`], `legacy-${i}.txt`), body: { index: i } });
      const restored = await request(options[i]);
      check(restored.key === `legacy-${i}` && await restored.file.text() === `legacy bytes ${i}`, 'old account-key upload remains readable');
      await request({ ...options[i], action: 'put', value: { key: `branch-${i}`, file: new File([`original ${i}`], `original-${i}.txt`), body: { index: i } } });
    }
    await request({ ...options[0], account: other, action: 'put', value: { key: 'other', file: new File(['other bytes'], 'other.txt') } });
    check(await prepare(account, { recoveryId: 'before' }) === false, 'same recovery point preserves active requests');
    for (const [i, option] of options.entries()) check((await request(option)).key === `branch-${i}`, 'normal restart keeps original request key');
    const damagedKey = `tb.workbench.v1:${account}:draft:damaged`;
    localStorage.setItem(damagedKey, 'not-json');
    check(await prepare(account, { recoveryId: 'after', recoveredFrom: 'before' }), 'new recovery point freezes requests');
    for (const option of options) check(await request(option) === null, 'frozen request is not active');
    const archived = await archivedUploads(account, 'after');
    check(archived.length === 5, 'all five identities survive archival');
    for (let i = 0; i < 5; i++) {
      const value = archived.find(item => item.value.key === `branch-${i}`).value;
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await value.file.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
      check(value.file.name === `original-${i}.txt` && await value.file.text() === `original ${i}` && value.body.index === i && value.fileIdentity.sha256 === digest, 'archival preserves file, body and digest');
    }
    check(recoveryArchives(account)[0].records[damagedKey] === 'not-json', 'damaged text is preserved verbatim');
    writeLocal(account, 'pending:resources', { idbKey: `${account}:branch-0` });
    await request({ ...options[0], action: 'delete' });
    check((await archivedUploads(account, 'after')).length === 5, 'active cleanup cannot reclaim archive bytes');
    // Unknown future owners must conservatively retain bytes even without a
    // readable idbKey. Ordinary unreferenced bytes are still reclaimed.
    await request({ ...options[0], account: 'future', action: 'put', value: { key: 'keep', file: new File(['keep'], 'keep.txt') } });
    localStorage.setItem('teachbuddy:data-recovery-archive:future:unknown', JSON.stringify({ formatVersion: 99, opaque: true }));
    await request({ ...options[0], account: 'future', action: 'delete' });
    check(await raw(bindings[0], 'get', 'future:keep'), 'future archive prevents destructive inference');
    await request({ ...options[0], account: 'clean', action: 'put', value: { key: 'remove', file: new File(['remove'], 'remove.txt') } });
    await request({ ...options[0], account: 'clean', action: 'delete' });
    check(!await raw(bindings[0], 'get', 'clean:remove'), 'known unreferenced bytes are reclaimed');
    markAccountDeleted(account);
    let blocked = false;
    try { await request({ ...options[0], action: 'put', value: { key: 'late', file: new File(['late'], 'late.txt') } }); } catch { blocked = true; }
    check(blocked, 'deleted account rejects late write');
    for (const option of options) await clear(option);
    check((await archivedUploads(account, 'after')).length === 0, 'account deletion clears its archive bytes');
    check(await (await request({ ...options[0], account: other })).file.text() === 'other bytes', 'other account keeps its original file');
    return true;
  });
  expect(result).toBe(true);
});

test('两个标签页的原件互不覆盖，摘要计算期间删号拒绝迟到落盘', async ({ page, context }) => {
  await page.goto(origin);
  const second = await context.newPage();
  await second.goto(origin);
  const put = async (target, key) => target.evaluate(async key => {
    const { deviceRequestStore } = await import(`${location.origin}/apps/web/src/platform/device/deviceRequestStore.js`);
    await deviceRequestStore({ identity: 'resources', account: 'tabs', action: 'put', value: { key, file: new File([key], `${key}.txt`) } });
  }, key);
  await put(page, 'first');
  await put(second, 'second');
  for (const [target, key] of [[page, 'first'], [second, 'second']]) {
    expect(await target.evaluate(async () => {
      const { deviceRequestStore } = await import(`${location.origin}/apps/web/src/platform/device/deviceRequestStore.js`);
      return (await deviceRequestStore({ identity: 'resources', account: 'tabs' })).key;
    })).toBe(key);
  }
  await page.evaluate(async () => {
    const { deviceRequestStore } = await import(`${location.origin}/apps/web/src/platform/device/deviceRequestStore.js`);
    await deviceRequestStore({ identity: 'resources', account: 'tabs', action: 'delete' });
  });
  expect(await second.evaluate(async () => {
    const { deviceRequestStore } = await import(`${location.origin}/apps/web/src/platform/device/deviceRequestStore.js`);
    return (await deviceRequestStore({ identity: 'resources', account: 'tabs' })).file.text();
  })).toBe('second');
  expect(await page.evaluate(async () => {
    const { deviceRequestStore, clearDeviceRequestAccount } = await import(`${location.origin}/apps/web/src/platform/device/deviceRequestStore.js`);
    const { markAccountDeleted } = await import(`${location.origin}/apps/web/src/platform/device/storage.js`);
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let started, release;
    const start = new Promise(resolve => { started = resolve; });
    const wait = new Promise(resolve => { release = resolve; });
    crypto.subtle.digest = async (...args) => { started(); await wait; return digest(...args); };
    const pending = deviceRequestStore({ identity: 'resources', account: 'deleted', action: 'put', value: { key: 'late', file: new File(['late'], 'late.txt') } }).then(() => false, () => true);
    await start;
    markAccountDeleted('deleted');
    await clearDeviceRequestAccount({ identity: 'resources', account: 'deleted' });
    release();
    const rejected = await pending;
    crypto.subtle.digest = digest;
    return rejected && await deviceRequestStore({ identity: 'resources', account: 'deleted' }) === null;
  })).toBe(true);
});
