import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
let world, client, now, errors;
const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, course: { classId: null, recordIds: [] }, calendar: { allDay: false, tags: [], notes: '' }, ...patch });
async function call(method, url, body) {
  const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
}
async function open(page, title) { await page.locator('.cal-upcoming-row').filter({ hasText: title }).click(); }
async function close(page) { await page.getByRole('button', { name: '关闭任务', exact: true }).click(); await expect(page.locator('.cal-editor')).toHaveCount(0); }
async function view(page, name) {
  await page.getByRole('button', { name: '日历视图', exact: true }).click();
  await page.getByRole('menuitemradio', { name: new RegExp(`^${name}\\s`) }).click();
}
test.beforeEach(async ({ page }) => {
  now = '2026-09-25T06:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  errors = []; page.on('pageerror', e => errors.push(e.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-polish-')), workbenchClock: () => new Date(now) });
  ({ client } = await registerMath(world, 'schedule-polish@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-polish@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.cal-page')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.locator('.cal-loading')).toHaveCount(0);
});
test.afterEach(async ({ context }, info) => {
  const failed = info.status !== info.expectedStatus || errors.length;
  if (failed) {
    const data = { test: info.title, directory: world.directory, origin: world.origin, time: now, pageErrors: errors, entries: (await call('GET', E)).items };
    fs.writeFileSync(info.outputPath('preserved-case.json'), JSON.stringify(data, null, 2));
  }
  await context.close(); await world.close();
  if (!failed) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(errors).toEqual([]);
});


test('多日全天任务在月和周视图横跨两天', async ({ page }) => {
  const task = await call('POST', E, entry('两天的全天备忘', { time: { ...entry('').time, startTime: '00:00', durationMinutes: 2880 }, calendar: { ...entry('').calendar, allDay: true } }));
  await page.reload(); await view(page, '月');
  const card = page.locator('.fc-daygrid-event').filter({hasText: task.title}).first();
  const cell = page.locator('.fc-daygrid-day[data-date="2026-09-25"]');
  await expect(card).toBeVisible();
  expect((await card.boundingBox()).width / (await cell.boundingBox()).width).toBeGreaterThan(1.8);
  await view(page, '周');
  expect((await page.locator('.fc-daygrid-event').filter({hasText: task.title}).first().boundingBox()).width / (await page.locator('.fc-col-header-cell').first().boundingBox()).width).toBeGreaterThan(1.8);
});
test('月视图更多任务长标题收纳、紧凑布局、渐进打开并立即关闭', async ({ page }) => {
  for(let i=0;i<6;i++) await call('POST', E, entry(i === 0 ? '③ 夜间整理：课堂反馈、明日讲义与打印清单以及其他很长的任务内容' : `折叠任务${i}`));
  await page.reload(); await view(page, '月');
  const more = page.locator('[data-date="2026-09-25"] .fc-daygrid-more-link');
  await more.click();
  await expect(page.locator('.fc-more-popover')).toBeVisible();
  const enter=await page.locator('.fc-more-popover').evaluate(el=>new Promise(resolve=>{const values=[];const start=performance.now();function sample(){values.push(Number(getComputedStyle(el).opacity));if(performance.now()-start<220)requestAnimationFrame(sample);else resolve(values);}sample();}));
  expect(enter.some(x=>x>0&&x<1)).toBe(true);
  expect(enter.at(-1)).toBe(1);
  const panel = page.locator('.cal-month-more-popover');
  const layout = await panel.evaluate(el => ({width:el.getBoundingClientRect().width, client:el.clientWidth, scroll:el.scrollWidth}));
  expect(layout.scroll).toBeLessThanOrEqual(layout.client);
  expect(layout.width).toBeLessThanOrEqual(302);
  const title = panel.locator('.cal-month-more-event span').first();
  await expect(title).toHaveCSS('text-overflow', 'ellipsis');
  const closeButton = panel.getByRole('button', {name:'关闭',exact:true});
  await expect(closeButton).toHaveCSS('outline-style', 'none');
  await page.screenshot({path:test.info().outputPath('month-more.png')});
  await more.click();
  expect(await page.locator('.fc-more-popover').count()).toBe(0);
  await more.click();await more.click();await more.click();
  await expect(page.locator('.fc-more-popover')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.fc-more-popover')).toHaveCount(0);
  await more.click(); await closeButton.click();
  expect(await panel.count()).toBe(0);
  await more.click(); await page.locator('.cal-page').click({position:{x:4,y:4}});
  expect(await panel.count()).toBe(0);
});
test('事项点击完成和撤销，拖动完成事项保留状态并刷新读回', async ({page}) => {
  const task=await call('POST', E, entry('事项测试',{items:[{id:randomUUID(),text:'准备讲义',priority:'normal'},{id:randomUUID(),text:'整理反馈',priority:'normal'}]}));
  await page.reload();await open(page,task.title);
  const first=page.locator('.cal-item-bullet').first();await first.click();
  await expect(page.locator('.cal-item-row').first()).toHaveClass(/is-completed/);
  await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[0].completed).toBe(true);
  await page.screenshot({path:test.info().outputPath('completed-item.png')});
  const a=await first.boundingBox(),b=await page.locator('.cal-item-row').last().boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+12,b.y+b.height-2,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[1].text).toBe('准备讲义');
  expect((await call('GET',`${E}/${task.id}`)).items[1].completed).toBe(true);
  await close(page);await page.reload();await open(page,task.title);
  await expect(page.locator('.cal-item-row').last()).toHaveClass(/is-completed/);
  await page.locator('.cal-item-bullet').last().click();
  await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[1].completed).toBe(false);
});
test('过期提醒明确展示修改后的完整时段和提醒设定', async ({page})=>{
  const task=await call('POST',E,entry('提醒测试',{reminder:{side:'before',minutes:10}}));
  await page.reload();await open(page,task.title);
  await page.locator('[name=entry-start]').fill('14:00');
  await page.locator('[name=entry-end]').fill('14:05');
  const dialog=page.getByRole('dialog',{name:'提醒时间已过去',exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.locator('.cal-reminder-decision')).toContainText('14:00 - 14:05');
  await expect(dialog.locator('.cal-reminder-decision')).toContainText('结束前 10 分钟');
  await page.screenshot({path:test.info().outputPath('reminder-time-range.png')});
  await dialog.getByRole('button',{name:'放弃本次修改',exact:true}).click();
});

test('跨午夜十分钟任务与当天其他任务共存时，月视图仍完整横跨两天', async({page})=>{
  await call('POST',E,entry('当天全天任务',{time:{...entry('').time,startTime:'00:00',durationMinutes:1440},calendar:{...entry('').calendar,allDay:true}}));
  await call('POST',E,entry('当天时间段任务'));
  const task=await call('POST',E,entry('夜间整理',{time:{...entry('').time,startTime:'23:50',durationMinutes:20}}));
  await page.reload();await view(page,'月');
  const card=page.locator('.fc-daygrid-event').filter({hasText:task.title}).first();await expect(card).toBeVisible();
  expect((await card.boundingBox()).width/(await page.locator('.fc-daygrid-day[data-date="2026-09-25"]').boundingBox()).width).toBeGreaterThan(1.8);
  expect(await card.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.right-12,r.top+r.height/2));})).toBe(true);
  await page.screenshot({path:test.info().outputPath('night-spans-days.png')});
});

