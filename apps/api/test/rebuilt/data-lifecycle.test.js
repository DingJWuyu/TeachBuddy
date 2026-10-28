import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTestDirectory } from '../support/directories.js';
import path from 'node:path';
import https from 'node:https';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import JSZip from 'jszip';
import { backup, restore, activate } from '../../src/workbench/reliability/backup.js';
import { createIntegration } from '../support/application.js';
import { createClient } from '../fixtures/auth-contract/harness.js';
import { provider } from '../fixtures/c26/provider.js';
import { createWorld, register, login, anotherPage, ok, problem, questions, question, editable, write, upload, bytes, classes } from './helpers.js';
import { roster, assessment } from './classroom-fixture.js';

const hash = value => createHash('sha256').update(value).digest('hex');
async function finished(client, url) {
  for (let i = 0; i < 200; i++) {
    const record = ok(await client.request('GET', url));
    if (!['queued', 'running'].includes(record.state)) return record;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('个人资料导出未进入终态');
}
async function seed(client) {
  const fileBytes = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#123456' } }).png().toBuffer();
  const file = ok(await upload(client, fileBytes, '备份原件.png'), 201);
  const resource = ok(await write(client, 'POST', '/api/modules/resources/items', { title: '保留原件', folderId: null, tagIds: [], note: '资料说明', fileId: file.id }), 201);
  const q = ok(await write(client, 'POST', questions, question({ title: '归档题 <script>教师原文</script>', note: '教学原文可以包含 passwordHash、verificationCode、journals 和 __Host-teachbuddy_session 字样' })), 201);
  ok(await write(client, 'POST', `${questions}/${q.id}/deletion`, { baseVersion: 1, deleted: true }));
  const c = ok(await write(client, 'POST', `${classes}/classes`, { name: '备份班级' }), 201);
  return { fileBytes, file, resource, q, c };
}

test('个人包：只含本账户快照、归档/来源/原件与静态索引，全部清单摘要匹配，删除包不删教学资料', async t => {
  const world = await createWorld(t), a = await register(world), b = await register(world);
  const { fileBytes, file, resource, q, c } = await seed(a.client);
  const sourceQuestion = ok(await write(a.client, 'POST', questions, question({ title: '改编来源原文' })), 201);
  const copied = ok(await write(a.client, 'POST', `${questions}/${sourceQuestion.id}/copies`, { ...editable(sourceQuestion), title: '采用的改编', baseVersion: 1 }), 201);
  const { c: scoreClass, students } = await roster(a.client);
  const assessmentData = await assessment(a.client, scoreClass, students);
  const result = ok(await write(a.client, 'POST', `${classes}/imports/${assessmentData.mapped.id}/confirmation`, { baseVersion: assessmentData.mapped.version })).result;
  const record = ok(await write(a.client, 'POST', `${classes}/records`, { scope: 'class', subjectId: scoreClass.id, occurredOn: '2026-01-05', text: '课堂观察原文' }), 201);
  const formula = { schemaVersion: 1, kind: 'formula', latex: 'x^2+1', caption: '旧版说明', includeCaption: true, color: '#000000', fontSize: 24 };
  const work = ok(await write(a.client, 'POST', '/api/modules/math/v1/works', { title: '公式源码', source: formula, originalFileId: null }), 201);
  ok(await write(a.client, 'PUT', `/api/modules/math/v1/works/${work.id}`, { baseVersion: work.version, title: work.title, source: { ...formula, latex: 'x^2+2' } }));
  const entry = ok(await write(a.client, 'POST', '/api/modules/schedule/entries', { title: '导出日程', items: [], time: null, repeat: null, reminder: null }), 201);
  const conversation = ok(await write(a.client, 'POST', '/api/agent/conversations', {}), 201).conversation;
  ok(await write(a.client, 'PUT', `/api/agent/conversations/${conversation.id}/draft`, { baseVersion: 1, text: '已上传服务器草稿', references: [] }));
  const secretQuestion = ok(await write(b.client, 'POST', questions, question({ title: 'OTHER_ACCOUNT_SECRET' })), 201);
  const key = '6bbf441f-c101-453b-944f-f7d611c08b9e';
  const queued = ok(await write(a.client, 'POST', '/api/reliability/v1/exports', {}, key), 202);
  ok(await write(a.client, 'PUT', `${questions}/${sourceQuestion.id}`, { ...editable(sourceQuestion), title: '快照后修改不应进入本包', baseVersion: sourceQuestion.version }));
  const url = `/api/reliability/v1/exports/${queued.id}`;
  const ready = await finished(a.client, url);
  assert.equal(ready.state, 'ready', JSON.stringify(ready.problem));
  assert.deepEqual(ok(await write(a.client, 'POST', '/api/reliability/v1/exports', {}, key), 202), queued, '重放确认原受理结果');
  problem(await b.client.request('GET', url), 404, 'not-found');
  const download = await bytes(a.client, `${url}/content`);
  assert.equal(download.status, 200);
  const zip = await JSZip.loadAsync(download.bytes);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const index = await zip.file('index.html').async('string');
  assert.doesNotMatch(index, /<script(?:\s|>)/i, '阅读索引不执行教师原文');
  const allJson = [];
  for (const object of manifest.objects) {
    const record = JSON.parse(await zip.file(object.dataPath).async('string'));
    allJson.push(record);
  }
  assert.ok(allJson.some(r => r.kind === 'question' && r.value.id === q.id && r.value.deletedAt), '个人包包含归档题');
  assert.ok(allJson.some(r => r.kind === 'resource' && r.value.id === resource.id));
  assert.ok(allJson.some(r => r.kind === 'classroom-class' && r.value.id === c.id));
  assert.equal(allJson.find(r => r.kind === 'question' && r.value.id === sourceQuestion.id).value.title, sourceQuestion.title, '导出按受理时一致快照固定内容');
  assert.deepEqual(allJson.find(r => r.kind === 'question' && r.value.id === copied.id).value.source, copied.source, '资料包保存采用时的来源快照');
  for (const [kind, id] of [['classroom-student', students[0].id], ['classroom-exam', assessmentData.exam.id], ['classroom-tag', assessmentData.tag.id], ['classroom-import', assessmentData.mapped.id], ['classroom-result', result.id], ['classroom-record', record.id], ['math', work.id], ['entry', entry.id], ['conversation', conversation.id]]) {
    assert.ok(allJson.some(r => r.kind === kind && (r.value.id ?? r.value.entry?.id ?? r.value.conversation?.id) === id), `个人包包含 ${kind}`);
  }
  const revisions = allJson.filter(r => r.kind === 'math-revision');
  assert.ok(revisions.some(r => r.value.source.latex === 'x^2+1'), '数学旧源码版本进入个人包');
  assert.ok(revisions.some(r => r.value.source.latex === 'x^2+2'), '数学当前源码版本进入个人包');
  assert.equal(allJson.find(r => r.kind === 'conversation').value.draft.text, '已上传服务器草稿');
  assert.ok(!JSON.stringify(allJson).includes(secretQuestion.id), '个人包不含异账户对象');
  for (const entry of manifest.files) {
    const payload = await zip.file(entry.path).async('nodebuffer');
    assert.equal(payload.length, entry.bytes, `长度 ${entry.path}`);
    assert.equal(hash(payload), entry.sha256, `摘要 ${entry.path}`);
  }
  const attachment = Object.keys(zip.files).find(p => p.startsWith(`files/${file.id}/`) && !zip.files[p].dir);
  assert.ok(attachment, '包内必须有原件字节');
  assert.deepEqual(await zip.file(attachment).async('nodebuffer'), fileBytes);
  assert.equal(allJson.find(r => r.kind === 'question' && r.value.id === q.id).value.note, q.note, '秘密过滤不能破坏教师历史原文');
  const propertyNames = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) { propertyNames.add(name); visit(child); }
  };
  visit(allJson);
  for (const secret of ['passwordHash', 'verificationCode', 'journals', 'auth_accounts', 'entries']) assert.ok(!propertyNames.has(secret), `个人包不携内部字段 ${secret}`);
  const deleted = ok(await write(a.client, 'POST', `${url}/deletion`, {}));
  assert.equal(deleted.deleted, true);
  problem(await a.client.request('GET', url), 404, 'not-found');
  assert.equal((await bytes(a.client, `${url}/content`)).status, 404);
  assert.deepEqual((await bytes(a.client, `/api/workbench/files/${file.id}/content`)).bytes, fileBytes);
  assert.equal(ok(await a.client.request('GET', `/api/modules/resources/items/${resource.id}`)).id, resource.id);
});

