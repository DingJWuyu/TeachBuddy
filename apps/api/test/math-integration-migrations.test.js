import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import request from 'supertest';
import {createApp} from '../src/app.js';
const evidence=new URL('../../../docs/acceptance/evidence/M43/v1/',import.meta.url);
fs.mkdirSync(evidence,{recursive:true});
const digest=value=>createHash('sha256').update(value).digest('hex');
function businessState(file){
 const db=new Database(file,{readonly:true});
 try{return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'lesson_%' OR name LIKE 'question_%' OR name LIKE 'resource_%' OR name LIKE 'math_%' OR name='materials_files' OR name='workbench_mutation_keys') ORDER BY name").all().map(({name})=>[name,digest(JSON.stringify(db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()))]));}finally{db.close();}
}
for(const [name,source,file,account] of [
 ['P',process.env.M43_P_LIBRARY??'/tmp/teacher-r34-attempt5','workspace.sqlite',null],
 ['M',process.env.M43_M_LIBRARY??'/tmp/m43-original-m-library','workbench.sqlite','m41-a']
])test(`MC11: fixed ${name} library copy preserves rows, files and receipts across two restarts`,async()=>{
 assert.ok(fs.existsSync(path.join(source,file)),`Required retained source: ${source}`);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(), `m43-migration-${name}-`));fs.cpSync(source,directory,{recursive:true});
 const sqlitePath=path.join(directory,file);const before=businessState(sqlitePath);const original=businessState(path.join(source,file));
 const inspect=new Database(sqlitePath,{readonly:true});
 const owner=account??inspect.prepare('SELECT accountKey FROM lesson_items LIMIT 1').get().accountKey;inspect.close();
 const fileHashes={};
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else fileHashes[path.relative(directory,f)]=digest(fs.readFileSync(f));}}
 if(fs.existsSync(path.join(directory,'files')))walk(path.join(directory,'files'));
 const results=[];
 for(let i=0;i<2;i++){
  const runtime=createApp({env:{nodeEnv:'test',sqlitePath,workbench:{mode:'test-principal',testPrincipals:[owner],sessionSecret:'m43-migration',trustedOrigins:['http://localhost'],filesDir:path.join(directory,'files'),logDir:path.join(directory,'logs')}}});
  try{
   await runtime.workbench.initialize();
   const cookie=runtime.workbench.identity.testPrincipalCookie(owner).header.split(';')[0];
   const get=url=>request(runtime.app).get(url).set('Cookie',cookie);
   assert.equal((await get('/api/modules')).body.version,3);
   if(name==='P'){
    const lessons=await get('/api/modules/lessons/v3');assert.equal(lessons.status,200);assert.ok(lessons.body.items.length>0);results.push({lessons:lessons.body.items.map(({id,version})=>({id,version}))});
   }else{
    const seed=JSON.parse(fs.readFileSync(path.join(directory,'seed.json')));
    for(const {input,key,body} of seed){
     assert.deepEqual((await get(`/api/modules/math/v1/works/${body.id}`)).body,body);
     const replay=await request(runtime.app).post('/api/modules/math/v1/works').set('Cookie',cookie).set('Origin','http://localhost').set('X-TeachBuddy-Request','1').set('Idempotency-Key',key).send(input);
     assert.equal(replay.status,201);assert.deepEqual(replay.body,body);
     for(const id of [body.render.posterFileId,body.render.presentationFileId].filter(Boolean))assert.equal((await get(`/api/workbench/files/${id}/content`)).status,200);
    }
    results.push({works:seed.map(({body})=>({id:body.id,version:body.version,render:body.render}))});
   }
  }finally{runtime.dataStore.close();}
  const after=businessState(sqlitePath);
  for(const [table,hash] of Object.entries(before))assert.equal(after[table],hash,table);
 }
 for(const [name,hash] of Object.entries(fileHashes))assert.equal(digest(fs.readFileSync(path.join(directory,name))),hash);
 assert.deepEqual(businessState(path.join(source,file)),original);
 fs.writeFileSync(new URL(`migration-${name}.json`,evidence),JSON.stringify({source,directory,identity:'test-principal',account:owner,before,results,fileHashes,sourceUnchanged:true},null,2));
});
