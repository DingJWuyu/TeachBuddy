/**
 * "找题" pane: search, filters, draft entry and a multi-select list.
 * Filters never clear the selection; each row shows recognition text, not a file name.
 */

import { Icon } from '../workbench/icons.jsx';
import { excerptFor, hasMath } from '../workbench/documents.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';

/** One row of 找题, shared by the module list and the in-lesson picker. */
export function QuestionRow({ item, selectedIndex = -1, inTarget = false, disabled = false, onOpen, onToggleSelect }) {
  const excerpt = excerptFor(item.title, item.body, 46) || '未命名题目';
  return (
    <li
      className="wb-list-row"
      data-question-id={item.id}
      data-deleted={item.deletedAt ? 'true' : 'false'}
      data-in-target={inTarget ? 'true' : 'false'}
    >
      <label className="wb-row-select">
        <input
          type="checkbox"
          checked={selectedIndex >= 0}
          disabled={disabled}
          onChange={onToggleSelect}
          aria-label={`选择 ${excerpt}`}
        />
        {selectedIndex >= 0 && (
          <span className="wb-select-index" data-select-index={selectedIndex + 1}>{selectedIndex + 1}</span>
        )}
      </label>
      <button type="button" className="wb-row-body" onClick={onOpen} data-row-open="">
        <span className="wb-row-excerpt">{excerpt}</span>
        <span className="wb-row-tags">
          {hasMath(item.body) && <span className="wb-tag">公式</span>}
          {item.starred && <span className="wb-tag is-star">标记</span>}
          {item.deletedAt && <span className="wb-tag is-deleted">已删除</span>}
          {inTarget && <span className="wb-tag" data-tag="in-target">已在此处</span>}
        </span>
      </button>
    </li>
  );
}

export function QuestionList({
  items,
  status,
  error,
  query,
  state,
  starred,
  drafts = [],
  selected = [],
  onQueryChange,
  onStateChange,
  onStarredChange,
  onToggleSelect,
  onOpen,
  onRetry,
  onOpenDraft,
  onScrollTop,
  scrollTop = 0,
  headerActions
}) {
  const scroll = useScrollRestore(scrollTop, onScrollTop, items.length);

  return (
    <section className="wb-list-pane" data-region="question-list" aria-label="找题">
      <header className="wb-list-head">
        <div className="wb-search">
          <Icon name="search" size={15} />
          <input
            className="wb-input"
            type="search"
            aria-label="搜索题目"
            placeholder="搜索标题、题面或笔记"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <div className="wb-filters" role="group" aria-label="题目过滤">
          <button
            type="button"
            className={`wb-chip${state === 'active' && !starred ? ' is-active' : ''}`}
            aria-pressed={state === 'active' && !starred}
            onClick={() => { onStateChange('active'); onStarredChange(false); }}
          >
            全部
          </button>
          <button
            type="button"
            className={`wb-chip${starred ? ' is-active' : ''}`}
            aria-pressed={starred}
            onClick={() => { onStateChange('active'); onStarredChange(!starred); }}
          >
            已标记
          </button>
          <button
            type="button"
            className={`wb-chip${state === 'deleted' ? ' is-active' : ''}`}
            aria-pressed={state === 'deleted'}
            onClick={() => { onStateChange(state === 'deleted' ? 'active' : 'deleted'); onStarredChange(false); }}
          >
            已删除
          </button>
        </div>
        <div className="wb-list-actions">{headerActions}</div>
      </header>

      <div
        className="wb-list-scroll"
        data-region="question-list-scroll"
        ref={scroll.ref}
        onScroll={scroll.onScroll}
      >
        {drafts.length > 0 && (
          <div className="wb-draft-list" data-region="drafts">
            <h3>继续草稿</h3>
            <ul>
              {drafts.map((draft) => (
                <li key={draft.id}>
                  <button type="button" className="wb-draft-row" onClick={() => onOpenDraft(draft)}>
                    <Icon name="copy" size={15} />
                    <span>{draft.label}</span>
                    <span className="wb-muted">草稿在此设备</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {status === 'loading' && <p className="wb-muted" data-region="list-loading">正在加载题目…</p>}
        {status === 'error' && (
          <div className="wb-inline-error" data-region="list-error">
            <p>{error?.message || '读取失败'}</p>
            <button type="button" className="wb-button" onClick={onRetry}>重试</button>
          </div>
        )}
        {status === 'ready' && items.length === 0 && (
          <p className="wb-empty-note" data-region="list-empty">
            {query || starred || state === 'deleted' ? '没有匹配的题目' : '题库为空，先自建或收录一道题'}
          </p>
        )}
        {items.length > 0 && (
          <ul className="wb-list" data-region="question-rows">
            {items.map((item) => (
              <QuestionRow
                key={item.id}
                item={item}
                selectedIndex={selected.indexOf(item.id)}
                onOpen={() => onOpen(item.id)}
                onToggleSelect={() => onToggleSelect(item.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
