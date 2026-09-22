import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=process.env.CANDIDATE,out=process.env.EVIDENCE;
const {chromium}=await import(pathToFileURL(path.join(root,'node_modules/playwright/index.mjs')));
const {expect}=await import(pathToFileURL(path.join(root,'node_modules/@playwright/test/index.mjs')));
const {default:sharp}=await import(pathToFileURL(path.join(root,'node_modules/sharp/dist/index.mjs')));
const b=await chromium.connectOverCDP('http://127.0.0.1:50436'),c=b.contexts()[0];
const shell=c.pages().find(p=>p.url().startsWith('https://127.0.0.1:50435'));
const fixture=c.pages().find(p=>p.url().startsWith('http://localhost:50437'));
const capture=async(p,n)=>{await p.bringToFront();await p.screenshot({path:path.join(out,'browser',n+'.png')});fs.writeFileSync(path.join(out,'browser',n+'.txt'),await p.locator('body').ariaSnapshot());};
const rows=[];
for(const p of [shell,fixture])p.setDefaultTimeout(15000);
try{
  await fixture.setViewportSize({width:1440,height:900});
  for(const name of ['empty','invalid','prefix','mixed-success-first','mixed-empty-first','historical-prefix']){
    if(process.env.RESUME_ASSETS==='1'){assert.ok(fs.existsSync(path.join(out,'browser','controlled-'+name+'.png')));rows.push({name,result:'PASS',identity:'test-principal',source:'earlier completed browser capture'});continue;}
    if(await fixture.getByRole('button',{name:'返回题库',exact:true}).isVisible())await fixture.getByRole('button',{name:'返回题库',exact:true}).click();
    await fixture.getByRole('button',{name:new RegExp('^独立受控 '+name+' ')}).click();
    await expect(fixture.getByText(name==='empty'?/^整理失败，原稿已保存\s+1\/1$/:/^部分内容待处理\s+\d+\/\d+$/)).toBeVisible();
    await expect(fixture.getByRole('img',{name:'原稿第 1 页',exact:true})).toBeVisible();
    const fragments=fixture.locator('summary').filter({hasText:'未分配片段'});
    if(await fragments.count())await fragments.click();
    if(name==='invalid')await expect(fixture.getByText('not JSON',{exact:true})).toBeVisible();
    await capture(fixture,'controlled-'+name);rows.push({name,result:'PASS',identity:'test-principal',source:'retained local-adapter jobs'});
  }
  await shell.bringToFront();
  await shell.getByRole('button',{name:'查看生成结果',exact:true}).click();
  await expect(shell.getByText('素材已生成',{exact:true})).toBeVisible();
  await shell.getByRole('button',{name:'复制文字与公式源',exact:true}).click();
  const source=await shell.getByLabel('可复制文字公式源').inputValue();assert.ok(source.includes('\\frac'));assert.ok(!source.includes('R35_PRIVATE'));assert.ok(!source.includes('ANSWER_ONLY'));
  await capture(shell,'asset-generated');
  const downloads=[];
  async function download(name){const promise=shell.waitForEvent('download');await shell.getByRole('button',{name:'下载分片 1',exact:true}).click();const d=await promise;await d.saveAs(path.join(out,'browser',name+'.png'));const bytes=fs.readFileSync(path.join(out,'browser',name+'.png')),meta=await sharp(bytes).metadata();assert.equal(meta.width,1600);assert.ok(meta.height<=2400&&meta.hasAlpha);downloads.push({name,suggestedFilename:d.suggestedFilename(),width:meta.width,height:meta.height,alpha:meta.hasAlpha,sha256:createHash('sha256').update(bytes).digest('hex')});}
  await download('download-question');
  const accepted=shell.waitForResponse(r=>r.url().endsWith('/assets')&&r.request().method()==='POST');await shell.getByRole('button',{name:'生成配图 1 PNG',exact:true}).click();const response=await accepted;assert.equal(response.status(),202);const job=await response.json();
  await expect.poll(async()=>{await shell.getByRole('button',{name:'查看生成结果',exact:true}).click();return shell.getByRole('button',{name:'下载分片 1',exact:true}).count();},{timeout:15000}).toBe(1);
  await download('download-figure');await capture(shell,'figure-generated');
  fs.writeFileSync(path.join(out,'browser/consume-result.json'),JSON.stringify({result:'PASS',rows,source,downloads,figureJob:job,identity:'shell real-auth; controlled views test-principal'},null,2));
}catch(e){fs.writeFileSync(path.join(out,'browser/consume-failure.json'),JSON.stringify({message:e.message,stack:e.stack},null,2));await capture(fixture,'controlled-failure');throw e;}
finally{await b.close();}
