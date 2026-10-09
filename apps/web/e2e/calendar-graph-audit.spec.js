import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
test.use({ timezoneId: 'Asia/Shanghai' });
const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
let world, client, now, errors;
const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, course: { classId: null, lessonId: null, recordIds: [] }, calendar: { allDay: false, tags: [], notes: '' }, ...patch });
async function call(method, url, body) {
  const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
}
async function open(page, title) { await page.locator('.cal-upcoming-row').filter({ hasText: title }).click(); }
test.beforeEach(async ({ page }) => {
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
    const data = { test: info.title, directory: world.directory, origin: world.origin, time: now, pageErrors: errors, entries: (await call('GET', E)).items };
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

const row=()=>[{id:randomUUID(),text:'打印讲义',priority:'normal'}];
async function reloadOpen(page,task){await page.reload();await open(page,task.title);}
async function view(page,name){await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitemradio',{name:new RegExp(`^${name}\\s`)}).click();}
async function named(page){const task=await call('POST',E,entry('课堂准备',{items:row()}));await reloadOpen(page,task);return task;}
async function save(page){await page.keyboard.press('ControlOrMeta+s');}
async function openDialog(page,kind){
 if(kind==='提醒')await action(page,'设置提醒');
 if(kind==='重复'){await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();}
 if(kind==='标签'){await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('menuitem',{name:'+ 创建标签',exact:true}).click();}
 if(kind==='待安排')await page.getByRole('button',{name:'移回待安排',exact:true}).click();
 if(kind==='删除')await action(page,'删除任务');
 if(kind==='移动'){await page.getByRole('button',{name:'事项 1 操作',exact:true}).click();await page.getByRole('menuitem',{name:'移到其他安排…',exact:true}).click();}
 return page.getByRole('dialog',{name:{提醒:'提醒',重复:'重复',标签:'创建标签',待安排:'移回待安排',删除:'删除任务',移动:'移动事项'}[kind],exact:true});
}
for(const kind of ['提醒','重复','标签','待安排','删除','移动'])for(const exit of ['取消','叉号','Escape','背景'])test(`G1 ${kind}浮层用${exit}退出只取消浮层，父任务保持`,async({page})=>{
 const task=await named(page);const d=await openDialog(page,kind);await expect(d).toBeVisible();
 if(kind==='提醒')await d.getByLabel('分钟数',{exact:true}).fill('35');
 if(kind==='重复')await d.getByLabel('重复间隔',{exact:true}).fill('3');
 if(kind==='标签')await d.getByLabel('标签名称',{exact:true}).fill('取消不应产生的标签');
 if(exit==='取消')await d.getByRole('button',{name:'取消',exact:true}).click();
 if(exit==='叉号')await d.getByRole('button',{name:'关闭',exact:true}).click();
 if(exit==='Escape')await page.keyboard.press('Escape');
 if(exit==='背景')await page.locator('.cal-dialog-backdrop').last().click({position:{x:8,y:8}});
 await expect(d).toHaveCount(0);await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);expect((await call('GET',`${E}/${task.id}`)).version).toBe(task.version);expect((await call('GET',L)).items).toHaveLength(0);
});

for(const field of ['标题','备注','开始日期','开始时间','事项','标签'])for(const next of ['关闭','刷新','换视图','换任务','点空白'])test(`G2 修改${field}后立即${next}，保存最后输入且不串任务`,async({page})=>{
 const label=await call('POST',L,{name:'讲义',color:'#63c6ec'});const task=await call('POST',E,entry('课堂准备',{items:row()}));const other=await call('POST',E,entry('另一任务',{time:{...entry('').time,startTime:'16:00'}}));await reloadOpen(page,task);
 if(field==='标题')await page.locator('[name=entry-title]').fill('修改后的标题');
 if(field==='备注')await page.getByRole('textbox',{name:'备注',exact:true}).fill('第一行\n第二行：数学 ∑ x²');
 if(field==='开始日期')await page.locator('[name=entry-date]').fill('2026-09-26');
 if(field==='开始时间')await page.locator('[name=entry-start]').fill('15:05');
 if(field==='事项')await page.getByLabel('事项 1',{exact:true}).fill('最后输入的事项');
 if(field==='标签'){await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'讲义',exact:true}).click();await page.keyboard.press('Escape');}
 if(next==='关闭')await closed(page);
 if(next==='刷新')await page.reload();
 if(next==='换视图')await view(page,'月');
 if(next==='换任务'){const card=page.locator('.fc-timegrid-event').filter({hasText:other.title});await card.scrollIntoViewIfNeeded();await card.click();}
 if(next==='点空白'){const lane=page.locator('.fc-timegrid-slot-lane[data-time="04:00:00"]');await lane.scrollIntoViewIfNeeded();await lane.click({position:{x:100,y:4}});}
 await expect.poll(async()=>{const x=await call('GET',`${E}/${task.id}`);return field==='标题'?x.title:field==='备注'?x.calendar.notes:field==='开始日期'?x.time.date:field==='开始时间'?x.time.startTime:field==='事项'?x.items[0].text:x.calendar.tags;}).toEqual({'标题':'修改后的标题','备注':'第一行\n第二行：数学 ∑ x²','开始日期':'2026-09-26','开始时间':'15:05','事项':'最后输入的事项','标签':[label.id]}[field]);
 expect((await call('GET',`${E}/${other.id}`)).version).toBe(other.version);expect((await call('GET',E)).items).toHaveLength(2);
});

