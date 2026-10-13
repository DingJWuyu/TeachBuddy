import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { manualQuestionSample } from './first-flow-harness.js';
import { extractLegacySource } from './fixtures/legacy-source/extract.mjs';

const account = 'legacy-library-a';
const otherAccount = 'legacy-library-b';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = name => `"${name.replaceAll('"', '""')}"`;

function businessState(sqlitePath, columns) {
  const db = new Database(sqlitePath, { readonly: true });
  try {
    columns ??= Object.fromEntries(db.prepare(`SELECT name FROM sqlite_master
      WHERE type='table' AND (name LIKE 'question_%'
        OR name LIKE 'resource_%' OR name LIKE 'math_%'
        OR name='materials_files' OR name='workbench_mutation_keys') ORDER BY name`).all()
      .map(({ name }) => [name, db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(c => c.name)]));
    // Existing columns and rows of retained modules must survive the upgrade.
    const rows = Object.fromEntries(Object.entries(columns).map(([table, names]) => [table,
      db.prepare(`SELECT ${names.map(quote).join(',')} FROM ${quote(table)} ORDER BY rowid`).all(),
    ]));
    return { columns, rows };
  } finally { db.close(); }
}

function fileHashes(directory) {
  const hashes = {};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else hashes[path.relative(directory, file)] = digest(fs.readFileSync(file));
    }
  }
  walk(directory);
  return hashes;
}

async function closeLibrary(runtime) {
  if (!runtime) return;
  try { await runtime.workbench.close(); }
  finally { await runtime.dataStore.close(); }
}

async function openLibrary(factory, directory, composition = {}) {
  const runtime = factory({ env: {
    nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'),
    workbench: {
      mode: 'test-principal', testPrincipals: [account, otherAccount],
      sessionSecret: 'isolated-legacy-library', trustedOrigins: ['http://localhost'],
      filesDir: path.join(directory, 'files'), logDir: path.join(directory, 'logs'),
      ...composition,
    },
  } });
  try { await runtime.workbench.initialize(); }
  catch (error) { await closeLibrary(runtime); throw error; }
  return runtime;
}

function send(runtime, method, route, owner = account) {
  return request(runtime.app)[method](route)
    .set('Cookie', runtime.workbench.identity.testPrincipalCookie(owner).header.split(';')[0])
    .set('Origin', 'http://localhost').set('X-TeachBuddy-Request', '1');
}

async function downloadHash(runtime, id) {
  const result = await send(runtime, 'get', `/api/workbench/files/${id}/content`).buffer(true)
    .parse((response, done) => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => done(null, Buffer.concat(chunks)));
      response.on('error', done);
    });
  assert.equal(result.status, 200);
  return digest(result.body);
}

