import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../../api/test/fixtures/c26/harness.js';
const evidence = process.env.AGENT_EVIDENCE_DIR ?? 'test-results/evidence/C26/v1';
let world, directories;
async function startWorld(options) {
  const runtime = await createIntegration(options);
  directories.add(runtime.directory);
  return runtime;
}
test.beforeEach(async () => { directories = new Set(); fs.mkdirSync(evidence, { recursive: true }); world = await startWorld(); });
test.afterEach(async ({ context }, info) => {
  await context.close(); await world.close();
  if (info.status === info.expectedStatus) for (const directory of directories) fs.rmSync(directory, { recursive: true, force: true });
  else console.error('Agent浏览器失败现场保留：' + [...directories].join(', '));
});
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
  if (await page.getByRole('button', { name: '知道了', exact: true }).isVisible()) await page.getByRole('button', { name: '知道了', exact: true }).click();
}
test('WB-AG-001/004: 同一持久草稿从首页到右栏再刷新', async ({ page }) => {
  await register(page);
  await page.locator('.tbx-composer.is-placeholder').click();
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('请帮我准备等差数列的课堂练习');
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
  await page.getByRole('button', {name:'打开 AI 助理', exact:true}).click();
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('请帮我准备等差数列的课堂练习');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('请帮我准备等差数列的课堂练习');
  await page.screenshot({ path: `${evidence}/desktop-draft.png` });
});

