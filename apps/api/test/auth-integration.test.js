import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntegration } from './fixtures/auth-integration/harness.js';

test('A11 HTTPS: pending refuses workbench; active shares accountKey', async () => {
  const world = await createIntegration();
  try {
    const client = world.client();
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } })).status, 200);
    const email = 'a11@example.test';
    const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    assert.equal(sent.status, 200);
    const registered = await client.request('POST', '/api/auth/register', { body: {
      email, nickname: '集成教师', password: 'password-a11', termsAccepted: true, rememberMe: true,
      challengeId: sent.json.challengeId, verificationCode: world.mailer.lastCode('registration', email)
    } });
    assert.equal(registered.status, 201);
    assert.equal((await client.request('GET', '/api/workbench/context')).status, 401);
    assert.equal((await client.request('POST', '/api/auth/session', { body: {
      action: 'activate', sessionId: registered.json.id, rememberMe: true
    } })).status, 200);
    const context = await client.request('GET', '/api/workbench/context');
    assert.equal(context.status, 200);
    assert.equal(context.json.accountKey, registered.json.account.accountKey);
  } finally { await world.close(); }
});

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manualQuestionSample, variantCopySample, lessonSample } from './first-flow-harness.js';
import { createDataStore } from '../src/core/dataStore.js';
import { hashPassword } from '../src/core/auth.js';

const Q = '/api/modules/questions/items';
const L = '/api/modules/lessons/items';
async function account(world, email = 'matrix@example.test', rememberMe = true) {
  const client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const pending = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '矩阵教师', password: 'password-a11', termsAccepted: true, rememberMe: true,
    challengeId: sent.json.challengeId, verificationCode: world.mailer.lastCode('registration', email)
  } });
  assert.equal(pending.status, 201);
  await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: pending.json.id, rememberMe } });
  return { client, session: pending.json };
}
function write(client, method, endpoint, body, key = crypto.randomUUID()) {
  return client.request(method, endpoint, { body, headers: { 'Idempotency-Key': key } });
}
function problem(result, status) {
  assert.equal(result.status, status, result.text);
  assert.equal(result.json.type, `/problems/workbench/${status === 401 ? 'unauthenticated' : status === 403 ? 'request-not-allowed' : 'temporarily-unavailable'}`);
  assert.equal(result.headers['cache-control'], 'no-store');
}

test('C19/C20: all 15 operations use real principal; page rejection precedes data and writes', async () => {
  const world = await createIntegration();
  try {
    const { client } = await account(world);
    const key = crypto.randomUUID();
    const created = await write(client, 'POST', Q, manualQuestionSample(), key);
    assert.equal(created.status, 201, created.text);
    assert.deepEqual((await write(client, 'POST', Q, manualQuestionSample(), key)).json, created.json);
    const q = created.json;
    const lesson = await write(client, 'POST', L, lessonSample());
    assert.equal(lesson.status, 201, lesson.text);
    const l = lesson.json;
    const updateQ = { ...manualQuestionSample(), baseVersion: 1 }; delete updateQ.source;
    const cases = [
      ['GET', '/api/workbench/context'], ['GET', '/api/modules'],
      ['GET', Q], ['POST', Q, manualQuestionSample(), 201], ['GET', `${Q}/${q.id}`],
      ['PUT', `${Q}/${q.id}`, updateQ], ['GET', `${Q}/${q.id}/copies`],
      ['POST', `${Q}/${q.id}/copies`, variantCopySample(2), 201],
      ['POST', `${Q}/${q.id}/deletion`, { baseVersion: 2, deleted: true }],
      ['GET', L], ['POST', L, lessonSample(), 201], ['GET', `${L}/${l.id}`],
      ['PUT', `${L}/${l.id}`, { ...lessonSample(), baseVersion: 1 }],
      ['POST', `${L}/${l.id}/deletion`, { baseVersion: 2, deleted: true }],
      ['GET', `/api/modules/lessons/question-usages/${q.id}`]
    ];
    const before = world.workbench.db.prepare('SELECT COUNT(*) n FROM workbench_mutation_keys').get().n;
    for (const page of [null, '', 'a'.repeat(31), 'a'.repeat(33), 'g'.repeat(32), 'f'.repeat(32)]) {
      for (const [method, endpoint, body] of cases) {
        problem(await client.request(method, endpoint, { page, body, headers: { 'Idempotency-Key': crypto.randomUUID() } }), 401);
        if (method !== 'GET') problem(await client.request(method, endpoint, { page, body, origin: 'https://evil.invalid' }), 403);
      }
    }
    for (const [method, endpoint, body] of cases) problem(await client.request(method, endpoint, { body, cookie: null }), 401);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) n FROM workbench_mutation_keys').get().n, before);
    for (const [method, endpoint, body, status = 200] of cases) {
      const result = await write(client, method, endpoint, body);
      assert.equal(result.status, status, `${method} ${endpoint}: ${result.text}`);
    }
    const other = await account(world, 'other@example.test');
    assert.equal((await other.client.request('GET', `${Q}/${q.id}`)).status, 404);
    const isolated = await write(other.client, 'POST', Q, manualQuestionSample(), key);
    assert.equal(isolated.status, 201);
    assert.notEqual(isolated.json.id, q.id);
  } finally { await world.close(); }
});

