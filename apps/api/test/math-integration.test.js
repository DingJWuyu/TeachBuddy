import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
const works = '/api/modules/math/v1/works';
async function harness() {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'m43-api-'));
 let runtime;
 const start = async () => {runtime=createApp({env:{nodeEnv:'test',sqlitePath:path.join(dir,'workspace.sqlite'),workbench:{mode:'test-principal',testPrincipals:['m43-a','m43-b'],sessionSecret:'m43-isolated',trustedOrigins:['http://localhost'],logDir:path.join(dir,'logs')}}});await runtime.workbench.initialize();};
 await start();
 return {dir, send(method,url,body,key=randomUUID(),account='m43-a') { let r=request(runtime.app)[method](url).set('Cookie',runtime.workbench.identity.testPrincipalCookie(account).header.split(';')[0]).set('Origin','http://localhost').set('X-TeachBuddy-Request','1').set('Idempotency-Key',key);return body===undefined?r:r.send(body);},async restart(){await runtime.dataStore.close();await start();},async close(){await runtime.dataStore.close();}};
}
test('real composition preserves math versions, account isolation and replay after restart',async()=>{
 const h=await harness();try {
 const catalog=await h.send('get','/api/modules');assert.equal(catalog.body.version,3);
 const sample=JSON.parse(fs.readFileSync(new URL('./fixtures/contracts/math-samples.json',import.meta.url))).find(c=>c.id==='create-formula').value;
 const key=randomUUID();const work=await h.send('post',works,sample,key);assert.equal(work.status,201,JSON.stringify(work.body));
 const edited=await h.send('put',`${works}/${work.body.id}`,{baseVersion:1,title:'新版本',source:work.body.source});assert.equal(edited.status,200);
 assert.equal((await h.send('get',`${works}/${work.body.id}`,undefined,randomUUID(),'m43-b')).status,404);
 await h.restart();assert.deepEqual((await h.send('post',works,sample,key)).body,work.body);
 assert.deepEqual((await h.send('get',`${works}/${work.body.id}/versions/1`)).body.source,work.body.source);
 assert.equal((await h.send('get',`${works}/${work.body.id}`)).body.title,'新版本');
 }finally{await h.close();}
});

test('MC06/10: real classes reverse links preserve linked labels',async()=>{
 const h=await harness();try {
 const sample=JSON.parse(fs.readFileSync(new URL('./fixtures/contracts/math-samples.json', import.meta.url),'utf8')).find(c=>c.id==='create-plane').value;
 const work=(await h.send('post',works,sample)).body;
 const c=await h.send('post','/api/modules/classes/items',{name:'高一一班'});assert.equal(c.status,201,JSON.stringify(c.body));
 const recordInput={classId:c.body.id,recordedOn:'2026-09-22',note:'斜率易错',position:'',unfinished:'',commonIssues:'',nextNote:'',sources:[{kind:'math',id:work.id}]};
 const record=await h.send('post','/api/modules/classes/v2/records',recordInput);assert.equal(record.status,201,JSON.stringify(record.body));
 const renamed=await h.send('put',`${works}/${work.id}`,{baseVersion:1,title:'新图名',source:work.source});assert.equal(renamed.status,200);
 const linked=await h.send('get',`/api/modules/classes/v2/records/${record.body.id}`);assert.equal(linked.body.sources[0].labelAtLink,'plane');assert.equal(linked.body.sources[0].currentLabel,'新图名');
 await h.send('post',`${works}/${work.id}/deletion`,{baseVersion:2,deleted:true});
 const reverse=await h.send('get',`/api/modules/classes/v2/source-records/math/${work.id}`);assert.equal(reverse.status,200);assert.equal(reverse.body.items[0].id,record.body.id);
 await h.restart();assert.equal((await h.send('get',`/api/modules/classes/v2/records/${record.body.id}`)).body.sources[0].deleted,true);
 }finally{await h.close();}
});
