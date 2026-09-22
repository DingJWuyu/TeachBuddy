import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.CANDIDATE,out=process.env.EVIDENCE;
if(!root||!out)throw Error('CANDIDATE and EVIDENCE required');
const {chromium}=await import(pathToFileURL(path.join(root,'node_modules/playwright/index.mjs')));
const {expect}=await import(pathToFileURL(path.join(root,'node_modules/@playwright/test/index.mjs')));
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:50436');
const context=browser.contexts()[0];
const page=context.pages().find(p=>p.url().startsWith('https://127.0.0.1:50435'));
const events=[];
const log=e=>{events.push({at:new Date().toISOString(),...e});fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(events,null,2));};
page.on('requestfailed',r=>log({event:'requestfailed',url:r.url(),method:r.method(),failure:r.failure()}));
page.on('pageerror',e=>log({event:'pageerror',message:e.message}));
page.on('response',async r=>{if(r.url().includes('/questions/v2/taxonomy'))log({event:'taxonomy',method:r.request().method(),status:r.status(),body:await r.json()});});
const snap=async name=>{await page.screenshot({path:path.join(out,name+'.png')});fs.writeFileSync(path.join(out,name+'.txt'),await page.locator('body').ariaSnapshot());};
const panel=page.getByRole('complementary',{name:'辅助栏',exact:true});
async function closePanel(){if(await panel.isVisible())await panel.getByRole('button',{name:'关闭辅助栏',exact:true}).click();}
async function manage(){await page.getByRole('button',{name:'分类管理',exact:true}).click();await expect(page.getByLabel('新分类名称')).toBeVisible();}
async function save(){const pending=page.waitForResponse(r=>r.url().endsWith('/questions/v2/taxonomy')&&r.request().method()==='PUT');await page.getByRole('button',{name:'保存分类',exact:true}).click();const r=await pending;assert.equal(r.status(),200);return r.json();}
try{
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.wb-sidebar').getByRole('link',{name:'题库',exact:true}).click();
  await expect(page.getByRole('button',{name:'分类管理',exact:true})).toBeVisible();
  await closePanel();await snap('closed-before');
  await manage();await snap('closed-entry-open');log({scenario:'002-closed',result:'PASS'});
  await page.getByRole('tab',{name:'AI 助理',exact:true}).click();
  await page.getByLabel('AI 输入').fill('R35 independent 保留的 AI 草稿');
  await page.getByLabel('搜索题目').fill('仅搜索，不切走 AI');
  await expect(page.getByLabel('AI 输入')).toBeVisible();await snap('ai-search-retained');
  await manage();await snap('ai-entry-open');
  await page.getByRole('tab',{name:'AI 助理',exact:true}).click();
  await expect(page.getByLabel('AI 输入')).toHaveValue('R35 independent 保留的 AI 草稿');await snap('ai-draft-retained');log({scenario:'002-ai-entry-search-draft',result:'PASS'});
  await manage();
  await page.getByLabel('新分类名称').fill('几何证明');await page.getByRole('button',{name:'新增',exact:true}).click();
  await page.getByLabel('分类类别').selectOption('tags');await page.getByLabel('新分类名称').fill('较长分类名称用于窄视口检查');await page.getByRole('button',{name:'新增',exact:true}).click();
  const measurements=[];
  for(const viewport of [{width:1440,height:900},{width:1280,height:800},{width:1024,height:768},{width:768,height:1024}]){
    await page.setViewportSize(viewport);await expect(page.getByLabel('分类名称',{exact:true})).toHaveCount(2);
    await page.getByLabel('分类名称',{exact:true}).last().fill('较长分类名称用于窄视口检查');
    const row=await panel.evaluate(element=>({viewport:{width:innerWidth,height:innerHeight},pageWidth:document.documentElement.scrollWidth,panel:element.getBoundingClientRect().toJSON(),controls:[...element.querySelectorAll('button')].filter(b=>b.textContent==='删除').map(b=>{const r=document.createRange();r.selectNodeContents(b);return {rect:b.getBoundingClientRect().toJSON(),text:r.getBoundingClientRect().toJSON(),lineHeight:parseFloat(getComputedStyle(b).lineHeight),whiteSpace:getComputedStyle(b).whiteSpace};}),inputs:[...element.querySelectorAll('input[aria-label="分类名称"]')].map(i=>({rect:i.getBoundingClientRect().toJSON(),border:getComputedStyle(i).border,outline:getComputedStyle(i).outline}))}));
    assert.equal(row.controls.length,2);assert.ok(row.pageWidth<=viewport.width);for(const c of row.controls){assert.ok(c.text.height<=c.lineHeight);assert.ok(c.rect.x>=0&&c.rect.right<=viewport.width);}
    measurements.push(row);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(measurements,null,2));
    await snap('taxonomy-'+viewport.width);log({scenario:'004-viewport',viewport,result:'PASS'});
  }
  const saved=await save();assert.equal(saved.types.length,1);assert.equal(saved.tags.length,1);
  await page.reload();await expect(page.locator('.wb-shell')).toBeVisible();await closePanel();await manage();
  await expect(page.getByLabel('分类名称',{exact:true}).first()).toHaveValue('几何证明');await expect(page.getByLabel('分类名称',{exact:true}).last()).toHaveValue('较长分类名称用于窄视口检查');await snap('pad-reloaded');
  page.on('dialog',async d=>{log({event:'delete-confirmation',text:d.message()});await d.accept();});
  await page.getByRole('button',{name:'删除',exact:true}).first().click();await expect(page.getByLabel('分类名称',{exact:true})).toHaveCount(1);
  const deleted=await save();assert.deepEqual(deleted.types,[]);assert.equal(deleted.tags[0].id,saved.tags[0].id);
  await page.reload();await expect(page.locator('.wb-shell')).toBeVisible();await closePanel();await manage();await expect(page.getByLabel('分类名称',{exact:true})).toHaveCount(1);await snap('pad-deleted-persisted');
  await page.getByRole('button',{name:'删除',exact:true}).click();const empty=await save();assert.deepEqual(empty.types,[]);assert.deepEqual(empty.tags,[]);
  await closePanel();await expect(page.getByRole('button',{name:'分类管理',exact:true})).toBeVisible();await snap('pad-return-main');
  log({scenario:'004-create-save-refresh-delete-both',result:'PASS',saved,deleted,empty});
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({result:'PASS',browser:browser.version(),identity:'real-auth/fake-mail',productModelRequests:0,events:events.filter(e=>e.scenario)},null,2));
}catch(e){log({event:'collector-or-product-failure',message:e.message,stack:e.stack});await snap('failure');throw e;}
finally{await browser.close();}
