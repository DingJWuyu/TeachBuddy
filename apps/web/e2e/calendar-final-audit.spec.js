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
  repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });
async function call(method, url, body) {
  const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
}
async function open(page, title) { await page.locator('.cal-upcoming-row').filter({ hasText: title }).click(); }
test.beforeEach(async ({ page }) => {
  now = '2026-09-25T06:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  errors = []; page.on('pageerror', e => errors.push(e.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-audit-')), workbenchClock: () => new Date(now) });
  ({ client } = await registerMath(world, 'schedule-audit@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-audit@example.test');
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

for(const field of ['标题','开始时间']) test(`清空已有任务${field}后可直接取消，不被校验困住`,async({page})=>{
 const task=await call('POST',E,entry(`清空${field}后取消`));await page.reload();await open(page,task.title);
 await page.getByRole('textbox',{name:'备注',exact:true}).fill('关闭时保留有效备注');
 await page.locator(field==='标题'?'[name=entry-title]':'[name=entry-start]').fill('');
 await closed(page);
 const saved=await call('GET',`${E}/${task.id}`);expect(saved.title).toBe(task.title);expect(saved.time).toEqual(task.time);expect(saved.calendar.notes).toBe('关闭时保留有效备注');
});

test('事项拖动中按Escape只取消手势，保留编辑器与原顺序',async({page})=>{
 const task=await call('POST',E,entry('取消事项拖动',{items:items()}));await page.reload();await open(page,task.title);
 await expect(page.locator('.cal-sidebar')).toHaveCSS('opacity','1');
 await expect(page.locator('.cal-item-bullet').first()).toBeVisible();
 await page.locator('.cal-item-row').last().scrollIntoViewIfNeeded();
 await page.locator('.cal-item-bullet').first().scrollIntoViewIfNeeded();
 const a=await page.locator('.cal-item-bullet').first().boundingBox(),b=await page.locator('.cal-item-row').last().boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+10,b.y+b.height-2,{steps:15});
 await expect(page.locator('.cal-item-row.is-dragging')).toHaveCount(1);
 await page.keyboard.press('Escape');await page.mouse.up();
 await expect(page.locator('.cal-editor')).toHaveCount(1);
 expect((await call('GET',`${E}/${task.id}`)).items.map(x=>x.text)).toEqual(task.items.map(x=>x.text));
});

test('删除当前任务后，先前未完成的另一任务读取不会重新打开编辑器',async({page})=>{
 const a=await call('POST',E,entry('删除中的任务')),b=await call('POST',E,entry('迟到读取任务',{time:{...entry('').time,startTime:'16:00'}}));
 await page.reload();await open(page,a.title);
 let release,hit;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{hit=r;});
 await page.route(`**${E}/${b.id}`,async route=>{if(route.request().method()!=='GET')return route.continue();hit();await gate;await route.continue();});
 const card=page.locator('.fc-timegrid-event').filter({hasText:b.title}).first();await card.scrollIntoViewIfNeeded();await card.click();await started;
 await action(page,'删除任务');await page.getByRole('dialog',{name:'删除任务',exact:true}).getByRole('button',{name:'删除',exact:true}).click();
 await expect(page.locator('.cal-editor')).toHaveCount(0);
 const response=page.waitForResponse(r=>r.url().endsWith(`${E}/${b.id}`));release();await(await response).finished();await page.waitForTimeout(250);
 await expect(page.locator('.cal-editor')).toHaveCount(0);
});

test('完成状态在保存延迟期间快速切换，最后一次操作保留',async({page})=>{
 const task=await call('POST',E,entry('完成状态延迟保存',{items:items()}));await page.reload();await open(page,task.title);
 let release,hit,intercept=true;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{hit=r;});
 await page.route(`**${E}/${task.id}`,async route=>{if(route.request().method()!=='PUT'||!intercept)return route.continue();intercept=false;hit();await gate;await route.continue();});
 await page.locator('.cal-item-bullet').first().click();await started;await page.locator('.cal-item-bullet').first().click();release();
 await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).items[0].completed).toBe(false);
 await closed(page);await page.reload();await open(page,task.title);await expect(page.locator('.cal-item-bullet').first()).toHaveAttribute('aria-pressed','false');
});

