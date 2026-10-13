import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
let world, client, now, errors, cdp;
const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });
async function call(method, url, body) {
  const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
}
async function open(page, title) { await page.locator('.cal-upcoming-row').filter({ hasText: title }).click(); }
test.beforeEach(async ({ page,context }) => {
  cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Shanghai'});
  now = '2026-09-25T06:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  errors = []; page.on('pageerror', e => errors.push(e.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-graph-')), workbenchClock: () => new Date(now) });
  ({ client } = await registerMath(world, 'schedule-graph@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-graph@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.cal-page')).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(page.locator('.cal-time-zone')).toHaveAttribute('title','Asia/Shanghai');
});
test.afterEach(async ({ context }, info) => {
  const failed = info.status !== info.expectedStatus || errors.length;
  if (failed) {
    const data = { test: info.title, directory: world.directory, origin: world.origin, time: now, pageErrors: errors, entries: (await call('GET', E)).items,labels:(await call('GET',L)).items,settings:await call('GET','/api/modules/schedule/settings') };
    fs.writeFileSync(info.outputPath('preserved-case.json'), JSON.stringify(data, null, 2));
    await context.pages()[0]?.screenshot({path:info.outputPath('preserved-scene.png'),animations:'disabled'}).catch(()=>{});
    const scene=await context.pages()[0]?.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
    fs.writeFileSync(info.outputPath('local-scene.json'),JSON.stringify(scene,null,2));
  }
  await context.close(); await world.close();
  if (!failed) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(errors).toEqual([]);
});


async function action(page, name) { await page.getByRole('button',{name:'任务操作',exact:true}).click(); await page.getByRole('menuitem',{name,exact:true}).click(); }
async function closed(page) { await page.getByRole('button',{name:'关闭任务',exact:true}).click(); await expect(page.locator('.cal-editor')).toHaveCount(0); }
const items=()=>['准备讲义','整理反馈','打印清单'].map(text=>({id:randomUUID(),text,priority:'normal'}));

async function reloadOpen(page,task){await page.reload();await open(page,task.title);}
const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];
async function labelDialog(page,label){await page.getByRole('button',{name:'标签',exact:true}).click();
 if(label)await page.getByRole('button',{name:`编辑标签 ${label.name}`,exact:true}).click();else await page.getByRole('menuitem',{name:'+ 创建标签',exact:true}).click();
 return page.getByRole('dialog',{name:label?'编辑标签':'创建标签',exact:true});}
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

for(const scope of ['待安排','普通任务','重复任务'])test(`R4 移动事项保存中切换时区，${scope}目标不会锁死日程`,async({page},info)=>{
 const source=await call('POST',E,entry('源任务',{items:row()}));const target=await call('POST',E,entry('目标任务',{...(scope==='待安排'?{time:null}:{}),...(scope==='重复任务'?{repeat:{until:'2026-10-09'}}:{})}));await reloadOpen(page,source);
 let release,hit;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);await page.route('**/api/modules/schedule/item-moves',async route=>{const response=await route.fetch();hit();await gate;await route.fulfill({response});});
 await page.getByRole('button',{name:'事项 1 操作',exact:true}).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();const d=page.getByRole('dialog',{name:'移动事项',exact:true});await d.getByLabel('移到',{exact:true}).selectOption(target.id);if(scope==='重复任务')await d.getByRole('radio',{name:'每次重复都需要',exact:true}).check();await d.getByRole('button',{name:'移动事项',exact:true}).click();await started;
 await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));release();
 try { await expect(page.locator('.cal-time-zone')).toHaveAttribute('title','America/New_York'); } finally {const observed=await page.evaluate(()=>({nativeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,shownZone:document.querySelector('.cal-time-zone')?.title,editorText:document.querySelector('.cal-editor')?.innerText,dialogText:document.querySelector('.cal-dialog')?.innerText}));if(observed.shownZone!==observed.nativeZone){await page.getByRole('button',{name:'关闭任务',exact:true}).click({timeout:2000}).catch(()=>{});try{await expect(page.locator('.cal-editor')).toHaveCount(0,{timeout:2000});observed.closeWorked=true;}catch{observed.closeWorked=false;}}fs.writeFileSync(info.outputPath('move-zone-observed.json'),JSON.stringify(observed,null,2));}await expect(d).toHaveCount(0);await expect(page.getByText('正在移动事项',{exact:true})).toHaveCount(0);
 expect((await call('GET',`${E}/${source.id}`)).items).toHaveLength(0);expect((await call('GET',`${E}/${target.id}`)).items).toHaveLength(1);
});

