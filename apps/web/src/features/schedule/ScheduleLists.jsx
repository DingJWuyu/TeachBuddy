/**
 * Unscheduled list and the global priority view.
 *
 * The priority view is a frontend composition of every unscheduled item and
 * every instance the current range returned; it never re-ranks the segment
 * order. Each unscheduled item can be moved into an existing non-repeating
 * segment through the atomic moveItem operation.
 */
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { useEffect, useState } from 'react';
import { listEntries } from './api.js';
import {
  PRIORITY_LABEL,
  PRIORITY_VALUES,
  buildPriorityRows,
  formatInstantLabel,
  groupPriorityRows,
  titleOf
} from './model.js';

function MoveRow({ entry, item, targets, onMove, onOpen, moveState }) {
  const [target, setTarget] = useState('');
  const options = targets.filter((candidate) => candidate.id !== entry.id);
  return (
    <li className="sch-unscheduled-item" data-item-id={item.id}>
      <button type="button" className="sch-item-text sch-unscheduled-title" onClick={() => onOpen(entry.id)}>{item.text}</button>
      <span className="wb-tag" data-priority={item.priority}>{PRIORITY_LABEL[item.priority]}</span>
      <span className="sch-item-actions">
        <select
          className="wb-input sch-move-target"
          name="move-target"
          aria-label="移入时间段"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="">移入…</option>
          {options.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {`${candidate.time.date} ${candidate.time.startTime} ${titleOf(candidate)}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="wb-button"
          data-action="move-item"
          disabled={!target}
          onClick={() => onMove({ entry, item, toEntryId: target })}
        >
          移入
        </button>
      </span>
      {moveState?.itemId === item.id && (
        <span className="sch-move-state" data-region="move-state">
          {moveState.status === 'unconfirmed' ? '移动结果未确认' : moveState.message}
        </span>
      )}
    </li>
  );
}

function DeletedEntries({ open, onToggle, onOpen, refreshToken }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listEntries({ state: 'deleted' }).then(rows => {
      if (!cancelled) { setItems(rows); setError(null); }
    }).catch(problem => {
      if (!cancelled) setError(problem.message || '无法读取已删除安排');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, refreshToken, retry]);
  return <section className="sch-list sch-deleted-list" data-region="deleted-entries">
    <button type="button" className="sch-list-head" aria-expanded={Boolean(open)} onClick={onToggle}>
      <span>已删除安排</span><span aria-hidden="true">{open ? '▾' : '▸'}</span>
    </button>
    <ModulePresence present={open} mode="collapse">
    {open && <>
      {loading && <p className="wb-muted">正在读取…</p>}
      {error && <p role="alert">{error}<button className="wb-button" onClick={() => setRetry(value => value + 1)}>重试</button></p>}
      {!loading && !error && items.length === 0 && <p className="wb-empty-note">没有已删除安排</p>}
      <ul className="sch-unscheduled">{items.map(entry => <li key={entry.id}>
        <button type="button" className="sch-unscheduled-title" onClick={() => onOpen(entry.id)}>{titleOf(entry)}</button>
      </li>)}</ul>
    </>}
    </ModulePresence>
  </section>;
}

export default function ScheduleLists({
  regionRef,
  onScroll,
  unscheduled,
  occurrences,
  open,
  onToggle,
  onOpenEntry,
  onMove,
  moveState,
  timeZone,
  refreshToken
}) {
  const rows = buildPriorityRows(occurrences, unscheduled);
  const groups = groupPriorityRows(rows);
  const targets = occurrences
    .filter((occurrence) => occurrence.key.originDate === null)
    .map((occurrence) => ({
      id: occurrence.key.entryId,
      title: occurrence.title,
      time: occurrence.time
    }));

  return (
    <div className="sch-lists" ref={regionRef} onScroll={onScroll}>
      {moveState?.direction === 'in' && moveState.status === 'unconfirmed' && <div className="sch-save is-warn sch-pending-move" data-region="pending-move">
        <span>移入时间段的结果未确认</span>
        <button type="button" className="wb-button" onClick={() => onMove(moveState.request, true)}>重试移入时间段</button>
      </div>}
      <section className="sch-list" data-region="unscheduled">
        <button
          type="button"
          className="sch-list-head"
          aria-expanded={Boolean(open.unscheduled)}
          onClick={() => onToggle('unscheduled')}
        >
          <span>未排期 {unscheduled.length}</span>
          <span className="sch-caret" aria-hidden="true">{open.unscheduled ? '▾' : '▸'}</span>
        </button>
        <ModulePresence present={open.unscheduled} mode="collapse">
        {open.unscheduled && (
          unscheduled.length === 0
            ? <p className="wb-empty-note" data-region="unscheduled-empty">没有未排期事项</p>
            : (
              <ul className="sch-unscheduled">
                {unscheduled.map((entry) => (
                  <li key={entry.id} className="sch-unscheduled-entry" data-entry-id={entry.id}>
                    {entry.title.trim() !== '' && (
                      <button type="button" className="sch-unscheduled-title" onClick={() => onOpenEntry(entry.id)}>
                        {entry.title}
                      </button>
                    )}
                    <ul>
                      {entry.items.map((item) => (
                        <MoveRow
                          key={item.id}
                          entry={entry}
                          item={item}
                          targets={targets}
                          onMove={onMove}
                          onOpen={onOpenEntry}
                          moveState={moveState}
                        />
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )
        )}
        </ModulePresence>
      </section>

      <section className="sch-list" data-region="priority">
        <button
          type="button"
          className="sch-list-head"
          aria-expanded={Boolean(open.priority)}
          onClick={() => onToggle('priority')}
        >
          <span>优先事项 {rows.length}</span>
          <span className="sch-caret" aria-hidden="true">{open.priority ? '▾' : '▸'}</span>
        </button>
        <ModulePresence present={open.priority} mode="collapse">
        {open.priority && (
          rows.length === 0
            ? <p className="wb-empty-note" data-region="priority-empty">范围内还没有事项</p>
            : (
              <ol className="sch-priority" data-region="priority-rows">
                {PRIORITY_VALUES.map((priority) => (
                  groups[priority].length > 0 && (
                    <li key={priority} className="sch-priority-group">
                      <span className="sch-priority-label">{PRIORITY_LABEL[priority]}</span>
                      <ul>
                        {groups[priority].map((row) => (
                          <li key={`${row.entryId}:${row.originDate ?? 'single'}:${row.itemId}`}>
                            <button
                              type="button"
                              className="sch-priority-row"
                              data-priority={priority}
                              data-kind={row.kind}
                              onClick={() => onOpenEntry(row.entryId, row.originDate)}
                            >
                              <span className="sch-priority-text">{row.item.text}</span>
                              <span className="wb-muted">
                                {row.kind === 'unscheduled'
                                  ? '未排期'
                                  : formatInstantLabel(row.sortStart ? new Date(row.sortStart).toISOString() : '', timeZone)}
                              </span>
                              <span className="wb-muted">{row.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                ))}
              </ol>
            )
        )}
        </ModulePresence>
      </section>
      <DeletedEntries open={open.deleted} onToggle={() => onToggle('deleted')}
        onOpen={onOpenEntry} refreshToken={refreshToken} />
    </div>
  );
}
