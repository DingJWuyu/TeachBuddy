import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { createTestDirectory } from '../support/directories.js';
import { createIntegration } from '../support/application.js';
import { application, upload, preview, json, finished, download, importsPath, filesPath } from './helpers.js';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

// Complete stopped machine output with both original and derived attachments.
const recognizer = { revision: 'evidence-recovery-v1', available: true, async run({ width, height }) {
  const image = sourceImage('I-1');
  return { width, height, raw: { attempt: 'stopped' }, pageBlocks: [],
    assets: [{ name: 'derived.png', bytes: image }], originalAssets: [{ name: 'original.png', bytes: image }],
    derivations: [{ name: 'derived.png', source: 'original.png', issues: [] }],
    termination: { code: 'recognition-timeout' } };
} };

test('识别旧新任务整份证据经个人资料包、重启与停服备份恢复保持关联和字节', { timeout: 180000 }, async t => {
  const world = await application(t, { workbench: { recognition: { recognizer } } });
  const file = await upload(world.client, '原页.png', sourceImage('I-1'));
  const view = await preview(world.client, file.id);
  const direct = await json(world.client, 'POST', `${filesPath}/${file.id}/recognition`, { renditionFileId: view.renditionFileId, pages: [1] }, 202);
  assert.equal((await finished(world.client, direct.id)).state, 'failed');
  // Keep a genuine prior task in its older shape alongside a new full snapshot.
  const directRow = world.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(direct.id);
  const oldRequest = JSON.parse(directRow.value), full = oldRequest.lateResult;
  oldRequest.lateResult = { page: full.page, rawFileId: full.rawFileId, assetFileIds: full.assetFileIds,
    originalAssetFileIds: full.originalAssetFileIds, derivations: full.derivations };
  world.workbench.db.prepare('UPDATE materials_recognition_requests SET value=? WHERE jobId=?').run(JSON.stringify(oldRequest), direct.id);
  const material = await json(world.client, 'POST', importsPath, { title: '停止证据', origin: '隔离固定输出',
    input: { kind: 'files', fileIds: [file.id], pages: [] } }, 201);
  assert.equal((await finished(world.client, material.jobId)).state, 'failed');
  const task = JSON.parse(world.workbench.db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?').get(material.jobId).value);
  const evidence = Object.values(task.lateResults)[0];
  assert.equal(evidence.source.fileId, file.id);
  assert.ok(evidence.originalAssetFileIds.length);
  assert.ok(evidence.derivations.length);
  const ids = [...new Set([evidence.rawFileId, ...evidence.assetFileIds, ...oldRequest.lateResult.assetFileIds])];
  const bytes = new Map(await Promise.all(ids.map(async id => [id, await download(world.client, id)])));
  const exportJob = await json(world.client, 'POST', '/api/reliability/v1/exports', {}, 202);
  let exported;
  do {
    exported = await json(world.client, 'GET', `/api/reliability/v1/exports/${exportJob.id}`);
    if (['queued', 'running'].includes(exported.state)) await new Promise(resolve => setTimeout(resolve, 20));
  } while (['queued', 'running'].includes(exported.state));
  assert.equal(exported.state, 'ready');
  const response = await world.client.request('GET', `/api/reliability/v1/exports/${exportJob.id}/content`);
  const zip = await JSZip.loadAsync(response.bytes);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const jsonFiles = await Promise.all(Object.values(zip.files).filter(entry => entry.name.endsWith('.json')).map(entry => entry.async('string')));
  const packed = jsonFiles.join('\n');
  assert.ok(packed.includes(JSON.stringify(oldRequest.lateResult.rawFileId)));
  assert.ok(packed.includes('questionRecognitionEvidence'));
  assert.ok(packed.includes(material.jobId));
  assert.ok(packed.includes('originalAssetFileIds'));
  for (const id of ids) {
    const entry = manifest.files.find(file => file.path.startsWith(`files/${id}/`));
    assert.ok(entry, '证据附件必须进入个人包');
    assert.deepEqual(await zip.file(entry.path).async('nodebuffer'), bytes.get(id));
  }
  const maintenance = createTestDirectory('recognition-evidence-recovery-');
  let restored, complete = false;
  t.after(async () => {
    await restored?.close();
    if (complete) fs.rmSync(maintenance, { recursive: true, force: true });
    else t.diagnostic(`保留恢复现场 ${maintenance}`);
  });
  const cli = (...args) => JSON.parse(execFileSync(process.execPath, ['apps/api/src/scripts/reliability.js', ...args, '--stopped'], { encoding: 'utf8' }));
  await world.close();
  const backup = path.join(maintenance, 'backup'), target = path.join(maintenance, 'restored');
  assert.equal(cli('backup', '--database', path.join(world.directory, 'workspace.sqlite'), '--files', path.join(world.directory, 'files'), '--target', backup).state, 'backed-up');
  assert.equal(cli('restore', '--source', backup, '--target', target).state, 'prepared');
  assert.equal(cli('activate', '--target', target).state, 'activated');
  restored = await createIntegration({ directory: target, clock: world.clock });
  const client = restored.client();
  await json(client, 'POST', '/api/auth/session', { action: 'bootstrap' });
  const session = await json(client, 'POST', '/api/auth/login', { email: world.session.account.email, password: 'outputs-password', rememberMe: true });
  await json(client, 'POST', '/api/auth/session', { action: 'activate', sessionId: session.id, rememberMe: true });
  assert.deepEqual(JSON.parse(restored.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(direct.id).value).lateResult, oldRequest.lateResult);
  assert.deepEqual(JSON.parse(restored.workbench.db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?').get(material.jobId).value).lateResults, task.lateResults);
  for (const id of ids) assert.deepEqual(await download(client, id), bytes.get(id));
  assert.equal((await json(client, 'GET', `${importsPath}/${material.id}`)).drafts.length, 0);
  world.complete(); complete = true;
});