for(const field of ['标题','事项','提醒','全天','日期'])test(`R5 设置重复保存中继续修改${field}，后续输入落在所选实例`,async({page})=>{
 const task=await call('POST',E,entry('课堂准备',{items:row()}));await reloadOpen(page,task);let release,hit,first=true;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);
 await page.route(`**${E}/${task.id}`,async route=>{if(route.request().method()!=='PUT'||!first)return route.continue();first=false;const response=await route.fetch();hit();await gate;await route.fulfill({response});});
 await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name:'每周',exact:true}).click();await started;
 if(field==='标题')await page.locator('[name=entry-title]').fill('保存中继续改标题');
 if(field==='事项')await page.getByLabel('事项 1',{exact:true}).fill('保存中继续改事项');
 if(field==='提醒'){await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await d.getByLabel('提醒时机',{exact:true}).selectOption('start-after');await d.getByLabel('分钟数',{exact:true}).fill('1');await d.getByRole('button',{name:'完成',exact:true}).click();}
 if(field==='全天'){await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'全天',exact:true}).click();}
 if(field==='日期')await page.locator('[name=entry-date]').fill('2026-09-26');release();
 await expect.poll(async()=>Boolean((await draftScene(page))?.baseline.repeat)).toBe(true);
 if(field==='标题')await expect(page.locator('[name=entry-title]')).toHaveValue('保存中继续改标题');
 if(field==='事项')await expect(page.getByLabel('事项 1',{exact:true})).toHaveValue('保存中继续改事项');
 if(field==='提醒')await expect(page.locator('.cal-reminder-summary')).toContainText('开始后');
 if(field==='全天')await expect.poll(async()=>(await draftScene(page))?.content.calendar.allDay).toBe(true);
 if(field==='日期')await expect(page.locator('[name=entry-date]')).toHaveValue('2026-09-26');
 await saveLast(page);
 const entries=(await call('GET',E)).items;const changed=entries.find(x=>x.id!==task.id);expect(changed,JSON.stringify(entries)).toBeTruthy();expect(changed.repeat).toBeNull();
 const expected=field==='标题'?'保存中继续改标题':field==='事项'?'保存中继续改事项':field==='提醒'?{anchor:'start',side:'after',minutes:1}:field==='全天'?true:'2026-09-26';expect(field==='标题'?changed.title:field==='事项'?changed.items[0].text:field==='提醒'?changed.reminder:field==='全天'?changed.calendar.allDay:changed.time.date).toEqual(expected);
});
async function saveLast(page){await page.keyboard.press('ControlOrMeta+s');await expect.poll(async()=>(await call('GET',E)).items.length).toBe(2);}
async function draftScene(page){return page.evaluate(()=>{const head=Object.keys(localStorage).find(k=>k.endsWith(':head:scene:schedule-calendar'));const branch=head&&JSON.parse(localStorage.getItem(head));return branch?JSON.parse(localStorage.getItem(branch)).value.draft:null;});}

for(const value of ['', '0','-1','1.5','1000'])test(`R6 重复间隔${value||'空'}不可保存且取消可用`,async({page})=>{
 const task=await call('POST',E,entry('课堂准备'));await reloadOpen(page,task);await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});await d.getByLabel('重复间隔',{exact:true}).fill(value);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);
});
for(const value of ['', '-1','0.5','10081'])test(`R7 提醒分钟${value||'空'}不可保存且取消可用`,async({page})=>{
 const task=await call('POST',E,entry('课堂准备'));await reloadOpen(page,task);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await d.getByLabel('分钟数',{exact:true}).fill(value);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);
});

async function dayView(page){await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:/^日\s/}).click();}
for(const selected of [false,true])test(`T1 网格任务拖动中按Escape只取消拖动，任务${selected?'已选中':'未选中'}不改期`,async({page})=>{
 const task=await call('POST',E,entry('取消任务拖动'));await page.reload();if(selected)await open(page,task.title);await dayView(page);const card=page.locator('.fc-timegrid-event:not(.fc-event-mirror)').filter({hasText:task.title});await card.scrollIntoViewIfNeeded();const b=await card.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2+104,{steps:16});await expect(page.locator('.fc-event-mirror')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(900);expect((await call('GET',`${E}/${task.id}`)).time).toEqual(task.time);if(selected)await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);
});