test('个人包：原件缺失必须失败，保留原业务并允许文件修复后新请求重试', async t => {
  const world = await createWorld(t), a = await register(world);
  const { file, resource } = await seed(a.client);
  const row = world.app.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.id);
  const original = path.join(world.directory, 'files', 'blobs', row.blobName), hidden = original + '.missing';
  fs.renameSync(original, hidden);
  try {
    const pending = ok(await write(a.client, 'POST', '/api/reliability/v1/exports', {}), 202);
    const failed = await finished(a.client, `/api/reliability/v1/exports/${pending.id}`);
    assert.equal(failed.state, 'failed', '缺原件不能产出伪完整资料包');
    assert.equal(failed.downloadPath, null);
    assert.ok(failed.problem);
    assert.equal(ok(await a.client.request('GET', `/api/modules/resources/items/${resource.id}`)).id, resource.id);
  } finally { fs.renameSync(hidden, original); }
  const retry = ok(await write(a.client, 'POST', '/api/reliability/v1/exports', {}), 202);
  assert.equal((await finished(a.client, `/api/reliability/v1/exports/${retry.id}`)).state, 'ready');
});

test('维护恢复：停服锁、完整数据库与文件、独立准备/启用、恢复点轮换和全部旧身份撤销', async t => {
  const world = await createWorld(t), a = await register(world), b = await register(world);
  const seeded = await seed(a.client);
  const originalContext = ok(await a.client.request('GET', '/api/reliability/v1/context'));
  const root = createTestDirectory('rebuilt-restore-');
  let restored;
  t.after(async () => { await restored?.close(); if (t.passed) fs.rmSync(root, { recursive: true, force: true }); else console.error(`恢复证据保留: ${root}`); });
  const input = { database: path.join(world.directory, 'workspace.sqlite'), files: path.join(world.directory, 'files'), target: path.join(root, 'backup'), stopped: true };
  await assert.rejects(backup(input), /lock|use|running|held/i, '运行中不能复制部署库');
  await world.app.close();
  const saved = await backup(input);
  assert.equal(saved.state, 'backed-up');
  const manifestBytes = fs.readFileSync(path.join(input.target, 'manifest.json'));
  const sourceHash = hash(fs.readFileSync(input.database));
  const target = path.join(root, 'restored');
  const prepared = restore({ source: input.target, target, stopped: true });
  assert.equal(prepared.state, 'prepared');
  assert.notEqual(prepared.recoveryId, originalContext.recoveryId);
  assert.ok(Object.values(prepared.auth.first.remaining).every(n => n === 0));
  assert.ok(Object.values(prepared.auth.second.removed).every(n => n === 0));
  await assert.rejects(createIntegration({ directory: target }), /explicit activation/, '未启用副本不能开放');
  const active = activate({ target, stopped: true });
  assert.equal(active.state, 'activated');
  restored = await createIntegration({ directory: target, clock: world.clock });
  const old = createClient(restored.origin, { transport: https, jar: a.client.jar, pageId: a.client.pageId });
  problem(await old.request('GET', questions), 401, 'unauthenticated');
  const trusted = await login({ client: () => restored.client() }, a);
  assert.equal(ok(await trusted.client.request('GET', `${questions}/${seeded.q.id}`)).id, seeded.q.id, '恢复保留原 ID 与归档内容');
  assert.deepEqual((await bytes(trusted.client, `/api/workbench/files/${seeded.file.id}/content`)).bytes, seeded.fileBytes);
  assert.equal(ok(await trusted.client.request('GET', '/api/reliability/v1/context')).recoveryId, prepared.recoveryId);
  const trustedB = await login({ client: () => restored.client() }, b);
  assert.deepEqual(ok(await trustedB.client.request('GET', questions)).items, [], '恢复不合并账户');
  assert.equal(hash(fs.readFileSync(input.database)), sourceHash, '恢复不回写原部署');
  assert.deepEqual(fs.readFileSync(path.join(input.target, 'manifest.json')), manifestBytes, '恢复不改原备份');
});

