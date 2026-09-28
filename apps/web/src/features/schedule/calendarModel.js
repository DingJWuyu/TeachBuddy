import { addDays, diffDays, instantAt, localParts } from './zoned.js';
import { formatClock, parseClock, todayInZone, titleOf } from './model.js';
export { addDays, diffDays, formatClock, parseClock, todayInZone, titleOf };
export const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
export const COLORS = ['#ff6b75', '#3edc81', '#5b9cf5', '#a78bfa', '#ffb454', '#f27ab8', '#43c6c6', '#9ba0aa'];
export const dateOnly = date => date.toISOString().slice(0, 10);
export const weekday = date => new Date(`${date}T00:00:00Z`).getUTCDay();
export const monday = date => addDays(date, -(weekday(date) + 6) % 7);
export function shiftMonth(month, amount) {
  const [year, value] = month.split('-').map(Number);
  return dateOnly(new Date(Date.UTC(year, value - 1 + amount, 1))).slice(0, 7);
}
export const monthDays = month => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export const monthTitle = date => ({ month: MONTHS[Number(date.slice(5, 7)) - 1], year: date.slice(0, 4) });
export const blankCalendar = () => ({ allDay: false, notes: '', tags: [] });
export function contentOf(entry) {
  return { title: entry.title, items: structuredClone(entry.items ?? []), time: entry.time ? { ...entry.time } : null,
    repeat: entry.repeat ? structuredClone(entry.repeat) : null,
    course: structuredClone(entry.course ?? { classId: null, lessonId: null, recordIds: [] }),
    reminder: entry.reminder ? { ...entry.reminder } : null, calendar: structuredClone(entry.calendar ?? blankCalendar()) };
}
export function newContent(zone, start, end, allDay = false) {
  const date = start?.slice(0, 10) ?? todayInZone(zone);
  const startTime = allDay ? '00:00' : start?.slice(11, 16) || '09:00';
  const duration = end ? allDay ? diffDays(date, end.slice(0, 10)) * 1440
    : Math.round((instantAt(zone, end.slice(0, 10), parseClock(end.slice(11, 16))) - instantAt(zone, date, parseClock(startTime))) / 60000) : allDay ? 1440 : 60;
  return { title: '', items: [], time: { date, startTime, timeZone: zone, durationMinutes: Math.max(5, duration) },
    repeat: null, course: { classId: null, lessonId: null, recordIds: [] }, reminder: null, calendar: { ...blankCalendar(), allDay } };
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
export function contentProblem(content) {
  if (!content.title.trim() && !content.items.some(item => item.text.trim())) return '请输入任务标题';
  if (content.items.some(item => !item.text.trim())) return '请填写空白事项，或将它移除';
  if (content.time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(content.time.date) || content.time.date < '1900-01-01' || content.time.date > '2100-12-31') return '请选择有效日期';
    if (parseClock(content.time.startTime) === null) return '请选择开始时间';
    if (!Number.isInteger(content.time.durationMinutes) || content.time.durationMinutes <= 0) return '结束时间需要晚于开始时间';
    if (content.time.durationMinutes > 527040) return '单次任务最多跨越 366 天';
    if (endOf(content).date > '2100-12-31') return '结束日期超出可用范围';
    if (content.repeat?.until < content.time.date) return '重复结束日期不能早于开始日期';
  }
  return null;
}
export function eventOf(occurrence, zone, labels) {
  const start = localParts(zone, Date.parse(occurrence.startsAt));
  const end = localParts(zone, Date.parse(occurrence.endsAt));
  const color = labels.find(label => occurrence.calendar?.tags.includes(label.id))?.color ?? '#9ba0aa';
  return { id: `${occurrence.key.entryId}:${occurrence.key.originDate ?? ''}`, title: titleOf(occurrence),
    start: `${start.date}T${formatClock(start.minutes)}:00`, end: `${end.date}T${formatClock(end.minutes)}:00`,
    allDay: occurrence.calendar?.allDay ?? false, backgroundColor: `${color}24`, borderColor: 'transparent', textColor: 'var(--app-text)',
    extendedProps: { occurrence, color } };
}
export function timeFromEvent(event, zone) {
  const start = event.startStr.slice(0, 10);
  const startTime = event.allDay ? '00:00' : event.startStr.slice(11, 16);
  const end = event.endStr || `${addDays(start, 1)}T00:00:00Z`;
  const schedulingZone = event.extendedProps?.occurrence?.time.timeZone ?? zone;
  if (event.allDay) return { date: start, startTime: '00:00', durationMinutes: diffDays(start, end.slice(0, 10)) * 1440, timeZone: schedulingZone };
  const startMs = instantAt(zone, start, parseClock(startTime));
  const endMs = instantAt(zone, end.slice(0, 10), parseClock(end.slice(11, 16) || '00:00'));
  const local = localParts(schedulingZone, startMs);
  return { date: local.date, startTime: formatClock(local.minutes), durationMinutes: Math.round((endMs - startMs) / 60000), timeZone: schedulingZone };
}
export function presetRepeat(kind, date) {
  if (kind === 'none') return null;
  return { until: '2100-12-31', frequency: kind === 'weekdays' ? 'weekly' : kind === 'biweekly' ? 'weekly' : kind === 'monthly-weekday' ? 'monthly' : kind,
    interval: kind === 'biweekly' ? 2 : 1, weekdays: kind === 'weekdays' ? [1, 2, 3, 4, 5] : [weekday(date)],
    monthly: kind === 'monthly-weekday' ? 'weekday' : 'date', count: 0 };
}
export function repeatLabel(repeat) {
  if (!repeat) return '不重复';
  const unit = { daily: '天', weekly: '周', monthly: '月', yearly: '年' }[repeat.frequency ?? 'weekly'];
  return `每${(repeat.interval ?? 1) > 1 ? repeat.interval : ''}${unit}`;
}