test('已完成事项移入待安排后保留完成状态，并可撤销完成',async({page})=>{
 const task=await call('POST',E,entry('带完成状态的源任务',{items:[{...items()[0],completed:true}]}));const target=await call('POST',E,entry('完成事项移入的待安排',{time:null}));
 await page.reload();await open(page,task.title);await page.getByRole('button',{name:'事项 1 操作',exact:true}).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'移动事项',exact:true});await dialog.getByRole('combobox',{name:'移到',exact:true}).selectOption(target.id);await dialog.getByRole('button',{name:'移动事项',exact:true}).click();
 await expect(page.locator('[name=entry-title]')).toHaveValue(target.title);await expect(page.locator('.cal-item-bullet')).toHaveAttribute('aria-pressed','true');
 await page.locator('.cal-item-bullet').click();await expect.poll(async()=>(await call('GET',`${E}/${target.id}`)).items[0].completed).toBe(false);
 expect((await call('GET',`${E}/${task.id}`)).items).toHaveLength(0);
});

test('重复实例完成事项只改变当前任务，后续事项保持未完成',async({page})=>{
 const task=await call('POST',E,entry('重复事项完成范围',{items:items(),repeat:{until:'2026-10-09'}}));await page.reload();await open(page,task.title);await page.locator('.cal-item-bullet').first().click();
 await expect.poll(async()=>(await call('GET',E)).items.filter(x=>x.title===task.title).length).toBe(2);
 const list=(await call('GET',E)).items.filter(x=>x.title===task.title),single=list.find(x=>!x.repeat);expect(single.items[0].completed).toBe(true);
 const next=await call('GET',`${E}/${task.id}/occurrence?originDate=2026-10-02`);expect(Boolean(next.items[0].completed)).toBe(false);
});

test('重复次数填0不能悄悄换成4次并保存',async({page})=>{
 const task=await call('POST',E,entry('重复次数校验',{repeat:{until:'2026-10-09'}}));await page.reload();await open(page,task.title);await page.locator('.cal-repeat-summary').click();
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
 for(const selector of ['.cal-sidebar','.cal-menu-host.cal-tag-picker','.cal-notes']) {
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
 if(await page.locator('.cal-editor').count())await expect(page.locator('[name=entry-date]')).toHaveValue('2026-09-26');
});

test('长备注保存结果未知时，关闭被阻断的原因仍在当前视野可见',async({page})=>{
 const task=await call('POST',E,entry('长备注保存异常现场'));await page.reload();await open(page,task.title);
 await page.route(`**${E}/${task.id}`,async route=>{
  if(route.request().method()!=='PUT')return route.continue();
  await route.fetch();await route.abort('failed');
 });
 await page.getByRole('textbox',{name:'备注',exact:true}).fill(Array.from({length:30},(_,i)=>`第${i+1}行：检查失败后能否在当前视野理解发生了什么`).join('\n'));
 await page.keyboard.press('ControlOrMeta+s');
 await expect(page.locator('.cal-editor .cal-error')).toContainText('确认');
 await page.getByRole('button',{name:'关闭任务',exact:true}).click();
 await expect(page.locator('.cal-editor')).toHaveCount(1);
 const error=await page.locator('.cal-editor .cal-error').boundingBox(),panel=await page.locator('.cal-editor').boundingBox();
 expect(error.y).toBeLessThan(panel.y+panel.height);
 expect(error.y+error.height).toBeGreaterThan(panel.y);
 await page.screenshot({path:test.info().outputPath('save-feedback.png'),animations:'disabled'});
 await page.unroute(`**${E}/${task.id}`);
 await page.getByRole('button',{name:'重试确认',exact:true}).click();
 await expect(page.locator('.cal-save-feedback')).toHaveCount(0);
 await closed(page);expect((await call('GET',`${E}/${task.id}`)).version).toBe(2);
});

test('提醒支持开始前后及结束前后，保存与摘要保持一致',async({page})=>{
 const task=await call('POST',E,entry('四种提醒时机'));await page.reload();await open(page,task.title);
 for(const [mode,label,anchor,side] of [['start-before','开始前','start','before'],['start-after','开始后','start','after'],['end-before','结束前','end','before'],['end-after','结束后','end','after']]) {
  await action(page,'设置提醒');const dialog=page.getByRole('dialog',{name:'提醒',exact:true});
  await dialog.getByRole('combobox',{name:'提醒时机',exact:true}).selectOption({label});
  await dialog.getByRole('spinbutton').fill('5');await dialog.getByRole('button',{name:'完成',exact:true}).click();
  await expect(page.locator('.cal-reminder-summary')).toContainText(`${label} 5 分钟提醒`);
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
 await page.getByRole('button',{name:'安排时间',exact:true}).click();
 await page.locator('[name=entry-start]').fill('');await page.getByRole('textbox',{name:'备注',exact:true}).fill('保留待安排备注');await closed(page);
 const saved=await call('GET',`${E}/${task.id}`);expect(saved.time).toBeNull();expect(saved.reminder).toBeNull();expect(saved.calendar.notes).toBe('保留待安排备注');
});