test('维护恢复：附件损坏与未知迁移停止准备且不破坏原库', async t => {
  const world = await createWorld(t), a = await register(world);
  await seed(a.client);
  await world.app.close();
  const root = createTestDirectory('rebuilt-corrupt-');
  t.after(() => { if (t.passed) fs.rmSync(root, { recursive: true, force: true }); else console.error(`损坏恢复证据保留: ${root}`); });
  const source = path.join(root, 'backup'), database = path.join(world.directory, 'workspace.sqlite');
  await backup({ database, files: path.join(world.directory, 'files'), target: source, stopped: true });
  const original = hash(fs.readFileSync(database));
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json')));
  const blob = path.join(source, manifest.files[0].path), originalBytes = fs.readFileSync(blob);
  fs.writeFileSync(blob, Buffer.from('corrupted'));
  assert.throws(() => restore({ source, target: path.join(root, 'bad-file'), stopped: true }), /digest|hash|length|integrity|mismatch/i, '坏附件不能被当成完整恢复');
  fs.writeFileSync(blob, originalBytes);
  manifest.migrationIds.push('unknown_future_900');
  fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify(manifest));
  assert.throws(() => restore({ source, target: path.join(root, 'unknown'), stopped: true }), /migration|supported/i, '未知迁移必须拒绝');
  assert.equal(hash(fs.readFileSync(database)), original);
});

