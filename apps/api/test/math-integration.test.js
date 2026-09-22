import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
const empty = { version: 1, blocks: [] };
const lessons = '/api/modules/lessons/v3';
const works = '/api/modules/math/v1/works';
async function harness() {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'m43-api-'));
 let runtime;
 const start = async () => {runtime=createApp({env:{nodeEnv:'test',sqlitePath:path.join(dir,'workspace.sqlite'),workbench:{mode:'test-principal',testPrincipals:['m43-a','m43-b'],sessionSecret:'m43-isolated',trustedOrigins:['http://localhost'],logDir:path.join(dir,'logs')}}});await runtime.workbench.initialize();};
 await start();
 return {dir, upload(bytes) { return request(runtime.app).post("/api/workbench/files").set("Cookie",runtime.workbench.identity.testPrincipalCookie("m43-a").header.split(";")[0]).set("Origin","http://localhost").set("X-TeachBuddy-Request","1").set("Idempotency-Key",randomUUID()).attach("file",bytes,"demo.html"); }, send(method,url,body,key=randomUUID(),account='m43-a') { let r=request(runtime.app)[method](url).set('Cookie',runtime.workbench.identity.testPrincipalCookie(account).header.split(';')[0]).set('Origin','http://localhost').set('X-TeachBuddy-Request','1').set('Idempotency-Key',key);return body===undefined?r:r.send(body);},async restart(){runtime.dataStore.close();await start();},close(){runtime.dataStore.close();}};
}
test('MC05/06/11: real composition preserves math snapshots, v2 replay and restart',async()=>{
 const h=await harness();
 try {
 const catalog=await h.send('get','/api/modules');assert.equal(catalog.body.version,3);
 const input={title:'往返课',intro:empty,sections:[{id:randomUUID(),title:'探究',content:empty,references:[]}],materials:[]};
 const oldKey=randomUUID();const old=await h.send('post','/api/modules/lessons/v2/items',input,oldKey);assert.equal(old.status,201,JSON.stringify(old.body));
 const sample=JSON.parse(fs.readFileSync(new URL('../../../docs/contracts/workbench/math/samples.json', import.meta.url),'utf8'));
 const creation=sample.find(c=>c.id==='create-formula');
 assert.ok(creation,'frozen formula sample');
 const work=await h.send('post',works,creation.value);assert.equal(work.status,201,JSON.stringify(work.body));
 const ref={id:randomUUID(),kind:'math',workId:work.body.id,workVersion:1,note:'教师私密备注'};
 const body={...input,baseVersion:1,sections:[{...input.sections[0],references:[ref]}]};
 const key=randomUUID();const saved=await h.send('put',`${lessons}/${old.body.id}`,body,key);assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal(saved.body.sections[0].references[0].snapshot.workVersion,1);
 const snapshot=saved.body.sections[0].references[0].snapshot;
 const second=await h.send("post",lessons,{...body,title:"另一课独立快照",baseVersion:undefined});assert.equal(second.status,201,JSON.stringify(second.body));
 const edit=await h.send('put',`${works}/${work.body.id}`,{baseVersion:1,title:'新版本',source:work.body.source});assert.equal(edit.status,200,JSON.stringify(edit.body));
 const current=await h.send('get',`${lessons}/${old.body.id}`);assert.deepEqual(current.body.sections[0].references[0].snapshot,snapshot);assert.equal(current.body.sections[0].references[0].latestVersion,2);
 for(const [method,url,payload] of [['get',`/api/modules/lessons/v2/items/${old.body.id}`],['get','/api/modules/lessons/v2/items'],['put',`/api/modules/lessons/v2/items/${old.body.id}`,{...input,baseVersion:2}]]) {const r=await h.send(method,url,payload);assert.equal(r.status,422,JSON.stringify(r.body));assert.equal(r.body.reason,'unsupported-content-version');}
 const replay=await h.send('post','/api/modules/lessons/v2/items',input,oldKey);assert.deepEqual(replay.body,old.body);
 const usages=await h.send('get',`${lessons}/usages?kind=math&id=${work.body.id}`);assert.equal(usages.body.items[0].sectionId,input.sections[0].id);
 assert.equal((await h.send('get',`${lessons}/${old.body.id}`,undefined,randomUUID(),'m43-b')).status,404);
 await h.restart();assert.deepEqual((await h.send('put',`${lessons}/${old.body.id}`,body,key)).body,saved.body);
 assert.deepEqual((await h.send('get',`${lessons}/${old.body.id}`)).body.sections[0].references[0].snapshot,snapshot);
 const outdated=await h.send('post',lessons,{...input,materials:[{id:randomUUID(),kind:'math',workId:work.body.id,workVersion:1,note:''}]});assert.equal(outdated.status,409);assert.match(outdated.headers['content-type'],/application\/problem\+json/);
 const adopted=await h.send('put',`${lessons}/${old.body.id}`,{...body,baseVersion:2,sections:body.sections.map(s=>({...s,references:s.references.map(r=>({...r,workVersion:2}))}))});assert.equal(adopted.status,200,JSON.stringify(adopted.body));assert.equal(adopted.body.sections[0].references[0].snapshot.workVersion,2);
 assert.deepEqual((await h.send('get',`${lessons}/${second.body.id}`)).body.sections[0].references[0].snapshot,snapshot);

 } finally {h.close();}
});

