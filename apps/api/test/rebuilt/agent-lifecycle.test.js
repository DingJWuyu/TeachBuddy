import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { provider } from '../fixtures/c26/provider.js';
import { createIntegration } from '../support/application.js';
import { unlock } from '../../src/workbench/reliability/backup.js';
import { createWorld, register, login, question, questions, ok, problem, write, upload } from './helpers.js';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

async function settled(client, url) {
  for (let i = 0; i < 300; i++) {
    const snapshot = ok(await client.request('GET', url));
    if (snapshot.turns[0].state !== 'running') return snapshot;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Agent生命周期未进入持久终态');
}

test('D12 Agent停止：首个写入confirmed保留，同批第二个prepared取消且不再请求模型', { timeout: 30000 }, async t => {
  const controlled = await provider([[...['必须保留', '不能执行'].map((title, index) => ({ type: 'toolCall', id: `stop-chain-${index}`, name: 'wb_create_question', arguments: { body: question({ title }) } }))]]);
  const world = await createWorld(t, { agent: controlled.config }), account = await register(world);
  const id = ok(await write(account.client, 'POST', '/api/agent/conversations', {}), 201).conversation.id;
  const url = `/api/agent/conversations/${id}`;
  ok(await write(account.client, 'PUT', `${url}/draft`, { baseVersion: 1, text: '依次保存两道题', references: [] }));
  let reached, release;
  const paused = new Promise(resolve => { reached = resolve; });
  const resume = new Promise(resolve => { release = resolve; });
  t.signal.addEventListener('abort', () => release(), { once: true });
  const identity = world.app.workbench.identity, authorize = identity.resolvePrincipal.bind(identity);
  let toolAuthorizations = 0;
  identity.resolvePrincipal = async request => {
    const principal = await authorize(request);
    if (request.originalUrl?.endsWith('/turns')) {
      const snapshot = world.app.workbench.agent.store.read(principal.accountKey, id).snapshot;
      if (snapshot.toolCalls.length === 2 && ++toolAuthorizations === 2) {
        while (['prepared', 'executing'].includes(world.app.workbench.agent.store.read(principal.accountKey, id).snapshot.toolCalls[0].state)) {
          if (t.signal.aborted) throw new Error('测试已结束');
          await new Promise(resolve => setImmediate(resolve));
        }
        reached();
        await resume;
      }
    }
    return principal;
  };
  try {
    const accepted = ok(await write(account.client, 'POST', `${url}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
    await paused;
    const beforeStop = ok(await account.client.request('GET', url));
    assert.equal(beforeStop.turns[0].state, 'running');
    assert.deepEqual(beforeStop.toolCalls.map(call => call.state), ['confirmed', 'prepared']);
    ok(await write(account.client, 'POST', `${url}/turns/${accepted.turn.id}/stop`, {}));
  } finally { release(); }
  const stopped = await settled(account.client, url);
  assert.equal(stopped.turns[0].state, 'stopped');
  assert.equal(stopped.turns[0].reason, 'user-stop');
  assert.deepEqual(stopped.toolCalls.map(call => call.state), ['confirmed', 'cancelled']);
  const saved = ok(await account.client.request('GET', questions)).items;
  assert.deepEqual(saved.map(item => item.title), ['必须保留'], '停止不得回滚已确认写入或执行第二个工具');
  assert.equal(controlled.requests(), 1);
});

test('D12 Agent崩溃：真实SIGKILL发生于业务提交后日志前，重开转unconfirmed并原键找回同一对象', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuilt-agent-sigkill-'));
  let app;
  t.after(async () => { await app?.close(); if (t.passed) fs.rmSync(directory, { recursive: true, force: true }); else console.error(`SIGKILL现场保留: ${directory}`); });
  const child = spawn(process.execPath, [fileURLToPath(new URL('./agent-crash-child.mjs', import.meta.url)), directory], { stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = '';
  child.stdout.on('data', chunk => { diagnostics += chunk; });
  child.stderr.on('data', chunk => { diagnostics += chunk; });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const outcome = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
  assert.equal(outcome.signal, 'SIGKILL', diagnostics);
  const checkpoint = JSON.parse(fs.readFileSync(path.join(directory, 'committed-checkpoint.json'), 'utf8'));
  assert.equal(checkpoint.callState, 'executing');
  assert.equal(checkpoint.providerRequests, 1);
  unlock({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), stopped: true });
  const controlled = await provider([]);
  app = await createIntegration({ directory, agent: controlled.config });
  const { client } = await login({ client: () => app.client() }, checkpoint);
  const url = `/api/agent/conversations/${checkpoint.conversationId}`;
  const recovered = ok(await client.request('GET', url));
  assert.equal(recovered.turns[0].state, 'interrupted');
  assert.equal(recovered.turns[0].reason, 'server-restart');
  assert.equal(recovered.operations[0].state, 'unconfirmed', '执行中的写入不能当作从未开始而取消');
  assert.equal(recovered.toolCalls[0].state, 'unconfirmed');
  assert.equal(controlled.requests(), 0, '重开不自动重新请求模型');
  const confirmed = ok(await write(client, 'POST', `${url}/operations/${recovered.operations[0].id}/reconcile`, {}));
  assert.equal(confirmed.state, 'confirmed');
  assert.equal(confirmed.result.id, checkpoint.questionId, '原操作核实必须返回崩溃前实际已保存的同一对象');
  assert.deepEqual(ok(await client.request('GET', questions)).items.map(item => item.id), [checkpoint.questionId]);
  assert.equal(ok(await client.request('GET', url)).toolCalls[0].state, 'confirmed');
  assert.equal(controlled.requests(), 0, '核实不请求模型');
});

test('D03 活跃删号：真实SDK收到abort后仍未settle时保留业务及原件，settle后才204且无迟到复活', async t => {
  let started, aborted, release;
  const entered = new Promise(resolve => { started = resolve; });
  const stopping = new Promise(resolve => { aborted = resolve; });
  const released = new Promise(resolve => { release = resolve; });
  const controlled = await provider([async (_context, options) => {
    started();
    await new Promise(resolve => {
      if (options.signal.aborted) resolve();
      else options.signal.addEventListener('abort', resolve, { once: true });
    });
    aborted();
    await released;
    throw new Error('controlled provider finished abort');
  }]);
  const world = await createWorld(t, { agent: controlled.config }), a = await register(world), b = await register(world);
  const q = ok(await write(a.client, 'POST', questions, question({ title: '等待生产者结束才清理' })), 201);
  const other = ok(await write(b.client, 'POST', questions, question({ title: '另一账户继续使用' })), 201);
  const file = ok(await upload(a.client, sourceImage('I-1'), '活动删除原件.png'), 201);
  const blobName = world.app.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.id).blobName;
  const blob = path.join(world.directory, 'files', 'blobs', blobName);
  const id = ok(await write(a.client, 'POST', '/api/agent/conversations', {}), 201).conversation.id;
  const url = `/api/agent/conversations/${id}`;
  ok(await write(a.client, 'PUT', `${url}/draft`, { baseVersion: 1, text: '等待响应', references: [] }));
  ok(await write(a.client, 'POST', `${url}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
  await entered;
  let responded = false;
  const deletion = a.client.request('POST', '/api/auth/account-deletion', { body: { requestId: randomBytes(32).toString('hex'), sessionId: a.sessionId, email: a.email } })
    .then(response => { responded = true; return response; });
  try {
    await stopping;
    assert.equal(ok(await b.client.request('GET', `${questions}/${other.id}`)).id, other.id, '等待生产者退出不阻塞另一账户');
    assert.ok(world.app.workbench.db.prepare('SELECT id FROM question_items WHERE id=?').get(q.id), 'SDK尚未settle时不得提前擦除业务资料');
    assert.equal(fs.existsSync(blob), true, 'SDK尚未settle时不得提前擦除文件字节');
    assert.equal(responded, false, '收到abort不等于生产者已经结束，不能提前报告204');
  } finally { release(); }
  ok(await deletion, 204);
  const db = world.app.workbench.db;
  assert.equal(db.prepare('SELECT COUNT(*) n FROM question_items WHERE accountKey=?').get(a.account.accountKey).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM agent_conversations WHERE accountKey=?').get(a.account.accountKey).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM agent_events WHERE conversationId=?').get(id).n, 0);
  assert.equal(fs.existsSync(blob), false);
  problem(await write(a.client, 'POST', questions, question()), 401, 'unauthenticated');
  assert.equal(ok(await b.client.request('GET', `${questions}/${other.id}`)).id, other.id);
  assert.equal(controlled.requests(), 1, '取消后不得再请求模型或复活对话');
});
