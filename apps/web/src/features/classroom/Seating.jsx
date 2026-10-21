import React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { Icon, Avatar, Menu, Empty } from './ui.jsx';

/*
 * The seating plan is the classroom seen from the back: the board at the
 * front, desks in rows. Drag a student onto another seat to swap, onto an
 * empty one to move, or down to the tray to leave them unseated. A click
 * opens the student. Every change saves at once and animates into place.
 */

const SPRING = 'cubic-bezier(0.34, 1.32, 0.64, 1)';

export function Seating({ ctx, cls, students }) {
  const [seating, setSeating] = useState(cls.seating);
  const [version, setVersion] = useState(cls.version);
  const [drag, setDrag] = useState(null);
  const [target, setTarget] = useState(null);
  const root = useRef(null);
  const rects = useRef(new Map());
  const press = useRef(null);
  const saving = useRef(false);
  useEffect(() => { setSeating(cls.seating); setVersion(cls.version); }, [cls.id, cls.version]);

  const byId = new Map(students.map((s) => [s.id, s]));
  const seats = seating.seats.filter((s) => byId.has(s.studentId));
  const at = new Map(seats.map((s) => [`${s.row}:${s.col}`, s.studentId]));
  const seated = new Set(seats.map((s) => s.studentId));
  const unseated = students.filter((s) => !seated.has(s.id));

  // remember where every student is before a change, then glide from there
  const snapshot = () => {
    rects.current = new Map([...(root.current?.querySelectorAll('[data-student]') ?? [])].map((el) => [el.dataset.student, el.getBoundingClientRect()]));
  };
  useLayoutEffect(() => {
    const before = rects.current;
    if (!before.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    rects.current = new Map();
    for (const el of root.current?.querySelectorAll('[data-student]') ?? []) {
      const was = before.get(el.dataset.student);
      if (!was) continue;
      const now = el.getBoundingClientRect();
      const dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 520, easing: SPRING });
    }
  }, [seating]);

  async function save(next, message) {
    if (saving.current) return;
    saving.current = true;
    snapshot();
    const previous = seating;
    setSeating(next);
    try {
      const saved = await ctx.api.put(`/classes/${cls.id}/seating`, { baseVersion: version, rows: next.rows, cols: next.cols, seats: next.seats });
      setVersion(saved.version);
      ctx.reload();
      if (message) ctx.toast(message);
    } catch (err) {
      snapshot();
      setSeating(previous);
      ctx.toast(err.message, 'error');
      if (err.status === 409) ctx.reload();
    } finally { saving.current = false; }
  }

  function place(studentId, cell) {
    const from = seats.find((s) => s.studentId === studentId);
    let next = seats.filter((s) => s.studentId !== studentId);
    if (cell === 'tray') return save({ ...seating, seats: next });
    const occupant = at.get(`${cell.row}:${cell.col}`);
    if (occupant === studentId) return undefined;
    next = next.filter((s) => s.studentId !== occupant);
    next.push({ studentId, row: cell.row, col: cell.col });
    if (occupant && from) next.push({ studentId: occupant, row: from.row, col: from.col });
    return save({ ...seating, seats: next });
  }

  function resize(rows, cols) {
    rows = Math.max(1, Math.min(15, rows));
    cols = Math.max(1, Math.min(15, cols));
    const keep = seats.filter((s) => s.row < rows && s.col < cols);
    const dropped = seats.length - keep.length;
    save({ rows, cols, seats: keep }, dropped ? tx('{{n}} 位学生回到了“还没有座位”', { n: dropped }) : null);
  }

  function autofill() {
    const free = [];
    for (let r = 0; r < seating.rows; r++) for (let c = 0; c < seating.cols; c++) if (!at.has(`${r}:${c}`)) free.push({ row: r, col: c });
    const queue = [...unseated].sort((a, b) => (a.studentNo || '~').localeCompare(b.studentNo || '~'));
    const added = queue.slice(0, free.length).map((s, i) => ({ studentId: s.id, ...free[i] }));
    if (!added.length) return;
    save({ ...seating, seats: [...seats, ...added] }, tx('已为 {{n}} 位学生安排座位', { n: added.length }));
  }

  /* ---------- pointer dragging ---------- */
  function onPointerDown(e, studentId) {
    if (e.button !== 0) return;
    const box = root.current.getBoundingClientRect();
    const card = e.currentTarget.getBoundingClientRect();
    press.current = { studentId, x: e.clientX, y: e.clientY, ox: e.clientX - card.left, oy: e.clientY - card.top, w: card.width, h: card.height, box, moved: false, pointer: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const p = press.current;
    if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
    p.moved = true;
    const box = root.current.getBoundingClientRect();
    setDrag({ studentId: p.studentId, x: e.clientX - box.left - p.ox, y: e.clientY - box.top - p.oy + root.current.scrollTop, w: p.w, h: p.h });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const seat = el?.closest?.('[data-seat]');
    const tray = el?.closest?.('[data-tray]');
    setTarget(seat ? seat.dataset.seat : tray ? 'tray' : null);
  }
  function onPointerUp(e) {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (!p.moved) { ctx.go({ studentId: p.studentId }); return; }
    const t = target;
    setDrag(null);
    setTarget(null);
    if (!t) return;
    if (t === 'tray') place(p.studentId, 'tray');
    else { const [row, col] = t.split(':').map(Number); place(p.studentId, { row, col }); }
  }
  const handlers = (id) => ({
    'data-student': id,
    onPointerDown: (e) => onPointerDown(e, id),
    onPointerMove,
    onPointerUp,
    onPointerCancel: () => { press.current = null; setDrag(null); setTarget(null); },
    onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.go({ studentId: id }); } },
  });

  if (!students.length) {
    return (
      <Empty icon="students" title={tx('先把学生加进来')} text={tx('有了名单，就可以按教室的样子排座位。')}>
        <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('student', { classId: cls.id })}><Icon name="plus" size={15} stroke={2.2} />{tx('添加学生')}</button>
      </Empty>
    );
  }

  const cells = [];
  for (let r = 0; r < seating.rows; r++) {
    for (let c = 0; c < seating.cols; c++) {
      const key = `${r}:${c}`;
      const id = at.get(key);
      const s = id && byId.get(id);
      cells.push(
        <div key={key} className={cx('cr-seat', !s && 'is-empty', target === key && 'is-target', drag?.studentId === id && 'is-lifted')} data-seat={key} style={{ '--i': r * seating.cols + c }}>
          {s && (
            <button type="button" className="cr-desk" {...handlers(s.id)} aria-label={tx('{{name}}，第 {{row}} 排第 {{col}} 座', { name: s.name, row: r + 1, col: c + 1 })}>
              <Avatar name={s.name} id={s.id} />
              <span className="cr-desk-name">{s.name}</span>
              {s.studentNo && <small>{s.studentNo}</small>}
            </button>
          )}
        </div>,
      );
    }
  }
  const lifted = drag && byId.get(drag.studentId);

  return (
    <div className={cx('cr-seating', drag && 'is-dragging')} ref={root}>
      <div className="cr-seating-bar">
        <p className="cr-muted"><Icon name="grip" size={14} stroke={2} />{tx('拖动学生换座位，点一下查看学生')}</p>
        <div className="cr-seating-tools">
          {unseated.length > 0 && <button type="button" className="cr-btn is-small" onClick={autofill}><Icon name="sparkles" size={14} stroke={2} />{tx('按学号补齐空位')}</button>}
          <Menu
            label={tx('教室大小')}
            trigger={({ open, toggle }) => (
              <button type="button" className={cx('cr-btn is-small', open && 'is-on')} aria-expanded={open} onClick={toggle}>
                <Icon name="grid" size={14} stroke={2} />{tx('{{r}} 排 × {{c}} 列', { r: seating.rows, c: seating.cols })}
              </button>
            )}
            items={[
              { label: tx('增加一排'), icon: 'plus', disabled: seating.rows >= 15, onClick: () => resize(seating.rows + 1, seating.cols) },
              { label: tx('减少一排'), icon: 'minus', disabled: seating.rows <= 1, onClick: () => resize(seating.rows - 1, seating.cols) },
              '-',
              { label: tx('增加一列'), icon: 'plus', disabled: seating.cols >= 15, onClick: () => resize(seating.rows, seating.cols + 1) },
              { label: tx('减少一列'), icon: 'minus', disabled: seating.cols <= 1, onClick: () => resize(seating.rows, seating.cols - 1) },
            ]}
          />
        </div>
      </div>

      <div className="cr-room">
        <div className="cr-board"><span>{tx('讲台')}</span></div>
        <div className="cr-room-plan" style={{ '--cols': seating.cols }}>
          <div className="cr-grid">{cells}</div>
        </div>
      </div>

      <div className={cx('cr-tray', target === 'tray' && 'is-target', !unseated.length && 'is-empty')} data-tray="">
        <div className="cr-tray-head">
          <strong>{tx('还没有座位')}</strong>
          <span>{unseated.length ? tx('{{n}} 人', { n: unseated.length }) : tx('每个人都有座位了')}</span>
        </div>
        <div className="cr-tray-list">
          {unseated.map((s) => (
            <button key={s.id} type="button" className={cx('cr-chip-student', drag?.studentId === s.id && 'is-lifted')} {...handlers(s.id)}>
              <Avatar name={s.name} id={s.id} size="sm" />
              <span>{s.name}</span>
            </button>
          ))}
          {!unseated.length && <p className="cr-muted">{tx('把学生拖到这里，就是暂时不排座。')}</p>}
        </div>
      </div>

      {lifted && (
        <div className="cr-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px)`, width: drag.w, height: drag.h }} aria-hidden="true">
          <div className="cr-desk is-ghost">
            <Avatar name={lifted.name} id={lifted.id} />
            <span className="cr-desk-name">{lifted.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}
