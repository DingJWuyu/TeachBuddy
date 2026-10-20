import { Overlay as CalendarOverlay, Dialog as CalendarDialog, isConfirmKey } from '../../components/ui/dialog.jsx';
export { CalendarOverlay, CalendarDialog, isConfirmKey };
import { Icon } from '../../components/icons.jsx';
import { useTranslation } from 'react-i18next';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModulePresence } from '../../components/interaction/ModuleMotion.jsx';
import { weekdayLabel } from './model.js';
import { addDays, diffDays, monday, monthDays, monthTitle, shiftMonth } from './calendarModel.js';

const ICON_NAMES = { left: 'arrowLeft', right: 'arrowRight', down: 'chevron', edit: 'pencil', alert: 'info' };
export function CalendarIcon({ name, size = 18 }) {
  return <Icon name={ICON_NAMES[name] || name} size={size} strokeWidth={1.75}/>;
}
export function IconButton({ name, label, ...props }) {
  useTranslation("schedule");
  return <button type="button" className="cal-icon-button" aria-label={label} title={label} {...props}><CalendarIcon name={name}/></button>;
}
export function MonthTitle({ date, icon = 'calendar' }) {
  useTranslation("schedule");
  const title = monthTitle(date);
  return <div className="cal-month-title"><span className="cal-title-icon"><CalendarIcon name={icon} size={22}/></span><h1>{title.month}<span>{title.year}</span></h1></div>;
}

