import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { provider } from '../fixtures/c26/provider.js';
import { requestFingerprint } from '../../src/workbench/mutations.js';
import { createWorld, register, ok, problem, question, questions, editable, doc, write } from './helpers.js';

const legacyPath = '/api/modules/questions/items';
const tool = (name, args) => ({ type: 'toolCall', id: randomUUID(), name, arguments: args });

for (const rich of [false, true]) test(`题库兼容：同一${rich ? '富文稿' : 'v1文稿及新元数据'}对象经旧HTTP拒绝、新HTTP与真实Agent保真读取/改编`, async t => {
  let current;
  const controlled = await provider([
    () => [tool('wb_get_question', { id: current.id })],
    () => [tool('wb_list_questions', { query: {} })],
    () => [tool('wb_copy_question', { id: current.id, body: { ...editable(current), baseVersion: current.version, title: '助理改编' } })],
    [{ type: 'text', text: '读取并改编完成' }],
  ]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const { answerStatus: _answer, typeId: _type, tagIds: _tags, ...legacyBody } = question();
  const key = randomUUID();
  const original = ok(await write(client, 'POST', legacyPath, legacyBody, key), 201);
  const receiptBefore = world.app.workbench.db.prepare('SELECT * FROM workbench_mutation_keys WHERE key=?').get(key);
  const tag = randomUUID();
  ok(await write(client, 'PUT', '/api/modules/questions/v2/taxonomy', { baseVersion: 1, types: [], tags: [{ id: tag, name: '保留分类' }] }));
  const body = rich ? { version: 2, blocks: [{ type: 'table', rows: [[{ blocks: doc('单元格数学').blocks }]] }] } : original.body;
  current = ok(await write(client, 'PUT', `${questions}/${original.id}`, { ...editable(question()), title: '新版内容', body, tagIds: [tag], baseVersion: original.version }));
  assert.equal(current.id, original.id);
  for (const path of [`${legacyPath}/${current.id}`, legacyPath])
    problem(await client.request('GET', path), 422, 'invalid-input', { reason: 'unsupported-content-version' });
  const { source: _source, ...oldEdit } = legacyBody;
  problem(await write(client, 'PUT', `${legacyPath}/${current.id}`, { ...oldEdit, baseVersion: current.version }), 422, 'invalid-input', { reason: 'unsupported-content-version' });
  assert.deepEqual(ok(await client.request('GET', `${questions}/${current.id}`)), current, '旧写入拒绝后原文稿和分类不变');
  assert.deepEqual(ok(await write(client, 'POST', legacyPath, legacyBody, key), 201), original, '旧路径原键重放原成功结果');
  assert.deepEqual(world.app.workbench.db.prepare('SELECT * FROM workbench_mutation_keys WHERE key=?').get(key), receiptBefore);
  assert.equal(receiptBefore.path, legacyPath);
  assert.equal(receiptBefore.requestHash, requestFingerprint({ method: 'POST', path: legacyPath, body: legacyBody }));

  const conversation = ok(await write(client, 'POST', '/api/agent/conversations', {}), 201).conversation.id;
  const url = `/api/agent/conversations/${conversation}`;
  ok(await write(client, 'PUT', `${url}/draft`, { baseVersion: 1, text: '读取并改编这道题', references: [{ kind: 'question', id: current.id, version: current.version }] }));
  ok(await write(client, 'POST', `${url}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
  let snapshot;
  for (let i = 0; i < 300; i++) {
    snapshot = ok(await client.request('GET', url));
    if (snapshot.turns[0].state !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(snapshot.turns[0].state, 'completed', JSON.stringify(snapshot.toolCalls));
  assert.deepEqual(snapshot.toolCalls[0].result, current, '工具读取与新版HTTP读取一致');
  assert.deepEqual(snapshot.toolCalls[1].result.items, [current], '工具列表不隐藏新版对象');
  const copy = snapshot.toolCalls[2].result;
  assert.equal(snapshot.operations[0].state, 'confirmed');
  assert.deepEqual(copy.body, current.body);
  assert.deepEqual(copy.tagIds, current.tagIds);
  assert.deepEqual(copy.source, { kind: 'copy', questionId: current.id, questionVersion: current.version,
    snapshot: { title: current.title, body: current.body, solution: current.solution, answerStatus: current.answerStatus } });
  current = ok(await write(client, 'PUT', `${questions}/${current.id}`, { ...editable(current), body: doc('来源后来修改'), baseVersion: current.version }));
  await world.restart();
  assert.deepEqual(ok(await client.request('GET', `${questions}/${copy.id}`)), copy, '来源变化和重启不能重写已采用快照');
  assert.deepEqual(ok(await write(client, 'POST', legacyPath, legacyBody, key), 201), original);
  assert.equal(ok(await client.request('GET', questions)).items.length, 2);
  assert.equal(controlled.requests(), 4);
});