test('T2 时间网格拖选中按Escape，松手后不重新弹出新建任务',async({page})=>{
 await dayView(page);const slot=page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');await slot.scrollIntoViewIfNeeded();const r=await slot.boundingBox();await page.mouse.move(r.x+120,r.y+2);await page.mouse.down();await page.mouse.move(r.x+120,r.y+r.height*4-2,{steps:15});await expect(page.locator('.cal-selection-time')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.cal-editor')).toHaveCount(0);await expect(page.locator('.cal-selection-time')).toHaveCount(0);
});

test('T3 编辑任务时取消小月历拖选，仅取消日期手势而保留任务编辑器',async({page})=>{
 const task=await call('POST',E,entry('小月历取消范围'));await reloadOpen(page,task);const a=await page.locator('.cal-mini [data-date="2026-09-25"]').boundingBox(),b=await page.locator('.cal-mini [data-date="2026-09-28"]').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);
});

test('T4 调整结束边缘时按Escape，松手不会提交新的时长',async({page})=>{
 const task=await call('POST',E,entry('取消拉伸'));await reloadOpen(page,task);await dayView(page);const card=page.locator('.fc-timegrid-event:not(.fc-event-mirror)').filter({hasText:task.title});await card.scrollIntoViewIfNeeded();await card.hover();const h=await card.locator('.fc-event-resizer-end').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2,h.y+h.height/2+52,{steps:12});await expect(page.locator('.fc-event-mirror')).toBeVisible();await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(900);expect((await call('GET',`${E}/${task.id}`)).time).toEqual(task.time);
});

const N='/api/modules/schedule/notifications';
async function due(page){for(let i=0;i<3;i++)await call('POST',E,entry(`通知任务${i+1}`,{reminder:{side:'before',minutes:0}}));now='2026-09-25T07:31:00Z';await page.clock.setFixedTime(new Date(now));await page.reload();await expect.poll(async()=>(await call('GET',N)).items.length).toBe(3);await page.getByRole('button',{name:'通知',exact:true}).click();return page.locator('.tb-popover-notifications');}

test('T5 通知全部已读、切回未读及拖到垃圾桶只删除那一条',async({page})=>{
 const panel=await due(page);await panel.getByRole('button',{name:'全部已读',exact:true}).click();await expect.poll(async()=>(await call('GET',N)).unreadCount).toBe(0);const first=panel.locator('.tb-notification').first();await expect(first).toHaveClass(/is-read/);await first.click();await expect.poll(async()=>(await call('GET',N)).unreadCount).toBe(1);await panel.getByRole('button',{name:'全部已读',exact:true}).click();await expect.poll(async()=>(await call('GET',N)).unreadCount).toBe(0);await expect(first).toHaveClass(/is-read/);await first.dragTo(panel.locator('.tb-notification-trash'));await expect.poll(async()=>(await call('GET',N)).items.length).toBe(2);expect((await call('GET',E)).items).toHaveLength(3);
});

for (const [width,theme] of [[1675,'浅色'],[1675,'深色'],[390,'浅色'],[390,'深色']]) test(`T6 全部已读响应丢失后关闭再打开面板，可确认原请求且不重复通知${width===1675&&theme==='浅色'?'':`，${width}${theme}`}`,async({page},info)=>{
 if(theme==='深色'){await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:theme,exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();}await page.setViewportSize({width,height:950});
 const panel=await due(page);let first=true;await page.route('**/api/modules/schedule/notification-actions',async route=>{if(!first)return route.continue();first=false;await route.fetch();await route.abort('failed');});await panel.getByRole('button',{name:'全部已读',exact:true}).click();await expect(page.locator('.tb-notification-problem')).toBeVisible();await page.locator('.tb-topbar').click({position:{x:350,y:20}});await expect(panel).toHaveCount(0);await page.getByRole('button',{name:'通知',exact:true}).click();
 await expect(panel).toHaveCSS('opacity','1');const frame=await panel.boundingBox(),problem=await page.locator('.tb-notification-problem').boundingBox();expect(problem.x).toBeGreaterThanOrEqual(frame.x);expect(problem.y).toBeGreaterThanOrEqual(frame.y);expect(problem.x+problem.width).toBeLessThanOrEqual(frame.x+frame.width);expect(problem.y+problem.height).toBeLessThanOrEqual(frame.y+frame.height);await page.screenshot({path:info.outputPath('notification-retry.png')});
 await page.locator('.tb-notification-problem').getByRole('button',{name:'重试',exact:true}).click();await expect(page.locator('.tb-notification-problem')).toHaveCount(0);expect((await call('GET',N)).unreadCount).toBe(0);expect((await call('GET',N)).items).toHaveLength(3);
});


