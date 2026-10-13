import assert from 'node:assert/strict';
import test from 'node:test';
import { startServer } from '../src/server.js';
import https from 'node:https';
import { createClient } from './fixtures/auth-contract/harness.js';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { createIntegration as createAgentIntegration } from './fixtures/c26/harness.js';
import { provider } from './fixtures/c26/provider.js';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { manualQuestionSample, lessonSample } from './first-flow-harness.js';
import { unscheduledEntry } from './fixtures/teaching-time-schedule/samples.js';

const password = 'delete-account-test-password';
const write = (client, method, route, body, key = randomUUID()) =>
  client.request(method, route, { body, headers: { 'Idempotency-Key': key } });
const deletionBody = session => ({ requestId: randomBytes(32).toString('hex'), sessionId: session.id, email: session.account.email });
const remove = (client, body) => client.request('POST', '/api/auth/account-deletion', { body });
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function register(world, email) {
  const client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const code = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  assert.equal(code.status, 200, code.text);
  const result = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '删除测试教师', password, termsAccepted: true, rememberMe: true,
    challengeId: code.json.challengeId, verificationCode: world.mailer.lastCode('registration', email),
  } });
  assert.equal(result.status, 201, result.text);
  assert.equal((await client.request('POST', '/api/auth/session', { body: {
    action: 'activate', sessionId: result.json.id, rememberMe: true,
  } })).status, 200);
  return { client, session: result.json, principal: { accountKey: result.json.account.accountKey } };
}
async function upload(client, name = 'source.txt') {
  return client.request('POST', '/api/workbench/files', {
    rawBody: Buffer.from(`--deletion\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\n同一文件内容\r\n--deletion--\r\n`),
    contentType: 'multipart/form-data; boundary=deletion', headers: { 'Idempotency-Key': randomUUID() },
  });
}
async function seed(world, owner) {
  const { client, principal } = owner;
  for (const [route, body] of [
    ['/api/modules/classes/items', { name: '中文班级名' }],
    ['/api/modules/questions/items', manualQuestionSample()],
    ['/api/modules/lessons/items', lessonSample()],
    ['/api/modules/schedule/entries', unscheduledEntry()],
    ['/api/agent/conversations', {}],
  ]) {
    const result = await write(client, 'POST', route, body);
    assert.equal(result.status, 201, result.text);
  }
  const pref = (await client.request('GET', '/api/reliability/v1/preferences')).json;
  assert.equal((await write(client, 'PUT', '/api/reliability/v1/preferences', { baseVersion: pref.version, values: { ...pref.values, locale: 'en' } })).status, 200);
  const db = world.workbench.db;
  const conversation = db.prepare('SELECT id FROM agent_conversations WHERE accountKey=?').get(principal.accountKey).id;
  db.prepare('INSERT INTO agent_events VALUES (?,1,?)').run(conversation, '{"text":"仅此账户事件"}');
  const workId = randomUUID();
  db.prepare('INSERT INTO math_works VALUES (?,?,?)').run(workId, principal.accountKey, '{}');
  db.prepare('INSERT INTO math_revisions VALUES (?,1,?)').run(workId, '{"body":"旧版本"}');
  const entryId = db.prepare('SELECT id FROM schedule_entries WHERE accountKey=?').get(principal.accountKey).id;
  db.prepare('INSERT INTO schedule_exceptions VALUES (?,?,?,?,?,?)').run(entryId, '2026-09-28', 'cancelled', null, 'now', 'now');
  db.prepare('INSERT INTO schedule_instance_arms VALUES (?,?,?)').run(entryId, '2026-09-28', 'now');
  const file = await upload(client);
  assert.equal(file.status, 201, file.text);
  const temporary = world.workbench.files.temporaryDirectory(principal, 'failed-conversion-');
  fs.writeFileSync(path.join(temporary, 'original'), '临时原件');
  return { file: file.json, temporary, conversation, workId, entryId };
}
function noAccountRows(db, accountKey) {
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
    if (!db.prepare(`PRAGMA table_info("${name}")`).all().some(column => column.name === 'accountKey')) continue;
    assert.equal(db.prepare(`SELECT count(*) AS n FROM "${name}" WHERE accountKey=?`).get(accountKey).n, 0, name);
  }
}

