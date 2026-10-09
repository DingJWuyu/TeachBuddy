import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
import { CalendarDialog, CalendarIcon, CalendarOverlay, IconButton, MiniCalendar, MonthTitle, ViewMenu } from './CalendarControls.jsx';
import { MoveItemDialog } from './CalendarItems.jsx';
import { reminderLabel } from './CalendarDetails.jsx';
import CalendarEditor from './CalendarEditor.jsx';
import TimeGrid from './TimeGrid.jsx';
import { addDays, contentOf, contentProblem, timeProblem, endTimeProblem, diffDays, formatClock, monday, newContent, repeatAnchor, shiftMonth, weekday, timeFromEvent, timeRangeLabel, titleOf, todayInZone } from './calendarModel.js';
import { localParts } from './zoned.js';
import * as api from './api.js';
import './schedule.css';

const withoutEmptyItems = content => content && ({ ...content, items: content.items.filter(item => item.text.trim()) });
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
  if (payload.kind === 'detach') return api.detachOccurrence({ key, id: payload.id, originDate: payload.origin, payload: { ...payload.content, repeat: null, expectedVersion: payload.version } });
  if (payload.kind === 'override') return api.setException({ key, id: payload.id, originDate: payload.origin,
    payload: { expectedVersion: payload.version, mode: 'override', content: overrideContent(payload.content) } });
  if (payload.kind === 'cancel') return api.setException({ key, id: payload.id, originDate: payload.origin, payload: { expectedVersion: payload.version, mode: 'cancelled' } });
  if (payload.kind === 'inherit') return api.setException({ key, id: payload.id, originDate: payload.origin, payload: { expectedVersion: payload.version, mode: 'inherit' } });
  if (payload.kind === 'settings') return api.updateSettings({ key, payload: payload.content });
  if (payload.kind === 'delete') return api.deleteEntry({ key, id: payload.id, payload: { expectedVersion: payload.version } });
  if (payload.kind === 'moveItem') return api.moveItem({ key, payload: payload.content });
  return api.setEntryDeletion({ key, id: payload.id, payload: { expectedVersion: payload.version, deleted: payload.kind !== 'restore' } });
}

function TaskSection({ title, icon, items, labels, grouped, onGroup, onNew, onOpen, zone, unscheduled = false }) {
  const { t } = useTranslation("schedule");
  const row = value => {
    const occurrence = value.key ? value : null;
    const id = occurrence?.key.entryId ?? value.id;
    const origin = occurrence?.key.originDate ?? null;
    const tags = labels.filter(label => value.calendar?.tags.includes(label.id));
    return <button type="button" className="cal-upcoming-row" key={`${id}:${origin ?? ''}`} onClick={() => onOpen(id, origin)}>
      <i style={{ background: tags[0]?.color ?? '#9ba0aa' }}/><span className="cal-upcoming-title">{titleOf(value)}</span>
      {!grouped && tags[0] && <span className="cal-tag" style={{ '--tag-color': tags[0].color }}>{tags[0].name}</span>}
      {occurrence && <time>{value.calendar?.allDay ? t("全天") : formatClock(localParts(zone, Date.parse(value.startsAt)).minutes)}</time>}
    </button>;
  };
  const groups = [...labels, { id: '', name: t("无标签"), color: '#9ba0aa' }].map(label => ({ label,
    rows: items.filter(x => label.id ? x.calendar?.tags.includes(label.id) : !labels.some(l => x.calendar?.tags.includes(l.id))) })).filter(x => x.rows.length);
  return <section className={`cal-task-section${unscheduled ? ' cal-unscheduled' : ''}`} aria-label={title}>
    <header><h2><CalendarIcon name={icon} size={18}/>{title}<span>({items.length})</span></h2><div>
      <IconButton name={grouped ? 'tag' : unscheduled ? 'list' : 'calendar'} label={unscheduled ? grouped ? t("待安排：按列表显示") : t("待安排：按标签分组") : grouped ? t("按日期显示") : t("按标签分组")} aria-pressed={grouped} onClick={onGroup}/>
      <IconButton name="plus" label={unscheduled ? t("新建待安排任务") : t("新建任务")} onClick={onNew}/>
    </div></header>
    {!items.length ? <div className="cal-empty"><CalendarIcon name={unscheduled ? 'list' : 'calendar'} size={28}/><p>{unscheduled ? t("先记下要做的事，之后再安排时间。") : t("暂无安排")}</p></div> : grouped ? groups.map(({ label, rows }) => <div className="cal-upcoming-group" key={label.id}><h3><span className="cal-group-tag-icon" style={{ color: label.color }}><CalendarIcon name="tag" size={16}/></span><span className="cal-group-name" title={label.name}>{label.name}</span><span className="cal-group-count">{rows.length}</span></h3>{rows.map(row)}</div>) : <div className="cal-upcoming-list">{items.map(row)}</div>}
  </section>;
}

