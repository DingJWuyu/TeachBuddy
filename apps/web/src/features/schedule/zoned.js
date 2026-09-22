/**
 * Minimal timezone arithmetic for the schedule surface.
 *
 * Instants come from the server as UTC; the grid and the editor must place them
 * on the teacher's account calendar. `Intl.DateTimeFormat` is the only source of
 * zone rules, matching the server implementation and adding no dependency.
 */
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const formatterCache = new Map();

function formatter(zone) {
  let value = formatterCache.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    formatterCache.set(zone, value);
  }
  return value;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function parseDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function dateToUtcMs(value) {
  const parts = parseDateParts(value);
  if (!parts) return Number.NaN;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function dateFromUtcMs(ms) {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(value, count) {
  return dateFromUtcMs(dateToUtcMs(value) + count * MS_PER_DAY);
}

export function diffDays(from, to) {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / MS_PER_DAY);
}

/** Local calendar parts of an instant in `zone`. */
export function localParts(zone, ms) {
  const parts = formatter(zone).formatToParts(new Date(ms));
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  const hour = read('hour') % 24;
  return {
    date: `${String(read('year')).padStart(4, '0')}-${pad(read('month'))}-${pad(read('day'))}`,
    minutes: hour * 60 + read('minute')
  };
}

function offsetMs(zone, ms) {
  const local = localParts(zone, ms);
  return dateToUtcMs(local.date) + local.minutes * MS_PER_MINUTE - ms;
}

/** Instant of a wall clock (date + minute of day) in `zone`. */
export function instantAt(zone, date, minutes) {
  const wall = dateToUtcMs(date) + minutes * MS_PER_MINUTE;
  const before = offsetMs(zone, wall - MS_PER_DAY / 2);
  const after = offsetMs(zone, wall + MS_PER_DAY / 2);
  const candidates = [...new Set([wall - before, wall - after])].sort((a, b) => a - b);
  const exact = candidates.filter((candidate) => {
    const local = localParts(zone, candidate);
    return local.date === date && local.minutes === minutes;
  });
  if (exact.length > 0) return exact[0];
  return candidates[candidates.length - 1];
}

