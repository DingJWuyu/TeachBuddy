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
import { listClasses, listRecords } from './api.js';
import { DEFAULT_TIME_ZONE } from './model.js';
import { ClassList, ClassCreateDialog } from './ClassList.jsx';
import { ClassDetail } from './ClassDetail.jsx';
import { ModulePresence, useModuleDialogFocus } from '../workbench/ModuleMotion.jsx';
import { MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
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
    listState: 'active',
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

  const remembered = (classes.active ?? []).find(item => item.id === scene.selectedId);
  const selectedId = located.classId ?? remembered?.id ?? classes.active?.[0]?.id ?? null;
  const selected = selectedId
    ? (classes.active ?? []).find((item) => item.id === selectedId)
      ?? (classes.deleted ?? []).find((item) => item.id === selectedId)
      ?? null
    : null;

  useEffect(() => {
    if (selected && !located.classId) navigate(`/classes/${selected.id}`, { replace: true });
    if (selected && scene.selectedId !== selected.id) patchScene({ selectedId: selected.id });
  }, [selected?.id, located.classId, scene.selectedId, patchScene]);

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
    patchScene({ creatingClass: false, classListOpen: false, listState: 'active', selectedId: classroom.id, recordState: 'active' });
    navigate(`/classes/${classroom.id}`);
  }, [refreshClasses, patchScene]);
  const handleClassChanged = useCallback(() => {
    refreshClasses();
  }, [refreshClasses]);
  const openRecord = useCallback((recordId) => {
    if (selectedId) navigate(`/classes/${selectedId}/records/${recordId}`);
  }, [selectedId]);
  const closeRecord = useCallback(() => {
    if (selectedId) navigate(`/classes/${selectedId}`);
  }, [selectedId]);
  const listItems = scene.listState === 'deleted' ? (classes.deleted ?? []) : (classes.active ?? []);
  const hasClasses = (classes.active?.length ?? 0) + (classes.deleted?.length ?? 0) > 0;
  const showSidebar = hasClasses && !shell.narrow && !shell.isPanelOpen;
  function selectClass(classId) {
    patchScene({ selectedId: classId, classListOpen: false, recordState: 'active' });
    navigate(`/classes/${classId}`);
  }
  const createClass = () => patchScene({ creatingClass: true, classListOpen: false });
  function renderClasses(onClose) {
    return <ClassList items={listItems} status={classesStatus} error={classesError}
      listState={scene.listState} onListStateChange={listState => patchScene({ listState })}
      selectedId={selectedId} onSelect={selectClass} onCreate={createClass} onReload={refreshClasses}
      scrollTop={scene.listScrollTop} onScrollTop={listScrollTop => patchScene({ listScrollTop })} onClose={onClose} />;
  }

  return (
    <div className="wb-page wb-module c-classes" data-region="classes-index">
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
            detailScrollTop={scene.detailScroll?.classId === selected.id ? scene.detailScroll.top : 0}
            onDetailScrollTop={(top) => patchScene({ detailScroll: { classId: selected.id, top } })}
          />
        ) : (
          <section className="c-class-placeholder" data-region="class-placeholder">
            <header className="c-class-head"><span className="c-module-icon"><Icon name="classes" size={23} /></span><h1>班级教学</h1>
              <span className="c-head-spacer" /><Popover label="班级管理">{({ close }) => <MenuItem icon="trash" onClick={() => { close(); patchScene({ classListOpen: true, listState: 'deleted' }); }}>已删除的班级</MenuItem>}</Popover>
            </header>
            {classesStatus === 'loading' && <p className="wb-muted c-pane-note">正在加载班级…</p>}
            {classesStatus === 'error' && <div className="wb-inline-error c-welcome" role="alert"><p>{classesError?.message || '无法加载班级'}</p><button className="wb-button" onClick={refreshClasses}>重试加载</button></div>}
            {classesStatus === 'ready' && selectedId && (
              <div className="c-welcome">
                <p>未找到这个班级</p>
                <button type="button" className="wb-button" name="back-to-classes" onClick={() => { patchScene({ selectedId: null }); navigate('/classes'); }}>
                  <Icon name="back" size={14} />
                  返回班级列表
                </button>
              </div>
            )}
            {classesStatus === 'ready' && !selectedId && (
              <div className="c-welcome" data-region="class-placeholder-empty">
                <span className="c-welcome-icon"><Icon name="prep" size={32} /></span>
                <h2>每个班，都有自己的教学记录</h2>
                <p>记住教到了哪里、课堂上遇到的问题，<br />下次上课前，回来接着看。</p>
                <button type="button" className="wb-button is-primary" name="new-class" onClick={createClass}><Icon name="plus" size={17} />创建班级</button>
                <span className="c-welcome-hint">先建一个班，课后写一句就能开始。</span>
              </div>
            )}
          </section>
        )}
        {showSidebar && renderClasses()}
      </div>
      <ModulePresence present={Boolean(scene.classListOpen)}>
        {scene.classListOpen && <ClassChooser onClose={() => patchScene({ classListOpen: false })}>
          {renderClasses(() => patchScene({ classListOpen: false }))}
        </ClassChooser>}
      </ModulePresence>
      <ModulePresence present={Boolean(scene.creatingClass)}>
        {scene.creatingClass && <ClassCreateDialog accountKey={shell.accountKey} onCreated={handleClassCreated} onClose={() => patchScene({ creatingClass: false })} />}
      </ModulePresence>
    </div>
  );
}

export { SourceRecordsPanel, ClassRecordPicker } from './FeedbackPanel.jsx';
export { RecordComposer } from './RecordComposer.jsx';
