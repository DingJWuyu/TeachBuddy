import { setScheduleField, expectScheduleField, openRepeat, scheduleAction } from './controls.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createScheduleWorld, loginSchedule, closeScheduleWorld } from './fixture.mjs';

test.describe('任务读取与保存一致性', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });
  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, now, errors;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
    const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
  }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page }) => {
    now = '2026-09-25T06:00:00Z';
    await page.clock.setFixedTime(new Date(now));
    errors = []; page.on('pageerror', e => errors.push(e.message));
    ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-audit@example.test'));
    await loginSchedule(page, world, 'schedule-audit@example.test');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  async function action(page, name) { await scheduleAction(page, name); }

  async function closed(page) { await page.getByRole('button',{name:'关闭',exact:true}).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  const items=()=>['准备讲义','整理反馈','打印清单'].map(text=>({id:randomUUID(),text,priority:'normal'}));

  for(const field of ['标题']) test(`清空已有任务${field}后可直接取消，不被校验困住`,async({page})=>{
   const task=await call('POST',E,entry(`清空${field}后取消`));await page.reload();await open(page,task.title);
   await page.getByRole('textbox',{name:'备注',exact:true}).fill('关闭时保留有效备注');
   await page.locator('#calendar-entry-title').fill('');
   await closed(page);
   const saved=await call('GET',`${E}/${task.id}`);expect(saved.title).toBe(task.title);expect(saved.time).toEqual(task.time);expect(saved.calendar.notes).toBe('关闭时保留有效备注');
  });

  test('事项拖动中按Escape只取消手势，保留编辑器与原顺序',async({page})=>{
   const task=await call('POST',E,entry('取消事项拖动',{items:items()}));await page.reload();await open(page,task.title);
   await expect(page.locator('.cal-sidebar')).toHaveCSS('opacity','1');
   await expect(page.locator('.tbx-item-grip').first()).toBeVisible();
   await page.locator('.tbx-item:not(.is-add)').last().scrollIntoViewIfNeeded();
   await page.locator('.tbx-item-grip').first().scrollIntoViewIfNeeded();
   const a=await page.locator('.tbx-item-grip').first().boundingBox(),b=await page.locator('.tbx-item:not(.is-add)').last().boundingBox();
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+10,b.y+b.height-2,{steps:15});
   await expect(page.locator('.tbx-item.is-origin')).toHaveCount(1);
   await page.keyboard.press('Escape');await page.mouse.up();
   await expect(page.locator('.tbx-sheet')).toHaveCount(1);
   expect((await call('GET',`${E}/${task.id}`)).items.map(x=>x.text)).toEqual(task.items.map(x=>x.text));
  });

  test('删除当前任务后，先前未完成的另一任务读取不会重新打开编辑器',async({page})=>{
   const a=await call('POST',E,entry('删除中的任务')),b=await call('POST',E,entry('迟到读取任务',{time:{...entry('').time,startTime:'16:00'}}));
   await page.reload();await open(page,a.title);
   let release,hit;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{hit=r;});
   await page.route(`**${E}/${b.id}`,async route=>{if(route.request().method()!=='GET')return route.continue();hit();await gate;await route.continue();});
   const card=page.locator('.fc-timegrid-event').filter({hasText:b.title}).first();await card.scrollIntoViewIfNeeded();await card.click();await started;
   await action(page,'删除任务');await page.locator('.tbx-sheet-delete').click();
   await expect(page.locator('.tbx-sheet')).toHaveCount(0);
   const response=page.waitForResponse(r=>r.url().endsWith(`${E}/${b.id}`));release();await(await response).finished();await page.waitForTimeout(250);
   await expect(page.locator('.tbx-sheet')).toHaveCount(0);
  });

  test('完成状态在保存延迟期间快速切换，最后一次操作保留',async({page})=>{
   const task=await call('POST',E,entry('完成状态延迟保存',{items:items()}));await page.reload();await open(page,task.title);
   let release,hit,intercept=true;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{hit=r;});
   await page.route(`**${E}/${task.id}`,async route=>{if(route.request().method()!=='PUT'||!intercept)return route.continue();intercept=false;hit();await gate;await route.continue();});
   await page.locator('.tbx-item-check').first().click();await started;await page.locator('.tbx-item-check').first().click();release();
   await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[0].completed).toBe(false);
   await closed(page);await page.reload();await open(page,task.title);await expect(page.locator('.tbx-item-check').first()).toHaveAttribute('aria-pressed','false');
  });

  test('已完成事项移入待安排后保留完成状态，并可撤销完成',async({page})=>{
   const task=await call('POST',E,entry('带完成状态的源任务',{items:[{...items()[0],completed:true}]}));const target=await call('POST',E,entry('完成事项移入的待安排',{time:null}));
   await page.reload();await open(page,task.title);await page.locator('.tbx-item:not(.is-add)').nth(0).getByRole('button', { name: '事项选项', exact: true }).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'移动事项',exact:true});await dialog.getByRole('combobox',{name:'移到',exact:true}).selectOption(target.id);await dialog.getByRole('button',{name:'移动事项',exact:true}).click();
   await expect(page.locator('#calendar-entry-title')).toHaveValue(target.title);await expect(page.locator('.tbx-item-check')).toHaveAttribute('aria-pressed','true');
   await page.locator('.tbx-item-check').click();await expect.poll(async()=>(await call('GET',`${E}/${target.id}`)).items[0].completed).toBe(false);
   expect((await call('GET',`${E}/${task.id}`)).items).toHaveLength(0);
  });

  test('重复实例完成事项只改变当前任务，后续事项保持未完成',async({page})=>{
   const task=await call('POST',E,entry('重复事项完成范围',{items:items(),repeat:{until:'2026-10-09'}}));await page.reload();await page.getByRole('button',{name:'任务',exact:true}).click();await page.locator('.tbx-task').filter({hasText:task.title}).first().locator('.tbx-task-item').first().click();
   await expect.poll(async()=>(await call('GET',E)).items.filter(x=>x.title===task.title).length).toBe(2);
   const list=(await call('GET',E)).items.filter(x=>x.title===task.title),single=list.find(x=>!x.repeat);expect(single.items[0].completed).toBe(true);
   const next=await call('GET',`${E}/${task.id}/occurrence?originDate=2026-10-02`);expect(Boolean(next.items[0].completed)).toBe(false);
  });

  test('重复次数填0不能悄悄换成4次并保存',async({page})=>{
   const task=await call('POST',E,entry('重复次数校验',{repeat:{until:'2026-10-09'}}));await page.reload();await open(page,task.title);await openRepeat(page);
   const dialog=page.getByRole('dialog',{name:'重复',exact:true});await dialog.getByRole('radio',{name:/次数/}).check();await dialog.getByRole('spinbutton',{name:'重复次数',exact:true}).fill('0');
   const count=dialog.getByRole('spinbutton',{name:'重复次数',exact:true}),done=dialog.getByRole('button',{name:'完成',exact:true});
   for(const value of ['0','','-1','1.5','10001']) { await count.fill(value); await expect(count).toHaveValue(value); await expect(done).toBeDisabled(); }
   await count.fill('2'); await done.click();
   await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).repeat.count).toBe(2);
  });

  for(const width of [1675,390]) test(`长标签和备注在${width}宽度下保持可读且不溢出`,async({page})=>{
   const tag=await call('POST',L,{name:'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ12345678',color:'#ff6b75'});
   const task=await call('POST',E,entry('长文本边界',{time:null,calendar:{allDay:false,notes:'连续无空格文本'.repeat(100),tags:[tag.id]}}));await page.reload();await page.getByRole('region',{name:'待安排',exact:true}).locator('.cal-upcoming-row').filter({hasText:task.title}).click();
   await page.setViewportSize({width,height:950});
   for(const selector of ['.cal-sidebar','.tbx-labels','.tbx-sheet-notes']) {
    const layout=await page.locator(selector).evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));expect(layout.scroll,selector).toBeLessThanOrEqual(layout.client);
   }
   await expect(page.locator('.cal-sidebar')).toHaveCSS('opacity','1');
   await page.screenshot({path:test.info().outputPath(`long-text-${width}.png`),animations:'disabled'});
   await closed(page);await page.reload();expect((await call('GET',`${E}/${task.id}`)).calendar).toEqual(task.calendar);
  });

  test('任务读取快照未返回时拖动改期，迟到读取不恢复旧时间',async({page})=>{
   const task=await call('POST',E,entry('改期期间的迟到读取'));await page.reload();await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:/^月\s/}).click();
   let release,hit,intercept=true;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{hit=r;});
   await page.route(`**${E}/${task.id}`,async route=>{
    if(route.request().method()!=='GET'||!intercept)return route.continue();intercept=false;
    const snapshot=await route.fetch();hit();await gate;await route.fulfill({response:snapshot});
   });
   const card=page.locator('.fc-daygrid-event').filter({hasText:task.title}).first();await card.click();await started;
   const a=await card.boundingBox(),b=await page.locator('.fc-daygrid-day[data-date="2026-09-26"]').boundingBox();
   await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+50,{steps:20});await page.mouse.up();
   await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).time.date).toBe('2026-09-26');
   const response=page.waitForResponse(r=>r.url().endsWith(`${E}/${task.id}`));release();await(await response).finished();await page.waitForTimeout(250);
   await expect(page.locator('.tbx-sheet')).toHaveCount(0);
   await page.locator('.fc-daygrid-day[data-date="2026-09-26"] .fc-daygrid-event').filter({hasText:task.title}).first().click();
   await expect(page.locator('.tbx-sheet')).toBeVisible();
   await expectScheduleField(page, '开始日期', '2026-09-26');
  });

  test('长备注保存结果未知时，关闭被阻断的原因仍在当前视野可见',async({page})=>{
   const task=await call('POST',E,entry('长备注保存异常现场'));await page.reload();await open(page,task.title);
   await page.route(`**${E}/${task.id}`,async route=>{
    if(route.request().method()!=='PUT')return route.continue();
    await route.fetch();await route.abort('failed');
   });
   await page.getByRole('textbox',{name:'备注',exact:true}).fill(Array.from({length:30},(_,i)=>`第${i+1}行：检查失败后能否在当前视野理解发生了什么`).join('\n'));
   await page.keyboard.press('ControlOrMeta+s');
   await expect(page.locator('.tbx-sheet .cal-error')).toContainText('确认');
   await page.getByRole('button',{name:'关闭',exact:true}).click();
   await expect(page.locator('.tbx-sheet')).toHaveCount(1);
   const error=await page.locator('.tbx-sheet .cal-error').boundingBox(),panel=await page.locator('.tbx-sheet').boundingBox();
   expect(error.y).toBeLessThan(panel.y+panel.height);
   expect(error.y+error.height).toBeGreaterThan(panel.y);
   await page.screenshot({path:test.info().outputPath('save-feedback.png'),animations:'disabled'});
   await page.unroute(`**${E}/${task.id}`);
   await page.getByRole('button',{name:'重试确认',exact:true}).click();
   await expect(page.locator('.tbx-sheet-error')).toHaveCount(0);
   await closed(page);expect((await call('GET',`${E}/${task.id}`)).version).toBe(2);
  });

  test('提醒支持开始前后及结束前后，保存与摘要保持一致',async({page})=>{
   const task=await call('POST',E,entry('四种提醒时机'));await page.reload();await open(page,task.title);
   for(const [mode,label,anchor,side] of [['start-before','开始前','start','before'],['start-after','开始后','start','after'],['end-before','结束前','end','before'],['end-after','结束后','end','after']]) {
    await action(page,'设置提醒');const dialog=page.getByRole('dialog',{name:'提醒',exact:true});
    await dialog.getByRole('combobox',{name:'提醒时机',exact:true}).selectOption({label});
    await dialog.getByRole('spinbutton').fill('5');await dialog.getByRole('button',{name:'完成',exact:true}).click();
    await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^提醒/ })).toContainText(`${label} 5 分钟提醒`);
    await page.keyboard.press('ControlOrMeta+s');
    await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).reminder).toEqual(anchor==='start'?{anchor,side,minutes:5}:{side,minutes:5});
   }
  });

  test('标签分类在两区保持较小标题与图标，深浅主题均清晰',async({page})=>{
   const label=await call('POST',L,{name:'课堂准备',color:'#34d399'}),calendar={allDay:false,tags:[label.id],notes:''};
   await call('POST',E,entry('安排课堂准备',{calendar}));await call('POST',E,entry('记下课堂准备',{calendar,time:null}));await page.reload();
   await page.getByRole('button',{name:'按标签分组',exact:true}).click();await page.getByRole('button',{name:'待安排：按标签分组',exact:true}).click();
   for(const section of ['即将到来','待安排']) {
    const region=page.getByRole('region',{name:section,exact:true}),group=region.locator('.cal-upcoming-group h3');
    await expect(group).toHaveCSS('font-size','14px');await expect(group.locator('svg')).toHaveAttribute('width','16');
    await expect(region.locator('h2')).toHaveCSS('font-size','16px');
   }
   await page.screenshot({path:test.info().outputPath('groups-light.png'),animations:'disabled'});
   await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:'深色',exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();
   await expect(page.locator('html')).toHaveAttribute('data-workbench-theme','dark');
   await page.screenshot({path:test.info().outputPath('groups-dark.png'),animations:'disabled'});
   await open(page,'安排课堂准备');await action(page,'设置提醒');await page.setViewportSize({width:390,height:950});
   await page.screenshot({path:test.info().outputPath('reminder-dark-mobile.png'),animations:'disabled'});
  });

  test('待安排临时安排了无效开始时间，关闭仍保留待安排及有效备注',async({page})=>{
   const task=await call('POST',E,entry('待安排取消无效时间',{time:null}));await page.reload();await open(page,task.title);
   await page.getByRole('button',{name:'放进日历，变成任务',exact:true}).click();
   await page.locator('.tbx-sheet').getByRole('button',{name:'开始时间',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('textbox',{name:'备注',exact:true}).fill('保留待安排备注');await closed(page);
   const saved=await call('GET',`${E}/${task.id}`);expect(saved.time).toBeNull();expect(saved.reminder).toBeNull();expect(saved.calendar.notes).toBe('保留待安排备注');
  });
});

