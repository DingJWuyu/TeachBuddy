import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import { formatDateLabel, weekdayLabel } from './model.js';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { addDays, diffDays, eventOf, formatClock, monday, shiftMonth } from './calendarModel.js';
import { localParts } from './zoned.js';
import { IconButton } from './CalendarControls.jsx';
import { ModulePresence, useModuleDialogFocus } from '../../components/interaction/ModuleMotion.jsx';

const plugins = [timeGridPlugin, dayGridPlugin, interactionPlugin];

function MonthMore({ date, events, onClose, onOpen, disabled }) {
  const panel = useRef(null);
  const eventsRef = useRef(events); eventsRef.current = events;
  const gesture = useRef(null);
  useEffect(() => {
    if (disabled) return;
    const draggable = new Draggable(panel.current, {
      itemSelector: '.cal-month-more-event', minDistance: 5, longPressDelay: 250,
      eventData: node => {
        const event = eventsRef.current.find(value => value.id === node.dataset.eventId);
        return { title: event.title, color: event.extendedProps.color, duration: { days: event.extendedProps.displayDays }, create: false };
      }
    });
    const track = event => {
      const current = gesture.current;
      if (current && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 5) current.dragged = true;
    };
    window.addEventListener('pointermove', track);
    return () => { draggable.destroy(); window.removeEventListener('pointermove', track); };
  }, [disabled]);
  const label = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  useModuleDialogFocus(panel, onClose);
  return <section ref={panel} className="cal-month-more-popover fc-more-popover" role="dialog" aria-label={label}>
    <header><span>{label}</span><IconButton name="close" label={i18n.t('关闭', { ns: 'schedule' })} onClick={onClose}/></header>
    <div className="cal-month-more-body">{events.map(event => <button type="button" key={event.id} data-event-id={event.id} disabled={disabled} className={`cal-month-more-event fc-daygrid-event fc-event${event.extendedProps.selected ? ' is-selected' : ''}`} style={{ background: event.backgroundColor, color: event.textColor }} onPointerDown={e => { gesture.current = { x: e.clientX, y: e.clientY, dragged: false }; }} onClick={() => { if (!gesture.current?.dragged) onOpen(event.extendedProps.occurrence); }}>
      <i style={{ background: event.extendedProps.color }}/><span title={event.title}>{event.title}</span>
    </button>)}</div>
  </section>;
}

