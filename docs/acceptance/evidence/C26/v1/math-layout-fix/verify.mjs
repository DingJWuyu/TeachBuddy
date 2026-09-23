// Run from the candidate root. Uses only copied data and the local controlled provider.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const local = file => import(pathToFileURL(path.resolve(file)));
const { createIntegration } = await local('apps/api/test/fixtures/c26/harness.js');
const { provider } = await local('apps/api/test/fixtures/c26/provider.js');
const { manualQuestionSample } = await local('apps/api/test/first-flow-harness.js');
const [mode = 'retained', label = 'after'] = process.argv.slice(2);
const out = path.dirname(fileURLToPath(import.meta.url));
const directory = mode === 'retained' ? '/tmp/c26-math-layout-runtime/formula-short' : fs.mkdtempSync('/tmp/c26-math-new-');
const sum = Array.from({length:55}, (_,i)=>`x_{${i}}^2`).join('+');
const atom = `\\frac{${Array.from({length:20},(_,i)=>`a_{${i}}`).join('+')}}{\\sqrt{1+x^2}}`;
const text = `行内公式：$${sum}$。\n\n分式根式：$\\frac{1}{2}+\\sqrt{x^2+1}+\\hat{x}+\\vec{a}$。\n\n长分式：$${atom}$。\n\n独立公式：\n\n$$\n${sum}\n$$\n\n$$\n${atom}\n$$`;
const p = mode === 'new' ? await provider([[{type:'text',text}]]) : null;
let world = await createIntegration({ directory, agent:p?.config });
const browser = await chromium.launch();
const context = await browser.newContext({ignoreHTTPSErrors:true});
const page = await context.newPage();
let pageId;
page.on('request', r => { pageId = r.headers()['x-teachbuddy-page'] ?? pageId; });
const report = {mode,label,directory,productModelRequests:0,layouts:[]};
async function login() {
 await page.goto(world.origin);
 await page.getByLabel('邮箱',{exact:true}).fill('formula@c27.test');
 await page.getByLabel('密码',{exact:true}).fill('password-c27-formula');
 await page.getByRole('button',{name:'登录',exact:true}).click();
 await expect(page.locator('.wb-shell')).toBeVisible();
}
async function inspect(selector='.agent-message .katex') {
 return page.locator(selector).evaluateAll(formulas => formulas.map(k=>({
  split:[...k.querySelectorAll('.msupsub')].filter(e=>{const s=e.getBoundingClientRect(), b=e.previousElementSibling.getBoundingClientRect();return s.x<b.x-1 || s.top>b.bottom;}).length,
  bases:[...k.querySelectorAll('.base')].map(e=>({display:getComputedStyle(e).display,whiteSpace:getComputedStyle(e).whiteSpace})),
  fractions:k.querySelectorAll('.mfrac').length,roots:k.querySelectorAll('.sqrt').length,
 })));
}
try {
 if(mode==='new') {
  await page.goto(world.origin);await page.getByRole('button',{name:'创建账户'}).click();
  for(const [name,value] of [['昵称','公式验收'],['邮箱','formula@c27.test'],['密码','password-c27-formula'],['确认密码','password-c27-formula']]) await page.getByLabel(name,{exact:true}).fill(value);
  await page.getByRole('button',{name:'发送验证码'}).click();
  await expect.poll(()=>world.mailer.lastCode('registration','formula@c27.test')).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration','formula@c27.test'));
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'注册',exact:true}).click();
  await page.getByRole('button',{name:'新对话',exact:true}).click();
  await page.getByRole('textbox',{name:'AI 输入'}).fill('检查长公式、上下标、分式和根式');
  await expect(page.getByText('草稿已保存',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'发送',exact:true}).click();
 } else await login();
 await expect(page.getByText('已完成',{exact:true})).toBeVisible();
 for(const [width,height] of [[1440,900],[820,1180],[390,844]]) {
  await page.setViewportSize({width,height});
  await expect.poll(()=>page.locator('.wb-sidebar').evaluate(e=>Math.round(e.getBoundingClientRect().width))).toBe(width<=1080?72:256);
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.agent-thread').evaluate(e=>e.scrollTop=0);
  const formulas=await inspect();
  const geometry=await page.locator('.agent-thread').evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,shell:document.documentElement.scrollWidth,viewport:innerWidth}));
  const scrolling=[];
  for(const region of await page.locator('.agent-message p:has(.katex), .agent-message .katex-display').all()) {
   if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)) {
    await region.hover();await page.mouse.wheel(1200,0);
    await expect.poll(()=>region.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
    scrolling.push(await region.evaluate(e=>({clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,scrollLeft:e.scrollLeft})));
    await page.screenshot({path:`${out}/${label}-${mode}-${width}-scroll-${scrolling.length}.png`});
    await region.evaluate(e=>e.scrollLeft=0);
   }
  }
  await page.locator('.agent-thread').evaluate(e=>e.scrollTop=0);
  report.layouts.push({width,formulas,geometry,scrolling});
  await page.screenshot({path:`${out}/${label}-${mode}-${width}.png`});
 }
 fs.writeFileSync(`${out}/${label}-${mode}.json`,JSON.stringify(report,null,2)+'\n');
 expect(report.layouts.flatMap(l=>l.formulas).reduce((n,f)=>n+f.split,0),'底数与上下标必须相邻').toBe(0);
 for(const l of report.layouts) {expect(l.geometry.shell).toBeLessThanOrEqual(l.width);expect(l.geometry.scrollWidth).toBeLessThanOrEqual(l.geometry.width+1);}
 const original = await page.locator('.agent-message:not(.is-user)').textContent();
 await page.reload();await expect(page.locator('.agent-message:not(.is-user)')).toHaveText(original);
 if(mode==='new') {
  await page.setViewportSize({width:1440,height:900});
  const sample=manualQuestionSample();sample.title='数学排版回归';sample.body={version:1,blocks:[{type:'paragraph',runs:[{type:'text',text:'原题库行内：'},{type:'math',latex:'x_0^2+\\frac{1}{2}+\\sqrt{x^2+1}+\\hat{x}+\\vec{a}'}]},{type:'math',latex:atom}]};
  const response=await page.request.post(world.origin+'/api/modules/questions/items',{headers:{Origin:world.origin,'X-TeachBuddy-Request':'1','X-TeachBuddy-Page':pageId,'Idempotency-Key':crypto.randomUUID()},data:sample});
  expect(response.status()).toBe(201);const question=await response.json();
  await page.getByRole('link',{name:'题库',exact:true}).click();
  await page.getByText('数学排版回归',{exact:true}).click();
  await expect(page.locator('.wb-formula')).not.toHaveCount(0);
  report.question=await inspect('.wb-formula .katex');
  expect(report.question.reduce((n,f)=>n+f.split,0)).toBe(0);
  await page.screenshot({path:`${out}/question-desktop.png`});
  await page.locator('.wb-ai-entry').click();
  await expect(page.locator('.agent-message:not(.is-user)')).toHaveText(original);
  report.panel=await inspect();
  expect(report.panel.reduce((n,f)=>n+f.split,0)).toBe(0);
  await page.screenshot({path:`${out}/question-agent-panel.png`});
  await page.getByRole('button',{name:'关闭辅助栏',exact:true}).first().click();
  for(const [width,height] of [[820,1180],[390,844]]) {
   await page.setViewportSize({width,height});
   await expect.poll(()=>page.locator('.wb-sidebar').evaluate(e=>Math.round(e.getBoundingClientRect().width))).toBe(72);
   await expect(page.locator('.wb-formula').first()).toBeVisible();
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:`${out}/question-${width}.png`});
   expect((await inspect('.wb-formula .katex')).reduce((n,f)=>n+f.split,0)).toBe(0);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('link',{name:'工作台首页',exact:true}).click();
  await expect(page.locator('.agent-message:not(.is-user)')).toHaveText(original);
  report.controlledProviderRequests=p.requests();expect(p.requests()).toBe(1);
 }
 await world.close();world=await createIntegration({directory});
 await context.clearCookies();await login();
 await page.getByRole('button',{name:'对话历史',exact:true}).click();
 await page.getByRole('button',{name:mode==='new'?'检查长公式、上下标、分式和根式':'请显示一段带上下标的长公式',exact:true}).click();
 await expect(page.locator('.agent-message:not(.is-user)')).toHaveText(original);
 report.restart='PASS'; report.status='PASS';
 fs.writeFileSync(`${out}/${label}-${mode}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,mode,directory,requests:p?.requests()??0}));
} finally {await browser.close();await world.close();}
