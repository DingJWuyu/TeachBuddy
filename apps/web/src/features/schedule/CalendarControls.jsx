import { useTranslation } from 'react-i18next';
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModulePresence, useModuleDialogFocus } from '../../components/interaction/ModuleMotion.jsx';
import { weekdayLabel } from './model.js';
import { addDays, diffDays, monday, monthDays, monthTitle, shiftMonth } from './calendarModel.js';

export function CalendarIcon({ name, size = 18 }) {
  useTranslation("schedule");
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
    grid: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M7 15h.01M12 15h.01M17 15h.01M7 18h.01M12 18h.01M17 18h.01"/></>,
    left: <path d="m14 7-5 5 5 5"/>, right: <path d="m10 7 5 5-5 5"/>, down: <path d="m7 10 5 5 5-5"/>,
    inbox: <><path d="m3 12 3-8h12l3 8v8H3z"/><path d="M3 12h5l2 3h4l2-3h5"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r=".5"/><circle cx="3" cy="12" r=".5"/><circle cx="3" cy="18" r=".5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
    alert: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    more: <><circle cx="5" cy="12" r=".7"/><circle cx="12" cy="12" r=".7"/><circle cx="19" cy="12" r=".7"/></>,
    check: <path d="m5 12 4 4L19 6"/>, repeat: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></>,
    edit: <><path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15z"/></>,
    tag: <><path d="M20 13 11 22 2 13V4h9z"/><circle cx="7" cy="9" r="1"/></>,
    book: <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z"/><path d="M12 5v15"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.calendar}</svg>;
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
    {createPortal(<div className={`cal-menu-position ${className}`} style={position}><ModulePresence present={open} className="cal-menu-presence"><div className="cal-menu" ref={panel} role="menu" id={id} aria-label={label} onKeyDown={event => {
      if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const currentMenu = event.target.closest('[role="menu"]');
      const labelRow = event.target.closest('.cal-label-option');
      if (labelRow && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        labelRow.querySelector(event.key === 'ArrowLeft' ? 'button[role]:not(:disabled)' : '.cal-icon-button')?.focus();
        return;
      }
      const submenu = event.target.closest('button')?.nextElementSibling;
      if ((event.key === 'ArrowRight' || isConfirmKey(event)) && submenu?.matches('[role="menu"]')) {
        event.preventDefault(); event.stopPropagation(); submenu.querySelector('button:not(:disabled)')?.focus(); return;
      }
      if (event.key === 'ArrowLeft' && currentMenu !== event.currentTarget) {
        event.preventDefault(); event.stopPropagation(); currentMenu.parentElement.querySelector('button')?.focus(); return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...currentMenu.querySelectorAll('button[role^="menuitem"]:not(:disabled)')].filter(button => button.getClientRects().length && button.closest('[role="menu"]') === currentMenu);
      const index = buttons.indexOf(labelRow?.querySelector('button[role]') ?? document.activeElement);
      event.preventDefault();
      if (labelRow && index === 0 && event.key === 'ArrowUp') {
        currentMenu.querySelector('input[type="search"]')?.focus(); return;
      }
      const next = buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length];
      const editColumn = labelRow && document.activeElement.matches('.cal-icon-button');
      (editColumn && next?.closest('.cal-label-option')?.querySelector('.cal-icon-button') || next)?.focus();
    }}>{children(() => { setOpen(false); ref.current?.querySelector('button')?.focus(); })}</div></ModulePresence></div>, document.body)}
  </div>;
}
const CalendarVisible = createContext(true);
export function isConfirmKey(event) {
  return event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
    && !event.isComposing && !event.nativeEvent?.isComposing && event.keyCode !== 229 && !event.repeat;
}
export function CalendarOverlay({ present, children }) {
  useTranslation("schedule");
  const opening = useRef({ present: false, key: 0 });
  // A quick reopen must not resurrect the cancelled form kept for its exit animation.
  if (present && !opening.current.present) opening.current.key += 1;
  opening.current.present = present;
  return createPortal(<CalendarVisible.Provider value={present}><ModulePresence key={opening.current.key} present={present} mode="overlay" className="cal-overlay-presence">{children}</ModulePresence></CalendarVisible.Provider>, document.body);
}
const dialogConfirmSelector = 'footer [data-dialog-confirm]';
function CalendarDialogFocus({ dialogRef, onEscape }) {
  useTranslation("schedule");
  useModuleDialogFocus(dialogRef, onEscape);
  useEffect(() => {
    const dialog = dialogRef.current;
    const field = dialog?.querySelector('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)');
    (field ?? dialog?.querySelector(`${dialogConfirmSelector}:not(:disabled)`) ?? dialog)?.focus();
  }, [dialogRef]);
  return null;
}
export function CalendarDialog({ title, onClose, onEscape = onClose, children }) {
  const { t } = useTranslation("schedule");
  const ref = useRef(null);
  const active = useContext(CalendarVisible);
  return <div className="cal-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="cal-dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} onKeyDownCapture={event => {
      if (!active || event.target.closest('[inert]') || event.target.closest('[role="dialog"]') !== event.currentTarget || event.key !== 'Enter') return;
      if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return;
      // Enter confirms the dialog, including when its close/cancel control has focus.
      // Suppress native button activation for repeats and modified Enter as well.
      event.preventDefault(); event.stopPropagation();
      if (isConfirmKey(event)) ref.current?.querySelector(`${dialogConfirmSelector}:not(:disabled)`)?.click();
    }} onKeyDown={event => {
      if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const row = target.closest('.cal-field-pair, .cal-repeat-row, .cal-repeat-days, .cal-label-colors');
        const controls = row && [...row.querySelectorAll('input[type="number"]:not(:disabled), select:not(:disabled), button:not(:disabled)')];
        if (controls?.includes(target)) {
          event.preventDefault();
          controls[controls.indexOf(target) + (event.key === 'ArrowLeft' ? -1 : 1)]?.focus();
          return;
        }
      }
      if (target.matches('select') && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const options = [...target.options].filter(option => !option.disabled && !option.closest('optgroup:disabled'));
        const index = options.findIndex(option => option.value === target.value);
        const next = options[Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))];
        if (next && next.value !== target.value) {
          target.value = next.value;
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
    }}>
      {active && <CalendarDialogFocus dialogRef={ref} onEscape={onEscape}/>}
      <header><h2>{title}</h2>{onClose && <IconButton name="close" label={t("关闭")} onClick={onClose}/>}</header>{children}
    </section>
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
    <header><MonthTitle date={`${month}-01`} icon="grid"/><div className="cal-mini-nav"><IconButton name="left" label={t("上个月")} disabled={month <= '1900-01'} onClick={() => onMonth(shiftMonth(month, -1))}/><IconButton name="right" label={t("下个月")} disabled={month >= '2100-12'} onClick={() => onMonth(shiftMonth(month, 1))}/></div></header>
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