for(const [field,value] of [['entry-date',''],['entry-date','2101-01-01'],['entry-start',''],['entry-end-date',''],['entry-end-date','2026-09-24'],['entry-end',''],['entry-end','14:59']])test(`G3 已有任务${field}=${value||'空'}后关闭，保留原时间和有效备注`,async({page})=>{
 const task=await named(page);await page.getByRole('textbox',{name:'备注',exact:true}).fill('有效备注应保留');await page.locator(`[name=${field}]`).fill(value);await closed(page);
 const x=await call('GET',`${E}/${task.id}`);expect(x.time).toEqual(task.time);expect(x.calendar.notes).toBe('有效备注应保留');
});

for(const shape of ['普通任务','待安排','重复实例'])test(`G4 ${shape}长备注保存错误不会藏在屏幕之外`,async({page})=>{
 const task=await call('POST',E,entry('备注边界',{...(shape==='待安排'?{time:null}:{}),...(shape==='重复实例'?{repeat:{until:'2026-10-09'}}:{})}));await reloadOpen(page,task);await page.getByRole('textbox',{name:'备注',exact:true}).fill('字'.repeat(50001));await page.getByRole('button',{name:'关闭任务',exact:true}).click();
 await expect(page.locator('.cal-save-feedback')).toBeVisible();const feedback=await page.locator('.cal-save-feedback').boundingBox(),side=await page.locator('.cal-sidebar').boundingBox();expect(feedback.y).toBeGreaterThanOrEqual(side.y);expect(feedback.y+feedback.height).toBeLessThanOrEqual(side.y+side.height);
 expect((await call('GET',`${E}/${task.id}`)).calendar.notes).toBe('');
});

for(const target of ['标题','备注','时间','完成','添加事项'])test(`G5 修改${target}取消快速新建时，不创建空标题对象`,async({page})=>{
 await page.getByRole('button',{name:'新建任务',exact:true}).click();
 if(target==='标题')await page.locator('[name=entry-title]').fill('   ');
 if(target==='备注')await page.getByRole('textbox',{name:'备注',exact:true}).fill('没有标题的备注');
 if(target==='时间')await page.locator('[name=entry-start]').fill('22:00');
 if(target==='完成'){await page.getByRole('button',{name:'添加事项',exact:true}).click();await page.getByLabel('事项 1',{exact:true}).fill('没有标题的事项');await page.getByRole('button',{name:'拖动事项 1',exact:true}).click();}
 if(target==='添加事项')await page.getByRole('button',{name:'添加事项',exact:true}).click();
 await closed(page);expect((await call('GET',E)).items).toHaveLength(0);
});

for(const width of [1675,1100,768,390])for(const theme of ['浅色','深色'])test(`K1 ${width} ${theme}任务菜单和提醒浮层在可视区域内，字段与焦点不溢出`,async({page})=>{
 const task=await call('POST',E,entry('较长的课堂准备标题：函数概念、定义域与值域',{items:row(),calendar:{allDay:false,notes:'多行备注\n第二行',tags:[]}}));
 await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:theme,exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();await page.setViewportSize({width,height:950});if(width<=950)await page.getByRole('button',{name:'打开月份与任务',exact:true}).click();await open(page,task.title);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await expect(d).toBeVisible();await expect(d).toHaveCSS('opacity','1');const b=await d.boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(950);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await d.getByLabel('分钟数',{exact:true}).click();await page.screenshot({path:test.info().outputPath('dialog-field.png')});
});

