import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const saved=JSON.parse(fs.readFileSync(path.join(dir,'live-ledger.json'),'utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report={identity:'real-auth/fake-mail',models:'unconfigured',newModelRequests:0,screens:[],modules:[]};
try {
 await page.goto('https://localhost:50782');await page.getByLabel('邮箱',{exact:true}).fill('preview-agent-live@example.test');await page.getByLabel('密码',{exact:true}).fill('preview-agent-local-password');await page.getByRole('button',{name:'登录',exact:true}).click();
 await page.locator('.agent-tool').first().waitFor();
 assert.equal(await page.locator('.agent-tool').count(),saved.snapshot.toolCalls.length);
 for(const [width,height]of [[1440,900],[820,1180],[390,844]]){
  await page.setViewportSize({width,height});
  await page.waitForFunction(w=>Math.round(document.querySelector('.wb-sidebar').getBoundingClientRect().width)===(w<=1080?72:256),width);
  const geometry=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,thread:document.querySelector('.agent-thread').clientWidth,scroll:document.querySelector('.agent-thread').scrollWidth}));
  assert.ok(geometry.document<=width,JSON.stringify(geometry));assert.ok(geometry.scroll<=geometry.thread,JSON.stringify(geometry));
  await page.screenshot({path:path.join(dir,`readback-${width}.png`)});report.screens.push({width,height,...geometry});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.reload();await page.locator('.agent-tool').first().waitFor();assert.equal(await page.locator('.agent-tool').count(),saved.snapshot.toolCalls.length);
 for(const [name,url]of [['题库','/questions'],['备课','/lessons'],['数学工坊','/math'],['资源库','/resources'],['班级教学','/classes'],['日程','/calendar']]){
  await page.getByRole('link',{name,exact:true}).first().click();await page.waitForURL('**'+url);
  await page.locator('.wb-ai-entry').click();await page.locator('.agent-tool').first().waitFor();assert.equal(await page.locator('.agent-tool').count(),saved.snapshot.toolCalls.length);
  await page.locator('.wb-aux').getByRole('button',{name:'关闭辅助栏',exact:true}).click();
  report.modules.push({name,url,sharedConversation:'PASS'});
 }
 await page.getByRole('link',{name:'工作台首页',exact:true}).click();await page.locator('.agent-tool[data-tool-state="confirmed"]').first().getByRole('button',{name:/打开题目/}).click();await page.getByRole('textbox',{name:'题目标题'}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'题目标题'}).inputValue(),'预览改编题：数列进阶');
 await page.getByRole('button',{name:'加入对话',exact:true}).click();await page.locator('.agent-references').getByRole('button',{name:'题目 v1',exact:true}).waitFor();
 await page.screenshot({path:path.join(dir,'readback-reference.png')});
 await page.locator('.agent-tool[data-tool-state="confirmed"]').last().getByRole('button',{name:/打开备课/}).click();await page.getByRole('textbox',{name:'环节名称 2'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'环节名称 2'}).inputValue(),'小组挑战');
 report.activeLinks=await page.locator('.wb-nav-row.is-active').allTextContents();
 await page.locator('.wb-aux').getByRole('button',{name:'关闭辅助栏',exact:true}).click();await page.screenshot({path:path.join(dir,'readback-lesson.png')});
 report.errors=errors;assert.deepEqual(errors,[]);report.status='PASS';
} catch(e){report.status='FAIL';report.error=e.message;await page.screenshot({path:path.join(dir,'readback-failure.png')});}
finally{fs.writeFileSync(path.join(dir,'readback.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