for (const kind of ['questions', 'math']) {
  test(`MC11: fixed R31 ${kind} library preserves rows, files and receipts across upgrade and two restarts`, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `legacy-${kind}-library-`));
    const original = path.join(root, 'original');
    const upgraded = path.join(root, 'upgraded');
    let runtime, passed = false;
    try {
      const source = extractLegacySource('r31-questions', path.join(root, 'source'));
      const load = file => import(pathToFileURL(path.join(source, file)));
      const { createApp: createOldApp } = await load('apps/api/src/app.js');
      // Use the archived M41 composition as declared by that version itself.
      const { mathSupportCatalog } = await load('packages/shared/src/moduleCatalog.js');
      const { mathSupportImplementations } = await load('apps/api/src/workbench/moduleImplementations.js');
      runtime = await openLibrary(createOldApp, original, kind === 'math' ? {
        catalogOverride: mathSupportCatalog, extraImplementations: mathSupportImplementations,
      } : {});
      const receipts = [];
      async function save(method, route, input, status) {
        const key = randomUUID();
        const result = await send(runtime, method, route).set('Idempotency-Key', key).send(input);
        assert.equal(result.status, status, JSON.stringify(result.body));
        receipts.push({ method, route, input, key, status, body: result.body });
        return result.body;
      }
      const uploaded = await send(runtime, 'post', '/api/workbench/files')
        .set('Idempotency-Key', randomUUID()).attach('file', Buffer.from('固定旧版原件：公式与题目资料'), '原件.txt');
      assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
      let readRoute, expected;
      if (kind === 'questions') {
        expected = await save('post', '/api/modules/questions/items', manualQuestionSample(), 201);
        readRoute = `/api/modules/questions/items/${expected.id}`;
      } else {
        const samples = JSON.parse(fs.readFileSync(new URL('./fixtures/contracts/math-samples.json', import.meta.url)));
        const input = samples.find(s => s.id === 'create-formula').value;
        const created = await save('post', '/api/modules/math/v1/works', input, 201);
        assert.equal(created.render.state, 'ready');
        assert.ok(created.render.posterFileId);
        readRoute = `/api/modules/math/v1/works/${created.id}`;
        expected = await save('put', readRoute, {
          baseVersion: 1, title: '旧版公式第二稿', source: { ...input.source, latex: 'x^2+2x+1' },
        }, 200);
        assert.equal(expected.render.state, 'ready');
      }
      const files = runtime.workbench.db.prepare('SELECT id FROM materials_files ORDER BY id').all();
      const downloads = new Map();
      for (const { id } of files) downloads.set(id, await downloadHash(runtime, id));
      const oldLedger = runtime.workbench.db.prepare("SELECT * FROM workbench_migrations WHERE moduleId <> 'lessons' ORDER BY rowid").all();
      await closeLibrary(runtime); runtime = null;
      const before = businessState(path.join(original, 'workspace.sqlite'));
      const originalFiles = fileHashes(path.join(original, 'files'));
      assert.ok(Object.keys(originalFiles).length > 0);
      const originalDbHash = digest(fs.readFileSync(path.join(original, 'workspace.sqlite')));
      fs.cpSync(original, upgraded, { recursive: true });
      let upgradedLedger;
      for (let restart = 0; restart < 2; restart++) {
        runtime = await openLibrary(createApp, upgraded);
        const catalog = await send(runtime, 'get', '/api/modules');
        assert.equal(catalog.status, 200);
        assert.equal(catalog.body.version, 3);
        const current = await send(runtime, 'get', readRoute);
        assert.equal(current.status, 200, JSON.stringify(current.body));
        assert.deepEqual(current.body, expected);
        assert.equal((await send(runtime, 'get', readRoute, otherAccount)).status, 404);
        assert.equal(runtime.workbench.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='lesson_items'").get(), undefined);
        assert.equal(runtime.workbench.db.prepare("SELECT 1 FROM workbench_migrations WHERE moduleId='lessons'").get(), undefined);
        for (const receipt of receipts) {
          const replay = await send(runtime, receipt.method, receipt.route)
            .set('Idempotency-Key', receipt.key).send(receipt.input);
          assert.equal(replay.status, receipt.status, JSON.stringify(replay.body));
          assert.deepEqual(replay.body, receipt.body);
        }
        for (const [id, hash] of downloads) assert.equal(await downloadHash(runtime, id), hash);
        assert.deepEqual(oldLedger.map(({ id }) => runtime.workbench.db.prepare('SELECT * FROM workbench_migrations WHERE id=?').get(id)), oldLedger);
        const ledger = runtime.workbench.db.prepare('SELECT * FROM workbench_migrations ORDER BY rowid').all();
        assert.ok(ledger.length > oldLedger.length, 'the current product must actually upgrade the old schema');
        if (restart === 0) upgradedLedger = ledger;
        else assert.deepEqual(ledger, upgradedLedger);
        await closeLibrary(runtime); runtime = null;
        assert.deepEqual(businessState(path.join(upgraded, 'workspace.sqlite'), before.columns), before);
        assert.deepEqual(fileHashes(path.join(upgraded, 'files')), originalFiles);
      }
      assert.equal(digest(fs.readFileSync(path.join(original, 'workspace.sqlite'))), originalDbHash);
      assert.deepEqual(fileHashes(path.join(original, 'files')), originalFiles);
      passed = true;
    } finally {
      await closeLibrary(runtime);
      if (passed) fs.rmSync(root, { recursive: true, force: true });
      else t.diagnostic(`Retained legacy library: ${root}`);
    }
  });
}
