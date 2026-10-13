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
 const catalog=await h.send('get','/api/modules');assert.equal(catalog.body.version,4);
 const sample=JSON.parse(fs.readFileSync(new URL('./fixtures/contracts/math-samples.json',import.meta.url))).find(c=>c.id==='create-formula').value;
 const key=randomUUID();const work=await h.send('post',works,sample,key);assert.equal(work.status,201,JSON.stringify(work.body));
 const edited=await h.send('put',`${works}/${work.body.id}`,{baseVersion:1,title:'新版本',source:work.body.source});assert.equal(edited.status,200);
 assert.equal((await h.send('get',`${works}/${work.body.id}`,undefined,randomUUID(),'m43-b')).status,404);
 await h.restart();assert.deepEqual((await h.send('post',works,sample,key)).body,work.body);
 assert.deepEqual((await h.send('get',`${works}/${work.body.id}/versions/1`)).body.source,work.body.source);
 assert.equal((await h.send('get',`${works}/${work.body.id}`)).body.title,'新版本');
 }finally{await h.close();}
});
