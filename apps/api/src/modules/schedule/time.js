/**
 * Schedule date and timezone arithmetic.
 *
 * The contract fixes wall-clock rules, not a timezone library: an entry is
 * stored as local date + start time in its own IANA zone, and every instant is
 * derived on the server. `Intl.DateTimeFormat` is the only timezone source, so
 * no dependency is added and an invalid zone is rejected by the platform.
 *
 * DST rules from the contract:
 * - an ambiguous wall time (fall-back overlap) resolves to the earlier instant;
 * - a missing wall time (spring-forward gap) shifts forward by the size of the
 *   jump - 02:30 becomes 03:30 - and reports `timeAdjusted`.
 */

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

/**
 * Parse a real Gregorian date, or return null. This is the arithmetic parser:
 * internal computations may cross the request window (the last supported day
 * ends at 2101-01-01 00:00 local), while requests are checked against
 * MIN_YEAR/MAX_YEAR by `isDate`.
 */
function parseCalendarDate(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year)) return null;
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  return { year, month, day };
}

/** Parse a real Gregorian date inside the supported window, or return null. */
function parseDate(value) {
  const parts = parseCalendarDate(value);
  if (!parts) return null;
  if (parts.year < MIN_YEAR || parts.year > MAX_YEAR) return null;
  return parts;
}

export function isDate(value) {
  return parseDate(value) !== null;
}

function toDateString({ year, month, day }) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function dateToUtcMs(value) {
  const parts = typeof value === 'string' ? parseCalendarDate(value) : value;
  if (!parts) return Number.NaN;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function utcMsToDate(ms) {
  const date = new Date(ms);
  return toDateString({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

export function addDays(value, count) {
  return utcMsToDate(dateToUtcMs(value) + count * MS_PER_DAY);
}

/** Whole days from `from` to `to`, both real dates. */
export function diffDays(from, to) {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / MS_PER_DAY);
}

export function compareDates(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Minutes since local midnight for `HH:mm`, or null when malformed. */
export function parseTimeOfDay(value) {
  if (typeof value !== 'string') return null;
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isTimeOfDay(value) {
  return parseTimeOfDay(value) !== null;
}

/** Whole-minute precision timestamp, independent of the runtime locale. */
export function formatIsoZ(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function parseInstant(value) {
  if (typeof value !== 'string' || !value.endsWith('Z')) return Number.NaN;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? Number.NaN : ms;
}

export function isTimeZone(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch (error) {
    return false;
  }
}

const formatterCache = new Map();

function zoneFormatter(zone) {
  let formatter = formatterCache.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    formatterCache.set(zone, formatter);
  }
  return formatter;
}

function zoneParts(zone, utcMs) {
  const instant = Math.floor(utcMs / 1000) * 1000;
  const parts = zoneFormatter(zone).formatToParts(new Date(instant));
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  // ICU reports midnight as hour 24 in some zones under hour12: false.
  const hour = read('hour') % 24;
  return {
    date: `${pad(read('year'), 4)}-${pad(read('month'))}-${pad(read('day'))}`,
    minutes: hour * 60 + read('minute')
  };
}

/** Offset of `zone` at `utcMs`, in milliseconds east of UTC. */
function zoneOffsetMs(zone, utcMs) {
  const instant = Math.floor(utcMs / 1000) * 1000;
  const local = zoneParts(zone, instant);
  const localMs = dateToUtcMs(local.date) + local.minutes * MS_PER_MINUTE;
  return localMs - instant;
}

/** Local calendar date and minute-of-day of an instant in `zone`. */
export function localPartsAt(zone, utcMs) {
  return zoneParts(zone, utcMs);
}

/**
 * Resolve a wall-clock date + minute-of-day in `zone` to an instant.
 * Ambiguous times take the earlier instant; missing times shift forward by the
 * size of the jump and set `timeAdjusted`.
 */
export function instantAt(zone, dateStr, minutes) {
  const wall = dateToUtcMs(dateStr) + minutes * MS_PER_MINUTE;
  const before = zoneOffsetMs(zone, wall - MS_PER_DAY / 2);
  const after = zoneOffsetMs(zone, wall + MS_PER_DAY / 2);
  const candidates = [...new Set([wall - before, wall - after])].sort((a, b) => a - b);
  const exact = candidates.filter((candidate) => {
    const local = zoneParts(zone, candidate);
    return local.date === dateStr && local.minutes === minutes;
  });
  if (exact.length > 0) return { utcMs: exact[0], timeAdjusted: false };
  return { utcMs: candidates[candidates.length - 1], timeAdjusted: true };
}

/** Half-open instant range of the inclusive local day range [from, to]. */
export function rangeInstants(zone, from, to) {
  const start = instantAt(zone, from, 0).utcMs;
  const end = instantAt(zone, addDays(to, 1), 0).utcMs;
  return { start, end };
}
