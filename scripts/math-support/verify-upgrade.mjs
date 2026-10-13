import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../apps/api/test/fixtures/auth-integration/harness.js';
import { manualQuestionSample } from '../../apps/api/test/first-flow-harness.js';

import { extractLegacySource } from '../../apps/api/test/fixtures/legacy-source/extract.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r31-math-upgrade-'));
let passed = false;
try {
  const source = extractLegacySource('r31-math', path.join(root, 'source'));
  const load = (file) => import(pathToFileURL(path.join(source, file)).href);
  const { createApp } = await load('apps/api/src/app.js');
  const { createDataStore } = await load('apps/api/src/core/dataStore.js');
  const { hashPassword } = await load('apps/api/src/core/auth.js');
  const directory = path.join(root, 'data');
  fs.mkdirSync(directory);
  const sqlitePath = path.join(directory, 'workspace.sqlite');
  const store = createDataStore({ sqlitePath });
  const user = store.createUser({ name: '旧版数学教师', email: 'upgrade@example.test', passwordHash: hashPassword('upgrade-password'), role: 'teacher' });
  store.forAccount(user.id).create('workspaceLayouts', { hiddenModuleIds: [], groups: [], ungroupedModuleIds: [] });
  store.close();
  const old = createApp({ env: { nodeEnv: 'test', sqlitePath, workbench: {
    mode: 'test-principal', testPrincipals: [user.id], trustedOrigins: ['http://localhost']
  } } });
  await old.workbench.initialize();
  const server = http.createServer(old.app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cookie = old.workbench.identity.testPrincipalCookie(user.id).header.split(';')[0];
  const key = randomUUID();
  const question = manualQuestionSample({ title: '迁移前保存的题目' });
  async function oldRequest(route, body, contentType, idempotencyKey) {
    const response = await fetch(origin + route, { method: 'POST', body,
      headers: { Cookie: cookie, Origin: 'http://localhost', 'X-TeachBuddy-Request': '1',
        'Idempotency-Key': idempotencyKey, ...(contentType ? { 'Content-Type': contentType } : {}) } });
    assert.equal(response.status, 201);
    return response.json();
  }
  let savedFile, savedQuestion, snapshot, oldLedger;
  const tables = ['users', 'workspaceLayouts', 'question_items', 'materials_files', 'workbench_mutation_keys'];
  const readTables = (db) => Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  try {
    const body = new FormData();
    body.append('file', new Blob(['固定 R31 原文件']), '原文件.txt');
    savedFile = await oldRequest('/api/workbench/files', body, null, randomUUID());
    savedQuestion = await oldRequest('/api/modules/questions/items', JSON.stringify(question), 'application/json', key);
    snapshot = readTables(old.workbench.db);
    oldLedger = old.workbench.db.prepare("SELECT * FROM workbench_migrations WHERE moduleId <> 'lessons' ORDER BY rowid").all();
  } finally {
    await new Promise(resolve => server.close(resolve));
    await old.workbench.close();
  }
  let upgradedLedger;
  for (let run = 0; run < 2; run++) {
    const world = await createIntegration({ directory });
    try {
      const client = world.client();
      await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
      const logged = await client.request('POST', '/api/auth/login', { body: {
        email: 'upgrade@example.test', password: 'upgrade-password', rememberMe: true
      } });
      assert.equal(logged.status, 200, logged.text);
      assert.equal(logged.json.account.accountKey, user.id);
      assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: logged.json.id, rememberMe: true } })).status, 200);
      assert.deepEqual((await client.request('GET', `/api/workbench/files/${savedFile.id}`)).json, savedFile);
      assert.equal((await client.request('GET', `/api/workbench/files/${savedFile.id}/content`)).text, '固定 R31 原文件');
      assert.deepEqual((await client.request('POST', '/api/modules/questions/items', { body: question, headers: { 'Idempotency-Key': key } })).json, savedQuestion);
      assert.deepEqual(readTables(world.workbench.db), snapshot);
      assert.equal(world.workbench.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='lesson_items'").get(), undefined);
      assert.equal(world.workbench.db.prepare("SELECT 1 FROM workbench_migrations WHERE moduleId='lessons'").get(), undefined);
      assert.deepEqual(oldLedger.map(({ id }) => world.workbench.db.prepare('SELECT * FROM workbench_migrations WHERE id = ?').get(id)), oldLedger);
      const ledger = world.workbench.db.prepare('SELECT * FROM workbench_migrations ORDER BY rowid').all();
      if (run === 0) upgradedLedger = ledger;
      else assert.deepEqual(ledger, upgradedLedger);
      console.log(`Upgrade restart ${run + 1}: real login, original file bytes, question replay, retained-module rows and ledger unchanged, retired lesson schema absent`);
    } finally { await world.close(); }
  }
  passed = true;
} finally {
  if (passed) fs.rmSync(root, { recursive: true, force: true });
  else console.error('Retained R31 math migration:', root);
}
