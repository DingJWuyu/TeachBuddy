import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createIntegration } from './fixtures/c26/harness.js';
import { provider } from './fixtures/c26/provider.js';
import { valid } from '../src/agent/schema.js';
const document = text => ({ version: 2, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text }] }] });
const call = (id, name, args) => ({ type: 'toolCall', id, name, arguments: args });
const write = (client, method, path, body, key = randomUUID()) => client.request(method, path, { body, headers: { 'Idempotency-Key': key } });
async function register(world) {
  const client = world.client(), email = 'preview-agent@example.test';
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const code = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const pending = await client.request('POST', '/api/auth/register', { body: { email, nickname: '预览老师', password: 'preview-agent-password', termsAccepted: true, rememberMe: true, challengeId: code.json.challengeId, verificationCode: world.mailer.lastCode('registration', email) } });
  assert.equal(pending.status, 201, pending.text);
  await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: pending.json.id, rememberMe: true } });
  return client;
}
async function run(client, references = []) {
  const created = await write(client, 'POST', '/api/agent/conversations', {});
  const path = '/api/agent/conversations/' + created.json.conversation.id;
  const draft = await write(client, 'PUT', path + '/draft', { baseVersion: 1, text: '按要求操作已有题目和备课', references });
  assert.equal(draft.status, 200, draft.text);
  const accepted = await write(client, 'POST', path + '/turns', { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' });
  assert.equal(accepted.status, 202, accepted.text);
  for (let i = 0; i < 200; i++) {
    const result = (await client.request('GET', path)).json;
    if (result.turns[0].state !== 'running') return result;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw Error('Turn did not finish');
}
test('preview: current question v2 and lesson v3 use the 13-tool journal, preserve rich fields and replay once', async () => {
  let question, lesson, copied;
  const p = await provider([
    [call('list-q', 'wb_list_questions', {}), call('list-l', 'wb_list_lessons', {})],
    () => [call('read-q', 'wb_get_question', { id: question.id }), call('read-l', 'wb_get_lesson', { id: lesson.id })],
    () => { const { source, ...body } = questionInput; return [call('copy', 'wb_copy_question', { id: question.id, body: { ...body, baseVersion: question.version, title: '已改编的题目' } })]; },
    context => {
      copied = context.messages.find(m => m.toolCallId === 'copy').details.result;
      return [call('save-lesson', 'wb_update_lesson', { id: lesson.id, body: { ...lessonInput, baseVersion: lesson.version, sections: [{ ...lessonInput.sections[0], references: [{ id: randomUUID(), kind: 'question', questionId: copied.id, questionVersion: copied.version, note: '保留数学文稿' }] }] } })];
    },
    () => [call('copies', 'wb_list_derivatives', { id: question.id }), call('usages', 'wb_list_question_usages', { questionId: copied.id })],
    [{ type: 'text', text: '已保存改编题和备课引用。' }],
  ]);
  const world = await createIntegration({ agent: p.config });
  const typeId = randomUUID(), tagId = randomUUID();
  const questionInput = { title: '材料版原题', body: { ...document('原题'), version: 1 }, solution: { ...document('解析'), version: 1 }, answerStatus: 'present', note: '教师备注', starred: true, typeId, tagIds: [tagId], source: { kind: 'manual' } };
  const lessonInput = { title: '材料版备课', intro: document('保留开头'), sections: [{ id: randomUUID(), title: '小组挑战', content: document('保留环节文稿'), references: [] }], materials: [] };
  try {
    const client = await register(world);
    assert.equal((await write(client, 'PUT', '/api/modules/questions/v2/taxonomy', { baseVersion: 1, types: [{ id: typeId, name: '证明题' }], tags: [{ id: tagId, name: '数列' }] })).status, 200);
    question = (await write(client, 'POST', '/api/modules/questions/v2/items', questionInput)).json;
    lesson = (await write(client, 'POST', '/api/modules/lessons/v3', lessonInput)).json;
    const snapshot = await run(client, [{ kind: 'question', id: question.id, version: question.version }]);
    assert.equal(snapshot.turns[0].state, 'completed', JSON.stringify(snapshot.toolCalls));
    assert.equal(valid('Snapshot', snapshot), true);
    assert.equal(snapshot.toolCalls.length, 8);
    assert.equal(snapshot.toolCalls.at(-1).result.items[0].questionVersion, copied.version);
    assert.equal(snapshot.toolCalls.find(c => c.toolCallId === 'read-q').result.answerStatus, 'present');
    assert.equal(copied.body.version, 1);
    assert.equal(copied.source.snapshot.answerStatus, 'present');
    assert.equal(copied.note, question.note);
    assert.equal(copied.typeId, typeId);
    assert.deepEqual(copied.tagIds, [tagId]);
    const legacyUpdate = await write(client, 'PUT', '/api/modules/questions/items/' + question.id, { baseVersion: 1, title: question.title, body: question.body, solution: { version: 1, blocks: [] }, note: question.note, starred: question.starred });
    assert.equal(legacyUpdate.status, 422);
    assert.equal(legacyUpdate.json.reason, 'unsupported-content-version');
    assert.deepEqual((await client.request('GET', '/api/modules/questions/v2/items/' + question.id)).json, question);
    const saved = (await client.request('GET', '/api/modules/lessons/v3/' + lesson.id)).json;
    assert.deepEqual(saved.intro, lesson.intro);
    assert.deepEqual(saved.sections[0].content, lesson.sections[0].content);
    assert.equal(saved.sections[0].references[0].questionId, copied.id);
    const copyOp = snapshot.operations[0];
    const internal = world.workbench.agent.store.read(world.workbench.db.prepare('SELECT accountKey FROM agent_conversations LIMIT 1').get().accountKey, snapshot.conversation.id);
    const replay = world.workbench.loader.get('questions').port.operations.copyQuestionV2({ principal: { accountKey: internal.snapshot.conversation.accountKey ?? world.workbench.db.prepare('SELECT accountKey FROM agent_conversations LIMIT 1').get().accountKey }, key: internal.journals[copyOp.id].key, id: question.id, input: copyOp.request.arguments.body });
    assert.equal(replay.body.id, copied.id);
    assert.equal((await client.request('GET', '/api/modules/questions/v2/items')).json.items.length, 2);
  } finally { await world.close(); }
});
test('preview: unknown document writes are rejected without replacing or deleting data', async () => {
  let question;
  const p = await provider([() => [call('delete-future', 'wb_set_question_deletion', { id: question.id, body: { baseVersion: 1, deleted: true } })]]);
  const world = await createIntegration({ agent: p.config });
  try {
    const client = await register(world);
    question = (await write(client, 'POST', '/api/modules/questions/v2/items', { title: '保护题', body: document('题干'), solution: document('解析'), answerStatus: 'present', note: '', starred: false, typeId: null, tagIds: [], source: { kind: 'manual' } })).json;
    const future = JSON.stringify({ version: 99, blocks: [{ type: 'future-node', payload: '不得丢失' }] });
    world.workbench.db.prepare('UPDATE question_items SET body=? WHERE id=?').run(future, question.id);
    const result = await run(client);
    assert.equal(result.toolCalls[0].state, 'rejected');
    assert.equal(result.toolCalls[0].problem.reason, 'unsupported-content-version');
    const stored = world.workbench.db.prepare('SELECT body, deletedAt, version FROM question_items WHERE id=?').get(question.id);
    assert.deepEqual(stored, { body: future, deletedAt: null, version: 1 });
  } finally { await world.close(); }
});
