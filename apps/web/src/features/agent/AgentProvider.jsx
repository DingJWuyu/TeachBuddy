import { AgentPresentationProvider } from './AgentPresentation.jsx';
import { useTranslation } from 'react-i18next';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isDeletedAccount } from '../../platform/device/storage.js';
import { workbenchGet, workbenchPost, workbenchPut, workbenchPatch, workbenchDelete, workbenchEvents } from '../../platform/http/apiClient.js';
const Context = createContext(null);
export const useAgent = () => useContext(Context);
const base = '/api/agent/conversations';
const uuid = () => crypto.randomUUID();
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
export function AgentProvider({ accountKey, children }) {
  const { t } = useTranslation('agent');
  const prefix = `teachbuddy:agent:${accountKey}:`;
  const [list, setList] = useState([]), [snapshot, setSnapshot] = useState(null), [configuration, setConfiguration] = useState(null);
  const [id, setId] = useState(() => read(prefix + 'active', null));
  const [draft, setDraft] = useState(null), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [businessRevision, setBusinessRevision] = useState(0);
  const [sendPending, setSendPending] = useState(false);
  const [conflict, setConflict] = useState(null), [busy, setBusy] = useState(false);
  const [model, setModel] = useState('deepseek/deepseek-v4.1-flash');
  const savingDone = useRef(Promise.resolve());
  const live = useRef(true), current = useRef({}), saving = useRef(false), draftRef = useRef(null);
  current.current = { id, snapshot, draft, model }; draftRef.current = draft;
  function persist(key, value) { try { if (isDeletedAccount(accountKey)) return false; localStorage.setItem(prefix + key, JSON.stringify(value)); return true; } catch { setStatus("仅保留在此设备"); return false; } }
  async function refreshList() {
    const [history, config] = await Promise.all([workbenchGet(base), workbenchGet('/api/agent/configuration')]);
    if (!live.current) return;
    setList(history.body.items); setConfiguration(config.body);
    if (!history.body.items.some(item => item.id === current.current.id)) {
      setId(history.body.items[0]?.id ?? null);
      if (!history.body.items.length) { setSnapshot(null); setDraft(null); persist('active', null); }
    }
  }
  useEffect(() => { live.current = true; refreshList().catch(() => setError(t("无法读取对话，请重试"))); return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!id) return;
    let disposed = false; let controller; let reconnect; let initialized = false;
    setSendPending(Boolean(read(prefix + id + ':send', null)));
    persist('active', id); setSnapshot(null); setDraft(null); setConflict(null); setError('');
    async function connect() {
      controller = new AbortController();
      try {
        const { body } = await workbenchGet(`${base}/${id}`);
        if (disposed) return;
        setSnapshot(body);
        if (!initialized || (!draftRef.current?.dirty && !saving.current)) {
          const local = initialized ? draftRef.current : read(prefix + id, null);
          const next = local?.dirty ? local : { ...body.draft, dirty: false };
          draftRef.current = next; setDraft(next); persist(id, next);
          setStatus(next.dirty ? "仅保留在此设备" : "草稿已保存");
        }
        initialized = true;
        setError(previous => previous === "连接中断，正在恢复已保存内容" ? '' : previous);
        let cursor = body.lastEventSeq;
        await workbenchEvents(`${base}/${id}/events?after=${cursor}`, controller.signal, event => {
          if (disposed || event.seq <= cursor) return;
          if (event.seq !== cursor + 1) { controller.abort(); return; }
          cursor = event.seq;
          setSnapshot(previous => {
            if (!previous || previous.conversation.id !== id) return previous;
            const next = { ...previous, lastEventSeq: event.seq };
            const field = { message: 'messages', turn: 'turns', operation: 'operations', toolCall: 'toolCalls' }[event.type];
            if (field) {
              const key = event.type === 'toolCall' ? 'toolCallId' : 'id';
              next[field] = previous[field].some(v => v[key] === event.value[key]) ? previous[field].map(v => v[key] === event.value[key] ? event.value : v) : [...previous[field], event.value];
            } else next[event.type] = event.value;
            return next;
          });
          if (event.type === 'draft' && !draftRef.current?.dirty && !saving.current) {
            const next = { ...event.value, dirty: false }; setDraft(next); persist(id, next);
          }
          if (event.type === 'operation' && event.value.state === 'confirmed') setBusinessRevision(value => value + 1);
          if (event.type === 'conversation') setList(previous => previous.map(item => item.id === event.value.id ? event.value : item).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)));
          if (event.type === 'turn') void refreshList();
        });
      } catch { if (!disposed) setError("连接中断，正在恢复已保存内容"); }
      if (!disposed) reconnect = setTimeout(() => connect(), 1500);
    }
    void connect();
    return () => { disposed = true; controller?.abort(); clearTimeout(reconnect); };
  }, [id]);
  function edit(patch) {
    const next = { ...draftRef.current, ...patch, dirty: true };
    draftRef.current = next; setDraft(next); persist(id, next); setStatus("仅保留在此设备");
  }
  async function save(frozen) {
    const cid = current.current.id, value = frozen ?? draftRef.current;
    if (!cid || !value || !value.dirty || saving.current || conflict) return value;
    saving.current = true; setStatus("保存中");
    let finishSaving;
    savingDone.current = new Promise(resolve => { finishSaving = resolve; });
    const pending = value.pending ?? { key: uuid(), body: { baseVersion: value.version, text: value.text, references: value.references } };
    const held = { ...(frozen ? draftRef.current : value), pending }; setDraft(held); draftRef.current = held; persist(cid, held);
    try {
      const { body } = await workbenchPut(`${base}/${cid}/draft`, pending.body, pending.key);
      if (!live.current || current.current.id !== cid) return null;
      const latest = draftRef.current;
      const changed = latest.text !== pending.body.text || JSON.stringify(latest.references) !== JSON.stringify(pending.body.references);
      const next = changed ? { ...latest, version: body.version, pending: null, dirty: true } : { ...body, dirty: false };
      setDraft(next); draftRef.current = next; persist(cid, next); setStatus(changed ? "仅保留在此设备" : "草稿已保存"); setError('');
      return frozen ? body : next;
    } catch (err) {
      if (!live.current || current.current.id !== cid) return null;
      setStatus("仅保留在此设备");
      if (err.problem?.type === '/problems/agent/draft-conflict') {
        try { const { body } = await workbenchGet(`${base}/${cid}`); if (live.current && current.current.id === cid) setConflict(body.draft); } catch { setError(t("无法读取已保存草稿，请重试")); }
      } else setError(err.problem?.message ?? t("草稿保存失败，请重试"));
      return null;
    } finally { saving.current = false; finishSaving(); }
  }
  useEffect(() => {
    // Autosave pauses while a send is unconfirmed so the server clears the submitted version; typing stays allowed.
    if (!draft?.dirty || draft.pending || conflict || busy || sendPending) return;
    const timer = setTimeout(() => void save(), 650); return () => clearTimeout(timer);
  }, [draft, conflict, busy, sendPending]);
  async function chooseDraft(local) {
    const { body } = await workbenchGet(`${base}/${id}`);
    const next = local ? { ...draftRef.current, version: body.draft.version, pending: null, dirty: true } : { ...body.draft, dirty: false };
    setConflict(null); setDraft(next); draftRef.current = next; persist(id, next); setStatus(local ? "仅保留在此设备" : "草稿已保存");
  }
  async function create() {
    setBusy(true);
    try {
      const pending = read(prefix + 'create', null) ?? { key: uuid() }; persist('create', pending);
      const { body } = await workbenchPost(base, {}, pending.key);
      if (!live.current) return;
      persist('create', null); setId(body.conversation.id); await refreshList();
    } catch { setError(t("无法创建对话，请重试")); } finally { if (live.current) setBusy(false); }
  }
  async function manageThread(cid, method, body) {
    const storageKey = cid + ':management:' + method;
    const saved = read(prefix + storageKey, null);
    const pending = saved ?? { key: uuid(), body };
    persist(storageKey, pending);
    try {
      const request = method === 'PATCH' ? workbenchPatch : workbenchDelete;
      const result = await request(`${base}/${cid}`, pending.body, pending.key);
      if (!live.current) return;
      persist(storageKey, null);
      // An unknown earlier result is settled before accepting a different edit.
      if (JSON.stringify(pending.body) !== JSON.stringify(body)) return manageThread(cid, method, body);
      setError('');
      return result.body;
    } catch (err) {
      if (err.problem?.status >= 400 && err.problem.status < 500) persist(storageKey, null);
      setError(err.problem?.title ?? err.problem?.message ?? '操作未完成，请查看结果');
      throw err;
    }
  }
  async function patchThread(cid, patch) {
    await manageThread(cid, 'PATCH', patch);
    if (live.current) await refreshList();
  }
  async function deleteThread(cid) {
    await manageThread(cid, 'DELETE', {});
    if (!live.current) return;
    for (const suffix of ['', ':send']) localStorage.removeItem(prefix + cid + suffix);
    if (current.current.id === cid) {
      const history = (await workbenchGet(base)).body.items;
      if (!live.current) return;
      setList(history);
      if (history.length) setId(history[0].id);
      else { setId(null); setSnapshot(null); setDraft(null); await create(); }
    }
    await refreshList();
  }
  async function send() {
    if (busy) return; setBusy(true); setError('');
    try {
      const cid = id;
      const prior = read(prefix + cid + ':send', null);
      const intent = prior ?? structuredClone({ text: draftRef.current.text, references: draftRef.current.references, modelId: model });
      await savingDone.current;
      if (!live.current || current.current.id !== cid) return;
      let value = draftRef.current;
      if (!prior && value.pending) {
        value = await save();
        if (!value) return;
      }
      if (!prior && (value.dirty || value.text !== intent.text || JSON.stringify(value.references) !== JSON.stringify(intent.references))) {
        value = await save({ ...value, text: intent.text, references: intent.references, dirty: true, pending: null });
      }
      if (!prior && (!value || value.dirty)) return;
      const pending = prior ?? { key: uuid(), body: { draftVersion: value.version, modelId: intent.modelId }, text: intent.text, references: intent.references };
      persist(cid + ':send', pending); setSendPending(true);
      await workbenchPost(`${base}/${cid}/turns`, pending.body, pending.key);
      if (!live.current || current.current.id !== cid) return;
      persist(cid + ':send', null); setSendPending(false);
      const confirmed = (await workbenchGet(`${base}/${cid}`)).body.draft;
      if (!live.current || current.current.id !== cid) return;
      const latest = draftRef.current;
      const next = latest.text === pending.text && JSON.stringify(latest.references) === JSON.stringify(pending.references)
        ? { ...confirmed, dirty: false } : { ...latest, version: confirmed.version, pending: null, dirty: true };
      setDraft(next); draftRef.current = next; persist(cid, next); await refreshList();
    } catch (err) {
      if (err.problem?.status >= 400 && err.problem.status < 500) { persist(id + ':send', null); setSendPending(false); }
      setError(({ '/problems/agent/reference-conflict': t("引用内容已变更，请移除后重新加入"), '/problems/agent/pending-operation': t("请先确认待核实的写入结果"), '/problems/agent/turn-active': t("另一段对话正在生成") })[err.problem?.type] ?? t("发送尚未确认，请重试"));
    } finally { if (live.current) setBusy(false); }
  }
  async function stop(turn) { try { await workbenchPost(`${base}/${turn.conversationId}/turns/${turn.id}/stop`, {}, uuid()); } catch { setError(t("停止尚未确认，请重试")); } }
  async function reconcile(operationId) { try { await workbenchPost(`${base}/${id}/operations/${operationId}/reconcile`, {}, uuid()); } catch { setError(t("暂时无法确认结果，请重试")); } }
  async function executeProposal(proposalId, slot) {
    const conversationId = id;
    let { body: operation } = await workbenchPost(`${base}/${conversationId}/proposals/${proposalId}/execute`, { slot }, uuid());
    // Acceptance only prepares the operation. Await its persisted business result.
    for (let attempt = 0; ['prepared', 'executing'].includes(operation.state); attempt++) {
      if (attempt >= 60 || !live.current) throw new Error('Operation pending');
      await new Promise(resolve => setTimeout(resolve, 500));
      const { body } = await workbenchGet(`${base}/${conversationId}`);
      operation = body.operations.find(value => value.id === operation.id) ?? operation;
    }
    return operation;
  }
  async function addReference(kind, objectId) {
    const paths = { question: '/api/modules/questions/v2/items/', resource: '/api/modules/resources/items/', entry: '/api/modules/schedule/entries/' };
    if (!paths[kind]) return;
    if (!id) { setError(t("请先新建对话")); return; }
    try {
      const { body } = await workbenchGet(paths[kind] + encodeURIComponent(objectId));
      const input = { kind, id: objectId, version: body.version };
      const refs = draftRef.current?.references ?? [];
      edit({ references: [...refs.filter(r => !(r.kind === kind && r.id === objectId)), input] });
    } catch { setError(t("当前内容不可用")); }
  }
  return <Context.Provider value={{ accountKey, list, id, sendPending, businessRevision, select: setId, snapshot, draft,
    status: ({ '仅保留在此设备': t('仅保留在此设备'), '草稿已保存': t('草稿已保存'), '保存中': t('保存中') })[status] ?? status,
    error: error === '连接中断，正在恢复已保存内容' ? t('连接中断，正在恢复已保存内容') : error,
    conflict, busy, model, setModel, configuration,
    edit, save, create, send, stop, reconcile, executeProposal, chooseDraft, addReference, patchThread, deleteThread, retry: refreshList, prefix }}><AgentPresentationProvider key={accountKey}>{children}</AgentPresentationProvider></Context.Provider>;
}

export function clearAgentDeviceData(account) {
  const prefix = `teachbuddy:agent:${account}:`;
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