export function CalendarMenu({ label, trigger, className = '', children }) {
  useTranslation("schedule");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const panel = useRef(null);
  const keyboardOpen = useRef(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const id = useId();
  useEffect(() => {
    if (open && keyboardOpen.current) panel.current?.querySelector('input:not(:disabled), button:not(:disabled)')?.focus();
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = ref.current?.getBoundingClientRect();
      const menu = panel.current?.getBoundingClientRect();
      if (!button || !menu) return;
      const width = className.includes('cal-tag-picker') ? Math.max(200, button.width) : menu.width;
      setPosition({ width, left: Math.max(8, Math.min(button.right - width, innerWidth - width - 8)),
        top: button.bottom + menu.height + 12 <= innerHeight ? button.bottom + 4 : Math.max(8, button.top - menu.height - 4) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, className]);
  useEffect(() => {
    if (!open) return;
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && (ref.current?.contains(event.target) || panel.current?.contains(event.target))) return;
      setOpen(false);
      if (event.type === 'keydown') { event.stopPropagation(); ref.current?.querySelector('button')?.focus(); }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return <div className={`cal-menu-host ${className}`} ref={ref}>
    <button type="button" className="cal-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={event => { keyboardOpen.current = event.detail === 0; setOpen(!open); }} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.nativeEvent?.isComposing) return;
      event.preventDefault(); keyboardOpen.current = true; setOpen(true);
      if (open) panel.current?.querySelector('input:not(:disabled), button:not(:disabled)')?.focus();
    }}>{trigger}</button>
    {createPortal(<div className={`cal-menu-position tbx-portal-host ${className}`} style={position}><ModulePresence present={open} className="cal-menu-presence"><div className="cal-menu" ref={panel} role="menu" id={id} aria-label={label} onKeyDown={event => {
      if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const currentMenu = event.target.closest('[role="menu"]');
      const submenu = event.target.closest('button')?.nextElementSibling;
      if ((event.key === 'ArrowRight' || isConfirmKey(event)) && submenu?.matches('[role="menu"]')) {
        event.preventDefault(); event.stopPropagation(); submenu.querySelector('button:not(:disabled)')?.focus(); return;
      }
      if (event.key === 'ArrowLeft' && currentMenu !== event.currentTarget) {
        event.preventDefault(); event.stopPropagation(); currentMenu.parentElement.querySelector('button')?.focus(); return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...currentMenu.querySelectorAll('button[role^="menuitem"]:not(:disabled)')].filter(button => button.getClientRects().length && button.closest('[role="menu"]') === currentMenu);
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault();
      const next = buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length];
      next?.focus();
    }}>{children(() => { setOpen(false); ref.current?.querySelector('button')?.focus(); })}</div></ModulePresence></div>, document.body)}
  </div>;
}
export function ViewMenu({ view, onChange }) {
  const { t } = useTranslation("schedule");
  const [custom, setCustom] = useState(false);
  const [days, setDays] = useState(view.days ?? 7);
  const label = { day: t("日"), week: t("周"), month: t("月") }[view.kind] ?? t("{{days}} 天", { days: view.days });
  return <><CalendarMenu label={t("日历视图")} className="cal-view-menu" trigger={<>{label}<CalendarIcon name="down" size={16}/></>}>
    {close => <>
      {[['day', t("日"), 'D'], ['week', t("周"), 'W'], ['month', t("月"), 'M']].map(([kind, title, key]) => <button type="button" role="menuitemradio" aria-checked={view.kind === kind} key={kind} onClick={() => { onChange({ kind, days: kind === 'day' ? 1 : 7 }); close(); }}><span>{title}</span><kbd>{key}</kbd></button>)}
      <div className="cal-menu-divider"/><div className="cal-submenu-host"><button type="button" role="menuitem" aria-haspopup="menu">{t("天数")}<CalendarIcon name="right" size={15}/></button>
        <div className="cal-submenu" role="menu">{Array.from({ length: 8 }, (_, i) => i + 2).map(count => <button key={count} type="button" role="menuitemradio" aria-checked={view.kind === 'days' && view.days === count} onClick={() => { onChange({ kind: 'days', days: count }); close(); }}>{count} {t("天")}<kbd>{count}</kbd></button>)}<div className="cal-menu-divider"/><button type="button" role="menuitem" onClick={() => { setDays(view.days ?? 7); setCustom(true); close(); }}>{t("其他…")}</button></div>
      </div>
    </>}
  </CalendarMenu><CalendarOverlay present={custom}>{custom && <CalendarDialog title={t("自定义天数")} onClose={() => setCustom(false)}><label className="cal-field">{t("天数")}<input type="number" min="1" max="31" value={days} onChange={e => setDays(e.target.value)}/></label><footer><button onClick={() => setCustom(false)}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" disabled={!Number.isInteger(Number(days)) || days < 1 || days > 31} onClick={() => { onChange({ kind: 'days', days: Number(days) }); setCustom(false); }}>{t("完成")}</button></footer></CalendarDialog>}</CalendarOverlay></>;
}

export function MiniCalendar({ month, from, to, today, onMonth, onSelect }) {
  const { t } = useTranslation("schedule");
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const gridRef = useRef(null);
  const first = monday(`${month}-01`);
  const count = Math.ceil((diffDays(first, `${month}-01`) + monthDays(month)) / 7) * 7;
  const dates = Array.from({ length: count }, (_, i) => addDays(first, i));
  const start = drag ? (drag.start < drag.end ? drag.start : drag.end) : from;
  const end = drag ? (drag.start < drag.end ? drag.end : drag.start) : to;
  useEffect(() => {
    const cancel = event => { if (event.key === 'Escape' && dragRef.current) {
      event.preventDefault(); event.stopImmediatePropagation(); dragRef.current = null; setDrag(null);
    } };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, []);
  const finish = event => {
    const selection = dragRef.current;
    if (!selection) return;
    dragRef.current = null; setDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onSelect(selection.start < selection.end ? selection.start : selection.end, selection.start < selection.end ? selection.end : selection.start, selection.start !== selection.end);
  };
  return <section className="cal-mini" aria-label={t("选择日期范围")}>
    <header><MonthTitle date={`${month}-01`} icon="calendarGrid"/><div className="cal-mini-nav"><IconButton name="left" label={t("上个月")} disabled={month <= '1900-01'} onClick={() => onMonth(shiftMonth(month, -1))}/><IconButton name="right" label={t("下个月")} disabled={month >= '2100-12'} onClick={() => onMonth(shiftMonth(month, 1))}/></div></header>
    <div className="cal-mini-grid" ref={gridRef} onPointerMove={event => {
      if (!dragRef.current) return;
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-date]');
      if (!cell || cell.disabled || !gridRef.current.contains(cell)) return;
      dragRef.current = { ...dragRef.current, end: cell.dataset.date }; setDrag(dragRef.current);
    }} onPointerUp={finish} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
      {Array.from({ length: 7 }, (_, index) => weekdayLabel(addDays('2024-01-01', index))).map(day => <span className="cal-mini-weekday" key={day}>{day.replace(/^周/, '')}</span>)}
      {dates.map((date, index) => <div key={date} className={`cal-mini-cell${date >= start && date <= end ? ' in-range' : ''}${date === start || index % 7 === 0 ? ' range-start' : ''}${date === end || index % 7 === 6 ? ' range-end' : ''}`}>
        <button type="button" data-date={date} disabled={date < '1900-01-01' || date > '2100-12-31'} aria-label={date} aria-pressed={date >= start && date <= end} className={`${date === today ? 'is-today' : ''} ${date.slice(0, 7) !== month ? 'is-outside' : ''}`} onPointerDown={event => {
          if (event.button !== 0) return;
          event.preventDefault();
          dragRef.current = { start: date, end: date }; setDrag(dragRef.current);
          gridRef.current.setPointerCapture(event.pointerId);
        }} onClick={event => { if (event.detail === 0) onSelect(date, date, false); }} onKeyDown={event => {
          const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
          if (!delta) return;
          event.preventDefault(); const next = addDays(date, delta);
          if (next < '1900-01-01' || next > '2100-12-31') return;
          if (event.shiftKey) onSelect(date < next ? date : next, date < next ? next : date, true);
          gridRef.current.querySelector(`[data-date="${next}"]`)?.focus();
        }}>{Number(date.slice(8))}</button>
      </div>)}
    </div>
  </section>;
}
