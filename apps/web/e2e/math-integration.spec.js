import { pathToFileURL } from 'node:url';
import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
const evidence=path.resolve(process.env.MATH_INTEGRATION_EVIDENCE || 'test-results/math-integration/evidence');
fs.mkdirSync(evidence,{recursive:true});
let world;
test.afterEach(async({context})=>{await context.close();await world?.close();});
async function registerPage(page) {
 world=await createIntegration();
 await page.goto(world.origin);
 await page.getByRole('button',{name:'创建账户'}).click();
 await page.getByLabel('昵称',{exact:true}).fill('数学集成老师');
 await page.getByLabel('邮箱',{exact:true}).fill('m43@example.test');
 await page.getByLabel('密码',{exact:true}).fill('math-integration-password');
 await page.getByLabel('确认密码',{exact:true}).fill('math-integration-password');
 await page.getByRole('button',{name:'发送验证码'}).click();
 await expect.poll(()=>world.mailer.lastCode('registration','m43@example.test')).toBeTruthy();
 await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration','m43@example.test'));
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'注册',exact:true}).click();
 await expect(page.locator('.wb-shell')).toBeVisible();
}
test('real-auth: specified lesson section -> saved formula -> v3 return keeps draft and AI',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await registerPage(page);
 await page.locator('.wb-sidebar').getByRole('link',{name:'备课',exact:true}).click();
 await page.getByRole('button',{name:'新建备课',exact:true}).click();
 await page.getByLabel('课题',{exact:true}).fill('二次函数往返课');
 await page.getByRole('button',{name:'添加环节',exact:true}).click();
 await page.getByLabel('环节名称 1').fill('探究判别式');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByLabel('课题',{exact:true}).fill('二次函数未提交现场');
 await page.locator('.wb-topbar').getByRole('button',{name:'AI 助理',exact:true}).click();
 await page.getByRole('button',{name:'新对话',exact:true}).click();
 await page.getByLabel('AI 输入').fill('保留判别式讲解草稿，不发送');
 await page.locator('[data-section-id]').getByRole('button',{name:'制作数学作品',exact:true}).click();
 await expect(page.locator('.math-workbench')).toBeVisible();
 await page.getByRole('button',{name:'新建公式',exact:true}).click();
 await page.getByLabel('作品名称').fill('判别式公式');
 await page.getByLabel('LaTeX',{exact:true}).fill('x_{1,2}=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await expect(page.getByAltText('当前公式预览',{exact:true})).toBeVisible();
 await page.screenshot({path:path.join(evidence,'formula-before-return.png')});
 await downloadWork(page,'png','formula.png');
 await page.getByRole('button',{name:'带回备课',exact:true}).click();
 await expect(page.getByLabel('AI 输入')).toHaveValue('保留判别式讲解草稿，不发送');
 await expect(page.getByLabel('课题',{exact:true})).toHaveValue('二次函数未提交现场');
 await expect(page.locator('[data-reference-id]')).toHaveCount(1);
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.screenshot({path:path.join(evidence,'lesson-return.png')});
 await page.reload();await expect(page.locator('[data-reference-id]')).toHaveCount(1);
 await page.getByLabel('本课备注 判别式公式').fill('不得出现在学生输出中的私密备注');
 await page.getByRole('button',{name:'输出',exact:true}).click();
 for (const format of ['docx','pdf']) {
   await page.getByRole('combobox',{name:'格式',exact:true}).selectOption(format);
   await page.getByRole('button',{name:'保存并生成',exact:true}).click();
   const row=page.locator('.r34-output-list article').first();
   await expect(row.getByRole('button',{name:'下载',exact:true})).toBeVisible({timeout:60000});
   const event=page.waitForEvent('download');await row.getByRole('button',{name:'下载',exact:true}).click();
   await (await event).saveAs(path.join(evidence,`math-lesson.${format}`));
 }
 await page.getByRole('button',{name:'返回文稿',exact:true}).click();
 const lessonUrl=page.url();
 await page.getByRole('button',{name:'另存作品并替换本处',exact:true}).click();
 await expect(page.getByRole('button',{name:'带回备课',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'另存作品',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByLabel('作品名称').fill('本课独立判别式');
 await page.getByLabel('LaTeX',{exact:true}).fill('b^2-4ac');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 const requests=[];
 await page.route('**/api/modules/lessons/v3/*',async route=>{
   if(route.request().method()!=='PUT'){await route.continue();return;}
   const r=route.request();requests.push({key:r.headers()['idempotency-key'],body:r.postData(),url:r.url()});
   if(requests.length===1){await route.fetch();await route.abort('failed');}else await route.continue();
 });
 await page.getByRole('button',{name:'带回备课',exact:true}).click();
 await expect(page.getByRole('button',{name:'重试确认',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'重试确认',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0]);
 await page.unroute('**/api/modules/lessons/v3/*');
 await expect(page.locator('[data-reference-id]')).toHaveCount(1);
 await expect(page.getByLabel('本课备注 本课独立判别式')).toHaveValue('不得出现在学生输出中的私密备注');
 await page.locator('.wb-sidebar').getByRole('link',{name:'班级教学',exact:true}).click();
 await page.getByRole('button',{name:'新建班级',exact:true}).click();
 await page.getByLabel('班级名称',{exact:true}).fill('高一数学一班');
 await page.getByRole('button',{name:'创建',exact:true}).click();
 await page.getByLabel('写一句',{exact:true}).fill('判别式符号还需再练');
 await page.getByRole('button',{name:'补充',exact:true}).click();
 await page.getByRole('button',{name:'关联资料',exact:true}).click();
 const picker=page.getByRole('dialog',{name:'关联资料',exact:true});
 await picker.getByRole('tab',{name:'数学作品',exact:true}).click();
 await picker.getByRole('button',{name:/本课独立判别式/}).click();
 await picker.getByRole('button',{name:'确定',exact:true}).click();
 await page.locator('[data-region="record-composer"]').getByRole('button',{name:'保存',exact:true}).click();
 const record=page.locator('[data-record-id]').first();
 await expect(record).toContainText('判别式符号还需再练');
 await record.getByRole('button',{name:'本课独立判别式',exact:true}).click();
 await expect(page.getByLabel('作品名称')).toHaveValue('本课独立判别式');
 await page.locator('summary').filter({hasText:'使用位置与教学反馈'}).click();
 await expect(page.locator('.math-integration')).toContainText('判别式符号还需再练');
 await page.screenshot({path:path.join(evidence,'real-teaching-feedback.png')});
 await page.getByRole('button',{name:'返回教学记录',exact:true}).click();
 await expect(record).toContainText('判别式符号还需再练');
 fs.writeFileSync(path.join(evidence,'unknown-return.json'),JSON.stringify({lessonUrl,requests,confirmed:true},null,2));
 expect(errors).toEqual([]);
 fs.writeFileSync(path.join(evidence,'roundtrip.json'),JSON.stringify({origin:world.origin,directory:world.directory,identity:'real-auth',pageErrors:errors},null,2));
});

async function downloadWork(page, format, name) {
 await page.getByLabel('导出格式').selectOption(format);
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'下载',exact:true}).click();
 const target=path.join(evidence,name);await (await event).saveAs(target);return target;
}
test('real-auth: dynamic and exact external HTML final downloads cold start with service stopped and network disabled',async({page})=>{
 await registerPage(page);

 await page.locator('.wb-sidebar').getByRole('link',{name:'数学工坊',exact:true}).click();
 await page.getByRole('button',{name:'新建演示',exact:true}).first().click();
    await page.getByRole('button', {name:'作品与工具',exact:true}).click();
    await page.getByRole('button', {name:'二次函数起点',exact:true}).click();
 await page.getByLabel('作品名称').fill('离线参数函数');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByRole('button',{name:'带系数完整式',exact:true}).click();
 await expect(page.locator('.math-dynamic svg')).toContainText('y=-2(x-(0))²+(1)');
 const dynamic=await downloadWork(page,'html','dynamic.html');
 await page.getByLabel('导入 HTML 文件').setInputFiles(path.resolve('apps/web/e2e/fixtures/math-dynamic/mx-model-revised.html'));
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByRole('button',{name:'编辑源码',exact:true}).click();
 const original=await page.getByLabel('HTML 源码').inputValue();
 await page.getByLabel('HTML 源码').fill(original.replace(/正比例函数斜率探究/g,'M43 课堂探究').replace('min="-8"','min="-10"'));
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 const external=await downloadWork(page,'html','external.html');
 const source=await downloadWork(page,'source','external-source.html');
 expect(fs.readFileSync(source,'utf8')).toContain('M43 课堂探究');
 const origin=world.origin;await world.close();world=null;
 const coldBrowser=await chromium.launch();
 const cold=await coldBrowser.newContext({offline:true});
 const viewer=await cold.newPage();const requests=[];viewer.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 try {
 await viewer.goto(pathToFileURL(dynamic).href);const frame=viewer.frameLocator('iframe');
 await expect(frame.locator('svg')).toBeVisible();
 await frame.getByRole('button',{name:'带系数完整式',exact:true}).click();
 await expect(frame.locator('svg')).toContainText('y=-2(x-(0))²+(1)');
 await frame.getByLabel('a 滑杆',{exact:true}).focus();await viewer.keyboard.press('Home');
 await expect(frame.getByLabel('a 数值',{exact:true})).toHaveValue('-3');
 await viewer.keyboard.press('End');await expect(frame.getByLabel('a 数值',{exact:true})).toHaveValue('3');
 const dot=frame.locator('[data-object="P"] circle');const box=await dot.boundingBox();
 await viewer.mouse.move(box.x+box.width/2,box.y+box.height/2);await viewer.mouse.down();await viewer.mouse.move(box.x+80,box.y-30,{steps:10});await viewer.mouse.up();
 await expect(frame.getByLabel('h 数值',{exact:true})).not.toHaveValue('0');
 await frame.getByRole('button',{name:'重置',exact:true}).click();await expect(frame.getByLabel('h 数值',{exact:true})).toHaveValue('0');
 await viewer.screenshot({path:path.join(evidence,'dynamic-offline.png')});
 await viewer.goto(pathToFileURL(external).href);const html=viewer.frameLocator('iframe');
 await expect(html.locator('svg,canvas').first()).toBeVisible();
 await html.getByLabel('正比例函数系数 k').focus();await viewer.keyboard.press('Home');await expect(html.locator('#eq')).toHaveText('y = -10x');
 await viewer.keyboard.press('End');await expect(html.locator('#eq')).toHaveText('y = 8x');
 await viewer.screenshot({path:path.join(evidence,'external-offline.png')});
 expect(requests).toEqual([]);
 fs.writeFileSync(path.join(evidence,'offline.json'),JSON.stringify({origin,serviceStopped:true,newBrowser:true,offline:true,browser:await coldBrowser.version(),platform:process.platform,requests,dynamic,external},null,2));
 }finally{await cold.close();await coldBrowser.close();}
});

test('real-auth: unsaved new section survives the workshop return',async({page})=>{
 await registerPage(page);
 await page.locator('.wb-sidebar').getByRole('link',{name:'备课',exact:true}).click();
 await page.getByRole('button',{name:'新建备课',exact:true}).click();
 await page.getByLabel('课题',{exact:true}).fill('新增环节现场');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByRole('button',{name:'添加环节',exact:true}).click();
 await page.getByLabel('环节名称 1').fill('未保存的新环节');
 await page.locator('[data-section-id]').getByRole('button',{name:'制作数学作品',exact:true}).click();
 await page.getByRole('button',{name:'新建公式',exact:true}).click();
 await page.getByLabel('作品名称').fill('新环节公式');
 await page.getByLabel('LaTeX',{exact:true}).fill('a^2+b^2=c^2');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByRole('button',{name:'带回备课',exact:true}).click();
 await expect(page.locator('[data-reference-id]')).toHaveCount(1);
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await expect(page.getByLabel('环节名称 1')).toHaveValue('未保存的新环节');
});

test('real-auth: rejected second save can cancel, reuse, and retry an independent replacement',async({page})=>{
 await registerPage(page);
 await page.locator('.wb-sidebar').getByRole('link',{name:'备课',exact:true}).click();
 await page.getByRole('button',{name:'新建备课',exact:true}).click();
 await page.getByLabel('课题',{exact:true}).fill('明确失败恢复');
 await page.getByRole('button',{name:'添加环节',exact:true}).click();
 await page.getByLabel('环节名称 1').fill('推导');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.locator('[data-section-id]').getByRole('button',{name:'制作数学作品',exact:true}).click();
 await page.getByRole('button',{name:'新建公式',exact:true}).click();
 await page.getByLabel('作品名称').fill('可复用公式');
 await page.getByLabel('LaTeX',{exact:true}).fill('a^2+b^2=c^2');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 async function refuseNextSave(){
  let refused=false;
  await page.route('**/api/modules/lessons/v3/*',async route=>{
   if(route.request().method()==='PUT'&&!refused){refused=true;await route.fulfill({status:422,contentType:'application/problem+json',body:JSON.stringify({type:'/problems/workbench/invalid-input',field:'/title',reason:'required'})});}
   else await route.continue();
  });
 }
 await refuseNextSave();
 await page.getByRole('button',{name:'带回备课',exact:true}).click();
 await expect(page.locator('[data-reference-id]')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'取消带回',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'取消带回',exact:true}).click();
 await expect(page.locator('[data-reference-id]')).toHaveCount(0);
 await page.unroute('**/api/modules/lessons/v3/*');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.reload();await expect(page.locator('[data-reference-id]')).toHaveCount(0);
 await page.locator('[data-section-id]').getByRole('button',{name:'制作数学作品',exact:true}).click();
 await expect(page.getByLabel('作品名称')).toHaveValue('可复用公式');
 await page.getByRole('button',{name:'带回备课',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByRole('button',{name:'再放一次',exact:true}).first().click();
 await page.getByRole('button',{name:'再放一次',exact:true}).first().click();
 const beforeIds=await page.locator('[data-reference-id]').evaluateAll(rows=>rows.map(r=>r.dataset.referenceId));
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.locator('[data-reference-id]').nth(1).getByRole('button',{name:'另存作品并替换本处',exact:true}).click();
 await page.getByRole('button',{name:'另存作品',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByLabel('作品名称').fill('独立替换稿');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await refuseNextSave();
 await page.getByRole('button',{name:'带回备课',exact:true}).click();
 await expect(page.getByRole('button',{name:'确认带回',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'确认带回',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await expect(page.locator('[data-reference-id]')).toHaveCount(3);
 await expect(page.locator('[data-reference-id]').nth(1)).toContainText('独立替换稿');
 const afterIds=await page.locator('[data-reference-id]').evaluateAll(rows=>rows.map(r=>r.dataset.referenceId));
 expect(afterIds[0]).toBe(beforeIds[0]);expect(afterIds[2]).toBe(beforeIds[2]);
 await page.screenshot({path:path.join(evidence,'replacement-recovered.png')});
});

test('real-auth: an old v2 unknown request confirms on its original path after the UI upgrade',async({page})=>{
 await registerPage(page);
 await page.locator('.wb-sidebar').getByRole('link',{name:'备课',exact:true}).click();
 await page.getByRole('button',{name:'新建备课',exact:true}).click();
 await page.getByLabel('课题',{exact:true}).fill('旧客户端待确认');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 const id=page.url().split('/').at(-1);const oldPath=`/api/modules/lessons/v2/items/${id}`;
 let committed;
 await page.route(`**/api/modules/lessons/v3/${id}`,async route=>{
  if(route.request().method()!=='PUT'){await route.continue();return;}
  const response=await route.fetch({url:world.origin+oldPath});expect(response.status()).toBe(200);
  committed={key:route.request().headers()['idempotency-key'],body:route.request().postData()};
  await route.abort('failed');
 });
 await page.getByLabel('课题',{exact:true}).fill('旧请求已写入但响应丢失');
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('button',{name:'重试确认',exact:true})).toBeVisible();
 // A persisted pre-v3 draft has no apiVersion field. The payload/key are the
 // actual request accepted above, not a fabricated success response.
 await page.evaluate(id=>{
  const key=Object.keys(localStorage).find(k=>k.endsWith(`:draft:lesson:${id}`));
  const draft=JSON.parse(localStorage.getItem(key));delete draft.pending.apiVersion;localStorage.setItem(key,JSON.stringify(draft));
 },id);
 await page.unroute(`**/api/modules/lessons/v3/${id}`);
 await page.reload();
 const replay=page.waitForRequest(r=>r.method()==='PUT'&&new URL(r.url()).pathname===oldPath);
 await page.getByRole('button',{name:'重试确认',exact:true}).click();
 const sent=await replay;expect(sent.headers()['idempotency-key']).toBe(committed.key);expect(sent.postData()).toBe(committed.body);
 await expect(page.getByRole('status').first()).toContainText('已保存');
 await expect(page.getByLabel('课题',{exact:true})).toHaveValue('旧请求已写入但响应丢失');
 fs.writeFileSync(path.join(evidence,'old-request-confirmed.json'),JSON.stringify({oldPath,id,fixture:'actual v2 commit plus pre-v3 pending shape',confirmed:true},null,2));
});

test('real-auth: scroll and selected section survive; a concurrent removal requires explicit retargeting',async({page})=>{
 await registerPage(page);
 await page.locator('.wb-sidebar').getByRole('link',{name:'备课',exact:true}).click();
 await page.getByRole('button',{name:'新建备课',exact:true}).click();
 await page.getByLabel('课题',{exact:true}).fill('长课现场');
 for(let i=1;i<=8;i++) {await page.getByRole('button',{name:'添加环节',exact:true}).click();await page.getByLabel(`环节名称 ${i}`,{exact:true}).fill(`环节${i}`);}
 await page.getByRole('button',{name:'保存',exact:true}).click();
 await expect(page.getByRole('status').first()).toContainText('已保存');
 const id=page.url().split('/').at(-1);
 await page.getByLabel('课题',{exact:true}).fill('长课未提交现场');
 const target=page.locator('[data-section-id]').last();
 const sectionId=await target.getAttribute('data-section-id');
 await target.getByRole('button',{name:'制作数学作品',exact:true}).scrollIntoViewIfNeeded();
 const scroll=await page.locator('.wb-lesson-scroll').evaluate(e=>e.scrollTop);expect(scroll).toBeGreaterThan(0);
 await target.getByRole('button',{name:'制作数学作品',exact:true}).click();
 await page.getByRole('button',{name:'新建公式',exact:true}).click();await page.getByLabel('作品名称').fill('末环节公式');await page.getByLabel('LaTeX',{exact:true}).fill('a+b');
 await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('已保存');
 await page.getByRole('button',{name:'带回备课',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('已保存');
 await expect(page.locator(`[data-section-id="${sectionId}"] [data-reference-id]`)).toHaveCount(1);
 const restored=await page.locator('.wb-lesson-scroll').evaluate(e=>e.scrollTop);expect(Math.abs(restored-scroll)).toBeLessThan(50);
 await expect(page.getByLabel('课题',{exact:true})).toHaveValue('长课未提交现场');
 await target.getByRole('button',{name:'制作数学作品',exact:true}).click();
 // A concurrent writer uses the real public lesson operation on the same DB.
 const principal={accountKey:world.workbench.db.prepare('SELECT accountKey FROM auth_accounts WHERE email=?').get('m43@example.test').accountKey};
 const operations=world.workbench.loader.get('lessons').port.operations;
 const saved=(await operations.getLessonV3({principal,id})).body;
 const {buildUpdateLessonPayload,lessonInputFrom}=await import('../src/features/lessons/model.js');
 const input=lessonInputFrom(saved);input.sections=input.sections.filter(s=>s.id!==sectionId);
 await operations.updateLessonV3({principal,id,key:crypto.randomUUID(),input:buildUpdateLessonPayload(input,saved)});
 await page.getByRole('button',{name:'带回备课',exact:true}).click();
 await expect(page.locator('[data-region="conflict"]')).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'采用服务器版本',exact:true}).click();
 await page.getByRole('button',{name:'确认带回',exact:true}).click();
 await expect(page.getByText('目标环节已删除，请明确选择本课材料或取消带回',{exact:true})).toBeVisible();
 await expect(page.locator('[data-reference-id]')).toHaveCount(0);
 await page.getByRole('button',{name:'放入本课材料',exact:true}).click();await expect(page.getByRole('status').first()).toContainText('已保存');
 await expect(page.locator('[data-reference-id]')).toHaveCount(1);
 fs.writeFileSync(path.join(evidence,'scene-conflict.json'),JSON.stringify({id,sectionId,scroll,restored,concurrentWriter:'real lessons port',explicitRetarget:true},null,2));
});