for(const count of ['','0','32','1.5'])test(`K2 自定义视图天数${count||'空'}不可提交`,async({page})=>{
 await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitem',{name:'天数',exact:true}).hover();await page.getByRole('menuitem',{name:'其他…',exact:true}).click();const d=page.getByRole('dialog',{name:'自定义天数',exact:true});await d.getByLabel('天数',{exact:true}).fill(count);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.cal-editor')).toHaveCount(0);
});
for(const count of ['1','9','31'])test(`K3 自定义${count}天视图与翻段、今天、刷新一致`,async({page})=>{
 await page.getByRole('button',{name:'日历视图',exact:true}).click();await page.getByRole('menuitem',{name:'天数',exact:true}).hover();await page.getByRole('menuitem',{name:'其他…',exact:true}).click();const d=page.getByRole('dialog',{name:'自定义天数',exact:true});await d.getByLabel('天数',{exact:true}).fill(count);await d.getByRole('button',{name:'完成',exact:true}).click();await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(Number(count));const first=await page.locator('.fc-timegrid-col[data-date]').first().getAttribute('data-date');await page.getByRole('button',{name:'下一段',exact:true}).click();await page.getByRole('button',{name:'上一段',exact:true}).click();await expect(page.locator('.fc-timegrid-col[data-date]').first()).toHaveAttribute('data-date',first);await page.getByRole('button',{name:'今天',exact:true}).click();await page.reload();await expect(page.locator('.fc-timegrid-col[data-date]')).toHaveCount(Number(count));
});

test('K4 标签达到30个后不允许静默选入第31个导致任务无法保存',async({page})=>{
 const labels=[];for(let i=0;i<31;i++)labels.push(await call('POST',L,{name:`标签${String(i+1).padStart(2,'0')}`,color:'#63c6ec'}));const task=await call('POST',E,entry('标签数量边界',{calendar:{allDay:false,notes:'',tags:labels.slice(0,30).map(x=>x.id)}}));await reloadOpen(page,task);await page.getByRole('button',{name:'标签',exact:true}).click();const option=page.getByRole('menuitemcheckbox',{name:'标签31',exact:true});
 const disabled=await option.isDisabled();if(!disabled)await option.click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'关闭任务',exact:true}).click();await expect(page.locator('.cal-editor')).toHaveCount(0);expect((await call('GET',`${E}/${task.id}`)).calendar.tags).toHaveLength(30);
});

for(const year of ['1900-01-01','2100-12-31'])test(`K5 浏览边界日期${year}的日周月视图不会失败或跳出支持范围`,async({page})=>{
 const task=await call('POST',E,entry('边界任务',{time:{...entry('').time,date:year}}));await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expect(page.locator('[name=entry-date]')).toHaveValue(year);
 for(const name of ['日','周','月']){await view(page,name);await expect(page.locator('.cal-load-error')).toHaveCount(0);await expect(page.locator('.fc-event').filter({hasText:task.title}).first()).toBeVisible();}
});

for(const viewName of ['周','月'])test(`K6 跨两周全天在${viewName}视图保留连续范围、标题截断和更多入口`,async({page})=>{
 const task=await call('POST',E,entry('跨两周全天标题：备课与教研任务长内容重复重复重复',{time:{...entry('').time,date:'2026-09-22',startTime:'00:00',durationMinutes:1440*14},calendar:{allDay:true,notes:'',tags:[]}}));await page.reload();await view(page,viewName);const cards=page.locator('.fc-daygrid-event').filter({hasText:task.title});await expect(cards.first()).toBeVisible();for(const card of await cards.all()){const b=await card.boundingBox();if(!b)continue;const title=card.locator('.cal-event-title');expect(await title.evaluate(el=>getComputedStyle(el).textOverflow)).toBe('ellipsis');}
 expect((await call('GET',`${E}/${task.id}`)).time.durationMinutes).toBe(20160);
});

test('K7 创建标签后切换到标签分组，两区都正确出现新分类',async({page})=>{
 const task=await named(page);await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('menuitem',{name:'+ 创建标签',exact:true}).click();const d=page.getByRole('dialog',{name:'创建标签',exact:true});await d.getByLabel('标签名称',{exact:true}).fill('新建分类');await d.getByRole('button',{name:'保存',exact:true}).click();await closed(page);const upcoming=page.getByRole('region',{name:'即将到来',exact:true});await upcoming.getByRole('button',{name:'按标签分组',exact:true}).click();await expect(upcoming.locator('.cal-upcoming-group')).toContainText('新建分类');
});