test('real HTTPS deletion removes owned rows/files, invalidates every session, preserves another account and permits fresh registration', async t => {
  const world = await createIntegration();
  t.after(() => world.close());
  const a = await register(world, 'delete-a@example.test');
  const b = await register(world, 'delete-b@example.test');
  const owned = await seed(world, a), other = await seed(world, b);
  const accountId = world.workbench.db.prepare('SELECT id FROM auth_accounts WHERE accountKey=?').get(a.principal.accountKey).id;
  const extra = world.client();
  await extra.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const pending = await extra.request('POST', '/api/auth/login', { body: { email: a.session.account.email, password, rememberMe: true } });
  assert.equal(pending.status, 200);
  const body = deletionBody(a.session);
  assert.equal((await remove(b.client, body)).status, 401);
  assert.equal((await remove(a.client, { ...body, email: b.session.account.email })).status, 422);
  assert.equal((await a.client.request('POST', '/api/auth/account-deletion', { body, origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await a.client.request('GET', '/api/workbench/context')).status, 200);
  const result = await remove(a.client, body);
  assert.equal(result.status, 204, result.text);
  assert.equal((await remove(a.client, body)).status, 204);
  const db = world.workbench.db;
  noAccountRows(db, a.principal.accountKey);
  for (const [table, column, id] of [['agent_events', 'conversationId', owned.conversation], ['math_revisions', 'workId', owned.workId], ['schedule_exceptions', 'entryId', owned.entryId], ['schedule_instance_arms', 'entryId', owned.entryId]])
    assert.equal(db.prepare(`SELECT count(*) n FROM ${table} WHERE ${column}=?`).get(id).n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM auth_challenges WHERE email=?').get(body.email).n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM auth_sessions WHERE accountId=?').get(accountId).n, 0);
  assert.equal(fs.existsSync(owned.temporary), false);
  assert.equal((await a.client.request('GET', '/api/workbench/context')).status, 401);
  assert.equal((await extra.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: pending.json.id, rememberMe: true } })).status, 401);
  assert.equal((await extra.request('POST', '/api/auth/login', { body: { email: body.email, password, rememberMe: true } })).status, 401);
  assert.equal((await b.client.request('GET', '/api/workbench/context')).status, 200);
  assert.equal((await b.client.request('GET', `/api/workbench/files/${other.file.id}/content`)).status, 200);
  assert.equal((await b.client.request('GET', '/api/reliability/v1/preferences')).json.values.locale, 'en');
  assert.equal(fs.existsSync(other.temporary), true);
  const receipt = db.prepare('SELECT * FROM auth_account_deletions').get();
  assert.equal(receipt.accountKey, null); assert.equal(receipt.accountId, null); assert.equal(receipt.filesJson, null);
  assert.ok(!JSON.stringify(receipt).includes(body.email));
  const fresh = await register(world, body.email);
  assert.notEqual(fresh.principal.accountKey, a.principal.accountKey);
  assert.equal((await fresh.client.request('GET', '/api/modules/classes/items')).json.items.length, 0);
});

test('filesystem failure stays locked across restart; only the cookie-bound original request can continue', async t => {
  let world = await createIntegration();
  const directory = world.directory;
  t.after(() => world.close());
  const a = await register(world, 'retry-delete@example.test');
  const b = await register(world, 'retry-other@example.test');
  const file = await upload(a.client);
  const blob = path.join(directory, 'files', 'blobs', world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.json.id).blobName);
  const bytes = fs.readFileSync(blob); fs.unlinkSync(blob); fs.mkdirSync(blob);
  const body = deletionBody(a.session);
  assert.equal((await remove(a.client, body)).status, 503);
  assert.equal((await a.client.request('GET', '/api/workbench/context')).status, 401);
  assert.equal((await remove(b.client, body)).status, 401);
  const jar = a.client.jar;
  await world.close();
  await assert.rejects(backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target: directory + '-pending-backup', stopped: true }), error => error.code === 'AUTH_RECOVERY_PRECONDITION');
  assert.equal(fs.existsSync(directory + '-pending-backup'), false);
  world = await createIntegration({ directory });
  const retry = world.client(); retry.jar = jar;
  assert.equal((await retry.request('POST', '/api/auth/login', { body: { email: body.email, password, rememberMe: true } })).status, 401);
  assert.equal((await remove(retry, body)).status, 503);
  fs.rmdirSync(blob); fs.writeFileSync(blob, bytes);
  assert.equal((await remove(retry, body)).status, 204);
  noAccountRows(world.workbench.db, a.principal.accountKey);
  assert.equal(fs.existsSync(blob), false);
});