test('删除账户：邮箱确认、原请求未知结果核实、同容器其他账户和重注册隔离', async t => {
  const world = await createWorld(t), a = await register(world, 'delete@example.test');
  const seeded = await seed(a.client);
  const b = await register(world, 'keep@example.test', { client: anotherPage(world, a.client) });
  const kept = ok(await write(b.client, 'POST', questions, question({ title: '另一账户保留' })), 201);
  const secondDevice = await login(world, a);
  const body = { requestId: randomBytes(32).toString('hex'), sessionId: a.sessionId, email: a.email };
  problem(await a.client.request('POST', '/api/auth/account-deletion', { body: { ...body, email: b.email } }), 422, 'deletion-confirmation-mismatch');
  ok(await a.client.request('POST', '/api/auth/account-deletion', { body }), 204);
  const newPage = anotherPage(world, a.client);
  ok(await newPage.request('POST', '/api/auth/account-deletion', { body }), 204, '丢失回执后原 Cookie 原请求可核实');
  problem(await secondDevice.client.request('GET', questions), 401, 'unauthenticated');
  assert.equal(ok(await b.client.request('GET', `${questions}/${kept.id}`)).id, kept.id, '另一账户仍可读写');
  const rows = world.app.workbench.db.prepare('SELECT id FROM materials_files WHERE id=?').all(seeded.file.id);
  assert.equal(rows.length, 0, '删号清理受管文件记录');
  problem(await world.client().request('POST', '/api/auth/account-deletion', { body }), 401, 'session-invalid');
  const again = await register(world, a.email);
  assert.notEqual(again.account.accountKey, a.account.accountKey);
  assert.deepEqual(ok(await again.client.request('GET', questions)).items, []);
  assert.deepEqual(ok(await again.client.request('GET', '/api/modules/resources/items')).items, []);
});