test.describe('跨日导航与连续编辑', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });
  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, now, errors;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
    repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
    const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
  }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  async function close(page) { await page.getByRole('button', { name: '关闭', exact: true }).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  async function view(page, name) {
    await page.getByRole('button', { name: '日历视图', exact: true }).click();
    await page.getByRole('menuitemradio', { name: new RegExp(`^${name}\\s`) }).click();
  }

  async function dragDates(page, from, to, cancel = false) {
    const a = await page.locator(`.cal-mini [data-date="${from}"]`).boundingBox();
    const b = await page.locator(`.cal-mini [data-date="${to}"]`).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
  }

  test.beforeEach(async ({ page }, info) => {
    now = '2026-09-25T06:00:00Z';
    if (/快速连点|任务读取未完成/.test(info.title)) await page.clock.setFixedTime(new Date(now));
    else await page.clock.install({ time: new Date(now) });
    errors = []; page.on('pageerror', e => errors.push(e.message));
    ({ world, client } = await createScheduleWorld(() => new Date(now), 'schedule-closeout@example.test'));
    await loginSchedule(page, world, 'schedule-closeout@example.test');
  });

  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  test('页面跨午夜更新今天、时间线和即将到来，跨夜进行中的任务保留', async ({ page }) => {
    await call('POST', E, entry('跨夜进行中', { time: { ...entry('').time, startTime: '23:50', durationMinutes: 20 } }));
    await call('POST', E, entry('午夜结束', { time: { ...entry('').time, startTime: '23:40', durationMinutes: 20 } }));
    await call('POST', E, entry('次日安排', { time: { ...entry('').time, date: '2026-09-26', startTime: '00:20' } }));
    now = '2026-09-25T15:59:30Z'; await page.clock.setSystemTime(new Date(now)); await page.reload();
    const upcoming = page.getByRole('region', { name: '即将到来', exact: true });
    await expect(upcoming.locator('.cal-upcoming-title')).toHaveText(['午夜结束', '跨夜进行中']);
    now = '2026-09-25T16:00:30Z'; await page.clock.runFor(60000);
    await expect(page.locator('.cal-mini button.is-today')).toHaveAttribute('data-date', '2026-09-26');
    await expect(upcoming.locator('.cal-upcoming-title')).toHaveText(['跨夜进行中', '次日安排']);
    const line = page.locator('.fc-timegrid-now-indicator-line').first();
    await expect(line).toBeAttached();
    expect(await line.evaluate(el => parseFloat(el.style.top))).toBeLessThan(5);
  });

  test('跨夜任务换日期和视图仍选中正确任务，结束时间跨日保存读回', async ({ page }) => {
    const task = await call('POST', E, entry('夜间整理', { time: { ...entry('').time, startTime: '23:50', durationMinutes: 20 } }));
    await page.reload(); await open(page, task.title);
    await expect(page.locator('.fc-timegrid-event.is-selected')).toHaveCount(2);
    await page.locator('.cal-mini [data-date="2026-09-26"]').click(); await view(page, '日');
    await expect(page.locator('.fc-timegrid-event.is-selected')).toHaveCount(1);
    await expectScheduleField(page, '开始日期', '2026-09-25');
    await expectScheduleField(page, '结束日期', '2026-09-26');
    await setScheduleField(page, '结束时间', '00:15');
    await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).time.durationMinutes).toBe(25);
    await view(page, '月'); await expect(page.locator('.fc-daygrid-event.is-selected')).toHaveCount(1);
    await expect(page.locator('.cal-selected-day[data-date="2026-09-25"]')).toHaveCount(1);
    await expect(page.locator('.cal-selected-day[data-date="2026-09-26"]')).toHaveCount(1);
    await close(page); await page.reload();
    expect((await call('GET', `${E}/${task.id}`)).time).toEqual({ ...task.time, durationMinutes: 25 });
  });

  test('小月历只翻月不改主视图，跨年正反拖选及Escape取消一致', async ({ page }) => {
    const before = await page.locator('.fc-col-header-cell[data-date]').evaluateAll(nodes => nodes.map(n => n.dataset.date));
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '下个月', exact: true }).click();
    expect(await page.locator('.fc-col-header-cell[data-date]').evaluateAll(nodes => nodes.map(n => n.dataset.date))).toEqual(before);
    await dragDates(page, '2026-12-30', '2027-01-03');
    await expect(page.locator('.fc-col-header-cell[data-date]')).toHaveCount(5);
    await expect(page.locator('.fc-col-header-cell[data-date]').first()).toHaveAttribute('data-date', '2026-12-30');
    await expect(page.locator('.fc-col-header-cell[data-date]').last()).toHaveAttribute('data-date', '2027-01-03');
    await dragDates(page, '2027-01-03', '2026-12-30');
    await expect(page.locator('.fc-col-header-cell[data-date]')).toHaveCount(5);
    await dragDates(page, '2026-12-28', '2027-01-02', true);
    await expect(page.locator('.fc-col-header-cell[data-date]').first()).toHaveAttribute('data-date', '2026-12-30');
    expect((await call('GET', E)).items).toHaveLength(0);
  });

  test('快速连点任务遇到读取响应乱序时，以最后点击的任务为准', async ({ page }) => {
    const a = await call('POST', E, entry('先点的任务'));
    const b = await call('POST', E, entry('最后点的任务', { time: { ...entry('').time, startTime: '16:00' } }));
    await page.reload();
    let release, hit;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { hit = resolve; });
    await page.route(`**${E}/${a.id}`, async route => { if (route.request().method() !== 'GET') return route.continue(); hit(); await gate; await route.continue(); });
    await open(page, a.title); await started; await open(page, b.title);
    await expect(page.locator('#calendar-entry-title')).toHaveValue(b.title);
    const response = page.waitForResponse(r => r.url().endsWith(`${E}/${a.id}`));
    release(); await (await response).finished(); await page.waitForTimeout(250);
    await expect(page.locator('#calendar-entry-title')).toHaveValue(b.title);
  });

  test('保存响应延迟时跨日换视图和继续输入，最新内容保留且只保存同一任务', async ({ page }) => {
    const task = await call('POST', E, entry('连续编辑'));
    await page.reload(); await open(page, task.title);
    let release, hit; let intercept = true;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { hit = resolve; });
    await page.route(`**${E}/${task.id}`, async route => {
      if (route.request().method() !== 'PUT' || !intercept) return route.continue();
      intercept = false; hit(); await gate; const result = await route.fetch(); await route.fulfill({ response: result });
    });
    await page.locator('#calendar-entry-title').fill('第一版'); await started;
    await page.locator('#calendar-entry-title').fill('最终标题');
    await page.getByRole('textbox', { name: '备注', exact: true }).fill('等待响应时继续输入');
    await page.locator('.cal-mini [data-date="2026-09-26"]').click(); await view(page, '月');
    release();
    await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).calendar.notes).toBe('等待响应时继续输入');
    await expect(page.locator('#calendar-entry-title')).toHaveValue('最终标题');
    await close(page); await page.reload();
    const saved = await call('GET', E); expect(saved.items).toHaveLength(1); expect(saved.items[0].title).toBe('最终标题');
  });

  test('多标签、无标签、长标题在两种列表中保持分类、计数和滚动', async ({ page }) => {
    const a = await call('POST', L, { name: '教学', color: '#ff6b75' });
    const b = await call('POST', L, { name: '个人', color: '#3edc81' });
    const long = '检查很长的标题是否仍然完整保存，列表里应截断显示'.repeat(8);
    await call('POST', E, entry(long, { time: null, calendar: { allDay: false, notes: '第一行\n第二行', tags: [a.id, b.id] } }));
    await call('POST', E, entry('无标签待安排', { time: null }));
    await call('POST', E, entry('今天未来的任务', { calendar: { allDay: false, notes: '', tags: [a.id, b.id] } }));
    await call('POST', E, entry('已经结束', { time: { ...entry('').time, startTime: '10:00' } }));
    await call('POST', E, entry('未来日期', { time: { ...entry('').time, date: '2026-09-26' } }));
    await page.reload();
    const pending = page.getByRole('region', { name: '待安排', exact: true });
    const upcoming = page.getByRole('region', { name: '即将到来', exact: true });
    await expect(pending.locator('h2')).toHaveText('待安排(2)'); await expect(upcoming.locator('h2')).toHaveText('即将到来(1)');
    await pending.getByRole('button', { name: '待安排：按标签分组', exact: true }).click();
    await upcoming.getByRole('button', { name: '按标签分组', exact: true }).click();
    await expect.poll(async () => (await pending.locator('.cal-group-name').allTextContents()).sort()).toEqual(['个人', '教学', '无标签'].sort());
    await expect(upcoming.locator('.cal-upcoming-row')).toHaveCount(2);
    expect(await page.locator('.cal-upcoming').evaluate(el => getComputedStyle(el).scrollbarWidth)).toBe('none');
    await pending.locator('.cal-upcoming-row').first().click();
    await expect(page.locator('#calendar-entry-title')).toHaveValue(long);
    await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveValue('第一行\n第二行');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });

  test('最大事项数量禁用添加，键盘排序保存后允许删除并继续添加', async ({ page }) => {
    const items = Array.from({ length: 200 }, (_, index) => ({ id: randomUUID(), text: `事项${index + 1}`, priority: 'normal' }));
    const task = await call('POST', E, entry('事项上限', { time: null, items }));
    await page.reload(); await open(page, task.title);
    await expect(page.getByRole('textbox', { name: '添加事项', exact: true })).toBeDisabled();
    await page.locator('.tbx-item-grip').filter({has:page.locator('svg')}).last().focus(); await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await call('GET', `${E}/${task.id}`)).items[198].text).toBe('事项200');
    await page.locator('.tbx-item:not(.is-add)').nth(199).getByRole('button', { name: '事项选项', exact: true }).click();
    await page.getByRole('menuitem', { name: '删除事项', exact: true }).click();
    await page.getByRole('menuitem', { name: '确认删除', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '添加事项', exact: true })).toBeEnabled();
    await close(page); expect((await call('GET', `${E}/${task.id}`)).items).toHaveLength(199);
  });

  test('无效结束时间不保存，修正后可继续关闭且不会丢失备注', async ({ page }) => {
    const task = await call('POST', E, entry('时间校验'));
    await page.reload(); await open(page, task.title);
    await setScheduleField(page, '结束时间', '14:00');
    await page.getByRole('textbox', { name: '备注', exact: true }).fill('修正后保留');
    await expect(page.locator('.tbx-sheet-hint.is-error')).toContainText('时间无效');
    expect((await call('GET', `${E}/${task.id}`)).version).toBe(task.version);
    await setScheduleField(page, '结束时间', '15:45'); await close(page); await page.reload();
    const saved = await call('GET', `${E}/${task.id}`); expect(saved.time.durationMinutes).toBe(45); expect(saved.calendar.notes).toBe('修正后保留');
  });

  test('任务读取未完成时点空白取消，晚到响应不重新打开任务', async ({ page }) => {
    const task = await call('POST', E, entry('已取消打开的任务'));
    await page.reload();
    let release, hit;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { hit = resolve; });
    await page.route(`**${E}/${task.id}`, async route => { if (route.request().method() !== 'GET') return route.continue(); hit(); await gate; await route.continue(); });
    await open(page, task.title); await started;
    const cell = page.locator('.fc-timegrid-slot-lane[data-time="01:00:00"]');
    await cell.scrollIntoViewIfNeeded(); const box = await cell.boundingBox();
    await page.mouse.click(box.x + 20, box.y + 5);
    const response = page.waitForResponse(r => r.url().endsWith(`${E}/${task.id}`));
    release(); await (await response).finished(); await page.waitForTimeout(250);
    await expect(page.locator('.tbx-sheet')).toHaveCount(0);
  });

  test('月视图窗口缩小和放大时，任务与更多入口不越过日期格', async ({ page }) => {
    for (let index = 0; index < 6; index++) await call('POST', E, entry(`折叠任务${index + 1}`, { time: { ...entry('').time, startTime: `15:${String(index * 5).padStart(2, '0')}`, durationMinutes: 5 } }));
    await page.reload(); await view(page, '月');
    const day = page.locator('.fc-daygrid-day[data-date="2026-09-25"]');
    await day.scrollIntoViewIfNeeded();
    for (const height of [550, 950]) {
      await page.setViewportSize({ width: 1675, height });
      await expect(day.locator('.fc-daygrid-more-link')).toBeVisible();
      await expect.poll(() => day.evaluate(el => {
        const frame = el.querySelector('.fc-daygrid-day-frame').getBoundingClientRect();
        return [...el.querySelectorAll('.fc-daygrid-event, .fc-daygrid-more-link')].filter(n => n.getClientRects().length && getComputedStyle(n.closest('.fc-daygrid-event-harness') ?? n).visibility !== 'hidden').every(n => n.getBoundingClientRect().bottom <= frame.bottom + 1);
      })).toBeTruthy();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
  });
});

