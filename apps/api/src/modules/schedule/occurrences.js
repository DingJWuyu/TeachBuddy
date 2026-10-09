/**
 * Occurrence expansion and reminder projection.
 *
 * A repeating Entry is never copied into instance rows: reads expand the weekly
 * rhythm from `time.date` to `repeat.until`, apply the single-instance exception
 * (or cancellation), and filter by the actual instant interval. Instance
 * identity is `(entryId, originDate)`; a moved override keeps its original date
 * as identity and may fall outside the queried range.
 */
import {
  addDays,
  compareDates,
  diffDays,
  formatIsoZ,
  instantAt,
  parseInstant,
  parseTimeOfDay
} from './time.js';
import { recurrenceDates } from './recurrence.js';

/**
 * The one title projection the contract fixes for reminders and notifications:
 * trimmed title, otherwise the trimmed first item, cut to 300 Unicode code
 * points with no ellipsis. T53 consumes this same function.
 */
export function projectReminderTitle(entry) {
  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  const source = title !== '' ? title : String(entry.items?.[0]?.text ?? '').trim();
  return [...source].slice(0, 300).join('');
}

export function templateContent(entry) {
  return {
    title: entry.title,
    items: entry.items,
    time: entry.time,
    course: entry.course,
    reminder: entry.reminder,
    calendar: entry.calendar ?? { allDay: false, notes: '', tags: [] }
  };
}

/**
 * Effective editable content of one instance. An override wins over the
 * template; a plain instance of a weekly series takes its own `originDate`, so
 * a moved override and a virtual instance both keep their real date.
 */
export function effectiveContent(entry, exception, originDate = null) {
  if (exception && exception.mode === 'override' && exception.content) {
    return exception.content;
  }
  const template = templateContent(entry);
  if (originDate !== null && template.time) {
    return { ...template, time: { ...template.time, date: originDate } };
  }
  return template;
}

/** Effective course links of one instance (override links, else template). */
export function effectiveLinks(entry, exception) {
  if (exception && exception.mode === 'override' && exception.content?.courseLinks) {
    return exception.content.courseLinks;
  }
  return entry.courseLinks ?? { classroom: null, lesson: null, records: [] };
}

/**
 * Instance state. Hidden (past `until`) wins over cancelled; a deleted entry
 * wins over both, matching the single-instance read.
 */
export function instanceState(entry, originDate, exception) {
  if (entry.deletedAt) return 'deleted';
  if (originDate !== null && entry.repeat && compareDates(originDate, entry.repeat.until) > 0) {
    return 'outside-series';
  }
  if (exception && exception.mode === 'cancelled') return 'cancelled';
  return 'active';
}

export function instanceArmedAt(entry, armRow) {
  return armRow?.armedAt ?? entry.reminderArmedAt ?? entry.createdAt;
}

/** Origin dates of a repeating entry, bounded by its rule and optional range. */
export const seriesOriginDates = recurrenceDates;

/** Whether a date belongs to the recurrence pattern, independently of `until`. */
export function fitsSeries(entry, originDate) {
  if (!entry.time) return false;
  if (entry.repeat?.frequency) return recurrenceDates({ ...entry, repeat: { ...entry.repeat, until: '2100-12-31' } }, { from: originDate, to: originDate }).length > 0;
  const distance = diffDays(entry.time.date, originDate);
  return distance >= 0 && distance % 7 === 0;
}

export function isRepeating(entry) {
  return entry.repeat !== null && entry.repeat !== undefined;
}

/** Reminder instant of one content projection, or null when unset. */
export function dueInstantMs(content) {
  if (!content.reminder || !content.time) return null;
  const start = instantAt(content.time.timeZone, content.time.date, parseTimeOfDay(content.time.startTime));
  const end = content.calendar?.allDay
    ? instantAt(content.time.timeZone, addDays(content.time.date, content.time.durationMinutes / 1440), 0).utcMs
    : start.utcMs + content.time.durationMinutes * 60_000;
  const offset = content.reminder.minutes * 60_000;
  const anchor = content.reminder.anchor === 'start' ? start.utcMs : end;
  return content.reminder.side === 'before' ? anchor - offset : anchor + offset;
}

/**
 * Build one instance. `courseState` is attached by the service, which owns the
 * cross-module reads; `links` are the links this instance actually displays.
 */
