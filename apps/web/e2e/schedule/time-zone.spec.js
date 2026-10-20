import { setScheduleField, expectScheduleField, openRepeat, scheduleAction } from './controls.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createScheduleWorld, loginSchedule, closeScheduleWorld } from './fixture.mjs';

test.describe('系统时区同步与时间显示', () => {
  // CDP owns runtime timezone changes; a context override would prevent later changes.
  const E = '/api/modules/schedule/entries';

  let world, client, now, errors, cdp;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
    const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
  }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page, context }) => {
    cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Shanghai'});
    now = '2026-09-25T14:00:00Z';
    await page.clock.setFixedTime(new Date(now));
    errors = []; page.on('pageerror', e => errors.push(e.message));
    ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-audit@example.test'));
    await loginSchedule(page, world, 'schedule-audit@example.test');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  async function closed(page) { await page.getByRole('button',{name:'关闭',exact:true}).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  test('运行中系统时区改变后，当前时间线跟随当地钟点',async({page,context})=>{
   await expect(page.locator('.cal-now-time')).toHaveText('22:00');
   await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await expect(page.locator('.cal-time-zone')).toHaveAttribute('title','America/New_York');
   await expect.poll(async()=>(await call('GET','/api/modules/schedule/settings')).timeZone).toBe('America/New_York');
   await expect(page.locator('.cal-now-time')).toHaveText('10:00');
  });

  async function switchZone(page, zone) { await cdp.send('Emulation.setTimezoneOverride',{timezoneId:zone});expect(await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(zone);await page.evaluate(()=>window.dispatchEvent(new Event('focus'))); }

  async function inSystemZone(page,zone) { await expect(page.locator('.cal-time-zone')).toHaveAttribute('title',zone);await expect.poll(async()=>(await call('GET','/api/modules/schedule/settings')).timeZone).toBe(zone); }

  const futureTime=()=>({...entry('').time,startTime:'23:30'});

  test('任务、重复和跨日全天保留当地钟点，待安排保持无时间',async({page})=>{
   const task=await call('POST',E,entry('当地晚间安排',{time:futureTime(),reminder:{anchor:'start',side:'before',minutes:10}}));
   const repeat=await call('POST',E,entry('当地重复安排',{time:futureTime(),repeat:{until:'2026-10-09'}}));
   const allDay=await call('POST',E,entry('两天全天安排',{time:{...futureTime(),startTime:'00:00',durationMinutes:2880},calendar:{allDay:true,tags:[],notes:''}}));
   const pending=await call('POST',E,entry('待安排',{time:null}));await page.reload();await switchZone(page,'America/New_York');await inSystemZone(page,'America/New_York');
   for(const original of [task,repeat,allDay]){const saved=await call('GET',`${E}/${original.id}`);expect(saved.time).toEqual({...original.time,timeZone:'America/New_York'});expect(saved.repeat).toEqual(original.repeat);}
   expect((await call('GET',`${E}/${pending.id}`)).version).toBe(pending.version);
   const occurrences=await call('GET','/api/modules/schedule/occurrences?from=2026-09-25&to=2026-09-25');expect(occurrences.items.find(x=>x.key.entryId===task.id).startsAt).toBe('2026-09-26T03:30:00Z');
   await page.screenshot({path:test.info().outputPath('new-york-calendar.png'),animations:'disabled'});
   await page.setViewportSize({width:390,height:950});await page.screenshot({path:test.info().outputPath('new-york-mobile.png'),animations:'disabled'});
   await page.reload();await inSystemZone(page,'America/New_York');expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version+1);
  });

  test('任务保存中切换时区，保留期间继续输入且不误报冲突',async({page})=>{
   const task=await call('POST',E,entry('正在编辑',{time:futureTime()}));await page.reload();await open(page,task.title);
   let release,hit,intercept=true;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{hit=r;});
   await page.route(`**${E}/${task.id}`,async route=>{if(route.request().method()!=='PUT'||!intercept)return route.continue();intercept=false;hit();await gate;await route.continue();});
   await page.getByRole('textbox',{name:'备注',exact:true}).fill('第一次输入');await started;await switchZone(page,'America/New_York');
   await page.getByRole('textbox',{name:'备注',exact:true}).fill('保存期间继续输入');release();await inSystemZone(page,'America/New_York');
   await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText('保存期间继续输入');await page.keyboard.press('ControlOrMeta+s');
   await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.notes).toBe('保存期间继续输入');await expect(page.locator('.tbx-sheet-error')).toHaveCount(0);
   await closed(page);expect((await call('GET',`${E}/${task.id}`)).time.timeZone).toBe('America/New_York');
  });

  test('时区同步响应丢失，重试原请求而不重复变更任务',async({page})=>{
   const task=await call('POST',E,entry('时区未知结果',{time:futureTime()}));await page.reload();let first=true;const keys=[];
   await page.route('**/api/modules/schedule/settings',async route=>{if(route.request().method()!=='PUT')return route.continue();keys.push(route.request().headers()['idempotency-key']);if(!first)return route.continue();first=false;await route.fetch();await route.abort('failed');});
   await switchZone(page,'America/New_York');await expect(page.locator('.cal-load-error')).toContainText(/确认/);
   await page.locator('.cal-load-error').getByRole('button',{name:'重试',exact:true}).click();await inSystemZone(page,'America/New_York');
   expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version+1);
  });

  test('连续切换时区时采用最后一次系统时区，不提交旧显示结果',async({page})=>{
   const task=await call('POST',E,entry('连续切换',{time:futureTime()}));await page.reload();let release,hit,first=true;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{hit=r;});
   await page.route('**/api/modules/schedule/settings',async route=>{if(route.request().method()!=='PUT'||!first)return route.continue();first=false;const response=await route.fetch();hit();await gate;await route.fulfill({response});});
   await switchZone(page,'America/New_York');await started;await switchZone(page,'Europe/London');await switchZone(page,'Asia/Tokyo');release();await inSystemZone(page,'Asia/Tokyo');
   const saved=await call('GET',`${E}/${task.id}`);expect(saved.time).toEqual({...task.time,timeZone:'Asia/Tokyo'});await expect(page.locator('.cal-now-time')).toHaveText('23:00');
  });

  test('跨日期的系统时区变化同步今天、红线和右侧日期',async({page})=>{
   now='2026-09-25T02:00:00Z';await page.clock.setFixedTime(new Date(now));await page.reload();await expect(page.locator('.cal-now-time')).toHaveText('10:00');
   await switchZone(page,'America/New_York');await inSystemZone(page,'America/New_York');await expect(page.locator('.cal-now-time')).toHaveText('22:00');
   await expect(page.locator('.fc-col-header-cell').first()).toHaveAttribute('data-date','2026-09-24');await expect(page.locator('.cal-mini button.is-today')).toHaveText('24');
  });

  test('账户时区已相同时仍修正旧任务时区，保持原日期钟点',async({page})=>{
   const task=await call('POST',E,entry('旧时区任务',{time:{...futureTime(),timeZone:'America/New_York'}}));await page.reload();
   await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).time.timeZone).toBe('Asia/Shanghai');expect((await call('GET',`${E}/${task.id}`)).time.startTime).toBe('23:30');
  });

  test('新建未命名待安排在时区切换后仍可取消，不创建任务',async({page})=>{
   await page.getByRole('button',{name:'新建待安排任务',exact:true}).click();await page.getByRole('textbox',{name:'备注',exact:true}).fill('暂时的想法');
   await switchZone(page,'America/New_York');await inSystemZone(page,'America/New_York');await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText('暂时的想法');await closed(page);expect((await call('GET',E)).items).toHaveLength(0);
  });

  test('页面保持打开时，无需焦点事件也检测系统时区变化',async({page})=>{
   await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});await expect(page.locator('.cal-time-zone')).toHaveAttribute('title','America/New_York',{timeout:20000});await expect(page.locator('.cal-now-time')).toHaveText('10:00');
  });

  test('保存结果未确认时先确认原保存，再同步时区且不丢备注',async({page})=>{
   const task=await call('POST',E,entry('待确认的任务保存',{time:futureTime()}));await page.reload();await open(page,task.title);let first=true;
   await page.route(`**${E}/${task.id}`,async route=>{if(route.request().method()!=='PUT'||!first)return route.continue();first=false;await route.fetch();await route.abort('failed');});
   await page.getByRole('textbox',{name:'备注',exact:true}).fill('保留未确认保存的备注');await page.keyboard.press('ControlOrMeta+s');await expect(page.locator('.tbx-sheet-error')).toContainText('确认');
   await switchZone(page,'America/New_York');await expect(page.locator('.cal-load-error')).toContainText('先重试确认');
   await page.locator('.cal-load-error').getByRole('button',{name:'重试',exact:true}).click();await inSystemZone(page,'America/New_York');
   await closed(page);const saved=await call('GET',`${E}/${task.id}`);expect(saved.calendar.notes).toBe('保留未确认保存的备注');expect(saved.time.timeZone).toBe('America/New_York');
  });

  test('拖选过程中实时显示范围，反向拖动和五分钟选区可读，取消不创建任务',async({page})=>{
   await page.getByRole('button',{name:'日历视图',exact:true}).click();
   await page.getByRole('menuitemradio',{name:/^日\s/}).click();
   const slot=page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');await slot.scrollIntoViewIfNeeded();
   const rect=await slot.boundingBox(),x=rect.x+120;
   await page.mouse.move(x,rect.y+2);await page.mouse.down();
   await page.mouse.move(x,rect.y+rect.height*4-2,{steps:15});
   await expect(page.locator('.cal-selection-time')).toHaveText('04:00 - 05:00');
   await page.mouse.move(x,rect.y+rect.height*6-2,{steps:8});
   await expect(page.locator('.cal-selection-time')).toHaveText('04:00 - 05:30');
   await page.screenshot({path:test.info().outputPath('selection-hour.png')});await page.mouse.up();
   await expectScheduleField(page, '开始时间', '04:00');await expectScheduleField(page, '结束时间', '05:30');
   await closed(page);await expect(page.locator('.cal-selection-time')).toHaveCount(0);
   await page.mouse.move(x,rect.y+rect.height*4-2);await page.mouse.down();
   await page.mouse.move(x,rect.y+2,{steps:15});await expect(page.locator('.cal-selection-time')).toHaveText('04:00 - 05:00');await page.mouse.up();await closed(page);
   await page.mouse.move(x,rect.y+1);await page.mouse.down();await page.mouse.move(x+8,rect.y+3,{steps:4});
   await expect(page.locator('.cal-selection-time')).toHaveText('04:00 - 04:05');
   const badge=await page.locator('.cal-selection-time').boundingBox();expect(badge.height).toBeGreaterThanOrEqual(16);
   await page.screenshot({path:test.info().outputPath('selection-five-minutes.png')});await page.mouse.up();
   await page.locator('.fc-timegrid-slot-lane[data-time="06:00:00"]').click({position:{x:120,y:5}});await expect(page.locator('.cal-selection-time')).toHaveCount(0);
   expect((await call('GET',E)).items).toHaveLength(0);
  });

  test('系统采用纽约时区时，夏令时结束按实际分钟显示和保存',async({page})=>{
   await switchZone(page,'America/New_York');await inSystemZone(page,'America/New_York');
   const dst=await call('POST',E,entry('夏令时课堂',{time:{date:'2026-11-01',startTime:'00:30',durationMinutes:120,timeZone:'America/New_York'}}));
   await page.goto(`${world.origin}/calendar?entry=${dst.id}`);await expectScheduleField(page, '结束时间', '01:30');
   await setScheduleField(page, '结束时间', '03:30');await expect.poll(async()=>(await call('GET',`${E}/${dst.id}`)).time.durationMinutes).toBe(240);
   await page.reload();await expectScheduleField(page, '结束时间', '03:30');
  });

  test('窄网格中的拖选时间不越过选区宽度，灰色提示在深色主题仍清楚',async({page})=>{
   await page.setViewportSize({width:1100,height:950});
   const col=page.locator('.fc-timegrid-col[data-date="2026-09-25"]');
   const slot=page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');await slot.scrollIntoViewIfNeeded();
   const column=await col.boundingBox(),rect=await slot.boundingBox();
   await page.mouse.move(column.x+column.width/2,rect.y+2);await page.mouse.down();
   await page.mouse.move(column.x+column.width/2,rect.y+rect.height*2-2,{steps:10});
   const preview=page.locator('.cal-selection-preview'),label=page.locator('.cal-selection-time');
   await expect(label).toHaveText('04:00 - 04:30');const box=await preview.boundingBox(),badge=await label.boundingBox();expect(badge.width).toBeLessThanOrEqual(box.width);
   await page.screenshot({path:test.info().outputPath('selection-narrow.png')});await page.mouse.up();await closed(page);
   await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:'深色',exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();
   const r=await slot.boundingBox(),c=await col.boundingBox();await page.mouse.move(c.x+c.width/2,r.y+2);await page.mouse.down();await page.mouse.move(c.x+c.width/2,r.y+r.height*2-2,{steps:10});await expect(label).toHaveText('04:00 - 04:30');await page.screenshot({path:test.info().outputPath('selection-dark.png')});await page.mouse.up();await closed(page);
  });

  test('当前时间保留秒数，跨系统分钟后红线同步，时区用偏移和完整标识',async({page})=>{
   now='2026-09-25T14:00:47Z';await page.clock.setFixedTime(new Date(now));await page.reload();
   await expect(page.locator('.cal-now-time')).toHaveText('22:00');
   now='2026-09-25T14:01:02Z';await page.clock.setFixedTime(new Date(now));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   await expect(page.locator('.cal-now-time')).toHaveText('22:01');
   await expect(page.locator('.cal-time-zone')).toHaveText('UTC+08:00 · Asia/Shanghai');
   await switchZone(page,'America/Phoenix');await inSystemZone(page,'America/Phoenix');await expect(page.locator('.cal-time-zone')).toHaveText('UTC-07:00 · America/Phoenix');
   await switchZone(page,'America/New_York');await inSystemZone(page,'America/New_York');await expect(page.locator('.cal-time-zone')).toHaveText('UTC-04:00 · America/New_York');
  });

  test('拖选预览只有一层背景，时间在选区中央',async({page})=>{
   await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:/^日\s/}).click();
   const slot=page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');await slot.scrollIntoViewIfNeeded();const r=await slot.boundingBox();await page.mouse.move(r.x+120,r.y+2);await page.mouse.down();await page.mouse.move(r.x+120,r.y+r.height*4-2,{steps:15});
   const preview=page.locator('.cal-selection-preview'),label=page.locator('.cal-selection-time');await expect(label).toHaveText('04:00 - 05:00');
   const p=await preview.boundingBox(),l=await label.boundingBox();expect(Math.abs(l.x+l.width/2-p.x-p.width/2)).toBeLessThan(2);expect(Math.abs(l.y+l.height/2-p.y-p.height/2)).toBeLessThan(2);
   await expect(page.locator('.fc-timegrid-col-bg .fc-highlight')).toBeHidden();await page.screenshot({path:test.info().outputPath('selection-centered.png')});await page.mouse.up();await closed(page);
  });

  test('页面持续打开时，红线在系统分钟边界自动更新',async({page})=>{
   await page.clock.install({time:new Date('2026-09-25T14:00:47Z')});await page.clock.setSystemTime(new Date('2026-09-25T14:00:47Z'));await page.reload();
   await expect(page.locator('.cal-now-time')).toHaveText('22:00');await page.clock.runFor(13050);await expect(page.locator('.cal-now-time')).toHaveText('22:01');
  });
});

