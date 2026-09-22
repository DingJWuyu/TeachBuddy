/**
 * Material links for a class record: the saved-link chips and the picker.
 *
 * Selecting a source only prepares the link; nothing is written until the
 * record itself is saved, so cancelling the picker never changes stored data.
 * Deleted sources stay visible (a saved link must remain recognizable) but
 * cannot be added again.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { navigate } from '../workbench/routes.js';
import { readLocal, writeLocal } from '../workbench/storage.js';
import { listTeachingWorks } from './api.js';
import { listLessons } from '../lessons/api.js';
import { listQuestions } from '../questions/api.js';
import { sourceFallbackLabel, sourceHistoryHint, sourceKindLabel, sourceLabel, sourcePath } from './model.js';

export function SourceChips({ sources, onRemove, onPick, disabled = false }) {
  return (
    <div className="c-sources" data-region="record-sources">
      {sources.length === 0 && <span className="wb-muted">未关联资料</span>}
      {sources.map((source) => {
        const hint = sourceHistoryHint(source);
        const label = sourceLabel(source);
        return (
          <span
            key={`${source.kind}:${source.id}`}
            className={`c-source-chip${source.deleted ? ' is-deleted' : ''}`}
            data-source-id={source.id}
            data-source-kind={source.kind}
            data-source-state={source.deleted ? 'deleted' : 'active'}
          >
            <span className="c-source-kind">{sourceKindLabel(source.kind)}</span>
            <button
              type="button"
              className="c-source-open"
              name="open-source"
              title={`打开${sourceKindLabel(source.kind)}`}
              onClick={() => navigate(sourcePath(source.kind, source.id))}
            >
              {label}
            </button>
            {source.deleted && <span className="wb-tag is-deleted">已删除</span>}
            {hint && <span className="c-source-hint">{hint}</span>}
            {onRemove && (
              <button
                type="button"
                className="c-chip-remove"
                aria-label={`移除${sourceKindLabel(source.kind)}关联`}
                disabled={disabled}
                onClick={() => onRemove(source)}
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </span>
        );
      })}
      {onPick && (
        <button type="button" className="wb-button c-pick-button" name="pick-sources" onClick={onPick}>
          <Icon name="plus" size={13} />
          关联资料
        </button>
      )}
    </div>
  );
}

export function SourcePicker({ accountKey, value, onCancel, onConfirm }) {
  const [kind, setKind] = useState(() => readLocal(accountKey, 'scene:class-source-picker')?.kind ?? 'lesson');
  const [query, setQuery] = useState(() => readLocal(accountKey, 'scene:class-source-picker')?.query ?? '');
  const [workKind, setWorkKind] = useState(() => readLocal(accountKey, 'scene:class-source-picker')?.workKind ?? '');
  const [retry, setRetry] = useState(0);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => value.map((source) => ({
    ...source,
    label: sourceLabel(source),
    deleted: Boolean(source.deleted)
  })));
  const searchRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    writeLocal(accountKey, 'scene:class-source-picker', {kind, query, workKind});
  }, [accountKey, kind, query, workKind]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setItems([]);
    setError(null);
    const loader = kind === 'math' ? listTeachingWorks({ q: query, kind: workKind }) : kind === 'lesson' ? listLessons({ q: query, state: 'active' }) : listQuestions({ q: query, state: 'active' });
    loader
      .then((rows) => {
        if (!cancelled) {
          setItems(rows);
          setStatus('ready');
        }
      })
      .catch((problem) => {
        if (!cancelled) {
          setError(problem.problem || { message: '无法加载资料' });
          setStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [kind, query, workKind, retry]);

  useEffect(() => {
    const opener = document.activeElement;
    searchRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input, select')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [onCancel]);

  const selectedKeys = new Set(selected.map((source) => `${source.kind}:${source.id}`));

  function toggle(item) {
    const key = `${kind}:${item.id}`;
    setSelected((current) => (current.some((source) => `${source.kind}:${source.id}` === key)
      ? current.filter((source) => `${source.kind}:${source.id}` !== key)
      : [...current, { kind, id: item.id, label: item.title || sourceFallbackLabel(kind), deleted: false }]));
  }

  return (
    <div className="wb-dialog-host" data-overlay="dialog">
      <div className="wb-dialog-scrim" onClick={onCancel} role="presentation" />
      <div ref={dialogRef} className="wb-dialog c-source-picker" role="dialog" aria-modal="true" aria-label="关联资料" data-region="source-picker">
        <div className="wb-dialog-head">
          <h2>关联资料</h2>
          <button type="button" className="wb-icon-button" aria-label="关闭" onClick={onCancel}>
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="c-picker-tabs" role="tablist" aria-label="资料类型">
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'lesson'}
            className={`wb-chip${kind === 'lesson' ? ' is-active' : ''}`}
            name="picker-kind-lesson"
            onClick={() => setKind('lesson')}
          >
            备课
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'question'}
            className={`wb-chip${kind === 'question' ? ' is-active' : ''}`}
            name="picker-kind-question"
            onClick={() => setKind('question')}
          >
            题目
          </button>
          <button type="button" role="tab" aria-selected={kind === 'math'}
            className={`wb-chip${kind === 'math' ? ' is-active' : ''}`}
            name="picker-kind-math" onClick={() => setKind('math')}>数学作品</button>
        </div>
        <div className="wb-search c-picker-search">
          <Icon name="search" size={15} />
          <input
            ref={searchRef}
            className="wb-input"
            type="search"
            maxLength={200}
            aria-label="搜索资料"
            placeholder={kind === 'math' ? '搜索作品' : kind === 'lesson' ? '搜索备课' : '搜索题目'}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {kind === 'math' && <label className="wb-field c-picker-filter">
          <span className="wb-label">作品类型</span>
          <select className="wb-input" aria-label="作品类型" value={workKind} onChange={event => setWorkKind(event.target.value)}>
            <option value="">全部类型</option>
            <option value="formula">公式</option><option value="plane">平面</option>
            <option value="space">立体</option><option value="dynamic">动态</option><option value="html">HTML</option>
          </select>
        </label>}
        <div className="c-picker-body" data-region="source-picker-rows">
          {status === 'loading' && <p className="wb-muted">正在加载…</p>}
          {status === 'error' && <p className="wb-inline-error">{kind === 'math' ? '未能加载作品' : error?.message}<button type="button" className="wb-button" onClick={() => setRetry(token => token + 1)}>重试</button></p>}
          {status === 'ready' && items.length === 0 && <p className="wb-empty-note">{kind === 'math' ? '暂无作品' : '没有可选资料'}</p>}
          {items.map((item) => {
            const active = selectedKeys.has(`${kind}:${item.id}`);
            return (
              <button
                key={item.id}
                type="button"
                className={`c-picker-row${active ? ' is-selected' : ''}`}
                data-source-id={item.id}
                aria-pressed={active}
                onClick={() => toggle(item)}
              >
                <span className="c-picker-check" aria-hidden="true">{active ? <Icon name="check" size={13} /> : null}</span>
                <span className="c-picker-title">{item.title || sourceFallbackLabel(kind)}</span>
                <span className="wb-muted">版本 {item.version}</span>
              </button>
            );
          })}
        </div>
        <div className="wb-dialog-actions">
          <button type="button" className="wb-button" name="picker-cancel" onClick={onCancel}>取消</button>
          <button type="button" className="wb-button is-primary" name="picker-confirm" onClick={() => onConfirm(selected)}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
