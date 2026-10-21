import { Icon as Icon2 } from '../icons.jsx';
import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from './classNames.js';
import { tx, isEnglish } from '../../i18n/presentation.js';

/*
 * Date and time pickers drawn by us (not the browser's), so they look the same
 * everywhere, respect the interface language and can never leave the window.
 * Dates are YYYY-MM-DD strings, times are HH:MM.
 */
const pad = (n) => String(n).padStart(2, '0');
const toDate = (s) => new Date(`${s}T12:00:00Z`);
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

function Glyph({ name, size = 16 }) {
  return <Icon2 name={name} size={size} strokeWidth={2} />;
}

function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return isEnglish()
    ? new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : `${y}年${m}月`;
}

const monthName = (m) => (isEnglish()
  ? new Date(Date.UTC(2000, m - 1, 15)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  : `${m}月`);
const yearName = (y) => (isEnglish() ? String(y) : `${y}年`);

/*
 * A month calendar. Its title opens the months of that year, and the year
 * opens a page of twelve years, so any date is two clicks away instead of a
 * long run of arrow presses. Picking a year or month drills back down.
 */
export function DatePicker({ value, min, max, today, onChange }) {
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const [level, setLevel] = useState('days'); // days → months → years
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lead = (toDate(first).getUTCDay() + 6) % 7; // Monday first
  const start = addDays(first, -lead);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const shift = (n) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  };
  const step = level === 'days' ? 1 : level === 'months' ? 12 : 144;
  const pageStart = y - ((y % 12) + 12) % 12; // twelve years per page
  const weekdays = isEnglish() ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['一', '二', '三', '四', '五', '六', '日'];
  const pickedMonth = value?.slice(0, 7);
  const minMonth = min?.slice(0, 7);
  const maxMonth = max?.slice(0, 7);
  const minYear = min ? Number(min.slice(0, 4)) : null;
  const maxYear = max ? Number(max.slice(0, 4)) : null;
  const canShift = (direction) => {
    if (level === 'days') {
      const date = new Date(Date.UTC(y, m - 1 + direction, 1));
      const target = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
      return !(minMonth && target < minMonth) && !(maxMonth && target > maxMonth);
    }
    const firstYear = level === 'months' ? y + direction : pageStart + direction * 12;
    const lastYear = level === 'months' ? firstYear : firstYear + 11;
    return !(minYear !== null && lastYear < minYear) && !(maxYear !== null && firstYear > maxYear);
  };
  const title = level === 'days' ? monthTitle(month) : level === 'months' ? yearName(y) : `${pageStart} – ${pageStart + 11}`;
  return (
    <div className="tbx-datepicker" data-level={level}>
      <header>
        <button type="button" className="tbx-datepicker-title" disabled={level === 'years'} aria-label={level === 'days' ? tx('选择年月') : tx('选择年份')} onClick={() => setLevel(level === 'days' ? 'months' : 'years')}>
          <strong>{title}</strong>
          {level !== 'years' && <Glyph name="chevron" size={13} />}
        </button>
        <span>
          <button type="button" aria-label={tx(level === 'days' ? '上个月' : '上一页')} disabled={!canShift(-1)} onClick={() => shift(-step)}><Glyph name="chevron" size={15} /></button>
          <button type="button" aria-label={tx(level === 'days' ? '下个月' : '下一页')} disabled={!canShift(1)} onClick={() => shift(step)}><Glyph name="chevron" size={15} /></button>
        </span>
      </header>
      {level === 'days' && (
        <div className="tbx-datepicker-grid" role="grid" key={`d${month}`}>
          {weekdays.map((w, i) => <span key={`w${i}`} className="tbx-datepicker-weekday">{w}</span>)}
          {days.map((d) => (
            <button
              key={d}
              type="button"
              disabled={Boolean((min && d < min) || (max && d > max))}
              className={cx(d.slice(0, 7) !== month && 'is-outside', d === today && 'is-today', d === value && 'is-selected')}
              aria-pressed={d === value}
              aria-label={d}
              onClick={() => onChange(d)}
            >
              {Number(d.slice(8))}
            </button>
          ))}
        </div>
      )}
      {level === 'months' && (
        <div className="tbx-datepicker-cells" key={`m${y}`}>
          {Array.from({ length: 12 }, (_, i) => {
            const key = `${y}-${pad(i + 1)}`;
            return (
              <button key={key} type="button" disabled={Boolean((minMonth && key < minMonth) || (maxMonth && key > maxMonth))} className={cx(key === pickedMonth && 'is-selected', key === today?.slice(0, 7) && 'is-today')} onClick={() => { setMonth(key); setLevel('days'); }}>
                {monthName(i + 1)}
              </button>
            );
          })}
        </div>
      )}
      {level === 'years' && (
        <div className="tbx-datepicker-cells" key={`y${pageStart}`}>
          {Array.from({ length: 12 }, (_, i) => {
            const year = pageStart + i;
            return (
              <button key={year} type="button" disabled={Boolean((minYear !== null && year < minYear) || (maxYear !== null && year > maxYear))} className={cx(year === Number(value?.slice(0, 4)) && 'is-selected', year === Number(today?.slice(0, 4)) && 'is-today')} onClick={() => { setMonth(`${year}-${pad(m)}`); setLevel('months'); }}>
                {year}
              </button>
            );
          })}
        </div>
      )}
      {today && (
        <footer>
          <button type="button" onClick={() => onChange(today)} disabled={Boolean((min && today < min) || (max && today > max))}>{tx('今天')}</button>
        </footer>
      )}
    </div>
  );
}

/*
 * Hours on the left (0–23), minutes on the right (00–59): any minute of the
 * day in two clicks. Picking an hour keeps the picker open; picking a minute
 * finishes (onDone).
 */
export function TimePicker({ value, onChange, onDone }) {
  const [hh, mm] = (value || '09:00').split(':');
  const hours = useRef(null);
  const minutes = useRef(null);
  useLayoutEffect(() => {
    for (const col of [hours.current, minutes.current]) {
      const el = col?.querySelector('[aria-selected="true"]');
      if (el) col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.offsetHeight / 2;
    }
  }, []);
  const column = (ref, count, current, pick, label) => (
    <div className="tbx-timepicker-col" ref={ref} role="listbox" aria-label={label}>
      {Array.from({ length: count }, (_, i) => pad(i)).map((n) => (
        <button key={n} type="button" role="option" aria-selected={n === current} className={cx(n === current && 'is-selected')} onClick={() => pick(n)}>
          {n}
        </button>
      ))}
    </div>
  );
  return (
    <div className="tbx-timepicker" role="group" aria-label={tx('时间')}>
      {column(hours, 24, hh, (h) => onChange(`${h}:${mm}`), tx('时'))}
      {column(minutes, 60, mm, (m) => { onChange(`${hh}:${m}`); onDone?.(); }, tx('分'))}
    </div>
  );
}