test.describe('排期状态转换保留任务内容', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });
  const E = '/api/modules/schedule/entries';
  let world, client, errors;
  async function read(id) {
    const response = await client.request('GET', `${E}/${id}`);
    expect(response.status).toBe(200);
    return response.json;
  }
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-25T06:00:00Z'));
    errors = []; page.on('pageerror', error => errors.push(error.message));
    ({ world, client } = await createScheduleWorld(() => new Date('2026-09-25T06:00:00Z')));
    await loginSchedule(page, world);
  });
  test.afterEach(async ({ context }, info) => {
    await closeScheduleWorld(context, world, errors, info);
  });

  test('全天任务移回待安排再安排时间，保留标签备注和已完成事项并清除全天状态', async ({ page }) => {
    const labelResponse = await client.request('POST', '/api/modules/schedule/labels', {
      body: { name: '讲义', color: '#63c6ec' }, headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(labelResponse.status).toBeLessThan(300);
    const label = labelResponse.json;
    const response = await client.request('POST', E, {
      body: {
        title: '全天任务重新排期',
        items: [{ id: randomUUID(), text: '打印讲义', priority: 'normal', completed: true }],
        time: { date: '2026-09-25', startTime: '00:00', durationMinutes: 1440, timeZone: 'Asia/Shanghai' },
        repeat: null, reminder: null, calendar: { allDay: true, tags: [label.id], notes: '重新排期仍保留' },
      }, headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(response.status).toBeLessThan(300);
    const task = response.json;
    await page.goto(`${world.origin}/calendar?entry=${task.id}`);
    await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
    await page.getByRole('button', { name: '移回待安排', exact: true }).click();
    await page.getByRole('alertdialog', { name: '移回待安排？', exact: true }).getByRole('button', { name: '移回待安排', exact: true }).click();
    await expect.poll(async () => (await read(task.id)).time).toBeNull();
    let saved = await read(task.id);
    expect(saved.calendar).toEqual({ ...task.calendar, allDay: false });
    expect(saved.items).toEqual(task.items);
    expect(saved.repeat).toBeNull();
    await page.getByRole('button', { name: '放进日历，变成任务', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+s');
    await expect.poll(async () => Boolean((await read(task.id)).time)).toBe(true);
    saved = await read(task.id);
    expect(saved.calendar).toEqual({ ...task.calendar, allDay: false });
    expect(saved.items).toEqual(task.items);
    expect(saved.repeat).toBeNull();
    await page.reload();
    await expect(page.locator('#calendar-entry-title')).toHaveValue(task.title);
    await expect(page.getByRole('textbox', { name: '备注', exact: true })).toHaveValue(task.calendar.notes);
    expect((await read(task.id)).time).toEqual(saved.time);
  });
});

test.describe('编辑后离开时保存最新输入', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

  let world, client, now, errors;

  const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
      repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });

  async function call(method, url, body) {
      const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
      expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
    }

  async function open(page, title) { const row = page.locator('.cal-upcoming-row').filter({ hasText: title }); if (!await row.isVisible() && await page.getByRole('button', { name: '打开月份与任务', exact: true }).isVisible()) await page.getByRole('button', { name: '打开月份与任务', exact: true }).click(); await row.click(); }

  test.beforeEach(async ({ page }) => {
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

  async function closed(page) { await page.getByRole('button',{name:'关闭',exact:true}).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];

  async function reloadOpen(page,task){await page.reload();await open(page,task.title);}

  async function view(page,name){await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:new RegExp(`^${name}\\s`)}).click();}

  for(const field of ['标题','备注','开始日期','开始时间','事项','标签'])for(const next of ['关闭','刷新','换视图','换任务','点空白'])test(`G2 修改${field}后立即${next}，保存最后输入且不串任务`,async({page})=>{
     const label=await call('POST',L,{name:'讲义',color:'#63c6ec'});const task=await call('POST',E,entry('课堂准备',{items:row()}));const other=await call('POST',E,entry('另一任务',{time:{...entry('').time,startTime:'16:00'}}));await reloadOpen(page,task);
     if(field==='标题')await page.locator('#calendar-entry-title').fill('修改后的标题');
     if(field==='备注')await page.getByRole('textbox',{name:'备注',exact:true}).fill('第一行\n第二行：数学 ∑ x²');
     if(field==='开始日期')await setScheduleField(page, '开始日期', '2026-09-26');
     if(field==='开始时间')await setScheduleField(page, '开始时间', '15:05');
     if(field==='事项')await page.getByLabel('事项 1',{exact:true}).fill('最后输入的事项');
     if(field==='标签')await page.locator('.tbx-labels').getByRole('button',{name:'讲义',exact:true}).click();
     if(next==='关闭')await closed(page);
     if(next==='刷新')await page.reload();
     if(next==='换视图')await view(page,'月');
     if(next==='换任务'){const card=page.locator('.fc-timegrid-event').filter({hasText:other.title});await card.scrollIntoViewIfNeeded();await card.click();}
     if(next==='点空白'){const lane=page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');await lane.scrollIntoViewIfNeeded();await lane.click({position:{x:100,y:4}});}
     await expect.poll(async()=>{const x=await call('GET',`${E}/${task.id}`);return field==='标题'?x.title:field==='备注'?x.calendar.notes:field==='开始日期'?x.time.date:field==='开始时间'?x.time.startTime:field==='事项'?x.items[0].text:x.calendar.tags;}).toEqual({'标题':'修改后的标题','备注':'第一行\n第二行：数学 ∑ x²','开始日期':'2026-09-26','开始时间':'15:05','事项':'最后输入的事项','标签':[label.id]}[field]);
     expect((await call('GET',`${E}/${other.id}`)).version).toBe(other.version);expect((await call('GET',E)).items).toHaveLength(2);
    });
});

test.describe('异步标签与任务保存', () => {
  // CDP owns runtime timezone changes; a context override would prevent later changes.
  const E = '/api/modules/schedule/entries';

  const L = '/api/modules/schedule/labels';

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

  async function action(page, name) { await scheduleAction(page, name); }

  async function closed(page) { await page.getByRole('button',{name:'关闭',exact:true}).click(); await expect(page.locator('.tbx-sheet')).toHaveCount(0); }

  async function reloadOpen(page,task){await page.reload();await open(page,task.title);}

  const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];

  async function labelDialog(page,label){
     if(label)await page.locator('.tbx-labels').getByRole('button',{name:label.name,exact:true}).dblclick();else await page.getByRole('button',{name:'新标签',exact:true}).click();
     return page.getByRole('dialog',{name:label?'编辑标签':'创建标签',exact:true});}

  async function saveLast(page){await page.keyboard.press('ControlOrMeta+s');await expect.poll(async()=>(await call('GET',E)).items.length).toBe(2);}

  async function draftScene(page){return page.evaluate(()=>{const head=Object.keys(localStorage).find(k=>k.endsWith(':head:scene:schedule-calendar'));const branch=head&&JSON.parse(localStorage.getItem(head));return branch?JSON.parse(localStorage.getItem(branch)).value.draft:null;});}

  const N='/api/modules/schedule/notifications';

  async function due(page){for(let i=0;i<3;i++)await call('POST',E,entry(`通知任务${i+1}`,{reminder:{side:'before',minutes:0}}));now='2026-09-25T07:31:00Z';await page.clock.setFixedTime(new Date(now));await page.reload();await expect.poll(async()=>(await call('GET',N)).items.length).toBe(3);await page.getByRole('button',{name:'通知',exact:true}).click();return page.locator('.tb-popover-notifications');}

  for(const existing of [false,true])test(`R1 ${existing?'编辑':'创建'}标签保存延迟时继续输入，最后输入不能丢失`,async({page})=>{
     const label=existing?await call('POST',L,{name:'原标签',color:'#63c6ec'}):null;const task=await call('POST',E,entry('课堂准备'));await reloadOpen(page,task);const d=await labelDialog(page,label);let release,hit;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);let held=false;
     await page.route(`**${L}${existing?`/${label.id}`:''}`,async route=>{if(held||route.request().method()==='GET')return route.continue();held=true;const response=await route.fetch();hit();await gate;await route.fulfill({response});});
     await d.getByLabel('标签名称',{exact:true}).fill('第一版名称');await d.getByRole('button',{name:'保存',exact:true}).click();await started;await d.getByLabel('标签名称',{exact:true}).fill('保存期间的最后输入');release();
     await expect.poll(async()=>(await call('GET',L)).items.map(x=>x.name)).toContain('保存期间的最后输入');
    });

  for(const operation of ['创建','编辑'])test(`R2 标签${operation}响应丢失后继续改名并重试，最后输入保留`,async({page})=>{
     const label=operation==='编辑'?await call('POST',L,{name:'原标签',color:'#63c6ec'}):null;const task=await call('POST',E,entry('课堂准备'));await reloadOpen(page,task);const d=await labelDialog(page,label);let first=true;
     await page.route(`**${L}${label?`/${label.id}`:''}`,async route=>{if(route.request().method()==='GET'||!first)return route.continue();first=false;await route.fetch();await route.abort('failed');});
     await d.getByLabel('标签名称',{exact:true}).fill('第一次名称');await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d.getByRole('button',{name:'重试确认',exact:true})).toBeVisible();await d.getByLabel('标签名称',{exact:true}).fill('重试前的后续名称');await d.getByRole('button',{name:'重试确认',exact:true}).click();
     await expect.poll(async()=>(await call('GET',L)).items.map(x=>x.name)).toContain('重试前的后续名称');
    });

  for(const exit of ['取消','叉号'])test(`R3 创建标签未知结果后${exit}，再次创建时不能把原请求当新输入保存`,async({page})=>{
     const task=await call('POST',E,entry('课堂准备'));await reloadOpen(page,task);let first=true;
     await page.route(`**${L}`,async route=>{if(route.request().method()!=='POST'||!first)return route.continue();first=false;await route.fetch();await route.abort('failed');});
     let d=await labelDialog(page);await d.getByLabel('标签名称',{exact:true}).fill('未知结果的标签');await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d.getByRole('button',{name:'重试确认',exact:true})).toBeVisible();await d.getByRole('button',{name:exit==='取消'?'取消':'关闭',exact:true}).click();
     d=await labelDialog(page);await d.getByLabel('标签名称',{exact:true}).fill('第二个标签');await d.getByRole('button',{name:/保存|重试确认/}).click();await expect.poll(async()=>(await call('GET',L)).items.map(x=>x.name)).toContain('第二个标签');
    });

  for(const field of ['标题','事项','提醒','全天','日期'])test(`R5 设置重复保存中继续修改${field}，后续输入落在所选实例`,async({page})=>{
     const task=await call('POST',E,entry('课堂准备',{items:row()}));await reloadOpen(page,task);let release,hit,first=true;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);
     await page.route(`**${E}/${task.id}`,async route=>{if(route.request().method()!=='PUT'||!first)return route.continue();first=false;const response=await route.fetch();hit();await gate;await route.fulfill({response});});
     await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();await page.getByRole('menuitemradio', { name: '每周', exact: true }).click();await started;
     if(field==='标题')await page.locator('#calendar-entry-title').fill('保存中继续改标题');
     if(field==='事项')await page.getByLabel('事项 1',{exact:true}).fill('保存中继续改事项');
     if(field==='提醒'){await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await d.getByLabel('提醒时机',{exact:true}).selectOption('start-after');await d.getByLabel('分钟数',{exact:true}).fill('1');await d.getByRole('button',{name:'完成',exact:true}).click();}
     if(field==='全天'){await page.locator('.tbx-sheet').getByRole('switch',{name:'全天',exact:true}).click();}
     if(field==='日期')await setScheduleField(page, '开始日期', '2026-09-26');release();
     await expect.poll(async()=>Boolean((await draftScene(page))?.baseline.repeat)).toBe(true);
     if(field==='标题')await expect(page.locator('#calendar-entry-title')).toHaveValue('保存中继续改标题');
     if(field==='事项')await expect(page.getByLabel('事项 1',{exact:true})).toHaveValue('保存中继续改事项');
     if(field==='提醒')await expect(page.locator('.tbx-sheet').getByRole('button', { name: /^提醒/ })).toContainText('开始后');
     if(field==='全天')await expect.poll(async()=>(await draftScene(page))?.content.calendar.allDay).toBe(true);
     if(field==='日期')await expectScheduleField(page, '开始日期', '2026-09-26');
     await saveLast(page);
     const entries=(await call('GET',E)).items;const changed=entries.find(x=>x.id!==task.id);expect(changed,JSON.stringify(entries)).toBeTruthy();expect(changed.repeat).toBeNull();
     const expected=field==='标题'?'保存中继续改标题':field==='事项'?'保存中继续改事项':field==='提醒'?{anchor:'start',side:'after',minutes:1}:field==='全天'?true:'2026-09-26';expect(field==='标题'?changed.title:field==='事项'?changed.items[0].text:field==='提醒'?changed.reminder:field==='全天'?changed.calendar.allDay:changed.time.date).toEqual(expected);
    });

  for(const exit of ['取消','叉号','Escape','背景'])test(`N1 标签创建保存中${exit}后换任务，晚到结果不能改写另一个任务`,async({page})=>{
     const label=await call('POST',L,{name:'目标已有标签',color:'#63c6ec'});const source=await call('POST',E,entry('标签创建源',{calendar:{allDay:false,notes:'源任务备注',tags:[]}}));const target=await call('POST',E,entry('标签创建目标',{time:{...entry('').time,startTime:'16:00'},calendar:{allDay:false,notes:'目标任务备注',tags:[label.id]}}));await reloadOpen(page,source);const d=await labelDialog(page);let release,hit;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);let first=true;
     await page.route(`**${L}`,async route=>{if(route.request().method()!=='POST'||!first)return route.continue();first=false;const response=await route.fetch();hit();await gate;await route.fulfill({response});});await d.getByLabel('标签名称',{exact:true}).fill('迟到的创建标签');await d.getByRole('button',{name:'保存',exact:true}).click();await started;
     if(exit==='取消')await d.getByRole('button',{name:'取消',exact:true}).click();if(exit==='叉号')await d.getByRole('button',{name:'关闭',exact:true}).click();if(exit==='Escape')await page.keyboard.press('Escape');if(exit==='背景')await page.locator('.cal-dialog-backdrop').click({position:{x:5,y:5}});await expect(d).toHaveCount(0);await closed(page);await open(page,target.title);const received=page.waitForResponse(r=>r.url().endsWith(L)&&r.request().method()==='POST');release();await (await received).finished();await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveValue('目标任务备注');await expect(page.locator('.tbx-labels').getByRole('button',{name:'目标已有标签',exact:true})).toHaveAttribute('aria-pressed','true');await closed(page);expect((await call('GET',`${E}/${target.id}`)).calendar).toEqual(target.calendar);
    });

  for(const operation of ['移回待安排','删除'])test(`N2 ${operation}结果未知后刷新重试，不重复处理且保留正确状态`,async({page})=>{
     const task=await call('POST',E,entry('未知结果操作',{items:row(),calendar:{allDay:false,notes:'操作之前的备注',tags:[]}}));await reloadOpen(page,task);let first=true;await page.route(`**${E}/${task.id}${operation==='删除'?'/delete':''}`,async route=>{if(!first||route.request().method()==='GET')return route.continue();first=false;await route.fetch();await route.abort('failed');});
     if(operation==='移回待安排'){await page.getByRole('button',{name:'移回待安排',exact:true}).click();await page.getByRole('alertdialog', { name: '移回待安排？',exact:true}).getByRole('button',{name:'移回待安排',exact:true}).click();await page.keyboard.press('ControlOrMeta+s');}else{await action(page,'删除任务');await page.locator('.tbx-sheet-delete').click();}
     await expect(page.getByRole('button',{name:'重试确认',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'重试确认',exact:true}).click();if(operation==='移回待安排'){await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).time).toBeNull();await expect(page.getByRole('button',{name:'放进日历，变成任务',exact:true})).toBeVisible();const saved=await call('GET',`${E}/${task.id}`);expect(saved.calendar.notes).toBe(task.calendar.notes);expect(saved.items).toEqual(task.items);}else{await expect(page.locator('.tbx-sheet')).toHaveCount(0);expect((await call('GET',E)).items).toHaveLength(0);}
    });

  test('N3 标签版本冲突保留本地名称并提供读取新版本的入口',async({page},info)=>{
     const label=await call('POST',L,{name:'两窗口标签',color:'#63c6ec'}),task=await call('POST',E,entry('标签冲突'));await reloadOpen(page,task);const d=await labelDialog(page,label);await d.getByLabel('标签名称',{exact:true}).fill('本地希望保存的名称');await call('PUT',`${L}/${label.id}`,{name:'另一窗口已保存的名称',color:'#63c6ec',expectedVersion:label.version,deleted:false});await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d.getByRole('alert')).toBeVisible();await expect(d.getByLabel('标签名称',{exact:true})).toHaveValue('本地希望保存的名称');const second=page.waitForResponse(r=>r.url().endsWith(`${L}/${label.id}`)&&r.request().method()==='PUT');await d.getByRole('button',{name:'保存',exact:true}).click();expect((await second).status()).toBe(409);fs.writeFileSync(info.outputPath('label-conflict-observed.json'),JSON.stringify({retryStatus:409,localName:await d.getByLabel('标签名称',{exact:true}).inputValue(),serverLabel:(await call('GET',L)).items.find(x=>x.id===label.id)},null,2));await expect(d.getByRole('button',{name:/读取.*版本|读取.*标签|核对/})).toBeVisible();
     await d.getByRole('button',{name:'读取最新版本',exact:true}).click();await expect(d).toContainText('另一窗口已保存的名称');await expect(d.getByLabel('标签名称',{exact:true})).toHaveValue('本地希望保存的名称');await page.screenshot({path:info.outputPath('label-conflict-recovery.png')});await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d).toHaveCount(0);expect((await call('GET',L)).items.find(x=>x.id===label.id).name).toBe('本地希望保存的名称');await page.reload();await expect(page.locator('.tbx-labels').getByRole('button',{name:'本地希望保存的名称',exact:true})).toBeVisible();
    });

  for(const state of ['普通任务','待安排','新建有标题','新建无标题'])test(`N6 从通知打开任务，正确处理此前${state}的编辑内容`,async({page})=>{
     let task;if(state==='普通任务'||state==='待安排')task=await call('POST',E,entry('通知前的任务',{...(state==='待安排'?{time:null}:{time:{...entry('').time,startTime:'16:00'}})}));const panel=await due(page);await page.locator('.tb-topbar').click({position:{x:350,y:20}});await expect(panel).toHaveCount(0);if(task)await open(page,task.title);else{await page.getByRole('button',{name:'新建任务',exact:true}).click();if(state==='新建有标题')await page.locator('#calendar-entry-title').fill('通知前新任务');}await page.getByRole('textbox',{name:'备注',exact:true}).fill('通知前尚未离开的输入');await page.getByRole('button',{name:'通知',exact:true}).click();await panel.locator('.tb-notification').filter({hasText:'通知任务1'}).click();await expect(panel).toHaveCount(0);await expect(page.locator('#calendar-entry-title')).toHaveValue('通知任务1');const entries=(await call('GET',E)).items;
     if(task)await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.notes).toBe('通知前尚未离开的输入');else if(state==='新建有标题'){await expect.poll(async()=>(await call('GET',E)).items.filter(x=>x.title==='通知前新任务').map(x=>x.calendar.notes)).toEqual(['通知前尚未离开的输入']);}else expect(entries).toHaveLength(3);
    });
});