test('an upload authorized before deletion cannot store bytes or a receipt afterward', async t => {
  const world = await createIntegration(); t.after(() => world.close());
  const a = await register(world, 'upload-delete@example.test');
  const started = gate(), release = gate();
  const original = world.workbench.files.store;
  world.workbench.files.store = async (...args) => { started.resolve(); await release.promise; return original(...args); };
  const late = upload(a.client);
  await started.promise;
  assert.equal((await remove(a.client, deletionBody(a.session))).status, 204);
  release.resolve();
  assert.equal((await late).status, 401);
  noAccountRows(world.workbench.db, a.principal.accountKey);
  assert.equal(fs.readdirSync(path.join(world.directory, 'files', 'blobs')).length, 0);
});

test('deletion waits for cancelled jobs to settle and lets another account queue continue', async t => {
  const started = gate(), aborted = gate(), release = gate(), otherDone = gate();
  let target;
  const world = await createIntegration({ workbench: { jobHandlers: { export: { async run({ principal, signal }) {
    if (principal.accountKey === target) {
      started.resolve(); signal.addEventListener('abort', aborted.resolve, { once: true });
      await release.promise;
    } else otherDone.resolve();
    return { state: 'succeeded', outputFileIds: [], issues: [] };
  } } } } });
  t.after(() => world.close());
  const a = await register(world, 'job-delete@example.test'), b = await register(world, 'job-other@example.test');
  target = a.principal.accountKey;
  function enqueue(owner) {
    return world.workbench.mutations.execute({ principal: owner.principal, key: randomUUID(), method: 'POST', path: '/internal/test-job', body: {} }, () => ({ status: 202,
      body: world.workbench.jobs.enqueue({ principal: owner.principal, kind: 'export', target: { kind: 'lesson', id: randomUUID(), version: 1 } }) }));
  }
  enqueue(a); await started.promise; const other = enqueue(b).body;
  let completed = false;
  const deletion = remove(a.client, deletionBody(a.session)).then(result => { completed = true; return result; });
  await aborted.promise;
  assert.equal(completed, false);
  assert.throws(() => world.workbench.mutations.execute({ principal: a.principal, key: randomUUID(), method: 'POST', path: '/internal/late', body: {} }, () => ({ status: 200, body: {} })), error => error.status === 401);
  release.resolve();
  assert.equal((await deletion).status, 204); await otherDone.promise;
  assert.equal(world.workbench.jobs.get(b.principal, other.id).state, 'succeeded');
  noAccountRows(world.workbench.db, target);
});


