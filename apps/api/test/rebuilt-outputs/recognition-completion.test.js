import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localRecognizer } from './local-recognizer.js';
import { application, upload, preview, download } from './helpers.js';

for (const mode of ['ready', 'cancelled', 'timeout', 'cleanup-unconfirmed']) {
  test(`共用识别完成 interface 交付 ${mode} 本次证据，重试保持已交付整值`, async t => {
    const local = await localRecognizer(t);
    local.mode(mode === 'ready' || mode === 'cancelled' ? 'success' : 'pending');
    const world = await application(t, { workbench: { recognition: { recognizer: local.recognizer } } });
    const file = await upload(world.client, '识别完成.png', fs.readFileSync('test/fixtures/questions/recognition/I-1/page.png'));
    const view = await preview(world.client, file.id);
    const principal = { accountKey: world.workbench.db.prepare('SELECT accountKey FROM materials_files WHERE id=?').get(file.id).accountKey };
    const source = { fileId: file.id, renditionFileId: view.renditionFileId, page: 1 };
    const controller = new AbortController();
    const store = world.workbench.files.store;
    let release, entered;
    const storing = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let held = false;
    world.workbench.files.store = async (...args) => {
      if (mode === 'cancelled' && !held && args[1].name === 'recognition.json') {
        held = true; entered(); await gate;
      }
      return store(...args);
    };
    try {
      const pending = world.workbench.recognition.ensurePage(principal, source, { signal: controller.signal, retry: true });
      await local.requestAfter();
      if (mode === 'cancelled') { await storing; controller.abort(); release(); }
      if (mode === 'timeout') local.timeout();
      if (mode === 'cleanup-unconfirmed') { local.refuseStop(true); controller.abort(); }
      const attempt = await pending;
      assert.equal(attempt.stop?.kind ?? 'ready', mode);
      if (mode === 'cleanup-unconfirmed') {
        assert.equal(attempt.stop.error.code, 'recognition-cleanup');
        assert.equal(attempt.page.state, 'failed');
      } else {
        assert.ok(attempt.evidence.rawFileId);
        const frozen = structuredClone(attempt.evidence);
        const raw = await download(world.client, frozen.rawFileId);
        assert.equal(JSON.parse(raw).attempt, 1);
        assert.ok(attempt.outputFileIds.includes(frozen.rawFileId));
        if (mode !== 'ready') {
          local.mode('success');
          const retry = await world.workbench.recognition.ensurePage(principal, source, { retry: true });
          assert.equal(retry.page.state, 'ready');
          assert.equal(JSON.parse(await download(world.client, retry.evidence.rawFileId)).attempt, 2);
        }
        assert.deepEqual(attempt.evidence, frozen);
        assert.deepEqual(await download(world.client, frozen.rawFileId), raw);
      }
      local.refuseStop(false);
      world.complete(); local.complete();
    } finally {
      release(); local.refuseStop(false); world.workbench.files.store = store;
    }
  });
}
