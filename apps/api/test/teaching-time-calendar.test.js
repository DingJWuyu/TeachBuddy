import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduleHarness } from './fixtures/teaching-time-schedule/harness.js';
const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
const empty = () => ({ title: '备课', items: [], time: { date: '2026-09-25', startTime: '09:00', durationMinutes: 60, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, lessonId: null, recordIds: [] }, reminder: null, calendar: { allDay: false, notes: '', tags: [] } });
const repeat = overrides => ({ until: '2026-12-31', frequency: 'weekly', interval: 1, weekdays: [1,2,3,4,5], monthly: 'date', count: 0, ...overrides });
async function world(run) {
  const h = await createScheduleHarness();
  const a = h.agent(h.account('teacher-a'));
  const post = async (url, body) => { const r = await a.post(url, body, { key: h.key() }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body; };
  const put = async (url, body) => { const r = await a.put(url, body, { key: h.key() }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  try { await run({ h, a, post, put }); } finally { h.close(); }
}

test('calendar metadata and labels persist, legacy updates preserve metadata, accounts remain isolated', () => world(async ({ h, a, post, put }) => {
  const label = await post(L, { name: '工作', color: '#ff6b75' });
  const value = empty(); value.calendar = { allDay: false, notes: '函数定义\n第二行', tags: [label.id] };
  const item = await post(E, value);
  await h.restart();
  assert.deepEqual((await a.get(`${E}/${item.id}`)).body.calendar, value.calendar);
  const { calendar, ...legacy } = value;
  assert.deepEqual((await put(`${E}/${item.id}`, { ...legacy, title: '上课', expectedVersion: 1 })).calendar, calendar);
  const other = h.agent(h.account('teacher-b'));
  assert.deepEqual((await other.get(L)).body.items, []);
  assert.equal((await other.put(`${L}/${label.id}`, { name: '越界', color: '#000000', deleted: false, expectedVersion: 1 }, { key: h.key() })).status, 404);
  await put(`${L}/${label.id}`, { name: '教学', color: '#3edc81', deleted: false, expectedVersion: 1 });
  assert.equal((await a.get(L)).body.items[0].name, '教学');
}));

test('weekday/count recurrence, moving a single occurrence into the queried range, and converting an existing task', () => world(async ({ a, post, put }) => {
  const value = empty();
  let item = await post(E, value);
  item = await put(`${E}/${item.id}`, { ...value, repeat: repeat({ count: 4 }), expectedVersion: 1 });
  let range = await a.get('/api/modules/schedule/occurrences', { from: '2026-09-25', to: '2026-10-10' });
  assert.deepEqual(range.body.items.map(x => x.time.date), ['2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30']);
  const { repeat: ignored, ...content } = { ...value, title: '改期', time: { ...value.time, date: '2026-10-15' } };
  await put(`${E}/${item.id}/exceptions/2026-09-28`, { expectedVersion: 2, mode: 'override', content });
  range = await a.get('/api/modules/schedule/occurrences', { from: '2026-10-15', to: '2026-10-15' });
  assert.equal(range.body.items.length, 1); assert.equal(range.body.items[0].key.originDate, '2026-09-28');
  assert.equal(range.body.items[0].title, '改期');
}));

test('monthly dates skip nonexistent days, ordinal weekdays and yearly leap dates follow calendar rules', () => world(async ({ a, post }) => {
  const cases = [
    [{ date: '2026-01-31', rule: repeat({ frequency: 'monthly', until: '2026-05-31' }) }, ['2026-01-31','2026-03-31','2026-05-31']],
    [{ date: '2026-09-25', rule: repeat({ frequency: 'monthly', monthly: 'weekday', until: '2026-11-30' }) }, ['2026-09-25','2026-10-23','2026-11-27']],
    [{ date: '2024-02-29', rule: repeat({ frequency: 'yearly', until: '2032-12-31' }) }, ['2024-02-29','2028-02-29','2032-02-29']]
  ];
  for (const [input, dates] of cases) {
    const value = empty(); value.time.date = input.date; value.repeat = input.rule;
    const item = await post(E, value);
    const result = await a.get('/api/modules/schedule/occurrences', { from: input.date, to: input.rule.until });
    assert.deepEqual(result.body.items.filter(x => x.key.entryId === item.id).map(x => x.time.date), dates);
  }
}));

test('all-day spans keep midnight boundaries across DST and reject fractional days', () => world(async ({ a, post, h }) => {
  const value = empty(); value.time = { date: '2026-03-08', startTime: '00:00', durationMinutes: 2880, timeZone: 'America/New_York' }; value.calendar.allDay = true;
  const item = await post(E, value);
  const result = await a.get(`${E}/${item.id}/occurrence`);
  assert.equal(result.body.startsAt, '2026-03-08T05:00:00Z'); assert.equal(result.body.endsAt, '2026-03-10T04:00:00Z');
  assert.equal((await a.post(E, { ...value, time: { ...value.time, durationMinutes: 70 } }, { key: h.key() })).status, 422);
}));