test('K8 未选任务时键盘快捷键切换视图，输入备注时快捷键只输入文字',async({page})=>{
 for(const [key,name]of [['d','日'],['w','周'],['m','月'],['3','3 天']]){await page.locator('.cal-toolbar h1').click();await page.keyboard.press(key);await expect(page.getByRole('button',{name:'日历视图',exact:true})).toContainText(name);}
 const task=await call('POST',E,entry('快捷键任务'));await page.goto(`${world.origin}/calendar?entry=${task.id}`);const notes=page.getByRole('textbox',{name:'备注',exact:true});await notes.click();await notes.pressSequentially('dwm123');await expect(notes).toHaveText('dwm123');await page.keyboard.press('ControlOrMeta+s');await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).calendar.notes).toBe('dwm123');
});


for(const menu of ['日历视图','任务操作','事项 1 操作'])test(`K9 键盘打开${menu}后方向键进入菜单而不是停留在触发按钮`,async({page})=>{
 if(menu!=='日历视图')await named(page);const trigger=page.getByRole('button',{name:menu,exact:true});await trigger.focus();await page.keyboard.press('Enter');await expect(trigger).toHaveAttribute('aria-expanded','true');await page.keyboard.press('ArrowDown');await expect.poll(async()=>page.evaluate(()=>Boolean(document.activeElement?.closest('[role=menu]')))).toBe(true);await page.keyboard.press('Escape');await expect(trigger).toBeFocused();if(menu!=='日历视图')await expect(page.locator('.cal-editor')).toBeVisible();
});

for(const until of ['', '2026-09-24','2101-01-01'])test(`K10 重复结束日期${until||'空'}不可提交且取消可用`,async({page})=>{
 await named(page);await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});await d.locator('input[name=repeat-end]').nth(1).check();await d.getByLabel('重复结束日期',{exact:true}).fill(until);await expect(d.getByRole('button',{name:'完成',exact:true})).toBeDisabled();await d.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.cal-editor')).toBeVisible();
});

for(const placement of ['普通任务','待安排','重复任务'])test(`K11 删除${placement}已使用的标签后继续改标题并保存，不残留失效引用`,async({page})=>{
 const label=await call('POST',L,{name:'准备删除',color:'#63c6ec'});const task=await call('POST',E,entry('标签生命周期',{...(placement==='待安排'?{time:null}:{}),...(placement==='重复任务'?{repeat:{until:'2026-10-09'}}:{}),calendar:{allDay:false,notes:'保留备注',tags:[label.id]}}));await page.goto(`${world.origin}/calendar?entry=${task.id}${placement==='重复任务'?'&on=2026-09-25':''}`);await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('button',{name:'编辑标签 准备删除',exact:true}).click();await page.getByRole('dialog',{name:'编辑标签',exact:true}).getByRole('button',{name:'删除标签',exact:true}).click();await expect(page.getByRole('dialog',{name:'编辑标签',exact:true})).toHaveCount(0);await page.locator('[name=entry-title]').fill('删除标签后继续编辑');await closed(page);const rows=(await call('GET',E)).items;const changed=rows.find(x=>x.title==='删除标签后继续编辑');expect(changed,JSON.stringify(rows)).toBeTruthy();expect(changed.calendar.notes).toBe('保留备注');await page.reload();await expect(page.locator('.cal-load-error')).toHaveCount(0);
});

for(const date of ['1900-01-01','2100-12-31'])for(const viewName of ['日','周','月'])test(`K12 支持范围端点${date}在${viewName}视图正常加载`,async({page},info)=>{
 const task=await call('POST',E,entry('范围端点',{time:{...entry('').time,date}}));const bad=[];page.on('response',async r=>{if(r.status()>=400&&r.url().includes('/schedule/'))bad.push({status:r.status(),url:r.url()});});await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expect(page.locator('[name=entry-date]')).toHaveValue(date);await view(page,viewName);await expect(page.getByRole('button',{name:'日历视图',exact:true})).toContainText(viewName);try{await expect(page.locator('.cal-load-error')).toHaveCount(0);await expect(page.locator('.fc-event').filter({hasText:task.title}).first()).toBeVisible();}finally{fs.writeFileSync(info.outputPath('range-http.json'),JSON.stringify({date,viewName,bad},null,2));}
});

for(const placement of ['任务','待安排'])test(`K13 ${placement}标题与事项达到输入上限，备注多行纯文本保持原样`,async({page})=>{
 const task=await call('POST',E,entry('输入边界',{...(placement==='待安排'?{time:null}:{}),items:row()}));await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);const title='题'.repeat(300),item='事'.repeat(4000),notes='第一行\n第二行 <b>字面文本</b>\n🙂';await page.locator('[name=entry-title]').fill(title+'多');await expect(page.locator('[name=entry-title]')).toHaveValue(title);await page.getByLabel('事项 1',{exact:true}).fill(item+'多');await expect(page.getByLabel('事项 1',{exact:true})).toHaveValue(item);await page.getByRole('textbox',{name:'备注',exact:true}).fill(notes);await closed(page);const saved=await call('GET',`${E}/${task.id}`);expect(saved.title).toBe(title);expect(saved.items[0].text).toBe(item);expect(saved.calendar.notes).toBe(notes);await page.goto(`${world.origin}/calendar?entry=${task.id}`);await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText(notes);
});