for (const tag of ['deepseek','glm']) test(`WB-AG-003/007: ${tag} live模型结果保留库重启，桌面Pad窄屏打开实际题目`,async({page})=>{
 const reportPath = path.join(evidence, `live-${tag}.json`);
 test.skip(!fs.existsSync(reportPath), `缺少授权真实模型报告 ${reportPath}；获取步骤见 docs/acceptance/README.md 的 Agent 真实模型保留库`);
 const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
 test.skip(!report.directory || !fs.existsSync(path.join(report.directory, 'workspace.sqlite')), '报告对应的隔离数据库缺失，请按验收入口准备同一候选的报告和数据库');
 expect(report.kind).toBe('live'); expect(report.status).toBe('completed');
 await world.close();
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),`c26-browser-live-${tag}-`));fs.cpSync(report.directory,directory,{recursive:true});
 world=await startWorld({directory});
 await page.goto(world.origin);await page.getByLabel('邮箱',{exact:true}).fill(`c26-${tag}@example.test`);await page.getByLabel('密码',{exact:true}).fill('c26-live-local-password');await page.getByRole('button',{name:'登录',exact:true}).click();
 await expect(page.locator('.agent-tool')).toHaveCount(6);await expect(page.locator('.tbx-msg.is-assistant').last()).toBeVisible();
 await page.screenshot({path:`${evidence}/${tag}-home-desktop.png`});
 for(const [width,height,name]of [[1440,900,'desktop'],[820,1180,'pad'],[390,844,'mobile']]){
  await page.setViewportSize({width,height});
  if (width <= 1080) {
   await expect(page.locator('.tb-sidebar')).toBeHidden();
   await page.getByRole('button',{name:'打开工作台导航',exact:true}).click();
   await expect(page.locator('.tb-sidebar')).toBeVisible();
   expect(await page.locator('.tb-sidebar').evaluate(el=>el.getBoundingClientRect().width)).toBeLessThan(width);
   await page.locator('.tb-sidebar').getByRole('button',{name:'关闭',exact:true}).click();
  } else await expect.poll(()=>page.locator('.tb-sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width))).toBe(256);
  await expect(page.locator('.agent-tool')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect.poll(()=>page.locator('.tbx-thread-area').evaluate(el=>{const frame=el.getBoundingClientRect();return [...el.querySelectorAll('.agent-tool,.tbx-msg')].filter(item=>{const box=item.getBoundingClientRect();return box.left<frame.left-1||box.right>frame.right+1;}).map(item=>({width:el.clientWidth,display:getComputedStyle(el).display,left:item.getBoundingClientRect().left-frame.left,right:item.getBoundingClientRect().right-frame.right}));})).toEqual([]);
  await page.screenshot({path:`${evidence}/${tag}-home-${name}.png`});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.agent-tool[data-tool-state="confirmed"]').first().getByRole('button',{name:/打开题目/}).click();
 await expect(page).toHaveURL(/\/questions\//);
 await expect(page.getByText(`数列进阶-${tag}`,{exact:true}).first()).toBeVisible();
 await page.screenshot({path:`${evidence}/${tag}-copy-open.png`});
 await page.getByRole('button', {name:'打开 AI 助理', exact:true}).click();
 await expect(page.locator('.agent-tool')).toHaveCount(6);
});

test('WB-AG-005: 独立浏览器草稿冲突保留双方内容，明确选择后保存',async({page,browser})=>{
 await register(page);await page.locator('.tbx-composer.is-placeholder').click();
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
 await world.close();world=await startWorld({agent:p.config});
 await register(page);await page.locator('.tbx-composer.is-placeholder').click();await page.getByRole('textbox',{name:'AI 输入'}).fill('读取这道题');
 await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.locator('.agent-tool[data-tool-state="rejected"]')).toHaveCount(1);
 await expect(page.locator('.tbx-msg:not(.is-user)')).toHaveCount(0);
 await page.reload();await expect(page.locator('.agent-tool[data-tool-state="rejected"]')).toHaveCount(1);expect(p.requests()).toBe(1);
 await page.screenshot({path: `${evidence}/read-failure-restored.png`});
 await page.locator('.tbx-thread.is-active').getByRole('button',{name:'对话选项',exact:true}).click();await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(page.locator('.tbx-thread.is-active').getByRole('button',{name:'对话选项',exact:true})).toBeFocused();
});

test('恢复回归: 首次snapshot失败后恢复输入，事件缺号后重新建立SSE',async({page})=>{
 await register(page);await page.locator('.tbx-composer.is-placeholder').click();
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
 await register(page);await page.locator('.tbx-composer.is-placeholder').click();
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
 await world.close();world=await startWorld({agent:p.config});await register(page);
 await page.locator('.tbx-composer.is-placeholder').click();
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
 await expect(page.locator('.tbx-msg.is-user')).toHaveCount(1);
 await page.reload();await expect(page.getByRole('textbox',{name:'AI 输入'})).toHaveValue('下一条尚未发送的问题');
});

test('WB-AG-002/009: Agent写入不覆盖手工未保存题面，保存时可对照冲突',async({page})=>{
 const {provider}=await import('../../../api/test/fixtures/c26/provider.js');const {manualQuestionSample}=await import('../../../api/test/first-flow-harness.js');
 let question,pageId;
 const doc=text=>({version:1,blocks:[{type:'paragraph',runs:[{type:'text',text}]}]});
 const p=await provider([()=>[{type:'toolCall',id:'editor-update',name:'wb_update_question',arguments:{id:question.id,body:{baseVersion:1,title:question.title,body:doc('Agent已保存的题面'),solution:question.solution,note:'',starred:false}}}],[{type:'text',text:'已保存修改'}]]);
 await world.close();world=await startWorld({agent:p.config});
 page.on('request',request=>{pageId=request.headers()['x-teachbuddy-page']??pageId;});await register(page);
 const response=await page.request.post(world.origin+'/api/modules/questions/items',{headers:{Origin:world.origin,'X-TeachBuddy-Request':'1','X-TeachBuddy-Page':pageId,'Idempotency-Key':crypto.randomUUID()},data:manualQuestionSample()});expect(response.status()).toBe(201);question=await response.json();
 await page.locator('.tbx-composer.is-placeholder').click();await expect(page.getByRole('textbox',{name:'AI 输入'})).toBeVisible();
 await page.goto(world.origin+'/questions/'+question.id);await page.getByRole('button',{name:'编辑题目',exact:true}).click();await page.getByRole('textbox',{name:'题目标题',exact:true}).fill('老师正在输入而尚未保存的内容');
 await page.getByRole('button', {name:'打开 AI 助理', exact:true}).click();
 await expect(page.getByRole('textbox',{name:'题目标题',exact:true})).toHaveValue('老师正在输入而尚未保存的内容');
 await page.getByRole('textbox',{name:'AI 输入'}).fill('请把当前题面的保存版本改为Agent已保存的题面');await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.locator('.agent-tool[data-tool-state="confirmed"]')).toHaveCount(1);
 await expect(page.getByRole('textbox',{name:'题目标题',exact:true})).toHaveValue('老师正在输入而尚未保存的内容');
 await page.getByRole('button',{name:'保存题目',exact:true}).click();
 await expect(page.getByRole('region',{name:'版本冲突对照'})).toBeVisible();
 await page.getByText('服务器当前内容',{exact:true}).click();await expect(page.getByRole('region',{name:'版本冲突对照'})).toContainText('Agent已保存的题面');
 await expect(page.getByRole('textbox',{name:'题目标题',exact:true})).toHaveValue('老师正在输入而尚未保存的内容');
 await page.screenshot({path: `${evidence}/editor-agent-conflict.png`});
});

test('WB-AG-013/017: 真实流停止后刷新保留输入且不重新请求模型', async ({ page }) => {
  const { provider } = await import('../../../api/test/fixtures/c26/provider.js');
  const model = await provider([async (_context, options) => {
    await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }));
    throw new Error('controlled stop');
  }]);
  await world.close(); world = await startWorld({ agent: model.config });
  await register(page);
  await page.locator('.tbx-composer.is-placeholder').click();
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('保留这次课堂备课请求');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect.poll(() => model.requests()).toBe(1);
  await page.getByRole('button', { name: '停止', exact: true }).click();
  await expect(page.locator('.tbx-divider')).toHaveText('已停止');
  await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.tbx-msg.is-user')).toHaveText('保留这次课堂备课请求');
  await expect(page.locator('.tbx-divider')).toHaveText('已停止');
  expect(model.requests()).toBe(1);
});

