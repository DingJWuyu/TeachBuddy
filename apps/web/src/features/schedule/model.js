import i18n from "../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "schedule", ...options });
/**
 * Pure schedule helpers: draft conversion, labels, day layout and the global
 * priority view. No React and no I/O, so the grid and the panels stay thin.
 */
import { diffDays, instantAt, localParts, parseDateParts } from './zoned.js';

export const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };
export const PRIORITY_LABEL = { high: '高', normal: '普通', low: '低' };
export const PRIORITY_VALUES = ['high', 'normal', 'low'];
export const TIME_ZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'UTC'
];
export const SNAP_MINUTES = 15;
export const HOUR_HEIGHT = 44;
export const MIN_COLUMN_WIDTH = 160;
export const DEFAULT_RANGE_DAYS = 7;


export function todayInZone(zone) {
  return localParts(zone, Date.now()).date;
}

export function parseClock(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(minutes) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function snapMinutes(minutes, step = SNAP_MINUTES) {
  return Math.max(0, Math.min(1440, Math.round(minutes / step) * step));
}

export function weekdayOf(date) {
  const parts = parseDateParts(date);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function weekdayLabel(date) {
  const index = weekdayOf(date);
  return index === null ? '' : new Intl.DateTimeFormat(i18n.resolvedLanguage, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export function formatDateLabel(date) {
  const parts = parseDateParts(date);
  if (!parts) return date;
  return new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

export function formatRangeLabel(from, to) {
  const days = diffDays(from, to) + 1;
  return t("{{value}} - {{detail}} · {{days}} 天", { value: formatDateLabel(from), detail: formatDateLabel(to), days: days });
}

export function formatInstantLabel(iso, zone) {
  if (!iso) return '';
  const parts = localParts(zone, Date.parse(iso));
  return `${formatDateLabel(parts.date)} ${formatClock(parts.minutes)}`;
}

export function titleOf(entry) {
  const title = String(entry?.title ?? '').trim();
  if (title !== '') return title;
  const item = String(entry?.items?.[0]?.text ?? '').trim();
  return item !== '' ? item : t("未命名安排");
}

/** Exact reminder instant text for the current draft, or null when unset. */
export function reminderInstant(draft, zone) {
  if (draft.unscheduled || !draft.reminder || !draft.time || !parseDateParts(draft.time.date)
    || parseClock(draft.time.startTime) === null) return null;
  const minutes = Number(draft.reminder.minutes);
  const duration = Number(draft.time.durationMinutes);
  if (draft.reminder.minutes === '' || !Number.isInteger(minutes) || minutes < 0 || minutes > 10080
    || !Number.isInteger(duration) || duration < 1 || duration > 1440) return null;
  const start = instantAt(draft.time.timeZone || zone, draft.time.date, parseClock(draft.time.startTime) ?? 0);
  const end = start + (Number(draft.time.durationMinutes) || 0) * 60_000;
  const offset = Number(draft.reminder.minutes) * 60_000;
  const due = draft.reminder.side === 'before' ? end - offset : end + offset;
  return new Date(due).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Non-existent wall times (DST spring-forward) are not shown silently: the
 * editor reports the instant the server will actually store, matching the
 * grid that always places instances by their real `startsAt`.
 */
export function dstAdjustment(draft) {
  if (!draft?.time || !parseDateParts(draft.time.date)) return null;
  const minutes = parseClock(draft.time.startTime);
  if (minutes === null) return null;
  const ms = instantAt(draft.time.timeZone, draft.time.date, minutes);
  const local = localParts(draft.time.timeZone, ms);
  if (local.date === draft.time.date && local.minutes === minutes) return null;
  return { date: local.date, startTime: formatClock(local.minutes), timeZone: draft.time.timeZone };
}

/** Occurrence time in the account zone, used to place it on the grid. */
export function occurrencePlacement(occurrence, zone) {
  const startMs = Date.parse(occurrence.startsAt);
  const endMs = Date.parse(occurrence.endsAt);
  const start = localParts(zone, startMs);
  const end = localParts(zone, endMs);
  return { startMs, endMs, startDate: start.date, startMinutes: start.minutes, endDate: end.date, endMinutes: end.minutes };
}

/**
 * Segments of one day column with overlap columns. A segment that spans the
 * whole day is clamped to the column; the caller keeps the real start/end.
 */
export function layoutDay(segments) {
  const sorted = [...segments].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
  const columns = [];
  const placed = [];
  for (const segment of sorted) {
    let columnIndex = columns.findIndex((end) => end <= segment.startMinutes);
    if (columnIndex < 0) {
      columns.push(segment.endMinutes);
      columnIndex = columns.length - 1;
    } else {
      columns[columnIndex] = segment.endMinutes;
    }
    placed.push({ ...segment, column: columnIndex });
  }
  return { segments: placed, columns: Math.max(1, columns.length) };
}

/**
 * The global priority view: every unscheduled item plus every instance in the
 * returned range, grouped high/normal/low. Inside a group unscheduled items come
 * first, then start instant, then entryId, originDate and array position.
 */
export function buildPriorityRows(occurrences, unscheduledEntries) {
  const rows = [];
  for (const entry of unscheduledEntries) {
    entry.items.forEach((item, index) => {
      rows.push({
        kind: 'unscheduled',
        entryId: entry.id,
        originDate: null,
        itemId: item.id,
        item,
        index,
        sortStart: Number.NEGATIVE_INFINITY,
        label: titleOf(entry)
      });
    });
  }
  for (const occurrence of occurrences) {
    occurrence.items.forEach((item, index) => {
      rows.push({
        kind: 'scheduled',
        entryId: occurrence.key.entryId,
        originDate: occurrence.key.originDate,
        itemId: item.id,
        item,
        index,
        sortStart: Date.parse(occurrence.startsAt),
        label: titleOf(occurrence)
      });
    });
  }
  return rows.sort((a, b) => {
    const priority = (PRIORITY_ORDER[a.item.priority] ?? 3) - (PRIORITY_ORDER[b.item.priority] ?? 3);
    if (priority !== 0) return priority;
    if (a.sortStart !== b.sortStart) return a.sortStart < b.sortStart ? -1 : 1;
    if (a.entryId !== b.entryId) return a.entryId < b.entryId ? -1 : 1;
    const left = a.originDate ?? '';
    const right = b.originDate ?? '';
    if (left !== right) return left < right ? -1 : 1;
    return a.index - b.index;
  });
}

export function groupPriorityRows(rows) {
  return {
    high: rows.filter((row) => row.item.priority === 'high'),
    normal: rows.filter((row) => row.item.priority === 'normal'),
    low: rows.filter((row) => row.item.priority === 'low')
  };
}

function emptyCourse() {
  return { classId: null, lessonId: null, recordIds: [] };
}

/** Draft used by the editor; the same shape for create, edit and override. */
export function emptyDraft({ date = '', startTime = '', durationMinutes = 60, timeZone = 'Asia/Shanghai' } = {}) {
  return {
    title: '',
    items: [],
    unscheduled: date === '',
    time: { date, startTime, timeZone, durationMinutes },
    weekly: false,
    until: date,
    reminder: null,
    course: emptyCourse()
  };
}

/** Entry or override content -> editor draft. */
export function draftFromContent({ entry, content = null, unscheduled = false, weekly = false, until = null }) {
  const source = content ?? entry;
  const time = source.time;
  return {
    title: source.title ?? '',
    items: (source.items ?? []).map((item) => ({ ...item })),
    unscheduled: unscheduled || time === null,
    time: time === null
      ? { date: '', startTime: '09:00', timeZone: 'Asia/Shanghai', durationMinutes: 60 }
      : { ...time },
    weekly,
    until: until ?? (time ? time.date : ''),
    reminder: source.reminder ? { ...source.reminder } : null,
    course: source.course
      ? {
        classId: source.course.classId,
        lessonId: source.course.lessonId,
        recordIds: [...(source.course.recordIds ?? [])]
      }
      : emptyCourse()
  };
}

function cleanItems(items) {
  return items
    .map((item) => ({ id: item.id, text: item.text, priority: item.priority }))
    .filter((item) => item.text.trim() !== '');
}

/** Draft -> EntryInput/EntryUpdate body fields (without expectedVersion). */
export function entryInputFromDraft(draft) {
  const time = draft.unscheduled
    ? null
    : {
      date: draft.time.date,
      startTime: draft.time.startTime,
      timeZone: draft.time.timeZone,
      durationMinutes: Number(draft.time.durationMinutes)
    };
  return {
    title: draft.title,
    items: cleanItems(draft.items),
    time,
    repeat: time !== null && draft.weekly ? { until: draft.until } : null,
    course: {
      classId: draft.course.classId,
      lessonId: draft.course.lessonId,
      recordIds: time === null || draft.weekly ? [] : [...draft.course.recordIds]
    },
    reminder: time !== null && draft.reminder ? { side: draft.reminder.side, minutes: Number(draft.reminder.minutes) } : null
  };
}

/** Draft -> Override content for one instance. */
export function overrideFromDraft(draft) {
  const value = entryInputFromDraft({ ...draft, unscheduled: false, weekly: false });
  return {
    title: value.title,
    items: value.items,
    time: value.time,
    course: value.course,
    reminder: value.reminder
  };
}

export function newItem() {
  return {
    id: globalThis.crypto.randomUUID(),
    text: '',
    priority: 'normal'
  };
}

export function moveItemInArray(items, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
