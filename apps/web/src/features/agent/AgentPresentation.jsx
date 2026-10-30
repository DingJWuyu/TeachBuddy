import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAgent } from './AgentProvider.jsx';
import { tx } from '../../i18n/presentation.js';
import { workbenchGet } from '../../platform/http/apiClient.js';
import { isDeletedAccount } from '../../platform/device/storage.js';

const Context = createContext(null);
export const usePresentationAgent = () => useContext(Context);
function read(key) { try { const value = JSON.parse(localStorage.getItem(key)) ?? {}; for (const doc of Object.values(value.docs ?? {})) { for (const turn of doc.turns) if (turn.state === 'running') { turn.state = 'interrupted'; turn.reason = 'server-restart'; } for (const message of doc.messages) if (message.state === 'streaming') message.state = 'partial'; for (const call of doc.toolCalls) if (call.state === 'executing') call.state = 'interrupted'; } return value; } catch { return {}; } }

// Retain existing local example history for reading; new conversations use the server.
export function AgentPresentationProvider({ children }) {
  const real = useAgent();
  const key = real.prefix + 'presentation';
  const [state, setState] = useState(() => read(key));
  const current = useRef(state);
  const live = useRef(true);
  const [error, setError] = useState('');
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
    };
  }, [real.accountKey]);
  const docs = state.docs ?? {};
  const meta = state.meta ?? {};
  const selected = !meta[state.active]?.hidden && docs[state.active];
  const isDemo = Boolean(selected);
  // Device meta is a fallback: a server title wins only once explicitly renamed, and a device hide never deletes on the server.
  function project(conversation) {
    const old = meta[conversation.id] ?? {};
    if (docs[conversation.id]) return { ...conversation, ...old };
    return {
      ...conversation,
      title: conversation.titleEdited === true ? conversation.title : old.title ?? conversation.title,
      pinned: Object.hasOwn(conversation, 'pinned') ? conversation.pinned : old.pinned,
    };
  }
  const activeAllowed = real.id && !meta[real.id]?.hidden;
  useEffect(() => {
    if (!isDemo && real.id && meta[real.id]?.hidden) {
      real.select(real.list.find(item => !meta[item.id]?.hidden)?.id ?? null);
    }
  }, [real.id, real.list, isDemo, state.meta]);
  const list = [...real.list, ...Object.values(docs).map(d => d.conversation)]
    .filter(item => !meta[item.id]?.hidden)
    .map(project)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  async function patchThread(id, patch) {
    if (!current.current.docs?.[id]) return real.patchThread(id, patch);
    update({ ...current.current, meta: { ...current.current.meta, [id]: { ...current.current.meta?.[id], ...patch } } });
  }
  function select(id) {
    update({ ...current.current, active: id.startsWith('demo-') ? id : null });
    if (!id.startsWith('demo-')) real.select(id);
  }
  const source = selected || (activeAllowed && real.snapshot?.conversation.id === real.id ? real.snapshot : null);
  const snapshot = source ? { ...source, conversation: project(source.conversation) } : null;
  const value = { ...real, list, snapshot, isDemo, error: error || (!isDemo ? real.error : ''),
    id: isDemo ? selected.conversation.id : activeAllowed ? real.id : null,
    draft: isDemo ? selected.draft : activeAllowed ? real.draft : null,
    status: isDemo ? tx('仅保留在此设备') : real.status,
    sendPending: !isDemo && real.sendPending, conflict: !isDemo && real.conflict, busy: !isDemo && real.busy,
    addReference: async (kind, id) => { update({ ...current.current, active: null }); await real.addReference(kind, id); },
    select, patchThread,
    create: async () => { update({ ...current.current, active: null }); await real.create(); },
    deleteThread: async id => {
      if (!current.current.docs?.[id]) return real.deleteThread(id);
      const doc = current.current.docs?.[id];
      if (doc?.turns.some(t => t.state === 'running') || real.configuration?.activeTurn?.conversationId === id) return;
      const remaining = { ...current.current.docs }; delete remaining[id];
      update({ ...current.current, docs: remaining, active: current.current.active === id ? null : current.current.active, meta: { ...current.current.meta, [id]: { hidden: true } } });
    },
    edit: patch => { if (!isDemo) real.edit(patch); },
    send: isDemo ? () => {} : real.send,
    stop: isDemo ? () => {} : real.stop,
    read: async path => (await workbenchGet(path)).body,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
