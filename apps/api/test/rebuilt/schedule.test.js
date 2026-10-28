import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createWorld, register, ok, problem, schedule, write } from './helpers.js';

const item = (text, completed = false) => ({ id: randomUUID(), text, priority: 'high', completed });
const entry = (overrides = {}) => ({ title: '教学安排', items: [item('讲解')], time: null, repeat: null, reminder: null, ...overrides });
const timed = (date, startTime, timeZone = 'Asia/Shanghai', durationMinutes = 60) => ({ date, startTime, timeZone, durationMinutes });
const content = e => Object.fromEntries(['title', 'items', 'time', 'repeat', 'reminder'].map(k => [k, e[k]]));

test('日程：范围半开边界、DST 跳时和周重复均按当地时间，调课保留原实例身份', async t => {
  const world = await createWorld(t), { client } = await register(world);
  ok(await write(client, 'PUT', `${schedule}/settings`, { expectedVersion: 1, timeZone: 'America/New_York' }));
  const recurring = ok(await write(client, 'POST', `${schedule}/entries`, entry({ time: timed('2026-03-01', '02:30', 'America/New_York'), repeat: { until: '2026-03-22' } })), 201);
  const rows = ok(await client.request('GET', `${schedule}/occurrences?from=2026-03-01&to=2026-03-22`)).items;
  assert.equal(rows.length, 4);
  assert.equal(rows[0].startsAt, '2026-03-01T07:30:00Z');
  assert.equal(rows[1].startsAt, '2026-03-08T07:30:00Z');
  assert.equal(rows[1].timeAdjusted, true, '不存在的 02:30 按跳时间隔调整');
  assert.equal(rows[2].startsAt, '2026-03-15T06:30:00Z', '周重复不能固定 UTC 加168小时');
  const moved = { title: '调课', items: recurring.items, time: timed('2026-04-02', '11:00', 'America/New_York'), reminder: null };
  ok(await write(client, 'PUT', `${schedule}/entries/${recurring.id}/exceptions/2026-03-08`, { expectedVersion: 1, mode: 'override', content: moved }));
  const april = ok(await client.request('GET', `${schedule}/occurrences?from=2026-04-02&to=2026-04-02`)).items;
  assert.equal(april[0].key.originDate, '2026-03-08', '范围外原始日期的调课仍能找到');
  assert.equal(april[0].key.entryId, recurring.id);
  ok(await write(client, 'POST', `${schedule}/entries`, entry({ title: '恰好午夜结束', time: timed('2026-01-05', '23:00', 'America/New_York') })), 201);
  ok(await write(client, 'POST', `${schedule}/entries`, entry({ title: '跨午夜', time: timed('2026-01-05', '23:30', 'America/New_York') })), 201);
  const nextDay = ok(await client.request('GET', `${schedule}/occurrences?from=2026-01-06&to=2026-01-06`)).items;
  assert.deepEqual(nextDay.map(x => x.title), ['跨午夜'], '午夜结束不属于次日，实际相交属于次日');
});

test('日程：单次独立和事项移动保持 ID/完成状态，冲突整笔回滚，原键重放不复制', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const source = ok(await write(client, 'POST', `${schedule}/entries`, entry({ items: [item('已完成事项', true)] })), 201);
  const target = ok(await write(client, 'POST', `${schedule}/entries`, entry({ time: timed('2026-02-02', '10:00'), repeat: { until: '2026-02-23' } })), 201);
  const body = { itemId: source.items[0].id, fromEntryId: source.id, fromVersion: 1, toEntryId: target.id, toVersion: 2, toIndex: 1, toScope: 'instance', toOriginDate: '2026-02-09' };
  problem(await write(client, 'POST', `${schedule}/item-moves`, body), 409, 'version-conflict');
  assert.equal(ok(await client.request('GET', `${schedule}/entries/${source.id}`)).items.length, 1, '冲突不先移走源事项');
  const key = randomUUID();
  body.toVersion = 1;
  const moved = ok(await write(client, 'POST', `${schedule}/item-moves`, body, key));
  assert.notEqual(moved.to.id, target.id, '移动至一次实例产生独立任务');
  assert.equal(moved.to.repeat, null);
  assert.equal(moved.to.items[1].id, source.items[0].id);
  assert.equal(moved.to.items[1].completed, true);
  assert.deepEqual(ok(await write(client, 'POST', `${schedule}/item-moves`, body, key)), moved);
  assert.equal(ok(await client.request('GET', `${schedule}/entries/${source.id}`)).items.length, 0);
  const cancelled = ok(await client.request('GET', `${schedule}/entries/${target.id}/occurrence?originDate=2026-02-09`));
  assert.equal(cancelled.state, 'cancelled');
  const nextWeek = ok(await client.request('GET', `${schedule}/entries/${target.id}/occurrence?originDate=2026-02-16`));
  assert.equal(nextWeek.items.length, 1, '独立不改后续模板');
  await world.restart();
  assert.equal(ok(await client.request('GET', `${schedule}/entries/${moved.to.id}`)).items[1].completed, true);
});

