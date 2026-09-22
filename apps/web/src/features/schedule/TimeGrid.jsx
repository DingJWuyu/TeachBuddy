/**
 * Time grid.
 *
 * One column per day in the account timezone, 15-minute pointer snapping and a
 * scroll container that owns both axes: the date header is sticky inside the
 * same scroller, so horizontal scrolling keeps header and columns aligned and
 * vertical scrolling never moves the shell. Long ranges render only the columns
 * near the visible window, so a year-long range stays responsive.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  HOUR_HEIGHT,
  MIN_COLUMN_WIDTH,
  formatClock,
  formatDateLabel,
  layoutDay,
  occurrencePlacement,
  snapMinutes,
  titleOf,
  weekdayLabel
} from './model.js';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const GUTTER_WIDTH = 52;
const WINDOW_OVERSCAN = 2;

function segmentsForDay(occurrences, date, timeZone) {
  const segments = [];
  for (const occurrence of occurrences) {
    const placement = occurrencePlacement(occurrence, timeZone);
    if (placement.startDate !== date && placement.endDate !== date) continue;
    const startMinutes = placement.startDate < date ? 0 : placement.startMinutes;
    const endMinutes = placement.endDate > date ? 1440 : (placement.endDate === date ? placement.endMinutes : 1440);
    if (endMinutes <= startMinutes) continue;
    segments.push({
      occurrence,
      startMinutes,
      endMinutes,
      continuesBefore: placement.startDate < date,
      continuesAfter: placement.endDate > date
    });
  }
  return layoutDay(segments);
}

export default function TimeGrid({
  dates,
  timeZone,
  occurrences,
  selection,
  onSelect,
  onOpen,
  scroll,
  onScroll,
  today
}) {
  const scrollRef = useRef(null);
  const restoredKey = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(scroll?.left ?? 0);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const measure = () => setViewportWidth(node.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !scroll?.ready || restoredKey.current === scroll.restoreKey) return;
    node.scrollTop = scroll?.top ?? 0;
    node.scrollLeft = scroll?.left ?? 0;
    restoredKey.current = scroll.restoreKey;
    setScrollLeft(node.scrollLeft);
    // Lists share the available height: wait for them before restoring the grid.
    // Restore once per account/range, not on subsequent data reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scroll?.ready, scroll?.restoreKey]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && dragRef.current) {
        dragRef.current = null;
        setDrag(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const available = Math.max(MIN_COLUMN_WIDTH, viewportWidth - GUTTER_WIDTH);
  const fits = dates.length * MIN_COLUMN_WIDTH <= available;
  const columnWidth = fits
    ? Math.max(MIN_COLUMN_WIDTH, Math.floor(available / Math.max(1, dates.length)))
    : MIN_COLUMN_WIDTH;
  const visibleCount = Math.max(1, Math.ceil(available / columnWidth) + WINDOW_OVERSCAN * 2);
  const firstVisible = viewportWidth === 0 ? 0 : Math.max(0, Math.floor(scrollLeft / columnWidth) - WINDOW_OVERSCAN);
  const lastVisible = viewportWidth === 0
    ? Math.min(dates.length, visibleCount)
    : Math.min(dates.length, firstVisible + visibleCount);
  const windowDates = dates.slice(firstVisible, lastVisible);
  const leftPad = firstVisible * columnWidth;
  const rightPad = Math.max(0, (dates.length - lastVisible) * columnWidth);
  const totalWidth = GUTTER_WIDTH + dates.length * columnWidth;
  const template = [
    `${GUTTER_WIDTH}px`,
    leftPad > 0 ? `${leftPad}px` : null,
    `repeat(${windowDates.length}, ${columnWidth}px)`,
    rightPad > 0 ? `${rightPad}px` : null
  ].filter(Boolean).join(' ');
  const spacer = (key) => <span key={key} className="sch-spacer" aria-hidden="true" />;

  function minutesAt(column, clientY) {
    const rect = column.getBoundingClientRect();
    return snapMinutes(((clientY - rect.top) / HOUR_HEIGHT) * 60);
  }

  function startDrag(event, date) {
    if (event.button !== 0) return;
    const column = event.currentTarget;
    const anchor = minutesAt(column, event.clientY);
    dragRef.current = { date, anchor, pointerId: event.pointerId, column };
    column.setPointerCapture?.(event.pointerId);
    setDrag({ date, startMinutes: anchor, endMinutes: anchor });
  }

  function moveDrag(event) {
    const current = dragRef.current;
    if (!current) return;
    const value = minutesAt(current.column, event.clientY);
    setDrag({
      date: current.date,
      startMinutes: Math.min(current.anchor, value),
      endMinutes: Math.max(current.anchor, value)
    });
  }

  function endDrag(event) {
    const current = dragRef.current;
    if (!current) return;
    const value = minutesAt(current.column, event.clientY);
    const startMinutes = Math.min(current.anchor, value);
    const endMinutes = Math.max(current.anchor, value);
    dragRef.current = null;
    current.column.releasePointerCapture?.(event.pointerId);
    setDrag(null);
    if (endMinutes - startMinutes >= 15) {
      onSelect({ date: current.date, startMinutes, endMinutes });
    }
  }

  function eventRect(segment, columns) {
    return {
      top: (segment.startMinutes / 60) * HOUR_HEIGHT,
      height: Math.max(18, ((segment.endMinutes - segment.startMinutes) / 60) * HOUR_HEIGHT - 2),
      left: `calc(${(segment.column / columns) * 100}% + 3px)`,
      width: `calc(${(1 / columns) * 100}% - 6px)`
    };
  }

  return (
    <div className="sch-grid" data-region="time-grid" role="grid" aria-label="时间网格">
      <div
        className="sch-grid-scroll"
        ref={scrollRef}
        onScroll={(event) => {
          setScrollLeft(event.currentTarget.scrollLeft);
          if (restoredKey.current === scroll?.restoreKey) {
            onScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft });
          }
        }}
      >
        <div className="sch-grid-inner" style={{ width: `${totalWidth}px` }}>
          <div className="sch-grid-head" style={{ gridTemplateColumns: template }}>
            <div className="sch-gutter-head" aria-hidden="true" />
            {leftPad > 0 && spacer('head-left')}
            {windowDates.map((date) => (
              <div
                key={date}
                className={`sch-day-head${date === today ? ' is-today' : ''}`}
                data-day={date}
              >
                <span className="sch-day-week">{weekdayLabel(date)}</span>
                <span className="sch-day-date">{formatDateLabel(date)}</span>
              </div>
            ))}
            {rightPad > 0 && spacer('head-right')}
          </div>

          <div className="sch-grid-body" style={{ gridTemplateColumns: template }}>
            <div className="sch-gutter" aria-hidden="true">
              {HOURS.map((hour) => (
                <div key={hour} className="sch-hour-label">{`${String(hour).padStart(2, '0')}:00`}</div>
              ))}
            </div>
            {leftPad > 0 && spacer('body-left')}
            {windowDates.map((date) => {
              const layout = segmentsForDay(occurrences, date, timeZone);
              const pending = drag ?? selection;
              const active = pending && pending.date === date ? pending : null;
              return (
                <div
                  key={date}
                  className="sch-day"
                  data-day={date}
                  data-region="day-column"
                  tabIndex={0}
                  aria-label={`${formatDateLabel(date)} 时间网格`}
                  onPointerDown={(event) => startDrag(event, date)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={() => {
                    dragRef.current = null;
                    setDrag(null);
                  }}
                >
                  {HOURS.map((hour) => (
                    <div key={hour} className="sch-hour-cell" data-hour={hour} />
                  ))}
                  {active && (
                    <div
                      className="sch-selection"
                      data-region="selection"
                      data-day={date}
                      data-start={formatClock(active.startMinutes)}
                      data-end={formatClock(active.endMinutes)}
                      style={{
                        top: (active.startMinutes / 60) * HOUR_HEIGHT,
                        height: Math.max(10, ((active.endMinutes - active.startMinutes) / 60) * HOUR_HEIGHT)
                      }}
                    />
                  )}
                  {layout.segments.map((segment) => (
                    <button
                      key={`${segment.occurrence.key.entryId}:${segment.occurrence.key.originDate ?? 'single'}:${segment.startMinutes}`}
                      type="button"
                      className={`sch-event${segment.occurrence.state === 'active' ? '' : ' is-muted'}`}
                      data-occurrence={`${segment.occurrence.key.entryId}:${segment.occurrence.key.originDate ?? 'single'}`}
                      data-state={segment.occurrence.state}
                      style={eventRect(segment, layout.columns)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onOpen(segment.occurrence)}
                    >
                      <span className="sch-event-time">
                        {formatClock(segment.startMinutes)}
                        {segment.continuesBefore ? ' ←' : ''}
                        {segment.continuesAfter ? ' →' : ''}
                      </span>
                      <span className="sch-event-title">{titleOf(segment.occurrence)}</span>
                    </button>
                  ))}
                </div>
              );
            })}
            {rightPad > 0 && spacer('body-right')}
          </div>
        </div>
      </div>
    </div>
  );
}
