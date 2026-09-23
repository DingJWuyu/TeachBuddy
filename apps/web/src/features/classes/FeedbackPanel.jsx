/**
 * Reverse feedback and the class/record selector, exported for the lessons,
 * questions and schedule pages (T53 assembles them).
 *
 * The panel answers "which classes actually used this material": active records
 * in active classes, ordered like the class record list, each one opening the
 * same record the class page owns. The selector is the schedule's course link:
 * a deleted class has no selectable records, and changing the class clears the
 * chosen records so an entry can never point at another class's record.
 */
import { useEffect, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { navigate } from '../workbench/routes.js';
import { Icon } from '../workbench/icons.jsx';
import { listClasses, listRecords, listSourceRecords } from './api.js';
import { formatRecordedOn, recordExcerpt } from './model.js';

/** Active class names; reverse feedback only ever returns active classes. */
function useClassNames() {
  const [state, setState] = useState(() => ({ names: new Map(), failed: false }));

  useEffect(() => {
    let cancelled = false;
    listClasses({ state: 'active' })
      .then((items) => {
        if (!cancelled) setState({ names: new Map(items.map((item) => [item.id, item.name])), failed: false });
      })
      .catch(() => {
        // The records stay readable; only the class names are missing, and that
        // is reported instead of silently showing a placeholder.
        if (!cancelled) setState((current) => ({ ...current, failed: true }));
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}

export function SourceRecordsPanel(props) {
  const shell = useWorkbenchShell();
  return <SourceRecordsContent key={`${shell.accountKey}:${props.kind}:${props.id}`} {...props} generation={shell.generation} />;
}

function SourceRecordsContent({ kind, id, generation, onOpenRecord, emptyText = '还没有班级记录关联这份资料' }) {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const { names, failed: namesFailed } = useClassNames();

  useEffect(() => {
    let cancelled = false;
    if (!kind || !id) return undefined;
    setStatus('loading');
    listSourceRecords(kind, id)
      .then((items) => {
        if (cancelled) return;
        setRecords(items);
        setStatus('ready');
      })
      .catch((problem) => {
        if (cancelled) return;
        setError(problem.problem || { message: '无法读取反馈' });
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [kind, id, generation, reloadToken]);

  function openRecord(record) {
    if (onOpenRecord) return onOpenRecord(record);
    navigate(`/classes/${record.classId}/records/${record.id}`);
  }

  return (
    <div className="c-feedback" data-region="source-records-panel" data-source-kind={kind} data-source-id={id}>
      <button type="button" className="wb-button" onClick={() => setReloadToken(token => token + 1)} disabled={status === 'loading'}>刷新反馈</button>
      {status === 'loading' && <p className="wb-muted">正在加载反馈…</p>}
      {status === 'error' && (
        <div className="wb-inline-error" data-region="source-records-error">
          <span>{records.length ? '未能更新反馈' : (error?.message || '未能加载反馈')}</span>
          <button type="button" className="wb-button" onClick={() => setReloadToken((token) => token + 1)}>重试</button>
        </div>
      )}
      {status === 'ready' && records.length === 0 && <p className="wb-empty-note">{emptyText}</p>}
      {records.length > 0 && namesFailed && (
        <p className="wb-muted c-feedback-warning" data-region="class-names-error">班级名称暂不可用</p>
      )}
      {records.length > 0 && (
        <ul className="c-feedback-list" data-region="source-record-rows">
          {records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                className="c-feedback-row"
                data-source-record-id={record.id}
                data-class-id={record.classId}
                onClick={() => openRecord(record)}
              >
                <span className="c-feedback-class">{names.get(record.classId) || '班级'}</span>
                <span className="wb-muted">{formatRecordedOn(record.recordedOn)}</span>
                <span className="c-feedback-text">{recordExcerpt(record)}</span>
                <Icon name="chevron" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClassRecordPicker({ classId, recordIds = [], onChange, disabled = false }) {
  const [classes, setClasses] = useState([]);
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    listClasses({ state: 'active' })
      .then((items) => {
        if (cancelled) return;
        setClasses(items);
        setStatus('ready');
      })
      .catch((problem) => {
        if (cancelled) return;
        setError(problem.problem || { message: '无法加载班级' });
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!classId) {
      setRecords([]);
      return undefined;
    }
    listRecords({ classId, state: 'active' })
      .then((items) => {
        if (!cancelled) setRecords(items);
      })
      .catch((problem) => {
        if (!cancelled) setError(problem.problem || { message: '无法加载记录' });
      });
    return () => { cancelled = true; };
  }, [classId]);

  function toggleRecord(record) {
    const next = recordIds.includes(record.id)
      ? recordIds.filter((id) => id !== record.id)
      : [...recordIds, record.id];
    onChange({ classId, recordIds: next });
  }

  return (
    <div className="c-record-picker" data-region="class-record-picker">
      <label className="wb-field">
        <span className="wb-label">班级</span>
        <select
          className="wb-input"
          aria-label="选择班级"
          value={classId ?? ''}
          disabled={disabled}
          onChange={(event) => onChange({ classId: event.target.value || null, recordIds: [] })}
        >
          <option value="">不关联班级</option>
          {classes.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
          ))}
        </select>
      </label>
      {status === 'error' && <p className="wb-inline-error">{error?.message}</p>}
      {classId && (
        <div className="c-record-picker-list" data-region="class-record-options">
          {records.length === 0 && <p className="wb-muted">该班还没有实际记录</p>}
          {records.map((record) => (
            <label className="c-record-option" key={record.id} data-record-id={record.id}>
              <input
                type="checkbox"
                checked={recordIds.includes(record.id)}
                disabled={disabled}
                onChange={() => toggleRecord(record)}
              />
              <span className="wb-muted">{formatRecordedOn(record.recordedOn)}</span>
              <span>{recordExcerpt(record)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