test('日程：修改前结算原提醒，永久删除保留通知，dismiss 和重启均不重复生成', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const first = ok(await write(client, 'POST', `${schedule}/entries`, entry({ title: '', items: [item('  原提醒内容  ')], time: timed('2026-01-05', '17:05'), reminder: { side: 'before', minutes: 0, anchor: 'start' } })), 201);
  world.clock.advance(6 * 60000);
  const updated = ok(await write(client, 'PUT', `${schedule}/entries/${first.id}`, { ...content(first), title: '后来标题', reminder: null, expectedVersion: 1 }));
  const notices = ok(await client.request('GET', `${schedule}/notifications`)).items;
  assert.equal(notices.length, 1, '修改前必须结算已到期旧提醒');
  const notice = notices[0];
  assert.equal(notice.title, '原提醒内容');
  assert.equal(notice.dueAt, '2026-01-05T09:05:00Z');
  ok(await write(client, 'POST', `${schedule}/notifications/${notice.id}`, { action: 'read' }));
  assert.ok(ok(await client.request('GET', `${schedule}/notifications`)).items[0].readAt);
  ok(await write(client, 'POST', `${schedule}/notifications/${notice.id}`, { action: 'unread' }));
  assert.equal(ok(await client.request('GET', `${schedule}/notifications`)).items[0].readAt, null);
  const key = randomUUID(), deletion = { expectedVersion: updated.version };
  const removed = ok(await write(client, 'POST', `${schedule}/entries/${first.id}/delete`, deletion, key));
  problem(await client.request('GET', `${schedule}/entries/${first.id}`), 404, 'not-found');
  assert.equal(ok(await client.request('GET', `${schedule}/notifications`)).items[0].id, notice.id, '永久删除任务保留通知事实');
  ok(await write(client, 'POST', `${schedule}/notifications/${notice.id}`, { action: 'dismiss' }));
  await world.restart();
  assert.deepEqual(ok(await client.request('GET', `${schedule}/notifications`)).items, []);
  assert.deepEqual(ok(await write(client, 'POST', `${schedule}/entries/${first.id}/delete`, deletion, key)), removed);
});

test('日程：账户时区迁移保留当地时间与规则并升版，未排期和其他账户不变', async t => {
  const world = await createWorld(t), a = await register(world), b = await register(world);
  const timedEntry = ok(await write(a.client, 'POST', `${schedule}/entries`, entry({ time: timed('2026-04-01', '08:00') })), 201);
  const untimed = ok(await write(a.client, 'POST', `${schedule}/entries`, entry()), 201);
  const other = ok(await write(b.client, 'POST', `${schedule}/entries`, entry({ time: timed('2026-04-01', '08:00') })), 201);
  ok(await write(a.client, 'PUT', `${schedule}/settings`, { expectedVersion: 1, timeZone: 'America/Phoenix' }));
  const moved = ok(await a.client.request('GET', `${schedule}/entries/${timedEntry.id}`));
  assert.equal(moved.time.date, '2026-04-01');
  assert.equal(moved.time.startTime, '08:00');
  assert.equal(moved.time.timeZone, 'America/Phoenix');
  assert.equal(moved.version, 2);
  assert.equal(ok(await a.client.request('GET', `${schedule}/entries/${untimed.id}`)).version, 1);
  assert.deepEqual(ok(await b.client.request('GET', `${schedule}/entries/${other.id}`)), other);
});

test('D15 日历扩展：月末重复跳过不存在日期，全天跨DST保持当地午夜且实际23小时', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const calendar = { allDay: false, notes: '', tags: [] };
  const monthly = ok(await write(client, 'POST', `${schedule}/entries`, entry({ time: timed('2026-01-31', '09:00'),
    repeat: { until: '2026-05-31', frequency: 'monthly', interval: 1, weekdays: [], monthly: 'date', count: 0 }, calendar })), 201);
  const occurrences = ok(await client.request('GET', `${schedule}/occurrences?from=2026-01-01&to=2026-05-31`)).items;
  assert.deepEqual(occurrences.filter(value => value.key.entryId === monthly.id).map(value => value.time.date), ['2026-01-31', '2026-03-31', '2026-05-31'], '月末重复不能夹到二月或四月最后一天');
  const allDay = ok(await write(client, 'POST', `${schedule}/entries`, entry({ time: timed('2026-03-08', '00:00', 'America/New_York', 1440), calendar: { ...calendar, allDay: true } })), 201);
  const occurrence = ok(await client.request('GET', `${schedule}/entries/${allDay.id}/occurrence`));
  assert.equal(occurrence.startsAt, '2026-03-08T05:00:00Z');
  assert.equal(occurrence.endsAt, '2026-03-09T04:00:00Z', '全天结束必须是下一当地午夜');
  assert.equal(Date.parse(occurrence.endsAt) - Date.parse(occurrence.startsAt), 23 * 60 * 60 * 1000);
});
