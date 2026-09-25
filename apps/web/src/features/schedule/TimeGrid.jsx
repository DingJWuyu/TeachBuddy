import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { addDays, eventOf, formatClock, monday, shiftMonth, weekday } from './calendarModel.js';
import { localParts } from './zoned.js';

const plugins = [timeGridPlugin, dayGridPlugin, interactionPlugin];
const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export default function TimeGrid({ view, anchor, zone, occurrences, labels, selected, onSelect, onOpen, onMove, onRange, onDay,
  scroll, monthScroll, onScroll, onMonthScroll, disabled }) {
  const ref = useRef(null);
  const host = useRef(null);
  const callbacks = useRef({ onRange, onScroll, onMonthScroll });
  callbacks.current = { onRange, onScroll, onMonthScroll };
  const month = view.kind === 'month';
  const kind = month ? 'calendarMonth' : view.kind === 'week' ? 'timeGridWeek' : view.kind === 'day' ? 'timeGridDay' : 'calendarDays';
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const [extended, setExtended] = useState(() => monthScroll?.anchor === anchor ? { key: monthStart, range: monthScroll.range } : null);
  const adjusting = useRef(false);
  const restoreScroll = useRef(null);
  const visible = useMemo(() => month ? extended?.key === monthStart ? extended.range : { start: addDays(monday(monthStart), -28), end: addDays(monday(`${shiftMonth(anchor.slice(0, 7), 1)}-01`), 42) } : undefined, [month, monthStart, extended]);
  const visibleRef = useRef(visible); visibleRef.current = visible;
  const events = useMemo(() => occurrences.map(value => eventOf(value, zone, labels)), [occurrences, zone, labels]);
  const todayParts = localParts(zone, Date.now());
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
    <FullCalendar ref={ref} key={`${kind}:${month ? monthStart : view.days}`} plugins={plugins} initialView={kind} initialDate={anchor}
      views={{ calendarDays: { type: 'timeGrid', duration: { days: view.days || 7 } }, calendarMonth: { type: 'dayGrid' } }}
      visibleRange={visible} height={month ? 'auto' : '100%'} headerToolbar={false} firstDay={1} timeZone="UTC"
      now={`${todayParts.date}T${formatClock(todayParts.minutes)}:00Z`} nowIndicator={!month}
      slotDuration="00:15:00" snapDuration="00:05:00" slotLabelInterval="01:00" scrollTime="00:00:00" scrollTimeReset={false}
      slotLabelFormat={{ hour: 'numeric', meridiem: 'short', omitZeroMinute: true }}
      slotLabelContent={arg => `${arg.date.getUTCHours() % 12 || 12} ${arg.date.getUTCHours() < 12 ? 'AM' : 'PM'}`}
      eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: false, omitZeroMinute: false }}
      allDayText="" allDaySlot allDayMaintainDuration={false} eventResizableFromStart editable={!disabled} selectable={!disabled}
      selectMirror={false} selectMinDistance={3} longPressDelay={250} eventDragMinDistance={5} dragRevertDuration={180}
      unselectAuto={false} eventDisplay="block" dayMaxEvents={month} moreLinkText={n => `还有 ${n} 项`}
      events={events} eventClassNames={info => selected && info.event.extendedProps.occurrence?.key.entryId === selected.id &&
        (info.event.extendedProps.occurrence?.key.originDate ?? null) === (selected.origin ?? null) ? ['is-selected'] : []}
      dayHeaderContent={arg => <span className="cal-day-heading"><span>{weekNames[weekday(arg.date.toISOString().slice(0, 10))]}</span>{!month && <button type="button" className={arg.isToday ? 'is-today' : ''} aria-label={`查看 ${arg.date.toISOString().slice(0, 10)}`} onClick={() => onDay(arg.date.toISOString().slice(0, 10))}>{arg.date.getUTCDate()}</button>}</span>}
      dayCellContent={arg => month ? <span className={arg.isToday ? 'cal-today-dot' : ''}>{arg.date.getUTCDate() === 1 ? `${arg.date.getUTCMonth() + 1}月 1` : arg.date.getUTCDate()}</span> : null}
      dayCellClassNames={arg => month && arg.date.toISOString().slice(0, 7) !== anchor.slice(0, 7) ? ['cal-outside-month'] : []}
      eventContent={info => <div className={`cal-event-content${month || info.event.allDay ? ' is-compact' : ''}`}>
        {month || info.event.allDay ? <i style={{ background: info.event.extendedProps.color }}/> : <span className="cal-event-time">{info.timeText.replace('–', ' - ')}</span>}
        <span className="cal-event-title">{info.event.title}</span>
      </div>}
      datesSet={info => callbacks.current.onRange(info.startStr.slice(0, 10), addDays(info.endStr.slice(0, 10), -1))}
      dateClick={info => { ref.current?.getApi().unselect(); onSelect(info.dateStr, null, info.allDay); }}
      select={info => onSelect(info.startStr, info.endStr, info.allDay)}
      eventClick={info => { ref.current?.getApi().unselect(); onOpen(info.event.extendedProps.occurrence); }}
      eventDrop={info => onMove(info)} eventResize={info => onMove(info)}
    />
  </div>;
}
