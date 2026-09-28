import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
import { CalendarDialog, CalendarIcon, CalendarMenu, IconButton, MiniCalendar, MonthTitle, ViewMenu } from './CalendarControls.jsx';
import { DeletedDialog } from './CalendarDetails.jsx';
import { MoveItemDialog, PriorityDialog, TimeZoneDialog } from './CalendarItems.jsx';
import CalendarEditor from './CalendarEditor.jsx';
import TimeGrid from './TimeGrid.jsx';
import { addDays, contentOf, contentProblem, diffDays, monday, newContent, shiftMonth, timeFromEvent, titleOf, todayInZone } from './calendarModel.js';
import { localParts } from './zoned.js';
import * as api from './api.js';
import './schedule.css';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const overrideContent = ({ repeat, ...content }) => content;
function shiftRepeat(content, delta) {
  if (delta && content.repeat?.frequency === 'weekly') {
    content.repeat.weekdays = content.repeat.weekdays.map(day => ((day + delta) % 7 + 7) % 7);
  }
}
async function runWrite({ key, payload }) {
  if (payload.kind === 'create') return api.createEntry({ key, payload: payload.content });
  if (payload.kind === 'update') return api.updateEntry({ key, id: payload.id, payload: { ...payload.content, expectedVersion: payload.version } });
  if (payload.kind === 'override') return api.setException({ key, id: payload.id, originDate: payload.origin,
    payload: { expectedVersion: payload.version, mode: 'override', content: overrideContent(payload.content) } });
  if (payload.kind === 'cancel') return api.setException({ key, id: payload.id, originDate: payload.origin, payload: { expectedVersion: payload.version, mode: 'cancelled' } });
  if (payload.kind === 'inherit') return api.setException({ key, id: payload.id, originDate: payload.origin, payload: { expectedVersion: payload.version, mode: 'inherit' } });
  if (payload.kind === 'settings') return api.updateSettings({ key, payload: payload.content });
  if (payload.kind === 'moveItem') return api.moveItem({ key, payload: payload.content });
  return api.setEntryDeletion({ key, id: payload.id, payload: { expectedVersion: payload.version, deleted: payload.kind !== 'restore' } });
}