export function buildOccurrence({ entry, originDate, exception, links }) {
  const state = instanceState(entry, originDate, exception);
  const content = state === 'active'
    ? effectiveContent(entry, exception, originDate)
    : effectiveContent(entry, null, originDate);
  const time = content.time;
  const start = instantAt(time.timeZone, time.date, parseTimeOfDay(time.startTime));
  const endsAtMs = content.calendar?.allDay
    ? instantAt(time.timeZone, addDays(time.date, time.durationMinutes / 1440), 0).utcMs
    : start.utcMs + time.durationMinutes * 60_000;
  const dueMs = dueInstantMs(content);
  return {
    key: { entryId: entry.id, originDate },
    entryVersion: entry.version,
    exception: Boolean(exception),
    state,
    title: content.title,
    items: content.items,
    calendar: content.calendar ?? entry.calendar ?? { allDay: false, notes: '', tags: [] },
    time,
    startsAt: formatIsoZ(start.utcMs),
    endsAt: formatIsoZ(endsAtMs),
    timeAdjusted: start.timeAdjusted,
    course: content.course,
    courseState: null,
    reminder: content.reminder ?? null,
    dueAt: dueMs === null ? null : formatIsoZ(dueMs),
    __startsAtMs: start.utcMs,
    __endsAtMs: endsAtMs,
    // A cancelled or out-of-range instance shows the template content, so it
    // must also derive its link state from the template links.
    __links: state === 'active' ? (links ?? entry.courseLinks) : entry.courseLinks
  };
}

export function stripInternal(occurrence) {
  const { __startsAtMs, __endsAtMs, __links, ...rest } = occurrence;
  return rest;
}

export function intersects(occurrence, rangeStart, rangeEnd) {
  return occurrence.__startsAtMs < rangeEnd && occurrence.__endsAtMs > rangeStart;
}

export function sortOccurrences(items) {
  return items.sort((a, b) => {
    if (a.__startsAtMs !== b.__startsAtMs) return a.__startsAtMs - b.__startsAtMs;
    if (a.key.entryId !== b.key.entryId) return a.key.entryId < b.key.entryId ? -1 : 1;
    const left = a.key.originDate ?? '';
    const right = b.key.originDate ?? '';
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });
}

/**
 * Reminder candidates: every active instance whose `armedAt < dueAt <= now`.
 * The list is a read projection only; it never writes a notification (T53 owns
 * storage) and it must find moved overrides through their actual time.
 */
export function listReminderCandidates(entries, exceptionsByEntry, armsByEntry, nowIso) {
  const now = parseInstant(nowIso);
  const candidates = [];
  for (const entry of entries) {
    if (entry.deletedAt || !entry.time) continue;
    const exceptions = exceptionsByEntry.get(entry.id) ?? [];
    if (!entry.reminder && !exceptions.some(value => value.content?.reminder)) continue;
    const arms = armsByEntry.get(entry.id) ?? new Map();
    const exceptionByDate = new Map(exceptions.map((item) => [item.originDate, item]));

    const consider = (originDate, exception) => {
      const state = instanceState(entry, originDate, exception);
      if (state !== 'active') return;
      const content = effectiveContent(entry, exception, originDate);
      if (!content.reminder) return;
      const dueMs = dueInstantMs(content);
      if (dueMs === null) return;
      const armedMs = parseInstant(instanceArmedAt(entry, arms.get(originDate ?? '')));
      if (!(armedMs < dueMs && dueMs <= now)) return;
      candidates.push({
        key: { entryId: entry.id, originDate },
        title: projectReminderTitle(entry),
        dueAt: formatIsoZ(dueMs),
        armedAt: formatIsoZ(armedMs),
        __dueMs: dueMs
      });
    };

    if (!isRepeating(entry)) {
      consider(null, null);
      continue;
    }
    const candidateDates = new Set(seriesOriginDates(entry, { to: addDays(nowIso.slice(0, 10), 9) }));
    for (const exception of exceptions) if (fitsSeries(entry, exception.originDate) && exception.originDate <= entry.repeat.until) candidateDates.add(exception.originDate);
    for (const originDate of candidateDates) {
      consider(originDate, exceptionByDate.get(originDate) ?? null);
    }
  }

  candidates.sort((a, b) => {
    if (a.__dueMs !== b.__dueMs) return a.__dueMs - b.__dueMs;
    if (a.key.entryId !== b.key.entryId) return a.key.entryId < b.key.entryId ? -1 : 1;
    const left = a.key.originDate ?? '';
    const right = b.key.originDate ?? '';
    if (left === right) return 0;
    return left < right ? -1 : 1;
  });

  return candidates.map(({ __dueMs, ...rest }) => rest);
}
