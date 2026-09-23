/**
 * Classes module page: /classes, /classes/:classId and
 * /classes/:classId/records/:recordId.
 *
 * The page owns its two panes and their data; the shell only passes the current
 * route (when it has parsed one) and the account identity. Reverse feedback and
 * the class/record selector are exported from here for the lessons, questions
 * and schedule pages to assemble.
 */
import { useCallback, useEffect, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { useForegroundRefresh } from '../workbench/useForegroundRefresh.js';
import { navigate } from '../workbench/routes.js';
import { Icon } from '../workbench/icons.jsx';
import { listClasses, listRecords } from './api.js';
import { DEFAULT_TIME_ZONE } from './model.js';
import { ClassList } from './ClassList.jsx';
import { ClassDetail } from './ClassDetail.jsx';
import './classes.css';

const NAVIGATION_EVENT = 'tb:navigate';
const EMPTY_ROUTE = Object.freeze({ name: 'classes', classId: null, recordId: null });

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
    navigate(`/classes/${classroom.id}`);
  }, [refreshClasses]);
  const handleClassChanged = useCallback(() => {
    refreshClasses();
  }, [refreshClasses]);
  const openRecord = useCallback((recordId) => {
    if (selectedId) navigate(`/classes/${selectedId}/records/${recordId}`);
  }, [selectedId]);
  const closeRecord = useCallback(() => {
    if (selectedId) navigate(`/classes/${selectedId}`);
  }, [selectedId]);
  const narrow = Boolean(shell.narrow);
  const view = narrow ? (selected ? 'detail' : 'list') : 'detail';
  const listItems = scene.listState === 'deleted' ? (classes.deleted ?? []) : (classes.active ?? []);

  return (
    <div className="wb-page c-classes" data-region="classes-index">
      <div className="wb-split" data-view={view}>
        <ClassList
          accountKey={shell.accountKey}
          items={listItems}
          status={classesStatus}
          error={classesError}
          listState={scene.listState}
          onListStateChange={(listState) => patchScene({ listState })}
          selectedId={selectedId}
          onSelect={(classId) => navigate(`/classes/${classId}`)}
          onCreated={handleClassCreated}
          onReload={refreshClasses}
          scrollTop={scene.listScrollTop}
          onScrollTop={(listScrollTop) => patchScene({ listScrollTop })}
        />

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
            onBack={narrow ? () => navigate('/classes') : null}
            detailScrollTop={scene.detailScroll?.classId === selected.id ? scene.detailScroll.top : 0}
            onDetailScrollTop={(top) => patchScene({ detailScroll: { classId: selected.id, top } })}
          />
        ) : (
          <section className="wb-content-pane c-class-placeholder" data-region="class-placeholder">
            {classesStatus === 'loading' && <p className="wb-muted">正在加载班级…</p>}
            {classesStatus === 'ready' && selectedId && (
              <div className="c-placeholder-inner">
                <p>未找到这个班级</p>
                <button type="button" className="wb-button" name="back-to-classes" onClick={() => navigate('/classes')}>
                  <Icon name="back" size={14} />
                  返回班级列表
                </button>
              </div>
            )}
            {classesStatus === 'ready' && !selectedId && (
              <div className="c-placeholder-inner" data-region="class-placeholder-empty">
                <p className="wb-muted">选择左侧班级查看实际记录，或新建一个班级</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export { SourceRecordsPanel, ClassRecordPicker } from './FeedbackPanel.jsx';
export { RecordComposer } from './RecordComposer.jsx';