function Upcoming({ entries, occurrences, labels, today, grouped, onGroup, onNew, onOpen, onManage, zone }) {
  const items = entries.map(entry => {
    const next = occurrences.find(x => x.key.entryId === entry.id && x.time.date >= today);
    return { entry, occurrence: next, date: next?.time.date ?? entry.time?.date ?? '' };
  }).filter(x => !x.entry.time || (x.entry.repeat ? Boolean(x.occurrence) : x.date >= today))
    .sort((a, b) => a.date.localeCompare(b.date) || b.entry.updatedAt.localeCompare(a.entry.updatedAt));
  const row = ({ entry, occurrence, date }) => {
    const tags = labels.filter(label => (occurrence ?? entry).calendar?.tags.includes(label.id));
    return <button type="button" className="cal-upcoming-row" key={entry.id} onClick={() => onOpen(entry.id, occurrence?.key.originDate ?? (entry.repeat ? entry.time.date : null))}>
      <i style={{ background: tags[0]?.color ?? '#9ba0aa' }}/><span className="cal-upcoming-title">{titleOf(occurrence ?? entry)}</span>
      {!grouped && tags[0] && <span className="cal-tag" style={{ '--tag-color': tags[0].color }}>{tags[0].name}</span>}
      <time>{date ? `${Number(date.slice(5, 7))}月 ${Number(date.slice(8))}` : '未排期'}</time>
    </button>;
  };
  const groups = [...labels, { id: '', name: '无标签', color: '#9ba0aa' }].map(label => ({ label,
    rows: items.filter(x => label.id ? (x.occurrence ?? x.entry).calendar?.tags.includes(label.id) : !labels.some(l => (x.occurrence ?? x.entry).calendar?.tags.includes(l.id))) })).filter(x => x.rows.length);
  return <section className="cal-upcoming" aria-label="即将到来"><header><h2><CalendarIcon name="clock" size={18}/>即将到来<span>({items.length})</span></h2><div><CalendarMenu label="日程管理" className="cal-management-menu" trigger={<CalendarIcon name="more"/>}>{close => <><button role="menuitem" onClick={() => { onNew(true); close(); }}>新建未排期任务</button><button role="menuitem" onClick={() => { onManage('priority'); close(); }}>优先事项</button><div className="cal-menu-divider"/><button role="menuitem" onClick={() => { onManage('deleted'); close(); }}>已删除任务</button><button role="menuitem" onClick={() => { onManage('zone'); close(); }}>显示时区</button></>}</CalendarMenu><IconButton name={grouped ? 'tag' : 'calendar'} label={grouped ? '按日期显示' : '按标签分组'} aria-pressed={grouped} onClick={onGroup}/><IconButton name="plus" label="新建任务" onClick={() => onNew(false)}/></div></header>
    <div className="cal-list-tools"><button onClick={() => onNew(true)}>+ 未排期</button><button onClick={() => onManage('priority')}>优先事项</button><button className="cal-zone-link" onClick={() => onManage('zone')} title={`显示时区：${zone}`}>{zone.split('/').at(-1).replaceAll('_', ' ')}</button></div>
    {items.length === 0 ? <div className="cal-empty"><CalendarIcon name="calendar" size={28}/><p>暂无安排</p></div> : grouped ? groups.map(({ label, rows }) => <div className="cal-upcoming-group" key={label.id}><h3><span className="cal-group-tag-icon" style={{ color: label.color }}><CalendarIcon name="tag" size={20}/></span><span className="cal-group-name" title={label.name}>{label.name}</span><span className="cal-group-count">{rows.length}</span></h3>{rows.map(row)}</div>) : <div className="cal-upcoming-list">{items.map(row)}</div>}
  </section>;
}

