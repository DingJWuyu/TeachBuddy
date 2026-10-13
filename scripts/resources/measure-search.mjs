// Real-auth browser measurement. Run from the repo root with an isolated Web dist.
// RESOURCE_SEARCH_WARM_ONLY=1 prepares text through HTTP without cold UI timing.
// RESOURCE_SEARCH_SIZES=100 selects a size; RESOURCE_SEARCH_RESULTS selects evidence.
// Reuses tracked documents; never reads an existing instance or starts recognition.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { chromium } from '@playwright/test';
import { createIntegration } from '../../apps/api/test/fixtures/auth-integration/harness.js';
import { registerMath } from '../../apps/web/e2e/fixtures/math-static/real.mjs';
import { execFileSync } from 'node:child_process';

const output = path.resolve(process.env.RESOURCE_SEARCH_RESULTS || 'test-results/resources-search/baseline');
const sizes = (process.env.RESOURCE_SEARCH_SIZES || '20,100').split(',').map(Number);
const warmOnly = process.env.RESOURCE_SEARCH_WARM_ONLY === '1';
const webDist = path.resolve(process.env.WORKBENCH_WEB_DIST || 'test-results/resources-search/web-dist');
fs.mkdirSync(output, { recursive: true });
const sources = [
  'apps/web/e2e/fixtures/materials/samples/c22.pdf',
  'apps/web/e2e/fixtures/office/docx/lesson-teacher.docx',
  'apps/web/e2e/fixtures/materials/samples/c22.pptx',
  'apps/web/e2e/fixtures/materials-resources/samples/page.png',
];
const sourceRecords = sources.map(source => {
  const bytes = fs.readFileSync(source);
  return { source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
const originalRead = fs.readFileSync;
let probe = null;
fs.readFileSync = function(file, ...args) {
  if (!probe || !String(file).startsWith(probe.blobs + path.sep)) return originalRead.call(this, file, ...args);
  const start = performance.now();
  const bytes = originalRead.call(this, file, ...args);
  probe.reads++; probe.bytes += bytes.length; probe.readMs += performance.now() - start;
  probe.paths.add(String(file));
  return bytes;
};
const browser = await chromium.launch();
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), node: process.version, seed: 20261012, sources: sourceRecords, auth: 'real-auth / fake-mail', recognition: 'disabled', runs: [] };
try {
  for (const size of sizes) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-search-'));
    const world = await createIntegration({ directory, webDist, workbench: { filesDir: path.join(directory,'files') } });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: {width:1440,height:1000} });
    const page = await context.newPage();
    const run = {size, directory, items:[], measurements:[]};
    report.runs.push(run);
    const { client } = await registerMath(world, `search-${size}@example.test`);
    const request = async (method, url, body, rawBody, contentType) => {
      const response = await client.request(method,url,{body,rawBody,contentType,headers: {'Idempotency-Key':randomUUID()}});
      assert.ok(response.status >= 200 && response.status < 300, `${method} ${url}: ${response.status} ${JSON.stringify(response.json)}`);
      return response.json;
    };
    try {
      const folders = [{id:randomUUID(),name:'第一组',parentId:null},{id:randomUUID(),name:'第二组',parentId:null}];
      await request('PUT','/api/modules/resources/taxonomy',{baseVersion:1,folders,tags:[]});
      let seed = report.seed;
      const random = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed;};
      const pending=[];
      for(let i=0;i<size;i++) {
        const source = sources[random()%sources.length];
        const bytes = originalRead(source);
        const boundary = `measure-${randomUUID()}`;
        const name = `资料${String(i+1).padStart(3,'0')}${path.extname(source)}`;
        const multipart = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);
        const file = await request('POST','/api/workbench/files',undefined,multipart,`multipart/form-data; boundary=${boundary}`);
        let item = await request('POST','/api/modules/resources/items',{title:`课堂资料 ${String(i+1).padStart(3,'0')}`,fileId:file.id,folderId:folders[i%2].id,tagIds:[],note:`测量样本 ${i+1}`});
        if(i%5===0) item=await request('POST',`/api/modules/resources/items/${item.id}/deletion`,{baseVersion:item.version,deleted:true});
        await request('POST',`/api/workbench/files/${file.id}/preview`,{});
        pending.push(file.id);
        run.items.push({id:item.id,fileId:file.id,source,bytes:bytes.length,archived:!!item.deletedAt,folderId:item.folderId});
        world.clock.advance(1000);
      }
      console.log(`seeded ${size}; waiting for real conversion`);
      const deadline=Date.now()+600000;
      for(const id of pending) {
        let preview;
        do {
          preview = await request('GET',`/api/workbench/files/${id}/preview`);
          if(!['pending'].includes(preview.state)) break;
          assert.ok(Date.now()<deadline,'preview timeout');
          await new Promise(r=>setTimeout(r,200));
        } while(true);
        assert.ok(['ready','limited'].includes(preview.state),JSON.stringify(preview));
        run.items.find(item=>item.fileId===id).pages=preview.pageCount;
      }
      await page.goto(world.origin+'/resources');
      await page.getByLabel('邮箱',{exact:true}).fill(`search-${size}@example.test`);
      await page.getByLabel('密码',{exact:true}).fill('math-password');
      await page.getByRole('button',{name:'登录',exact:true}).click();
      await page.locator('.res-browser[aria-busy="false"]').waitFor();
      if(await page.getByRole('button',{name:'知道了',exact:true}).isVisible()) await page.getByRole('button',{name:'知道了',exact:true}).click();
      await page.waitForTimeout(300);
      let current;
      page.on('request', req=>{if(current && new URL(req.url()).pathname.startsWith('/api/')) current.requests.push({url:new URL(req.url()).pathname+new URL(req.url()).search,at:performance.now()-current.start});});
      page.on('response', async response=> {
        const url=new URL(response.url());
        if(!current || !url.pathname.startsWith('/api/'))return;
        const measurement=current;
        const at=performance.now()-measurement.start;
        if(url.pathname==='/api/modules/resources/items' && url.searchParams.has('q')) {
          const body=await response.json().catch(()=>null);
          if(body) measurement.responses.push({q:url.searchParams.get('q'),at,count:body.items.length,ids:body.items.map(x=>x.id),pending:body.search?.pending,failed:body.search?.failed,unavailable:body.search?.unavailable,folderId:url.searchParams.get('folderId'),state:url.searchParams.get('state')});
        }
      });
      async function measure(label,q,action,{instrument=true}={}) {
        current={label,q,start:performance.now(),requests:[],responses:[]};
        const measurement=current;
        const reads={blobs:path.join(directory,'files','blobs'),reads:0,bytes:0,readMs:0,paths:new Set()};
        probe=instrument?reads:null;
        await page.evaluate(()=>{
          window.searchMeasure={events:[],frames:[],mutations:[],start:performance.now()};
          const m=window.searchMeasure;
          m.input=e=>{const time=performance.now(); requestAnimationFrame(()=>m.events.push({value:e.target.value,at:time-m.start,frameMs:performance.now()-time}));};
          document.addEventListener('input',m.input,true);
          m.observer=new MutationObserver(()=>m.mutations.push({at:performance.now()-m.start,cards:document.querySelectorAll('.res-card-open').length,busy:document.querySelector('.res-browser')?.getAttribute('aria-busy')}));
          m.observer.observe(document.querySelector('.res-browser'),{subtree:true,childList:true,attributes:true});
        });
        await action();
        measurement.lastActionMs=performance.now()-measurement.start;
        const until=Date.now()+180000;
        while(!measurement.responses.some(r=>r.q===q && r.pending===0)) {
          assert.ok(Date.now()<until,`search timeout ${label}`);
          await page.waitForTimeout(25);
        }
        const finalResponse=measurement.responses.filter(r=>r.q===q && r.pending===0).at(-1);
        await page.waitForFunction(count=>document.querySelector('.res-browser')?.getAttribute('aria-busy')==='false' && document.querySelectorAll('.res-card-open').length===count,finalResponse.count,{polling:'raf'});
        measurement.finalDomMs=performance.now()-measurement.start;
        const finalBrowserTime=await page.evaluate(()=>performance.now()-window.searchMeasure.start);
        measurement.finalAfterLastActionMs=measurement.finalDomMs-measurement.lastActionMs;
        measurement.firstResponseMs=measurement.responses.find(r=>r.q===q)?.at;
        await page.waitForTimeout(100);
        const details=await page.evaluate(()=>{const m=window.searchMeasure; m.observer.disconnect();document.removeEventListener('input',m.input,true);return {events:m.events,mutations:m.mutations,observedEndMs:performance.now()-m.start};});
        Object.assign(measurement,details);
        measurement.finalAfterLastInputMs=details.events.length?finalBrowserTime-details.events.at(-1).at:null;
        const firstBatch=measurement.responses.find(r=>r.q===q && r.count>0);
        measurement.firstVisibleBatchMs=firstBatch?details.mutations.find(m=>m.at>=firstBatch.at-10 && m.cards===firstBatch.count)?.at:null;
        measurement.finalCount=finalResponse.count;
        measurement.finalIds=finalResponse.ids;
        measurement.blobReads=instrument?{reads:reads.reads,bytes:reads.bytes,readMs:reads.readMs,uniquePaths:reads.paths.size}:null;
        measurement.requestCounts=Object.fromEntries(['taxonomy','items','fileMeta','preview','blob'].map(kind=>[kind,measurement.requests.filter(r=>kind==='taxonomy'?r.url.includes('/taxonomy'):kind==='items'?r.url.includes('/resources/items'):kind==='fileMeta'?/^\/api\/workbench\/files\/[^/?]+$/.test(r.url):kind==='preview'?r.url.endsWith('/preview'):r.url.includes('/content')).length]));
        delete measurement.start;
        current=null;probe=null;
        run.measurements.push(measurement);
        fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
        console.log(size,label,JSON.stringify({first:measurement.firstResponseMs,final:measurement.finalDomMs,afterInput:measurement.finalAfterLastActionMs,count:measurement.finalCount,requests:measurement.requestCounts,reads:measurement.blobReads}));
        return measurement;
      }
      const input=page.getByLabel('搜索资料');
      if(warmOnly) {
        let result;
        do {result=await request('GET','/api/modules/resources/items?q='+encodeURIComponent('解析式'));} while(result.search?.pending);
        await measure('prepared-body','解析式',()=>input.fill('解析式'));
      } else await measure('cold-body','解析式',()=>input.fill('解析式'));
      const expected=run.items.filter(i=>!i.archived && /\.(pdf|pptx|docx)$/.test(i.source)).map(i=>i.id).sort();
      assert.deepEqual([...run.measurements.at(-1).finalIds].sort(),expected,'body result must find PDF/Office fixed phrase, exclude images and archived');
      await measure('warm-body','解析式',async()=>{await input.fill('');await input.fill('解析式');});
      await measure('continuous-input','课堂资料',async()=>{await input.fill('');await input.pressSequentially('课堂资料',{delay:90});});
      assert.deepEqual([...run.measurements.at(-1).finalIds].sort(),run.items.filter(i=>!i.archived).map(i=>i.id).sort());
      await measure('change-word','三角形',async()=>{await input.press('ControlOrMeta+A');await input.pressSequentially('三角形',{delay:90});});
      assert.deepEqual([...run.measurements.at(-1).finalIds].sort(),run.items.filter(i=>!i.archived && /\.(pdf|pptx)$/.test(i.source)).map(i=>i.id).sort());
      for(let repeat=0;repeat<3;repeat++) {
        await measure(`warm-probe-${repeat+1}`,'解析式 ',()=>input.fill('解析式 '));
        await measure(`warm-without-probe-${repeat+1}`,'解析式',()=>input.fill('解析式'),{instrument:false});
      }
      await page.getByRole('button',{name:'文件夹与标签',exact:true}).click();
      await measure('switch-folder','解析式',()=>page.getByRole('button',{name:'第一组',exact:true}).click());
      assert.deepEqual([...run.measurements.at(-1).finalIds].sort(),expected.filter(id=>run.items.find(i=>i.id===id).folderId===folders[0].id));
      await measure('switch-folder-back','解析式',()=>page.locator('.res-tax-row').getByRole('button',{name:'全部资料',exact:true}).click());
      await page.locator('.res-tax-footer').getByRole('button',{name:'已归档资料',exact:true}).click();
      await page.locator('.res-browser[aria-busy="false"]').waitFor();
      await page.waitForTimeout(250);
      if(warmOnly) {
        let result;
        do {result=await request('GET','/api/modules/resources/items?state=deleted&q='+encodeURIComponent('解析式'));} while(result.search?.pending);
      }
      await measure(warmOnly?'archive-warm':'archive-cold','解析式',()=>input.fill('解析式'));
      assert.deepEqual([...run.measurements.at(-1).finalIds].sort(),run.items.filter(i=>i.archived && /\.(pdf|pptx|docx)$/.test(i.source)).map(i=>i.id).sort());
      await page.screenshot({path:path.join(output,`${size}-archived.png`)});
      run.completed=true;
    } finally {
      probe=null;await context.close();await world.close();
      if(run.completed) {fs.rmSync(directory,{recursive:true,force:true});delete run.directory;}
      fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    }
  }
} finally {fs.readFileSync=originalRead;await browser.close();}