function DailyTasks({ entries, occurrences, labels, grouped, unscheduledGrouped, onGroup, onUnscheduledGroup, onNew, onOpen, zone, now }) {
  const { t } = useTranslation("schedule");
  const items = occurrences.filter(value => Date.parse(value.endsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)
    || a.key.entryId.localeCompare(b.key.entryId) || (a.key.originDate ?? '').localeCompare(b.key.originDate ?? ''));
  const unscheduled = entries.filter(entry => !entry.time).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return <div className="cal-upcoming">
    <TaskSection title={t("即将到来")} icon="clock" items={items} labels={labels} grouped={grouped} onGroup={onGroup} onNew={() => onNew(false)} onOpen={onOpen} zone={zone}/>
    <TaskSection title={t("待安排")} icon="inbox" items={unscheduled} labels={labels} grouped={unscheduledGrouped} onGroup={onUnscheduledGroup} onNew={() => onNew(true)} onOpen={onOpen} zone={zone} unscheduled/>
  </div>;
}

const systemTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const inZone = (content, timeZone) => content && ({ ...content, time: content.time ? { ...content.time, timeZone } : null });

export default function SchedulePage({ route }) {
  const { t, i18n } = useTranslation("schedule");
  const shell = useWorkbenchShell();
  const [systemZone, setSystemZone] = useState(systemTimeZone);
  const initialToday = todayInZone(systemZone);
  const [scene, patchScene] = useScene(shell.accountKey, 'schedule-calendar', {
    anchor: initialToday, view: { kind: 'days', days: 7 }, month: initialToday.slice(0, 7), scroll: 0, grouped: false, unscheduledGrouped: false, draft: null
  });
  const sceneRef = useRef(scene); sceneRef.current = scene;
  const mounted = useRef(true);
  const editorIntent = useRef(0);
  const [zone, setZone] = useState(systemTimeZone);
  const zoneRef = useRef(zone);
  const zoneFlight = useRef(null);
  const zoneOp = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:schedule-system-time-zone' });
  const zoneOpRef = useRef(zoneOp); zoneOpRef.current = zoneOp;
  const [range, setRange] = useState({ from: scene.anchor, to: addDays(scene.anchor, 6) > '2100-12-31' ? '2100-12-31' : addDays(scene.anchor, 6) });
  const [data, setData] = useState({ entries: [], occurrences: [], daily: [], labels: [] });
  const [displayMonth, setDisplayMonth] = useState(scene.anchor.slice(0, 7));
  const [loadError, setLoadError] = useState('');
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const [deletePrompt, setDeletePrompt] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [itemToMove, setItemToMove] = useState(null);
  const flight = useRef(null);
  const lastWrite = useRef(null);
  const op = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:schedule-calendar' });
  const opRef = useRef(op); opRef.current = op;
  const [now, setNow] = useState(Date.now);
  const today = localParts(zone, now).date;
  useEffect(() => setDisplayMonth(scene.view.kind === 'month' && scene.monthScroll?.anchor === scene.anchor ? scene.month : scene.anchor.slice(0, 7)), [scene.anchor]);
  const draft = scene.draft;
  const dirty = draft && !same(withoutEmptyItems(draft.content), withoutEmptyItems(draft.baseline));
  const reload = useCallback(() => { setSystemZone(systemTimeZone()); setNow(Date.now()); setRevision(x => x + 1); }, []);
  useEffect(() => {
    const timer = setInterval(() => { setSystemZone(systemTimeZone()); setNow(Date.now()); }, 15000);
    return () => clearInterval(timer);
  }, []);
  const updateScene = value => {
    const next = typeof value === 'function' ? value(sceneRef.current) : value;
    sceneRef.current = { ...sceneRef.current, ...next }; patchScene(next);
  };
  const setDraft = value => updateScene({ draft: value });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (shell.isPanelOpen && shell.panelMode === 'schedule') shell.closePanel(); }, []);

  async function synchronizeTimeZone(target) {
    let confirmedPrevious = false;
    while (zoneFlight.current) {
      await zoneFlight.current;
      confirmedPrevious = true;
      if (zoneRef.current === target) return;
    }
    if (target !== systemTimeZone()) return;
    const request = (async () => {
      if (flight.current) await flight.current;
      const operation = zoneOpRef.current;
      if (operation.pending && opRef.current.pending) throw new Error(t("时区已变化，请先重试确认未完成的保存"));
      if (!confirmedPrevious && operation.pending && !await operation.retry(api.updateSettings)) throw new Error(operation.problem?.message ?? t("时区同步未确认，请重试"));
      let [settings, storedEntries] = await Promise.all([api.getSettings(), api.listEntries()]);
      const changed = settings.timeZone !== target || storedEntries.some(entry => entry.time && entry.time.timeZone !== target);
      if (opRef.current.pending && (changed || sceneRef.current.draft?.zone !== target)) throw new Error(t("时区已变化，请先重试确认未完成的保存"));
      if (changed) {
        let result = await operation.submit(api.updateSettings, { timeZone: target, expectedVersion: settings.version });
        if (!result && zoneOpRef.current.problem?.kind === 'conflict') {
          settings = await api.getSettings();
          result = settings.timeZone === target ? settings : await zoneOpRef.current.submit(api.updateSettings, { timeZone: target, expectedVersion: settings.version });
        }
        if (!result) throw new Error(zoneOpRef.current.problem?.message ?? t("时区同步未确认，请重试"));
      }
      if (!mounted.current) return;
      const oldToday = todayInZone(zoneRef.current), newToday = todayInZone(target);
      zoneRef.current = target;
      if (sceneRef.current.anchor === oldToday && oldToday !== newToday) updateScene({ anchor: newToday, month: newToday.slice(0, 7), monthScroll: null });
      const current = sceneRef.current.draft;
      if (!opRef.current.pending && current && (changed || current.zone !== target || current.content.time?.timeZone && current.content.time.timeZone !== target)) {
        let entry = null, baseline = inZone(current.baseline, target);
        if (current.id) {
          entry = await api.getEntry(current.id);
          const occurrence = current.origin && entry.repeat ? await api.getOccurrence(current.id, current.origin) : null;
          const server = contentOf(occurrence ? { ...entry, ...occurrence, repeat: entry.repeat } : entry);
          // 只接受时区同步造成的版本变化；其他窗口的内容修改仍走原冲突流程。
          if (entry.deletedAt !== current.entry?.deletedAt || !same(withoutEmptyItems(baseline), withoutEmptyItems(server))) entry = null;
        }
        const latest = sceneRef.current.draft;
        if (mounted.current && latest?.clientId === current.clientId) setDraft({ ...latest, zone: target, content: inZone(latest.content, target), baseline,
          ...(entry ? { entry, version: entry.version } : {}) });
      }
    })();
    zoneFlight.current = request;
    try { await request; } finally { if (zoneFlight.current === request) zoneFlight.current = null; }
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await synchronizeTimeZone(systemZone);
      if (cancelled) return;
      const date = todayInZone(systemZone);
      const [entries, result, labels, daily] = await Promise.all([api.listEntries(), api.listOccurrences(range), api.listLabels(), api.listOccurrences({ from: date, to: date })]);
      if (!cancelled && systemTimeZone() === systemZone) { setZone(systemZone); shell.setTimeZone(systemZone); setData({ entries, occurrences: result.items, labels, daily: daily.items }); setLoadError(''); }
    })().catch(error => { if (!cancelled) setLoadError(error.problem?.message ?? error.message ?? t("日程未能更新")); });
    return () => { cancelled = true; };
  }, [range.from, range.to, revision, shell.generation, today, systemZone]);
  useForegroundRefresh(reload);

  async function applySaved(result, payload) {
    if (!mounted.current || !result) return false;
    const current = sceneRef.current.draft;
    if (payload.kind === 'settings') {
      // 幂等重放可能返回旧版本；由 reload 读取当前设置后统一更新显示时区。

    } else if (payload.kind === 'moveItem') {
      setItemToMove(null);
      if (result.to.repeat && !result.toOriginDate) setDraft(null);
      // 时区同步会等待本次写入完成，这里不能反过来等待时区同步。
      else await openEntry(result.to.id, result.toOriginDate ?? null, { bypass: true, waitForZone: false });
      if (route?.search) shell.navigate(result.to.repeat && !result.toOriginDate ? '/calendar' : `/calendar?entry=${result.to.id}${result.toOriginDate ? `&on=${result.toOriginDate}` : ''}`);
    } else if (['delete', 'cancel'].includes(payload.kind)) {
      if (current?.id === payload.id) setDraft(null);
      setDeletePrompt(false);
      if (new URLSearchParams(route?.search ?? '').get('entry') === payload.id) shell.navigate('/calendar');
    } else if (['restore', 'inherit'].includes(payload.kind)) {
      await openEntry(payload.id, payload.origin, { bypass: true, waitForZone: false });
    } else if (current && payload.clientId && current.clientId === payload.clientId) {
      const entry = result.id ? result : { ...current.entry, version: result.entryVersion };
      const origin = payload.kind === 'override' ? current.origin : entry.repeat ? payload.ruleChange ? payload.draftContent.time.date : current.origin ?? entry.time.date : null;
      let occurrence = null;
      if (payload.ruleChange && origin) {
        // 规则可能把编辑目标移到另一天，读取那一次的例外和教学关联。
        try { occurrence = await api.getOccurrence(entry.id, origin); } catch { /* 保存已确认，列表刷新仍可恢复该日期。 */ }
      }
      const latest = sceneRef.current.draft;
      if (latest?.clientId === payload.clientId) {
        const unchanged = same(latest.content, payload.draftContent ?? payload.content);
        const refreshed = occurrence?.state === 'active' ? contentOf({ ...entry, ...occurrence, repeat: entry.repeat }) : null;
        const content = payload.ruleChange && unchanged && refreshed ? refreshed : payload.kind === 'detach' ? { ...latest.content, repeat: null } : latest.content;
        setDraft({ ...latest, id: result.id ?? latest.id, version: result.version ?? result.entryVersion,
          origin, entry, content, courseState: occurrence?.courseState ?? result.courseState ?? latest.courseState,
          baseline: payload.ruleChange && unchanged && refreshed ? refreshed : payload.kind === 'detach' ? { ...payload.draftContent, repeat: null } : payload.draftContent ?? payload.content,
          forceSeries: latest.ruleChangeId === payload.ruleChangeId ? false : latest.forceSeries, savePaused: false,
          readOnly: payload.ruleChange && occurrence && occurrence.state !== 'active' ? occurrence.state === 'cancelled' ? t("这次任务已取消") : t("这次任务已不在重复范围内") : latest.readOnly,
          occurrenceState: occurrence?.state ?? latest.occurrenceState,
          isException: payload.kind === 'override' ? true : payload.ruleChange ? Boolean(occurrence?.exception) : latest.isException });
        if (payload.kind === 'detach' && new URLSearchParams(route?.search ?? '').get('entry') === payload.id) shell.navigate(`/calendar?entry=${entry.id}`);
        const focusDate = payload.ruleChange ? origin ?? entry.time?.date : null;
        if (focusDate) {
          setDisplayMonth(focusDate.slice(0, 7));
          updateScene({ anchor: sceneRef.current.view.kind === 'week' ? monday(focusDate) : focusDate, month: focusDate.slice(0, 7), monthScroll: null, monthJump: (sceneRef.current.monthJump || 0) + 1 });
        }
      }
    }
    setValidation(''); reload(); return true;
  }
  async function perform(payload, retry = false) {
    if (flight.current) return flight.current;
    if (opRef.current.pending && !retry) return false;
    const original = retry ? opRef.current.pending?.payload : payload;
    if (!original) return false;
    lastWrite.current = original;
    const pending = (async () => {
      const result = retry ? await opRef.current.retry(runWrite) : await opRef.current.submit(runWrite, original);
      // Hook 的 React 更新尚未渲染时，下一次串行保存也必须看到已确认状态。
      if (result) opRef.current = { ...opRef.current, status: 'done', problem: null, pending: null, result, isRunning: false };
      return await applySaved(result, original) ? result : false;
    })();
    flight.current = pending;
    try { return await pending; } finally { if (flight.current === pending) flight.current = null; }
  }
  async function flush({ explicit = false, confirmConflict = false } = {}) {
    if (zoneFlight.current) { try { await zoneFlight.current; } catch { return false; } }
    if (flight.current) { await flight.current; }
    const current = sceneRef.current.draft;
    if (!current || same(withoutEmptyItems(current.content), withoutEmptyItems(current.baseline))) return !opRef.current.pending;
    if (!current.id && !current.content.title.trim()) return !opRef.current.pending;
    if (opRef.current.pending) return false;
    if (current.savePaused && !confirmConflict) {
      setValidation(t("请先核对服务器内容，再重新保存或采用服务器内容"));
      return false;
    }
    const issue = contentProblem(current.content);
    if (issue) { if (explicit && !endTimeProblem(current.content)) setValidation(issue); return false; }
    let content = structuredClone(withoutEmptyItems(current.content));
    const single = current.entry?.repeat && current.origin && !current.forceSeries;
    if (current.forceSeries && content.repeat && current.entry?.repeat && current.origin) {
      content = { ...contentOf(current.entry), repeat: content.repeat, time: { ...current.entry.time, date: content.time.date } };
    }
    if (!single && current.entry?.repeat && current.origin && content.time) {
      if (current.forceSeries && content.repeat) {
        // 修改整组规则保留最早起点，编辑器另外定位当前日期之后的新实例。
        const date = current.content.time.date;
        content.time.date = ['daily', 'weekly'].includes(content.repeat.frequency ?? 'weekly') ? current.entry.time.date : repeatAnchor(current.entry.time.date, content.repeat, {
          day: Number(date.slice(8)), month: Number(date.slice(5, 7)),
          ordinal: Math.ceil(Number(date.slice(8)) / 7), dayOfWeek: weekday(date)
        });
      } else {
        const delta = diffDays(current.origin, content.time.date);
        content.time.date = addDays(current.entry.time.date, delta);
        if (!current.forceSeries) shiftRepeat(content, delta);
      }
    }
    if (single) content.repeat = null;
    if (content.repeat && !single) content.course.recordIds = [];
    return perform({ kind: !current.id ? 'create' : single ? 'detach' : 'update', id: current.id, origin: current.origin,
      version: current.version, clientId: current.clientId, content, draftContent: current.content, ruleChangeId: current.ruleChangeId, ruleChange: Boolean(current.forceSeries && content.repeat) });
  }
  async function discardReminderChange() {
    const attempt = lastWrite.current;
    if (flight.current) await flight.current;
    const current = sceneRef.current.draft;
    if (attempt?.clientId && current?.clientId === attempt.clientId) {
      setDraft(current.baseline ? { ...current, content: structuredClone(current.baseline), forceSeries: false, savePaused: false } : null);
    }
    lastWrite.current = null;
    opRef.current.reset(); setValidation(''); setLoadError(''); reload();
  }
  async function saveWithoutReminder() {
    const attempt = lastWrite.current;
    if (!attempt) return;
    if (flight.current) await flight.current;
    const current = sceneRef.current.draft;
    opRef.current.reset(); setValidation(''); setLoadError('');
    if (attempt.clientId && current?.clientId === attempt.clientId) {
      setDraft({ ...current, content: { ...current.content, reminder: null } });
      await flush({ explicit: true });
    } else {
      const result = await perform({ ...attempt, content: { ...attempt.content, reminder: null } });
      if (result) await openEntry(result.id, result.repeat ? attempt.origin : null, { bypass: true });
    }
  }
  const actionsRef = useRef(null);
  actionsRef.current = { flush, closeEditor, changeView };
  useEffect(() => {
    if (!dirty || (!draft.id && !draft.content.title.trim()) || draft.savePaused || contentProblem(draft.content) || ['running', 'unconfirmed', 'failed'].includes(op.status) || deletePrompt) return;
    const timer = setTimeout(() => actionsRef.current.flush(), 600);
    return () => clearTimeout(timer);
  }, [draft?.content, draft?.baseline, draft?.savePaused, op.status, deletePrompt]);

  async function leaveEditor() {
    const clientId = sceneRef.current.draft?.clientId;
    while (sceneRef.current.draft?.clientId === clientId && clientId) {
      const current = sceneRef.current.draft;
      if (!current.id && !current.content.title.trim()) return !opRef.current.pending && !flight.current;
      if (!await flush({ explicit: true })) return false;
      const latest = sceneRef.current.draft;
      if (!latest || latest.clientId !== clientId || same(withoutEmptyItems(latest.content), withoutEmptyItems(latest.baseline))) return true;
    }
    return !opRef.current.pending;
  }
  async function closeEditor() {
    const intent = ++editorIntent.current;
    if (zoneFlight.current) { try { await zoneFlight.current; } catch { return; } }
    if (intent !== editorIntent.current) return;
    if (flight.current) await flight.current;
    if (intent !== editorIntent.current || opRef.current.pending) return;
    const current = sceneRef.current.draft;
    if (current?.id) {
      let content = current.content;
      if (!content.title.trim() && current.baseline.title.trim()) content = { ...content, title: current.baseline.title };
      if (timeProblem(content)) {
        content = { ...content, time: structuredClone(current.baseline.time), calendar: { ...content.calendar, allDay: current.baseline.calendar.allDay } };
        if (!content.time) content = { ...content, repeat: current.baseline.repeat, reminder: current.baseline.reminder };
      }
      if (contentProblem(content)) content = structuredClone(current.baseline);
      if (content !== current.content) setDraft({ ...current, content });
    } else if (current && timeProblem(current.content)) setDraft(null);
    if (!await leaveEditor() || intent !== editorIntent.current) return;
    setDraft(null); setValidation(''); setMobileSidebar(false);
    if (route?.search) shell.navigate('/calendar');
  }
  async function patchContent(patch, forceSeries = false) {
    const clientId = sceneRef.current.draft?.clientId;
    if (forceSeries && flight.current) await flight.current;
    // 改整组规则前先保存正在编辑的这一次，避免临时内容混入模板。
    if (forceSeries && sceneRef.current.draft?.entry?.repeat && sceneRef.current.draft.origin
      && !await flush()) return;
    const current = sceneRef.current.draft;
    if (!current || current.clientId !== clientId) return;
    setValidation('');
    if (opRef.current.status === 'failed') opRef.current.reset();
    const content = { ...current.content, ...patch };
    setDraft({ ...current, content, forceSeries: forceSeries || current.forceSeries,
      ruleChangeId: forceSeries ? crypto.randomUUID() : current.ruleChangeId });
  }
  async function openEntry(id, origin = null, { bypass = false, preserveDraft = false, waitForZone = true } = {}) {
    const intent = ++editorIntent.current;
    if (waitForZone && zoneFlight.current) { try { await zoneFlight.current; } catch { return; } }
    if (intent !== editorIntent.current) return;
    const previous = sceneRef.current.draft;
    const restoringCurrent = preserveDraft && previous?.id === id && previous.origin === origin;
    if (!bypass && !restoringCurrent && !await leaveEditor()) return;
    if (intent !== editorIntent.current) return;
    const requestedZone = zoneRef.current;
    try {
      const entry = await api.getEntry(id);
      if (!mounted.current || intent !== editorIntent.current || requestedZone !== zoneRef.current) return;
      const occurrence = origin ? await api.getOccurrence(id, origin) : null;
      if (!mounted.current || intent !== editorIntent.current || requestedZone !== zoneRef.current) return;
      const content = contentOf(occurrence ? { ...entry, ...occurrence, repeat: entry.repeat } : entry);
      const readOnly = entry.deletedAt ? t("任务已删除") : occurrence && occurrence.state !== 'active' ? occurrence.state === 'cancelled' ? t("这次任务已取消") : t("这次任务已不在重复范围内") : null;
      const current = sceneRef.current.draft;
      // 深链接恢复保留未提交输入；迟到的旧读取也不能覆盖已确认的新版本。
      const sameDraft = preserveDraft && current?.id === id && current.origin === origin;
      const keepDraft = sameDraft
        && (entry.version < current.version || current.savePaused || !same(withoutEmptyItems(current.content), withoutEmptyItems(current.baseline)) || opRef.current.pending);
      if (!keepDraft) setDraft({ clientId: sameDraft ? current.clientId : crypto.randomUUID(), id, origin, version: entry.version, entry, content, courseState: occurrence?.courseState ?? entry.courseState, baseline: structuredClone(content), zone: zoneRef.current, readOnly, occurrenceState: occurrence?.state, isException: occurrence?.exception });
      if (!bypass && shell.isPanelOpen) shell.closePanel();
      setValidation(''); setMobileSidebar(true);
      return true;
    } catch (error) { if (mounted.current && intent === editorIntent.current) setLoadError(error.problem?.message ?? t("无法打开任务")); }
  }
  async function create(start, end, allDay = false, unscheduled = false) {
    const intent = ++editorIntent.current;
    if (zoneFlight.current) { try { await zoneFlight.current; } catch { return; } }
    if (intent !== editorIntent.current) return;
    if (!await leaveEditor() || intent !== editorIntent.current) return;
    const content = newContent(zoneRef.current, start, end, allDay);
    if (unscheduled) content.time = null;
    setDraft({ clientId: crypto.randomUUID(), id: null, origin: null, version: null, entry: null, content, baseline: null, zone: zoneRef.current });
    if (shell.isPanelOpen) shell.closePanel();
    setValidation(''); setMobileSidebar(true);
  }
  async function remove(scope = 'series') {
    ++editorIntent.current;
    const current = sceneRef.current.draft;
    if (!current?.id) { setDraft(null); setDeletePrompt(false); return; }
    if (flight.current) await flight.current;
    const entry = await api.getEntry(current.id).catch(() => null);
    if (!entry) { setValidation(t("读取失败，请重试")); return; }
    const ok = await perform({ kind: scope === 'instance' && current.origin ? 'cancel' : 'delete', id: current.id, origin: current.origin, version: entry.version });
    if (ok) setDeletePrompt(false);
  }
  async function startItemMove(itemId) {
    if (!await flush({ explicit: true })) return;
    const item = sceneRef.current.draft?.content.items.find(x => x.id === itemId);
    if (!item) return;
    try {
      const entries = await api.listEntries();
      if (!mounted.current) return;
      setData(current => ({ ...current, entries })); setItemToMove(item);
    } catch (error) { setValidation(error.problem?.message ?? t("未能加载目标安排，请重试")); }
  }
  async function moveItem(itemId, target, repeatTarget = null) {
    if (opRef.current.pending) return perform(null, true);
    const current = sceneRef.current.draft;
    if (!current?.id) return;
    return perform({ kind: 'moveItem', id: current.id, content: { itemId, fromEntryId: current.id, fromVersion: current.version,
      toEntryId: target?.id ?? null, toVersion: target?.version ?? null, toIndex: target?.items.length ?? 0, ...repeatTarget } });
  }
  async function reloadConflict() {
    const current = sceneRef.current.draft;
    if (!current?.id) return;
    try {
      const entry = await api.getEntry(current.id);
      const occurrence = current.origin ? await api.getOccurrence(current.id, current.origin) : null;
      if (!mounted.current || sceneRef.current.draft?.clientId !== current.clientId) return;
      const baseline = contentOf(occurrence ? { ...entry, ...occurrence, repeat: entry.repeat } : entry);
      setDraft({ ...sceneRef.current.draft, entry, version: entry.version, baseline, serverCourseState: occurrence?.courseState ?? entry.courseState, savePaused: !same(sceneRef.current.draft.content, baseline) });
      setItemToMove(null); op.reset(); reload();
      setValidation(t("已读取最新版本；本地输入保留，请核对后继续"));
    } catch { setValidation(t("读取失败，请重试")); }
  }
  function adoptServer() {
    const current = sceneRef.current.draft;
    if (!current?.savePaused) return;
    setDraft({ ...current, content: structuredClone(current.baseline), courseState: current.serverCourseState, savePaused: false, forceSeries: false });
    setValidation('');
  }
  async function moveEvent(info) {
    ++editorIntent.current;
    if (zoneFlight.current) { try { await zoneFlight.current; } catch { info.revert(); return; } }
    const occurrence = info.event.extendedProps.occurrence;
    const movedTime = timeFromEvent(info.event, zoneRef.current);
    const allDay = info.event.allDay;
    const edited = sceneRef.current.draft;
    try {
      if (edited?.id === occurrence.key.entryId && edited.origin === (occurrence.key.originDate ?? null)) {
        // 同一任务的拖动也是当前编辑，不能先提交旧时段而丢掉最新拖动。
        if (flight.current) await flight.current;
        const current = sceneRef.current.draft;
        if (current?.clientId !== edited.clientId || opRef.current.pending) { info.revert(); return; }
        await patchContent({ time: movedTime, calendar: { ...current.content.calendar, allDay } });
        if (!await flush({ explicit: true })) info.revert();
        return;
      }
      if (!await leaveEditor()) { info.revert(); return; }
      const entry = await api.getEntry(occurrence.key.entryId);
      const content = contentOf({ ...entry, ...occurrence, repeat: entry.repeat });
      content.time = movedTime;
      content.calendar.allDay = allDay;
      const single = Boolean(occurrence.key.originDate);
      if (single) content.repeat = null;
      if (!single && entry.repeat) {
        const delta = diffDays(occurrence.time.date, content.time.date);
        content.time.date = addDays(entry.time.date, delta);
        shiftRepeat(content, delta);
      }
      const issue = contentProblem(content);
      if (issue) { setLoadError(issue); info.revert(); return; }
      const ok = await perform({ kind: single ? 'detach' : 'update', id: entry.id, origin: occurrence.key.originDate, version: entry.version, content });
      if (!ok) info.revert();
      else if (sceneRef.current.draft?.id === entry.id) await openEntry(ok.id, single ? null : entry.repeat ? content.time.date : null, { bypass: true });
    } catch (error) { info.revert(); setLoadError(error.problem?.message ?? t("调整时间未能保存")); }
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
      if ([...document.querySelectorAll('[role="dialog"], [role="menu"]')].some(node => !node.closest('[inert]'))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && sceneRef.current.draft) { event.preventDefault(); actionsRef.current.flush({ explicit: true, confirmConflict: true }); return; }
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
      await openEntry(id, origin, { preserveDraft: true });
    }).catch(error => { if (!cancelled) setLoadError(error.problem?.message ?? t("无法打开这项安排")); });
    return () => { cancelled = true; };
  }, [route?.search, shell.generation, zone]);

  const highlightFrom = scene.view.kind === 'month' ? '' : scene.view.kind === 'week' ? monday(scene.anchor) : scene.anchor;
  const highlightTo = highlightFrom ? addDays(highlightFrom, (scene.view.kind === 'day' ? 1 : scene.view.kind === 'week' ? 7 : scene.view.days) - 1) : '';
  const reminderRejected = op.problem?.type === '/problems/workbench/reminder-not-future';
  const reminderAttempt = reminderRejected ? lastWrite.current : null;
  // Describe the rejected request; current input may have changed while its response was in flight.
  const reminderContent = reminderAttempt?.draftContent ?? reminderAttempt?.content;
  const saveError = validation || (!reminderRejected ? op.problem?.message : '') || (draft?.savePaused ? t("本地输入已保留，请确认后重新保存") : '');
  const zoneOffset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(now).find(part => part.type === 'timeZoneName').value;
  const zoneLabel = `${zoneOffset === 'GMT' ? 'UTC+00:00' : zoneOffset.replace(/^GMT/, 'UTC')} · ${zone}`;
  const labelsChanged = label => { setData(current => ({ ...current, labels: label.deleted ? current.labels.filter(x => x.id !== label.id) : [...current.labels.filter(x => x.id !== label.id), label] })); reload(); };
  return <div className={`cal-page${mobileSidebar ? ' sidebar-open' : ''}${shell.isPanelOpen && shell.panelMode === 'ai' ? ' has-ai' : ''}`} data-region="schedule">
    {(loadError || (op.problem && !draft && !reminderRejected)) && <div className="cal-load-error" role="alert">{loadError || op.problem.message}<button onClick={() => op.pending ? perform(null, true) : reload()}>{t("重试")}</button></div>}
    <section className="cal-board" aria-label={t("日历")}><header className="cal-toolbar"><div className="cal-calendar-title"><MonthTitle date={scene.view.kind === 'month' ? `${displayMonth}-01` : scene.anchor}/><span className="cal-time-zone" title={zone}>{zoneLabel}</span></div><div className="cal-toolbar-actions"><ViewMenu view={scene.view} onChange={changeView}/><button className="cal-today-button" onClick={() => { setDisplayMonth(today.slice(0, 7)); updateScene({ anchor: scene.view.kind === 'week' ? monday(today) : today, month: today.slice(0, 7), monthScroll: null, monthJump: (scene.monthJump || 0) + 1 }); }}>{t("今天")}</button><IconButton name="left" label={t("上一段")} onClick={() => navigate(-1)}/><IconButton name="right" label={t("下一段")} onClick={() => navigate(1)}/><span className="cal-mobile-toggle"><IconButton name="grid" label={t("打开月份与任务")} onClick={() => setMobileSidebar(true)}/></span></div></header>
      <TimeGrid key={scene.view.kind === 'month' ? `${zone}:${scene.anchor}:${scene.monthJump}` : `time:${zone}`} view={scene.view} anchor={scene.anchor} zone={zone} occurrences={data.occurrences} labels={data.labels} selected={draft}
        onRange={(from, to) => {
          from = from < '1900-01-01' ? '1900-01-01' : from;
          to = to > '2100-12-31' ? '2100-12-31' : to;
          setRange(current => current.from === from && current.to === to ? current : { from, to });
        }}
        onSelect={create} onClear={closeEditor} onOpen={occurrence => openEntry(occurrence.key.entryId, occurrence.key.originDate)} onMove={moveEvent}
        onDay={date => updateScene({ anchor: date, view: { kind: 'day', days: 1 }, month: date.slice(0, 7) })}
        onMonthScroll={(month, monthScroll) => { setDisplayMonth(month); updateScene({ month, monthScroll }); }}
        scroll={scene.scroll} monthScroll={scene.monthScroll} onScroll={scroll => updateScene({ scroll })} disabled={op.isRunning || Boolean(op.pending)}/>
    </section>
    <aside className="cal-sidebar" aria-label={t("月份与任务")}><div className="cal-mobile-close"><IconButton name="close" label={t("关闭月份与任务")} onClick={() => setMobileSidebar(false)}/></div>
      <MiniCalendar month={scene.month} from={highlightFrom} to={highlightTo} today={today} onMonth={month => updateScene({ month })} onSelect={(from, to, dragged) => {
        const view = dragged ? { kind: 'days', days: diffDays(from, to) + 1 } : scene.view;
        setDisplayMonth(from.slice(0, 7)); updateScene({ anchor: view.kind === 'week' ? monday(from) : from, view, month: from.slice(0, 7), monthScroll: null, monthJump: (scene.monthJump || 0) + 1 });
      }}/>
      {draft ? <CalendarEditor key={draft.clientId} draft={draft} onPatch={patchContent} onClose={closeEditor} onConfirm={() => flush({ explicit: true })} onDelete={() => { ++editorIntent.current; return draft.id ? setDeletePrompt(true) : closeEditor(); }} onMoveItem={startItemMove} locked={op.pending?.payload.kind === 'moveItem'}
        labels={data.labels} onLabels={labelsChanged} accountKey={shell.accountKey} status={op.status} error={saveError}
        onRetry={() => op.pending ? perform(null, true) : flush({ explicit: true, confirmConflict: true })} onAdoptServer={adoptServer}
        onReload={op.problem?.kind === 'conflict' ? reloadConflict : null}/>
        : <DailyTasks entries={data.entries} occurrences={data.daily} labels={data.labels} zone={zone} now={now} grouped={scene.grouped} onGroup={() => updateScene({ grouped: !scene.grouped })} onNew={unscheduled => create(undefined, undefined, false, unscheduled)} onOpen={openEntry} unscheduledGrouped={Boolean(scene.unscheduledGrouped)} onUnscheduledGroup={() => updateScene({ unscheduledGrouped: !scene.unscheduledGrouped })}/>}
    </aside>
    <CalendarOverlay present={Boolean(reminderAttempt)}>
      {reminderAttempt && <CalendarDialog title={t("提醒时间已过去")} onEscape={discardReminderChange}>
          <p className="cal-reminder-decision">{t("任务时间段：{{range}}。提醒设定：{{reminder}}。此次操作会让提醒失效，修改尚未保存。", { range: timeRangeLabel(reminderContent), reminder: reminderLabel(reminderContent.reminder) })}</p>
          <footer><button onClick={discardReminderChange}>{t("放弃本次修改")}</button><button className="is-primary" data-dialog-confirm="" onClick={saveWithoutReminder}>{t("关闭提醒并保存")}</button></footer>
        </CalendarDialog>}
    </CalendarOverlay>
    <CalendarOverlay present={Boolean(itemToMove || deletePrompt)}>
    {itemToMove && <MoveItemDialog item={itemToMove} sourceId={draft?.id} entries={data.entries} onMove={moveItem} onClose={() => setItemToMove(null)} onReload={op.problem?.kind === 'conflict' ? reloadConflict : null} busy={op.isRunning} pending={Boolean(op.pending)} error={op.problem?.message}/>}
    {deletePrompt && <CalendarDialog title={t("删除任务")} onClose={() => setDeletePrompt(false)}><p>{draft.origin ? t("取消这次任务，其他重复任务不受影响。") : <>{t("删除“")}{titleOf(draft.content)}”？{t("删除后无法恢复。")}</>}</p><footer><button onClick={() => setDeletePrompt(false)}>{t("取消")}</button><button className="is-danger" data-dialog-confirm="" disabled={op.isRunning || Boolean(op.pending)} onClick={() => remove(draft.origin ? 'instance' : 'series')}>{t("删除")}</button></footer></CalendarDialog>}
    </CalendarOverlay>
  </div>;
}