export default function SchedulePage({ route }) {
  const shell = useWorkbenchShell();
  const initialToday = todayInZone('Asia/Shanghai');
  const [scene, patchScene] = useScene(shell.accountKey, 'schedule-calendar', {
    anchor: initialToday, view: { kind: 'days', days: 7 }, month: initialToday.slice(0, 7), scroll: 0, grouped: false, draft: null
  });
  const sceneRef = useRef(scene); sceneRef.current = scene;
  const mounted = useRef(true);
  const [zone, setZone] = useState('Asia/Shanghai');
  const [settings, setSettings] = useState(null);
  const [range, setRange] = useState({ from: scene.anchor, to: addDays(scene.anchor, 6) });
  const [data, setData] = useState({ entries: [], occurrences: [], upcoming: [], labels: [] });
  const [displayMonth, setDisplayMonth] = useState(scene.anchor.slice(0, 7));
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const [scopePrompt, setScopePrompt] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [movePrompt, setMovePrompt] = useState(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [management, setManagement] = useState(null);
  const [itemToMove, setItemToMove] = useState(null);
  const flight = useRef(null);
  const op = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:schedule-calendar' });
  const opRef = useRef(op); opRef.current = op;
  const today = todayInZone(zone);
  useEffect(() => setDisplayMonth(scene.view.kind === 'month' && scene.monthScroll?.anchor === scene.anchor ? scene.month : scene.anchor.slice(0, 7)), [scene.anchor]);
  const draft = scene.draft;
  const dirty = draft && !same(draft.content, draft.baseline);
  const reload = useCallback(() => setRevision(x => x + 1), []);
  const updateScene = value => {
    const next = typeof value === 'function' ? value(sceneRef.current) : value;
    sceneRef.current = { ...sceneRef.current, ...next }; patchScene(next);
  };
  const setDraft = value => updateScene({ draft: value });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (shell.isPanelOpen && shell.panelMode === 'schedule') shell.closePanel(); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    Promise.all([api.getSettings(), api.listEntries(), api.listOccurrences(range), api.listLabels(), api.listOccurrences({ from: today, to: addDays(today, 366) })]).then(([settings, entries, result, labels, upcoming]) => {
      if (cancelled) return;
      setSettings(settings); setZone(settings.timeZone); setData({ entries, occurrences: result.items, labels, upcoming: upcoming.items }); setLoadState('ready'); setLoadError('');
    }).catch(error => { if (!cancelled) { setLoadState('error'); setLoadError(error.problem?.message ?? '日程未能更新'); } });
    return () => { cancelled = true; };
  }, [range.from, range.to, revision, shell.generation, today]);
  useForegroundRefresh(reload);

  async function applySaved(result, payload) {
    if (!mounted.current || !result) return false;
    const current = sceneRef.current.draft;
    if (payload.kind === 'settings') {
      setSettings(result); setZone(result.timeZone); shell.setTimeZone(result.timeZone); setManagement(null);
    } else if (payload.kind === 'moveItem') {
      setItemToMove(null);
      await openEntry(result.to.id, null, true);
    } else if (['delete', 'cancel'].includes(payload.kind)) {
      if (current?.id === payload.id) setDraft(null);
    } else if (['restore', 'inherit'].includes(payload.kind)) {
      await openEntry(payload.id, payload.origin, true);
    } else if (current && payload.clientId && current.clientId === payload.clientId) {
      const entry = result.id ? result : { ...current.entry, version: result.entryVersion };
      const origin = payload.kind === 'override' ? current.origin : entry.repeat ? current.origin ?? entry.time.date : null;
      setDraft({ ...current, id: result.id ?? current.id, version: result.version ?? result.entryVersion,
        origin, entry, courseState: result.courseState ?? current.courseState, baseline: payload.draftContent ?? payload.content, scope: null, forceSeries: false, savePaused: false });
    }
    setValidation(''); reload(); return true;
  }
  async function perform(payload, retry = false) {
    if (flight.current) return flight.current;
    if (opRef.current.pending && !retry) return false;
    const original = retry ? opRef.current.pending?.payload : payload;
    if (!original) return false;
    const pending = (async () => {
      const result = retry ? await opRef.current.retry(runWrite) : await opRef.current.submit(runWrite, original);
      return applySaved(result, original);
    })();
    flight.current = pending;
    try { return await pending; } finally { if (flight.current === pending) flight.current = null; }
  }
  async function flush({ explicit = false, scope } = {}) {
    if (flight.current) { await flight.current; }
    const current = sceneRef.current.draft;
    if (!current || same(current.content, current.baseline)) return !opRef.current.pending;
    if (opRef.current.pending) return false;
    const issue = contentProblem(current.content);
    if (issue) { if (explicit) setValidation(issue); return false; }
    const choice = scope ?? current.scope;
    if (current.entry?.repeat && current.origin && !choice && !current.forceSeries) { setScopePrompt(true); return false; }
    let content = structuredClone(current.content);
    const single = current.entry?.repeat && current.origin && choice !== 'series' && !current.forceSeries;
    if (!single && current.entry?.repeat && current.origin && content.time) {
      const delta = diffDays(current.origin, content.time.date);
      content.time.date = addDays(current.entry.time.date, delta);
      if (!current.forceSeries) shiftRepeat(content, delta);
    }
    if (content.repeat && !single) content.course.recordIds = [];
    return perform({ kind: !current.id ? 'create' : single ? 'override' : 'update', id: current.id, origin: current.origin,
      version: current.version, clientId: current.clientId, content, draftContent: current.content });
  }
  const actionsRef = useRef(null);
  actionsRef.current = { flush, closeEditor, changeView };
  useEffect(() => {
    if (!dirty || draft.savePaused || contentProblem(draft.content) || ['running', 'unconfirmed', 'failed'].includes(op.status) || scopePrompt || deletePrompt) return;
    const timer = setTimeout(() => actionsRef.current.flush(), 600);
    return () => clearTimeout(timer);
  }, [draft?.content, draft?.baseline, draft?.savePaused, op.status, scopePrompt, deletePrompt]);

  async function leaveEditor() {
    const current = sceneRef.current.draft;
    if (!current) return !opRef.current.pending;
    if (!current.id && !current.content.title.trim() && !current.content.items.length && !current.content.calendar.notes.trim() && !current.content.calendar.tags.length) return !opRef.current.pending && !flight.current;
    return flush({ explicit: true });
  }
  async function closeEditor() {
    if (!await leaveEditor()) return;
    setDraft(null); setValidation(''); setMobileSidebar(false);
  }
  function patchContent(patch, forceSeries = false, scope = null) {
    const current = sceneRef.current.draft;
    if (!current) return;
    setValidation('');
    if (opRef.current.status === 'failed') opRef.current.reset();
    setDraft({ ...current, content: { ...current.content, ...patch }, forceSeries: forceSeries || current.forceSeries, scope: scope ?? current.scope });
  }
  async function openEntry(id, origin = null, bypass = false) {
    if (!bypass && !await leaveEditor()) return;
    try {
      const entry = await api.getEntry(id);
      const occurrence = origin ? await api.getOccurrence(id, origin) : null;
      if (!mounted.current) return;
      const content = contentOf(occurrence ? { ...entry, ...occurrence, repeat: entry.repeat } : entry);
      const readOnly = entry.deletedAt ? '任务已删除' : occurrence && occurrence.state !== 'active' ? occurrence.state === 'cancelled' ? '这次任务已取消' : '这次任务已不在重复范围内' : null;
      setDraft({ clientId: crypto.randomUUID(), id, origin, version: entry.version, entry, content, courseState: occurrence?.courseState ?? entry.courseState, baseline: structuredClone(content), zone, scope: null, readOnly, occurrenceState: occurrence?.state, isException: occurrence?.isException });
      if (!bypass && shell.isPanelOpen) shell.closePanel();
      setValidation(''); setMobileSidebar(true);
      return true;
    } catch (error) { setLoadError(error.problem?.message ?? '无法打开任务'); }
  }
  async function create(start, end, allDay = false, unscheduled = false) {
    if (!await leaveEditor()) return;
    const content = newContent(zone, start, end, allDay);
    if (unscheduled) content.time = null;
    setDraft({ clientId: crypto.randomUUID(), id: null, origin: null, version: null, entry: null, content, baseline: null, zone });
    if (shell.isPanelOpen) shell.closePanel();
    setValidation(''); setMobileSidebar(true);
  }
  async function remove(scope = 'series') {
    const current = sceneRef.current.draft;
    if (!current?.id) { setDraft(null); setDeletePrompt(false); return; }
    if (flight.current) await flight.current;
    const entry = await api.getEntry(current.id).catch(() => null);
    if (!entry) { setValidation('读取失败，请重试'); return; }
    const ok = await perform({ kind: scope === 'instance' && current.origin ? 'cancel' : 'delete', id: current.id, origin: current.origin, version: entry.version });
    if (ok) setDeletePrompt(false);
  }
  async function restore() {
    const current = sceneRef.current.draft;
    if (!current?.id) return;
    if (opRef.current.pending) return perform(null, true);
    return perform({ kind: current.entry.deletedAt ? 'restore' : 'inherit', id: current.id, origin: current.origin, version: current.version });
  }
  async function startItemMove(itemId) {
    if (!await flush({ explicit: true })) return;
    const item = sceneRef.current.draft?.content.items.find(x => x.id === itemId);
    if (item) setItemToMove(item);
  }
  async function moveItem(itemId, target) {
    if (opRef.current.pending) return perform(null, true);
    const current = sceneRef.current.draft;
    if (!current?.id) return;
    return perform({ kind: 'moveItem', id: current.id, content: { itemId, fromEntryId: current.id, fromVersion: current.version,
      toEntryId: target?.id ?? null, toVersion: target?.version ?? null, toIndex: target?.items.length ?? 0 } });
  }
  async function priority(row, value) {
    setManagement(null);
    if (!await openEntry(row.entryId, row.originDate)) return;
    const content = sceneRef.current.draft.content;
    patchContent({ items: content.items.map(item => item.id === row.itemId ? { ...item, priority: value } : item) });
  }
  async function saveZone(timeZone) {
    if (opRef.current.pending) return perform(null, true);
    if (!settings) return;
    return perform({ kind: 'settings', content: { expectedVersion: settings.version, timeZone } });
  }
  async function moveEvent(info, scope) {
    if (!await leaveEditor()) { info.revert(); return; }
    const occurrence = info.event.extendedProps.occurrence;
    if (occurrence.key.originDate && !scope) { setMovePrompt(info); return; }
    try {
      const entry = await api.getEntry(occurrence.key.entryId);
      const content = contentOf({ ...entry, ...occurrence, repeat: entry.repeat });
      content.time = timeFromEvent(info.event, zone);
      content.calendar.allDay = info.event.allDay;
      const single = occurrence.key.originDate && scope !== 'series';
      if (!single && entry.repeat) {
        const delta = diffDays(occurrence.time.date, content.time.date);
        content.time.date = addDays(entry.time.date, delta);
        shiftRepeat(content, delta);
      }
      const issue = contentProblem(content);
      if (issue) { setLoadError(issue); info.revert(); return; }
      const ok = await perform({ kind: single ? 'override' : 'update', id: entry.id, origin: occurrence.key.originDate, version: entry.version, content });
      if (!ok) info.revert();
      else if (sceneRef.current.draft?.id === entry.id) await openEntry(entry.id, single ? occurrence.key.originDate : entry.repeat ? content.time.date : null, true);
    } catch (error) { info.revert(); setLoadError(error.problem?.message ?? '调整时间未能保存'); }
    setMovePrompt(null);
  }
  function changeView(view) {
    updateScene({ view, anchor: view.kind === 'week' ? monday(sceneRef.current.anchor) : sceneRef.current.anchor });
  }
  function navigate(delta) {
    const current = sceneRef.current;
    const anchor = current.view.kind === 'month' ? `${shiftMonth(displayMonth, delta)}-01`
      : addDays(current.anchor, delta * (current.view.kind === 'day' ? 1 : current.view.kind === 'week' ? 7 : current.view.days));
    if (anchor < '1900-01-01' || anchor > '2100-12-31') return;
    updateScene({ anchor, month: anchor.slice(0, 7) });
  }
  useEffect(() => {
    const keydown = event => {
      const typing = event.target.closest('input,textarea,select,[contenteditable="true"]');
      if (document.querySelector('[role="dialog"], [role="menu"]:not([inert] *)')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && sceneRef.current.draft) { event.preventDefault(); actionsRef.current.flush({ explicit: true }); return; }
      if (event.key === 'Escape') { actionsRef.current.closeEditor(); return; }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      const kind = { d: 'day', w: 'week', m: 'month' }[event.key.toLowerCase()];
      if (kind) actionsRef.current.changeView({ kind, days: kind === 'day' ? 1 : 7 });
      else if (/^[2-9]$/.test(event.key)) actionsRef.current.changeView({ kind: 'days', days: Number(event.key) });
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(route?.search ?? '');
    const id = query.get('entry');
    if (!id) return;
    let cancelled = false;
    api.getEntry(id).then(async entry => {
      if (cancelled) return;
      const origin = query.get('on') ?? (entry.repeat ? entry.time.date : null);
      const occurrence = entry.time ? await api.getOccurrence(id, origin) : null;
      if (cancelled) return;
      if (occurrence) {
        const value = localParts(zone, Date.parse(occurrence.startsAt));
        updateScene({ anchor: value.date, month: value.date.slice(0, 7), scroll: Math.max(0, (value.minutes / 60 - 1) * 104) });
      }
      await openEntry(id, origin, true);
    }).catch(error => { if (!cancelled) setLoadError(error.problem?.message ?? '无法打开这项安排'); });
    return () => { cancelled = true; };
  }, [route?.search, shell.generation]);

  const highlightFrom = scene.view.kind === 'month' ? '' : scene.view.kind === 'week' ? monday(scene.anchor) : scene.anchor;
  const highlightTo = highlightFrom ? addDays(highlightFrom, (scene.view.kind === 'day' ? 1 : scene.view.kind === 'week' ? 7 : scene.view.days) - 1) : '';
  const saveError = validation || op.problem?.message || (draft?.savePaused ? '本地输入已保留，请确认后重新保存' : '');
  const labelsChanged = label => { setData(current => ({ ...current, labels: label.deleted ? current.labels.filter(x => x.id !== label.id) : [...current.labels.filter(x => x.id !== label.id), label] })); reload(); };
  return <div className={`cal-page${mobileSidebar ? ' sidebar-open' : ''}${shell.isPanelOpen && shell.panelMode === 'ai' ? ' has-ai' : ''}`} data-region="schedule">
    {(loadError || (op.problem && !draft)) && <div className="cal-load-error" role="alert">{loadError || op.problem.message}<button onClick={() => op.pending ? perform(null, true) : reload()}>重试</button></div>}
    <section className="cal-board" aria-label="日历"><header className="cal-toolbar"><MonthTitle date={scene.view.kind === 'month' ? `${displayMonth}-01` : scene.anchor}/><div className="cal-toolbar-actions"><ViewMenu view={scene.view} onChange={changeView}/><button className="cal-today-button" onClick={() => { setDisplayMonth(today.slice(0, 7)); updateScene({ anchor: scene.view.kind === 'week' ? monday(today) : today, month: today.slice(0, 7), monthScroll: null, monthJump: (scene.monthJump || 0) + 1 }); }}>今天</button><IconButton name="left" label="上一段" onClick={() => navigate(-1)}/><IconButton name="right" label="下一段" onClick={() => navigate(1)}/><span className="cal-mobile-toggle"><IconButton name="grid" label="打开月份与任务" onClick={() => setMobileSidebar(true)}/></span></div></header>
      <TimeGrid key={scene.view.kind === 'month' ? `${scene.anchor}:${scene.monthJump}` : 'time'} view={scene.view} anchor={scene.anchor} zone={zone} occurrences={data.occurrences} labels={data.labels} selected={draft}
        onRange={(from, to) => setRange(current => current.from === from && current.to === to ? current : { from, to })}
        onSelect={create} onOpen={occurrence => openEntry(occurrence.key.entryId, occurrence.key.originDate)} onMove={moveEvent}
        onDay={date => updateScene({ anchor: date, view: { kind: 'day', days: 1 }, month: date.slice(0, 7) })}
        onMonthScroll={(month, monthScroll) => { setDisplayMonth(month); updateScene({ month, monthScroll }); }}
        scroll={scene.scroll} monthScroll={scene.monthScroll} onScroll={scroll => updateScene({ scroll })} disabled={op.isRunning || Boolean(op.pending)}/>
      {loadState === 'loading' && <span className="cal-loading" role="status">正在加载…</span>}
    </section>
    <aside className="cal-sidebar" aria-label="月份与任务"><div className="cal-mobile-close"><IconButton name="close" label="关闭月份与任务" onClick={() => setMobileSidebar(false)}/></div>
      <MiniCalendar month={scene.month} from={highlightFrom} to={highlightTo} today={today} onMonth={month => updateScene({ month })} onSelect={(from, to, dragged) => {
        const view = dragged ? { kind: 'days', days: diffDays(from, to) + 1 } : scene.view;
        setDisplayMonth(from.slice(0, 7)); updateScene({ anchor: view.kind === 'week' ? monday(from) : from, view, month: from.slice(0, 7), monthScroll: null, monthJump: (scene.monthJump || 0) + 1 });
      }}/>
      {draft ? <CalendarEditor key={draft.clientId} draft={draft} onPatch={patchContent} onClose={closeEditor} onDelete={() => draft.id ? setDeletePrompt(true) : closeEditor()} onRestore={restore} onMoveItem={startItemMove} locked={op.pending?.payload.kind === 'moveItem'}
        labels={data.labels} onLabels={labelsChanged} accountKey={shell.accountKey} status={op.status} error={saveError}
        onRetry={() => op.pending ? perform(null, true) : flush({ explicit: true })}
        onReload={op.problem?.kind === 'conflict' ? async () => { try { const entry = await api.getEntry(draft.id); setDraft({ ...sceneRef.current.draft, entry, version: entry.version, savePaused: true }); op.reset(); setValidation('已读取最新版本；本地输入保留，请重新保存'); } catch { setValidation('读取失败，请重试'); } } : null}/>
        : <Upcoming entries={data.entries} occurrences={data.upcoming} labels={data.labels} today={today} zone={zone} grouped={scene.grouped} onGroup={() => updateScene({ grouped: !scene.grouped })} onNew={unscheduled => create(undefined, undefined, false, unscheduled)} onOpen={openEntry} onManage={setManagement}/>}
    </aside>
    {management === 'deleted' && <DeletedDialog entries={data.entries} revision={revision} onClose={() => setManagement(null)} onOpen={(id, origin) => { setManagement(null); openEntry(id, origin); }}/>}
    {management === 'priority' && <PriorityDialog occurrences={data.occurrences} entries={data.entries} zone={zone} onClose={() => setManagement(null)} onPriority={priority} onOpen={(id, origin) => { setManagement(null); openEntry(id, origin); }}/>}
    {management === 'zone' && <TimeZoneDialog zone={zone} onClose={() => setManagement(null)} onSave={saveZone} busy={op.isRunning} pending={Boolean(op.pending)} error={op.problem?.message}/>}
    {itemToMove && <MoveItemDialog item={itemToMove} sourceId={draft?.id} entries={data.entries} onMove={moveItem} onClose={() => setItemToMove(null)} busy={op.isRunning} pending={Boolean(op.pending)} error={op.problem?.message}/>}
    {scopePrompt && <CalendarDialog title="编辑重复任务" onClose={() => { setScopePrompt(false); if (draft) setDraft({ ...draft, content: structuredClone(draft.baseline) }); }}><p>将修改应用到哪些任务？</p><footer><button onClick={() => { setScopePrompt(false); flush({ scope: 'instance' }); }}>仅此任务</button><button className="is-primary" onClick={() => { setScopePrompt(false); flush({ scope: 'series' }); }}>所有重复任务</button></footer></CalendarDialog>}
    {deletePrompt && <CalendarDialog title="删除任务" onClose={() => setDeletePrompt(false)}><p>删除“{titleOf(draft.content)}”？</p><footer><button onClick={() => setDeletePrompt(false)}>取消</button>{draft.origin && <button className="is-danger" disabled={op.isRunning} onClick={() => remove('instance')}>仅此任务</button>}<button className="is-danger" disabled={op.isRunning || Boolean(op.pending)} onClick={() => remove('series')}>{draft.origin ? '所有重复任务' : '删除'}</button></footer></CalendarDialog>}
    {movePrompt && <CalendarDialog title="调整重复任务" onClose={() => { movePrompt.revert(); setMovePrompt(null); }}><p>将时间调整应用到哪些任务？</p><footer><button onClick={() => moveEvent(movePrompt, 'instance')}>仅此任务</button><button className="is-primary" onClick={() => moveEvent(movePrompt, 'series')}>所有重复任务</button></footer></CalendarDialog>}
  </div>;
}
