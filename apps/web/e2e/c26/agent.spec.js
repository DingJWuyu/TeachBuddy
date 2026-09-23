import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../../api/test/fixtures/c26/harness.js';
const evidence = process.env.AGENT_EVIDENCE_DIR ?? 'test-results/evidence/C26/v1';
fs.mkdirSync(evidence, { recursive: true });
let world;
test.beforeEach(async () => { world = await createIntegration(); });
test.afterEach(async ({ page }) => { await page.close(); await world.close(); });
async function register(page) {
  await page.goto(world.origin);
  await page.getByRole('button', { name: '创建账户' }).click();
  await page.getByLabel('昵称', { exact: true }).fill('C26老师');
  await page.getByLabel('邮箱', { exact: true }).fill('c26@example.test');
  await page.getByLabel('密码', { exact: true }).fill('password-c26');
  await page.getByLabel('确认密码', { exact: true }).fill('password-c26');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect.poll(() => world.mailer.lastCode('registration', 'c26@example.test')).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'c26@example.test'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
}
test('WB-AG-001/004: 同一持久草稿从首页到右栏再刷新', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: '新对话', exact: true }).click();
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('请帮我准备等差数列的课堂练习');
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '题库', exact: true }).click();
  await page.locator('.wb-ai-entry').click();
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('请帮我准备等差数列的课堂练习');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('请帮我准备等差数列的课堂练习');
  await page.screenshot({ path: `${evidence}/desktop-draft.png` });
});

