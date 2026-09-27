import { RecordMoveDialog } from './RecordMoveDialog.jsx';
/**
 * Classes module page: /classes, /classes/:classId and
 * /classes/:classId/records/:recordId.
 *
 * The page owns its two panes and their data; the shell only passes the current
 * route (when it has parsed one) and the account identity. Reverse feedback and
 * the class/record selector are exported from here for the lessons, questions
 * and schedule pages to assemble.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
import { navigate } from '../workbench/routes.js';
import { Icon } from '../workbench/icons.jsx';
import { listClasses, listRecords, purgeClass, purgeRecord, moveRecord } from './api.js';
import { DEFAULT_TIME_ZONE } from './model.js';
import { ClassList, ClassCreateDialog } from './ClassList.jsx';
import { ClassDetail } from './ClassDetail.jsx';
import { ClassHome } from './ClassHome.jsx';
import { ModulePresence, useModuleDialogFocus } from '../workbench/ModuleMotion.jsx';
import { ConfirmDialog } from '../workbench/ModuleOverlays.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { readLocal, removeLocal } from '../workbench/storage.js';
import './classes.css';

const NAVIGATION_EVENT = 'tb:navigate';
const EMPTY_ROUTE = Object.freeze({ name: 'classes', classId: null, recordId: null });

function ClassChooser({ children, onClose }) {
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  return <div className="wb-dialog-host wb-module-dialog" data-overlay="dialog">
    <div className="wb-dialog-scrim" role="presentation" onClick={onClose} />
    <div ref={ref} className="wb-dialog c-chooser-dialog" role="dialog" aria-modal="true" aria-label="切换班级">{children}</div>
  </div>;
}

export function parseClassesPath(pathname) {
  const segments = String(pathname || '/').split('/').filter(Boolean);
  if (segments[0] !== 'classes') return null;
  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  };
  if (segments.length === 1) return { name: 'classes', classId: null, recordId: null };
  if (segments.length === 2) return { name: 'class', classId: decode(segments[1]), recordId: null };
  if (segments.length === 4 && segments[2] === 'records') {
    return { name: 'class-record', classId: decode(segments[1]), recordId: decode(segments[3]) };
  }
  return { ...EMPTY_ROUTE };
}

/** Fallback route source for a standalone mount; the shell passes `route` instead. */
export function useClassesRoute() {
  const [value, setValue] = useState(() => (
    typeof window === 'undefined' ? { ...EMPTY_ROUTE } : (parseClassesPath(window.location.pathname) ?? { ...EMPTY_ROUTE })
  ));

  useEffect(() => {
    function sync() {
      setValue(parseClassesPath(window.location.pathname) ?? { ...EMPTY_ROUTE });
    }
    window.addEventListener('popstate', sync);
    window.addEventListener(NAVIGATION_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAVIGATION_EVENT, sync);
    };
  }, []);

  return value;
}