test('跨天全天拖入时间网格为一小时，再拖回全天只保留一天', async({page})=>{
  const task=await call('POST',E,entry('全天转时段',{time:{...entry('').time,startTime:'00:00',durationMinutes:2880},calendar:{...entry('').calendar,allDay:true}}));
  await page.reload();await view(page,'周');
  await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible();

  const card=page.locator('.fc-daygrid-event').filter({hasText:task.title}).first();await expect(card).toBeVisible();
  const target=page.locator('.fc-timegrid-slot-lane[data-time="09:00:00"]').first();
  await target.scrollIntoViewIfNeeded();await expect(card).toHaveClass(/fc-event-draggable/);await card.hover({position:{x:25,y:12}});const slot=await target.boundingBox();const box=await card.boundingBox();
  await page.mouse.down();await page.mouse.move(box.x+25,slot.y+3,{steps:24});await page.mouse.up();
  await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.allDay).toBe(false);
  let saved=await call('GET',`${E}/${task.id}`);expect(saved.time.durationMinutes).toBe(60);
  const timed=page.locator('.fc-timegrid-event').filter({hasText:task.title});await expect(timed).toBeVisible();await expect(timed.locator('.cal-event-time')).toHaveText('9:00 - 10:00');await expect(timed).toHaveClass(/fc-event-draggable/);await expect(page.getByRole('region',{name:'即将到来',exact:true}).locator('.cal-upcoming-row')).toHaveCount(0);await timed.hover({position:{x:25,y:20}});
  const allDay=await page.locator('.fc-daygrid-day[data-date="2026-09-25"]').boundingBox();
  await page.mouse.down();await page.mouse.move(allDay.x+allDay.width/2,allDay.y+allDay.height/2,{steps:24});await page.mouse.up();
  await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.allDay).toBe(true);
  saved=await call('GET',`${E}/${task.id}`);expect(saved.time.durationMinutes).toBe(1440);expect(saved.time.date).toBe('2026-09-25');
});