for(const exit of ['取消','叉号','Escape','背景'])test(`N1 标签创建保存中${exit}后换任务，晚到结果不能改写另一个任务`,async({page})=>{
 const label=await call('POST',L,{name:'目标已有标签',color:'#63c6ec'});const source=await call('POST',E,entry('标签创建源',{calendar:{allDay:false,notes:'源任务备注',tags:[]}}));const target=await call('POST',E,entry('标签创建目标',{time:{...entry('').time,startTime:'16:00'},calendar:{allDay:false,notes:'目标任务备注',tags:[label.id]}}));await reloadOpen(page,source);const d=await labelDialog(page);let release,hit;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);let first=true;
 await page.route(`**${L}`,async route=>{if(route.request().method()!=='POST'||!first)return route.continue();first=false;const response=await route.fetch();hit();await gate;await route.fulfill({response});});await d.getByLabel('标签名称',{exact:true}).fill('迟到的创建标签');await d.getByRole('button',{name:'保存',exact:true}).click();await started;
 if(exit==='取消')await d.getByRole('button',{name:'取消',exact:true}).click();if(exit==='叉号')await d.getByRole('button',{name:'关闭',exact:true}).click();if(exit==='Escape')await page.keyboard.press('Escape');if(exit==='背景')await page.locator('.cal-dialog-backdrop').click({position:{x:5,y:5}});await expect(d).toHaveCount(0);await closed(page);await open(page,target.title);const received=page.waitForResponse(r=>r.url().endsWith(L)&&r.request().method()==='POST');release();await (await received).finished();await page.getByRole('button',{name:'标签',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText('目标任务备注');await expect(page.getByRole('button',{name:'标签',exact:true})).toContainText('目标已有标签');await closed(page);expect((await call('GET',`${E}/${target.id}`)).calendar).toEqual(target.calendar);
});

for(const operation of ['移回待安排','删除'])test(`N2 ${operation}结果未知后刷新重试，不重复处理且保留正确状态`,async({page})=>{
 const task=await call('POST',E,entry('未知结果操作',{items:row(),calendar:{allDay:false,notes:'操作之前的备注',tags:[]}}));await reloadOpen(page,task);let first=true;await page.route(`**${E}/${task.id}${operation==='删除'?'/delete':''}`,async route=>{if(!first||route.request().method()==='GET')return route.continue();first=false;await route.fetch();await route.abort('failed');});
 if(operation==='移回待安排'){await page.getByRole('button',{name:'移回待安排',exact:true}).click();await page.getByRole('dialog',{name:'移回待安排',exact:true}).getByRole('button',{name:'移回待安排',exact:true}).click();await page.keyboard.press('ControlOrMeta+s');}else{await action(page,'删除任务');await page.getByRole('dialog',{name:'删除任务',exact:true}).getByRole('button',{name:'删除',exact:true}).click();}
 await expect(page.getByRole('button',{name:'重试确认',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'重试确认',exact:true}).click();if(operation==='移回待安排'){await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).time).toBeNull();await expect(page.getByRole('button',{name:'安排时间',exact:true})).toBeVisible();const saved=await call('GET',`${E}/${task.id}`);expect(saved.calendar.notes).toBe(task.calendar.notes);expect(saved.items).toEqual(task.items);}else{await expect(page.locator('.cal-editor')).toHaveCount(0);expect((await call('GET',E)).items).toHaveLength(0);}
});


