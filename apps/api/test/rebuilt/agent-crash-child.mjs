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
const db = app.workbench.db;
db.function('agent_crash_checkpoint', (document, questionId) => {
  const call = JSON.parse(document).snapshot.toolCalls[0];
  fs.writeFileSync(path.join(directory, 'committed-checkpoint.json'), JSON.stringify({ conversationId: id, questionId, email: account.email, password: account.password, providerRequests: controlled.requests(), callState: call.state }));
  process.kill(process.pid, 'SIGKILL');
  return 0;
});
db.exec(`CREATE TEMP TRIGGER agent_crash_after_business BEFORE UPDATE ON agent_conversations
  WHEN json_extract(OLD.document, '$.snapshot.toolCalls[0].state')='executing'
    AND (SELECT COUNT(*) FROM question_items WHERE accountKey=OLD.accountKey)=1
  BEGIN SELECT agent_crash_checkpoint(OLD.document, (SELECT id FROM question_items WHERE accountKey=OLD.accountKey)); END`);
ok(await write(account.client, 'POST', `/api/agent/conversations/${id}/turns`, { draftVersion: 2, modelId: 'deepseek/deepseek-v4.1-flash' }), 202);
// 未到真正提交检查点时明确失败，不伪造SIGKILL或执行状态。
setTimeout(() => { console.error(`未到提交检查点: ${questions}`); process.exit(2); }, 10000);
