import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { startServer } from '../../src/server.js';
import { createClient } from '../fixtures/auth-contract/harness.js';
import { createWorld, register, ok, problem, questions, question, write, upload } from './helpers.js';

test('A-R3 删号接续：文件清理失败锁定账户，真实启动保留失败并在文件修复后无Cookie完成删除', async t => {
  const world = await createWorld(t), a = await register(world), b = await register(world);
  const saved = ok(await write(a.client, 'POST', questions, question()), 201);
  const kept = ok(await write(b.client, 'POST', questions, question({ title: '另一账户保留' })), 201);
  const file = ok(await upload(a.client, await sharp({ create: { width: 4, height: 4, channels: 3, background: '#333333' } }).png().toBuffer(), '删除原件.png'), 201);
  const blobName = world.app.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.id).blobName;
  const blob = path.join(world.directory, 'files', 'blobs', blobName), originalBytes = fs.readFileSync(blob);
  fs.unlinkSync(blob);
  fs.mkdirSync(blob);
  const deletion = { requestId: randomBytes(32).toString('hex'), sessionId: a.sessionId, email: a.email };
  problem(await a.client.request('POST', '/api/auth/account-deletion', { body: deletion }), 503, 'deletion-incomplete');
  problem(await a.client.request('GET', `${questions}/${saved.id}`), 401, 'unauthenticated');
  problem(await a.client.request('POST', '/api/auth/login', { body: { email: a.email, password: a.password, rememberMe: true } }), 401, 'credentials-rejected');
  const pending = world.app.workbench.db.prepare('SELECT filesJson,completedAt FROM auth_account_deletions WHERE accountKey=?').get(a.account.accountKey);
  assert.equal(pending.completedAt, null, '清理失败不可写完成回执');
  assert.ok(JSON.parse(pending.filesJson).blobs.includes(blobName), '失败必须持久保留受管文件清单');
  assert.equal(ok(await b.client.request('GET', `${questions}/${kept.id}`)).id, kept.id);
  const publicOrigin = world.app.origin;
  await world.app.close();
  let running;
  t.after(async () => { await running?.close(); });
  const options = {
    env: { nodeEnv: 'test', port: 0, sqlitePath: path.join(world.directory, 'workspace.sqlite'), authCodeSecret: 'isolated-test-code-secret',
      agent: { apiKey: '', baseUrl: 'http://127.0.0.1:1' },
      workbench: { publicOrigin, filesDir: path.join(world.directory, 'files'), logDir: path.join(world.directory, 'logs'),
        tls: { cert: path.join(world.directory, 'tls-cert.pem'), key: path.join(world.directory, 'tls-key.pem') } } },
    now: world.clock.now, sendCode: async () => {}, workbenchLogger: { info() {}, request() {}, error() {} }
  };
  const clientAtStartup = (previous) => createClient(running.origin, { transport: https, jar: previous?.jar, pageId: previous?.pageId });
  running = await startServer(options);
  assert.equal(running.workbench.db.prepare('SELECT COUNT(*) n FROM auth_account_deletions WHERE completedAt IS NULL').get().n, 1, '真实启动清理仍失败时保留原删除意图');
  problem(await clientAtStartup(a.client).request('GET', questions), 401, 'unauthenticated');
  assert.equal(ok(await clientAtStartup(b.client).request('GET', `${questions}/${kept.id}`)).id, kept.id);
  await running.close();
  running = null;
  fs.rmdirSync(blob);
  fs.writeFileSync(blob, originalBytes);
  running = await startServer(options);
  const db = running.workbench.db;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM auth_account_deletions WHERE completedAt IS NULL').get().n, 0, '文件修复后真实启动必须接续已受理删除');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM auth_accounts WHERE accountKey=?').get(a.account.accountKey).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM question_items WHERE accountKey=?').get(a.account.accountKey).n, 0);
  assert.equal(fs.existsSync(blob), false);
  assert.equal(ok(await clientAtStartup(b.client).request('GET', `${questions}/${kept.id}`)).id, kept.id);
  problem(await clientAtStartup().request('POST', '/api/auth/account-deletion', { body: deletion, origin: publicOrigin }), 401, 'session-invalid');
  ok(await clientAtStartup(a.client).request('POST', '/api/auth/account-deletion', { body: deletion, origin: publicOrigin }), 204, '只有原请求证明可确认启动已完成的删除');
  await running.close(); running = null;
});