test('历史部署恢复：固定退役前备份升级保留存续资料、原件与对话，退役模块不复活', async t => {
  const root = createTestDirectory('rebuilt-legacy-');
  let app;
  t.after(async () => { await app?.close(); if (t.passed) fs.rmSync(root, { recursive: true, force: true }); else console.error(`旧库证据保留: ${root}`); });
  const fixture = new URL('../fixtures/retirement/pre-retirement-backup.zip', import.meta.url);
  const metadata = JSON.parse(fs.readFileSync(new URL('../fixtures/retirement/metadata.json', import.meta.url)));
  const archiveBytes = fs.readFileSync(fixture);
  assert.equal(hash(archiveBytes), metadata.backupSha256, '固定输入摘要');
  const zip = await JSZip.loadAsync(archiveBytes), source = path.join(root, 'source');
  fs.mkdirSync(source);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const destination = path.join(source, entry.name);
    assert.ok(destination.startsWith(source + path.sep));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, await entry.async('nodebuffer'));
  }
  const originalDb = hash(fs.readFileSync(path.join(source, 'workspace.sqlite')));
  const target = path.join(root, 'target');
  restore({ source, target, stopped: true });
  activate({ target, stopped: true });
  app = await createIntegration({ directory: target });
  const { client } = await login({ client: () => app.client() }, metadata);
  assert.equal(ok(await client.request('GET', '/api/workbench/context')).accountKey, metadata.accountKey);
  assert.equal(ok(await client.request('GET', `${questions}/${metadata.ids.question}`)).id, metadata.ids.question);
  assert.equal(ok(await client.request('GET', `/api/modules/resources/items/${metadata.ids.resource}`)).id, metadata.ids.resource);
  assert.equal(ok(await client.request('GET', `/api/modules/math/v1/works/${metadata.ids.math}`)).id, metadata.ids.math);
  assert.equal(ok(await client.request('GET', `/api/modules/schedule/entries/${metadata.ids.entry}`)).id, metadata.ids.entry);
  const originalFile = await zip.file(`files/blobs/${metadata.ids.file}.blob`).async('nodebuffer');
  assert.deepEqual((await bytes(client, `/api/workbench/files/${metadata.ids.file}/content`)).bytes, originalFile);
  const conversation = ok(await client.request('GET', `/api/agent/conversations/${metadata.ids.conversation}`));
  assert.ok(conversation.draft.text.length, '存续对话草稿仍保留');
  assert.ok(!conversation.draft.references.some(ref => ['lesson', 'class', 'record'].includes(ref.kind)), '旧业务引用已清理');
  const tables = app.workbench.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
  assert.ok(!tables.some(name => name.startsWith('lesson_') || name.startsWith('classes_')), '退役表不保留可运行旧能力');
  assert.equal(hash(fs.readFileSync(path.join(source, 'workspace.sqlite'))), originalDb, '升级不改变原备份');
});

test('恢复隔离：未知 Agent 写入在时间点恢复后冻结，数字版本相同也不能原键重做', async t => {
  const { answerStatus: _answer, typeId: _type, tagIds: _tags, ...body } = question();
  const controlled = await provider([[{ type: 'toolCall', id: 'persist-before-recovery', name: 'wb_create_question', arguments: { body } }]]);
  const world = await createWorld(t, { agent: controlled.config }), a = await register(world);
  const id = ok(await write(a.client, 'POST', '/api/agent/conversations', {}), 201).conversation.id;
  world.app.workbench.db.exec(`CREATE TRIGGER rebuilt_unknown_operation BEFORE UPDATE ON agent_conversations
    WHEN json_extract(NEW.document, '$.snapshot.operations[0].state')='confirmed'
    BEGIN SELECT RAISE(ABORT, 'result receipt failed'); END`);
  ok(await write(a.client, 'PUT', `/api/agent/conversations/${id}/draft`, { baseVersion: 1, text: '创建题目', references: [] }));
  ok(await write(a.client, 'POST', `/api/agent/conversations/${id}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
  let snapshot;
  for (let i = 0; i < 300; i++) {
    snapshot = ok(await a.client.request('GET', `/api/agent/conversations/${id}`));
    if (snapshot.turns[0].state !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(snapshot.operations[0].state, 'unconfirmed');
  world.app.workbench.db.exec('DROP TRIGGER rebuilt_unknown_operation');
  const saved = ok(await a.client.request('GET', questions)).items[0];
  await world.app.close();
  const root = createTestDirectory('rebuilt-frozen-');
  let restored;
  t.after(async () => { await restored?.close(); if (t.passed) fs.rmSync(root, { recursive: true, force: true }); else console.error(`冻结恢复证据保留: ${root}`); });
  const source = path.join(root, 'backup'), target = path.join(root, 'target');
  await backup({ database: path.join(world.directory, 'workspace.sqlite'), files: path.join(world.directory, 'files'), target: source, stopped: true });
  restore({ source, target, stopped: true });
  activate({ target, stopped: true });
  restored = await createIntegration({ directory: target });
  const { client } = await login({ client: () => restored.client() }, a);
  problem(await write(client, 'POST', `/api/agent/conversations/${id}/operations/${snapshot.operations[0].id}/reconcile`, {}), 409, 'recovery-review-required');
  assert.equal(ok(await client.request('GET', questions)).items.length, 1);
  assert.equal(ok(await client.request('GET', `${questions}/${saved.id}`)).version, saved.version);
  assert.equal(ok(await client.request('GET', `/api/agent/conversations/${id}`)).operations[0].state, 'unconfirmed', '冻结保留原操作事实');
  assert.equal(controlled.requests(), 1, '恢复不重新调用模型');
});