test.describe('保存回执与任务切换', () => {
  test.use({ timezoneId: 'Asia/Shanghai', viewport: { width: 1440, height: 900 }, actionTimeout: 10000 });
  const E = '/api/modules/schedule/entries';
  let world, client, errors;
  const input = title => ({ title, items: [], time: { date: '2026-09-23', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' }, repeat: null, reminder: null });
  async function call(method, url, body) {
    const response = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
    expect(response.status, JSON.stringify(response.json)).toBeLessThan(300);
    return response.json;
  }
  async function open(page, value) {
    await page.goto(`${world.origin}/calendar?entry=${value.id}`);
    await expect(page.getByLabel('标题', { exact: true })).toHaveValue(value.title);
  }
  async function listed(page, title) {
    await page.locator('.fc-timegrid-event').filter({ hasText: title }).click();
  }
  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const clock = () => new Date('2026-09-23T06:00:00Z');
    await page.clock.setFixedTime(clock());
    ({ world, client } = await createScheduleWorld(clock, 'manual-teaching@example.test'));
    await loginSchedule(page, world, 'manual-teaching@example.test');
  });
  test.afterEach(async ({ context }, info) => closeScheduleWorld(context, world, errors, info));

  test('日程保存慢响应不会串写后来打开的安排', async ({ page }) => {
    const first = await call('POST', E, input('先保存的安排'));
    const second = await call('POST', E, { ...input('后打开的安排'), time: { ...input('').time, startTime: '18:00' } });
    await open(page, first);
    let release, committed;
    const gate = new Promise(resolve => { release = resolve; });
    const done = new Promise(resolve => { committed = resolve; });
    let held = false;
    await page.route(`**${E}/${first.id}`, async route => {
      if (route.request().method() !== 'PUT' || held) return route.continue();
      held = true;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committed(); await gate; await route.fulfill({ response });
    });
    await page.getByLabel('标题', { exact: true }).fill('先保存的安排已修改');
    await done;
    try {
      await listed(page, second.title);
      const delivered = page.waitForResponse(response => response.url().endsWith(`${E}/${first.id}`) && response.request().method() === 'PUT');
      release(); await delivered;
      await expect(page.getByLabel('标题', { exact: true })).toHaveValue(second.title);
      await page.getByLabel('标题', { exact: true }).fill('后打开的安排已修改');
      await expect.poll(async () => (await call('GET', `${E}/${second.id}`)).title).toBe('后打开的安排已修改');
      expect((await call('GET', `${E}/${first.id}`)).title).toBe('先保存的安排已修改');
      await page.reload();
      await expect(page.getByLabel('标题', { exact: true })).toHaveValue('后打开的安排已修改');
    } finally { release(); }
  });

  test('新建保存慢响应后切换安排，后写草稿跟随真实ID恢复', async ({ page }) => {
    const other = await call('POST', E, { ...input('另一安排'), time: { ...input('').time, startTime: '18:00' } });
    await open(page, other);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
    let release, committed, created;
    const gate = new Promise(resolve => { release = resolve; });
    const done = new Promise(resolve => { committed = resolve; });
    let held = false;
    await page.route(`**${E}`, async route => {
      if (route.request().method() !== 'POST' || held) return route.continue();
      held = true;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      created = await response.json();
      committed(); await gate; await route.fulfill({ response });
    });
    await page.getByLabel('标题', { exact: true }).fill('临时安排已提交');
    await done;
    try {
      await page.getByLabel('标题', { exact: true }).fill('提交期间后写标题');
      await listed(page, other.title);
      const delivered = page.waitForResponse(response => response.url().endsWith(E) && response.request().method() === 'POST');
      release(); await delivered;
      await expect(page.getByLabel('标题', { exact: true })).toHaveValue(other.title);
      await expect.poll(async () => (await call('GET', `${E}/${created.id}`)).title).toBe('提交期间后写标题');
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await page.getByRole('region', { name: '待安排', exact: true }).getByRole('button', { name: '提交期间后写标题', exact: true }).click();
      await expect(page.getByLabel('标题', { exact: true })).toHaveValue('提交期间后写标题');
      await page.reload();
      await expect(page.getByLabel('标题', { exact: true })).toHaveValue('提交期间后写标题');
      const pending = (await call('GET', E + '?placement=unscheduled')).items;
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(created.id);
      expect((await call('GET', `${E}/${other.id}`)).title).toBe(other.title);
    } finally { release(); }
  });
});
