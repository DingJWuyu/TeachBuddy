/**
 * Range overview and month calendar.
 *
 * The month calendar only changes which month is shown; it never submits the
 * visible range. Picking a start and an end day (or pressing 应用 in the
 * toolbar) is what changes the grid.
 */
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { TIME_ZONES, formatRangeLabel, weekdayOf } from './model.js';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function monthStart(month) {
  return `${month}-01`;
}

function monthCells(month) {
  const first = monthStart(month);
  const leading = weekdayOf(first);
  const [year, value] = month.split('-').map(Number);
  const total = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const cells = [];
  for (let index = 0; index < leading; index += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

export function shiftMonth(month, delta) {
  const [year, value] = month.split('-').map(Number);
  const total = year * 12 + (value - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12 + 12) % 12 + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

export default function RangeOverview({
  from,
  to,
  month,
  onMonth,
  onPick,
  timeZone,
  occurrenceCount,
  unscheduledCount,
  settings,
  onSettingsOpen,
  onSettingsClose,
  settingsOpen,
  onUpdateTimeZone,
  settingsState
}) {
  const cells = monthCells(month);
  return (
    <div className="sch-overview" data-region="range-overview">
      <section className="sch-overview-block">
        <h2>{formatRangeLabel(from, to)}</h2>
        <p className="wb-muted">{`${occurrenceCount} 段安排 · ${unscheduledCount} 项未排期`}</p>
      </section>

      <section className="sch-month" data-region="month-calendar">
        <header>
          <button type="button" className="wb-icon-button" aria-label="上个月" data-action="prev-month" onClick={() => onMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <span data-month={month}>{`${month.slice(0, 4)}年${MONTH_NAMES[Number(month.slice(5, 7)) - 1]}`}</span>
          <button type="button" className="wb-icon-button" aria-label="下个月" data-action="next-month" onClick={() => onMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </header>
        <div className="sch-month-grid">
          {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
            <span key={label} className="sch-month-week">{label}</span>
          ))}
          {cells.map((date, index) => (
            date === null
              ? <span key={`empty-${index}`} />
              : (
                <button
                  key={date}
                  type="button"
                  className={`sch-month-day${date === from || date === to ? ' is-edge' : ''}${date > from && date < to ? ' is-inside' : ''}`}
                  data-day={date}
                  aria-label={date}
                  aria-pressed={date >= from && date <= to}
                  onClick={() => onPick(date)}
                >
                  {Number(date.slice(8, 10))}
                </button>
              )
          ))}
        </div>
      </section>

      <section className="sch-overview-block">
        <button
          type="button"
          className="sch-list-head"
          aria-expanded={Boolean(settingsOpen)}
          data-action="toggle-timezone"
          onClick={() => (settingsOpen ? onSettingsClose() : onSettingsOpen())}
        >
          <span>显示时区：{timeZone}</span>
          <span className="sch-caret" aria-hidden="true">{settingsOpen ? '▾' : '▸'}</span>
        </button>
        <ModulePresence present={settingsOpen} mode="collapse">
        {settingsOpen && (
          <div className="sch-timezone" data-region="timezone-settings">
            <select
              className="wb-input"
              name="timezone-select"
              value={settings.timeZone}
              onChange={(event) => onUpdateTimeZone(event.target.value)}
            >
              {[...new Set([settings.timeZone, ...TIME_ZONES])]
                .map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
            <p className="wb-muted">只改变显示与新建默认，已有安排的实际时刻不变。</p>
            {settingsState?.status === 'error' && (
              <p className="sch-save is-error" data-region="timezone-state">{settingsState.problem?.message || '设置未保存'}</p>
            )}
            {settingsState?.status === 'unconfirmed' && (
              <p className="sch-save is-warn" data-region="timezone-state">设置结果未确认，重新打开后重试</p>
            )}
          </div>
        )}
        </ModulePresence>
      </section>
    </div>
  );
}