for(const pending of [false,true]) test(`${pending?'待安排':'时间段任务'}无标题填写备注和标签后关闭或删除直接丢弃`, async({page})=>{
  await call('POST',L,{name:'准备',color:'#3edc81'});await page.reload();
  const section=page.getByRole('region',{name:pending?'待安排':'即将到来',exact:true});
  const create=async()=>{await section.getByRole('button',{name:pending?'新建待安排任务':'新建任务',exact:true}).click();await page.locator('[contenteditable=true]').fill('尚未确定的想法');await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'准备',exact:true}).click();await page.keyboard.press('Escape');};
  await create();await close(page);expect((await call('GET',E)).items).toHaveLength(0);
  await create();await page.getByRole('button',{name:'添加事项',exact:true}).click();await page.getByLabel('事项 1',{exact:true}).fill('没有标题也不保存');
  await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'删除任务',exact:true}).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0);expect((await call('GET',E)).items).toHaveLength(0);
});

for(const pending of [false,true]) test(`${pending?'待安排':'任务'}无标题草稿可点空白取消或切换对象，已保存对象可删除未完成编辑`,async({page})=>{
  const existing=await call('POST',E,entry('已保存对象',pending?{time:null}:{}));await page.reload();
  const section=page.getByRole('region',{name:pending?'待安排':'即将到来',exact:true});
  const create=async()=>{await section.getByRole('button',{name:pending?'新建待安排任务':'新建任务',exact:true}).click();await page.getByRole('textbox',{name:'备注',exact:true}).fill('不要保存');};
  await create();await page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]').click({position:{x:100,y:6}});await expect(page.locator('.cal-editor')).toHaveCount(0);
  await create();if(pending){await close(page);await open(page,existing.title);}else await page.locator('.fc-event').filter({hasText:existing.title}).first().click();
  await expect(page.locator('[name=entry-title]')).toHaveValue(existing.title);expect((await call('GET',E)).items).toHaveLength(1);
  await page.locator('[name=entry-title]').fill('');await page.getByRole('textbox',{name:'备注',exact:true}).fill('尚未保存的备注');
  await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'删除任务',exact:true}).click();
  await page.getByRole('dialog',{name:'删除任务',exact:true}).getByRole('button',{name:'删除',exact:true}).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0);expect((await call('GET',E)).items).toHaveLength(0);
});

for (const kind of ['时间段', '跨日全天', '重复']) test(`月视图弹层中的${kind}任务可拖到其他日期且不误打开或重复创建`, async ({page}) => {
  for(let i=0;i<5;i++) await call('POST',E,entry(`折叠占位${i}`));
  const task=await call('POST',E,entry(`需要拖动的${kind}`,kind==='跨日全天' ? {time:{...entry('').time,startTime:'00:00',durationMinutes:2880},calendar:{...entry('').calendar,allDay:true}} : kind==='重复' ? {repeat:{frequency:'weekly',interval:1,weekdays:[5],monthly:'date',count:0,until:'2026-10-30'}} : {}));
  await page.reload();await view(page,'月');
  await page.locator('[data-date="2026-09-25"] .fc-daygrid-more-link').click();
  const row=page.locator('.cal-month-more-event').filter({hasText:task.title});
  await expect(row).toBeVisible();
  let releaseRefresh, refreshStarted;
  if(kind==='时间段') {
    const gate=new Promise(resolve=>{releaseRefresh=resolve;});
    refreshStarted=new Promise(resolve=>{
      page.route('**/api/modules/schedule/occurrences?**',async route=>{resolve();await gate;await route.continue();});
    });
  }
  const from=await row.boundingBox(),to=await page.locator('.fc-daygrid-day[data-date="2026-09-26"]').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
  await page.mouse.move(to.x+to.width/2,to.y+50,{steps:20});await page.mouse.up();
  await expect(page.locator('.cal-month-more-popover')).toHaveCount(0);
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  if(refreshStarted) {
    await refreshStarted;
    try { await expect(page.locator('.cal-loading')).toHaveCount(0); }
    finally { releaseRefresh(); }
  }
  await expect.poll(async()=>{
    const list=(await call('GET',E)).items.filter(x=>x.title===task.title);
    return list.some(x=>x.time.date==='2026-09-26');
  }).toBe(true);
  const list=(await call('GET',E)).items.filter(x=>x.title===task.title);
  const moved=list.find(x=>x.time.date==='2026-09-26');
  expect(moved.time.startTime).toBe(task.time.startTime);
  expect(moved.time.durationMinutes).toBe(task.time.durationMinutes);
  expect(moved.calendar.allDay).toBe(task.calendar.allDay);
  expect(list).toHaveLength(kind==='重复'?2:1);
  if(kind==='重复') expect(moved.repeat).toBeNull();
  await expect(page.locator('.cal-loading')).toHaveCount(0);
});