test('completed deletion receipts permit a healthy account backup and are cleared durably on restore', async t => {
  let world = await createIntegration();
  const source = world.directory, target = source + '-backup', restored = source + '-restored';
  t.after(async () => { if (world) await world.close(); });
  const a = await register(world, 'backup-deleted@example.test');
  const b = await register(world, 'backup-healthy@example.test');
  const file = await upload(b.client, 'healthy.txt');
  assert.equal(file.status, 201);
  const question = await write(b.client, 'POST', '/api/modules/questions/items', manualQuestionSample());
  assert.equal(question.status, 201, question.text);
  assert.equal((await remove(a.client, deletionBody(a.session))).status, 204);
  const healthyAccount = world.workbench.db.prepare('SELECT * FROM auth_accounts WHERE accountKey=?').get(b.principal.accountKey);
  await world.close(); world = null;
  assert.equal((await backup({ database: path.join(source, 'workspace.sqlite'), files: path.join(source, 'files'), target, stopped: true })).state, 'backed-up');
  const receipt = restore({ source: target, target: restored, stopped: true });
  assert.equal(receipt.auth.first.contractRevision, 'auth-recovery/2');
  assert.equal(receipt.auth.first.removed.deletions, 1);
  for (const counts of [receipt.auth.first.remaining, receipt.auth.second.removed, receipt.auth.second.remaining]) {
    assert.deepEqual(Object.keys(counts).sort(), ['challenges', 'containers', 'deletions', 'pageBindings', 'sessions']);
    assert.ok(Object.values(counts).every(value => value === 0));
  }
  for (let reopen = 0; reopen < 2; reopen++) {
    const db = new Database(path.join(restored, 'workspace.sqlite'), { readonly: true });
    assert.deepEqual(db.prepare('SELECT * FROM auth_accounts WHERE accountKey=?').get(b.principal.accountKey), healthyAccount);
    assert.equal(db.prepare('SELECT count(*) n FROM auth_account_deletions').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) n FROM auth_accounts WHERE accountKey=?').get(a.principal.accountKey).n, 0);
    db.close();
  }
  const original = new Database(path.join(source, 'workspace.sqlite'), { readonly: true });
  assert.equal(original.prepare('SELECT count(*) n FROM auth_account_deletions').get().n, 1);
  original.close();
  activate({ target: restored, stopped: true });
  world = await createIntegration({ directory: restored });
  const client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const login = await client.request('POST', '/api/auth/login', { body: { email: b.session.account.email, password, rememberMe: true } });
  assert.equal(login.status, 200, login.text);
  assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: login.json.id, rememberMe: true } })).status, 200);
  assert.equal((await client.request('GET', '/api/workbench/files/' + file.json.id + '/content')).status, 200);
  assert.equal((await client.request('GET', '/api/modules/questions/items/' + question.json.id)).status, 200);
});


