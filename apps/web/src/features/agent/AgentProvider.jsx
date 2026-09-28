import { useTranslation } from 'react-i18next';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isDeletedAccount } from '../workbench/storage.js';
import { workbenchGet, workbenchPost, workbenchPut, workbenchEvents } from '../workbench/apiClient.js';
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
  const live = useRef(true), current = useRef({}), saving = useRef(false), draftRef = useRef(null);
  current.current = { id, snapshot, draft, model }; draftRef.current = draft;
  function persist(key, value) { try { if (isDeletedAccount(accountKey)) return false; localStorage.setItem(prefix + key, JSON.stringify(value)); return true; } catch { setStatus("仅保留在此设备"); return false; } }
  async function refreshList() {
    const [history, config] = await Promise.all([workbenchGet(base), workbenchGet('/api/agent/configuration')]);
    if (!live.current) return;
    setList(history.body.items); setConfiguration(config.body);
    if (!current.current.id && history.body.items.length) setId(history.body.items[0].id);
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
  async function save() {
    const cid = current.current.id, value = draftRef.current;
    if (!cid || !value || !value.dirty || saving.current || conflict) return value;
    saving.current = true; setStatus("保存中");
    const pending = value.pending ?? { key: uuid(), body: { baseVersion: value.version, text: value.text, references: value.references } };
    const held = { ...value, pending }; setDraft(held); draftRef.current = held; persist(cid, held);
    try {
      const { body } = await workbenchPut(`${base}/${cid}/draft`, pending.body, pending.key);
      if (!live.current || current.current.id !== cid) return null;
      const latest = draftRef.current;
      const changed = latest.text !== pending.body.text || JSON.stringify(latest.references) !== JSON.stringify(pending.body.references);
      const next = changed ? { ...latest, version: body.version, pending: null, dirty: true } : { ...body, dirty: false };
      setDraft(next); draftRef.current = next; persist(cid, next); setStatus(changed ? "仅保留在此设备" : "草稿已保存"); setError('');
      return next;
    } catch (err) {
      if (!live.current || current.current.id !== cid) return null;
      setStatus("仅保留在此设备");
      if (err.problem?.type === '/problems/agent/draft-conflict') {
        try { const { body } = await workbenchGet(`${base}/${cid}`); if (live.current && current.current.id === cid) setConflict(body.draft); } catch { setError(t("无法读取已保存草稿，请重试")); }
      } else setError(err.problem?.message ?? t("草稿保存失败，请重试"));
      return null;
    } finally { saving.current = false; }
  }
  useEffect(() => {
    if (!draft?.dirty || draft.pending || conflict) return;
    const timer = setTimeout(() => void save(), 650); return () => clearTimeout(timer);
  }, [draft, conflict]);
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
  async function send() {
    if (busy) return; setBusy(true); setError('');
    try {
      const cid = id;
      const prior = read(prefix + cid + ':send', null);
      let value = draftRef.current;
      if (!prior && value.dirty) value = await save();
      if (!prior && (!value || value.dirty)) return;
      const pending = prior ?? { key: uuid(), body: { draftVersion: value.version, modelId: model }, text: value.text, references: value.references };
      persist(cid + ':send', pending); setSendPending(true);
      const { body } = await workbenchPost(`${base}/${cid}/turns`, pending.body, pending.key);
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
  async function addReference(kind, objectId, sectionId) {
    if (!id) { setError(t("请先新建对话")); return; }
    try {
      const { body } = await workbenchGet(`/api/modules/${kind === 'question' ? 'questions/v2/items' : 'lessons/v3'}/${objectId}`);
      const input = { kind, id: objectId, version: body.version, ...(sectionId ? { sectionId } : {}) };
      const refs = draftRef.current?.references ?? [];
      edit({ references: [...refs.filter(r => !(r.kind === kind && r.id === objectId && r.sectionId === sectionId)), input] });
    } catch { setError(t("当前内容不可用")); }
  }
  return <Context.Provider value={{ accountKey, list, id, sendPending, businessRevision, select: setId, snapshot, draft,
    status: ({ '仅保留在此设备': t('仅保留在此设备'), '草稿已保存': t('草稿已保存'), '保存中': t('保存中') })[status] ?? status,
    error: error === '连接中断，正在恢复已保存内容' ? t('连接中断，正在恢复已保存内容') : error,
    conflict, busy, model, setModel, configuration,
    edit, save, create, send, stop, reconcile, chooseDraft, addReference, retry: refreshList, prefix }}>{children}</Context.Provider>;
}
