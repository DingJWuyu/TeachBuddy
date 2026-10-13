import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'classes', ...options });
/** Active teaching records linked to a question or math work. */
import { useEffect, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { navigate } from '../workbench/routes.js';
import { Icon } from '../workbench/icons.jsx';
import { listClasses, listSourceRecords } from './api.js';
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

function SourceRecordsContent({ kind, id, generation, onOpenRecord, emptyText = t("还没有班级记录关联这份资料") }) {
  const { t } = useTranslation('classes');
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
        setError(problem.problem || { message: t("无法读取反馈") });
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
      <button type="button" className="wb-button" onClick={() => setReloadToken(token => token + 1)} disabled={status === 'loading'}>{t("刷新反馈")}</button>
      {status === 'loading' && <p className="wb-muted">{t("正在加载反馈…")}</p>}
      {status === 'error' && (
        <div className="wb-inline-error" data-region="source-records-error">
          <span>{records.length ? t("未能更新反馈") : (error?.message || t("未能加载反馈"))}</span>
          <button type="button" className="wb-button" onClick={() => setReloadToken((token) => token + 1)}>{t("重试")}</button>
        </div>
      )}
      {status === 'ready' && records.length === 0 && <p className="wb-empty-note">{emptyText}</p>}
      {records.length > 0 && namesFailed && (
        <p className="wb-muted c-feedback-warning" data-region="class-names-error">{t("班级名称暂不可用")}</p>
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
                <span className="c-feedback-class">{names.get(record.classId) || t("班级")}</span>
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
