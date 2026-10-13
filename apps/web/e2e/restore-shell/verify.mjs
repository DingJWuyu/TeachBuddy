import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createIntegration } from '../../../api/test/fixtures/auth-integration/harness.js';
const evidence=process.env.SHELL_EVIDENCE || '/tmp/rs'; fs.mkdirSync(evidence,{recursive:true});
const world=await createIntegration(process.env.SHELL_BASELINE ? {webDist:process.env.SHELL_BASELINE} : {}); const browser=await chromium.launch({headless:true}); const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1680,height:910}});
try {
await page.goto(world.origin); await page.getByRole('button',{name:'创建账户'}).click(); await page.getByLabel('昵称',{exact:true}).fill('外壳验收'); await page.getByLabel('邮箱',{exact:true}).fill('shell@example.test'); await page.getByLabel('密码',{exact:true}).fill('shell-test-password'); await page.getByLabel('确认密码',{exact:true}).fill('shell-test-password'); await page.getByRole('button',{name:'发送验证码'}).click(); await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration','shell@example.test')); await page.getByRole('checkbox').check(); await page.getByRole('button',{name:'注册',exact:true}).click(); await page.locator('.wb-shell').waitFor(); if(await page.locator('.tb-coach-dismiss').count()) await page.locator('.tb-coach-dismiss').click(); await page.screenshot({path:path.join(evidence,'home.png')}); console.log('RESTORED TOPBAR',await page.locator('.tb-global-nav').count()); if(!await page.locator('.tb-global-nav').count()) throw new Error('Prototype topbar missing');

if(await page.locator('.tb-sidebar .wb-ai-entry').count()) throw new Error('Sidebar AI entry remains');
await page.getByRole('button',{name:'全局搜索',exact:true}).click(); await page.getByRole('dialog',{name:'全局搜索'}).waitFor(); await page.getByRole('button',{name:'关闭搜索'}).click();
for(const [label,path] of [['题库','questions'],['备课','lessons'],['数学工坊','math'],['资源库','resources'],['班级教学','classes']]) {
 await page.locator('.tb-module-nav a').filter({hasText:label}).click(); await page.waitForURL('**/'+path); await page.locator('.wb-main').waitFor(); console.log('NAV',path);
}
await page.locator('.tb-global-nav').getByRole('link',{name:'日程',exact:true}).click();await page.waitForURL('**/calendar');
for(const [label,path] of [['帮助','help'],['更新日志','releases'],['设置','settings']]) {
 await page.getByRole('button',{name:'支持',exact:true}).hover(); await page.getByRole('menuitem',{name:label,exact:true}).click();await page.waitForURL('**/'+path); console.log('SUPPORT',path);
}
await page.screenshot({path:path.join(evidence,'settings.png')});
console.log('SCROLL',await page.evaluate(()=>({body:document.body.scrollHeight,viewport:innerHeight,sidebar:getComputedStyle(document.querySelector('.tb-module-nav')).overflowY,main:getComputedStyle(document.querySelector('.wb-main')).overflowY})));
await page.reload();await page.locator('.wb-shell').waitFor();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('heading',{name:'欢迎回来',exact:true}).waitFor();console.log('AUTH register, refresh, logout PASS');

} finally {await browser.close();await world.close();}