test('real Agent SDK abort settles before account erasure and another account remains usable', async t => {
  const started = gate(), aborted = gate(), release = gate();
  const p = await provider([async (_context, options) => {
    started.resolve();
    await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }));
    aborted.resolve(); await release.promise; throw new Error('aborted');
  }]);
  const world = await createAgentIntegration({ agent: p.config });
  t.after(() => world.close());
  const a = await register(world, 'agent-deleted@example.test'), b = await register(world, 'agent-healthy@example.test');
  const created = await write(a.client, 'POST', '/api/agent/conversations', {});
  const route = '/api/agent/conversations/' + created.json.conversation.id;
  assert.equal((await write(a.client, 'PUT', route + '/draft', { baseVersion: 1, text: '等待删除验证', references: [] })).status, 200);
  assert.equal((await write(a.client, 'POST', route + '/turns', { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' })).status, 202);
  await started.promise;
  let completed = false;
  const deletion = remove(a.client, deletionBody(a.session)).then(result => { completed = true; return result; });
  await aborted.promise;
  assert.equal(completed, false);
  assert.equal((await b.client.request('GET', '/api/workbench/context')).status, 200);
  release.resolve();
  assert.equal((await deletion).status, 204);
  noAccountRows(world.workbench.db, a.principal.accountKey);
  assert.equal(world.workbench.db.prepare('SELECT count(*) n FROM agent_events').get().n, 0);
  assert.equal(p.requests(), 1);
});


for (const pending of [true, false]) test(`late logout preserves original deletion verification for ${pending ? 'pending' : 'completed'} deletion`, async t => {
  const world = await createIntegration();
  t.after(() => world.close());
  const a = await register(world, `cookie-${pending}@example.test`);
  const other = await register(world, `other-cookie-${pending}@example.test`);
  const oldPage = world.client(); oldPage.jar = a.client.jar;
  const file = await upload(a.client);
  const blob = path.join(world.directory, 'files', 'blobs', world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.json.id).blobName);
  const bytes = fs.readFileSync(blob);
  if (pending) { fs.unlinkSync(blob); fs.mkdirSync(blob); }
  const body = deletionBody(a.session), cookie = a.client.jar.header();
  const accepted = await remove(a.client, body);
  assert.equal(accepted.status, pending ? 503 : 204, accepted.text);
  // Treat the first completed response as lost: only the original continuation
  // proves completion; a late logout must not erase its HttpOnly credential.
  const logout = await oldPage.request('POST', '/api/auth/logout', { body: { sessionId: a.session.id } });
  assert.equal(logout.status, 204);
  assert.equal(a.client.jar.header(), cookie);
  assert.equal(logout.headers['set-cookie'], undefined);
  assert.equal((await oldPage.request('GET', '/api/workbench/context')).status, 401);
  assert.equal((await other.client.request('GET', '/api/workbench/context')).status, 200);
  assert.equal((await remove(other.client, body)).status, 401);
  assert.equal((await remove(a.client, { ...body, requestId: randomBytes(32).toString('hex') })).status, 401);
  if (pending) { fs.rmdirSync(blob); fs.writeFileSync(blob, bytes); }
  assert.equal((await remove(a.client, body)).status, 204);
  noAccountRows(world.workbench.db, a.principal.accountKey);
  assert.equal(fs.existsSync(blob), false);
  assert.equal((await other.client.request('POST', '/api/auth/logout', { body: { sessionId: other.session.id } })).status, 204);
  assert.equal(other.client.jar.size(), 0);
});

// Exercise the real startup entry, rather than teaching the shared harness a
// second initialization path. Cookie loss does not authorize browser cleanup.
test('real startup resumes accepted deletion once, preserves failures and other accounts without original Cookie', async t => {
  let world = await createIntegration();
  let running, verified = false;
  const directory = world.directory;
  t.after(async () => {
    if (running) await running.close();
    if (world) await world.close();
    if (verified) fs.rmSync(directory, { recursive: true, force: true });
  });
  const a = await register(world, 'startup-delete@example.test');
  const b = await register(world, 'startup-healthy@example.test');
  const file = await upload(a.client);
  const blob = path.join(directory, 'files', 'blobs', world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.json.id).blobName);
  const bytes = fs.readFileSync(blob); fs.unlinkSync(blob); fs.mkdirSync(blob);
  const body = deletionBody(a.session);
  assert.equal((await remove(a.client, body)).status, 503);
  const origin = world.origin;
  const env = { nodeEnv: 'test', port: 0,
    sqlitePath: path.join(directory, 'workspace.sqlite'), authCodeSecret: 'isolated-a11-test-secret',
    workbench: { publicOrigin: origin, filesDir: path.join(directory, 'files'),
      tls: { cert: path.join(directory, 'tls-cert.pem'), key: path.join(directory, 'tls-key.pem') } } };
  await world.close(); world = null;
  const now = () => Date.parse('2026-01-05T09:00:00.000Z');
  const start = () => startServer({ env, now, sendCode: async () => {}, workbenchLogger: { info() {}, request() {}, error() {} } });
  running = await start();
  assert.equal(running.workbench.db.prepare('SELECT count(*) n FROM auth_account_deletions WHERE completedAt IS NULL').get().n, 1);
  const healthy = createClient(running.origin, { transport: https, jar: b.client.jar, pageId: b.client.pageId });
  assert.equal((await healthy.request('GET', '/api/workbench/context')).status, 200);
  assert.equal((await createClient(running.origin, { transport: https, jar: a.client.jar, pageId: a.client.pageId }).request('GET', '/api/workbench/context')).status, 401);
  const saved = running.workbench.db.prepare('SELECT filesJson FROM auth_account_deletions').get().filesJson;
  assert.ok(saved);
  await running.close(); running = null;
  fs.rmdirSync(blob); fs.writeFileSync(blob, bytes);
  running = await start();
  assert.equal(running.workbench.db.prepare('SELECT count(*) n FROM auth_account_deletions WHERE completedAt IS NULL').get().n, 0);
  noAccountRows(running.workbench.db, a.principal.accountKey);
  assert.equal(fs.existsSync(blob), false);
  const other = createClient(running.origin, { transport: https, jar: b.client.jar, pageId: b.client.pageId });
  assert.equal((await other.request('GET', '/api/workbench/context')).status, 200);
  // A different browser still cannot obtain a deletion receipt, while the
  // surviving original proof can confirm startup's completed work.
  const anonymous = createClient(running.origin, { transport: https });
  assert.equal((await anonymous.request('POST', '/api/auth/account-deletion', { body, origin })).status, 401);
  const original = createClient(running.origin, { transport: https, jar: a.client.jar, pageId: a.client.pageId });
  assert.equal((await original.request('POST', '/api/auth/account-deletion', { body, origin })).status, 204);
  verified = true;
});
