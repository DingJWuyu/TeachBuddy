import rrule from 'rrule';
const { RRule } = rrule;
const frequencies = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY, yearly: RRule.YEARLY };
const days = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
const utcDate = value => new Date(`${value}T00:00:00Z`);

// Expand calendar dates in UTC, then let the existing timezone resolver place
// each occurrence at its wall-clock time. DST must not shift a weekly class.
export function recurrenceDates(entry, { from, to } = {}) {
  if (!entry.time || !entry.repeat) return [];
  const rule = entry.repeat;
  const start = utcDate(entry.time.date);
  const frequency = rule.frequency ?? 'weekly';
  const options = { dtstart: start, freq: frequencies[frequency], interval: rule.interval ?? 1,
    until: utcDate(rule.until), wkst: RRule.MO };
  if (rule.count) options.count = rule.count;
  if (frequency === 'weekly') options.byweekday = (rule.weekdays ?? [start.getUTCDay()]).map(day => days[day]);
  if (frequency === 'monthly' && rule.monthly === 'weekday') {
    options.byweekday = [days[start.getUTCDay()].nth(Math.ceil(start.getUTCDate() / 7))];
  }
  const recurrence = new RRule(options);
  return recurrence.between(utcDate(from ?? entry.time.date), utcDate(to ?? rule.until), true)
    .map(value => value.toISOString().slice(0, 10));
}
