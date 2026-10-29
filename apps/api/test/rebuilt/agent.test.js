import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import https from 'node:https';
import { AgentSession } from '@earendil-works/pi-coding-agent';
import { createIntegration } from '../support/application.js';
import { provider } from '../fixtures/c26/provider.js';
import { createWorld, register, login, ok, problem, question, questions, doc, write, schedule } from './helpers.js';

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
  const before = persisted(world, id);
  const originalEntry = before.entries.find(e => e.message?.role === 'toolResult' && e.message.toolCallId === snapshot.toolCalls[0].toolCallId);
  world.app.workbench.db.exec('DROP TRIGGER rebuilt_reject_confirmation');
  await world.restart();
  const confirmed = ok(await write(client, 'POST', `${conversations}/${id}/operations/${op.id}/reconcile`, {}));
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.result.id, saved[0].id, '原键核实找回已经保存的原对象');
  assert.equal(ok(await client.request('GET', questions)).items.length, 1);
  assert.equal(ok(await client.request('GET', `${conversations}/${id}`)).toolCalls[0].state, 'confirmed');
  assert.equal(controlled.requests(), 1, '未知写入和核实都不能继续模型请求');
  const after = persisted(world, id), entry = after.entries.find(e => e.id === originalEntry.id);
  assert.deepEqual(after.journals, before.journals, '核实逐字保留原键、指纹和请求体');
  assert.deepEqual({ ...entry, message: null }, { ...originalEntry, message: null }, '核实只替换同一原生 entry 的结果，不改身份或父链');
  assert.equal(entry.message.details.state, 'confirmed');
  assert.equal(entry.message.details.result.id, saved[0].id);
  const events = await replay(client, id, after.snapshot.lastEventSeq);
  const lastOperation = events.findLastIndex(e => e.type === 'operation');
  assert.deepEqual(events.slice(lastOperation).map(e => e.type), ['operation', 'toolCall', 'conversation']);
  assert.deepEqual(events[lastOperation].value, confirmed);
  assert.deepEqual(events[lastOperation + 1].value, after.snapshot.toolCalls[0]);
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


test('助理历史未知写入：模块缺席仍保持未确认，重新装配后用原键确认已保存对象', async t => {
  const controlled = await provider([[tool('wb_create_question', { body: legacyQuestion() })]]);
  const world = await createWorld(t, { agent: controlled.config }), account = await register(world);
  const id = ok(await write(account.client, 'POST', conversations, {}), 201).conversation.id;
  world.app.workbench.db.exec(`CREATE TRIGGER rebuilt_missing_owner_confirmation BEFORE UPDATE ON agent_conversations
    WHEN json_extract(NEW.document, '$.snapshot.operations[0].state')='confirmed'
    BEGIN SELECT RAISE(ABORT, 'journal receipt unavailable'); END`);
  await send(account.client, id);
  const operation = (await settled(account.client, id)).operations[0];
  assert.equal(operation.state, 'unconfirmed');
  const saved = ok(await account.client.request('GET', questions)).items[0];
  const readJournal = db => JSON.parse(db.prepare('SELECT document FROM agent_conversations WHERE id=?').get(id).document).journals[operation.id];
  const journal = readJournal(world.app.workbench.db);
  world.app.workbench.db.exec('DROP TRIGGER rebuilt_missing_owner_confirmation');
  await world.app.close();
  let app = await createIntegration({ directory: world.directory, workbench: { catalogOverride: [] } });
  t.after(() => app?.close());
  let signed = await login({ client: () => app.client() }, account);
  const url = `${conversations}/${id}/operations/${operation.id}/reconcile`;
  const unresolved = ok(await write(signed.client, 'POST', url, {}));
  assert.equal(unresolved.state, 'unconfirmed', '模块缺席不能证明历史写入失败');
  assert.deepEqual(readJournal(app.workbench.db), journal, '保留原请求键、指纹和请求体');
  await app.close(); app = null;
  app = await createIntegration({ directory: world.directory });
  signed = await login({ client: () => app.client() }, account);
  const confirmed = ok(await write(signed.client, 'POST', url, {}));
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.result.id, saved.id);
  assert.equal(confirmed.result.version, saved.version);
  assert.equal(ok(await signed.client.request('GET', questions)).items.length, 1, '原键核实不能重复创建');
  assert.deepEqual(readJournal(app.workbench.db), journal);
  assert.equal(controlled.requests(), 1, '核实不请求模型重建输入');
  await app.close(); app = null;
});

function persisted(world, id) {
  return JSON.parse(world.app.workbench.db.prepare('SELECT document FROM agent_conversations WHERE id=?').get(id).document);
}

