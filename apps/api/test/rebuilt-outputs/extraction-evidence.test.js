import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localRecognizer } from './local-recognizer.js';
import { application, upload, preview, json, download, finished, importsPath, filesPath } from './helpers.js';
for (const termination of ['cancelled', 'timeout']) test(`题库 ${termination} 证据跨重试保留`, async t => {
  const local = await localRecognizer(t);
  local.mode(termination === 'timeout' ? 'pending' : 'success');
  const world = await application(t, { workbench: { recognition: { recognizer: local.recognizer } } });
  const file = await upload(world.client, 'test.png', fs.readFileSync('test/fixtures/questions/recognition/I-1/page.png'));
  const view = await preview(world.client, file.id);
  let release, entered, held = false;
  const storing = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const original = world.workbench.files.store;
  world.workbench.files.store = async (...args) => {
    if (termination === 'cancelled' && !held && args[1].name === 'recognition.json') {
      held = true; entered(); await gate;
    }
    return original(...args);
  };
  try {
    const material = await json(world.client, 'POST', importsPath, {
      title: '提取取消证据', origin: '隔离本地worker', input: { kind: 'files', fileIds: [file.id], pages: [] },
    }, 201);
    await local.requestAfter();
    if (termination === 'cancelled') {
      await storing;
      await json(world.client, 'POST', `/api/workbench/jobs/${material.jobId}/cancel`, {});
      assert.equal((await json(world.client, 'GET', `/api/workbench/jobs/${material.jobId}`)).state, 'cancelling');
      release();
    } else local.timeout();
    const stopped = await finished(world.client, material.jobId);
    assert.equal(stopped.state, termination === 'cancelled' ? 'cancelled' : 'failed');
    const task = () => JSON.parse(world.workbench.db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?').get(material.jobId).value);
    const evidence = structuredClone(task().recognitionEvidence);
    assert.equal(Object.keys(evidence).length, 1);
    const late = Object.values(evidence)[0];
    assert.ok(late.assetFileIds.length);
    const raw = await download(world.client, late.rawFileId);
    assert.equal(JSON.parse(raw).attempt, 1);
    assert.equal((await json(world.client, 'GET', `${importsPath}/${material.id}`)).drafts.length, 0);
    local.mode('success');
    const next = await json(world.client, 'POST', `/api/workbench/jobs/${material.jobId}/retry`, { unitIds: [] }, 202);
    assert.equal((await finished(world.client, next.id)).state, 'succeeded');
    assert.deepEqual(task().recognitionEvidence, evidence);
    assert.deepEqual(task().lateResults, evidence, '保留旧迟到证据读取兼容');
    assert.deepEqual(await download(world.client, late.rawFileId), raw);
    const page = await json(world.client, 'GET', `${filesPath}/${file.id}/recognition/pages/1?renditionFileId=${view.renditionFileId}`);
    assert.equal(JSON.parse(await download(world.client, page.rawFileId)).attempt, 2);
    world.complete(); local.complete();
  } finally { release(); world.workbench.files.store = original; }
});

test('先有教师校对，再停止和重试其他页，完成页与人工内容保持', async t => {
  const { replayRecognizer, sourceImage } = await import('../../../../test/fixtures/questions/recognition/replay.mjs');
  const base = await replayRecognizer();
  let secondAttempts = 0, entered;
  const pending = new Promise(resolve => { entered = resolve; });
  const recognizer = { ...base, async run(input) {
    const output = await base.run(input);
    if (base.calls.at(-1) !== 'I-2') return output;
    secondAttempts++;
    if (secondAttempts === 1) return { ...output, termination: { code: 'recognition-timeout' } };
    if (secondAttempts === 2) {
      entered();
      await new Promise(resolve => {
        input.signal.addEventListener('abort', resolve, { once: true });
        if (input.signal.aborted) resolve();
      });
      return { ...output, termination: { code: 'recognition-cancelled' } };
    }
    return output;
  } };
  const world = await application(t, { workbench: { recognition: { recognizer } } });
  const files = [];
  for (const name of ['I-1', 'I-2']) files.push(await upload(world.client, `${name}.png`, sourceImage(name)));
  let material = await json(world.client, 'POST', importsPath, { title: '教师校对保护', origin: '固定回放',
    input: { kind: 'files', fileIds: files.map(file => file.id), pages: [] } }, 201);
  assert.equal((await finished(world.client, material.jobId)).state, 'partial');
  material = await json(world.client, 'GET', `${importsPath}/${material.id}`);
  assert.ok(material.drafts.length);
  const originalJob = material.jobId;
  const teacher = '教师已经核对的内容，请保持。';
  material.drafts[0].body.blocks.unshift({ type: 'paragraph', runs: [{ type: 'text', text: teacher }] });
  material = await json(world.client, 'PUT', `${importsPath}/${material.id}`, {
    baseVersion: material.version, drafts: material.drafts, fragments: material.fragments,
  });
  const edited = structuredClone(material.drafts[0]);
  const retry = await json(world.client, 'POST', `/api/workbench/jobs/${originalJob}/retry`, { unitIds: [] }, 202);
  await pending;
  await json(world.client, 'POST', `/api/workbench/jobs/${retry.id}/cancel`, {});
  assert.equal((await finished(world.client, retry.id)).state, 'cancelled');
  const stopped = await json(world.client, 'GET', `${importsPath}/${material.id}`);
  assert.deepEqual(stopped.drafts.find(draft => draft.id === edited.id), edited);
  const final = await json(world.client, 'POST', `/api/workbench/jobs/${retry.id}/retry`, { unitIds: [] }, 202);
  assert.equal((await finished(world.client, final.id)).state, 'succeeded');
  const saved = await json(world.client, 'GET', `${importsPath}/${material.id}`);
  assert.deepEqual(saved.drafts.find(draft => draft.id === edited.id), edited);
  assert.equal(base.calls.filter(name => name === 'I-1').length, 1, '完成页不能重跑覆盖校对');
  world.complete();
});