test('WB-AG-012/023: 引用真实题目后写入待确认，从结果卡核实原操作并打开副本', async ({ page }) => {
  const { provider } = await import('../../../api/test/fixtures/c26/provider.js');
  const { manualQuestionSample, variantCopySample } = await import('../../../api/test/first-flow-harness.js');
  let source, pageId;
  const model = await provider([() => [{ type: 'toolCall', id: 'copy-unconfirmed-ui', name: 'wb_copy_question', arguments: { id: source.id, body: variantCopySample(1) } }]]);
  await world.close(); world = await startWorld({ agent: model.config });
  page.on('request', request => { pageId = request.headers()['x-teachbuddy-page'] ?? pageId; });
  await register(page);
  const response = await page.request.post(world.origin + '/api/modules/questions/items', {
    headers: { Origin: world.origin, 'X-TeachBuddy-Request': '1', 'X-TeachBuddy-Page': pageId, 'Idempotency-Key': crypto.randomUUID() },
    data: manualQuestionSample({ title: '待改编的课堂例题' }),
  });
  expect(response.status()).toBe(201); source = await response.json();
  await page.locator('.tbx-composer.is-placeholder').click();
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('@待改编');
  await page.getByRole('option', { name: '待改编的课堂例题', exact: true }).click();
  await expect(page.locator('.tbx-drawer')).toContainText('待改编的课堂例题');
  await page.getByRole('textbox', { name: 'AI 输入' }).fill('基于引用复制一道变式题');
  world.workbench.db.exec(`CREATE TRIGGER c26_ui_lose_confirmation BEFORE UPDATE ON agent_conversations WHEN NEW.document LIKE '%"state":"confirmed"%' BEGIN SELECT RAISE(ABORT,'injected journal failure'); END;`);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.agent-tool[data-tool-state="unconfirmed"]')).toHaveCount(1);
  await expect(page.locator('.tbx-msg.is-user .tbx-chip')).toContainText('待改编的课堂例题');
  world.workbench.db.exec('DROP TRIGGER c26_ui_lose_confirmation');
  await page.getByRole('button', { name: '确认结果', exact: true }).click();
  const card = page.locator('.agent-tool[data-tool-state="confirmed"]');
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: /打开题目/ }).click();
  await expect(page).toHaveURL(/\/questions\//);
  await expect(page.locator('.q-question-title')).toContainText('二次函数变式');
  expect(model.requests()).toBe(1);
  await page.reload();
  await expect(page.locator('.q-question-title')).toContainText('二次函数变式');
});

test('示例练习卡保存回执丢失后刷新重试，同题同键且最终只保存九题', async ({ page }) => {
  let pageId;
  page.on('request', request => { pageId = request.headers()['x-teachbuddy-page'] ?? pageId; });
  await register(page);
  const next = new Date(); next.setDate(next.getDate() + 1);
  const response = await page.request.post(world.origin + '/api/modules/schedule/entries', {
    headers: { Origin: world.origin, 'X-TeachBuddy-Request': '1', 'X-TeachBuddy-Page': pageId, 'Idempotency-Key': crypto.randomUUID() },
    data: { title: '分数加减法数学课', items: [], time: { date: next.toISOString().slice(0, 10), startTime: '10:00', durationMinutes: 45, timeZone: 'UTC' }, repeat: null, reminder: null, calendar: { allDay: false, notes: '', tags: [] } },
  });
  expect(response.status()).toBe(201);
  await page.reload();
  await page.getByRole('button', { name: '哪节课', exact: true }).click();
  await page.getByRole('option', { name: /分数加减法数学课/ }).click();
  await page.locator('.tbx-suggestion').filter({ hasText: '设计一组分层作业' }).click();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  const save = () => page.getByRole('button', { name: '存进题库 · 9 道', exact: true });
  await expect(save()).toBeVisible({ timeout: 15000 });
  const keys = [];
  let lost = false;
  await page.route('**/api/modules/questions/v2/items', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']);
    if (!lost) { lost = true; const reply = await route.fetch(); expect(reply.status()).toBe(201); return route.abort(); }
    return route.continue();
  });
  await save().click();
  await expect(page.getByRole('button', { name: '没成功，再试一次', exact: true })).toBeVisible();
  await page.reload();
  await save().click();
  await expect(page.getByRole('button', { name: /已存进题库/ })).toBeVisible();
  expect(keys).toHaveLength(10);
  expect(keys[1]).toBe(keys[0]);
  await page.getByRole('button', { name: /已存进题库/ }).click();
  await expect(page).toHaveURL(/\/questions$/);
  const read = await page.request.get(world.origin + '/api/modules/questions/v2/items', { headers: { 'X-TeachBuddy-Page': pageId } });
  expect(read.status()).toBe(200);
  expect((await read.json()).items).toHaveLength(9);
});

