import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs';
import { application, upload, preview, json, finished, download, filesPath } from './helpers.js';

test('完整识别含500个原始附件仍成功，Job发布原始结果而完整附件保留在固定证据', { timeout: 180000 }, async t => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
  const recognizer = { revision: 'recognition-output-limit-v1', available: true, async run({ width, height }) {
    return { width, height, raw: { probe: 'complete-with-many-original-assets' },
      pageBlocks: [{ type: 'text', content: '1. 完整识别题面', bbox: [0, 0, 1, 1] }], assets: [],
      originalAssets: Array.from({ length: 500 }, (_, index) => ({ name: `original-${index}.png`, bytes: png })), derivations: [] };
  } };
  const world = await application(t, { workbench: { recognition: { recognizer } } });
  const file = await upload(world.client, '原页.png', fs.readFileSync('test/fixtures/questions/recognition/I-1/page.png'));
  const view = await preview(world.client, file.id);
  const accepted = await json(world.client, 'POST', `${filesPath}/${file.id}/recognition`, {
    renditionFileId: view.renditionFileId, pages: [1],
  }, 202);
  const done = await finished(world.client, accepted.id);
  assert.equal(done.state, 'succeeded', '完整页不能因把全部证据附件发布为Job输出而被误报失败');
  const page = await json(world.client, 'GET', `${filesPath}/${file.id}/recognition/pages/1?renditionFileId=${view.renditionFileId}`);
  assert.equal(page.state, 'ready');
  assert.deepEqual(done.outputFileIds, [page.rawFileId], 'Job每页发布一个原始结果，附件不占用通用Job输出集合');
  const request = JSON.parse(world.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(done.id).value);
  assert.equal(request.evidence[1].originalAssetFileIds.length, 500);
  assert.equal(request.evidence[1].assetFileIds.length, 500);
  assert.deepEqual(request.evidence[1].originalAssetFileIds, page.originalAssetFileIds);
  for (const id of page.originalAssetFileIds) assert.deepEqual(await download(world.client, id), png);
  assert.deepEqual(JSON.parse(await download(world.client, page.rawFileId)), { probe: 'complete-with-many-original-assets' });
  world.complete();
});
