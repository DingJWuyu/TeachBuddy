import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
/**
 * Schedule module entry: the single top-level 日程 page.
 *
 * It owns the visible range, the time grid, the unscheduled/priority lists and
 * one editor for a new entry, a whole repeating group or a single-instance
 * override. Drafts, selection, scroll and the open sections are part of the
 * per-account view scene; a formal selection or opening an existing entry
 * switches the shared auxiliary panel to the schedule tool and leaves the AI
 * draft untouched.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuxiliaryTools, useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { newRequestKey } from '../workbench/uuid.js';
import * as api from './api.js';
import CourseFeedback from './notifications/CourseFeedback.jsx';
import EntryEditor from './EntryEditor.jsx';
import RangeOverview from './RangeOverview.jsx';
import ScheduleAuxTool from './ScheduleAuxTool.jsx';
import ScheduleLists from './ScheduleLists.jsx';
import TimeGrid from './TimeGrid.jsx';
import { publishSchedulePanel } from './panelStore.js';
import './schedule.css';
import {
  DEFAULT_RANGE_DAYS,
  HOUR_HEIGHT,
  draftFromContent,
  emptyDraft,
  entryInputFromDraft,
  formatClock,
  formatRangeLabel,
  newItem,
  overrideFromDraft,
  todayInZone
} from './model.js';
import { addDays, diffDays, localParts } from './zoned.js';

const editorKey = value => `${value.entryId ?? 'new'}:${value.originDate ?? ''}`;

const SCHEDULE_TOOL = {
  id: 'schedule',
  label: '安排'
};

function draftProblem(draft, scope) {
  if (scope === 'instance' && !draft.time) return { message: '这次安排必须有时间' };
  if (!draft.unscheduled) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.time.date)) return { message: '请填写日期' };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time.startTime)) return { message: '请填写开始时间' };
    const duration = Number(draft.time.durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) return { message: '时长需在 1 到 1440 分钟之间' };
    if (draft.weekly && draft.until < draft.time.date) return { message: '重复结束日期不能早于首日' };
  }
  if (!draft.unscheduled && draft.reminder && (draft.reminder.minutes === ''
    || !Number.isInteger(Number(draft.reminder.minutes)) || Number(draft.reminder.minutes) < 0
    || Number(draft.reminder.minutes) > 10080)) return { message: '提醒间隔需在 0 到 10080 分钟之间' };
  const items = draft.items.filter((item) => item.text.trim() !== '');
  if (draft.title.trim() === '' && items.length === 0) return { message: '标题或至少一项事项' };
  return null;
}

export default function SchedulePage({ route }) {
  const shell = useWorkbenchShell();
  const [scene, patchScene] = useScene(shell.accountKey, 'schedule', {
    from: '',
    to: '',
    days: DEFAULT_RANGE_DAYS,
    pageScrollTop: 0,
    listsScrollTop: 0,
    gridScrollTop: 7 * HOUR_HEIGHT,
    gridScrollLeft: 0,
    unscheduledOpen: true,
    priorityOpen: false,
    month: '',
    editor: null,
    settingsOpen: false
  });

  const [settings, setSettings] = useState({ timeZone: 'Asia/Shanghai', version: 1 });
  const [timeZone, setTimeZone] = useState('Asia/Shanghai');
  const [occurrences, setOccurrences] = useState([]);
  const [unscheduled, setUnscheduled] = useState([]);
  const [status, setStatus] = useState('loading');
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selection, setSelection] = useState(() => scene.selection ?? null);
  const [editor, setEditorState] = useState(() => scene.editor ?? null);
  const [saveState, setSaveState] = useState(() => scene.editor?.pending ? { status: 'unconfirmed' }
    : scene.editor && JSON.stringify(scene.editor.drafts) !== JSON.stringify(scene.editor.baseline) ? { status: 'dirty' } : { status: 'idle' });
  const savesInFlight = useRef(new Set());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const operation = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:schedule-action' });
  const actionState = { ...operation, status: operation.status === 'failed' ? 'error' : operation.status,
    ...operation.pending?.payload, key: operation.pending?.key };
  const [moveState, setMoveState] = useState(() => scene.moveState?.status === 'running'
    ? { ...scene.moveState, status: 'unconfirmed' } : scene.moveState ?? null);
  const [settingsState, setSettingsState] = useState({ status: 'idle' });
  const [notice, setNotice] = useState(null);
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [records, setRecords] = useState([]);
  const [linksError, setLinksError] = useState(null);
  const [recordsState, setRecordsState] = useState('idle');
  const [linksRetry, setLinksRetry] = useState(0);
  const [exceptions, setExceptions] = useState([]);
  const rangeDraft = scene.rangeDraft ?? { from: scene.from, to: scene.to };
  const setRangeDraft = value => patchScene({ rangeDraft: value });
  const [focusToken, setFocusToken] = useState(0);

  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const pageRef = useRef(null);
  const listsRef = useRef(null);
  const scrollRestored = useRef(false);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  function setEditor(updater) {
    const current = editorRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    editorRef.current = next;
    // Input and original request must be durable before any request or unload.
    patchScene({ editor: next });
    setEditorState(next);
    return next;
  }

  const from = scene.from;
  const to = scene.to;

  useLayoutEffect(() => {
    // The pending list determines the scroll regions' content heights. Restore only after it loads,
    // and only once per mount so later reloads do not undo the user's scrolling.
    if (status !== 'ready' || scrollRestored.current) return;
    pageRef.current.scrollTop = sceneRef.current.pageScrollTop;
    listsRef.current.scrollTop = sceneRef.current.listsScrollTop;
    scrollRestored.current = true;
  }, [status]);

  // First mount / account switch: default the range to today plus six days.
  useEffect(() => {
    if (sceneRef.current.from && sceneRef.current.to) return;
    const zone = settings.timeZone;
    const today = todayInZone(zone);
    patchScene({ from: today, to: addDays(today, DEFAULT_RANGE_DAYS - 1), month: today.slice(0, 7) });
  }, [patchScene, settings.timeZone]);

  useEffect(() => {
    const current = sceneRef.current;
    setRangeDraft({ from: current.from, to: current.to });
  }, [from, to]);

  useEffect(() => {
    let cancelled = false;
    api.getSettings()
      .then((value) => {
        if (cancelled) return;
        setSettings(value);
        setTimeZone(value.timeZone);
      })
      .catch((problem) => {
        if (!cancelled) setError(problem.problem ?? { message: '时区设置读取失败' });
      });
    return () => { cancelled = true; };
  }, [shell.generation, reloadToken]);

  useEffect(() => {
    if (!from || !to) return undefined;
    let cancelled = false;
    setStatus('loading');
    Promise.all([
      api.listOccurrences({ from, to }),
      api.listEntries({ state: 'active', placement: 'unscheduled' })
    ])
      .then(([range, pending]) => {
        if (cancelled) return;
        setOccurrences(range.items);
        setTimeZone(range.timeZone);
        setUnscheduled(pending);
        setStatus('ready');
        setStale(false);
        setError(null);
      })
      .catch((problem) => {
        if (cancelled) return;
        setStatus('error');
        setStale(true);
        setError(problem.problem ?? { message: '读取失败' });
      });
    return () => { cancelled = true; };
  }, [from, to, reloadToken, shell.generation]);

  useEffect(() => {
    if (!editor) return undefined;
    let cancelled = false;
    Promise.all([api.listClasses(), api.listLessons()])
      .then(([classroomItems, lessonItems]) => {
        if (cancelled) return;
        setClasses(classroomItems);
        setLessons(lessonItems);
        setLinksError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setLinksError('班级或备课读取失败');
        }
      });
    return () => { cancelled = true; };
  }, [editor?.mode, editor?.entryId, shell.generation, linksRetry]);

  const editorEntryId = editor?.entryId ?? null;
  const editorRepeats = Boolean(editor?.entry?.repeat);
  useEffect(() => {
    if (!editorEntryId || !editorRepeats) {
      setExceptions([]);
      return undefined;
    }
    let cancelled = false;
    api.listExceptions(editorEntryId)
      .then((value) => { if (!cancelled) setExceptions(value.items); })
      .catch(() => { if (!cancelled) setExceptions([]); });
    return () => { cancelled = true; };
  }, [editorEntryId, editorRepeats, reloadToken]);

  const editorClassId = editor?.drafts?.[editor.scope]?.course?.classId ?? null;
  useEffect(() => {
    if (!editorClassId) {
      setRecords([]);
      setRecordsState('idle');
      return undefined;
    }
    let cancelled = false;
    setRecords([]);
    setRecordsState('loading');
    api.listClassRecords(editorClassId)
      .then((items) => { if (!cancelled) { setRecords(items); setRecordsState('ready'); } })
      .catch(() => { if (!cancelled) setRecordsState('error'); });
    return () => { cancelled = true; };
  }, [editorClassId, linksRetry, reloadToken, shell.generation]);

  useEffect(() => {
    patchScene(current => ({ editor, editors: editor
      ? { ...current.editors, [editorKey(editor)]: editor } : current.editors }));
  }, [editor, patchScene]);

  function updateMoveState(next) {
    setMoveState(next);
    patchScene({ moveState: next });
  }

  useEffect(() => {
    patchScene({ selection });
  }, [selection, patchScene]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  function applyRange(nextFrom, nextTo) {
    if (!nextFrom || !nextTo) return;
    if (diffDays(nextFrom, nextTo) < 0) {
      setError({ message: '开始日期不能晚于结束日期' });
      return;
    }
    patchScene({
      from: nextFrom,
      to: nextTo,
      days: diffDays(nextFrom, nextTo) + 1,
      month: nextFrom.slice(0, 7),
      rangeDraft: { from: nextFrom, to: nextTo }
    });
  }

  function shiftRange(delta) {
    const days = Math.max(1, diffDays(from, to) + 1);
    const nextFrom = addDays(from, delta * days);
    applyRange(nextFrom, addDays(nextFrom, days - 1));
  }

  function pickMonthDay(date) {
    const current = sceneRef.current;
    if (!rangeDraft.from || diffDays(rangeDraft.from, rangeDraft.to) !== 0) {
      setRangeDraft({ from: date, to: date });
      return;
    }
    if (diffDays(rangeDraft.from, date) < 0) setRangeDraft({ from: date, to: rangeDraft.from });
    else setRangeDraft({ from: rangeDraft.from, to: date });
  }

  /** One editor state shape for create, group and instance scopes. */
  function editorState({
    mode,
    entryId = null,
    originDate = null,
    entry = null,
    scope = 'group',
    expectedVersion = null,
    entryDeleted = false,
    state = 'active',
    drafts,
    baseline = null
  }) {
    return {
      mode,
      entryId,
      originDate,
      entry,
      scope,
      expectedVersion,
      entryDeleted,
      state,
      drafts,
      baseline,
      pending: null
    };
  }

  const openEditor = useCallback((next) => {
    const previous = editorRef.current;
    const editors = { ...sceneRef.current.editors };
    if (previous) editors[editorKey(previous)] = previous;
    patchScene({ editors });
    const saved = editors[editorKey(next)];
    const dirty = saved && (saved.pending || JSON.stringify(saved.drafts) !== JSON.stringify(saved.baseline));
    const restored = dirty && saved.entryId === next.entryId ? { ...next,
      drafts: saved.drafts, baseline: saved.baseline, expectedVersion: saved.expectedVersion,
      scope: saved.scope, pending: saved.pending } : next;
    setEditor(restored);
    setSaveState({ status: restored.pending ? 'unconfirmed' : dirty ? 'dirty' : 'idle' });
    setFocusToken((token) => token + 1);
  }, [patchScene]);

  function openCreate({ date, startMinutes, endMinutes }) {
    const draft = emptyDraft({
      date,
      startTime: formatClock(startMinutes),
      durationMinutes: Math.max(15, endMinutes - startMinutes),
      timeZone
    });
    // A new segment starts with one empty item, like 记一件事; an untouched
    // blank row is dropped on save.
    draft.items = [newItem()];
    openEditor(editorState({ mode: 'create', drafts: { group: draft, instance: null } }));
    if (shell.openPanel) {
      shell.openPanel('schedule');
      shell.setPanelMode?.('schedule');
    }
  }

  function openUnscheduledCreate() {
    const draft = emptyDraft({ timeZone });
    draft.unscheduled = true;
    draft.items = [newItem()];
    openEditor(editorState({ mode: 'create', drafts: { group: draft, instance: null } }));
  }

  async function openEntry(entryId, originDate = null, background = false) {
    try {
      const entry = await api.getEntry(entryId);
      let content = null;
      let occurrence = occurrences.find((item) => (
        item.key.entryId === entryId && (item.key.originDate ?? null) === (originDate ?? null)
      )) ?? null;
      if (originDate !== null) {
        const exceptions = await api.listExceptions(entryId);
        const exception = exceptions.items.find((item) => item.originDate === originDate) ?? null;
        if (exception?.mode === 'override') content = exception.content;
        occurrence = await api.getOccurrence(entryId, originDate);
        content = occurrence;
      }
      const base = {
        entry,
        unscheduled: entry.time === null,
        weekly: entry.repeat !== null,
        until: entry.repeat?.until ?? entry.time?.date ?? ''
      };
      const groupDraft = draftFromContent(base);
      const instanceDraft = originDate === null
        ? null
        : draftFromContent({ ...base, content, weekly: false });
      if (!alive.current || (background && (editorRef.current?.entryId !== entryId || editorRef.current?.pending || saveRunning.current))) return;
      openEditor(editorState({
        mode: 'entry',
        entryId,
        originDate,
        entry,
        scope: originDate === null ? 'group' : 'instance',
        expectedVersion: entry.version,
        entryDeleted: entry.deletedAt !== null,
        state: occurrence?.state ?? 'active',
        drafts: { group: groupDraft, instance: instanceDraft },
        baseline: { group: groupDraft, instance: instanceDraft }
      }));
      if (!background && shell.openPanel) {
        shell.openPanel('schedule');
        shell.setPanelMode?.('schedule');
      }
    } catch (problem) {
      setError(problem.problem ?? { message: '安排读取失败' });
    }
  }

  useForegroundRefresh(async () => {
    if (!alive.current || saveRunning.current) return;
    reload();
    const current = editorRef.current;
    if (current?.entryId && !current.pending) await openEntry(current.entryId, current.originDate, true);
  });

  useEffect(() => {
    const query = new URLSearchParams(route?.search ?? '');
    const entryId = query.get('entry');
    if (!entryId) return undefined;
    let cancelled = false;
    api.getEntry(entryId).then(async entry => {
      if (cancelled) return;
      if (!entry.time) { await openEntry(entryId); return; }
      const occurrence = await api.getOccurrence(entryId, query.get('on'));
      if (cancelled) return;
      const zone = (await api.getSettings()).timeZone;
      if (cancelled) return;
      const start = localParts(zone, Date.parse(occurrence.startsAt));
      const end = localParts(zone, Date.parse(occurrence.endsAt) - 1);
      applyRange(start.date, end.date);
      patchScene({ gridScrollTop: Math.max(0, (start.minutes / 60 - 1) * HOUR_HEIGHT) });
      await openEntry(entryId, query.get('on'));
    }).catch(problem => { if (!cancelled) setError(problem.problem ?? { message: '安排读取失败' }); });
    return () => { cancelled = true; };
  }, [route, shell.generation]);

  function patchDraft(patch) {
    setSaveState(current => current.status === 'saved' || current.status === 'saved-dirty' ? { status: 'idle' } : current);
    setEditor((current) => {
      if (!current) return current;
      const scope = current.scope;
      const draft = { ...current.drafts[scope], ...patch };
      return { ...current, drafts: { ...current.drafts, [scope]: draft } };
    });
  }

  function switchScope(scope) {
    setEditor((current) => {
      if (!current || current.scope === scope) return current;
      const existing = current.drafts[scope];
      if (existing) return { ...current, scope };
      const entry = current.entry ?? null;
      const draft = draftFromContent({
        entry: entry ?? { title: '', items: [], time: null, repeat: null, course: null, reminder: null },
        content: null,
        unscheduled: !entry || entry.time === null,
        weekly: Boolean(entry?.repeat),
        until: entry?.repeat?.until ?? entry?.time?.date ?? ''
      });
      return { ...current, scope, drafts: { ...current.drafts, [scope]: draft } };
    });
  }

  const activeDraft = editor ? editor.drafts[editor.scope] : null;

  async function submitSave(request, key) {
    const targetKey = editorKey(editor);
    if (savesInFlight.current.has(targetKey)) return;
    savesInFlight.current.add(targetKey);
    const savedScope = request.kind === 'override' ? 'instance' : 'group';
    const submittedDraft = editor.pending?.draft ?? editor.drafts[savedScope];
    const pending = { key, request, draft: submittedDraft };
    const isCurrent = () => editorRef.current && editorKey(editorRef.current) === targetKey;
    // A save belongs to its original editor even after selection/navigation.
    // Persist the exact request before I/O, so refresh can confirm it safely.
    function updateTarget(update) {
      patchScene(current => ({
        editor: current.editor && editorKey(current.editor) === targetKey ? update(current.editor) : current.editor,
        editors: Object.fromEntries(Object.values(current.editors ?? {}).map(value => {
          const next = editorKey(value) === targetKey ? update(value) : value;
          return [editorKey(next), next];
        }))
      }));
      setEditor(current => current && editorKey(current) === targetKey ? update(current) : current);
    }
    updateTarget(current => ({ ...current, pending }));
    setSaveState({ status: 'saving' });
    try {
      let result;
      if (request.kind === 'create') {
        result = await api.createEntry({ key, payload: request.payload });
      } else if (request.kind === 'override') {
        result = await api.setException({ key, id: request.id, originDate: request.originDate,
          payload: { expectedVersion: request.expectedVersion, mode: 'override', content: request.payload } });
      } else {
        result = await api.updateEntry({ key, id: request.id,
          payload: { ...request.payload, expectedVersion: request.expectedVersion } });
      }
      if (!mounted.current) return;
      const current = isCurrent();
      const newerInput = current && JSON.stringify(editorRef.current.drafts[savedScope]) !== JSON.stringify(submittedDraft);
      updateTarget(value => ({
        ...value,
        mode: result.id ? 'entry' : value.mode,
        entryId: result.id ?? result.key?.entryId ?? value.entryId,
        expectedVersion: result.version ?? result.entryVersion ?? value.expectedVersion,
        entry: result.id ? result : value.entry,
        baseline: { group: null, instance: null, ...value.baseline, [savedScope]: submittedDraft },
        pending: null
      }));
      if (current) setSaveState({ status: newerInput ? 'saved-dirty' : 'saved' });
      reload();
    } catch (problem) {
      if (!mounted.current) return;
      const value = problem.problem ?? {};
      if (value.kind !== 'unconfirmed') updateTarget(current => ({ ...current, pending: null }));
      if (isCurrent()) {
        setSaveState(value.kind === 'unconfirmed' ? { status: 'unconfirmed', problem: value }
          : value.kind === 'conflict' ? { status: 'conflict', problem: value, currentVersion: value.currentVersion }
          : { status: 'error', problem: value });
      }
    } finally {
      savesInFlight.current.delete(targetKey);
    }
  }

  async function saveEditor() {
    if (!editor || !activeDraft) return;
    const problem = draftProblem(activeDraft, editor.scope);
    if (problem) {
      setSaveState({ status: 'error', problem });
      return;
    }
    const request = editor.pending?.request ?? (editor.scope === 'instance'
      ? {
        kind: 'override',
        id: editor.entryId,
        originDate: editor.originDate,
        expectedVersion: editor.expectedVersion,
        payload: overrideFromDraft(activeDraft)
      }
      : {
        kind: editor.mode === 'create' ? 'create' : 'update',
        id: editor.entryId,
        expectedVersion: editor.expectedVersion,
        payload: entryInputFromDraft(activeDraft)
      });
    const key = editor.pending?.key ?? newRequestKey();
    await submitSave(request, key);
  }

  async function retrySave() {
    if (!editor?.pending) return;
    await submitSave(editor.pending.request, editor.pending.key);
  }

  async function reloadCurrent() {
    if (!editor?.entryId) return;
    try {
      const entry = await api.getEntry(editor.entryId);
      // Keep the draft: the teacher compares both sides and decides, and the
      // next save is a new submission against the version just read.
      setEditor((current) => (current ? { ...current, entry, expectedVersion: entry.version } : current));
      setSaveState({
        status: 'conflict-view',
        server: {
          version: entry.version,
          title: entry.title.trim() || entry.items[0]?.text?.trim() || '未命名安排',
          detail: entry.items[1]?.text?.trim() ?? ''
        },
        problem: { message: '已读取服务器版本，本地修改保留，再次保存将以该版本提交' }
      });
    } catch (problem) {
      setSaveState({ status: 'error', problem: problem.problem ?? { message: '读取服务器版本失败' } });
    }
  }

  async function runAction({ key, payload }) {
    const request = payload.request;
    if (request.kind === 'exception') return api.setException({ key, ...request.args });
    if (request.kind === 'deletion') return api.setEntryDeletion({ key, ...request.args });
    if (request.kind === 'move') return api.moveItem({ key, payload: request.args });
    if (request.kind === 'settings') return api.updateSettings({ key, payload: request.args });
    throw { problem: { kind: 'unconfirmed', message: '无法识别原操作，已保留设备资料，请下载草稿后检查' } };
  }
  async function executeAction(name, request, retry = false) {
    if (!retry && operation.pending) { setNotice('请先确认上次操作，再执行新的操作'); return false; }
    const result = retry ? await operation.retry(runAction) : await operation.submit(runAction, { name, request });
    if (!result) return false;
    if (request.kind === 'settings') {
      setSettings(result); shell.setTimeZone?.(result.timeZone); setTimeZone(result.timeZone); setSettingsState({ status: 'done' });
    }
    reload();
    return true;
  }
  async function retryAction() {
    if (!actionState.request) return;
    const ok = await executeAction(actionState.name, actionState.request, true);
    const current = editorRef.current;
    if (ok && current?.entryId && !current.pending) await openEntry(current.entryId, current.originDate);
  }

  async function setInstanceModeAt(originDate, mode) {
    if (!editor?.entryId) return;
    const entryId = editor.entryId;
    await executeAction(`${mode}:${originDate}`, {
      kind: 'exception', args: { id: entryId, originDate,
        payload: { expectedVersion: editor.expectedVersion, mode } }
    });
    await openEntry(entryId, editor.scope === 'instance' ? editor.originDate : null);
  }

  async function deleteOrRestoreEntry() {
    if (!editor?.entryId) return;
    const deleted = !editor.entryDeleted;
    const ok = await executeAction('delete', {
      kind: 'deletion', args: { id: editor.entryId,
        payload: { expectedVersion: editor.expectedVersion, deleted } }
    });
    if (ok) {
      setSaveState({ status: 'saved' });
      await openEntry(editor.entryId, editor.originDate);
    }
  }

  async function setInstanceMode(mode) {
    if (!editor?.entryId || editor.originDate === null) return;
    const entryId = editor.entryId;
    const originDate = editor.originDate;
    const ok = await executeAction(mode, {
      kind: 'exception', args: { id: entryId, originDate,
        payload: { expectedVersion: editor.expectedVersion, mode } }
    });
    if (ok) await openEntry(entryId, originDate);
  }

  async function moveItemToUnscheduled(item, retry = false) {
    if (!editor?.entryId || !editor.entry) return;
    const entryId = retry ? moveState.request.fromEntryId : editor.entryId;
    const originDate = editor.originDate;
    const request = retry ? moveState.request : {
      itemId: item.id,
      fromEntryId: entryId,
      fromVersion: editor.expectedVersion,
      toEntryId: null,
      toVersion: null,
      toIndex: 0
    };
    const key = retry ? moveState.key : newRequestKey();
    updateMoveState({ itemId: item.id, status: 'running', direction: 'out', key, request });
    try {
      await api.moveItem({ key, payload: request });
      if (!mounted.current) return;
      updateMoveState({ itemId: item.id, status: 'done' });
      setSaveState({ status: 'idle' });
      const refreshed = await api.getEntry(entryId);
      if (!mounted.current) return;
      const stillSelected = editorRef.current?.entryId === entryId;
      if (refreshed.deletedAt !== null && stillSelected) {
        // An untitled source that lost its last item is soft-deleted; the
        // editor cannot keep editing it.
        setEditor(null);
        setNotice('原安排已移空并删除，可在“已删除”中恢复');
      } else if (stillSelected) {
        await openEntry(entryId, originDate);
      }
      reload();
    } catch (problem) {
      if (!mounted.current) return;
      const value = problem.problem ?? {};
      updateMoveState({
        itemId: item.id,
        status: value.kind === 'unconfirmed' ? 'unconfirmed' : 'error',
        direction: 'out',
        message: value.message ?? '移回未排期被拒绝',
        key,
        request
      });
      setSaveState({ status: 'error', problem: value });
    }
  }

  async function moveUnscheduledItem({ entry, item, toEntryId }, retry = false) {
    const request = retry ? moveState.request : { entry, item, toEntryId };
    const target = occurrences.find((occurrence) => occurrence.key.entryId === toEntryId);
    const key = retry ? moveState.key : newRequestKey();
    const payload = retry && moveState.payload ? moveState.payload : {
      itemId: item.id,
      fromEntryId: entry.id,
      fromVersion: entry.version,
      toEntryId,
      toVersion: target?.entryVersion ?? null,
      toIndex: target ? target.items.length : 0
    };
    updateMoveState({ itemId: item.id, status: 'running', direction: 'in', key, request, payload });
    try {
      await api.moveItem({ key, payload });
      if (!mounted.current) return;
      updateMoveState({ itemId: item.id, status: 'done' });
      if (editorRef.current?.entryId === entry.id) setEditor(null);
      reload();
    } catch (problem) {
      if (!mounted.current) return;
      const value = problem.problem ?? {};
      updateMoveState({
        itemId: item.id,
        status: value.kind === 'unconfirmed' ? 'unconfirmed' : 'error',
        direction: 'in',
        payload,
        message: value.message ?? '移动被拒绝',
        key,
        request
      });
    }
  }
  async function updateTimeZone(nextZone) {
    setSettingsState({ status: 'running' });
    const ok = await executeAction('settings', { kind: 'settings', args: { timeZone: nextZone, expectedVersion: settings.version } });
    if (!ok) setSettingsState({ status: 'error', problem: { message: '时区未确认，请查看页面中的操作结果并重试确认' } });
  }

  const dates = useMemo(() => {
    if (!from || !to) return [];
    const list = [];
    for (let date = from; diffDays(date, to) >= 0; date = addDays(date, 1)) list.push(date);
    return list;
  }, [from, to]);

  const editorProps = editor && activeDraft ? {
    mode: editor.mode,
    scope: editor.scope,
    draft: activeDraft,
    instance: editor.entryId
      ? {
        key: { entryId: editor.entryId, originDate: editor.originDate },
        repeat: editor.entry?.repeat ?? null,
        time: editor.entry?.time ?? null,
        state: editor.state,
        entryDeleted: editor.entryDeleted
      }
      : null,
    canEditGroup: !editor.entryDeleted,
    canMoveItems: !editor.pending && JSON.stringify(activeDraft) === JSON.stringify(editor.baseline?.[editor.scope]),
    timeZone,
    classes,
    lessons,
    records,
    linksError,
    recordsState,
    onRetryLinks: () => setLinksRetry(value => value + 1),
    exceptions,
    courseFeedback: editor.entryId && editor.entry?.time && !activeDraft.unscheduled
      && activeDraft.course.classId && !editor.entryDeleted
      && editor.state === 'active' && (editor.scope === 'instance' || !editor.entry?.repeat)
      ? <CourseFeedback key={`${editor.entryId}:${editor.originDate ?? ''}`} entryId={editor.entryId}
          originDate={editor.originDate} course={activeDraft.course} timeZone={timeZone}
          onLinked={result => {
            setEditor(current => {
              if (!current) return current;
              const scope = current.scope;
              const draft = current.drafts[scope];
              const nextDraft = { ...draft, course: { ...draft.course, recordIds: result.course.recordIds } };
              return { ...current, expectedVersion: result.version ?? result.entryVersion,
                drafts: { ...current.drafts, [scope]: nextDraft } };
            });
            reload();
          }} /> : null,
    saveState,
    focusToken
  } : null;

  const editorActions = {
    onPatch: patchDraft,
    onScope: switchScope,
    onSave: saveEditor,
    onCancel: () => { const current = editorRef.current; if (current) patchScene({ editors: { ...sceneRef.current.editors, [`${current.entryId ?? 'new'}:${current.originDate ?? ''}`]: current } }); setEditor(null); },
    onDelete: deleteOrRestoreEntry,
    onRestore: deleteOrRestoreEntry,
    onCancelInstance: () => setInstanceMode('cancelled'),
    onRestoreInstance: () => setInstanceMode('inherit'),
    onOpenInstance: (originDate) => (editor?.entryId ? openEntry(editor.entryId, originDate) : undefined),
    onMoveItemToUnscheduled: moveItemToUnscheduled,
    moveState,
    onRetryMoveOut: () => moveItemToUnscheduled({ id: moveState.itemId }, true),
    onInheritInstance: (originDate) => setInstanceModeAt(originDate, 'inherit'),
    onCancelInstanceAt: (originDate) => setInstanceModeAt(originDate, 'cancelled'),
    onRetry: retrySave,
    onReload: reloadCurrent
  };

  useEffect(() => () => publishSchedulePanel({ active: false }), []);

  const panelRef = useRef(null);
  panelRef.current = { active: Boolean(editorProps), editor: editorProps, actions: editorActions };
  useEffect(() => {
    publishSchedulePanel(panelRef.current);
  });

  useAuxiliaryTools([{ ...SCHEDULE_TOOL, render: () => <ScheduleAuxTool /> }]);

  const panelOwnsEditor = Boolean(shell.isPanelOpen && shell.panelMode === 'schedule');

  return (
    <div
      className="sch-page"
      data-region="schedule"
      ref={pageRef}
      onScroll={(event) => {
        if (scrollRestored.current && event.target === event.currentTarget) {
          patchScene({ pageScrollTop: event.currentTarget.scrollTop });
        }
      }}
    >
      <header className="sch-toolbar">
        <div className="sch-range">
          <button type="button" className="wb-button" data-action="today" onClick={() => {
            const today = todayInZone(timeZone);
            applyRange(today, addDays(today, Math.max(1, diffDays(from, to) + 1) - 1));
          }}>
            今天
          </button>
          <button type="button" className="wb-icon-button" aria-label="上一段" data-action="prev-range" onClick={() => shiftRange(-1)}>‹</button>
          <button type="button" className="wb-icon-button" aria-label="下一段" data-action="next-range" onClick={() => shiftRange(1)}>›</button>
          <label className="sch-range-field">
            <span className="sch-sub-label">开始</span>
            <input
              className="wb-input"
              type="date"
              name="range-from"
              value={rangeDraft.from}
              min="1900-01-01"
              max="2100-12-31"
              onChange={(event) => setRangeDraft({ ...rangeDraft, from: event.target.value })}
            />
          </label>
          <label className="sch-range-field">
            <span className="sch-sub-label">结束</span>
            <input
              className="wb-input"
              type="date"
              name="range-to"
              value={rangeDraft.to}
              min="1900-01-01"
              max="2100-12-31"
              onChange={(event) => setRangeDraft({ ...rangeDraft, to: event.target.value })}
            />
          </label>
          <label className="sch-range-field is-days">
            <span className="sch-sub-label">天数</span>
            <input
              className="wb-input"
              type="number"
              name="range-days"
              min="1"
              max="366"
              value={Math.max(1, diffDays(rangeDraft.from || from, rangeDraft.to || to) + 1)}
              onChange={(event) => {
                const days = Math.max(1, Number(event.target.value) || 1);
                setRangeDraft({ from: rangeDraft.from || from, to: addDays(rangeDraft.from || from, days - 1) });
              }}
            />
          </label>
          <button type="button" className="wb-button is-primary" data-action="apply-range" onClick={() => applyRange(rangeDraft.from, rangeDraft.to)}>
            应用
          </button>
        </div>
        <div className="sch-toolbar-actions">
          <span className="sch-range-label" data-region="range-label">{from && to ? formatRangeLabel(from, to) : ''}</span>
          <button type="button" className="wb-button" data-action="new-unscheduled" onClick={openUnscheduledCreate}>
            记一件事
          </button>
        </div>
      </header>

      {stale && (
        <p className="sch-stale" data-region="stale-notice">
          未能更新，显示的是上一次结果
          <button type="button" className="wb-button" onClick={reload}>重试</button>
        </p>
      )}
      {!stale && error && status === 'error' && (
        <p className="sch-stale" data-region="range-error">{error.message ?? '读取失败'}</p>
      )}

      <div className="sch-body">
        <div className="sch-main">
          {status === 'loading' && occurrences.length === 0 && <p className="wb-muted">正在加载日程…</p>}
          {dates.length > 0 && (
            <TimeGrid
              dates={dates}
              timeZone={timeZone}
              occurrences={occurrences}
              selection={selection}
              onSelect={(next) => {
                setSelection(next);
                openCreate(next);
              }}
              onOpen={(occurrence) => openEntry(occurrence.key.entryId, occurrence.key.originDate)}
              scroll={{ top: scene.gridScrollTop, left: scene.gridScrollLeft, ready: status === 'ready', restoreKey: `${shell.accountKey}:${from}:${to}` }}
              onScroll={({ top, left }) => patchScene({ gridScrollTop: top, gridScrollLeft: left })}
              today={todayInZone(timeZone)}
            />
          )}
          {occurrences.length === 0 && status === 'ready' && (
            <p className="wb-empty-note" data-region="range-empty">这个范围暂无安排</p>
          )}
          <ScheduleLists
            regionRef={listsRef}
            onScroll={(event) => {
              if (scrollRestored.current && event.target === event.currentTarget) {
                patchScene({ listsScrollTop: event.currentTarget.scrollTop });
              }
            }}
            unscheduled={unscheduled}
            refreshToken={reloadToken}
            occurrences={occurrences}
            open={{ unscheduled: scene.unscheduledOpen, priority: scene.priorityOpen, deleted: scene.deletedOpen }}
            onToggle={(key) => patchScene({ [`${key}Open`]: !scene[`${key}Open`] })}
            onOpenEntry={openEntry}
            onMove={moveUnscheduledItem}
            moveState={moveState}
            timeZone={timeZone}
          />
        </div>

        {!panelOwnsEditor && (
          <aside className="sch-side" data-region="schedule-side">
            {editorProps
              ? <EntryEditor {...editorProps} {...editorActions} />
              : (
                <RangeOverview
                  from={from}
                  to={to}
                  month={scene.month || (from ? from.slice(0, 7) : '')}
                  onMonth={(month) => patchScene({ month })}
                  onPick={pickMonthDay}
                  timeZone={timeZone}
                  occurrenceCount={occurrences.length}
                  unscheduledCount={unscheduled.reduce((total, entry) => total + entry.items.length, 0)}
                  settings={settings}
                  settingsOpen={scene.settingsOpen}
                  onSettingsOpen={() => patchScene({ settingsOpen: true })}
                  onSettingsClose={() => patchScene({ settingsOpen: false })}
                  onUpdateTimeZone={updateTimeZone}
                  settingsState={settingsState}
                />
              )}
          </aside>
        )}
      </div>

      {notice && (
        <div className="sch-action-state" data-region="notice">
          <span>{notice}</span>
          <button type="button" className="wb-button" onClick={() => setNotice(null)}>关闭</button>
        </div>
      )}
      {actionState.status === 'unconfirmed' && (
        <div className="sch-action-state" data-region="action-state">
          <span>上次操作结果未确认</span>
          <button type="button" className="wb-button" data-action="retry-action" onClick={retryAction}>用原请求确认</button>
        </div>
      )}
      {actionState.status === 'error' && (
        <div className="sch-action-state is-error" data-region="action-state">
          <span>{actionState.problem?.message ?? '操作被拒绝'}</span>
          <button type="button" className="wb-button" onClick={operation.reset}>关闭</button>
        </div>
      )}
    </div>
  );
}
