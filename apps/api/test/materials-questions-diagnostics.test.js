import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createIntegration} from './fixtures/auth-integration/harness.js';
import {registerMath} from '../../web/e2e/fixtures/math-static/real.mjs';

test('PDF structure failure retains a redacted diagnostic and source after temporary cleanup and restart', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-diagnostic-'));
  let runtime = await createIntegration({directory});
  const {client} = await registerMath(runtime, 'diagnostic@example.test');
  t.after(() => runtime.close());
  const spawn = childProcess.spawn;
  const worker = path.join(directory, 'failing-structure-worker.mjs');
  fs.writeFileSync(worker, `console.error('Authorization: Bearer synthetic-auth\\nCookie: session=synthetic-cookie\\nAPI_KEY=synthetic-key');
await import('/private/teacher/input-secret.mjs?token=synthetic-url-token');\n`);
  const temporary = [];
  t.mock.method(childProcess, 'spawn', (command, args, options) => {
    if (args?.at(-2) === 'structure') {
      args = [...args];
      // Keep the real sandbox, limits, process lifecycle and conversion wrapper.
      args[args.indexOf('/app/api/worker.mjs') - 1] = worker;
      temporary.push(path.dirname(path.dirname(args[args.indexOf('/input') - 1])));
    }
    return spawn(command, args, options);
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  async function request(method, route, body, extra = {}) {
    const response = await client.request(method, route, {body, headers: {'Idempotency-Key': randomUUID(), Connection: 'close'}, ...extra});
    assert.ok(response.status >= 200 && response.status < 300, JSON.stringify(response.json));
    return response.json;
  }
  const original = fs.readFileSync(new URL('./fixtures/questions/pdf-figure-near-edge.pdf', import.meta.url));
  const form = new FormData();
  form.append('file', new Blob([original]), 'figure.pdf');
  const encoded = new Response(form);
  const file = await request('POST', '/api/workbench/files', undefined, {
    contentType: encoded.headers.get('content-type'), rawBody: Buffer.from(await encoded.arrayBuffer()),
  });
  const material = await request('POST', '/api/modules/questions/v2/imports', {
    title: '结构失败留存', origin: '', input: {kind: 'files', fileIds: [file.id], pages: []},
  });
  let job;
  for (let n = 0; n < 600; n++) {
    job = await request('GET', '/api/workbench/jobs/' + material.jobId);
    if (!['queued', 'running', 'cancelling'].includes(job.state)) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(job.state, 'succeeded');
  assert.equal(temporary.length, 1, 'injection must hit the actual structure subprocess');
  assert.ok(temporary.every(dir => !fs.existsSync(dir)), 'temporary parse input is cleaned');
  const readTask = () => JSON.parse(runtime.dataStore.db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?').get(material.jobId).value);
  const task = readTask();
  if (process.env.PDF_DIAGNOSTIC_EVIDENCE) {
    fs.mkdirSync(process.env.PDF_DIAGNOSTIC_EVIDENCE, {recursive: true});
    fs.writeFileSync(path.join(process.env.PDF_DIAGNOSTIC_EVIDENCE, 'task.json'), JSON.stringify(task, null, 2));
  }
  const result = task.machineResults[`file:${file.id}:page:1`];
  const diagnostic = result.diagnostics?.find(item => item.stage === 'pdf-figure-structure');
  assert.ok(diagnostic, 'specific structure failure must survive temporary cleanup in the persisted task');
  assert.match(diagnostic.detail, /ERR_MODULE_NOT_FOUND/);
  assert.match(diagnostic.detail, /Cannot find module/);
  assert.doesNotMatch(diagnostic.detail, /synthetic-|\/private\/|\/app\/|file:\/\//);
  assert.ok(diagnostic.detail.length <= 1000);
  assert.deepEqual(diagnostic.source, {fileId: file.id, sha256: file.sha256, renditionFileId: file.id, page: 1});
  const review = await request('GET', '/api/modules/questions/v2/imports/' + material.id);
  assert.equal(review.drafts.length, 1);
  assert.match(JSON.stringify(review.drafts[0].body), /x \+ 1 = 5/);
  assert.ok(review.drafts[0].issues.some(issue => issue.code === 'uncertain-text'));
  assert.equal((await request('GET', '/api/workbench/files/' + file.id)).sha256, file.sha256);
  const port = Number(new URL(runtime.origin).port);
  await runtime.close();
  runtime = await createIntegration({directory, port});
  assert.deepEqual(readTask(), task);
  assert.deepEqual(await request('GET', '/api/modules/questions/v2/imports/' + material.id), review);
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
});
