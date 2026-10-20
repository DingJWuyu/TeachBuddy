import { randomUUID } from 'node:crypto';
import { contractError, problems } from '../workbench/problems.js';
export const migrations = [{ id: 'agent_001_conversations', up(db) {
  db.exec(`CREATE TABLE agent_conversations (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, document TEXT NOT NULL);
    CREATE INDEX agent_account ON agent_conversations(accountKey);
    CREATE TABLE agent_events (conversationId TEXT NOT NULL, seq INTEGER NOT NULL, event TEXT NOT NULL, PRIMARY KEY(conversationId,seq));`);
} }];
export const timestamp = () => new Date().toISOString();
export const emptyUsage = () => ({ input: null, output: null, cacheRead: null, cacheWrite: null, reasoning: null, totalTokens: null, requestsStarted: 0, requestsReported: 0, complete: false, actualCost: null });
function projectDocument(doc) {
  const assistant = [...doc.snapshot.messages].reverse().find(message => message.role === 'assistant' && message.text.trim());
  const line = assistant?.text.replace(/[#>*_`|$\\]/g, '').split('\n').map(text => text.trim()).find(Boolean) ?? '';
  doc.snapshot.conversation.preview = Array.from(line).slice(0, 60).join('');
  return doc;
}
export function createAgentStore(db) {
  const get = db.prepare('SELECT document FROM agent_conversations WHERE accountKey=? AND id=?');
  const all = db.prepare('SELECT document FROM agent_conversations WHERE accountKey=?');
  function read(account, id) {
    const row = get.get(account, id);
    if (!row) throw contractError(problems.notFound());
    return projectDocument(JSON.parse(row.document));
  }
  function list(account) { return all.all(account).map(r => projectDocument(JSON.parse(r.document))); }
  function update(account, id, change, { touch = true } = {}) {
    return db.transaction(() => {
      const doc = read(account, id);
      const emit = (type, value) => {
        const event = { seq: ++doc.snapshot.lastEventSeq, conversationId: id, type, value: structuredClone(value) };
        db.prepare('INSERT INTO agent_events VALUES (?,?,?)').run(id, event.seq, JSON.stringify(event));
      };
      const result = change(doc, emit);
      projectDocument(doc);
      if (touch) doc.snapshot.conversation.updatedAt = timestamp();
      emit('conversation', doc.snapshot.conversation);
      db.prepare('UPDATE agent_conversations SET document=? WHERE id=? AND accountKey=?').run(JSON.stringify(doc), id, account);
      return structuredClone(result ?? doc.snapshot);
    }).immediate();
  }
  return { read, list, update,
    remove(account, id) {
      read(account, id);
      db.prepare('DELETE FROM agent_events WHERE conversationId=?').run(id);
      db.prepare('DELETE FROM agent_conversations WHERE accountKey=? AND id=?').run(account, id);
      return { deleted: id };
    },
    snapshot: (account, id) => read(account, id).snapshot,
    events(account, id, after) { read(account, id); return db.prepare('SELECT event FROM agent_events WHERE conversationId=? AND seq>? ORDER BY seq').all(id, after).map(r => JSON.parse(r.event)); },
    create(account) {
      const now = timestamp(); const id = randomUUID();
      const snapshot = { conversation: { id, title: '新对话', preview: '', createdAt: now, updatedAt: now }, draft: { version: 1, text: '', references: [], updatedAt: now }, messages: [], turns: [], operations: [], toolCalls: [], lastEventSeq: 0 };
      db.prepare('INSERT INTO agent_conversations VALUES (?,?,?)').run(id, account, JSON.stringify({ snapshot, entries: [], journals: {}, requests: {}, stops: [] }));
      return snapshot;
    },
    accounts() { return db.prepare('SELECT DISTINCT accountKey FROM agent_conversations').all().map(r => r.accountKey); }
  };
}