test('N3 标签版本冲突保留本地名称并提供读取新版本的入口',async({page},info)=>{
 const label=await call('POST',L,{name:'两窗口标签',color:'#63c6ec'}),task=await call('POST',E,entry('标签冲突'));await reloadOpen(page,task);const d=await labelDialog(page,label);await d.getByLabel('标签名称',{exact:true}).fill('本地希望保存的名称');await call('PUT',`${L}/${label.id}`,{name:'另一窗口已保存的名称',color:'#63c6ec',expectedVersion:label.version,deleted:false});await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d.getByRole('alert')).toBeVisible();await expect(d.getByLabel('标签名称',{exact:true})).toHaveValue('本地希望保存的名称');const second=page.waitForResponse(r=>r.url().endsWith(`${L}/${label.id}`)&&r.request().method()==='PUT');await d.getByRole('button',{name:'保存',exact:true}).click();expect((await second).status()).toBe(409);fs.writeFileSync(info.outputPath('label-conflict-observed.json'),JSON.stringify({retryStatus:409,localName:await d.getByLabel('标签名称',{exact:true}).inputValue(),serverLabel:(await call('GET',L)).items.find(x=>x.id===label.id)},null,2));await expect(d.getByRole('button',{name:/读取.*版本|读取.*标签|核对/})).toBeVisible();
 await d.getByRole('button',{name:'读取最新版本',exact:true}).click();await expect(d).toContainText('另一窗口已保存的名称');await expect(d.getByLabel('标签名称',{exact:true})).toHaveValue('本地希望保存的名称');await page.screenshot({path:info.outputPath('label-conflict-recovery.png')});await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d).toHaveCount(0);expect((await call('GET',L)).items.find(x=>x.id===label.id).name).toBe('本地希望保存的名称');await page.reload();await page.getByRole('button',{name:'标签',exact:true}).click();await expect(page.getByRole('menuitemcheckbox',{name:'本地希望保存的名称',exact:true})).toBeVisible();
});

test('N4 目标已有200条事项时不会用泛化错误代替容量说明',async({page})=>{
 const source=await call('POST',E,entry('需要移动的事项',{items:row()}));const target=await call('POST',E,entry('已经填满的待安排',{time:null,items:Array.from({length:200},(_,i)=>({id:randomUUID(),text:`第${i+1}项`,priority:'normal'}))}));await reloadOpen(page,source);await page.getByRole('button',{name:'事项 1 操作',exact:true}).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();const d=page.getByRole('dialog',{name:'移动事项',exact:true});await d.getByLabel('移到',{exact:true}).selectOption(target.id);const move=d.getByRole('button',{name:'移动事项',exact:true});if(await move.isDisabled()){await expect(d).toContainText(/200|已满|上限/);return;}await move.click();await expect(d.getByRole('alert')).toContainText(/200|已满|上限/);expect((await call('GET',`${E}/${source.id}`)).items).toHaveLength(1);expect((await call('GET',`${E}/${target.id}`)).items).toHaveLength(200);
});


test('N5 编辑任务时按Escape关闭通知，只关闭通知而保留任务编辑现场',async({page})=>{
 const task=await call('POST',E,entry('通知关闭时保留编辑',{time:{...entry('').time,startTime:'16:00'}}));const panel=await due(page);await page.locator('.tb-topbar').click({position:{x:350,y:20}});await expect(panel).toHaveCount(0);await open(page,task.title);await page.getByRole('textbox',{name:'备注',exact:true}).fill('尚在编辑的备注');await page.getByRole('button',{name:'通知',exact:true}).click();await expect(panel).toBeVisible();await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText('尚在编辑的备注');
});


for(const [zone,offset,clock] of [['UTC','UTC+00:00','6:00'],['Asia/Kathmandu','UTC+05:45','11:45'],['Australia/Lord_Howe','UTC+10:30','16:30'],['Pacific/Apia','UTC+13:00','19:00']])test(`Z1 系统切换${zone}，偏移与当前红线一致而任务钟点不变`,async({page})=>{
 const task=await call('POST',E,entry('特殊偏移任务',{time:{...entry('').time,startTime:'23:00'}}));await reloadOpen(page,task);await cdp.send('Emulation.setTimezoneOverride',{timezoneId:zone});const canonical=await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.cal-time-zone')).toHaveAttribute('title',canonical);await expect(page.locator('.cal-time-zone')).toContainText(offset);await dayView(page);const saved=await call('GET',`${E}/${task.id}`);expect(saved.time).toEqual({...task.time,timeZone:canonical});await expect(page.locator('[name=entry-start]')).toHaveValue('23:00');await expect(page.locator('.cal-now-time')).toHaveText(clock.padStart(5,'0'));
});

