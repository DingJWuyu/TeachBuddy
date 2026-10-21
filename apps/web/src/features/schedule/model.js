import i18n from "../../i18n/index.js";
import { instantAt, localParts, parseDateParts } from './zoned.js';

/** Shared schedule labels, clock formatting and daylight-saving adjustment. */
const t = (key, options) => i18n.t(key, { ns: "schedule", ...options });

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

function weekdayOf(date) {
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

export function titleOf(entry) {
  const title = String(entry?.title ?? '').trim();
  if (title !== '') return title;
  const item = String(entry?.items?.[0]?.text ?? '').trim();
  return item !== '' ? item : t("未命名安排");
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