test('C21: refresh requires explicit restore; expiry/revocation 401 and both stores 503', async () => {
  const world = await createIntegration();
  try {
    const { client, session } = await account(world);
    client.pageId = 'b'.repeat(32);
    problem(await client.request('GET', '/api/workbench/context'), 401);
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'restore', sessionId: session.id } })).status, 200);
    assert.equal((await client.request('GET', '/api/workbench/context')).json.accountKey, session.account.accountKey);
    for (const table of ['auth_accounts', 'auth_sessions']) {
      world.workbench.db.exec(`ALTER TABLE ${table} RENAME TO ${table}_unavailable`);
      problem(await client.request('GET', '/api/workbench/context'), 503);
      world.workbench.db.exec(`ALTER TABLE ${table}_unavailable RENAME TO ${table}`);
    }
    world.clock.advance(7 * 24 * 60 * 60 * 1000 + 1);
    problem(await client.request('GET', '/api/workbench/context'), 401);
    const pageOnly = await account(world, 'page@example.test', false);
    pageOnly.client.pageId = 'c'.repeat(32);
    problem(await pageOnly.client.request('GET', '/api/workbench/context'), 401);
    assert.equal((await pageOnly.client.request('GET', '/api/auth/session')).json.rememberedSession, null);
    const revoked = await account(world, 'revoke@example.test');
    assert.equal((await revoked.client.request('POST', '/api/auth/logout', { body: { sessionId: revoked.session.id } })).status, 204);
    problem(await revoked.client.request('GET', '/api/workbench/context'), 401);
  } finally { await world.close(); }
});

test('old database retains stable accountKey, credentials, layout and migration ledger after restart', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a11-legacy-'));
  const store = createDataStore({ sqlitePath: path.join(directory, 'workspace.sqlite') });
  const legacy = store.createUser({ name: '旧账户', email: 'legacy@example.test', passwordHash: hashPassword('password-a11'), role: 'teacher' });
  store.forAccount(legacy.id).create('workspaceLayouts', { hiddenModuleIds: [], groups: [], ungroupedModuleIds: [] });
  store.close();
  for (let run = 0; run < 2; run++) {
    const world = await createIntegration({ directory });
    try {
      const client = world.client();
      await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
      const login = await client.request('POST', '/api/auth/login', { body: { email: 'legacy@example.test', password: 'password-a11', rememberMe: true } });
      assert.equal(login.status, 200, login.text);
      assert.equal(login.json.account.accountKey, legacy.id);
      assert.equal(login.json.account.nickname, '旧账户');
      assert.equal(world.workbench.db.prepare("SELECT COUNT(*) n FROM workbench_migrations WHERE moduleId='auth'").get().n, 8);
      assert.equal(world.dataStore.forAccount(legacy.id).list('workspaceLayouts').length, 1);
    } finally { await world.close(); }
  }
});

test('legacy nickname gap stops startup without deriving a nickname from email', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a11-gap-'));
  const store = createDataStore({ sqlitePath: path.join(directory, 'workspace.sqlite') });
  store.createUser({ name: '', email: 'gap@example.test', passwordHash: hashPassword('password-a11'), role: 'teacher' });
  store.close();
  await assert.rejects(createIntegration({ directory }), /auth_legacy_gaps/);
});

import { startServer } from '../src/server.js';
import { generateSelfSignedCertificate } from './fixtures/auth-contract/harness.js';
test('real server waits for all migrations and refuses missing TLS configuration', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'a11-start-'));
  generateSelfSignedCertificate(directory);
  const env = { nodeEnv: 'test', port: 0, sqlitePath: path.join(directory, 'workspace.sqlite'), authCodeSecret: 'a11-start-secret',
    workbench: { publicOrigin: 'https://127.0.0.1', tls: { cert: path.join(directory, 'tls-cert.pem'), key: path.join(directory, 'tls-key.pem') } } };
  const running = await startServer({ env, sendCode: async () => {} });
  try {
    assert.equal(running.workbench.db.prepare("SELECT COUNT(*) n FROM workbench_migrations WHERE moduleId='auth'").get().n, 8);
    assert.ok(running.workbench.loader.enabledIds().includes('questions'));
    assert.notEqual(running.server.address().port, 0);
  } finally { await new Promise(resolve => running.server.close(resolve)); await running.workbench.close(); }
  await assert.rejects(startServer({ env: { ...env, workbench: { ...env.workbench, tls: null } }, sendCode: async () => {} }), /TLS_CERT/);
});


test('SPA deep links serve the fixed index from a hidden build directory without exposing hidden assets', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-hidden-web-'));
  const webDist = path.join(root, '.hidden-build', 'dist');
  fs.mkdirSync(webDist, { recursive: true });
  fs.writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><title>Workspace shell</title>');
  fs.writeFileSync(path.join(webDist, '.private'), 'PRIVATE BUILD FILE');
  const world = await createIntegration({ webDist });
  let passed = false;
  t.after(async () => { await world.close(); if (passed) { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(world.directory, { recursive: true, force: true }); } else console.error('Hidden build fixture retained:', root, world.directory); });
  const client = world.client();
  for (const route of ['/', '/settings']) {
    const response = await client.request('GET', route);
    assert.equal(response.status, 200, response.text);
    assert.ok(response.text.includes('Workspace shell'));
  }
  assert.ok(!(await client.request('GET', '/.private')).text.includes('PRIVATE BUILD FILE'));
  assert.equal((await client.request('GET', '/api/missing')).status, 404);
  passed = true;
});
