import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { application, upload, json, finished, download, importsPath, filesPath } from './helpers.js';

for (const kind of ['images', 'word']) test(`提取准备 ${kind} 取消等待真实转换 close，停止后续原件与 Word 降级`, async t => {
  const world = await application(t);
  const worker = path.join(world.directory, 'preview-worker.cjs');
  fs.writeFileSync(worker, `const fs=require('node:fs'),path=require('node:path');
    const [output,png,pdf,word]=process.argv.slice(2);
    setTimeout(()=>{fs.copyFileSync(png,path.join(output,'page.png'));
      if(word==='true')fs.copyFileSync(pdf,path.join(output,'preview.pdf'));
      fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({pages:[{page:1,name:'page.png',width:200,height:200}],pdf:word==='true'?'preview.pdf':null,issues:[],legacy:false}));},3000);`);
  const originalSpawn = childProcess.spawn;
  const workers = new Set(), events = [];
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  childProcess.spawn = (command, args, options) => {
    if (command !== '/usr/bin/bwrap') return originalSpawn(command, args, options);
    const child = originalSpawn(process.execPath, [worker, args[args.indexOf('--bind') + 1],
      path.resolve('test/fixtures/questions/recognition/I-1/page.png'), path.resolve('test/fixtures/questions/P.pdf'), String(kind === 'word')], options);
    workers.add(child); events.push('start'); entered();
    child.once('close', (_code, signal) => { events.push(`close:${signal}`); workers.delete(child); });
    return child;
  };
  syncBuiltinESMExports();
  try {
    const bytes = fs.readFileSync(kind === 'word' ? 'test/fixtures/questions/W.docx' : 'test/fixtures/questions/recognition/I-1/page.png');
    const files = [];
    for (let i = 0; i < (kind === 'word' ? 1 : 2); i++) files.push(await upload(world.client, kind === 'word' ? `word-${i}.docx` : `image-${i}.png`, bytes));
    const material = await json(world.client, 'POST', importsPath, {
      title: '准备阶段取消', origin: '受控真实转换worker', input: { kind: 'files', fileIds: files.map(file => file.id), pages: [] },
    }, 201);
    await started;
    await json(world.client, 'POST', `/api/workbench/jobs/${material.jobId}/cancel`, {});
    const done = await finished(world.client, material.jobId);
    assert.equal(done.state, 'cancelled');
    assert.deepEqual(events, ['start', 'close:SIGKILL'], '终态前必须已经 close，不能启动下一原件');
    assert.equal(workers.size, 0);
    const loaded = await json(world.client, 'GET', `${importsPath}/${material.id}`);
    assert.equal(loaded.drafts.length, 0);
    const task = JSON.parse(world.workbench.db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?').get(material.jobId).value);
    assert.deepEqual(task.paragraphs, {}, 'Word取消不能进入原生段落降级');
    for (const file of files) {
      assert.deepEqual(await download(world.client, file.id), bytes);
      assert.equal((await json(world.client, 'GET', `${filesPath}/${file.id}/preview`)).state, 'pending');
    }
    world.complete();
  } finally {
    childProcess.spawn = originalSpawn; syncBuiltinESMExports();
    for (const child of workers) child.kill('SIGKILL');
  }
});

test('排队的预览已取消时不启动转换，完成字节落库中取消也不发布预览', async t => {
  const world = await application(t);
  const bytes = fs.readFileSync('test/fixtures/questions/recognition/I-1/page.png');
  const first = await upload(world.client, 'first.png', bytes);
  const second = await upload(world.client, 'second.png', bytes);
  const principal = { accountKey: world.workbench.db.prepare('SELECT accountKey FROM materials_files WHERE id=?').get(first.id).accountKey };
  const worker = path.join(world.directory, 'queued-preview-worker.cjs');
  fs.writeFileSync(worker, `const fs=require('node:fs'),path=require('node:path');const [output,png]=process.argv.slice(2);
    setTimeout(()=>{fs.copyFileSync(png,path.join(output,'page.png'));fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({pages:[{page:1,name:'page.png',width:200,height:200}],pdf:null,issues:[],legacy:false}));},200);`);
  const originalSpawn = childProcess.spawn;
  let starts = 0, entered;
  const started = new Promise(resolve => { entered = resolve; });
  childProcess.spawn = (command, args, options) => {
    if (command !== '/usr/bin/bwrap') return originalSpawn(command, args, options);
    starts++; entered();
    return originalSpawn(process.execPath, [worker, args[args.indexOf('--bind') + 1], path.resolve('test/fixtures/questions/recognition/I-1/page.png')], options);
  };
  syncBuiltinESMExports();
  try {
    const running = world.workbench.files.ensurePreview(principal, first.id);
    await started;
    const controller = new AbortController();
    const queued = world.workbench.files.ensurePreview(principal, second.id, { signal: controller.signal });
    const rejected = assert.rejects(queued, { name: 'AbortError' });
    controller.abort();
    assert.equal((await running).state, 'ready');
    await rejected;
    assert.equal(starts, 1, '队列已停止的转换不启动子进程');
    assert.equal((await json(world.client, 'GET', `${filesPath}/${second.id}/preview`)).state, 'pending');
    const stopStore = new AbortController(), store = world.workbench.files.store;
    world.workbench.files.store = async (...args) => {
      const saved = await store(...args);
      stopStore.abort();
      return saved;
    };
    try {
      await assert.rejects(world.workbench.files.ensurePreview(principal, second.id, { signal: stopStore.signal }), { name: 'AbortError' });
      assert.equal((await json(world.client, 'GET', `${filesPath}/${second.id}/preview`)).state, 'pending');
      assert.equal((await json(world.client, 'GET', `${filesPath}/${first.id}/preview`)).state, 'ready', '原有完成页保持');
      assert.deepEqual(await download(world.client, second.id), bytes);
    } finally { world.workbench.files.store = store; }
    world.complete();
  } finally { childProcess.spawn = originalSpawn; syncBuiltinESMExports(); }
});
