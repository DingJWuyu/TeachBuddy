import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
 return {dir,send(method,url,body,key=randomUUID(),account='m43-a') { let r=request(runtime.app)[method](url).set('Cookie',runtime.workbench.identity.testPrincipalCookie(account).header.split(';')[0]).set('Origin','http://localhost').set('X-TeachBuddy-Request','1').set('Idempotency-Key',key);return body===undefined?r:r.send(body);},async restart(){runtime.dataStore.close();await start();},close(){runtime.dataStore.close();}};
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
 const edit=await h.send('put',`${works}/${work.body.id}`,{baseVersion:1,title:'新版本',source:work.body.source});assert.equal(edit.status,200,JSON.stringify(edit.body));
 const current=await h.send('get',`${lessons}/${old.body.id}`);assert.deepEqual(current.body.sections[0].references[0].snapshot,snapshot);assert.equal(current.body.sections[0].references[0].latestVersion,2);
 for(const [method,url,payload] of [['get',`/api/modules/lessons/v2/items/${old.body.id}`],['get','/api/modules/lessons/v2/items'],['put',`/api/modules/lessons/v2/items/${old.body.id}`,{...input,baseVersion:2}]]) {const r=await h.send(method,url,payload);assert.equal(r.status,422,JSON.stringify(r.body));assert.equal(r.body.reason,'unsupported-content-version');}
 const replay=await h.send('post','/api/modules/lessons/v2/items',input,oldKey);assert.deepEqual(replay.body,old.body);
 const usages=await h.send('get',`${lessons}/usages?kind=math&id=${work.body.id}`);assert.equal(usages.body.items[0].sectionId,input.sections[0].id);
 assert.equal((await h.send('get',`${lessons}/${old.body.id}`,undefined,randomUUID(),'m43-b')).status,404);
 await h.restart();assert.deepEqual((await h.send('put',`${lessons}/${old.body.id}`,body,key)).body,saved.body);
 assert.deepEqual((await h.send('get',`${lessons}/${old.body.id}`)).body.sections[0].references[0].snapshot,snapshot);
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