test('全站示例载入：上传回执丢失后刷新接续，保留已有分类且无重复，真实成绩可统计', async ({ page }) => {
  test.setTimeout(120000);
  let pageId;
  page.on('request', request => { pageId = request.headers()['x-teachbuddy-page'] ?? pageId; });
  await register(page);
  const header = () => ({ Origin: world.origin, 'X-TeachBuddy-Request': '1', 'X-TeachBuddy-Page': pageId, 'Idempotency-Key': crypto.randomUUID() });
  const userType = { id: crypto.randomUUID(), name: '老师已有题型' };
  const userTag = { id: crypto.randomUUID(), name: '二次函数' };
  const userFolder = { id: crypto.randomUUID(), name: '课件', parentId: null };
  for (const [path, body] of [
    ['/api/modules/questions/v2/taxonomy', { baseVersion: 1, types: [userType], tags: [userTag] }],
    ['/api/modules/resources/taxonomy', { baseVersion: 1, folders: [userFolder], tags: [userTag] }],
  ]) {
    const response = await page.request.put(world.origin + path, { headers: header(), data: body });
    expect(response.status()).toBe(200);
  }
  const uploadKeys = []; let lost = false;
  await page.route('**/api/workbench/files', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    uploadKeys.push(route.request().headers()['idempotency-key']);
    if (!lost) { lost = true; const reply = await route.fetch(); expect(reply.status()).toBe(201); return route.abort(); }
    return route.continue();
  });
  const seed = () => page.getByRole('button', { name: '载入一周的示例数据', exact: true });
  await seed().click();
  await expect(page.getByText('载入没有完成，请再试一次。', { exact: false })).toBeVisible();
  await page.reload(); await seed().click();
  await expect(page.getByText('示例数据已就绪：7 道题、4 份资料和一周的课表。', { exact: false })).toBeVisible({ timeout: 90000 });
  expect(uploadKeys[1]).toBe(uploadKeys[0]);
  async function read(path) {
    const reply = await page.request.get(world.origin + path, { headers: { 'X-TeachBuddy-Page': pageId } });
    expect(reply.status()).toBe(200); return reply.json();
  }
  const qtax = await read('/api/modules/questions/v2/taxonomy');
  expect(qtax.types).toContainEqual(userType); expect(qtax.tags).toContainEqual(userTag);
  const rtax = await read('/api/modules/resources/taxonomy');
  expect(rtax.folders).toContainEqual(userFolder); expect(rtax.tags).toContainEqual(userTag);
  const counts = async () => {
    const paths = ['/api/modules/questions/v2/items', '/api/modules/schedule/entries', '/api/modules/resources/items', '/api/modules/math/v1/works', '/api/modules/classroom/classes', '/api/modules/classroom/exams'];
    const sizes = await Promise.all(paths.map(async path => (await read(path)).items.length));
    const classes = (await read('/api/modules/classroom/classes')).items;
    const results = await Promise.all(classes.map(async cls => (await read(`/api/modules/classroom/results?classId=${cls.id}`)).items.length));
    return [...sizes, results.reduce((sum, count) => sum + count, 0)];
  };
  expect(await counts()).toEqual([7, 15, 4, 5, 2, 3, 5]);
  const cls = (await read('/api/modules/classroom/classes')).items[0];
  const statistics = await read(`/api/modules/classroom/classes/${cls.id}/statistics`);
  expect(statistics.points.length).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.endsWith(':sample-seeded')) localStorage.removeItem(key); });
  await page.reload(); await seed().click();
  await expect(page.getByRole('button', { name: '去题库', exact: true })).toBeVisible({ timeout: 30000 });
  expect(await counts()).toEqual([7, 15, 4, 5, 2, 3, 5]);
  await page.getByRole('button', { name: '去题库', exact: true }).click();
  await expect(page).toHaveURL(/\/questions$/);
});