export default function ClassesPage({ route, timeZone = DEFAULT_TIME_ZONE } = {}) {
  const shell = useWorkbenchShell();
  const localRoute = useClassesRoute();
  const located = route ?? localRoute;
  const [scene, patchScene] = useScene(shell.accountKey, 'classes', {
    homeView: 'active',
    listScrollTop: 0,
    detailScroll: { classId: null, top: 0 }
  });
  const [classes, setClasses] = useState({ active: null, deleted: null });
  const [classesStatus, setClassesStatus] = useState('loading');
  const [classesError, setClassesError] = useState(null);
  const [classReload, setClassReload] = useState(0);
  const [records, setRecords] = useState({ classId: null, active: null, deleted: null });
  const recordState = scene.recordState ?? 'active';
  const setRecordState = value => patchScene({ recordState: value });
  const [recordsStatus, setRecordsStatus] = useState('idle');
  const [recordsError, setRecordsError] = useState(null);
  const [recordReload, setRecordReload] = useState(0);
  const [movingRecord, setMovingRecord] = useState(null);
  const [moveNotice, setMoveNotice] = useState('');
  const moving = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:record-move' });
  const [confirmingRecordPurge, setConfirmingRecordPurge] = useState(null);
  const recordPurge = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:record-purge' });
  const [confirmingPurge, setConfirmingPurge] = useState(null);
  // The request survives its card disappearing after deletion, including reload.
  const purge = useIdempotentSubmit({ accountKey: shell.accountKey, name: 'pending:class-purge' });
  useForegroundRefresh(() => { setClassReload(value => value + 1); setRecordReload(value => value + 1); });

  useEffect(() => {
    let cancelled = false;
    setClassesStatus('loading');
    Promise.all([listClasses({ state: 'active' }), listClasses({ state: 'deleted' })])
      .then(([active, deleted]) => {
        if (cancelled) return;
        setClasses({ active, deleted });
        setClassesError(null);
        setClassesStatus('ready');
      })
      .catch((problem) => {
        if (cancelled) return;
        setClassesError(problem.problem || { message: '无法加载班级' });
        setClassesStatus('error');
      });
    return () => { cancelled = true; };
  }, [classReload, shell.generation]);

  const selectedId = located.classId ?? null;
  const selected = selectedId
    ? (classes.active ?? []).find((item) => item.id === selectedId)
      ?? (classes.deleted ?? []).find((item) => item.id === selectedId)
      ?? null
    : null;

  useEffect(() => {
    if (!selected) {
      setRecords({ classId: null, active: null, deleted: null });
      setRecordsStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setRecordsStatus('loading');
    Promise.all([
      listRecords({ classId: selected.id, state: 'active' }),
      listRecords({ classId: selected.id, state: 'deleted' })
    ])
      .then(([active, deleted]) => {
        if (cancelled) return;
        setRecords({ classId: selected.id, active, deleted });
        setRecordsError(null);
        setRecordsStatus('ready');
      })
      .catch((problem) => {
        if (cancelled) return;
        setRecordsError(problem.problem || { message: '无法加载记录' });
        setRecordsStatus('error');
      });
    return () => { cancelled = true; };
  }, [selected?.id, recordReload, shell.generation]);

  // A deep link to a record opens the filter that actually contains it.
  useEffect(() => {
    if (!located.recordId) return;
    if ((records.active ?? []).some((record) => record.id === located.recordId)) setRecordState('active');
    else if ((records.deleted ?? []).some((record) => record.id === located.recordId)) setRecordState('deleted');
  }, [located.recordId, records]);

  const refreshClasses = useCallback(() => setClassReload((token) => token + 1), []);
  const refreshRecords = useCallback(() => setRecordReload((token) => token + 1), []);
  const handleClassCreated = useCallback((classroom) => {
    refreshClasses();
    patchScene({ creatingClass: false, classListOpen: false, homeView: 'active', recordState: 'active' });
    navigate(`/classes/${classroom.id}`);
  }, [refreshClasses, patchScene]);
  const handleClassChanged = useCallback((classroom) => {
    setClasses(current => ({
      active: [...(current.active ?? []).filter(item => item.id !== classroom.id), ...(!classroom.deletedAt ? [classroom] : [])]
        .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.id.localeCompare(b.id)),
      deleted: [...(current.deleted ?? []).filter(item => item.id !== classroom.id), ...(classroom.deletedAt ? [classroom] : [])]
    }));
    if (classroom.deletedAt && located.classId === classroom.id) {
      patchScene({ homeView: 'active', classListOpen: false });
      navigate('/classes');
    }
    refreshClasses();
  }, [refreshClasses, located.classId, patchScene]);
  const openRecord = useCallback((recordId) => {
    if (selectedId) navigate(`/classes/${selectedId}/records/${recordId}`);
  }, [selectedId]);
  const closeRecord = useCallback(() => {
    if (selectedId) navigate(`/classes/${selectedId}`);
  }, [selectedId]);
  const archived = scene.homeView === 'archived';
  const showSidebar = Boolean(selected) && !shell.narrow && !shell.isPanelOpen;
  function goHome(view = 'active') {
    patchScene({ homeView: view, classListOpen: false, selectedId: null });
    navigate('/classes');
  }
  async function confirmPurge() {
    const classroom = confirmingPurge;
    setConfirmingPurge(null);
    const run = ({ key, payload }) => purgeClass({ key, id: payload.id, payload: { expectedVersion: payload.expectedVersion } });
    const result = purge.pending ? await purge.retry(run)
      : classroom && await purge.submit(run, { id: classroom.id, name: classroom.name, expectedVersion: classroom.version });
    if (!result) return;
    setClasses(current => ({ active: (current.active ?? []).filter(item => item.id !== result.id), deleted: (current.deleted ?? []).filter(item => item.id !== result.id) }));
    refreshClasses();
    goHome('archived');
  }
  async function confirmRecordPurge() {
    const record = confirmingRecordPurge;
    setConfirmingRecordPurge(null);
    const run = ({ key, payload }) => purgeRecord({ key, id: payload.id, payload: { expectedVersion: payload.expectedVersion } });
    const result = recordPurge.pending ? await recordPurge.retry(run)
      : record && await recordPurge.submit(run, { id: record.id, expectedVersion: record.version });
    if (!result) return;
    removeLocal(shell.accountKey, `draft:class-record:${result.id}`);
    setRecords(current => ({ ...current, deleted: current.deleted?.filter(item => item.id !== result.id) ?? null }));
    refreshRecords();
    if (located.recordId === result.id) closeRecord();
  }
  function requestMove(record) {
    if (moving.isRunning || moving.pending) return;
    if (readLocal(shell.accountKey, `draft:class-record:${record.id}`) || readLocal(shell.accountKey, `pending:class-image:record:${record.id}`)) {
      setMoveNotice('这条记录有未保存的修改或图片，请先保存或处理草稿，再移动。');
      openRecord(record.id);
      return;
    }
    setMoveNotice(''); setMovingRecord(record);
  }
  async function confirmMove(targetClassId) {
    const record = movingRecord;
    setMovingRecord(null);
    const run = ({ key, payload }) => moveRecord({ key, id: payload.id, payload: { expectedVersion: payload.expectedVersion, targetClassId: payload.targetClassId } });
    const result = moving.pending ? await moving.retry(run) : record && await moving.submit(run, { id: record.id, expectedVersion: record.version, targetClassId });
    if (!result) return;
    refreshRecords(); refreshClasses();
    patchScene({ classListOpen: false, recordState: 'active' });
    setMoveNotice('记录已移动，原记录保留在原班级的“已删除”中。');
    navigate(`/classes/${result.record.classId}/records/${result.record.id}`);
  }
  function requestRecordPurge(record) {
    if (!recordPurge.isRunning && !recordPurge.pending) setConfirmingRecordPurge(record);
  }
  function requestPurge(classroom) {
    if (!purge.isRunning && !purge.pending) setConfirmingPurge(classroom);
  }
  function selectClass(classId) {
    patchScene({ classListOpen: false, recordState: 'active' });
    navigate(`/classes/${classId}`);
  }
  const createClass = () => patchScene({ creatingClass: true, classListOpen: false });
  function renderClasses(onClose) {
    return <ClassList items={classes.active ?? []} status={classesStatus} error={classesError}
      onArchived={() => goHome('archived')}
      selectedId={selectedId} onSelect={selectClass} onCreate={createClass} onReload={refreshClasses}
      scrollTop={scene.listScrollTop} onScrollTop={listScrollTop => patchScene({ listScrollTop })} onClose={onClose} />;
  }

  return (
    <div className="wb-page wb-module c-classes" data-region="classes-index">
      {moveNotice && <p className="wb-muted c-pane-note" role="status">{moveNotice}<button className="wb-button c-text-action" onClick={() => setMoveNotice('')}>知道了</button></p>}
      {moving.isRunning && <p className="wb-muted c-pane-note" role="status">正在移动记录…</p>}
      {moving.status === 'unconfirmed' && <div className="wb-inline-error" role="status">暂时无法确认记录是否移动。<button className="wb-button" onClick={() => confirmMove()}>重试移动记录</button></div>}
      {moving.status === 'failed' && <p className="wb-inline-error" role="alert">{moving.problem?.message || '移动失败'}<button className="wb-button" onClick={() => { moving.reset(); refreshRecords(); }}>刷新记录</button></p>}
      {recordPurge.isRunning && <p className="wb-muted c-pane-note" role="status">正在确认记录删除结果…</p>}
      {recordPurge.status === 'unconfirmed' && <div className="wb-inline-error" role="status">暂时无法确认是否彻底删除记录。
        <button className="wb-button" onClick={confirmRecordPurge}>重试删除记录</button></div>}
      {recordPurge.status === 'failed' && <div className="wb-inline-error" role="alert">{recordPurge.problem?.message || '记录删除失败'}<button className="wb-button" onClick={refreshRecords}>刷新记录</button></div>}
      {purge.isRunning && <p className="wb-muted c-pane-note" role="status">正在确认删除结果…</p>}
      {purge.status === 'unconfirmed' && <div className="wb-inline-error" role="status">暂时无法确认是否彻底删除「{purge.pending.payload.name}」。
        <button className="wb-button" onClick={confirmPurge}>重试确认</button></div>}
      {purge.status === 'failed' && <div className="wb-inline-error" role="alert">{purge.problem?.message || '删除失败，请重试'}<button className="wb-button" onClick={refreshClasses}>刷新班级</button></div>}
      <div className={`c-layout${showSidebar ? ' has-class-list' : ''}`}>
        {selected ? (
          <ClassDetail
            key={selected.id}
            accountKey={shell.accountKey}
            generation={shell.generation}
            classroom={selected}
            timeZone={timeZone}
            records={records.classId === selected.id ? records : { active: null, deleted: null }}
            recordState={recordState}
            onRecordStateChange={setRecordState}
            recordsStatus={recordsStatus}
            recordsError={recordsError}
            onReloadRecords={refreshRecords}
            openRecordId={located.recordId ?? null}
            onOpenRecord={openRecord}
            onCloseRecord={closeRecord}
            onClassChanged={handleClassChanged}
            onChooseClass={() => patchScene({ classListOpen: true })}
            onHome={() => goHome()}
            onDelete={requestPurge}
            onPurgeRecord={requestRecordPurge}
            onMoveRecord={requestMove} moveBusy={moving.isRunning || Boolean(moving.pending)}
            detailScrollTop={scene.detailScroll?.classId === selected.id ? scene.detailScroll.top : 0}
            onDetailScrollTop={(top) => patchScene({ detailScroll: { classId: selected.id, top } })}
          />
        ) : selectedId ? (
          <section className="c-class-placeholder" data-region="class-placeholder">
            <header className="c-class-head"><button className="wb-icon-button" aria-label="返回班级主页" title="返回班级主页" onClick={() => goHome()}><Icon name="back" size={20} /></button><h1>班级教学</h1></header>
            {classesStatus === 'loading' && <p className="wb-muted c-pane-note">正在加载班级…</p>}
            {classesStatus === 'error' && <div className="wb-inline-error c-welcome" role="alert"><p>{classesError?.message || '无法加载班级'}</p><button className="wb-button" onClick={refreshClasses}>重试加载</button></div>}
            {classesStatus === 'ready' && selectedId && (
              <div className="c-welcome">
                <p>未找到这个班级</p>
                <button type="button" className="wb-button" name="back-to-classes" onClick={() => goHome()}>
                  <Icon name="back" size={14} />
                  返回班级主页
                </button>
              </div>
            )}
          </section>
        ) : <ClassHome accountKey={shell.accountKey} items={(archived ? classes.deleted : classes.active) ?? []}
          status={classesStatus} error={classesError} archived={archived} onViewChange={value => goHome(value ? 'archived' : 'active')}
          onSelect={selectClass} onCreate={createClass} onReload={refreshClasses} onChanged={handleClassChanged} onDelete={requestPurge}
          scrollTop={scene.homeScroll?.[archived ? 'archived' : 'active'] || 0}
          onScrollTop={top => patchScene({ homeScroll: { ...scene.homeScroll, [archived ? 'archived' : 'active']: top } })} />}
        {showSidebar && renderClasses()}
      </div>
      <ModulePresence present={Boolean(scene.classListOpen)}>
        {scene.classListOpen && <ClassChooser onClose={() => patchScene({ classListOpen: false })}>
          {renderClasses(() => patchScene({ classListOpen: false }))}
        </ClassChooser>}
      </ModulePresence>
      <ModulePresence present={Boolean(movingRecord)}>
        {movingRecord && <RecordMoveDialog record={movingRecord} classes={classes.active ?? []} onCancel={() => setMovingRecord(null)} onConfirm={confirmMove} />}
      </ModulePresence>
      <ModulePresence present={Boolean(confirmingRecordPurge)}>
        {confirmingRecordPurge && <ConfirmDialog title="彻底删除记录" message="永久删除这条课堂记录，无法恢复。关联的资料和日程会保留。"
          confirmLabel="彻底删除" onCancel={() => setConfirmingRecordPurge(null)} onConfirm={confirmRecordPurge} />}
      </ModulePresence>
      <ModulePresence present={Boolean(confirmingPurge)}>
        {confirmingPurge && <ConfirmDialog title="彻底删除班级"
          message={`永久删除「${confirmingPurge.name}」及其全部课堂记录，无法恢复。关联的备课、题目、作品和日程会保留。`}
          confirmLabel="彻底删除" onCancel={() => setConfirmingPurge(null)} onConfirm={confirmPurge} />}
      </ModulePresence>
      <ModulePresence present={Boolean(scene.creatingClass)}>
        {scene.creatingClass && <ClassCreateDialog accountKey={shell.accountKey} onCreated={handleClassCreated} onClose={() => patchScene({ creatingClass: false })} />}
      </ModulePresence>
    </div>
  );
}

export { SourceRecordsPanel, ClassRecordPicker } from './FeedbackPanel.jsx';
export { RecordComposer } from './RecordComposer.jsx';
