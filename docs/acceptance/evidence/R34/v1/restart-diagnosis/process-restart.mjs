// One retained-database replay across three real service processes; no retries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { manualQuestionSample } from '../../../../../../apps/api/test/first-flow-harness.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.M41_MIGRATION_PORT ?? 48564);
if (process.argv[2] === 'serve') {
  const { startFixture } = await import('../../../../../../scripts/materials/fixture.mjs');
  const { startMathFixture } = await import('../../../../../../apps/web/e2e/fixtures/math-static/server.mjs');
  const start = process.argv[3] === 'r31' ? startFixture : startMathFixture;
  const fixture = await start({ dataDir: process.argv[4], port, testPrincipals: ['r31-a', 'r31-b'] });
  process.once('SIGTERM', async () => { await fixture.close(); process.exit(0); });
  process.send({ origin: fixture.origin, cookie: fixture.workbench.identity.testPrincipalCookie('r31-a').header.split(';')[0] });
} else {
  const dataDir = path.resolve(`test-results/r34-restart-diagnosis/process-${randomUUID()}`);
  fs.mkdirSync(dataDir, { recursive: true });
  let child, session;
  const pids = [];
  async function start(kind) {
    const generation = pids.length;
    child = fork(fileURLToPath(import.meta.url), ['serve', kind, dataDir], {
      execArgv: ['--import', path.join(here, 'trace-preload.mjs')],
      env: { ...process.env, R34_TRACE: path.join(dataDir, `server-${generation}-trace.json`) },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    pids.push(child.pid);
    session = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fixture startup exceeded 15 seconds')), 15000);
      child.once('message', (value) => { clearTimeout(timer); resolve(value); });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Fixture exited before readiness: ${code}/${signal}`)); });
    });
    console.log(JSON.stringify({ event: 'ready', generation, pid: child.pid, origin: session.origin, dataDir }));
  }
  async function stop() {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.kill('SIGTERM');
    const [code, signal] = await exited;
    clearTimeout(timer);
    console.log(JSON.stringify({ event: 'exit', pid: child.pid, code, signal }));
    assert.equal(code, 0);
    child = null;
  }
  async function request(method, route, input, key = randomUUID()) {
    const multipart = input instanceof FormData;
    const response = await fetch(session.origin + route, {
      method,
      headers: { Cookie: session.cookie, Origin: session.origin, 'X-TeachBuddy-Request': '1',
        ...(input ? { 'Idempotency-Key': key, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) } : {}) },
      ...(input ? { body: multipart ? input : JSON.stringify(input) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  function snapshot() {
    const db = new Database(path.join(dataDir, 'workbench.sqlite'), { readonly: true });
    try {
      return { migrations: db.prepare('SELECT * FROM workbench_migrations').all(),
        document: JSON.parse(db.prepare('SELECT value FROM fixture_documents WHERE accountKey=?').get('r31-a').value),
        integrity: db.pragma('integrity_check', { simple: true }) };
    } finally { db.close(); }
  }
  try {
    await start('r31');
    const key = randomUUID(), input = manualQuestionSample();
    const question = await request('POST', '/api/modules/questions/items', input, key);
    assert.equal(question.status, 201);
    const document = { version: 2, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '旧 R31 文档' }] }] };
    assert.equal((await request('PUT', '/fixture/document', document)).status, 200);
    const bytes = Buffer.from(JSON.stringify(document));
    const upload = new FormData();
    upload.append('file', new Blob([bytes]), 'original.json');
    const file = await request('POST', '/api/workbench/files', upload);
    assert.equal(file.status, 201);
    const before = snapshot();
    await stop();
    for (let restart = 1; restart <= 2; restart++) {
      await start('math');
      assert.deepEqual(await request('POST', '/api/modules/questions/items', input, key), question);
      assert.deepEqual((await request('GET', `/api/modules/questions/items/${question.body.id}`)).body, question.body);
      assert.deepEqual((await request('GET', `/api/workbench/files/${file.body.id}`)).body, file.body);
      const download = await fetch(`${session.origin}/api/workbench/files/${file.body.id}/content`, { headers: { Cookie: session.cookie } });
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
      const after = snapshot();
      assert.deepEqual(after.document, document);
      assert.deepEqual(after.migrations.slice(0, before.migrations.length), before.migrations);
      assert.equal(after.migrations.filter((m) => m.id === 'math_001').length, 1);
      assert.equal(after.integrity, 'ok');
      await stop();
    }
    const result = { status: 'PASS', pids, dataDir, port, restarts: 2, question: question.body, file: file.body, before };
    fs.writeFileSync(path.join(dataDir, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: result.status, pids, dataDir, port, restarts: 2 }));
  } finally { await stop(); }
}
