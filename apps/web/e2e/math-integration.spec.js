import { pathToFileURL } from 'node:url';
import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
let world, directory, evidence;
test.beforeEach(async({},testInfo)=>{
 evidence=testInfo.outputPath('evidence');
 fs.mkdirSync(evidence,{recursive:true});
});
test.afterEach(async({context}, info)=>{
 await context.close();await world?.close();world=null;
 if(info.status===info.expectedStatus) fs.rmSync(directory,{recursive:true,force:true});
 else console.error('Retained math integration:',directory);
});
async function registerPage(page) {
 world=await createIntegration();directory=world.directory;
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
 await page.getByRole('button',{name:'知道了',exact:true}).click();
}
async function downloadWork(page, format, name) {
 const options=page.locator('#math-export-options');
 if(!await options.isVisible()) await page.getByRole('button',{name:/^下载(图片|演示)$/}).click();
 await page.getByLabel('导出格式').selectOption(format);
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'下载作品',exact:true}).click();
 const target=path.join(evidence,name);await (await event).saveAs(target);return target;
}
test('real-auth: dynamic and exact external HTML final downloads cold start with service stopped and network disabled',async({page})=>{
 await registerPage(page);

 await page.getByRole('navigation',{name:'功能模块',exact:true}).getByRole('link',{name:/^数学工坊/}).click();
 await page.getByRole('button',{name:'新建动态演示',exact:true}).click();
 await page.getByRole('button',{name:'试试二次函数演示',exact:true}).click();
 await page.getByLabel('作品名称').fill('离线参数函数');
 await page.getByRole('button',{name:/^保存$/}).click();
 await expect(page.locator('.math-workspace-status, [data-save-status]')).toContainText('已保存');
 await page.getByRole('button',{name:'课堂展示',exact:true}).click();
 await page.getByRole('button',{name:'带系数完整式',exact:true}).click();
 await expect(page.locator('.math-dynamic svg')).toContainText('y=-2(x-(0))²+(1)');
 await page.keyboard.press('Escape');
 const dynamic=await downloadWork(page,'html','dynamic.html');
 await page.getByRole('button',{name:'返回工坊',exact:true}).click();
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'导入已有 HTML 演示',exact:true}).click();
 await (await chooser).setFiles(path.resolve('apps/web/e2e/fixtures/math-dynamic/mx-model-revised.html'));
 await page.getByRole('button',{name:/^保存$/}).click();
 await expect(page.locator('.math-workspace-status, [data-save-status]')).toContainText('已保存');
 await page.getByRole('button',{name:'编辑源码',exact:true}).click();
 const original=await page.getByLabel('HTML 源码').inputValue();
 await page.getByLabel('HTML 源码').fill(original.replace(/正比例函数斜率探究/g,'M43 课堂探究').replace('min="-8"','min="-10"'));
 await page.getByRole('button',{name:/^保存$/}).click();
 await expect(page.locator('.math-workspace-status, [data-save-status]')).toContainText('已保存');
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
