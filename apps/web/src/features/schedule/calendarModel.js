import i18n from "../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "schedule", ...options });
import { addDays, diffDays, instantAt, localParts } from './zoned.js';
import { formatClock, parseClock, todayInZone, titleOf } from './model.js';
export { addDays, diffDays, formatClock, todayInZone, titleOf };

export const COLORS = ['#ff6b75', '#3edc81', '#5b9cf5', '#a78bfa', '#ffb454', '#f27ab8', '#43c6c6', '#9ba0aa'];
const dateOnly = date => date.toISOString().slice(0, 10);
export const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();
export const monday = date => addDays(date, -(weekday(date) + 6) % 7);
export function shiftMonth(month, amount) {
  const [year, value] = month.split('-').map(Number);
  return dateOnly(new Date(Date.UTC(year, value - 1 + amount, 1))).slice(0, 7);
}
export const monthDays = month => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export const monthTitle = date => ({ month: new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'long', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`)), year: date.slice(0, 4) });
const blankCalendar = () => ({ allDay: false, notes: '', tags: [] });
export function contentOf(entry) {
  return { title: entry.title, items: structuredClone(entry.items ?? []), time: entry.time ? { ...entry.time } : null,
    repeat: entry.repeat ? structuredClone(entry.repeat) : null,
    reminder: entry.reminder ? { ...entry.reminder } : null, calendar: structuredClone(entry.calendar ?? blankCalendar()) };
}
export function defaultTime(zone) {
  const current = localParts(zone, Date.now());
  return { date: current.date, startTime: formatClock(Math.floor(current.minutes / 5) * 5), durationMinutes: 60, timeZone: zone };
}
export function newContent(zone, start, end, allDay = false) {
  const defaults = defaultTime(zone);
  const date = start?.slice(0, 10) ?? defaults.date;
  const startTime = allDay ? '00:00' : start?.slice(11, 16) || defaults.startTime;
  const duration = end ? allDay ? diffDays(date, end.slice(0, 10)) * 1440
    : Math.round((instantAt(zone, end.slice(0, 10), parseClock(end.slice(11, 16))) - instantAt(zone, date, parseClock(startTime))) / 60000) : allDay ? 1440 : 60;
  return { title: '', items: [], time: { date, startTime, timeZone: zone, durationMinutes: Math.max(5, duration) },
    repeat: null, reminder: null, calendar: { ...blankCalendar(), allDay } };
}
export function endOf(content) {
  if (!content.time) return { date: '', time: '' };
  const { date, startTime, durationMinutes, timeZone } = content.time;
  if (!date || parseClock(startTime) === null || !Number.isFinite(durationMinutes)) return { date: '', time: '' };
  if (content.calendar.allDay) return { date: addDays(date, durationMinutes / 1440 - 1), time: '00:00' };
  const end = localParts(timeZone, instantAt(timeZone, date, parseClock(startTime)) + durationMinutes * 60000);
  return { date: end.date, time: formatClock(end.minutes) };
}
export function changeEnd(content, date, clock) {
  const startMinutes = parseClock(content.time.startTime);
  const endMinutes = parseClock(clock);
  if (!date || !content.time.date || startMinutes === null || endMinutes === null) return content.time;
  if (content.calendar.allDay) return { ...content.time, durationMinutes: (diffDays(content.time.date, date) + 1) * 1440 };
  const start = instantAt(content.time.timeZone, content.time.date, startMinutes);
  const end = instantAt(content.time.timeZone, date, endMinutes);
  return { ...content.time, durationMinutes: Math.round((end - start) / 60000) };
}
export function timeRangeLabel(content) {
  if (!content?.time) return '';
  const end = endOf(content);
  const start = content.time;
  if (content.calendar.allDay) return `${start.date}${end.date !== start.date ? ` - ${end.date}` : ''} · ${t("全天")}`;
  return `${start.date} ${start.startTime} - ${end.date !== start.date ? `${end.date} ` : ''}${end.time}`;
}
export function endTimeProblem(content) {
  if (!content.time) return null;
  if (!Number.isInteger(content.time.durationMinutes) || content.time.durationMinutes <= 0) return t("结束时间需要晚于开始时间");
  if (content.time.durationMinutes > 527040) return t("单次任务最多跨越 366 天");
  if (endOf(content).date > '2100-12-31') return t("结束日期超出可用范围");
  return null;
}
export function timeProblem(content) {
  if (content.time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(content.time.date) || content.time.date < '1900-01-01' || content.time.date > '2100-12-31') return t("请选择有效日期");
    if (parseClock(content.time.startTime) === null) return t("请选择开始时间");
    const endIssue = endTimeProblem(content);
    if (endIssue) return endIssue;

  }
  return null;
}
export function contentProblem(content) {
  if (!content.title.trim() && !content.items.some(item => item.text.trim())) return t("请输入任务标题");
  const issue = timeProblem(content);
  if (issue) return issue;
  if (content.time && content.repeat?.until < content.time.date) return t("重复结束日期不能早于开始日期");
  return null;
}
export function eventOf(occurrence, zone, labels) {
  const start = localParts(zone, Date.parse(occurrence.startsAt));
  const end = localParts(zone, Date.parse(occurrence.endsAt));
  const color = labels.find(label => occurrence.calendar?.tags.includes(label.id))?.color ?? '#9ba0aa';
  const [red, green, blue] = color.slice(1).match(/../g).map(channel => parseInt(channel, 16));
  const selectedTextColor = red * .299 + green * .587 + blue * .114 > 160 ? '#2e3137' : '#fff';
  const displayDays = Math.max(1, diffDays(start.date, end.date) + (!occurrence.calendar?.allDay && end.minutes > 0 ? 1 : 0));
  return { id: `${occurrence.key.entryId}:${occurrence.key.originDate ?? ''}`, title: titleOf(occurrence),
    start: `${start.date}T${formatClock(start.minutes)}:00`, end: `${end.date}T${formatClock(end.minutes)}:00`,
    allDay: occurrence.calendar?.allDay ?? false, backgroundColor: `color-mix(in srgb, ${color} 14%, var(--app-surface))`, borderColor: 'transparent', textColor: 'var(--app-text)',
    extendedProps: { occurrence, color, selectedTextColor, displayDays } };
}
export function timeFromEvent(event, zone) {
  const start = event.startStr.slice(0, 10);
  const startTime = event.allDay ? '00:00' : event.startStr.slice(11, 16);
  const end = event.endStr || `${addDays(start, 1)}T00:00:00Z`;
  const occurrence = event.extendedProps?.occurrence;
  const schedulingZone = occurrence?.time.timeZone ?? zone;
  if (event.allDay) {
    const days = diffDays(start, end.slice(0, 10));
    if (occurrence?.calendar?.allDay) {
      // 全天卡片所在的显示日期可能与排课日期不同，移动和拉伸都应用日期增量。
      const previousStart = localParts(zone, Date.parse(occurrence.startsAt)).date;
      const previousEnd = localParts(zone, Date.parse(occurrence.endsAt)).date;
      return { ...occurrence.time, date: addDays(occurrence.time.date, diffDays(previousStart, start)),
        durationMinutes: occurrence.time.durationMinutes + (days - diffDays(previousStart, previousEnd)) * 1440 };
    }
    return { date: start, startTime: '00:00', durationMinutes: 1440, timeZone: zone };
  }
  const startMs = instantAt(zone, start, parseClock(startTime));
  const endMs = instantAt(zone, end.slice(0, 10), parseClock(end.slice(11, 16) || '00:00'));
  const local = localParts(schedulingZone, startMs);
  return { date: local.date, startTime: formatClock(local.minutes), durationMinutes: occurrence?.calendar?.allDay ? 60 : Math.round((endMs - startMs) / 60000), timeZone: schedulingZone };
}
export function presetRepeat(kind, date) {
  if (kind === 'none') return null;
  return { until: '2100-12-31', frequency: kind === 'weekdays' ? 'weekly' : kind === 'biweekly' ? 'weekly' : kind === 'monthly-weekday' ? 'monthly' : kind,
    interval: kind === 'biweekly' ? 2 : 1, weekdays: kind === 'weekdays' ? [1, 2, 3, 4, 5] : [weekday(date)],
    monthly: kind === 'monthly-weekday' ? 'weekday' : 'date', count: 0 };
}
export function repeatAnchor(date, rule, { day, month, ordinal, dayOfWeek }, anchor = date) {
  const interval = rule.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) return null;
  if (rule.frequency === 'daily') return addDays(anchor, Math.max(0, Math.ceil(diffDays(anchor, date) / interval)) * interval);
  if (rule.frequency === 'weekly') {
    const firstWeek = monday(anchor);
    let start = addDays(firstWeek, Math.max(0, Math.ceil(diffDays(firstWeek, monday(date)) / (7 * interval))) * 7 * interval);
    const candidates = rule.weekdays.map(value => addDays(start, (value + 6) % 7)).sort();
    return candidates.find(value => value >= date && value >= anchor) ?? (candidates[0] && addDays(candidates[0], 7 * interval));
  }
  if (rule.frequency === 'yearly') {
    let started = false;
    for (let year = Number(anchor.slice(0, 4)); year <= 2100; year += started ? interval : 1) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const candidate = `${prefix}-${String(day).padStart(2, '0')}`;
      if (day > monthDays(prefix) || candidate < anchor) continue;
      started = true;
      if (candidate >= date) return candidate;
    }
    return null;
  }
  let prefix = anchor.slice(0, 7);
  let started = false;
  while (prefix <= '2100-12') {
    const first = `${prefix}-01`;
    const value = rule.monthly === 'weekday' ? 1 + (dayOfWeek - weekday(first) + 7) % 7 + (ordinal - 1) * 7 : day;
    const candidate = `${prefix}-${String(value).padStart(2, '0')}`;
    if (value <= monthDays(prefix) && candidate >= anchor) {
      started = true;
      if (candidate >= date) return candidate;
    }
    prefix = shiftMonth(prefix, started ? interval : 1);
  }
  return null;
}

export function repeatLabel(repeat, date) {
  if (!repeat) return t("不重复");
  const frequency = repeat.frequency ?? 'weekly';
  const parts = [(repeat.interval ?? 1) === 1 ? t(`repeat.${frequency}.single`) : t(`repeat.${frequency}`, { count: repeat.interval })];
  if (frequency === 'weekly') parts.push((repeat.weekdays ?? (date ? [weekday(date)] : [])).slice().sort((a, b) => (a + 6) % 7 - (b + 6) % 7).map(value => new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`2024-01-${String(value === 0 ? 7 : value).padStart(2, '0')}T00:00:00Z`))).join('、'));
  if (frequency === 'monthly' && date) parts.push(repeat.monthly === 'weekday' ? t('第{{ordinal}}个{{weekday}}', { ordinal: t(`ordinal.${Math.ceil(Number(date.slice(8)) / 7)}`), weekday: new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) }) : t('{{day}} 日', { day: Number(date.slice(8)) }));
  if (frequency === 'yearly' && date) parts.push(t('{{month}} 月 {{day}} 日', { month: Number(date.slice(5, 7)), day: Number(date.slice(8)) }));
  if (repeat.count) parts.push(t('共 {{count}} 次', { count: repeat.count }));
  else if (repeat.until && repeat.until !== '2100-12-31') parts.push(t('至 {{date}}', { date: repeat.until }));
  return parts.filter(Boolean).join(' · ');
}
