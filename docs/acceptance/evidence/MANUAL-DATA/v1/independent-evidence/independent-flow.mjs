import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import assert from 'node:assert/strict';
import { fork, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import JSZip from 'jszip';
const repo = process.env.ACCEPTANCE_REPO || process.cwd();
const here = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.join(here, 'evidence');
const { createIntegration } = await import(pathToFileURL(path.join(repo, 'apps/api/test/fixtures/auth-integration/harness.js')));
const { createClient } = await import(pathToFileURL(path.join(repo, 'apps/api/test/fixtures/auth-contract/harness.js')));
const { manualQuestionSample, lessonSample } = await import(pathToFileURL(path.join(repo, 'apps/api/test/first-flow-harness.js')));
const { emptySource } = await import(pathToFileURL(path.join(repo, 'apps/web/src/features/math/model.js')));
if (process.argv[2] === '--serve') {
  const directory = process.argv[3];
  const world = await createIntegration({ directory, port: Number(process.argv[4]), webDist: path.join(repo, 'apps/web/dist'), workbench: { filesDir: path.join(directory, 'files') } });
  process.send({ origin: world.origin });
  process.on('message', m => { if (m.code) process.send({ code: world.mailer.lastCode('registration', m.code) }); });
  process.once('SIGTERM', async () => { await world.close(); process.exit(0); });
} else {
  const sha = b => createHash('sha256').update(b).digest('hex');
  const results = [];
  const note = (name, detail) => { results.push({ name, ...detail }); console.log(JSON.stringify(results.at(-1))); fs.writeFileSync(path.join(evidence, 'independent-results.json'), JSON.stringify(results, null, 2)); };
  let child, browser, context;
  async function start(directory, port=0) {
    child = fork(fileURLToPath(import.meta.url), ['--serve', directory, String(port)], { env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ACCEPTANCE_REPO: repo }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    child.stdout.on('data', b => fs.appendFileSync(path.join(evidence, 'service.log'), b));
    child.stderr.on('data', b => fs.appendFileSync(path.join(evidence, 'service.log'), b));
    const [{ origin }] = await once(child, 'message');
    note('service-start', { directory, origin, pid: child.pid });
    return origin;
  }
  async function stop() { const done=once(child,'exit'); child.kill('SIGTERM'); const [code,signal]=await done; assert.equal(code,0); note('service-stopped',{code,signal}); child=null; }
  function cli(args, expected=0) {
    const p=spawnSync(process.execPath,[path.join(repo,'apps/api/src/scripts/reliability.js'),...args],{cwd:repo,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR},encoding:'utf8'});
    fs.appendFileSync(path.join(evidence,'cli.log'), JSON.stringify({args,status:p.status,stdout:p.stdout,stderr:p.stderr})+'\n');
    assert.equal(p.status,expected,p.stderr); return p.status===0?JSON.parse(p.stdout):p.stderr;
  }
  async function login(origin) {
    const c=createClient(origin,{transport:https,pageId:randomUUID().replaceAll('-','')});
    await c.request('POST','/api/auth/session',{body:{action:'bootstrap'}});
    const r=await c.request('POST','/api/auth/login',{body:{email:'independent-data@example.test',password:'Manual-data-123',rememberMe:true}});
    assert.equal(r.status,200,r.text);
    const a=await c.request('POST','/api/auth/session',{body:{action:'activate',sessionId:r.json.id,rememberMe:true}});assert.equal(a.status,200,a.text);
    return c;
  }
  async function mutate(c,method,url,body) { const r=await c.request(method,url,{body,headers:{'Idempotency-Key':randomUUID()}}); assert([200,201,202].includes(r.status),`${method} ${url} ${r.status} ${r.text}`); return r.json; }
  const tables=['question_items','lesson_items','lesson_sections','lesson_references','lesson_order','resource_items','math_works','math_revisions','classes_items','classes_records','classes_record_sources','schedule_entries','schedule_exceptions','materials_files','workbench_migrations'];
  function tableDigest(directory) { const db=new Database(path.join(directory,'workspace.sqlite'),{readonly:true,fileMustExist:true}); try { return Object.fromEntries(tables.map(t=>{const rows=db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all();return [t,{rows:rows.length,sha256:sha(JSON.stringify(rows))}]})); } finally {db.close();} }
  try {
    fs.mkdirSync(evidence,{recursive:true});
    const directory=fs.mkdtempSync(path.join(here,'combination-'));
    let origin=await start(directory); const port=Number(new URL(origin).port);
    browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome'});
    context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
    await context.route('**/*',route=>{const u=new URL(route.request().url()); return ['127.0.0.1','localhost'].includes(u.hostname)||['file:','data:','blob:'].includes(u.protocol)?route.continue():route.abort();});
    const page=await context.newPage();
    await page.goto(origin);
    await page.getByRole('button',{name:'创建账户'}).click();
    await page.getByLabel('昵称',{exact:true}).fill('独立验收数学老师');
    await page.getByLabel('邮箱',{exact:true}).fill('independent-data@example.test');
    await page.getByLabel('密码',{exact:true}).fill('Manual-data-123');
    await page.getByLabel('确认密码',{exact:true}).fill('Manual-data-123');
    await page.getByRole('button',{name:'发送验证码'}).click();
    let code; await expect.poll(async()=>{const wait=once(child,'message');child.send({code:'independent-data@example.test'});[{code}]=await wait;return code;}).toBeTruthy();
    await page.getByLabel('邮箱验证码').fill(code);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.locator('.wb-shell')).toBeVisible();
    const client=await login(origin);
    const account=(await client.request('GET','/api/workbench/context')).json.accountKey;
    const q=await mutate(client,'POST','/api/modules/questions/items',manualQuestionSample({title:'独立验收：抛物线顶点',note:'恢复后仍需讨论配方法'}));
    const original=fs.readFileSync(path.join(repo,'apps/web/e2e/fixtures/materials-questions/figure.png'));
    const boundary='acceptance-'+randomUUID();
    const multipart=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="抛物线原图.png"\r\nContent-Type: image/png\r\n\r\n`),original,Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const uploaded=await client.request('POST','/api/workbench/files',{rawBody:multipart,contentType:`multipart/form-data; boundary=${boundary}`,headers:{'Idempotency-Key':randomUUID()}}); assert.equal(uploaded.status,201,uploaded.text);
    const file=uploaded.json;
    const resource=await mutate(client,'POST','/api/modules/resources/items',{title:'抛物线课件原图',fileId:file.id,folderId:null,tagIds:[],note:'保留中文原文件名和字节'});
    const math=await mutate(client,'POST','/api/modules/math/v1/works',{title:'顶点公式',source:{...emptySource('formula'),latex:'y=(x-2)^2-3'},originalFileId:null});
    const lesson=await mutate(client,'POST','/api/modules/lessons/v3',lessonSample({title:'第一课：从图像到顶点',sections:[{id:randomUUID(),title:'图像观察',content:{version:1,blocks:[{type:'paragraph',runs:[{type:'text',text:'观察顶点位置并对照原图。'}]}]},references:[{id:randomUUID(),kind:'question',questionId:q.id,questionVersion:q.version,note:'题目快照'},{id:randomUUID(),kind:'resource',resourceId:resource.id,resourceVersion:resource.version,note:'资源快照'},{id:randomUUID(),kind:'math',workId:math.id,workVersion:math.version,note:'公式快照'}]}]}));
    const lesson2=await mutate(client,'POST','/api/modules/lessons/v3',lessonSample({title:'第二课：配方法练习'}));
    const orderBefore=(await client.request('GET','/api/modules/lessons/v3/order')).json;
    const order=await mutate(client,'PUT','/api/modules/lessons/v3/order',{baseVersion:orderBefore.version,lessonIds:[lesson.id,lesson2.id]});
    const klass=await mutate(client,'POST','/api/modules/classes/items',{name:'七年级一班'});
    const record=await mutate(client,'POST','/api/modules/classes/v2/records',{classId:klass.id,recordedOn:'2026-09-23',note:'图像与配方法联系需要再练习',position:'第一课',unfinished:'配方练习',commonIssues:'顶点符号',nextNote:'第二课对比练习',sources:[{kind:'question',id:q.id},{kind:'lesson',id:lesson.id},{kind:'math',id:math.id}]});
    const entry=await mutate(client,'POST','/api/modules/schedule/entries',{title:'一班顶点复习',items:[],time:{date:'2026-09-23',startTime:'09:00',durationMinutes:45,timeZone:'Asia/Shanghai'},repeat:null,course:{classId:klass.id,lessonId:lesson.id,recordIds:[record.id]},reminder:null});
    const endpoints=[`/api/modules/questions/v2/items/${q.id}`,`/api/modules/lessons/v3/${lesson.id}`,`/api/modules/lessons/v3/${lesson2.id}`,'/api/modules/lessons/v3/order',`/api/modules/resources/items/${resource.id}`,`/api/modules/math/v1/works/${math.id}`,`/api/modules/classes/items/${klass.id}`,`/api/modules/classes/v2/records/${record.id}`,`/api/modules/schedule/entries/${entry.id}`,`/api/workbench/files/${file.id}`];
    // User restores a deleted question from Settings; references retain original IDs.
    await mutate(client,'POST',`/api/modules/questions/v2/items/${q.id}/deletion`,{baseVersion:q.version,deleted:true});
    await page.locator('.wb-sidebar').getByRole('link',{name:'设置',exact:true}).click();
    await expect(page.getByRole('list',{name:'已删除资料'})).toContainText(q.title);
    await page.getByRole('list',{name:'已删除资料'}).getByRole('button',{name:'恢复',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('已恢复');
    await page.getByRole('button',{name:'导出个人资料',exact:true}).click();await expect(page.getByRole('button',{name:'下载资料包',exact:true})).toBeVisible();
    const downloadWait=page.waitForEvent('download');await page.getByRole('button',{name:'下载资料包',exact:true}).click();const download=await downloadWait;
    const zipPath=path.join(evidence,'independent-personal.zip');await download.saveAs(zipPath);
    const zip=await JSZip.loadAsync(fs.readFileSync(zipPath));const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
    for(const f of manifest.files){const bytes=await zip.file(f.path).async('nodebuffer');assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);}
    const archiveOriginal=manifest.files.find(f=>f.displayName==='抛物线原图.png');assert(archiveOriginal);assert.deepEqual(await zip.file(archiveOriginal.path).async('nodebuffer'),original);
    assert(manifest.relations.some(r=>r.from.id===lesson.id&&r.to.id===resource.id));assert(manifest.relations.some(r=>r.from.id===entry.id&&r.to.id===record.id));
    const offlineDirectory=path.join(directory,'offline');for(const f of Object.values(zip.files)){if(!f.dir){const target=path.join(offlineDirectory,f.name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await f.async('nodebuffer'));}}
    const offlineContext=await browser.newContext({offline:true,viewport:{width:1280,height:900}});const offline=await offlineContext.newPage();
    await offline.goto(pathToFileURL(path.join(offlineDirectory,'index.html')).href);await offline.getByRole('link',{name:lesson.title,exact:true}).click();await expect(offline.getByText('观察顶点位置并对照原图。',{exact:true})).toBeVisible();
    await offline.screenshot({path:path.join(evidence,'offline-lesson.png'),fullPage:true});
    await offline.getByRole('link',{name:/抛物线课件原图/}).click();await expect(offline.getByRole('heading',{name:'抛物线课件原图',exact:true})).toBeVisible();
    await offlineContext.close();await page.screenshot({path:path.join(evidence,'independent-settings.png'),fullPage:true});
    note('UI-export-offline-and-restore',{status:'PASS',zipSha256:sha(fs.readFileSync(zipPath)),objects:manifest.objects.length,files:manifest.files.length,relations:manifest.relations.length,originalSha256:sha(original),offline:true});
    const before={};for(const url of endpoints){const r=await client.request('GET',url);assert.equal(r.status,200,r.text);before[url]=r.json;}
    const oldCookie=client.jar.header(),oldPage=client.pageId;
    const contextBefore=(await client.request('GET','/api/reliability/v1/context')).json;
    await page.evaluate(account=>localStorage.setItem(`tb.workbench.v1:${account}:draft:independent`,JSON.stringify({text:'恢复前尚未提交的配方教学想法',pending:{key:'independent-old-intent'}})),account);
    await stop();const beforeDigest=tableDigest(directory);const originalDbHash=sha(fs.readFileSync(path.join(directory,'workspace.sqlite')));
    const backup=directory+'-backup',restored=directory+'-restored';
    cli(['backup','--database',path.join(directory,'workspace.sqlite'),'--files',path.join(directory,'files'),'--target',backup,'--stopped']);
    const backupHash=sha(fs.readFileSync(path.join(backup,'workspace.sqlite')));
    assert.deepEqual(tableDigest(backup),beforeDigest);
    const restoredReceipt=cli(['restore','--source',backup,'--target',restored,'--stopped']);assert.notEqual(restoredReceipt.recoveryId,contextBefore.recoveryId);
    assert.deepEqual(tableDigest(restored),beforeDigest);
    const db=new Database(path.join(restored,'workspace.sqlite'),{readonly:true});assert(db.prepare("SELECT 1 FROM workbench_migrations WHERE id='lessons_0003_order'").get());const storedOrder=db.prepare('SELECT * FROM lesson_order WHERE accountKey=?').get(account);db.close();assert.deepEqual(JSON.parse(storedOrder.lessonIds),order.lessonIds);
    cli(['activate','--target',restored,'--stopped']);
    origin=await start(restored,port);
    const anonymous=createClient(origin,{transport:https});assert.equal((await anonymous.request('GET','/api/workbench/context',{cookie:oldCookie,page:oldPage})).status,401);
    await page.goto(origin+'/settings');await expect(page.getByRole('heading',{name:'登录',exact:true})).toBeVisible();
    await page.getByLabel('邮箱',{exact:true}).fill('independent-data@example.test');await page.getByLabel('密码',{exact:true}).fill('Manual-data-123');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.locator('.wb-shell')).toBeVisible();
    const restoredClient=await login(origin);assert.equal((await restoredClient.request('GET','/api/workbench/context')).json.accountKey,account);
    for(const url of endpoints){const r=await restoredClient.request('GET',url);assert.equal(r.status,200,r.text);assert.deepEqual(r.json,before[url],url);}
    const response=await context.request.get(origin+`/api/workbench/files/${file.id}/content`,{headers:{Cookie:restoredClient.jar.header(),'X-TeachBuddy-Page':restoredClient.pageId}});assert.equal(response.status(),200);assert.deepEqual(await response.body(),original);
    await page.locator('.wb-sidebar').getByRole('link',{name:'设置',exact:true}).click();await expect(page.getByRole('heading',{name:'恢复前的本设备草稿'})).toBeVisible();await page.getByText(/项设备记录/).click();await expect(page.getByText(/恢复前尚未提交的配方教学想法/)).toBeVisible();
    await page.screenshot({path:path.join(evidence,'independent-recovered-draft.png'),fullPage:true});
    await page.locator('.wb-sidebar').getByRole('link',{name:'备课',exact:true}).click();await expect(page.getByText(lesson.title,{exact:true}).first()).toBeVisible();await expect(page.getByText(lesson2.title,{exact:true}).first()).toBeVisible();
    await page.screenshot({path:path.join(evidence,'independent-restored-lessons.png'),fullPage:true});
    const restartCookie=restoredClient.jar.header(),restartPage=restoredClient.pageId;
    await stop();origin=await start(restored,port);assert.equal((await createClient(origin,{transport:https}).request('GET','/api/workbench/context',{cookie:restartCookie,page:restartPage})).status,200);
    assert.equal(sha(fs.readFileSync(path.join(directory,'workspace.sqlite'))),originalDbHash);assert.equal(sha(fs.readFileSync(path.join(backup,'workspace.sqlite'))),backupHash);
    note('CLI-combination-restore',{status:'PASS',source:directory,backup,restored,oldCookieStatus:401,newCookieAfterOrdinaryRestart:200,accountKeyPreserved:true,migration:'lessons_0003_order',storedOrder,tableDigests:beforeDigest,originalDbHash,backupHash,restoredFilesSha256:sha(original),publicObjectsCompared:endpoints.length});
    await stop();await context.close();context=null;await browser.close();browser=null;
    note('complete',{status:'PASS',finishedAt:new Date().toISOString()});
  } catch(error) { note('failure',{message:error.message,stack:error.stack}); if(context){const pages=context.pages();if(pages[0])await pages[0].screenshot({path:path.join(evidence,'independent-failure.png'),fullPage:true}).catch(()=>{});}throw error; }
  finally { if(child)await stop();if(browser)await browser.close(); }
}
