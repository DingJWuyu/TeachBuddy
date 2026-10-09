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
let world, client, errors;
const content = (title, pending = false) => ({ title, items: [],
  time: pending ? null : { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, course: { classId: null, lessonId: null, recordIds: [] },
  calendar: { allDay: false, tags: [], notes: '' } });
async function call(method, url, body) {
  const response = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(response.status, JSON.stringify(response.json)).toBeLessThan(300);
  return response.json;
}
async function open(page, task) {
  await page.goto(`${world.origin}/calendar?entry=${task.id}`);
  await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);
}
async function create(page, pending) {
  await page.getByRole('button', { name: pending ? '新建待安排任务' : '新建任务', exact: true }).click();
}
async function action(page, name) {
  await page.getByRole('button', { name: '任务操作', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-25T06:00:00Z'));
  errors = []; page.on('pageerror', error => errors.push(error.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-keyboard-')),
    workbenchClock: () => new Date('2026-09-25T06:00:00Z') });
  ({ client } = await registerMath(world, 'schedule-keyboard@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-keyboard@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await expect(page.locator('.cal-time-zone')).toHaveAttribute('title', 'Asia/Shanghai');
});
test.afterEach(async ({ context }, info) => {
  const failed = info.status !== info.expectedStatus || errors.length;
  if (failed) {
    fs.writeFileSync(info.outputPath('preserved-case.json'), JSON.stringify({ test: info.title, directory: world.directory,
      origin: world.origin, entries: (await call('GET', E)).items, labels: (await call('GET', L)).items, errors }, null, 2));
    await context.pages()[0]?.screenshot({ path: info.outputPath('preserved-scene.png') }).catch(() => {});
  }
  await context.close(); await world.close();
  if (!failed) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(errors).toEqual([]);
});


for (const pending of [false, true]) for (const existing of [false, true]) test(`标题 Enter ${pending ? '待安排' : '任务'}${existing ? '已有' : '新建'}只保存并移出光标，编辑器保留且不新增副本`, async ({page}) => {
  let task;
  if (existing) {task=await call('POST',E,content('原任务',pending));await open(page,task);}
  else await create(page,pending);
  const title=page.locator('[name=entry-title]');await title.fill('确认后的标题');await title.press('Enter');
  await expect(page.locator('.cal-editor')).toBeVisible();await expect(title).not.toBeFocused();
  await expect.poll(async()=> (await call('GET',E)).items.map(x=>x.title)).toEqual(['确认后的标题']);
  await title.fill('第二次标题');await title.press('Enter');
  await expect.poll(async()=> (await call('GET',E)).items.map(x=>x.title)).toEqual(['第二次标题']);
  await expect(page.locator('.cal-editor')).toBeVisible();
});
test('标签 Enter 反复切换不关闭，灰底焦点没有外框',async({page},info)=>{
  const labels=[];for(const [name,color] of [['个人','#579bfc'],['备课','#31d776'],['教学','#ff5d71']])labels.push(await call('POST',L,{name,color}));
  const task=await call('POST',E,content('标签任务'));await open(page,task);
  await page.getByRole('button',{name:'标签',exact:true}).click();const search=page.getByRole('searchbox',{name:'搜索标签'});
  await search.click();await search.press('ArrowDown');const first=page.getByRole('menuitemcheckbox',{name:'个人',exact:true});await expect(first).toBeFocused();
  await first.press('Enter');await expect(first).toHaveAttribute('aria-checked','true');await expect(first).toBeFocused();
  await expect(page.locator('.cal-menu-presence[data-state="open"] > .cal-menu')).toHaveCSS('opacity','1');await page.screenshot({path:info.outputPath('tag-keyboard.png')});
  expect(await first.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');
  await first.press('Enter');await expect(first).toHaveAttribute('aria-checked','false');await expect(search).toBeVisible();
});
test('标签上下键只按行，左右键进入同行编辑，搜索光标正常',async({page})=>{
  for(const [name,color] of [['个人','#579bfc'],['备课','#31d776'],['教学','#ff5d71']])await call('POST',L,{name,color});
  const task=await call('POST',E,content('标签导航'));await open(page,task);await page.getByRole('button',{name:'标签',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'搜索标签'});await search.click();await search.press('ArrowDown');
  const first=page.getByRole('menuitemcheckbox',{name:'个人',exact:true}),second=page.getByRole('menuitemcheckbox',{name:'备课',exact:true});
  await first.press('ArrowDown');await expect(second).toBeFocused();await second.press('ArrowRight');await expect(page.getByRole('button',{name:'编辑标签 备课'})).toBeFocused();
  await page.keyboard.press('ArrowUp');await expect(page.getByRole('button',{name:'编辑标签 个人'})).toBeFocused();
  await page.keyboard.press('ArrowLeft');await expect(first).toBeFocused();await first.press('ArrowUp');await expect(search).toBeFocused();
  await search.fill('教学');await search.press('Home');await search.press('End');await expect(search).toBeFocused();await search.press('ArrowDown');await expect(page.getByRole('menuitemcheckbox',{name:'教学',exact:true})).toBeFocused();
});
for(const [name,value,key] of [['entry-date','2026-09-26','date'],['entry-end-date','2026-09-26','endDate'],['entry-start','15:15','startTime'],['entry-end','16:00','endTime']])test(`日期时间 ${name} Enter 确认并移出输入焦点`,async({page})=>{
  const task=await call('POST',E,content('时间确认'));await open(page,task);const input=page.locator(`[name=${name}]`);await input.fill(value);await input.press('Enter');
  await expect(input).not.toBeFocused();await expect(page.locator('.cal-editor')).toBeVisible();
  await expect.poll(async()=>{const saved=await call('GET',`${E}/${task.id}`);if(key==='date')return saved.time.date;if(key==='startTime')return saved.time.startTime;if(key==='endDate')return Math.round(saved.time.durationMinutes/1440);return saved.time.durationMinutes;}).toBe(key==='endDate'?1:key==='endTime'?60:value);
});
test('任务菜单上下键使用灰底定位，没有边框',async({page},info)=>{
  const task=await call('POST',E,content('菜单键盘'));await open(page,task);const trigger=page.getByRole('button',{name:'任务操作',exact:true});await trigger.focus();await trigger.press('Enter');
  const option=page.getByRole('menuitem',{name:'重复',exact:true});await expect(option).toBeFocused();await expect(page.locator('.cal-menu-presence[data-state="open"] > .cal-menu')).toHaveCSS('opacity','1');await page.screenshot({path:info.outputPath('task-menu-keyboard.png')});expect(await option.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');
  await option.press('ArrowDown');await expect(page.getByRole('menuitemcheckbox',{name:'全天',exact:true})).toBeFocused();
});
test('提醒左右键在时机和分钟数间移动，Enter 确认当前设置',async({page})=>{
  const task=await call('POST',E,content('提醒键盘'));await open(page,task);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});
  const timing=d.getByRole('combobox',{name:'提醒时机'}),minutes=d.getByRole('spinbutton');await expect(timing).toBeFocused();await timing.press('ArrowRight');await expect(minutes).toBeFocused();
  await minutes.fill('15');await minutes.press('ArrowLeft');await expect(timing).toBeFocused();await timing.press('ArrowUp');await expect(timing).toHaveValue('start-after');await timing.press('Enter');
  await expect(d).toHaveCount(0);await expect.poll(async()=> (await call('GET',`${E}/${task.id}`)).reminder).toEqual({anchor:'start',side:'after',minutes:15});
});
test('提醒下拉字段按 Enter 直接确认，不再打开选项列表',async({page})=>{
  const task=await call('POST',E,content('提醒回车'));await open(page,task);await action(page,'设置提醒');const d=page.getByRole('dialog',{name:'提醒',exact:true});await d.getByRole('combobox',{name:'提醒时机'}).press('Enter');await expect(d).toHaveCount(0);
});
test('日周全天卡片不带颜色圆点，月视图仍保留',async({page})=>{
  const c=content('两天全天');c.calendar.allDay=true;c.time.startTime='00:00';c.time.durationMinutes=2880;const task=await call('POST',E,c);
  await page.goto(`${world.origin}/calendar`);const view=page.getByRole('button',{name:'日历视图',exact:true});
  for(const kind of ['日','周']){await view.click();await page.getByRole('menuitemradio',{name:new RegExp('^'+kind)}).click();const event=page.locator('.fc-daygrid-event').filter({hasText:'两天全天'}).first();await expect(event).toBeVisible();await expect(event.locator('.cal-event-content i')).toHaveCount(0);}
  await view.click();await page.getByRole('menuitemradio',{name:/^月/}).click();const event=page.locator('.fc-daygrid-event').filter({hasText:'两天全天'}).first();await expect(event).toBeVisible();await expect(event.locator('.cal-event-content i')).toHaveCount(1);
});

test('标签搜索 Enter 选择匹配项，再次 Enter 取消，列表始终展开',async({page})=>{
  await call('POST',L,{name:'唯一匹配',color:'#579bfc'});const task=await call('POST',E,content('搜索确认'));await open(page,task);await page.getByRole('button',{name:'标签',exact:true}).click();const search=page.getByRole('searchbox',{name:'搜索标签'});await search.fill('唯一');await search.press('Enter');const option=page.getByRole('menuitemcheckbox',{name:'唯一匹配',exact:true});await expect(option).toHaveAttribute('aria-checked','true');await expect(option).toBeFocused();await option.press('Enter');await expect(option).toHaveAttribute('aria-checked','false');await expect(search).toBeVisible();await page.keyboard.press('Escape');await page.getByRole('button',{name:'关闭任务',exact:true}).click();expect((await call('GET',`${E}/${task.id}`)).calendar.tags).toEqual([]);
});
for(const ending of [false,true])test(`全天${ending?'结束':'开始'}日期 Enter 保存并失焦`,async({page})=>{
  const c=content('全天日期');c.calendar.allDay=true;c.time.startTime='00:00';c.time.durationMinutes=2880;const task=await call('POST',E,c);await open(page,task);const input=page.locator(`[name=${ending?'entry-end-date':'entry-date'}]`);await input.fill(ending?'2026-09-27':'2026-09-26');await input.press('Enter');await expect(input).not.toBeFocused();await expect(page.locator('.cal-editor')).toBeVisible();await expect.poll(async()=>{const saved=await call('GET',`${E}/${task.id}`);return ending?saved.time.durationMinutes:saved.time.date;}).toBe(ending?4320:'2026-09-26');
});
test('重复并排字段左右切换，选择字段上下修改，Enter 确认',async({page})=>{
  const task=await call('POST',E,content('重复方向键'));await open(page,task);await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name:'自定义…',exact:true}).click();const d=page.getByRole('dialog',{name:'重复',exact:true});const interval=d.getByLabel('重复间隔'),unit=d.getByLabel('重复单位');await expect(interval).toBeFocused();await interval.press('ArrowRight');await expect(unit).toBeFocused();await unit.press('ArrowDown');await expect(unit).toHaveValue('monthly');await unit.press('ArrowLeft');await expect(interval).toBeFocused();await interval.press('Enter');await expect(d).toHaveCount(0);await expect(page.locator('.cal-repeat-summary')).toContainText('月');
});
test('标签颜色横向用左右键，只有原有勾选没有外圈',async({page})=>{
  const task=await call('POST',E,content('颜色方向键'));await open(page,task);await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('menuitem',{name:'+ 创建标签',exact:true}).click();const d=page.getByRole('dialog',{name:'创建标签',exact:true});const colors=d.locator('.cal-label-colors button');await colors.first().focus();await page.keyboard.press('ArrowRight');await expect(colors.nth(1)).toBeFocused();expect(await colors.nth(1).evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');await page.keyboard.press('Space');await expect(colors.nth(1)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('ArrowLeft');await expect(colors.first()).toBeFocused();await d.getByRole('button',{name:'取消',exact:true}).click();
});
for(const theme of ['light','dark'])for(const width of [390,1675])test(`标签和任务菜单 ${theme} ${width} 键盘焦点完整且无外框`,async({page},info)=>{
  await page.getByRole('link',{name:/^账户：/}).click();await page.getByRole('button',{name:theme==='dark'?'深色':'浅色',exact:true}).click();await page.getByRole('link',{name:'日程',exact:true}).click();await page.setViewportSize({width,height:950});await call('POST',L,{name:'视觉标签',color:'#579bfc'});const task=await call('POST',E,content('视觉键盘'));await open(page,task);await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('searchbox',{name:'搜索标签'}).press('ArrowDown');const option=page.getByRole('menuitemcheckbox',{name:'视觉标签',exact:true});await expect(option).toBeFocused();await expect(page.locator('.cal-menu-presence[data-state="open"] > .cal-menu')).toHaveCSS('opacity','1');expect(await option.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');const bounds=await option.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);await page.screenshot({path:info.outputPath('tag-focus.png')});await page.keyboard.press('Escape');await page.getByRole('button',{name:'任务操作',exact:true}).press('Enter');const repeat=page.getByRole('menuitem',{name:'重复',exact:true});await expect(repeat).toBeFocused();await expect(page.locator('.cal-menu-presence[data-state="open"] > .cal-menu')).toHaveCSS('opacity','1');expect(await repeat.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');await page.screenshot({path:info.outputPath('menu-focus.png')});
});

test('彩色任务卡片键盘定位保留原色，以加深代替外框',async({page})=>{
  const label=await call('POST',L,{name:'蓝色任务',color:'#579bfc'});const c=content('彩色键盘卡片');c.calendar.tags=[label.id];const task=await call('POST',E,c);await page.goto(`${world.origin}/calendar`);const event=page.locator('.fc-timegrid-event').filter({hasText:'彩色键盘卡片'}).first();await expect(event).toBeVisible();await event.focus();await expect(event).toBeFocused();expect(await event.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');expect(await event.evaluate(e=>getComputedStyle(e).filter)).toBe('brightness(0.92)');await event.press('Enter');await expect(page.locator('[name=entry-title]')).toHaveValue(task.title);
});
