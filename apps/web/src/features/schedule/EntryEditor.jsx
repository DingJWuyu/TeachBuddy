import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../components/ui/classNames.js';
import { tx, useLocale, monthDay, weekdayName } from '../../i18n/presentation.js';
import { Icon } from '../../components/icons.jsx';
import { useFlip } from '../../components/ui/motion.js';
import { Popover, shellRoot } from '../../components/ui/popover.jsx';
import { Menu } from '../../components/ui/menu.jsx';
import { DatePicker, TimePicker } from '../../components/ui/datetime.jsx';
import { ConfirmButton, ConfirmMenuItem, ConfirmDialog } from '../../components/ui/confirm.jsx';
import { CalendarOverlay, CalendarDialog, isConfirmKey } from './CalendarControls.jsx';
import { RepeatDialog, LabelDialog } from './ScheduleDialogs.jsx';
import { ReminderDialog, ConflictPreview, reminderLabel } from './CalendarDetails.jsx';
import { endOf, endTimeProblem, changeEnd, defaultTime, presetRepeat, repeatLabel, todayInZone } from './calendarModel.js';
import { dstAdjustment } from './model.js';

/*
 * The task sheet: one calm surface for new tasks, unscheduled notes and
 * editing either. Title first, a note under it, then “when” as an inset
 * list, labels as pills, and the checklist with its own quick-entry row.
 * Saving is automatic (the page autosaves the draft); 完成 closes it.
 * Repeat, reminder and label dialogs are the app's own.
 */

const PRIORITIES = [
  { id: 'high', label: '重要' },
  { id: 'normal', label: '普通' },
  { id: 'low', label: '稍后' },
];

export function G({ name, size = 16, stroke = 1.8 }) {
  return <Icon name={name} size={size} strokeWidth={stroke} />;
}

/* A textarea as tall as its text. It is measured again whenever its width
   changes: the sheet slides in from a narrow width, and text measured then
   would leave a tall empty box behind once the sheet has opened. */
