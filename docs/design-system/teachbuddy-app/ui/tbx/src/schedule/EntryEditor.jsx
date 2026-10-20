import { h, Fragment } from '../shim.js';
import { tb, useEffect, useLayoutEffect, useRef, useState, cx, tx, useLocale, isEnglish, monthDay, weekdayName } from '../react.js';
import { useFlip } from '../kit/motion.js';
import { Popover } from '../kit/popover.jsx';
import { DatePicker, TimePicker } from '../kit/datetime.jsx';
import { ConfirmButton, ConfirmMenuItem, ConfirmDialog } from '../kit/confirm.jsx';

/*
 * The task sheet: one calm surface for new tasks, unscheduled notes and
 * editing either. Title first, a note under it, then “when” as an inset
 * list, labels as pills, and the checklist with its own quick-entry row.
 * Saving is automatic (the page autosaves the draft); 完成 closes it.
 * Repeat, reminder and label dialogs are the app's own.
 */

export const PRIORITIES = [
  { id: 'high', label: '重要' },
  { id: 'normal', label: '普通' },
  { id: 'low', label: '稍后' },
];

const PATH = {
  close: 'm7 7 10 10M17 7 7 17',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  calendar: 'M6.5 5h11a3 3 0 0 1 3 3v9.5a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3ZM3.5 10h17M8 3v4M16 3v4',
  clock: 'M12 20.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17ZM12 7.5V12l3 2',
  sun: 'M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1.1 1.1M17.3 17.3l1.1 1.1M5.6 18.4l1.1-1.1M17.3 6.7l1.1-1.1',
  repeat: 'M4.5 11V9.5a3 3 0 0 1 3-3h11M15.5 3.5l3 3-3 3M19.5 13v1.5a3 3 0 0 1-3 3h-11M8.5 20.5l-3-3 3-3',
  bell: 'M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.6 1.7H4.9zM10 20.4a2.3 2.3 0 0 0 4 0',
  chevron: 'm10 7.5 4.5 4.5-4.5 4.5',
  plus: 'M12 5.5v13M5.5 12h13',
  inbox: 'M3.5 13.5 6 5.5h12l2.5 8M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5M3.5 13.5h5l1 2h5l1-2h5',
  flag: 'M5.5 20.5v-16M5.5 4.5h11l-2 4 2 4h-11',
  grip: 'M9.5 7h.01M14.5 7h.01M9.5 12h.01M14.5 12h.01M9.5 17h.01M14.5 17h.01',
  // trash, calendar, bell, more, grip and pencil come from the shared set (shell/glyphs.jsx)
  move: 'M14 4.5h5.5V10M19.5 4.5 11 13M17 13.5v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4',
  check: 'm5.5 12.5 4 4 9-9.5',
  tag: 'M3.5 12.6V5a1.5 1.5 0 0 1 1.5-1.5h7.6l8 8a1.5 1.5 0 0 1 0 2.1l-7.5 7.5a1.5 1.5 0 0 1-2.1 0zM8 8h.01',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
};
export function G({ name, size = 16, stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {globalThis.__tbx?.glyphs?.[name] ?? <path d={PATH[name]} />}
    </svg>
  );
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

function useOutside(open, ref, close) {
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!ref.current?.contains(e.target)) close(); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true); };
  }, [open]);
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
      <button type="button" ref={ref} className={cx('tbx-pill-input', invalid && 'is-invalid', open && 'is-open')} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{children}</span>
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align="end" label={label}>
        {type === 'date'
          ? <DatePicker value={value} min={min} today={today} onChange={(v) => { onChange(v); setOpen(false); }} />
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
  const [adding, setAdding] = useState('');
  const [menu, setMenu] = useState(null);
  const [drag, setDrag] = useState(null); // { id, x, y, dx, dy, index, line }
  const done = items.filter((i) => i.completed).length;
  // rows glide only after a reorder we started (same motion as the sidebar)
  const flipRef = useFlip(null);
  const menuAnchor = useRef(null);

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
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.documentElement.classList.remove('tbx-dragging');
      if (state && state.line != null) {
        const rest = items.filter((x) => x.id !== id);
        const at = state.index > from ? state.index - 1 : state.index;
        commit([...rest.slice(0, at), items[from], ...rest.slice(at)]);
      }
      setDrag(null);
    };
    document.documentElement.classList.add('tbx-dragging');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
              className={cx('tbx-item', item.completed && 'is-done', drag?.id === item.id && 'is-origin', menu === item.id && 'is-menu')}
            >
              <span className="tbx-item-grip" onPointerDown={(e) => startDrag(e, item.id)} aria-hidden="true"><G name="grip" size={14} stroke={2.6} /></span>
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
                  if (e.key === 'Enter') { e.preventDefault(); if (item.text.trim() && items.length < 200) insertAfter(item.id); else e.currentTarget.blur(); }
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
                <button
                  type="button"
                  className="tbx-item-more"
                  aria-label={tx('事项选项')}
                  aria-haspopup="menu"
                  aria-expanded={menu === item.id}
                  onClick={(e) => { menuAnchor.current = e.currentTarget; setMenu(menu === item.id ? null : item.id); }}
                >
                  <G name="more" size={16} stroke={2.6} />
                </button>
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
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); commitAdd(); } }}
            onBlur={commitAdd}
          />
        </div>
      </div>
      {dragged && (
        <div className="tbx-drag-ghost is-item" style={{ transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px)` }} aria-hidden="true">
          <span className={cx('tbx-item-check', dragged.completed && 'is-done')} />
          <span>{dragged.text || tx('写一件要做的事')}</span>
        </div>
      )}
      {(() => {
        const item = items.find((x) => x.id === menu);
        return (
          <Popover anchor={menuAnchor} open={Boolean(item)} onClose={() => setMenu(null)} align="end" role="menu" className="tbx-item-menu">
            {item && (
              <>
                <div className="tbx-item-prio" role="radiogroup" aria-label={tx('优先级')}>
                  {PRIORITIES.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={(item.priority || 'normal') === p.id} className={cx(`is-${p.id}`, (item.priority || 'normal') === p.id && 'is-on')} onClick={() => { patch(item.id, { priority: p.id }); setMenu(null); }}>
                      {tx(p.label)}
                    </button>
                  ))}
                </div>
                {!repeating && onMove && item.text.trim() && (
                  <button type="button" role="menuitem" onClick={() => { setMenu(null); onMove(item.id); }}><G name="move" />{tx('移到其他安排…')}</button>
                )}
                <ConfirmMenuItem icon={<G name="trash" />} label={tx('删除事项')} onConfirm={() => { setMenu(null); remove(item.id); }} />
              </>
            )}
          </Popover>
        );
      })()}
    </section>
  );
}

/* ---------- labels as pills ---------- */
function Labels({ tags, labels, onChange, onLabels, accountKey }) {
  const { scheduleKit: K } = tb();
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
            onClick={() => onChange(on ? tags.filter((x) => x !== l.id) : [...tags, l.id])}
            onDoubleClick={() => setEditing({ ...l, clientId: crypto.randomUUID() })}
            title={tx('双击编辑标签')}
          >
            <i />{l.name}
          </button>
        );
      })}
      <button type="button" className="tbx-label is-new" onClick={() => setEditing({ clientId: crypto.randomUUID() })} disabled={tags.length >= 30}>
        <G name="plus" size={12} stroke={2.4} />{tx('新标签')}
      </button>
      <K.CalendarOverlay present={Boolean(editing)}>
        {editing && (
          <K.LabelDialog key={editing.clientId} label={editing.id ? editing : null} accountKey={accountKey} onClose={() => setEditing(null)} onSaved={(label, select) => {
            onLabels(label);
            if (select && tagsRef.current.length < 30 && !tagsRef.current.includes(label.id)) onChange([...tagsRef.current, label.id]);
          }} />
        )}
      </K.CalendarOverlay>
    </section>
  );
}

/* ---------- the sheet ---------- */
export function EntryEditor(props) {
  const { draft, onPatch, onClose, onConfirm, onDelete, onRemove, onMoveItem, locked, labels, onLabels, accountKey, status, onRetry, onReload, onAdoptServer, error, Original } = props;
  useLocale();
  const { scheduleKit: K } = tb();
  const content = draft.content;
  const titleRef = useRef(null);
  const notesRef = useRef(null);
  const sheetRef = useRef(null);
  const [dialog, setDialog] = useState(null);
  const [repeatMenu, setRepeatMenu] = useState(false);
  const repeatRef = useRef(null);
  // the timed range a task had before "All day" was switched on, to give it back
  const beforeAllDay = useRef(null);

  useEffect(() => { if (!draft.id) titleRef.current?.focus({ preventScroll: true }); }, [draft.clientId]);
  useAutoHeight(titleRef, content.title);
  useAutoHeight(notesRef, content.calendar.notes);

  if (locked || draft.readOnly || !K) return <Original {...props} />;

  const time = content.time;
  const allDay = content.calendar.allDay;
  const end = time ? K.endOf(content) : null;
  const endIssue = K.endTimeProblem(content);
  const adjustment = time ? K.dstAdjustment(content) : null;
  const today = K.todayInZone(draft.zone);
  const patchCalendar = (v) => onPatch({ calendar: { ...content.calendar, ...v } });
  const patchTime = (v) => onPatch({ time: { ...time, ...v } });
  const setRepeat = (repeat, date = time.date) => { onPatch({ repeat, time: { ...time, date } }, true); setRepeatMenu(false); setDialog(null); };
  const anchor = draft.forceSeries ? time?.date : draft.entry?.time?.date ?? time?.date;
  const kind = tx(time ? (draft.id ? '任务' : '新任务') : (draft.id ? '待安排' : '新的待安排'));
  const confirmKey = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.currentTarget.blur();
    onConfirm();
  };
  const morning = () => ({ ...K.defaultTime(draft.zone), date: today, startTime: '09:00', durationMinutes: 60 });
  const toggleAllDay = (on) => {
    const t = time ?? morning();
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
          {time && (
            <button type="button" className="tbx-sheet-icon has-text" title={tx('移回待安排')} aria-label={tx('移回待安排')} onClick={() => setDialog('unschedule')}>
              <G name="inbox" size={15} /><span className="tbx-sheet-btn-text">{tx('移回待安排')}</span>
            </button>
          )}
          {repeating ? (
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
          )}
          <button type="button" className="tbx-sheet-icon" aria-label={tx('关闭')} title={tx('关闭')} onClick={close}><G name="close" size={16} stroke={2.2} /></button>
        </span>
      </header>

      <div className="tbx-sheet-body">
        <textarea
          ref={titleRef}
          id="calendar-entry-title"
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
                  <Pill type="date" today={today} label={tx('结束日期')} min={time.date} invalid={allDay && endIssue} value={end.date} onChange={(v) => onPatch({ time: K.changeEnd(content, v, end.time) })}>{dateLabel(end.date, today)}</Pill>
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
                  <Pill type="time" label={tx('结束时间')} invalid={Boolean(endIssue)} value={end.time} onChange={(v) => onPatch({ time: K.changeEnd(content, end.date, v) })}>{end.time}</Pill>
                </span>
              </div>
            )}
            <div className="tbx-row">
              <span className="tbx-row-icon is-orange"><G name="sun" size={15} /></span>
              <span className="tbx-row-label">{tx('全天')}</span>
              <span className="tbx-row-value"><Toggle on={allDay} onChange={toggleAllDay} label={tx('全天')} /></span>
            </div>
            <div className="tbx-row is-button">
              <button type="button" ref={repeatRef} className="tbx-row-hit" onClick={() => setRepeatMenu(!repeatMenu)} aria-haspopup="menu" aria-expanded={repeatMenu}>
                <span className="tbx-row-icon is-gray"><G name="repeat" size={15} /></span>
                <span className="tbx-row-label">{tx('重复')}</span>
                <span className="tbx-row-value is-text">{content.repeat ? K.repeatLabel(content.repeat, anchor) : tx('不重复')}<G name="chevron" size={14} /></span>
              </button>
              <Popover anchor={repeatRef} open={repeatMenu} onClose={() => setRepeatMenu(false)} align="end" role="menu" label={tx('重复')}>
                {REPEATS.map(([id, label]) => {
                  const on = id === 'none' ? !content.repeat : Boolean(content.repeat) && K.repeatLabel(content.repeat, anchor) === K.repeatLabel(K.presetRepeat(id, time.date), anchor);
                  return (
                    <button key={id} type="button" role="menuitemradio" aria-checked={on} onClick={() => setRepeat(id === 'none' ? null : K.presetRepeat(id, time.date))}>
                      {tx(label)}{on && <span className="tbx-pop-check"><G name="check" size={14} /></span>}
                    </button>
                  );
                })}
                <div className="tbx-popover-sep" />
                <button type="button" role="menuitem" onClick={() => { setRepeatMenu(false); setDialog('repeat'); }}>{tx('自定义…')}</button>
              </Popover>
            </div>
            <div className="tbx-row is-button">
              <button type="button" className="tbx-row-hit" onClick={() => setDialog('reminder')}>
                <span className="tbx-row-icon is-purple"><G name="bell" size={15} /></span>
                <span className="tbx-row-label">{tx('提醒')}</span>
                <span className="tbx-row-value is-text">{content.reminder ? K.reminderLabel(content.reminder) : tx('无')}<G name="chevron" size={14} /></span>
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="tbx-when-add" onClick={() => onPatch({ time: morning(), calendar: { ...content.calendar, allDay: false } })}>
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
        {draft.savePaused && <K.ConflictPreview content={draft.baseline} labels={labels} onAdopt={() => setDialog('adopt')} />}
      </div>

      <footer className="tbx-sheet-foot">
        <span className={cx('tbx-sheet-status', saving && 'is-saving')}>
          {tx(saving ? '正在保存…' : draft.id ? '自动保存' : content.title.trim() ? '马上保存' : '写下标题就会保存')}
        </span>
        <button type="button" className="tbx-sheet-done" onClick={close}>{tx('完成')}</button>
      </footer>

      {/* only the app's own dialogs sit in its overlay; our confirm dialogs carry their own scrim */}
      <K.CalendarOverlay present={['repeat', 'reminder', 'adopt'].includes(dialog)}>
        {dialog === 'repeat' && <K.RepeatDialog value={content.repeat} date={time.date} anchor={anchor} onSave={setRepeat} onClose={() => setDialog(null)} />}
        {dialog === 'reminder' && <K.ReminderDialog value={content.reminder} onClose={() => setDialog(null)} onSave={(reminder) => { onPatch({ reminder }); setDialog(null); }} />}
        {dialog === 'adopt' && (
          <K.CalendarDialog title={tx('采用服务器内容')} onClose={() => setDialog(null)}>
            <p>{tx('用服务器内容替换当前本地输入？未保存的本地修改将被丢弃。')}</p>
            <footer>
              <button onClick={() => setDialog(null)}>{tx('取消')}</button>
              <button className="is-primary" data-dialog-confirm="" onClick={() => { onAdoptServer(); setDialog(null); }}>{tx('采用')}</button>
            </footer>
          </K.CalendarDialog>
        )}
      </K.CalendarOverlay>
      {dialog === 'unschedule' && (
        <ConfirmDialog
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