for(const [zone,date,start,actual,end,instant]of [['America/New_York','2026-03-08','02:30','03:30','04:00','2026-03-08T07:30:00.000Z'],['Australia/Lord_Howe','2026-10-04','02:15','02:45','03:15','2026-10-03T15:45:00.000Z']])test(`Z2 ${zone}夏令时缺失钟点保留输入、显示实际时间并按实际开始提醒`,async({page})=>{
 now=date==='2026-03-08'?'2026-03-08T05:00:00Z':'2026-10-03T14:00:00Z';await page.clock.setFixedTime(new Date(now));await cdp.send('Emulation.setTimezoneOverride',{timezoneId:zone});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.cal-time-zone')).toHaveAttribute('title',zone);const task=await call('POST',E,entry('夏令时缺失时刻',{time:{date,startTime:start,durationMinutes:30,timeZone:zone},reminder:{anchor:'start',side:'before',minutes:0}}));await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expect(page.locator('[name=entry-start]')).toHaveValue(start);await expect(page.locator('[name=entry-end]')).toHaveValue(end);await expect(page.getByText(/夏令时跳时/)).toContainText(actual);now=instant;await page.clock.setFixedTime(new Date(now));const notices=(await call('GET',N)).items;expect(notices).toHaveLength(1);expect(Date.parse(notices[0].dueAt)).toBe(Date.parse(instant));expect((await call('GET',`${E}/${task.id}`)).time.startTime).toBe(start);
});


for(const state of ['普通任务','待安排','新建有标题','新建无标题'])test(`N6 从通知打开任务，正确处理此前${state}的编辑内容`,async({page})=>{
 let task;if(state==='普通任务'||state==='待安排')task=await call('POST',E,entry('通知前的任务',{...(state==='待安排'?{time:null}:{time:{...entry('').time,startTime:'16:00'}})}));const panel=await due(page);await page.locator('.tb-topbar').click({position:{x:350,y:20}});await expect(panel).toHaveCount(0);if(task)await open(page,task.title);else{await page.getByRole('button',{name:'新建任务',exact:true}).click();if(state==='新建有标题')await page.locator('[name=entry-title]').fill('通知前新任务');}await page.getByRole('textbox',{name:'备注',exact:true}).fill('通知前尚未离开的输入');await page.getByRole('button',{name:'通知',exact:true}).click();await panel.locator('.tb-notification').filter({hasText:'通知任务1'}).click();await expect(panel).toHaveCount(0);await expect(page.locator('[name=entry-title]')).toHaveValue('通知任务1');const entries=(await call('GET',E)).items;
 if(task)await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.notes).toBe('通知前尚未离开的输入');else if(state==='新建有标题'){await expect.poll(async()=>(await call('GET',E)).items.filter(x=>x.title==='通知前新任务').map(x=>x.calendar.notes)).toEqual(['通知前尚未离开的输入']);}else expect(entries).toHaveLength(3);
});


test('Z3 事项移动期间由实际定时器检测时区变化，不依赖合成焦点事件且不会锁死',async({page},info)=>{
 const source=await call('POST',E,entry('定时检测的移动源',{items:row()}));const target=await call('POST',E,entry('定时检测的移动目标',{time:null}));await reloadOpen(page,source);let release,hit;const gate=new Promise(r=>release=r),started=new Promise(r=>hit=r);await page.route('**/api/modules/schedule/item-moves',async route=>{const response=await route.fetch();hit();await gate;await route.fulfill({response});});await page.getByRole('button',{name:'事项 1 操作',exact:true}).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();const d=page.getByRole('dialog',{name:'移动事项',exact:true});await d.getByLabel('移到',{exact:true}).selectOption(target.id);await d.getByRole('button',{name:'移动事项',exact:true}).click();await started;await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/New_York'});
 // This duration deliberately crosses the product's real 15-second detector.
 // Date is fixed; timers remain real. No synthetic focus/visibility event.
 await page.waitForTimeout(16000);release();try{await expect(page.locator('.cal-time-zone')).toHaveAttribute('title','America/New_York');}finally{const observed=await page.evaluate(()=>({nativeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,shownZone:document.querySelector('.cal-time-zone')?.title}));observed.detection='real 15-second timer';await page.getByRole('button',{name:'关闭任务',exact:true}).click({timeout:2000}).catch(()=>{});try{await expect(page.locator('.cal-editor')).toHaveCount(0,{timeout:2000});observed.closeWorked=true;}catch{observed.closeWorked=false;}fs.writeFileSync(info.outputPath('move-zone-observed.json'),JSON.stringify(observed,null,2));}
});
