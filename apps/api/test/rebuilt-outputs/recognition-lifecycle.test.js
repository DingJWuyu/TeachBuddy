import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { localRecognizer } from './local-recognizer.js';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';
import { application, upload, preview, json, download, finished, filesPath } from './helpers.js';

async function source(world) {
  const file = await upload(world.client, '隔离进程输入.png', sourceImage('I-1'));
  const view = await preview(world.client, file.id);
  const endpoint = `${filesPath}/${file.id}/recognition`;
  return { endpoint, input: { renditionFileId: view.renditionFileId, pages: [1] }, page: `${endpoint}/pages/1?renditionFileId=${view.renditionFileId}` };
}

test('C-R2 未确认停止的本地进程阻止后续 run，真实 HTTP 任务不能声称取消成功', { timeout: 180000 }, async t => {
  const local = await localRecognizer(t);
  local.mode('pending');
  const world = await application(t, { workbench: { recognition: { recognizer: local.recognizer } } });
  const input = await source(world);
  const first = await json(world.client, 'POST', input.endpoint, input.input, 202);
  const firstRequest = await local.requestAfter();
  local.refuseStop(true);
  await json(world.client, 'POST', `/api/workbench/jobs/${first.id}/cancel`, {});
  assert.equal((await finished(world.client, first.id)).state, 'failed', '未确认停止不能报告 cancelled');
  const page = await json(world.client, 'GET', input.page);
  assert.equal(page.state, 'failed');
  assert.equal(page.issues[0].code, 'recognition-cleanup');
  assert.equal(JSON.parse(fs.readFileSync(path.join(firstRequest.output, 'raw.json'))).attempt, 1, '未确认停止时保留已写出的原始进程证据');
  const blocked = await json(world.client, 'POST', input.endpoint, input.input, 202);
  assert.equal((await finished(world.client, blocked.id)).state, 'failed');
  assert.equal(local.launches, 1, '未确认旧 scope 停止前不得启动新进程');
  local.refuseStop(false);
  local.mode('success');
  const recovered = await json(world.client, 'POST', input.endpoint, input.input, 202);
  assert.equal((await finished(world.client, recovered.id)).state, 'succeeded');
  assert.equal(local.launches, 2, '确认旧进程停止后明确操作才可重新运行');
  assert.equal((await json(world.client, 'GET', input.page)).state, 'ready');
  world.complete(); local.complete();
});

for (const termination of ['cancelled', 'timeout']) {
  test(`C-R2 ${termination} 完整迟到 raw 与图片仅绑定原任务，明确重试不覆盖旧证据`, { timeout: 180000 }, async t => {
    const local = await localRecognizer(t);
    local.mode(termination === 'timeout' ? 'pending' : 'success');
    const world = await application(t, { workbench: { recognition: { recognizer: local.recognizer } } });
    const input = await source(world);
    let release, entered;
    const storing = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const store = world.workbench.files.store;
    let held = false;
    world.workbench.files.store = async (...args) => {
      if (termination === 'cancelled' && !held && args[1].name === 'recognition.json') {
        held = true; entered(); await gate;
      }
      return store(...args);
    };
    try {
      const accepted = await json(world.client, 'POST', input.endpoint, input.input, 202);
      await local.requestAfter();
      if (termination === 'cancelled') {
        await storing;
        await json(world.client, 'POST', `/api/workbench/jobs/${accepted.id}/cancel`, {});
        assert.equal((await json(world.client, 'GET', `/api/workbench/jobs/${accepted.id}`)).state, 'cancelling', '原始结果尚在保存时取消不能先宣告完成');
        release();
      } else local.timeout();
      const stopped = await finished(world.client, accepted.id);
      assert.equal(stopped.state, termination === 'cancelled' ? 'cancelled' : 'failed');
      const page = await json(world.client, 'GET', input.page);
      assert.equal(page.state, termination === 'cancelled' ? 'interrupted' : 'failed', '迟到完整结果不得发布为 ready');
      const requestRecord = () => JSON.parse(world.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(accepted.id).value);
      const evidence = structuredClone(requestRecord().lateResult);
      assert.ok(evidence?.rawFileId, '原任务须持久绑定迟到原始结果');
      assert.equal(evidence.rawFileId, page.rawFileId);
      assert.ok(stopped.outputFileIds.includes(evidence.rawFileId));
      assert.ok(evidence.assetFileIds.length > 0, '完整迟到附件也须绑定原任务');
      const raw = await download(world.client, evidence.rawFileId);
      assert.equal(JSON.parse(raw).attempt, 1);
      for (const id of evidence.assetFileIds) assert.equal((await sharp(await download(world.client, id)).metadata()).format, 'png');
      local.mode('success');
      const retry = await json(world.client, 'POST', `/api/workbench/jobs/${accepted.id}/retry`, { unitIds: [] }, 202);
      assert.equal((await finished(world.client, retry.id)).state, 'succeeded');
      const ready = await json(world.client, 'GET', input.page);
      assert.equal(ready.state, 'ready');
      assert.equal(JSON.parse(await download(world.client, ready.rawFileId)).attempt, 2);
      assert.deepEqual(requestRecord().lateResult, evidence, '新尝试不能重绑定或擦除旧任务证据');
      assert.deepEqual(await download(world.client, evidence.rawFileId), raw, '旧 raw 字节必须保持可读');
      assert.equal(local.launches, 2, '取消或超时后只有明确重试才能启动下一代进程');
      world.complete(); local.complete();
    } finally { release(); world.workbench.files.store = store; }
  });
}
