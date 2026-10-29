import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { createTestDirectory } from '../support/directories.js';
import { createIntegration } from '../support/application.js';
import { provider } from '../fixtures/c26/provider.js';
import { backup, restore, activate } from '../../src/workbench/reliability/backup.js';
import { moduleCatalog } from '@teachbuddy/shared';
import { createWorld, register, login, ok, write, bytes, questions, question, problem } from './helpers.js';

for (const ids of [[], ['schedule']]) test(`静态组合 ${ids.join(',') || '空目录'}：真实注册、保存与资料包`, async t => {
  let advertisedTools;
  const controlled = await provider([context => { advertisedTools = context.tools.map(tool => tool.name); return [{ type: 'text', text: '欢迎使用' }]; }]);
  const world = await createWorld(t, { agent: controlled.config, workbench: { catalogOverride: moduleCatalog.filter(entry => ids.includes(entry.id)) } });
  const account = await register(world), { client } = account;
  assert.deepEqual(world.app.workbench.loader.enabledIds(), ids);
  const conversation = ok(await write(client, 'POST', '/api/agent/conversations', {}), 201).conversation;
  ok(await write(client, 'PUT', `/api/agent/conversations/${conversation.id}/draft`, { baseVersion: 1, text: '保留的对话', references: [] }));
  let entry;
  if (ids.includes('schedule')) entry = ok(await write(client, 'POST', '/api/modules/schedule/entries', { title: '独立日程', items: [], time: null, repeat: null, reminder: null }), 201);
  const queued = ok(await write(client, 'POST', '/api/reliability/v1/exports', {}), 202);
  let result;
  for (let i = 0; i < 200; i++) {
    result = ok(await client.request('GET', `/api/reliability/v1/exports/${queued.id}`));
    if (!['queued', 'running'].includes(result.state)) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(result.state, 'ready', '最小组合仍可生成个人资料包');
  const archive = await JSZip.loadAsync((await bytes(client, result.downloadPath)).bytes);
  const manifest = JSON.parse(await archive.file('manifest.json').async('string'));
  assert.ok(manifest.objects.some(object => object.key.kind === 'conversation' && object.key.id === conversation.id));
  if (entry) assert.ok(manifest.objects.some(object => object.key.kind === 'entry' && object.key.id === entry.id));
  const chat = ok(await write(client, 'POST', '/api/agent/conversations', {}), 201).conversation;
  ok(await write(client, 'PUT', `/api/agent/conversations/${chat.id}/draft`, { baseVersion: 1, text: '你好', references: [] }));
  ok(await write(client, 'POST', `/api/agent/conversations/${chat.id}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
  let chatSnapshot;
  for (let i = 0; i < 200; i++) {
    chatSnapshot = ok(await client.request('GET', `/api/agent/conversations/${chat.id}`));
    if (chatSnapshot.turns[0].state !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(chatSnapshot.turns[0].state, 'completed');
  assert.deepEqual(advertisedTools, ['wb_propose_teaching_card'], '未装配题库时不向模型声明题库工具');
  await world.app.close();
  const root = createTestDirectory('composition-recovery-');
  let restored;
  t.after(async () => { await restored?.close(); if (t.passed) fs.rmSync(root, { recursive: true, force: true }); });
  const source = path.join(root, 'backup'), target = path.join(root, 'restored');
  await backup({ database: path.join(world.directory, 'workspace.sqlite'), files: path.join(world.directory, 'files'), target: source, stopped: true });
  restore({ source, target, stopped: true });
  activate({ target, stopped: true });
  restored = await createIntegration({ directory: target, workbench: { catalogOverride: moduleCatalog.filter(entry => ids.includes(entry.id)) } });
  const signed = await login({ client: () => restored.client() }, account);
  assert.equal(ok(await signed.client.request('GET', `/api/agent/conversations/${conversation.id}`)).draft.text, '保留的对话');
  if (entry) assert.equal(ok(await signed.client.request('GET', `/api/modules/schedule/entries/${entry.id}`)).title, '独立日程');
  ok(await signed.client.request('POST', '/api/auth/account-deletion', { body: { requestId: randomBytes(32).toString('hex'), sessionId: signed.sessionId, email: account.email } }), 204);
});


test('历史模块未开放：资料仍被导出、备份与删号维护，未知迁移拒绝启动', async t => {
  const world = await createWorld(t), account = await register(world);
  const saved = ok(await write(account.client, 'POST', questions, question({ title: '暂不开放仍保留' })), 201);
  await world.app.close();
  let reduced = await createIntegration({ directory: world.directory, workbench: { catalogOverride: [] } });
  t.after(() => reduced?.close());
  let signed = await login({ client: () => reduced.client() }, account);
  problem(await signed.client.request('GET', `${questions}/${saved.id}`), 404, 'not-found');
  const queued = ok(await write(signed.client, 'POST', '/api/reliability/v1/exports', {}), 202);
  let result;
  for (let i = 0; i < 200; i++) {
    result = ok(await signed.client.request('GET', `/api/reliability/v1/exports/${queued.id}`));
    if (!['queued', 'running'].includes(result.state)) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(result.state, 'ready', '历史模块资料不能静默遗漏');
  const zip = await JSZip.loadAsync((await bytes(signed.client, result.downloadPath)).bytes);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  assert.ok(manifest.objects.some(object => object.key.id === saved.id && object.key.kind === 'question'));
  assert.equal(reduced.workbench.db.prepare('SELECT title FROM question_items WHERE id=?').get(saved.id).title, saved.title);
  await reduced.close(); reduced = null;
  const root = createTestDirectory('dormant-recovery-');
  t.after(() => { if (t.passed) fs.rmSync(root, { recursive: true, force: true }); });
  const source = path.join(root, 'backup'), target = path.join(root, 'restored');
  await backup({ database: path.join(world.directory, 'workspace.sqlite'), files: path.join(world.directory, 'files'), target: source, stopped: true });
  restore({ source, target, stopped: true });
  activate({ target, stopped: true });
  const recovered = await createIntegration({ directory: target, workbench: { catalogOverride: [] } });
  try { assert.equal(recovered.workbench.db.prepare('SELECT title FROM question_items WHERE id=?').get(saved.id).title, saved.title); }
  finally { await recovered.close(); }
  reduced = await createIntegration({ directory: world.directory, workbench: { catalogOverride: [] } });
  signed = await login({ client: () => reduced.client() }, account);
  const body = { requestId: randomBytes(32).toString('hex'), sessionId: signed.sessionId, email: account.email };
  ok(await signed.client.request('POST', '/api/auth/account-deletion', { body }), 204);
  ok(await signed.client.request('POST', '/api/auth/account-deletion', { body }), 204);
  assert.equal(reduced.workbench.db.prepare('SELECT count(*) AS n FROM question_items').get().n, 0);
  await reduced.close(); reduced = null;
  const db = new Database(path.join(world.directory, 'workspace.sqlite'));
  db.prepare('INSERT INTO workbench_migrations VALUES (?,?,?)').run('questions_9999_future', 'questions', new Date().toISOString());
  db.close();
  await assert.rejects(createIntegration({ directory: world.directory, workbench: { catalogOverride: [] } }), /Applied migrations are no longer defined/, '未开放模块中的未知迁移仍须拒绝');
});


test('存储拥有者账本丢失：拒绝备份、恢复和空目录启动，不把已存题目当作空模块', async t => {
  const world = await createWorld(t), account = await register(world);
  const saved = ok(await write(account.client, 'POST', questions, question({ title: '账本损坏仍须保护' })), 201);
  await world.app.close();
  const root = createTestDirectory('missing-owner-ledger-');
  t.after(() => { if (t.passed) fs.rmSync(root, { recursive: true, force: true }); });
  const database = path.join(world.directory, 'workspace.sqlite'), source = path.join(root, 'source');
  await backup({ database, files: path.join(world.directory, 'files'), target: source, stopped: true });
  for (const file of [database, path.join(source, 'workspace.sqlite')]) {
    const db = new Database(file);
    db.prepare("DELETE FROM workbench_migrations WHERE moduleId='questions'").run();
    assert.equal(db.prepare('SELECT title FROM question_items WHERE id=?').get(saved.id).title, saved.title);
    db.close();
  }
  // Make a physically valid archived copy of the same damaged ledger. This
  // reaches semantic storage validation rather than checksum rejection.
  const manifestPath = path.join(source, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const archived = fs.readFileSync(path.join(source, 'workspace.sqlite'));
  manifest.database.bytes = archived.length;
  manifest.database.sha256 = createHash('sha256').update(archived).digest('hex');
  manifest.migrationIds = manifest.migrationIds.filter(id => !id.startsWith('questions_'));
  manifest.schemas = manifest.schemas.filter(schema => !schema.name.startsWith('document-'));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  await t.test('维护备份拒绝缺失拥有者账本', async () => {
    await assert.rejects(backup({ database, files: path.join(world.directory, 'files'), target: path.join(root, 'invalid-backup'), stopped: true }), /storage.*ledger|ledger.*storage/i);
  });
  await t.test('离线恢复拒绝缺失拥有者账本', () => {
    assert.throws(() => restore({ source, target: path.join(root, 'invalid-restore'), stopped: true }), /storage.*ledger|ledger.*storage/i);
  });
  await t.test('空目录启动拒绝缺失拥有者账本', async () => {
    await assert.rejects(createIntegration({ directory: world.directory, workbench: { catalogOverride: [] } }).then(app => app.close()), /storage.*ledger|ledger.*storage/i);
  });
  const preserved = new Database(database, { readonly: true });
  try { assert.equal(preserved.prepare('SELECT title FROM question_items WHERE id=?').get(saved.id).title, saved.title); }
  finally { preserved.close(); }
});


test('静态装配保留班级公共 operations，可信调用保存后可经 HTTP 读取并原键核实', async t => {
  const world = await createWorld(t), account = await register(world);
  const operations = world.app.workbench.loader.get('classroom').operations;
  assert.equal(typeof operations?.createClass, 'function', '装配不得丢弃模块现有公共调用面');
  const input = { principal: { accountKey: account.account.accountKey }, key: randomUUID(), arguments: { body: { name: '公开端口创建的班级' } } };
  const created = await operations.createClass(input);
  assert.equal(created.status, 201);
  assert.equal(ok(await account.client.request('GET', `/api/modules/classroom/classes/${created.body.id}`)).name, '公开端口创建的班级');
  assert.deepEqual(await operations.createClass(input), created);
});
