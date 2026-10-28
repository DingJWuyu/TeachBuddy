import fs from 'node:fs';
import path from 'node:path';
import { provider } from '../fixtures/c26/provider.js';
import { createIntegration } from '../support/application.js';
import { register, question, ok, write, questions } from './helpers.js';

const directory = process.argv[2];
const controlled = await provider([[{ type: 'toolCall', id: 'crash-committed-write', name: 'wb_create_question', arguments: { body: question({ title: '崩溃前实际保存' }) } }]]);
const app = await createIntegration({ directory, agent: controlled.config });
const account = await register({ app, client: () => app.client() }, 'crash-lifecycle@example.test');
const id = ok(await write(account.client, 'POST', '/api/agent/conversations', {}), 201).conversation.id;
ok(await write(account.client, 'PUT', `/api/agent/conversations/${id}/draft`, { baseVersion: 1, text: '保存一道题', references: [] }));
const store = app.workbench.agent.store, update = store.update.bind(store);
store.update = (owner, conversationId, change, options) => {
  const call = store.read(owner, conversationId).snapshot.toolCalls[0];
  const committed = app.workbench.db.prepare('SELECT id FROM question_items WHERE accountKey=?').all(account.account.accountKey);
  if (call?.state === 'executing' && committed.length === 1) {
    fs.writeFileSync(path.join(directory, 'committed-checkpoint.json'), JSON.stringify({ conversationId: id, questionId: committed[0].id, email: account.email, password: account.password, providerRequests: controlled.requests(), callState: call.state }));
    process.kill(process.pid, 'SIGKILL');
  }
  return update(owner, conversationId, change, options);
};
ok(await write(account.client, 'POST', `/api/agent/conversations/${id}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
// 未到真正提交检查点时明确失败，不伪造SIGKILL或执行状态。
setTimeout(() => { console.error(`未到提交检查点: ${questions}`); process.exit(2); }, 10000);
