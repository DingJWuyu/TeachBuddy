import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import https from 'node:https';
import { provider } from '../fixtures/c26/provider.js';
import { createWorld, register, ok, problem, question, questions, doc, write, schedule } from './helpers.js';

const conversations = '/api/agent/conversations';
const modelId = 'deepseek/deepseek-v4.1-flash';
const tool = (name, arguments_) => ({ type: 'toolCall', id: randomUUID(), name, arguments: arguments_ });
const text = value => [{ type: 'text', text: value }];
function legacyQuestion() {
  const { answerStatus: _answer, typeId: _type, tagIds: _tags, ...body } = question();
  return body;
}
async function send(client, id, prompt = '请按明确要求处理') {
  const snapshot = ok(await client.request('GET', `${conversations}/${id}`));
  const draft = ok(await write(client, 'PUT', `${conversations}/${id}/draft`, { baseVersion: snapshot.draft.version, text: prompt, references: [] }));
  return ok(await write(client, 'POST', `${conversations}/${id}/turns`, { draftVersion: draft.version, modelId }), 202);
}
async function settled(client, id) {
  for (let i = 0; i < 300; i++) {
    const snapshot = ok(await client.request('GET', `${conversations}/${id}`));
    if (snapshot.turns.length && snapshot.turns.every(t => t.state !== 'running')) return snapshot;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('受控助理未进入持久终态');
}
function replay(client, id, through) {
  return new Promise((resolve, reject) => {
    const events = [];
    let pending = '';
    const req = https.get(new URL(`${conversations}/${id}/events?after=0`, client.baseUrl), { rejectUnauthorized: false, headers: { Cookie: client.jar.header(), 'X-TeachBuddy-Page': client.pageId } }, response => {
      response.setEncoding('utf8');
      response.on('data', chunk => {
        pending += chunk;
        let boundary;
        while ((boundary = pending.indexOf('\n\n')) !== -1) {
          const frame = pending.slice(0, boundary);
          pending = pending.slice(boundary + 2);
          const data = frame.split('\n').find(line => line.startsWith('data: '));
          if (!data) continue;
          const event = JSON.parse(data.slice(6));
          events.push(event);
          if (event.seq >= through) { req.destroy(); resolve(events); }
        }
      });
      response.on('error', reject);
    });
    req.setTimeout(10000, () => req.destroy(new Error('SSE未回放至已持久事件序号')));
    req.on('error', reject);
  });
}

test('助理：持久草稿冲突不覆盖，未配置/非白名单模型不发送，跨账户历史与引用隔离', async t => {
  const world = await createWorld(t), a = await register(world), b = await register(world);
  const created = ok(await write(a.client, 'POST', conversations, {}), 201), id = created.conversation.id;
  const draft = ok(await write(a.client, 'PUT', `${conversations}/${id}/draft`, { baseVersion: 1, text: '老师输入', references: [] }));
  problem(await write(a.client, 'PUT', `${conversations}/${id}/draft`, { baseVersion: 1, text: '旧设备覆盖', references: [] }), 409, 'draft-conflict', { currentVersion: 2 });
  problem(await write(a.client, 'POST', `${conversations}/${id}/turns`, { draftVersion: draft.version, modelId: 'anything' }), 422, 'model-not-allowed');
  problem(await write(a.client, 'POST', `${conversations}/${id}/turns`, { draftVersion: draft.version, modelId }), 503, 'model-unavailable');
  problem(await b.client.request('GET', `${conversations}/${id}`), 404, 'not-found');
  const foreign = ok(await write(b.client, 'POST', questions, question()), 201);
  problem(await write(a.client, 'PUT', `${conversations}/${id}/draft`, { baseVersion: 2, text: '引用', references: [{ kind: 'question', id: foreign.id, version: 1 }] }), 404, 'not-found');
  await world.restart();
  assert.equal(ok(await a.client.request('GET', `${conversations}/${id}`)).draft.text, '老师输入');
  assert.deepEqual(ok(await b.client.request('GET', conversations)).items, []);
});

test('助理工具：真实写入同轮去重，公开卡片/操作/事件持久一致，重启与 reconcile 不重做', async t => {
  const body = legacyQuestion();
  const firstCall = tool('wb_create_question', { body }), secondCall = tool('wb_create_question', { body });
  const controlled = await provider([[firstCall], [secondCall], text('已完成')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  await send(client, id, '创建一道题，重复工具响应不能再建一次');
  const snapshot = await settled(client, id);
  assert.equal(snapshot.turns[0].state, 'completed');
  assert.equal(snapshot.operations.length, 1, '同轮等价已确认写入仅一个 Operation');
  assert.equal(snapshot.toolCalls.length, 2);
  assert.deepEqual(snapshot.toolCalls.map(c => c.ordinal), [1, 2]);
  const op = snapshot.operations[0];
  assert.equal(op.state, 'confirmed');
  for (const call of snapshot.toolCalls) {
    assert.equal(call.operationId, op.id);
    assert.equal(call.state, 'confirmed');
    assert.deepEqual(call.result, op.result);
  }
  const events = await replay(client, id, snapshot.lastEventSeq);
  assert.equal(events.at(-1).seq, snapshot.lastEventSeq, 'SSE重连可读取全部持久事件');
  assert.deepEqual(events.map(e => e.seq), [...new Set(events.map(e => e.seq))].sort((a,b) => a-b));
  for (const call of snapshot.toolCalls) {
    assert.deepEqual(events.filter(e => e.type === 'toolCall' && e.value.toolCallId === call.toolCallId).at(-1).value, call, '卡片事件与快照一致');
  }
  assert.equal(ok(await client.request('GET', questions)).items.length, 1);
  const requests = controlled.requests();
  await world.restart();
  const reopened = ok(await client.request('GET', `${conversations}/${id}`));
  assert.deepEqual(reopened.toolCalls, snapshot.toolCalls);
  assert.equal(ok(await write(client, 'POST', `${conversations}/${id}/operations/${op.id}/reconcile`, {})).state, 'confirmed');
  assert.equal(controlled.requests(), requests, '核实和重开都不能发模型请求');
  assert.equal(ok(await client.request('GET', questions)).items.length, 1);
  assert.equal(snapshot.turns[0].usage.complete, true);
});

test('助理工具：业务版本拒绝保留原 Problem 并终止后续工具', async t => {
  let target;
  const controlled = await provider([() => [tool('wb_update_question', { id: target.id, body: { title: '旧版本改写', body: doc('改写'), solution: doc(''), note: '', starred: false, baseVersion: 99 } })], text('不应继续')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  target = ok(await write(client, 'POST', questions, question()), 201);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  await send(client, id);
  const snapshot = await settled(client, id);
  assert.equal(snapshot.turns[0].state, 'failed');
  assert.equal(snapshot.turns[0].reason, 'tool-rejected');
  assert.equal(snapshot.operations[0].state, 'rejected');
  assert.equal(snapshot.toolCalls[0].problem.type, '/problems/workbench/version-conflict');
  assert.equal(snapshot.toolCalls[0].problem.currentVersion, 1);
  assert.equal(controlled.requests(), 1, '业务拒绝后不再请模型宣称成功');
  assert.equal(ok(await client.request('GET', `${questions}/${target.id}`)).version, 1);
});

test('教学提案：建议本身无业务写入，显式点击只创建一个未排期任务且提案卡保持只读', async t => {
  const card = { kind: 'plan', title: '建议安排', entryTitle: '二次函数复习', steps: ['回顾概念', '讲解例题'] };
  const controlled = await provider([[tool('wb_propose_teaching_card', { card })], text('请审阅安排')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  await send(client, id, '给我复习建议');
  const snapshot = await settled(client, id), call = snapshot.toolCalls[0];
  assert.equal(call.state, 'read');
  assert.equal(call.operationId, null);
  assert.equal(snapshot.operations.length, 0);
  assert.deepEqual(ok(await client.request('GET', `${schedule}/entries`)).items, [], '提案工具不保存日程');
  const url = `${conversations}/${id}/proposals/${call.result.proposalId}/execute`;
  const accepted = ok(await write(client, 'POST', url, { slot: 0 }));
  assert.equal(accepted.state, 'prepared', '200只表示执行已接受');
  const after = ok(await client.request('GET', `${conversations}/${id}`));
  const operation = after.operations[0];
  assert.equal(operation.state, 'confirmed');
  assert.equal(operation.result.time, null);
  assert.deepEqual(operation.result.items.map(x => x.text), card.steps);
  assert.deepEqual(after.toolCalls[0], call, '执行不得覆写原提案只读结果');
  const repeated = ok(await write(client, 'POST', url, { slot: 0 }));
  assert.equal(repeated.id, operation.id, '新HTTP键点击同槽仍复用原操作');
  assert.equal(ok(await client.request('GET', `${schedule}/entries`)).items.length, 1);
  await world.restart();
  assert.equal(ok(await write(client, 'POST', url, { slot: 0 })).id, operation.id);
  assert.equal(controlled.requests(), 2);
});

test('助理未知写入：业务已提交但日志结果失败时保持 unconfirmed，原操作核实不重复创建', async t => {
  const controlled = await provider([[tool('wb_create_question', { body: legacyQuestion() })], text('不会继续')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  world.app.workbench.db.exec(`CREATE TRIGGER rebuilt_reject_confirmation BEFORE UPDATE ON agent_conversations
    WHEN json_extract(NEW.document, '$.snapshot.operations[0].state')='confirmed'
    BEGIN SELECT RAISE(ABORT, 'journal receipt unavailable'); END`);
  await send(client, id);
  const snapshot = await settled(client, id), op = snapshot.operations[0];
  assert.equal(op.state, 'unconfirmed');
  assert.equal(snapshot.toolCalls[0].state, 'unconfirmed');
  assert.equal(snapshot.turns[0].reason, 'tool-unconfirmed');
  const saved = ok(await client.request('GET', questions)).items;
  assert.equal(saved.length, 1, '未知回执不表示业务未执行');
  world.app.workbench.db.exec('DROP TRIGGER rebuilt_reject_confirmation');
  await world.restart();
  const confirmed = ok(await write(client, 'POST', `${conversations}/${id}/operations/${op.id}/reconcile`, {}));
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.result.id, saved[0].id, '原键核实找回已经保存的原对象');
  assert.equal(ok(await client.request('GET', questions)).items.length, 1);
  assert.equal(ok(await client.request('GET', `${conversations}/${id}`)).toolCalls[0].state, 'confirmed');
  assert.equal(controlled.requests(), 1, '未知写入和核实都不能继续模型请求');
});

test('助理工具输入：注入身份、路径或幂等键的参数拒绝且不公开原始无效输入', async t => {
  const controlled = await provider([[tool('wb_create_question', { body: legacyQuestion(), principal: 'INJECTED_IDENTITY', key: 'MODEL_KEY' })]]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  await send(client, id);
  const snapshot = await settled(client, id);
  assert.equal(snapshot.toolCalls[0].state, 'rejected');
  assert.equal(snapshot.toolCalls[0].arguments, null);
  assert.equal(snapshot.toolCalls[0].operationId, null);
  assert.deepEqual(snapshot.operations, []);
  assert.deepEqual(ok(await client.request('GET', questions)).items, []);
  assert.ok(!JSON.stringify(snapshot).includes('INJECTED_IDENTITY'));
});
