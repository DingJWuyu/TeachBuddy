import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { provider } from '../fixtures/c26/provider.js';
import { createWorld, register, ok, problem, questions, question, editable, doc, write } from './helpers.js';

const future = { version: 99, blocks: [{ type: 'future-node', opaque: ['完整原文', { future: true }] }] };

test('A-R2 未知文稿：题面/答案/来源快照/摘录普通写入拒绝，分类删除原子回滚并保留原字节', async t => {
  const world = await createWorld(t), { client } = await register(world), db = world.app.workbench.db;
  const tagId = randomUUID(), taxonomyUrl = '/api/modules/questions/v2/taxonomy';
  ok(await write(client, 'PUT', taxonomyUrl, { baseVersion: 1, types: [], tags: [{ id: tagId, name: '未来内容' }] }));
  const source = ok(await write(client, 'POST', questions, question()), 201);
  for (const location of ['body', 'solution', 'source', 'noteFragments']) {
    const saved = ok(await write(client, 'POST', questions, question({ tagIds: [tagId] })), 201);
    if (location === 'noteFragments') {
      const meta = JSON.parse(db.prepare('SELECT value FROM questions_materials_meta WHERE id=?').get(saved.id).value);
      meta.noteFragments = [{ id: randomUUID(), importId: randomUUID(), document: future, locations: [{ kind: 'text', start: 0, end: 1 }] }];
      db.prepare('UPDATE questions_materials_meta SET value=? WHERE id=?').run(JSON.stringify(meta), saved.id);
    } else {
      const value = location === 'source' ? { kind: 'copy', questionId: source.id, questionVersion: 1, snapshot: { title: '已采用来源', body: future, solution: doc(''), answerStatus: 'absent' } } : future;
      db.prepare(`UPDATE question_items SET ${location}=? WHERE id=?`).run(JSON.stringify(value), saved.id);
    }
    const before = db.prepare('SELECT * FROM question_items WHERE id=?').get(saved.id);
    const metadata = db.prepare('SELECT value FROM questions_materials_meta WHERE id=?').get(saved.id);
    for (const [method, suffix, body] of [
      ['PUT', '', { ...editable(saved), baseVersion: 1 }],
      ['POST', '/deletion', { baseVersion: 1, deleted: true }],
      ['POST', '/copies', { ...editable(saved), baseVersion: 1 }]
    ]) {
      problem(await write(client, method, `${questions}/${saved.id}${suffix}`, body), 422, 'invalid-input', { reason: 'unsupported-content-version' });
      assert.deepEqual(db.prepare('SELECT * FROM question_items WHERE id=?').get(saved.id), before, `${location}业务记录原字节保留`);
      assert.deepEqual(db.prepare('SELECT value FROM questions_materials_meta WHERE id=?').get(saved.id), metadata, `${location}摘录元数据原字节保留`);
    }
  }
  const taxonomy = ok(await client.request('GET', taxonomyUrl));
  const allBefore = db.prepare('SELECT * FROM question_items ORDER BY id').all();
  problem(await write(client, 'PUT', taxonomyUrl, { baseVersion: taxonomy.version, types: [], tags: [] }), 422, 'invalid-input', { reason: 'unsupported-content-version' });
  assert.deepEqual(ok(await client.request('GET', taxonomyUrl)), taxonomy, '分类删除不能部分改变分类');
  assert.deepEqual(db.prepare('SELECT * FROM question_items ORDER BY id').all(), allBefore, '分类删除不能部分升版或覆盖未来内容');
});

test('A-R2 未知文稿：Agent真实工具不得替换不认识的持久版本，公开拒绝且原字节保留', async t => {
  let saved;
  const controlled = await provider([() => [{ type: 'toolCall', id: 'future-write', name: 'wb_update_question', arguments: { id: saved.id, body: { ...editable(saved), title: '试图覆盖', body: doc('新题面'), baseVersion: 1 } } }]]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  saved = ok(await write(client, 'POST', questions, question()), 201);
  const db = world.app.workbench.db;
  db.prepare('UPDATE question_items SET body=? WHERE id=?').run(JSON.stringify(future), saved.id);
  const before = db.prepare('SELECT * FROM question_items WHERE id=?').get(saved.id);
  const id = ok(await write(client, 'POST', '/api/agent/conversations', {}), 201).conversation.id;
  ok(await write(client, 'PUT', `/api/agent/conversations/${id}/draft`, { baseVersion: 1, text: '修改这道题', references: [] }));
  ok(await write(client, 'POST', `/api/agent/conversations/${id}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
  let snapshot;
  for (let i = 0; i < 300; i++) {
    snapshot = ok(await client.request('GET', `/api/agent/conversations/${id}`));
    if (snapshot.turns[0].state !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(snapshot.operations[0].state, 'rejected');
  assert.equal(snapshot.toolCalls[0].problem.reason, 'unsupported-content-version');
  assert.equal(snapshot.turns[0].reason, 'tool-rejected');
  assert.deepEqual(db.prepare('SELECT * FROM question_items WHERE id=?').get(saved.id), before, 'Agent拒绝不能损坏未来文稿');
  assert.equal(controlled.requests(), 1);
});