test('助理受理：引用与发送同事务，旧键重放不清新草稿、不重启模型', async t => {
  const controlled = await provider([text('已阅读历史引用')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const reference = ok(await write(client, 'POST', questions, question()), 201);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  const url = `${conversations}/${id}`;
  const input = { baseVersion: 1, text: '引用已保存题目', references: [{ kind: 'question', id: reference.id, version: reference.version }] };
  const draft = ok(await write(client, 'PUT', `${url}/draft`, input));
  const key = randomUUID(), body = { draftVersion: draft.version, modelId };
  world.app.workbench.db.exec(`CREATE TRIGGER reject_turn_commit BEFORE UPDATE ON agent_conversations
    WHEN json_array_length(NEW.document, '$.snapshot.turns') > 0
    BEGIN SELECT RAISE(ABORT, 'turn commit unavailable'); END`);
  assert.equal((await write(client, 'POST', `${url}/turns`, body, key)).status, 503);
  const failed = ok(await client.request('GET', url));
  assert.deepEqual(failed.draft, draft);
  assert.deepEqual(failed.messages, []);
  assert.deepEqual(failed.turns, []);
  assert.equal(controlled.requests(), 0);
  world.app.workbench.db.exec('DROP TRIGGER reject_turn_commit');
  const accepted = ok(await write(client, 'POST', `${url}/turns`, body, key), 202);
  assert.deepEqual(accepted.message.references[0].snapshot, reference);
  assert.equal(accepted.draft.version, draft.version + 1);
  assert.equal(accepted.draft.text, '');
  const done = await settled(client, id);
  const next = ok(await write(client, 'PUT', `${url}/draft`, { baseVersion: done.draft.version, text: '下一条未发送输入', references: [] }));
  assert.deepEqual(ok(await write(client, 'POST', `${url}/turns`, body, key), 202), accepted);
  const reopened = ok(await client.request('GET', url));
  assert.deepEqual(reopened.draft, next);
  assert.equal(reopened.turns.length, 1);
  assert.equal(controlled.requests(), 1);
  const events = await replay(client, id, reopened.lastEventSeq);
  const user = events.findIndex(e => e.type === 'message' && e.value.role === 'user');
  assert.deepEqual(events.slice(user, user + 4).map(e => e.type), ['message', 'turn', 'draft', 'conversation']);
  assert.deepEqual(events.map(e => e.seq), Array.from({ length: reopened.lastEventSeq }, (_, i) => i + 1));
});

test('提案启动恢复：已结束turn的prepared取消，明确再点击复用原槽位与原请求', async t => {
  const card = { kind: 'plan', title: '准备后重启', entryTitle: '恢复后明确保存', steps: ['核对原始步骤'] };
  const controlled = await provider([[tool('wb_propose_teaching_card', { card })], text('请审阅')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  await send(client, id);
  const original = await settled(client, id), call = original.toolCalls[0];
  const url = `${conversations}/${id}/proposals/${call.result.proposalId}/execute`;
  world.app.workbench.db.exec(`CREATE TRIGGER reject_proposal_start BEFORE UPDATE ON agent_conversations
    WHEN json_extract(NEW.document, '$.snapshot.operations[0].state')='executing'
    BEGIN SELECT RAISE(ABORT, 'execution start unavailable'); END`);
  const accepted = ok(await write(client, 'POST', url, { slot: 0 }));
  assert.equal(accepted.state, 'prepared');
  assert.equal(persisted(world, id).snapshot.operations[0].state, 'prepared');
  const journal = persisted(world, id).journals[accepted.id];
  world.app.workbench.db.exec('DROP TRIGGER reject_proposal_start');
  await world.restart();
  const recovered = ok(await client.request('GET', `${conversations}/${id}`));
  assert.equal(recovered.operations[0].state, 'cancelled');
  assert.deepEqual(recovered.turns, original.turns, '原已结束turn不能重新开始或改判');
  assert.deepEqual(recovered.toolCalls[0], call);
  assert.equal(ok(await client.request('GET', `${schedule}/entries`)).items.length, 0);
  assert.equal(controlled.requests(), 2);
  assert.equal(ok(await write(client, 'POST', url, { slot: 0 })).id, accepted.id);
  const saved = ok(await client.request('GET', `${schedule}/entries`)).items;
  assert.equal(saved.length, 1);
  const finished = persisted(world, id);
  assert.equal(finished.snapshot.operations[0].state, 'confirmed');
  assert.deepEqual(finished.journals[accepted.id], journal, '重启后明确再点击保留原键及含事项ID的完整原体');
  assert.deepEqual(finished.snapshot.toolCalls[0], call);
});

test('提案启动恢复：executing保留未知写入并阻止后槽，原键核实后才继续', async t => {
  const item = title => ({ title, body: '求 $2x=4$ 的解', solution: '$x=2$' });
  const card = { kind: 'practice', title: '两题顺序保存', items: [item('第一题'), item('第二题')] };
  const controlled = await provider([[tool('wb_propose_teaching_card', { card })], text('请审阅')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  await send(client, id);
  const original = await settled(client, id), call = original.toolCalls[0];
  const url = `${conversations}/${id}/proposals/${call.result.proposalId}/execute`;
  world.app.workbench.db.exec(`CREATE TRIGGER reject_proposal_result BEFORE UPDATE ON agent_conversations
    WHEN json_extract(NEW.document, '$.snapshot.operations[0].state') IN ('confirmed', 'unconfirmed')
    BEGIN SELECT RAISE(ABORT, 'execution receipt unavailable'); END`);
  const accepted = ok(await write(client, 'POST', url, { slot: 0 }));
  const before = persisted(world, id);
  assert.equal(before.snapshot.operations[0].state, 'executing');
  const first = ok(await client.request('GET', questions)).items[0];
  assert.equal(first.title, '第一题');
  world.app.workbench.db.exec('DROP TRIGGER reject_proposal_result');
  await world.restart();
  const recovered = ok(await client.request('GET', `${conversations}/${id}`));
  assert.equal(recovered.operations[0].state, 'unconfirmed');
  assert.deepEqual(recovered.toolCalls[0], call);
  assert.deepEqual(recovered.turns, original.turns);
  problem(await write(client, 'POST', url, { slot: 1 }), 409, 'pending-operation');
  assert.equal(ok(await write(client, 'POST', url, { slot: 0 })).state, 'unconfirmed');
  const confirmed = ok(await write(client, 'POST', `${conversations}/${id}/operations/${accepted.id}/reconcile`, {}));
  assert.equal(confirmed.result.id, first.id);
  assert.deepEqual(persisted(world, id).journals, before.journals);
  ok(await write(client, 'POST', url, { slot: 1 }));
  const after = persisted(world, id);
  assert.deepEqual(after.snapshot.operations.map(o => o.state), ['confirmed', 'confirmed']);
  assert.deepEqual(after.snapshot.toolCalls[0], call);
  assert.deepEqual(after.entries, before.entries, '提案执行与核实不得改写原提案原生结果');
  assert.equal(ok(await client.request('GET', questions)).items.length, 2);
  assert.equal(controlled.requests(), 2, '重启和核实都不自动请求模型');
});

test('助理只读中断：结果落盘失败保留interrupted与原生结果，不制造待核实写入', async t => {
  const sdkEnds = [], durableAtEnd = [];
  const subscribe = AgentSession.prototype.subscribe;
  t.mock.method(AgentSession.prototype, 'subscribe', function(listener) {
    return subscribe.call(this, event => {
      if (event.type === 'tool_execution_end') {
        sdkEnds.push(structuredClone(event));
        durableAtEnd.push(persisted(world, id));
      }
      return listener(event);
    });
  });
  const controlled = await provider([[tool('wb_list_questions', { query: {} })], text('明确再次发送后完成')]);
  const world = await createWorld(t, { agent: controlled.config }), { client } = await register(world);
  const id = ok(await write(client, 'POST', conversations, {}), 201).conversation.id;
  world.app.workbench.db.exec(`CREATE TRIGGER reject_read_receipt BEFORE UPDATE ON agent_conversations
    WHEN json_extract(NEW.document, '$.snapshot.toolCalls[0].state')='read'
    BEGIN SELECT RAISE(ABORT, 'read receipt unavailable'); END`);
  await send(client, id);
  const snapshot = await settled(client, id);
  assert.equal(snapshot.toolCalls[0].state, 'interrupted');
  assert.equal(snapshot.toolCalls[0].operationId, null);
  assert.deepEqual(snapshot.operations, []);
  const native = persisted(world, id).entries.find(e => e.message?.role === 'toolResult');
  const result = native.message;
  assert.deepEqual(result.details, { state: 'interrupted', operationId: null });
  assert.equal(result.isError, true);
  assert.equal(sdkEnds.length, 1);
  assert.deepEqual(durableAtEnd[0].snapshot.toolCalls[0], snapshot.toolCalls[0], 'SDK发布最终事件前，卡片终态已经持久提交');
  assert.deepEqual(durableAtEnd[0].entries.find(e => e.message?.role === 'toolResult'), native, '后续SDK append保留已提交原生结果的身份、父链和内容');
  assert.deepEqual(sdkEnds[0].result.details, result.details, 'SDK最终事件、原生结果与公开卡片必须同义');
  assert.deepEqual(sdkEnds[0].result.content, result.content);
  assert.equal(sdkEnds[0].isError, result.isError);
  const events = await replay(client, id, snapshot.lastEventSeq);
  assert.deepEqual(events.filter(e => e.type === 'toolCall').at(-1).value, snapshot.toolCalls[0]);
  assert.equal(controlled.requests(), 1);
  world.app.workbench.db.exec('DROP TRIGGER reject_read_receipt');
  await world.restart();
  assert.deepEqual(ok(await client.request('GET', `${conversations}/${id}`)).toolCalls, snapshot.toolCalls);
  assert.equal(controlled.requests(), 1, '重开只读中断不重查');
  await send(client, id, '明确继续');
  const resumed = await settled(client, id);
  assert.equal(resumed.turns[1].state, 'completed', '保留原生身份后，重开上下文和父链仍有效');
  assert.deepEqual(resumed.toolCalls, snapshot.toolCalls);
  assert.equal(controlled.requests(), 2);
  assert.deepEqual(persisted(world, id).entries.find(e => e.message?.role === 'toolResult'), native);
});