function fit(el) { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }
function useAutoHeight(ref, value) {
  useLayoutEffect(() => fit(ref.current), [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== width) { width = el.clientWidth; fit(el); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
}

function dateLabel(date, today) {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((d - t) / 86400000);
  const md = monthDay(date);
  const name = diff === 0 ? tx('今天') : diff === 1 ? tx('明天') : diff === 2 ? tx('后天') : diff === -1 ? tx('昨天') : weekdayName(date);
  return `${name} · ${md}`;
}

/* A quiet pill that opens our own date or time picker in a popover. */
function Pill({ type, value, onChange, invalid, min, children, label, today }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return (
    <>
      <button type="button" ref={ref} className={cx('tbx-pill-input', invalid && 'is-invalid', open && 'is-open')} aria-label={label} aria-invalid={invalid || undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{children}</span>
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align="end" label={label}>
        {type === 'date'
          ? <DatePicker value={value} min={min || '1900-01-01'} max="2100-12-31" today={today} onChange={(v) => { onChange(v); setOpen(false); }} />
          : <TimePicker value={value} onChange={onChange} onDone={() => setOpen(false)} />}
      </Popover>
    </>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={cx('tbx-switch', on && 'is-on')} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

const REPEATS = [['none', '不重复'], ['daily', '每天'], ['weekdays', '每个工作日'], ['weekly', '每周'], ['biweekly', '每两周'], ['monthly', '每月（日期）']];

/* ---------- the checklist ---------- */
function Checklist({ items, onChange, repeating, onMove }) {
  const root = useRef(null);
  const focusId = useRef(null);
  const dragCleanup = useRef(null);
  useEffect(() => () => dragCleanup.current?.(), []);
  const [adding, setAdding] = useState('');
  const [drag, setDrag] = useState(null); // { id, x, y, dx, dy, index, line }
  const done = items.filter((i) => i.completed).length;
  // rows glide only after a reorder we started (same motion as the sidebar)
  const flipRef = useFlip(null);

  useLayoutEffect(() => {
    if (!focusId.current) return;
    const el = root.current?.querySelector(`[data-item="${focusId.current}"] input`);
    if (el) { el.focus(); const n = el.value.length; el.setSelectionRange(n, n); }
    focusId.current = null;
  });

  const commit = (next) => { flipRef.capture(); onChange(next); };
  const patch = (id, value) => onChange(items.map((x) => (x.id === id ? { ...x, ...value } : x)));
  const remove = (id) => commit(items.filter((x) => x.id !== id));
  const insertAfter = (id) => {
    const at = items.findIndex((x) => x.id === id);
    const fresh = { id: crypto.randomUUID(), text: '', priority: 'normal' };
    focusId.current = fresh.id;
    onChange([...items.slice(0, at + 1), fresh, ...items.slice(at + 1)]);
  };
  const commitAdd = () => {
    const text = adding.trim();
    if (!text || items.length >= 200) return;
    onChange([...items.filter((x) => x.text.trim()), { id: crypto.randomUUID(), text, priority: 'normal' }]);
    setAdding('');
  };

  /* Drag to reorder: nothing moves while dragging; a line shows where it lands. */
  function startDrag(e, id) {
    if (e.button !== 0) return;
    e.preventDefault();
    const list = root.current.querySelector('.tbx-list-rows');
    const rowEl = root.current.querySelector(`[data-item="${id}"]`);
    const r = rowEl.getBoundingClientRect();
    const rows = [...root.current.querySelectorAll('[data-item]')].map((el) => ({ id: el.dataset.item, top: el.offsetTop, h: el.offsetHeight }));
    const from = rows.findIndex((x) => x.id === id);
    const sx = e.clientX;
    const sy = e.clientY;
    let state = null;
    const move = (ev) => {
      if (!state && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      const listTop = list.getBoundingClientRect().top;
      const y = ev.clientY - listTop;
      let index = 0;
      for (const row of rows) if (y > row.top + row.h / 2) index += 1;
      const noop = index === from || index === from + 1;
      const line = noop ? null : index < rows.length ? rows[index].top - 1 : rows[rows.length - 1].top + rows[rows.length - 1].h + 1;
      state = { id, x: ev.clientX, y: ev.clientY, dx: Math.min(sx - r.left, 40), dy: sy - r.top, index, line };
      setDrag(state);
    };
    let cancelled = false;
    const cancel = (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelled = true; up(); } };
    const cleanup = () => {
      window.removeEventListener('keydown', cancel, true);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancelPointer);
      document.documentElement.classList.remove('tbx-dragging');
      dragCleanup.current = null;
    };
    const cancelPointer = () => { cancelled = true; up(); };
    const up = () => {
      cleanup();
      if (!cancelled && state && state.line != null) {
        const rest = items.filter((x) => x.id !== id);
        const at = state.index > from ? state.index - 1 : state.index;
        commit([...rest.slice(0, at), items[from], ...rest.slice(at)]);
      }
      setDrag(null);
    };
    dragCleanup.current = cleanup;
    document.documentElement.classList.add('tbx-dragging');
    window.addEventListener('keydown', cancel, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancelPointer);
  }
  const dragged = drag && items.find((x) => x.id === drag.id);

  return (
    <section className="tbx-list" ref={root}>
      <header className="tbx-list-head">
        <h3>{tx('事项')}</h3>
        {items.length > 0 && (
          <span className="tbx-list-count">
            <span className="tbx-list-bar"><i style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></span>
            {done}/{items.length}
          </span>
        )}
      </header>
      <div className="tbx-list-rows">
        {items.map((item, index) => {
          const pr = PRIORITIES.find((p) => p.id === item.priority && p.id !== 'normal');
          return (
            <div
              key={item.id}
              ref={flipRef(item.id)}
              data-item={item.id}
              className={cx('tbx-item', item.completed && 'is-done', drag?.id === item.id && 'is-origin')}
            >
              <button type="button" className="tbx-item-grip" aria-label={tx('拖动事项 {{value}}', { value: index + 1 })} onPointerDown={(e) => { e.currentTarget.focus(); startDrag(e, item.id); }} onKeyDown={event => {
                if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const next = index + (event.key === 'ArrowUp' ? -1 : 1);
                if (next < 0 || next >= items.length) return;
                const reordered = [...items];
                [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
                commit(reordered);
              }}><G name="grip" size={14} stroke={2.6} /></button>
              <button type="button" className="tbx-item-check" aria-pressed={Boolean(item.completed)} aria-label={item.completed ? tx('标为未完成') : tx('完成')} onClick={() => patch(item.id, { completed: !item.completed })}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9.5" /></svg>
              </button>
              <input
                className="tbx-item-text"
                value={item.text}
                maxLength={4000}
                placeholder={tx('写一件要做的事')}
                aria-label={tx('事项 {{n}}', { n: index + 1 })}
                onChange={(e) => patch(item.id, { text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (isConfirmKey(e)) { e.preventDefault(); if (item.text.trim() && items.length < 200) insertAfter(item.id); else e.currentTarget.blur(); }
                  if (e.key === 'Backspace' && !item.text) {
                    e.preventDefault();
                    const prev = items[items.findIndex((x) => x.id === item.id) - 1];
                    if (prev) focusId.current = prev.id;
                    onChange(items.filter((x) => x.id !== item.id));
                  }
                  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    const i = items.findIndex((x) => x.id === item.id);
                    const j = i + (e.key === 'ArrowUp' ? -1 : 1);
                    if (j < 0 || j >= items.length) return;
                    const next = [...items];
                    [next[i], next[j]] = [next[j], next[i]];
                    focusId.current = item.id;
                    commit(next);
                  }
                }}
                onBlur={(e) => { if (!e.currentTarget.value.trim() && !e.relatedTarget?.closest('.tbx-popover')) onChange(items.filter((x) => x.id !== item.id)); }}
              />
              <span className="tbx-item-tail">
                {pr && <span className={cx('tbx-prio', `is-${pr.id}`)}>{tx(pr.label)}</span>}
                <Menu label={tx('事项选项')} icon={<G name="more" size={16} stroke={2.6} />} buttonClassName="tbx-item-more" menuClassName="tbx-item-menu">
                  {({ close }) => <>
                    <div className="tbx-item-prio" role="radiogroup" aria-label={tx('优先级')}>
                      {PRIORITIES.map((p) => (
                        <button key={p.id} type="button" role="radio" aria-checked={(item.priority || 'normal') === p.id} className={cx(`is-${p.id}`, (item.priority || 'normal') === p.id && 'is-on')} onClick={() => { patch(item.id, { priority: p.id }); close(); }}>
                          {tx(p.label)}
                        </button>
                      ))}
                    </div>
                    {!repeating && onMove && item.text.trim() && (
                      <button type="button" role="menuitem" onClick={() => { close(); onMove(item.id); }}><G name="move" />{tx('移到其他安排…')}</button>
                    )}
                    <ConfirmMenuItem icon={<G name="trash" />} label={tx('删除事项')} onConfirm={() => { close(); remove(item.id); }} />
                  </>}
                </Menu>
              </span>
            </div>
          );
        })}
        {drag?.line != null && <div className="tbx-drop-line is-list" style={{ transform: `translateY(${drag.line}px)` }} aria-hidden="true" />}
        <div className="tbx-item is-add">
          <span className="tbx-item-grip" aria-hidden="true" />
          <span className="tbx-item-plus" aria-hidden="true"><G name="plus" size={13} stroke={2.4} /></span>
          <input
            className="tbx-item-text"
            value={adding}
            placeholder={items.length ? tx('添加事项') : tx('添加第一件要做的事')}
            aria-label={tx('添加事项')}
            disabled={items.length >= 200}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => { if (isConfirmKey(e)) { e.preventDefault(); commitAdd(); } }}
            onBlur={commitAdd}
          />
        </div>
      </div>
      {dragged && createPortal(
        <div className="tbx-drag-ghost is-item" style={{ transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px)` }} aria-hidden="true">
          <span className={cx('tbx-item-check', dragged.completed && 'is-done')} />
          <span>{dragged.text || tx('写一件要做的事')}</span>
        </div>, shellRoot()
      )}

    </section>
  );
}

/* ---------- labels as pills ---------- */
function Labels({ tags, labels, onChange, onLabels, accountKey }) {
  const [editing, setEditing] = useState(null);
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  return (
    <section className="tbx-labels" aria-label={tx('标签')}>
      {labels.map((l) => {
        const on = tags.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            className={cx('tbx-label', on && 'is-on')}
            style={{ '--c': l.color }}
            aria-pressed={on}
            disabled={!on && tags.length >= 30}
            onClick={() => onChange(on ? tags.filter((x) => x !== l.id) : [...tags, l.id])}
            onDoubleClick={() => setEditing({ ...l, clientId: crypto.randomUUID() })}
            title={`${l.name} · ${tx('双击编辑标签')}`}
          >
            <i /><span className="tbx-label-name">{l.name}</span>
          </button>
        );
      })}
      <button type="button" className="tbx-label is-new" onClick={() => setEditing({ clientId: crypto.randomUUID() })} disabled={tags.length >= 30}>
        <G name="plus" size={12} stroke={2.4} />{tx('新标签')}
      </button>
      <CalendarOverlay present={Boolean(editing)}>
        {editing && (
          <LabelDialog key={editing.clientId} label={editing.id ? editing : null} accountKey={accountKey} onClose={() => setEditing(null)} onSaved={(label, select) => {
            onLabels(label);
            if (select && tagsRef.current.length < 30 && !tagsRef.current.includes(label.id)) onChange([...tagsRef.current, label.id]);
          }} />
        )}
      </CalendarOverlay>
    </section>
  );
}

/* ---------- the sheet ---------- */
export function EntryEditor(props) {
  const { draft, onPatch, onClose, onConfirm, onDelete, onRemove, onMoveItem, locked, labels, onLabels, accountKey, status, onRetry, onReload, onAdoptServer, error } = props;
  useLocale();
  const content = draft.content;
  const titleRef = useRef(null);
  const notesRef = useRef(null);
  const sheetRef = useRef(null);
  const [dialog, setDialog] = useState(null);
  // the timed range a task had before "All day" was switched on, to give it back
  const beforeAllDay = useRef(null);

  useEffect(() => { if (!draft.id) titleRef.current?.focus({ preventScroll: true }); }, [draft.clientId]);
  useAutoHeight(titleRef, content.title);
  useAutoHeight(notesRef, content.calendar.notes);


  const time = content.time;
  const allDay = content.calendar.allDay;
  const end = time ? endOf(content) : null;
  const endIssue = endTimeProblem(content);
  const adjustment = time ? dstAdjustment(content) : null;
  const today = todayInZone(draft.zone);
  const patchCalendar = (v) => onPatch({ calendar: { ...content.calendar, ...v } });
  const patchTime = (v) => onPatch({ time: { ...time, ...v } });
  const setRepeat = (repeat, date = time.date) => { onPatch({ repeat, time: { ...time, date } }, true); setDialog(null); };
  const anchor = draft.forceSeries ? time?.date : draft.entry?.time?.date ?? time?.date;
  const kind = tx(time ? (draft.id ? '任务' : '新任务') : (draft.id ? '待安排' : '新的待安排'));
  const confirmKey = (e) => {
    if (!isConfirmKey(e)) return;
    e.preventDefault();
    e.currentTarget.blur();
    onConfirm();
  };
  const toggleAllDay = (on) => {
    const t = time ?? defaultTime(draft.zone);
    if (on) {
      if (!allDay) beforeAllDay.current = { startTime: t.startTime, durationMinutes: t.durationMinutes };
      onPatch({ calendar: { ...content.calendar, allDay: true }, time: { ...t, startTime: '00:00', durationMinutes: Math.max(1440, Math.ceil(t.durationMinutes / 1440) * 1440) } });
      return;
    }
    // an existing task gets its own times back; a new one starts again from 9:00–10:00
    const saved = beforeAllDay.current;
    const base = draft.id && draft.baseline?.time && !draft.baseline.calendar?.allDay ? draft.baseline.time : null;
    const back = draft.id ? saved || (base && { startTime: base.startTime, durationMinutes: base.durationMinutes }) : null;
    onPatch({ calendar: { ...content.calendar, allDay: false }, time: { ...t, startTime: back?.startTime ?? '09:00', durationMinutes: back?.durationMinutes ?? 60 } });
  };
  /* Closing on the task board folds the panel away to the right. The sheet
     itself unmounts at once, so a still copy of it rides the fold instead of
     the calendar column flashing through underneath. */
  const closingRef = useRef(false);
  const close = async () => {
    if (closingRef.current) return;
    const sheet = sheetRef.current;
    const side = sheet?.closest('.cal-sidebar');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onBoard = side && !reduced && sheet.closest('.cal-page')?.dataset.focus === 'tasks' && matchMedia('(min-width: 1081px)').matches;
    if (!onBoard) return onClose();

    closingRef.current = true;
    // Preserve a real-size still of the sheet while autosave finishes. Hiding
    // the live column from the first frame prevents overlap and snap-back.
    const r = side.getBoundingClientRect();
    const host = document.createElement('div');
    host.className = 'tbx-sheet-leaving';
    host.setAttribute('aria-hidden', 'true');
    host.inert = true;
    Object.assign(host.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const copy = sheet.cloneNode(true);
    copy.removeAttribute('data-region');
    copy.style.width = `${sheet.offsetWidth}px`;
    copy.style.animation = 'none'; // clones must never replay the entering animation
    const typed = sheet.querySelectorAll('textarea, input');
    copy.querySelectorAll('textarea, input').forEach((el, i) => { el.value = typed[i]?.value ?? ''; });
    host.appendChild(copy);
    (sheet.closest('.wb-shell') || document.body).appendChild(host);
    side.classList.add('is-leaving');
    try {
      await onClose();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      // A validation or save failure keeps the editor open; never animate
      // its departure or leave a hidden/phantom panel in that case.
      if (sheet.isConnected) return;
      const ease = 'cubic-bezier(0.22, 1, 0.36, 1)'; // shared --tb-ease
      const narrowing = host.animate(
        [{ width: `${r.width}px`, left: `${r.left}px` }, { width: '0px', left: `${r.right}px` }],
        { duration: 460, easing: ease, fill: 'forwards' }
      );
      const content = copy.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'translateX(28px)', opacity: 1, offset: 0.55 }, { transform: 'translateX(28px)', opacity: 0 }],
        { duration: 460, easing: ease, fill: 'forwards' }
      );
      await Promise.all([narrowing.finished.catch(() => {}), content.finished.catch(() => {})]);
    } finally {
      host.remove();
      side.classList.remove('is-leaving');
      closingRef.current = false;
    }
  };
  const repeating = Boolean(draft.id && draft.entry?.repeat);
  const disabled = Boolean(locked || draft.readOnly);
  const saving = status === 'running';

  return (
    <section ref={sheetRef} className={cx('tbx-sheet', time ? 'is-task' : 'is-inbox')} data-region="entry-editor">
      {error && error !== endIssue && (
        <div className="tbx-sheet-error" role="alert">
          <span>{error}</span>
          <span>
            {onReload && <button type="button" onClick={onReload}>{tx('读取最新版本')}</button>}
            <button type="button" onClick={onRetry} disabled={saving}>{status === 'unconfirmed' ? tx('重试确认') : tx('重新保存')}</button>
          </span>
        </div>
      )}
      <header className="tbx-sheet-head">
        <span className="tbx-sheet-kind"><G name={time ? 'calendar' : 'inbox'} size={14} />{kind}</span>
        <span className="tbx-sheet-actions">
          {/* a timed task (new or saved) can go to the inbox: decide the time later */}
          {time && !disabled && (
            <button type="button" className="tbx-sheet-icon has-text" title={tx('移回待安排')} aria-label={tx('移回待安排')} onClick={() => setDialog('unschedule')}>
              <G name="inbox" size={15} /><span className="tbx-sheet-btn-text">{tx('移回待安排')}</span>
            </button>
          )}
          {!disabled && (repeating ? (
            <button type="button" className="tbx-sheet-icon is-danger" aria-label={tx('删除')} title={tx('删除')} onClick={() => setDialog('delete')}>
              <G name="trash" size={16} />
            </button>
          ) : (
            <ConfirmButton
              className="tbx-sheet-delete"
              label={draft.id ? tx('删除') : tx('放弃')}
              confirmLabel={draft.id ? tx('确认删除') : tx('确认放弃')}
              onConfirm={() => (onRemove ? onRemove('series') : onDelete())}
            />
          ))}
          <button type="button" className="tbx-sheet-icon" aria-label={tx('关闭')} title={tx('关闭')} onClick={close}><G name="close" size={16} stroke={2.2} /></button>
        </span>
      </header>

      <fieldset className="tbx-sheet-body" disabled={disabled}>
        {disabled && <p className="tbx-sheet-hint" role="status">{draft.readOnly || tx('正在移动事项')}</p>}
        <textarea
          ref={titleRef}
          id="calendar-entry-title"
          aria-label={tx('标题')}
          className="tbx-sheet-title"
          rows={1}
          maxLength={300}
          placeholder={time ? tx('要做什么？') : tx('先记下来…')}
          value={content.title}
          onChange={(e) => onPatch({ title: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={confirmKey}
        />
        <textarea
          ref={notesRef}
          className="tbx-sheet-notes"
          rows={1}
          placeholder={tx('备注')}
          aria-label={tx('备注')}
          value={content.calendar.notes}
          onChange={(e) => patchCalendar({ notes: e.target.value })}
          onKeyDown={confirmKey}
        />

        {time ? (
          <div className="tbx-inset">
            <div className="tbx-row">
              <span className="tbx-row-icon is-red"><G name="calendar" size={15} /></span>
              <span className="tbx-row-label">{tx('日期')}</span>
              <span className="tbx-row-value">
                <Pill type="date" today={today} label={tx('开始日期')} value={time.date} onChange={(v) => patchTime({ date: v })}>{dateLabel(time.date, today)}</Pill>
              </span>
            </div>
            {(allDay || end.date !== time.date) && (
              <div className="tbx-row">
                <span className="tbx-row-icon is-clear" />
                <span className="tbx-row-label">{tx('结束')}</span>
                <span className="tbx-row-value">
                  <Pill type="date" today={today} label={tx('结束日期')} min={time.date} invalid={allDay && endIssue} value={end.date} onChange={(v) => onPatch({ time: changeEnd(content, v, end.time) })}>{dateLabel(end.date, today)}</Pill>
                </span>
              </div>
            )}
            {!allDay && (
              <div className="tbx-row">
                <span className="tbx-row-icon is-blue"><G name="clock" size={15} /></span>
                <span className="tbx-row-label">{tx('时间')}</span>
                <span className="tbx-row-value tbx-range">
                  <Pill type="time" label={tx('开始时间')} value={time.startTime} onChange={(v) => patchTime({ startTime: v })}>{time.startTime}</Pill>
                  <i>–</i>
                  <Pill type="time" label={tx('结束时间')} invalid={Boolean(endIssue)} value={end.time} onChange={(v) => onPatch({ time: changeEnd(content, end.date, v) })}>{end.time}</Pill>
                </span>
              </div>
            )}
            <div className="tbx-row">
              <span className="tbx-row-icon is-orange"><G name="sun" size={15} /></span>
              <span className="tbx-row-label">{tx('全天')}</span>
              <span className="tbx-row-value"><Toggle on={allDay} onChange={toggleAllDay} label={tx('全天')} /></span>
            </div>
            <Menu className="tbx-row is-button" buttonClassName="tbx-row-hit" label={tx('重复')} icon={<>
                <span className="tbx-row-icon is-gray"><G name="repeat" size={15} /></span>
                <span className="tbx-row-label">{tx('重复')}</span>
                <span className="tbx-row-value is-text">{content.repeat ? repeatLabel(content.repeat, anchor) : tx('不重复')}<G name="chevron" size={14} /></span>
              </>}>
              {({ close }) => <>
                {REPEATS.map(([id, label]) => {
                  const on = id === 'none' ? !content.repeat : Boolean(content.repeat) && repeatLabel(content.repeat, anchor) === repeatLabel(presetRepeat(id, time.date), anchor);
                  return (
                    <button key={id} type="button" role="menuitemradio" aria-checked={on} onClick={() => { close(); setRepeat(id === 'none' ? null : presetRepeat(id, time.date)); }}>
                      {tx(label)}{on && <span className="tbx-pop-check"><G name="check" size={14} /></span>}
                    </button>
                  );
                })}
                <div className="tbx-popover-sep" />
                <button type="button" role="menuitem" onClick={() => { close(); setDialog('repeat'); }}>{tx('自定义…')}</button>
              </>}
            </Menu>
            <div className="tbx-row is-button">
              <button type="button" className="tbx-row-hit" onClick={() => setDialog('reminder')}>
                <span className="tbx-row-icon is-purple"><G name="bell" size={15} /></span>
                <span className="tbx-row-label">{tx('提醒')}</span>
                <span className="tbx-row-value is-text">{content.reminder ? reminderLabel(content.reminder) : tx('无')}<G name="chevron" size={14} /></span>
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="tbx-when-add" onClick={() => onPatch({ time: defaultTime(draft.zone), calendar: { ...content.calendar, allDay: false } })}>
            <span className="tbx-row-icon is-red"><G name="calendar" size={15} /></span>
            <span><strong>{tx('放进日历，变成任务')}</strong></span>
            <G name="chevron" size={14} />
          </button>
        )}
        {endIssue && <p className="tbx-sheet-hint is-error" role="alert">{tx('结束时间要晚于开始时间。')}</p>}
        {adjustment && <p className="tbx-sheet-hint">{tx('夏令时跳时，这次实际开始于 {{date}} {{time}}（{{zone}}）。', { date: adjustment.date, time: adjustment.startTime, zone: adjustment.timeZone })}</p>}
        {time && time.timeZone !== draft.zone && <p className="tbx-sheet-hint">{tx('排课时区：{{zone}}', { zone: time.timeZone })}</p>}

        <Labels tags={content.calendar.tags} labels={labels} onChange={(tags) => patchCalendar({ tags })} onLabels={onLabels} accountKey={accountKey} />

        <Checklist
          items={content.items}
          repeating={Boolean(content.repeat)}
          onChange={(items) => onPatch({ items })}
          onMove={draft.id || content.title.trim() ? onMoveItem : null}
        />
        {draft.savePaused && <ConflictPreview content={draft.baseline} labels={labels} onAdopt={() => setDialog('adopt')} />}
      </fieldset>

      <footer className="tbx-sheet-foot">
        <span className={cx('tbx-sheet-status', saving && 'is-saving')}>
          {tx(saving ? '正在保存…' : draft.id ? '自动保存' : content.title.trim() ? '马上保存' : '写下标题就会保存')}
        </span>
        <button type="button" className="tbx-sheet-done" onClick={close}>{tx('完成')}</button>
      </footer>

      {/* only the app's own dialogs sit in its overlay; our confirm dialogs carry their own scrim */}
      <CalendarOverlay present={['repeat', 'reminder', 'adopt'].includes(dialog)}>
        {dialog === 'repeat' && <RepeatDialog value={content.repeat} date={time.date} anchor={anchor} onSave={setRepeat} onClose={() => setDialog(null)} />}
        {dialog === 'reminder' && <ReminderDialog value={content.reminder} onClose={() => setDialog(null)} onSave={(reminder) => { onPatch({ reminder }); setDialog(null); }} />}
        {dialog === 'adopt' && (
          <CalendarDialog title={tx('采用服务器内容')} onClose={() => setDialog(null)}>
            <p>{tx('用服务器内容替换当前本地输入？未保存的本地修改将被丢弃。')}</p>
            <footer>
              <button onClick={() => setDialog(null)}>{tx('取消')}</button>
              <button className="is-primary" data-dialog-confirm="" onClick={() => { onAdoptServer(); setDialog(null); }}>{tx('采用')}</button>
            </footer>
          </CalendarDialog>
        )}
      </CalendarOverlay>
      {dialog === 'unschedule' && (
        <ConfirmDialog
          enterConfirms
          danger={false}
          icon="inbox"
          title={tx('移回待安排？')}
          message={tx('会去掉这件事的时间和提醒，它会回到“待安排”。')}
          confirmLabel={tx('移回待安排')}
          onCancel={() => setDialog(null)}
          onConfirm={() => { onPatch({ time: null, repeat: null, reminder: null, calendar: { ...content.calendar, allDay: false } }); setDialog(null); }}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          enterConfirms
          title={tx('删除重复的任务？')}
          message={tx('可以只删掉这一次，也可以把整组重复的任务一起删掉。')}
          confirmLabel={tx('只删这一次')}
          secondaryLabel={tx('删除全部')}
          onSecondary={() => { setDialog(null); onRemove ? onRemove('series') : onDelete(); }}
          onCancel={() => setDialog(null)}
          onConfirm={() => { setDialog(null); onRemove ? onRemove('instance') : onDelete(); }}
        />
      )}
    </section>
  );
}