test('K14 越界重复结束日期不能把编辑器困在泛化错误中',async({page})=>{
 const task=await named(page);await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});await d.locator('input[name=repeat-end]').nth(1).check();await d.getByLabel('重复结束日期',{exact:true}).fill('2101-01-01');const done=d.getByRole('button',{name:'完成',exact:true});if(await done.isDisabled()){await d.getByRole('button',{name:'取消',exact:true}).click();return;}await done.click();await page.getByRole('button',{name:'关闭任务',exact:true}).click();await expect(page.locator('.cal-editor')).toHaveCount(0);expect((await call('GET',`${E}/${task.id}`)).repeat).toBeNull();
});


test('K15 八个标签颜色均可选择保存，取消改色保留已保存颜色',async({page})=>{
 let label=await call('POST',L,{name:'颜色检查',color:'#ff6b75'});await named(page);
 for(const color of ['#ff6b75','#3edc81','#5b9cf5','#a78bfa','#ffb454','#f27ab8','#43c6c6','#9ba0aa']){await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('button',{name:'编辑标签 颜色检查',exact:true}).click();const d=page.getByRole('dialog',{name:'编辑标签',exact:true});await d.getByRole('button',{name:`颜色 ${color}`,exact:true}).click();await expect(d.getByRole('button',{name:`颜色 ${color}`,exact:true})).toHaveAttribute('aria-pressed','true');await d.getByRole('button',{name:'保存',exact:true}).click();await expect(d).toHaveCount(0);label=(await call('GET',L)).items.find(x=>x.id===label.id);expect(label.color).toBe(color);}
 await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('button',{name:'编辑标签 颜色检查',exact:true}).click();const d=page.getByRole('dialog',{name:'编辑标签',exact:true});await d.getByRole('button',{name:'颜色 #ff6b75',exact:true}).click();await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',L)).items.find(x=>x.id===label.id).color).toBe('#9ba0aa');
});

test('K16 八种重复快捷设置都能执行并显示实际保存的规则',async({page})=>{
 const task=await named(page);
 for(const [name,frequency,interval,weekdays]of [['每天','daily',1,null],['每个工作日','weekly',1,[1,2,3,4,5]],['每周','weekly',1,[5]],['每两周','weekly',2,[5]],['每月（日期）','monthly',1,null],['每月（星期）','monthly',1,null],['每年','yearly',1,null],['不重复',null,null,null]]){await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name,exact:true}).click();await expect.poll(async()=>{const head=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.endsWith(':head:scene:schedule-calendar'));const branch=key&&JSON.parse(localStorage.getItem(key));return branch?JSON.parse(localStorage.getItem(branch)).value.draft:null;});return Boolean(head&&JSON.stringify(head.content)===JSON.stringify(head.baseline));}).toBe(true);const saved=await call('GET',`${E}/${task.id}`);if(!frequency){expect(saved.repeat).toBeNull();await expect(page.locator('.cal-repeat-summary')).toHaveCount(0);}else{expect(saved.repeat.frequency).toBe(frequency);expect(saved.repeat.interval).toBe(interval);if(weekdays)expect(saved.repeat.weekdays).toEqual(weekdays);await expect(page.locator('.cal-repeat-summary')).toBeVisible();}}
});

test('K17 标签搜索空结果和名称上限可理解、可取消，不创建空标签',async({page})=>{
 await call('POST',L,{name:'课堂',color:'#63c6ec'});await named(page);await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('searchbox',{name:'搜索标签',exact:true}).fill('不存在的分类');await expect(page.getByText('没有匹配的标签',{exact:true})).toBeVisible();await page.getByRole('menuitem',{name:'+ 创建标签',exact:true}).click();const d=page.getByRole('dialog',{name:'创建标签',exact:true});await d.getByLabel('标签名称',{exact:true}).fill('   ');await expect(d.getByRole('button',{name:'保存',exact:true})).toBeDisabled();await d.getByLabel('标签名称',{exact:true}).fill('名'.repeat(61));await expect(d.getByLabel('标签名称',{exact:true})).toHaveValue('名'.repeat(60));await d.getByRole('button',{name:'取消',exact:true}).click();expect((await call('GET',L)).items).toHaveLength(1);
});