export default function TimeGrid({ view, anchor, zone, occurrences, labels, selected, onSelect, onClear, onOpen, onMove, onRange, onDay,
  scroll, monthScroll, onScroll, onMonthScroll, disabled }) {
  const { t } = useTranslation("schedule");
  const ref = useRef(null);
  const host = useRef(null);
  const gesture = useRef({ active: false, cancelled: false });
  useEffect(() => {
    const begin = event => {
      if (event.button !== 0 || !(host.current?.contains(event.target) || event.target.closest('.cal-month-more-event'))) return;
      gesture.current = { active: true, cancelled: false, x: event.clientX, y: event.clientY, moved: false };
      host.current?.classList.remove('is-gesture-cancelled');
    };
    const track = event => {
      const current = gesture.current;
      if (current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 3) current.moved = true;
    };
    const finish = () => { gesture.current.active = false; };
    const cancel = event => {
      const current = gesture.current;
      if (event.key !== 'Escape' || !current.active || !current.moved) return;
      event.preventDefault(); event.stopImmediatePropagation(); current.cancelled = true;
      ref.current?.getApi().unselect(); host.current?.classList.add('is-gesture-cancelled');
    };
    document.addEventListener('pointerdown', begin, true);
    document.addEventListener('pointermove', track, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
    document.addEventListener('keydown', cancel, true);
    return () => {
      document.removeEventListener('pointerdown', begin, true);
      document.removeEventListener('pointermove', track, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', finish, true);
      document.removeEventListener('keydown', cancel, true);
    };
  }, []);
  const callbacks = useRef({ onRange, onScroll, onMonthScroll });
  callbacks.current = { onRange, onScroll, onMonthScroll };
  const month = view.kind === 'month';
  const [monthLimit, setMonthLimit] = useState(1);
  const [more, setMore] = useState(null);
  const kind = month ? 'calendarMonth' : view.kind === 'week' ? 'timeGridWeek' : view.kind === 'day' ? 'timeGridDay' : 'calendarDays';
  useEffect(() => { setMore(null); }, [kind, anchor]);
  useEffect(() => {
    if (!more) return;
    const dismiss = event => {
      if (!event.target.closest('.cal-month-more-popover, .fc-daygrid-more-link')) setMore(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [more]);
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const [extended, setExtended] = useState(() => monthScroll?.anchor === anchor ? { key: monthStart, range: monthScroll.range } : null);
  const adjusting = useRef(false);
  const restoreScroll = useRef(null);
  const visible = useMemo(() => month ? extended?.key === monthStart ? extended.range : { start: addDays(monday(monthStart), -28), end: addDays(monday(`${shiftMonth(anchor.slice(0, 7), 1)}-01`), 42) } : undefined, [month, monthStart, extended]);
  const visibleRef = useRef(visible); visibleRef.current = visible;
  const events = useMemo(() => occurrences.map(value => {
    const event = eventOf(value, zone, labels);
    if (selected?.id === value.key.entryId && (selected.origin ?? null) === (value.key.originDate ?? null)) {
      event.backgroundColor = event.extendedProps.color;
      event.textColor = event.extendedProps.selectedTextColor;
      event.extendedProps.selected = true;
    }
    return event;
  }), [occurrences, zone, labels, selected?.id, selected?.origin, i18n.resolvedLanguage]);
  useLayoutEffect(() => {
    if (!month || !host.current) return;
    const node = host.current;
    const frame = node.querySelector('.fc-daygrid-day-frame');
    if (!frame) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const headerHeight = Math.max(...[...node.querySelectorAll('.fc-daygrid-day-top')].map(el => el.getBoundingClientRect().height));
      const card = node.querySelector('.fc-daygrid-event');
      const style = card && getComputedStyle(card);
      const pitch = card ? card.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom) : 30;
      const more = node.querySelector('.fc-daygrid-more-link');
      const moreHeight = more ? more.getBoundingClientRect().height + 4 : 24;
      const available = frame.getBoundingClientRect().height - headerHeight - moreHeight - 4;
      setMonthLimit(Math.max(1, Math.floor(available / Math.max(1, pitch))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node); observer.observe(frame);
    document.fonts.ready.then(measure);
    return () => { active = false; observer.disconnect(); };
  }, [month, events]);
  const selectedEvent = selected?.id ? events.find(event => event.id === `${selected.id}:${selected.origin ?? ''}`) : null;
  const calendarNow = useMemo(() => () => {
    const stamp = Date.now(), parts = localParts(zone, stamp);
    // UTC-shaped values place the local clock on the floating-time grid.
    return new Date(`${parts.date}T${formatClock(parts.minutes)}:${new Date(stamp).toISOString().slice(17)}`);
  }, [zone]);
  useEffect(() => { if (!selected || selected.id) ref.current?.getApi().unselect(); }, [selected?.id, selected?.clientId]);
  useEffect(() => {
    const api = ref.current?.getApi();
    if (!api) return;
    if (api.getDate().toISOString().slice(0, 10) !== anchor) api.gotoDate(anchor);
  }, [anchor]);
  useEffect(() => {
    const node = month ? host.current : host.current?.querySelector('.fc-scroller-liquid-absolute');
    if (!node) return;
    adjusting.current = true;
    let frame = requestAnimationFrame(() => {
      if (month) {
        const cell = node.querySelector(`[data-date="${monday(monthStart)}"]`);
        const body = node.querySelector('.fc-daygrid-body');
        if (monthScroll?.anchor === anchor) node.scrollTop = monthScroll.top;
        else if (cell && body) node.scrollTop = cell.getBoundingClientRect().top - body.getBoundingClientRect().top;
      } else node.scrollTop = scroll ?? 0;
      adjusting.current = false;
    });
    const listener = () => {
      if (!month) { callbacks.current.onScroll(node.scrollTop); return; }
      if (adjusting.current) return;
      const bounds = node.getBoundingClientRect();
      const middle = [...node.querySelectorAll('.fc-daygrid-day')].find(cell => {
        const rect = cell.getBoundingClientRect();
        return rect.top <= bounds.top + node.clientHeight / 2 && rect.bottom > bounds.top + node.clientHeight / 2;
      });
      if (middle) callbacks.current.onMonthScroll?.(middle.dataset.date.slice(0, 7), { anchor, top: node.scrollTop, range: visibleRef.current });
      const range = visibleRef.current;
      const prepend = node.scrollTop < 100 && range.start > '1900-02-01';
      const append = node.scrollHeight - node.clientHeight - node.scrollTop < 100 && range.end < '2100-11-30';
      if (prepend || append) {
        adjusting.current = true;
        restoreScroll.current = { top: node.scrollTop, height: node.scrollHeight, prepend };
        setExtended({ key: monthStart, range: { start: prepend ? addDays(range.start, -28) : range.start, end: append ? addDays(range.end, 28) : range.end } });
      }
    };
    node.addEventListener('scroll', listener, { passive: true });
    return () => { cancelAnimationFrame(frame); node.removeEventListener('scroll', listener); };
  }, [kind, view.days, monthStart, month]);
  useLayoutEffect(() => {
    if (!restoreScroll.current || !host.current) return;
    const saved = restoreScroll.current;
    host.current.scrollTop = saved.top + (saved.prepend ? host.current.scrollHeight - saved.height : 0);
    restoreScroll.current = null;
    const frame = requestAnimationFrame(() => { adjusting.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [visible]);
  return <div className={`cal-grid-wrap${month ? ' is-month' : ''}`} ref={host} data-region="time-grid">
    <FullCalendar ref={ref} key={`${kind}:${month ? monthStart : view.days}`} plugins={plugins} locales={[zhCnLocale]} locale={i18n.resolvedLanguage?.startsWith("zh") ? "zh-cn" : "en"} initialView={kind} initialDate={anchor}
      views={{ calendarDays: { type: 'timeGrid', duration: { days: view.days || 7 } }, calendarMonth: { type: 'dayGrid' } }}
      visibleRange={visible} height={month ? 'auto' : '100%'} headerToolbar={false} firstDay={1} timeZone="UTC"
      validRange={{ start: '1900-01-01', end: '2101-01-01' }}
      now={calendarNow} nowIndicator={!month}
      nowIndicatorContent={arg => arg.isAxis ? <><span className="cal-now-time">{new Intl.DateTimeFormat(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(arg.date)}</span><span className="cal-now-guide"/></> : null}
      slotDuration="00:15:00" snapDuration="00:05:00" slotLabelInterval="01:00" scrollTime="00:00:00" scrollTimeReset={false}
      slotLabelFormat={{ hour: 'numeric', meridiem: 'short', omitZeroMinute: true }}
      slotLabelContent={arg => new Intl.DateTimeFormat(i18n.resolvedLanguage, { hour: 'numeric', timeZone: 'UTC' }).format(arg.date)}
      eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: false, omitZeroMinute: false }}
      allDayText="" allDaySlot allDayMaintainDuration={false} eventResizableFromStart editable={!disabled} selectable={!disabled}
      eventShortHeight={52} selectMirror selectMinDistance={3} longPressDelay={250} eventDragMinDistance={5} dragRevertDuration={180}
      unselectAuto={false} eventDisplay="block" dayMaxEvents={month ? monthLimit : false} moreLinkText={n => t("还有 {{n}} 项", { n: n })}
      eventOrder={month ? '-displayDays,start,-duration,allDay,title' : 'start,-duration,allDay,title'} eventOrderStrict={month}
      moreLinkClick={info => {
        const date = info.date.toISOString().slice(0, 10);
        const ids = [...new Set(info.allSegs.map(seg => seg.event.id))];
        setMore(current => current?.date === date ? null : { date, ids });
        return true;
      }}
      events={events} eventClassNames={info => info.isMirror && !info.event.title && !info.event.extendedProps.occurrence ? ['cal-selection-preview'] : selected && info.event.extendedProps.occurrence?.key.entryId === selected.id &&
        (info.event.extendedProps.occurrence?.key.originDate ?? null) === (selected.origin ?? null) ? ['is-selected'] : []}
      dayHeaderContent={arg => <span className="cal-day-heading"><span>{weekdayLabel(arg.date.toISOString().slice(0, 10))}</span>{!month && <button type="button" className={arg.isToday ? 'is-today' : ''} aria-label={t("查看 {{value}}", { value: arg.date.toISOString().slice(0, 10) })} onClick={() => onDay(arg.date.toISOString().slice(0, 10))}>{arg.date.getUTCDate()}</button>}</span>}
      dayCellContent={arg => month ? <span className={arg.isToday ? 'cal-today-dot' : ''}>{arg.date.getUTCDate() === 1 ? formatDateLabel(arg.date.toISOString().slice(0, 10)) : arg.date.getUTCDate()}</span> : null}
      dayCellClassNames={arg => {
        if (!month) return [];
        const classes = arg.date.toISOString().slice(0, 7) !== anchor.slice(0, 7) ? ['cal-outside-month'] : [];
        if (selectedEvent && Date.parse(`${selectedEvent.start}Z`) < arg.date.getTime() + 86400000 && Date.parse(`${selectedEvent.end}Z`) > arg.date.getTime()) classes.push('cal-selected-day');
        return classes;
      }}
      eventContent={info => info.isMirror && !info.event.title && !info.event.extendedProps.occurrence ? <span className="cal-selection-time">{info.event.startStr.slice(11, 16)} - {info.event.endStr.slice(0, 10) !== info.event.startStr.slice(0, 10) ? `${formatDateLabel(info.event.endStr.slice(0, 10))} ` : ''}{info.event.endStr.slice(11, 16)}</span> : <div className={`cal-event-content${month || info.event.allDay ? ' is-compact' : ''}`}>
        {month ? <i style={{ background: info.event.extendedProps.color }}/> : !info.event.allDay && <span className="cal-event-time">{info.timeText.replace('–', ' - ')}</span>}
        <span className="cal-event-title">{info.event.title}</span>
      </div>}
      datesSet={info => callbacks.current.onRange(info.startStr.slice(0, 10), addDays(info.endStr.slice(0, 10), -1))}
      dateClick={() => { if (!gesture.current.cancelled) onClear(); }}
      select={info => {
        if (gesture.current.cancelled) ref.current?.getApi().unselect();
        else onSelect(info.startStr, info.endStr, info.allDay);
      }}
      selectAllow={() => !gesture.current.cancelled}
      eventAllow={() => !gesture.current.cancelled}
      eventClick={info => { ref.current?.getApi().unselect(); onOpen(info.event.extendedProps.occurrence); }}
      droppable={!disabled} dropAccept=".cal-month-more-event"
      drop={info => {
        if (gesture.current.cancelled) return;
        const event = events.find(value => value.id === info.draggedEl.dataset.eventId);
        if (!event || !more) return;
        const delta = diffDays(more.date, info.dateStr.slice(0, 10));
        const shift = value => `${addDays(value.slice(0, 10), delta)}${value.slice(10)}`;
        setMore(null);
        if (delta) onMove({ event: { ...event, startStr: shift(event.start), endStr: shift(event.end) }, revert() {} });
      }}
      eventDrop={info => { if (gesture.current.cancelled) info.revert(); else onMove(info); }} eventResize={info => { if (gesture.current.cancelled) info.revert(); else onMove(info); }}
    />
    {more && createPortal(<ModulePresence present>
      {more && <MonthMore disabled={disabled} date={more.date} events={more.ids.map(id => events.find(event => event.id === id)).filter(Boolean)} onClose={() => setMore(null)} onOpen={onOpen}/>}
    </ModulePresence>, document.body)}
  </div>;
}
