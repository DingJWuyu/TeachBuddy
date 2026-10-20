import { useEffect, useMemo, useRef, useLayoutEffect, useState } from 'react';
import { cx } from '../../components/ui/classNames.js';
import { tx, useLocale, monthDay, weekdayName } from '../../i18n/presentation.js';
import { useFlip } from '../../components/ui/motion.js';
import { FilterMenu } from '../../components/ui/filter.jsx';
import { G } from './EntryEditor.jsx';

/* Switch between the calendar and the task board. The change runs inside a
   view transition where the browser supports it, so the stage morphs. */
export function FocusToggle({ value = 'calendar', onChange }) {
  const locale = useLocale();
  const ref = useRef(null);
  const [thumb, setThumb] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('[aria-pressed="true"]');
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, locale]);
  function pick(next) {
    if (next === value) return;
    // the view transition morphs the stage; the panel's own column slide stays off
    const root = document.documentElement;
    root.dataset.tbxFocusSwitch = '';
    setTimeout(() => { delete root.dataset.tbxFocusSwitch; }, 700);
    const run = () => {
      onChange(next);
      // rendering is paused while the transition waits, so wait on a timer, not a frame
      return new Promise((resolve) => setTimeout(resolve, 50));
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduced) document.startViewTransition(run);
    else run();
  }
  return (
    <div className="tbx-focus" ref={ref} role="group" aria-label={tx('视图')}>
      {thumb && <span className="tbx-focus-thumb" style={{ transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` }} />}
      <button type="button" aria-pressed={value !== 'tasks'} onClick={() => pick('calendar')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
        {tx('日历')}
      </button>
      <button type="button" aria-pressed={value === 'tasks'} onClick={() => pick('tasks')}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="4" width="5" height="16" rx="2" /><rect x="10.5" y="4" width="5" height="10" rx="2" /><rect x="17.5" y="4" width="3" height="13" rx="1.5" /></svg>
        {tx('任务')}
      </button>
    </div>
  );
}

const PRIORITY = { high: '重要', low: '稍后' };

function Progress({ done, total }) {
  if (!total) return null;
  const r = 9, c = 2 * Math.PI * r, p = done / total;
  return (
    <span className={cx('tbx-progress', done === total && 'is-done')} title={tx('已完成 {{done}}/{{total}}', { done, total })}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r={r} className="tbx-progress-track" />
        <circle cx="12" cy="12" r={r} className="tbx-progress-fill" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 12 12)" />
      </svg>
      <span>{done}/{total}</span>
    </span>
  );
}

function TaskCard({ value, labels, onOpen, onClose, onToggle, timeLabel, index, active, flipRef }) {
  const occurrence = value.key ? value : null;
  const id = occurrence?.key.entryId ?? value.id;
  const origin = occurrence?.key.originDate ?? null;
  const tags = labels.filter((l) => value.calendar?.tags?.includes(l.id));
  const items = value.items || [];
  const done = items.filter((i) => i.completed).length;
  const title = value.title?.trim() || items[0]?.text || tx('未命名');
  const listed = value.title?.trim() ? items : items.slice(1);
  // the open card closes the panel again
  const open = () => (active && onClose ? onClose() : onOpen(id, origin));
  return (
    <div
      ref={flipRef}
      role="button"
      tabIndex={0}
      aria-expanded={active}
      className={cx('tbx-task', active && 'is-active', done && done === items.length && 'is-complete')}
      style={{ '--i': index, '--tag': tags[0]?.color || 'var(--tb-faint)' }}
      onClick={open}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); open(); } }}
    >
      <span className="tbx-task-top">
        {tags.length > 0 ? (
          <span className="tbx-task-tags">
            <span className="tbx-task-tag"><i /><span>{tags[0].name}</span></span>
            {tags.length > 1 && <span className="tbx-task-more" title={tags.slice(1).map((t) => t.name).join('、')}>+{tags.length - 1}</span>}
          </span>
        ) : <span className="tbx-task-tag is-none"><i />{tx('无标签')}</span>}
        {timeLabel && <time>{timeLabel}</time>}
      </span>
      <strong className="tbx-task-title">{title}</strong>
      {listed.length > 0 && (
        <ul className="tbx-task-items">
          {listed.slice(0, 5).map((item) => (
            <li key={item.id} className={cx(item.completed && 'is-done', item.priority === 'high' && 'is-high')}>
              <button
                type="button"
                className="tbx-task-item"
                aria-pressed={Boolean(item.completed)}
                title={item.completed ? tx('标为未完成') : tx('划掉')}
                onClick={(e) => { e.stopPropagation(); onToggle(value, item.id); }}
              >
                <span className="tbx-check" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5.5 12.5 4 4 9-9.5" /></svg>
                </span>
                <span className="tbx-item-text">{item.text}</span>
                {PRIORITY[item.priority] && !item.completed && <em className={`is-${item.priority}`}>{tx(PRIORITY[item.priority])}</em>}
              </button>
            </li>
          ))}
          {listed.length > 5 && <li className="tbx-more">{tx('还有 {{n}} 项', { n: listed.length - 5 })}</li>}
        </ul>
      )}
      <span className="tbx-task-foot">
        <Progress done={done} total={items.length} />
        {value.calendar?.notes ? <span className="tbx-task-note">{value.calendar.notes}</span> : null}
      </span>
    </div>
  );
}

const NO_TAG = '__none';
const filterKey = accountKey => `schedule-board-filters:${accountKey}`;
const passes = (value, filter) => !filter.length || (value.calendar?.tags?.length ? value.calendar.tags.some((t) => filter.includes(t)) : filter.includes(NO_TAG));

/* Narrow one column by labels. Several labels can be picked; "无标签" is one of
   the choices. The menu is the shared popover with the shared check marks. */
function TagFilter({ labels, value, onChange, title }) {
  const check = <span className="tbx-pop-check"><G name="check" size={14} /></span>;
  return (
    <FilterMenu
      label={tx('按标签筛选')}
      menuLabel={tx('按标签筛选')}
      menuClassName="tbx-tag-filter"
      allLabel={tx('所有标签')}
      check={check}
      value={value}
      onChange={onChange}
      options={[
        ...labels.map((l) => ({ id: l.id, name: l.name, mark: <i className="tbx-filter-dot" style={{ background: l.color }} /> })),
        { id: NO_TAG, name: tx('无标签'), mark: <i className="tbx-filter-dot is-none" /> },
      ]}
      button={({ ref, open, toggle, active, count }) => (
        <button
          ref={ref}
          type="button"
          className={cx('tbx-col-tool tbx-col-filter', active && 'is-active', open && 'is-open')}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={tx('按标签筛选“{{title}}”', { title })}
          title={tx('按标签筛选')}
          onClick={toggle}
        >
          <G name="filter" size={16} stroke={2.1} />
          <span className="tbx-col-filter-count" aria-hidden={!active}>{count || ''}</span>
        </button>
      )}
    />
  );
}

function Column({ title, count, total, tone, children, onNew, empty, filter, onClearFilter }) {
  const filtered = total > 0 && count === 0;
  return (
    <section className={cx('tbx-col', tone && `is-${tone}`)}>
      <header className="tbx-col-head">
        <h3>{title}<span>{count}</span></h3>
        <span className="tbx-col-tools">
          {filter}
          {onNew && (
            <button type="button" className="tbx-col-add" onClick={onNew} aria-label={tx('在“{{title}}”新建', { title })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          )}
        </span>
      </header>
      <div className="tbx-col-body">
        {filtered ? (
          <div className="tbx-col-empty is-filtered">
            {tx('没有符合筛选的任务')}
            <button type="button" className="tbx-col-clear" onClick={onClearFilter}>{tx('显示全部')}</button>
          </div>
        ) : count === 0 ? <div className="tbx-col-empty">{empty}</div> : children}
      </div>
    </section>
  );
}

export function TaskBoard({ entries, occurrences, daily, labels, zone, now, today, draft, draftId, onOpen, onClose, onNew, onToggle, accountKey, helpers }) {
  useLocale();
  const { localParts, formatClock } = helpers;
  const clock = (iso) => formatClock(localParts(zone, Date.parse(iso)).minutes);
  const range = (o) => (o.calendar?.allDay ? tx('全天') : `${clock(o.startsAt)} – ${clock(o.endsAt)}`);
  const dateOf = (iso) => localParts(zone, Date.parse(iso)).date;
  const dayLabel = (date) => {
    const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    const md = monthDay(date);
    return { name: diff === 1 ? tx('明天') : diff === 2 ? tx('后天') : weekdayName(date), md };
  };

  // Ticks show at once; the server copy catches up on the next reload.
  const [ticks, setTicks] = useState({});
  // fresh data from the schedule replaces the optimistic ticks, so a change made
  // in the panel afterwards is never hidden behind an old tick
  useEffect(() => { setTicks({}); }, [entries, occurrences, daily]);
  const withTicks = (v) => {
    const key = v.key ? `${v.key.entryId}:${v.key.originDate}` : v.id;
    const t = ticks[key];
    return t ? { ...v, items: (v.items || []).map((i) => (i.id in t ? { ...i, completed: t[i.id] } : i)) } : v;
  };
  async function toggle(value, itemId) {
    const key = value.key ? `${value.key.entryId}:${value.key.originDate}` : value.id;
    const next = !(withTicks(value).items || []).find(item => item.id === itemId)?.completed;
    setTicks(current => ({ ...current, [key]: { ...current[key], [itemId]: next } }));
    const ok = await onToggle(value, itemId, next);
    if (!ok) setTicks(current => ({ ...current, [key]: { ...current[key], [itemId]: !next } }));
  }

  const { todayItems, laterGroups, unscheduled } = useMemo(() => {
    const sort = (a, b) => a.startsAt.localeCompare(b.startsAt);
    const todayItems = daily.filter((o) => Date.parse(o.endsAt) > now).sort(sort);
    const later = occurrences.filter((o) => dateOf(o.startsAt) > today).sort(sort);
    const laterGroups = [];
    for (const o of later) {
      const d = dateOf(o.startsAt);
      let g = laterGroups.find((x) => x.date === d);
      if (!g) laterGroups.push(g = { date: d, items: [] });
      g.items.push(o);
    }
    const unscheduled = entries.filter((e) => !e.time).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { todayItems, laterGroups, unscheduled };
  }, [entries, occurrences, daily, now, today, zone]);

  // per-column label filters, remembered in this browser
  const [filters, setFilterState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(filterKey(accountKey))) || {}; } catch { return {}; }
  });
  const known = new Set([...labels.map((l) => l.id), NO_TAG]);
  const filterOf = (col) => (filters[col] || []).filter((id) => known.has(id));
  const setFilter = (col, value) => {
    flipRef.capture();
    setFilterState((f) => {
      const next = { ...f, [col]: value };
      try { localStorage.setItem(filterKey(accountKey), JSON.stringify(next)); } catch { /* private window */ }
      return next;
    });
  };
  const flipRef = useFlip(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSettled(true), 1200); return () => clearTimeout(t); }, []);

  const shownToday = todayItems.filter((o) => passes(o, filterOf('today')));
  const shownLater = laterGroups.map((g) => ({ ...g, items: g.items.filter((o) => passes(o, filterOf('later'))) })).filter((g) => g.items.length);
  const shownInbox = unscheduled.filter((e) => passes(e, filterOf('inbox')));
  const laterTotal = laterGroups.reduce((n, g) => n + g.items.length, 0);
  const laterCount = shownLater.reduce((n, g) => n + g.items.length, 0);
  const isActive = (v) => (v.key ? v.key.entryId : v.id) === draftId && (draft?.origin ?? null) === (v.key?.originDate ?? null);
  // the open task shows what the panel holds right now, ticks and edits included
  const live = (v) => (isActive(v) && draft?.content ? { ...v, title: draft.content.title, items: draft.content.items, calendar: { ...v.calendar, ...draft.content.calendar } } : withTicks(v));
  let index = 0;
  const card = (v, timeLabel, key) => (
    <TaskCard key={key} value={live(v)} labels={labels} onOpen={onOpen} onClose={onClose} onToggle={toggle} active={isActive(v)} timeLabel={timeLabel} index={index++} flipRef={flipRef(key)} />
  );
  const filterFor = (col, title) => labels.length > 0 && <TagFilter labels={labels} title={title} value={filterOf(col)} onChange={(v) => setFilter(col, v)} />;

  return (
    <div className={cx('tbx-board', settled && 'is-settled')}>
      <div className="tbx-columns">
        <Column title={tx('今天')} count={shownToday.length} total={todayItems.length} tone="today" onNew={() => onNew(false)} empty={tx('今天的安排都结束了，喝口水吧。')} filter={filterFor('today', tx('今天'))} onClearFilter={() => setFilter('today', [])}>
          {shownToday.map((o) => card(o, range(o), `${o.key.entryId}:${o.key.originDate}`))}
        </Column>
        <Column title={tx('接下来')} count={laterCount} total={laterTotal} empty={tx('这几天还没有别的安排。')} filter={filterFor('later', tx('接下来'))} onClearFilter={() => setFilter('later', [])}>
          {shownLater.map((g) => (
            <div className="tbx-day" key={g.date}>
              <h4>{dayLabel(g.date).name}<span>{dayLabel(g.date).md}</span></h4>
              {g.items.map((o) => card(o, range(o), `${o.key.entryId}:${o.key.originDate}`))}
            </div>
          ))}
        </Column>
        <Column title={tx('待安排')} count={shownInbox.length} total={unscheduled.length} tone="inbox" onNew={() => onNew(true)} empty={tx('收件箱空了。想到要做的事，随手记在这里。')} filter={filterFor('inbox', tx('待安排'))} onClearFilter={() => setFilter('inbox', [])}>
          {shownInbox.map((e) => card(e, null, e.id))}
        </Column>
      </div>
    </div>
  );
}
