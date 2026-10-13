import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import fs from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';

test('browser recovery preserves resource legacy bytes and branch uploads through the module port', async () => {
  const directory = new URL('../../../test-results/resources-storage/', import.meta.url);
  fs.mkdirSync(directory, { recursive: true });
  const bundle = new URL('recovery-bundle.js', directory);
  await build({
    entryPoints: [fileURLToPath(new URL('../../web/src/features/reliability/deviceRecovery.js', import.meta.url))],
    outfile: fileURLToPath(bundle), bundle: true, format: 'esm', platform: 'browser',
  });
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/recovery.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/recovery.js' ? fs.readFileSync(bundle) : '<html><body>设备恢复验证</body></html>');
  });
  await new Promise(resolve => server.listen(0, 'localhost', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://localhost:${server.address().port}`);
    const result = await page.evaluate(async () => {
      const api = await import('/recovery.js');
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('teachbuddy-resources-pending', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('requests');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('requests', 'readwrite'), store = tx.objectStore('requests');
        store.put({ key: 'old', file: new Blob(['legacy bytes']) }, 'alice');
        store.put({ key: 'branch', file: new Blob(['branch bytes']) }, 'alice:branch-key');
        store.put({ key: 'other', file: new Blob(['other account']) }, 'bob');
        tx.oncomplete = resolve;
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      localStorage.setItem('teachbuddy:data-recovery:alice', 'before');
      localStorage.setItem('tb.workbench.v1:alice:branch:pending:resources',
        JSON.stringify({ formatVersion: 2, value: { idbKey: 'alice:branch-key' } }));
      const context = { recoveryId: 'after', recoveredFrom: '2026-01-01' };
      const changed = await api.prepareDeviceRecovery('alice', context);
      const archives = api.recoveryArchives('alice');
      const uploads = await api.archivedUploads('alice', 'after');
      const other = await new Promise((resolve, reject) => {
        const request = db.transaction('requests').objectStore('requests').get('bob');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return {
        changed,
        activePointer: localStorage.getItem('tb.workbench.v1:alice:branch:pending:resources'),
        archiveCount: archives.length,
        bytes: (await Promise.all(uploads.map(upload => upload.value.file.text()))).sort(),
        otherAccountBytes: await other.file.text(),
        replay: await api.prepareDeviceRecovery('alice', context),
      };
    });
    assert.deepEqual(result, {
      changed: true, activePointer: null, archiveCount: 1,
      bytes: ['branch bytes', 'legacy bytes'], otherAccountBytes: 'other account', replay: false,
    });
    fs.writeFileSync(new URL('device-recovery.json', directory), JSON.stringify(result, null, 2));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(bundle, { force: true });
  }
});
