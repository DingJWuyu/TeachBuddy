import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAgent } from './AgentProvider.jsx';
import { createDemoScript } from './demoScript.js';
import { createSampleWeek } from './sampleWeek.js';
import { tx } from '../../i18n/presentation.js';
import { workbenchGet } from '../../platform/http/apiClient.js';
import { isDeletedAccount } from '../../platform/device/storage.js';

const Context = createContext(null);
export const usePresentationAgent = () => useContext(Context);
const stamp = () => new Date().toISOString();
const uuid = () => 'demo-' + crypto.randomUUID();
function read(key) { try { const value = JSON.parse(localStorage.getItem(key)) ?? {}; for (const doc of Object.values(value.docs ?? {})) { for (const turn of doc.turns) if (turn.state === 'running') { turn.state = 'interrupted'; turn.reason = 'server-restart'; } for (const message of doc.messages) if (message.state === 'streaming') message.state = 'partial'; for (const call of doc.toolCalls) if (call.state === 'executing') call.state = 'interrupted'; } return value; } catch { return {}; } }

// Presentation-only metadata and demonstrations never enter the genuine agent API.
// The original useAgent remains the business port used by all other modules.
export function AgentPresentationProvider({ children }) {
  const real = useAgent();
  const key = real.prefix + 'presentation';
  const [state, setState] = useState(() => read(key));
  const current = useRef(state);
  const live = useRef(true);
  const runs = useRef(new Map());
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  function update(next) {
    if (!live.current || isDeletedAccount(real.accountKey)) return;
    current.current = next; setState(next);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { setError(tx('仅保留在此设备')); }
  }
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      for (const run of runs.current.values()) { run.cancel?.(); }
      runs.current.clear();
    };
  }, [real.accountKey]);
  const docs = state.docs ?? {};
  const selected = docs[state.active];
  const isDemo = Boolean(selected);
  const meta = state.meta ?? {};
  const list = [...real.list, ...Object.values(docs).map(d => d.conversation)]
    .filter(item => !meta[item.id]?.hidden)
    .map(item => ({ ...item, ...meta[item.id], title: meta[item.id]?.title ?? item.title }))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  function patchThread(id, patch) {
    update({ ...current.current, meta: { ...current.current.meta, [id]: { ...current.current.meta?.[id], ...patch } } });
  }
  function select(id) {
    update({ ...current.current, active: id.startsWith('demo-') ? id : null });
    if (!id.startsWith('demo-')) real.select(id);
  }
  function putDoc(doc, preserveDraft = false) {
    if (preserveDraft && current.current.docs?.[doc.conversation.id]) doc.draft = current.current.docs[doc.conversation.id].draft;
    doc.conversation.updatedAt = stamp();
    const reply = [...doc.messages].reverse().find(m => m.role === 'assistant' && m.text);
    if (reply) doc.conversation.preview = reply.text.replace(/[#>*_`|$\\]/g, '').slice(0, 60);
    update({ ...current.current, docs: { ...current.current.docs, [doc.conversation.id]: structuredClone(doc) } });
  }
  async function demoRead(path) {
    const data = current.current.data;
    if (!data) throw new Error('No local example');
    if (path.includes('/taxonomy')) return data.taxonomy;
    const collection = path.includes('/questions/') ? data.questions : path.includes('/resources/') ? data.resources : path.endsWith('/labels') ? data.labels : data.entries;
    const tail = path.split('?')[0].split('/').pop();
    if (['items', 'entries', 'labels'].includes(tail)) {
      const q = new URL(path, window.location.origin).searchParams.get('q');
      return { items: q ? collection.filter(item => `${item.title} ${JSON.stringify(item.body ?? '')}`.includes(q)) : collection };
    }
    const object = collection.find(item => item.id === tail);
    if (object) return object;
    // Explicitly selected saved references are readable, never writable by demo.
    return (await workbenchGet(path)).body;
  }
  async function startDemo(text = '', references = []) {
    const data = current.current.data ?? await createSampleWeek();
    if (!live.current) return;
    const id = uuid();
    const doc = { conversation: { id, title: tx('本地示例对话'), updatedAt: stamp() }, draft: { version: 1, text, references }, messages: [], turns: [], toolCalls: [], operations: [], lastEventSeq: 0 };
    update({ ...current.current, data, active: id, docs: { ...current.current.docs, [id]: doc } });
  }
  function finish(doc, turn, stopped = false) {
    turn.state = stopped ? 'interrupted' : 'completed'; turn.reason = stopped ? 'user-stop' : null; turn.endedAt = stamp();
    for (const message of doc.messages.filter(m => m.turnId === turn.id && m.role === 'assistant')) message.state = stopped ? 'partial' : 'complete';
    for (const call of doc.toolCalls.filter(c => c.turnId === turn.id && c.state === 'executing')) call.state = 'interrupted';
    runs.current.delete(turn.id); putDoc(doc, true);
  }
  async function send() {
    const doc = structuredClone(current.current.docs?.[current.current.active]);
    if (!doc?.draft.text.trim() || Object.values(current.current.docs ?? {}).some(d => d.turns.some(t => t.state === 'running'))) return;
    const id = uuid(), messageId = uuid();
    const references = await Promise.all(doc.draft.references.map(async input => {
      const path = input.kind === 'question' ? '/api/modules/questions/v2/items/' : input.kind === 'entry' ? '/api/modules/schedule/entries/' : '/api/modules/resources/items/';
      const snapshot = await demoRead(path + input.id).catch(() => ({ title: tx('当前内容不可用') }));
      return { input, title: snapshot.title, snapshot };
    }));
    const turn = { id, conversationId: doc.conversation.id, userMessageId: messageId, modelId: real.model, state: 'running', createdAt: stamp() };
    doc.turns.push(turn); doc.messages.push({ id: messageId, turnId: id, role: 'user', text: doc.draft.text, references, createdAt: stamp() });
    if (doc.turns.length === 1) doc.conversation.title = tx('本地示例对话') + ' · ' + doc.draft.text.slice(0, 24);
    const prompt = doc.draft.text; doc.draft = { ...doc.draft, version: doc.draft.version + 1, text: '', references: [] }; putDoc(doc);
    try {
      await createDemoScript(demoRead).run({ doc, turn, prompt, references, emit: () => {}, updated: () => putDoc(doc, true), finish, stamp, id: uuid, runs: runs.current });
    } catch { finish(doc, turn, true); setError(tx('操作未完成，请查看结果')); }
  }
  const snapshot = selected ? { ...selected, conversation: { ...selected.conversation, ...meta[selected.conversation.id] } } : real.snapshot ? { ...real.snapshot, conversation: { ...real.snapshot.conversation, ...meta[real.id] } } : null;
  const value = { ...real, list, snapshot, isDemo, error: error || (!isDemo ? real.error : ''),
    id: isDemo ? selected.conversation.id : real.id,
    draft: isDemo ? selected.draft : real.draft,
    configuration: isDemo ? { models: real.configuration?.models?.map(m => ({ ...m, state: 'ready' })) ?? [{ id: real.model, state: 'ready' }] } : real.configuration,
    status: isDemo ? tx('仅保留在此设备') : real.status,
    sendPending: !isDemo && real.sendPending, conflict: !isDemo && real.conflict, busy: !isDemo && real.busy,
    addReference: async (kind, id) => { update({ ...current.current, active: null }); await real.addReference(kind, id); },
    select, patchThread, startDemo, preview, closeDemoObject: () => setPreview(null),
    openDemoObject: async (kind, id) => { const path = kind === 'question' ? '/api/modules/questions/v2/items/' : kind === 'entry' ? '/api/modules/schedule/entries/' : '/api/modules/resources/items/'; setPreview(await demoRead(path + id)); },
    create: async () => { update({ ...current.current, active: null }); await real.create(); },
    deleteThread: id => {
      const doc = current.current.docs?.[id];
      if (doc?.turns.some(t => t.state === 'running') || real.configuration?.activeTurn?.conversationId === id) return;
      const remaining = { ...current.current.docs }; delete remaining[id];
      update({ ...current.current, docs: remaining, active: current.current.active === id ? null : current.current.active, meta: { ...current.current.meta, [id]: { hidden: true } } });
    },
    edit: patch => { if (isDemo) { const doc = structuredClone(current.current.docs[selected.conversation.id]); doc.draft = { ...doc.draft, ...patch }; putDoc(doc); } else real.edit(patch); },
    send: isDemo ? send : real.send,
    stop: isDemo ? turn => { const doc = current.current.docs[turn.conversationId]; const active = doc?.turns.find(t => t.id === turn.id); if (!active) return; const run = runs.current.get(turn.id); run?.cancel?.(); const source = run?.doc ?? doc; const target = source.turns.find(t => t.id === turn.id); finish(source, target, true); } : real.stop,
    saveDemoResult: async (kind, object) => {
      if (!isDemo) throw new Error('Demo actions require a demo conversation');
      const field = kind === 'question' ? 'questions' : 'entries';
      update({ ...current.current, data: { ...current.current.data, [field]: [...current.current.data[field], { ...object, id: uuid(), version: 1 }] } });
    },
    read: isDemo ? demoRead : async path => (await workbenchGet(path)).body,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