test.describe('操作期间切换系统时区', () => {
  // CDP owns runtime timezone changes; a context override would prevent later changes.
  const E = '/api/modules/schedule/entries';

  let world, client, now, errors, cdp;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
      repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
      const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
      expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
    }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page,context }) => {
      cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Shanghai'});
      now = '2026-09-25T06:00:00Z';
      await page.clock.setFixedTime(new Date(now));
      errors = []; page.on('pageerror', e => errors.push(e.message));
      ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-graph@example.test'));
      await loginSchedule(page, world, 'schedule-graph@example.test');
      await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
    });

  test.afterEach(async ({ context }, info) => {
      await closeScheduleWorld(context, world, errors, info);
    });

  async function reloadOpen(page,task){await page.reload();await open(page,task.title);}

  const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];

  async function dayView(page){await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:/^日\s/}).click();}

  const N='/api/modules/schedule/notifications';

  for(const scope of ['待安排','普通任务','重复任务'])test(`R4 移动事项保存中切换时区，${scope}目标不会锁死日程`,async({page},info)=>{
     const source=await call('POST',E,entry('源任务',{items:row()}));const target=await call('POST',E,entry('目标任务',{...(scope==='待安排'?{time:null}:{}),...(scope==='重复任务'?{repeat:{until:'2026-10-09'}}:{})}));await reloadOpen(page,source);
     let release,hit;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);await page.route('**/api/modules/schedule/item-moves',async route=>{const response=await route.fetch();hit();await gate;await route.fulfill({response});});
     await page.locator('.tbx-item:not(.is-add)').nth(0).getByRole('button', { name: '事项选项', exact: true }).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();const d=page.getByRole('dialog',{name:'移动事项',exact:true});await d.getByLabel('移到',{exact:true}).selectOption(target.id);if(scope==='重复任务')await d.getByRole('radio',{name:'每次重复都需要',exact:true}).check();await d.getByRole('button',{name:'移动事项',exact:true}).click();await started;
     await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));release();
     try { await expect(page.locator('.cal-time-zone')).toHaveAttribute('title','America/New_York'); } finally {const observed=await page.evaluate(()=>({nativeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,shownZone:document.querySelector('.cal-time-zone')?.title,editorText:document.querySelector('.tbx-sheet')?.innerText,dialogText:document.querySelector('.cal-dialog')?.innerText}));if(observed.shownZone!==observed.nativeZone){await page.getByRole('button',{name:'关闭',exact:true}).click({timeout:2000}).catch(()=>{});try{await expect(page.locator('.tbx-sheet')).toHaveCount(0,{timeout:2000});observed.closeWorked=true;}catch{observed.closeWorked=false;}}fs.writeFileSync(info.outputPath('move-zone-observed.json'),JSON.stringify(observed,null,2));}await expect(d).toHaveCount(0);await expect(page.getByText('正在移动事项',{exact:true})).toHaveCount(0);
     expect((await call('GET',`${E}/${source.id}`)).items).toHaveLength(0);expect((await call('GET',`${E}/${target.id}`)).items).toHaveLength(1);
    });

  for(const [zone,offset,clock] of [['UTC','UTC+00:00','6:00'],['Asia/Kathmandu','UTC+05:45','11:45'],['Australia/Lord_Howe','UTC+10:30','16:30'],['Pacific/Apia','UTC+13:00','19:00']])test(`Z1 系统切换${zone}，偏移与当前红线一致而任务钟点不变`,async({page})=>{
     const task=await call('POST',E,entry('特殊偏移任务',{time:{...entry('').time,startTime:'23:00'}}));await reloadOpen(page,task);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:zone});const canonical=await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.cal-time-zone')).toHaveAttribute('title',canonical);await expect(page.locator('.cal-time-zone')).toContainText(offset);await dayView(page);const saved=await call('GET',`${E}/${task.id}`);expect(saved.time).toEqual({...task.time,timeZone:canonical});await expectScheduleField(page, '开始时间', '23:00');await expect(page.locator('.cal-now-time')).toHaveText(clock.padStart(5,'0'));
    });

  for(const [zone,date,start,actual,end,instant]of [['America/New_York','2026-03-08','02:30','03:30','04:00','2026-03-08T07:30:00.000Z'],['Australia/Lord_Howe','2026-10-04','02:15','02:45','03:15','2026-10-03T15:45:00.000Z']])test(`Z2 ${zone}夏令时缺失钟点保留输入、显示实际时间并按实际开始提醒`,async({page})=>{
     now=date==='2026-03-08'?'2026-03-08T05:00:00Z':'2026-10-03T14:00:00Z';await page.clock.setFixedTime(new Date(now));await cdp.send('Emulation.setTimezoneOverride',{timezoneId:zone});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.cal-time-zone')).toHaveAttribute('title',zone);const task=await call('POST',E,entry('夏令时缺失时刻',{time:{date,startTime:start,durationMinutes:30,timeZone:zone},reminder:{anchor:'start',side:'before',minutes:0}}));await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expectScheduleField(page, '开始时间', start);await expectScheduleField(page, '结束时间', end);await expect(page.getByText(/夏令时跳时/)).toContainText(actual);now=instant;await page.clock.setFixedTime(new Date(now));const notices=(await call('GET',N)).items;expect(notices).toHaveLength(1);expect(Date.parse(notices[0].dueAt)).toBe(Date.parse(instant));expect((await call('GET',`${E}/${task.id}`)).time.startTime).toBe(start);
    });

  test('Z3 事项移动期间由实际定时器检测时区变化，不依赖合成焦点事件且不会锁死',async({page},info)=>{
     const source=await call('POST',E,entry('定时检测的移动源',{items:row()}));const target=await call('POST',E,entry('定时检测的移动目标',{time:null}));await reloadOpen(page,source);let release,hit;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);await page.route('**/api/modules/schedule/item-moves',async route=>{const response=await route.fetch();hit();await gate;await route.fulfill({response});});await page.locator('.tbx-item:not(.is-add)').nth(0).getByRole('button', { name: '事项选项', exact: true }).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();const d=page.getByRole('dialog',{name:'移动事项',exact:true});await d.getByLabel('移到',{exact:true}).selectOption(target.id);await d.getByRole('button',{name:'移动事项',exact:true}).click();await started;await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});
     // This duration deliberately crosses the product's real 15-second detector.
     // Date is fixed; timers remain real. No synthetic focus/visibility event.
     await page.waitForTimeout(16000);release();try{await expect(page.locator('.cal-time-zone')).toHaveAttribute('title','America/New_York');}finally{const observed=await page.evaluate(()=>({nativeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,shownZone:document.querySelector('.cal-time-zone')?.title}));observed.detection='real 15-second timer';await page.getByRole('button',{name:'关闭',exact:true}).click({timeout:2000}).catch(()=>{});try{await expect(page.locator('.tbx-sheet')).toHaveCount(0,{timeout:2000});observed.closeWorked=true;}catch{observed.closeWorked=false;}fs.writeFileSync(info.outputPath('move-zone-observed.json'),JSON.stringify(observed,null,2));}
    });
});
