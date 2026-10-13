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

const operations=['标题','备注','标签','添加事项','完成事项','全天','每日重复','取消重复','移回待安排','安排时间'];
async function scene(page){return page.evaluate(()=>{const head=Object.keys(localStorage).find(k=>k.endsWith(':head:scene:schedule-calendar'));const branch=head&&JSON.parse(localStorage.getItem(head));return branch?JSON.parse(localStorage.getItem(branch)).value.draft:null;});}
async function confirmed(page){await page.keyboard.press('ControlOrMeta+s');await expect.poll(async()=>{const d=await scene(page);return Boolean(d?.id&&JSON.stringify(d.content)===JSON.stringify(d.baseline));}).toBe(true);}
for(const first of operations)for(const second of operations)test(`P 操作对 ${first} → ${second}，保存刷新保持所有预期内容`,async({page})=>{
 const label=await call('POST',L,{name:'讲义',color:'#63c6ec'});const item={id:randomUUID(),text:'打印讲义',priority:'normal'};const initial=await call('POST',E,entry('课堂准备',{items:[item]}));await page.reload();await open(page,initial.title);
 const expected={title:initial.title,notes:'',tags:[],items:[{text:item.text,completed:false}],timed:true,allDay:false,repeating:false};
 for(const [step,name]of [first,second].entries()){
  const requiresTime=['全天','每日重复','取消重复'].includes(name);
  if(requiresTime&&!expected.timed){await page.getByRole('button',{name:'任务操作',exact:true}).click();await expect(page.getByRole('menuitem',{name:'重复',exact:true})).toHaveCount(0);await expect(page.getByRole('menuitemcheckbox',{name:'全天',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');continue;}
  if(name==='安排时间'&&expected.timed){await expect(page.getByRole('button',{name:'安排时间',exact:true})).toHaveCount(0);continue;}
  if(name==='移回待安排'&&!expected.timed){await expect(page.getByRole('button',{name:'移回待安排',exact:true})).toHaveCount(0);continue;}
  if(name==='标题'){expected.title=`第${step+1}步标题`;await page.locator('[name=entry-title]').fill(expected.title);}
  if(name==='备注'){expected.notes=`第${step+1}步备注`;await page.getByRole('textbox',{name:'备注',exact:true}).fill(expected.notes);}
  if(name==='标签'){expected.tags=expected.tags.length?[]:[label.id];await page.getByRole('button',{name:'标签',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'讲义',exact:true}).click();await page.keyboard.press('Escape');}
  if(name==='添加事项'){await page.getByRole('button',{name:'添加事项',exact:true}).click();const text=`第${step+1}步新增事项`;await page.getByLabel(`事项 ${expected.items.length+1}`,{exact:true}).fill(text);expected.items.push({text,completed:false});}
  if(name==='完成事项'){await page.getByRole('button',{name:'拖动事项 1',exact:true}).click();expected.items[0].completed=!expected.items[0].completed;}
  if(name==='全天'){await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'全天',exact:true}).click();expected.allDay=!expected.allDay;}
  if(name==='每日重复'||name==='取消重复'){await page.getByRole('button',{name:'任务操作',exact:true}).click();await page.getByRole('menuitem',{name:'重复',exact:true}).hover();await page.getByRole('menuitem',{name:name==='每日重复'?'每天':'不重复',exact:true}).click();expected.repeating=name==='每日重复';}
  if(name==='移回待安排'){await page.getByRole('button',{name:'移回待安排',exact:true}).click();const d=page.getByRole('dialog',{name:'移回待安排',exact:true});await d.getByRole('button',{name:'移回待安排',exact:true}).click();expected.timed=false;expected.allDay=false;expected.repeating=false;}
  if(name==='安排时间'){await page.getByRole('button',{name:'安排时间',exact:true}).click();expected.timed=true;}
  if(!['每日重复','取消重复'].includes(name)&&expected.repeating)expected.repeating=false;
  await confirmed(page);const draft=await scene(page);const actual=await call('GET',`${E}/${draft.id}`);
  expect(actual.title).toBe(expected.title);expect(actual.calendar.notes).toBe(expected.notes);expect(actual.calendar.tags).toEqual(expected.tags);expect(actual.items.map(x=>({text:x.text,completed:Boolean(x.completed)}))).toEqual(expected.items);expect(Boolean(actual.time)).toBe(expected.timed);expect(actual.calendar.allDay).toBe(expected.allDay);expect(Boolean(actual.repeat)).toBe(expected.repeating);
 }
 const draft=await scene(page),saved=await call('GET',`${E}/${draft.id}`);await closed(page);await page.goto(`${world.origin}/calendar?entry=${draft.id}`);await expect(page.locator('[name=entry-title]')).toHaveValue(saved.title);await expect(page.getByRole('textbox',{name:'备注',exact:true})).toHaveText(expected.notes);
});