test('MC06/10: adopted snapshots survive deletion; real classes reverse links preserve linked labels',async()=>{
 const h=await harness();try {
 const sample=JSON.parse(fs.readFileSync(new URL('../../../docs/contracts/workbench/math/samples.json', import.meta.url),'utf8')).find(c=>c.id==='create-plane').value;
 const work=(await h.send('post',works,sample)).body;
 const ref={id:randomUUID(),kind:'math',workId:work.id,workVersion:1,note:'私密'};
 const input={title:'图形课',intro:empty,sections:[],materials:[ref]};
 const saved=await h.send('post',lessons,input);assert.equal(saved.status,201,JSON.stringify(saved.body));
 const c=await h.send('post','/api/modules/classes/items',{name:'高一一班'});assert.equal(c.status,201,JSON.stringify(c.body));
 const recordInput={classId:c.body.id,recordedOn:'2026-09-22',note:'斜率易错',position:'',unfinished:'',commonIssues:'',nextNote:'',sources:[{kind:'math',id:work.id}]};
 const record=await h.send('post','/api/modules/classes/v2/records',recordInput);assert.equal(record.status,201,JSON.stringify(record.body));
 const renamed=await h.send('put',`${works}/${work.id}`,{baseVersion:1,title:'新图名',source:work.source});assert.equal(renamed.status,200);
 const linked=await h.send('get',`/api/modules/classes/v2/records/${record.body.id}`);assert.equal(linked.body.sources[0].labelAtLink,'plane');assert.equal(linked.body.sources[0].currentLabel,'新图名');
 await h.send('post',`${works}/${work.id}/deletion`,{baseVersion:2,deleted:true});
 const note=await h.send('put',`${lessons}/${saved.body.id}`,{...input,baseVersion:1,materials:[{...ref,note:'保留旧图'}]});assert.equal(note.status,200,JSON.stringify(note.body));assert.deepEqual(note.body.materials[0].snapshot,saved.body.materials[0].snapshot);assert.equal(note.body.materials[0].sourceState,'deleted');
 assert.equal((await h.send('post',lessons,{...input,materials:[{...ref,id:randomUUID()}]})).status,409);
 const reverse=await h.send('get',`/api/modules/classes/v2/source-records/math/${work.id}`);assert.equal(reverse.status,200);assert.equal(reverse.body.items[0].id,record.body.id);
 await h.restart();assert.equal((await h.send('get',`/api/modules/classes/v2/records/${record.body.id}`)).body.sources[0].deleted,true);
 }finally{h.close();}
});


test('MC07: all five math kinds produce real DOCX and PDF without private notes', {timeout:90000}, async()=>{
 const h=await harness();const out=new URL('../../../docs/acceptance/evidence/M43/v1/output/',import.meta.url);fs.mkdirSync(out,{recursive:true});
 try {
  const samples=JSON.parse(fs.readFileSync(new URL('../../../docs/contracts/workbench/math/samples.json',import.meta.url)));
  const references=[];
  for(const kind of ['formula','plane','space','dynamic','html']){
   let input;
   if(kind==='html') {
    const bytes=fs.readFileSync(new URL('../../web/e2e/fixtures/math-dynamic/mx-model-revised.html',import.meta.url));
    const uploaded=await h.upload(bytes);assert.equal(uploaded.status,201,JSON.stringify(uploaded.body));
    input={title:'HTML课堂探究',source:{schemaVersion:1,kind:'html',fileId:uploaded.body.id},originalFileId:uploaded.body.id};
   } else input={...samples.find(s=>s.id===`create-${kind}`).value,title:`${kind}课堂数学`};
   const made=await h.send('post',works,input);assert.equal(made.status,201,JSON.stringify(made.body));
   references.push({id:randomUUID(),kind:'math',workId:made.body.id,workVersion:1,note:'禁止泄漏的课堂私密备注'});
  }
  const lesson=await h.send('post',lessons,{title:'五类数学成果',intro:empty,sections:[],materials:references});assert.equal(lesson.status,201,JSON.stringify(lesson.body));
  const outputs=[];
  for(const kind of ['lesson-plan','handout'])for(const format of ['docx','pdf']){
   const accepted=await h.send('post',`${lessons}/${lesson.body.id}/exports`,{baseVersion:1,kind,format,includeAnswers:false,includeTeacherNotes:false,sectionIds:[],materialReferenceIds:references.map(r=>r.id),answerSpaceLines:4});
   assert.equal(accepted.status,202,JSON.stringify(accepted.body));
   let job;
   for(let i=0;i<300;i++) {job=(await h.send('get',`/api/workbench/jobs/${accepted.body.jobId}`)).body;if(!['queued','running'].includes(job.state))break;await new Promise(r=>setTimeout(r,100));}
   assert.equal(job.state,'succeeded',JSON.stringify(job));
   const result=await h.send('get',`/api/workbench/files/${job.outputFileIds[0]}/content`).buffer(true).parse((response,done)=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>done(null,Buffer.concat(chunks)));});assert.equal(result.status,200);assert.ok(Buffer.isBuffer(result.body));
   const destination=new URL(`${kind}.${format}`,out);fs.writeFileSync(destination,result.body);
   if(format==='pdf') {
    const {execFileSync}=await import('node:child_process');const text=execFileSync('pdftotext',[fileURLToPath(destination),'-'],{encoding:'utf8'});
    assert.ok(text.includes('交互演示见单独文件'));assert.ok(!text.includes('禁止泄漏'));fs.writeFileSync(new URL(`${kind}.txt`,out),text);
   }
   outputs.push({kind,format,fileId:job.outputFileIds[0],bytes:result.body.length});
  }
  const practice=await h.send('post',`${lessons}/${lesson.body.id}/exports`,{baseVersion:1,kind:'practice',format:'docx',includeAnswers:false,includeTeacherNotes:false,sectionIds:[],materialReferenceIds:references.map(r=>r.id),answerSpaceLines:4});assert.equal(practice.status,422);
  fs.writeFileSync(new URL('outputs.json',out),JSON.stringify({directory:h.dir,lesson:lesson.body,outputs},null,2));
 }finally{h.close();}
});