for (const tag of ['deepseek','glm']) test(`WB-AG-003/007: ${tag} live模型结果保留库重启，桌面Pad窄屏打开实际题目和备课`,async({page})=>{
 await world.close();
 const fs=await import('node:fs');const report=JSON.parse(fs.readFileSync(`${{evidence}}/live-${{tag}}.json`,'utf8'));
 const os=await import('node:os');const path=await import('node:path');const directory=fs.mkdtempSync(path.join(os.tmpdir(),`c26-browser-live-${tag}-`));fs.cpSync(report.directory,directory,{recursive:true});
 world=await createIntegration({directory});
 await page.goto(world.origin);await page.getByLabel('邮箱',{exact:true}).fill(`c26-${tag}@example.test`);await page.getByLabel('密码',{exact:true}).fill('c26-live-local-password');await page.getByRole('button',{name:'登录',exact:true}).click();
 await expect(page.locator('.agent-tool')).toHaveCount(6);await expect(page.getByText('已完成',{exact:true})).toBeVisible();
 await page.screenshot({path:`${evidence}/${tag}-home-desktop.png`});
 for(const [width,height,name]of [[1440,900,'desktop'],[820,1180,'pad'],[390,844,'mobile']]){
  await page.setViewportSize({width,height});
  await expect.poll(()=>page.locator('.wb-sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width))).toBe(width <= 1080 ? 72 : 256);
  await expect(page.locator('.agent-tool')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect.poll(()=>page.locator('.agent-thread').evaluate(el=>{const frame=el.getBoundingClientRect();return [...el.querySelectorAll('.agent-tool,.agent-message')].filter(item=>{const box=item.getBoundingClientRect();return box.left<frame.left-1||box.right>frame.right+1;}).map(item=>({width:el.clientWidth,display:getComputedStyle(el).display,left:item.getBoundingClientRect().left-frame.left,right:item.getBoundingClientRect().right-frame.right}));})).toEqual([]);
  await page.screenshot({path:`${evidence}/${tag}-home-${name}.png`});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.agent-tool[data-tool-state="confirmed"]').first().getByRole('button',{name:/打开题目/}).click();
 await expect(page).toHaveURL(/\/questions\//);
 await expect(page.getByText(`数列进阶-${tag}`,{exact:true}).first()).toBeVisible();
 await page.screenshot({path:`${evidence}/${tag}-copy-open.png`});
 await page.locator('.wb-ai-entry').click();
 await expect(page.locator('.agent-tool')).toHaveCount(6);
 await page.locator('.agent-tool[data-tool-state="confirmed"]').last().getByRole('button',{name:/打开备课/}).click();
 await expect(page).toHaveURL(/\/lessons\//);await expect(page.getByRole('textbox',{name:'环节名称 2'})).toHaveValue('小组挑战');
 await page.screenshot({path:`${evidence}/${tag}-lesson-open.png`});
});

test('WB-AG-005: 独立浏览器草稿冲突保留双方内容，明确选择后保存',async({page,browser})=>{
 await register(page);await page.getByRole('button',{name:'新对话',exact:true}).click();
 await page.getByRole('textbox',{name:'AI 输入'}).fill('共同的初始草稿');await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();
 const other=await browser.newContext({ignoreHTTPSErrors:true});const second=await other.newPage();
 try {
 await second.goto(world.origin);await second.getByLabel('邮箱',{exact:true}).fill('c26@example.test');await second.getByLabel('密码',{exact:true}).fill('password-c26');await second.getByRole('button',{name:'登录',exact:true}).click();
 await expect(second.getByRole('textbox',{name:'AI 输入'})).toHaveValue('共同的初始草稿');
 await page.route('**/api/agent/conversations/*/draft',route=>route.request().method()==='PUT'?route.abort():route.continue());
 await page.getByRole('textbox',{name:'AI 输入'}).fill('本机尚未上传的课堂设想');await expect(page.getByRole('alert')).toBeVisible();
 await second.getByRole('textbox',{name:'AI 输入'}).fill('另一设备已保存的备课思路');await expect(second.getByText('草稿已保存',{exact:true})).toBeVisible();
 await page.unroute('**/api/agent/conversations/*/draft');await page.getByRole('button',{name:'重试',exact:true}).click();
 await expect(page.getByText('草稿已在其他设备修改',{exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'AI 输入'})).toHaveValue('本机尚未上传的课堂设想');
 await page.screenshot({path: `${evidence}/draft-conflict.png`});
 await page.getByRole('button',{name:'保留本机内容',exact:true}).click();await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();
 await second.reload();await expect(second.getByRole('textbox',{name:'AI 输入'})).toHaveValue('本机尚未上传的课堂设想');
 } finally {await other.close();}
});

test('WB-AG-020: 无assistant的真实SDK 404工具卡刷新仍在',async({page})=>{
 const {provider}=await import('../../../api/test/fixtures/c26/provider.js');
 const {randomUUID}=await import('node:crypto');const p=await provider([[{type:'toolCall',id:'missing-ui',name:'wb_get_question',arguments:{id:randomUUID()}}]]);
 await world.close();world=await createIntegration({agent:p.config});
 await register(page);await page.getByRole('button',{name:'新对话',exact:true}).click();await page.getByRole('textbox',{name:'AI 输入'}).fill('读取这道题');
 await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.locator('.agent-tool[data-tool-state="rejected"]')).toHaveCount(1);
 await expect(page.locator('.agent-message:not(.is-user)')).toHaveCount(0);
 await page.reload();await expect(page.locator('.agent-tool[data-tool-state="rejected"]')).toHaveCount(1);expect(p.requests()).toBe(1);
 await page.screenshot({path: `${evidence}/read-failure-restored.png`});
 await page.getByRole('button',{name:'对话历史',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'对话历史',exact:true})).toBeFocused();
});

test('恢复回归: 首次snapshot失败后恢复输入，事件缺号后重新建立SSE',async({page})=>{
 await register(page);await page.getByRole('button',{name:'新对话',exact:true}).click();
 await page.getByRole('textbox',{name:'AI 输入'}).fill('持久恢复草稿');await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();
 let failed=false, streams=0;
 await page.route(/\/api\/agent\/conversations\/[^/?]+$/,route=>{
  if(route.request().method()==='GET'&&!failed){failed=true;return route.abort();}return route.continue();
 });
 await page.route('**/api/agent/conversations/*/events?*',async route=>{
  streams++;
  if(streams===1){const after=Number(new URL(route.request().url()).searchParams.get('after'));return route.fulfill({status:200,contentType:'text/event-stream',body:`data: ${JSON.stringify({seq:after+2,type:'draft',value:{}})}\n\n`});}
  return route.continue();
 });
 await page.reload();
 await expect(page.getByRole('textbox',{name:'AI 输入'})).toHaveValue('持久恢复草稿',{timeout:10000});
 await expect.poll(()=>streams,{timeout:10000}).toBeGreaterThanOrEqual(2);
});

test('恢复回归: 断网期间另一设备保存后，干净草稿随重连同步',async({page,browser})=>{
 await register(page);await page.getByRole('button',{name:'新对话',exact:true}).click();
 await page.getByRole('textbox',{name:'AI 输入'}).fill('同步前草稿');await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();
 const other=await browser.newContext({ignoreHTTPSErrors:true});const second=await other.newPage();
 try {
  await second.goto(world.origin);await second.getByLabel('邮箱',{exact:true}).fill('c26@example.test');await second.getByLabel('密码',{exact:true}).fill('password-c26');await second.getByRole('button',{name:'登录',exact:true}).click();
  await expect(second.getByRole('textbox',{name:'AI 输入'})).toHaveValue('同步前草稿');
  await page.context().setOffline(true);world.disconnect();await expect(page.getByRole('alert')).toContainText('连接中断，正在恢复已保存内容');
  await second.getByRole('textbox',{name:'AI 输入'}).fill('另一设备的新草稿');await expect(second.getByText('草稿已保存',{exact:true})).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByRole('textbox',{name:'AI 输入'})).toHaveValue('另一设备的新草稿',{timeout:10000});
  await expect(page.getByText('连接中断，正在恢复已保存内容')).toHaveCount(0);
 } finally {await page.context().setOffline(false);await other.close();}
});

test('WB-AG-010: 已提交202丢失后原键重试，不清空下一条输入',async({page})=>{
 const {provider}=await import('../../../api/test/fixtures/c26/provider.js');
 const p=await provider([[{type:'text',text:'首轮完成'}]]);
 await world.close();world=await createIntegration({agent:p.config});await register(page);
 await page.getByRole('button',{name:'新对话',exact:true}).click();
 await page.getByRole('textbox',{name:'AI 输入'}).fill('第一条请求');await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();
 let lost=false;const keys=[];
 await page.route('**/api/agent/conversations/*/turns',async route=>{
  keys.push(route.request().headers()['idempotency-key']);
  if(!lost){lost=true;const response=await route.fetch();expect(response.status()).toBe(202);return route.abort();}return route.continue();
 });
 await page.getByRole('button',{name:'发送',exact:true}).click();await expect(page.getByRole('alert')).toContainText('发送尚未确认，请重试');
 await page.getByRole('textbox',{name:'AI 输入'}).fill('下一条尚未发送的问题');
 await page.getByRole('button',{name:'确认发送结果',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'AI 输入'})).toHaveValue('下一条尚未发送的问题');
 await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();
 expect(keys).toHaveLength(2);expect(keys[1]).toBe(keys[0]);expect(p.requests()).toBe(1);
 await expect(page.locator('.agent-message.is-user')).toHaveCount(1);
 await page.reload();await expect(page.getByRole('textbox',{name:'AI 输入'})).toHaveValue('下一条尚未发送的问题');
});

test('WB-AG-002/009: Agent写入不覆盖手工未保存题面，保存时可对照冲突',async({page})=>{
 const {provider}=await import('../../../api/test/fixtures/c26/provider.js');const {manualQuestionSample}=await import('../../../api/test/first-flow-harness.js');
 let question,pageId;
 const doc=text=>({version:1,blocks:[{type:'paragraph',runs:[{type:'text',text}]}]});
 const p=await provider([()=>[{type:'toolCall',id:'editor-update',name:'wb_update_question',arguments:{id:question.id,body:{baseVersion:1,title:question.title,body:doc('Agent已保存的题面'),solution:question.solution,note:'',starred:false}}}],[{type:'text',text:'已保存修改'}]]);
 await world.close();world=await createIntegration({agent:p.config});
 page.on('request',request=>{pageId=request.headers()['x-teachbuddy-page']??pageId;});await register(page);
 const response=await page.request.post(world.origin+'/api/modules/questions/items',{headers:{Origin:world.origin,'X-TeachBuddy-Request':'1','X-TeachBuddy-Page':pageId,'Idempotency-Key':crypto.randomUUID()},data:manualQuestionSample()});expect(response.status()).toBe(201);question=await response.json();
 await page.getByRole('button',{name:'新对话',exact:true}).click();await expect(page.getByRole('textbox',{name:'AI 输入'})).toBeVisible();
 await page.goto(world.origin+'/questions/'+question.id);await page.getByRole('textbox',{name:'题目标题',exact:true}).fill('老师正在输入而尚未保存的内容');
 await page.locator('.wb-ai-entry').click();await page.getByRole('textbox',{name:'AI 输入'}).fill('请把当前题面的保存版本改为Agent已保存的题面');await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.locator('.agent-tool[data-tool-state="confirmed"]')).toHaveCount(1);
 await expect(page.getByRole('textbox',{name:'题目标题',exact:true})).toHaveValue('老师正在输入而尚未保存的内容');
 await page.getByRole('button',{name:'保存题目',exact:true}).click();
 await expect(page.getByRole('region',{name:'版本冲突对照'})).toBeVisible();
 await page.getByText('服务器当前内容',{exact:true}).click();await expect(page.getByRole('region',{name:'版本冲突对照'})).toContainText('Agent已保存的题面');
 await expect(page.getByRole('textbox',{name:'题目标题',exact:true})).toHaveValue('老师正在输入而尚未保存的内容');
 await page.screenshot({path: `${evidence}/editor-agent-conflict.png`});
});
