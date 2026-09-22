import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Independent scenario driver. Only the existing fixture supplies app wiring.
const root = process.env.CANDIDATE;
const out = process.env.EVIDENCE;
const data = process.env.RUN_DATA;
if (!root || !out || !data) throw Error('CANDIDATE, EVIDENCE, RUN_DATA required; use new directories');
fs.mkdirSync(out, {recursive:true});
const { startQuestionsFixture } = await import(pathToFileURL(path.join(root,'apps/web/e2e/fixtures/materials-questions/server.mjs')));
const { default: sharp } = await import(pathToFileURL(path.join(root,'node_modules/sharp/dist/index.mjs')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(out,name), JSON.stringify(value,null,2));
const record = row => fs.appendFileSync(path.join(out,'http.ndjson'),JSON.stringify({at:new Date().toISOString(),...row})+'\n');
const fixture = name => fs.readFileSync(path.join(root,'apps/web/e2e/fixtures/materials-questions',name));
let queue = [], calls = 0, generation = 0;
const provider = { extract: async () => {
  assert.ok(queue.length, 'Unexpected local Provider call');
  calls++;
  return {content:queue.shift()};
}};
let runtime;
async function start() {
  runtime = await startQuestionsFixture({dataDir:data,port:0,provider});
  record({event:'listen',generation:++generation,address:runtime.server.address(),identity:'test-principal'});
}
async function close() {
  record({event:'closing',generation});
  runtime.server.closeAllConnections();
  await runtime.close();
  record({event:'closed',generation});
}
async function request(route,body=null,method=body?'POST':'GET') {
  const origin = `http://localhost:${runtime.server.address().port}`;
  const headers = {Cookie:runtime.workbench.identity.testPrincipalCookie('r33-a').header.split(';')[0],Origin:'http://localhost:0','X-TeachBuddy-Request':'1','Idempotency-Key':randomUUID()};
  if (!(body instanceof FormData)) headers['Content-Type']='application/json';
  const entry={route,method,generation,request:body instanceof FormData?'multipart file':body};
  try {
    const r = await fetch(origin+route,{method,headers,...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
    const result=route.endsWith('/content')?Buffer.from(await r.arrayBuffer()):await r.json();
    record({...entry,status:r.status,response:Buffer.isBuffer(result)?{bytes:result.length,sha256:sha(result)}:result});
    assert.ok(r.ok,JSON.stringify(result)); return result;
  } catch (e) {record({...entry,error:e.message,cause:e.cause?{message:e.cause.message,code:e.cause.code,stack:e.cause.stack}:null});throw e;}
}
async function done(id) {
  const deadline=Date.now()+120000;
  while(Date.now()<deadline){const j=await request('/api/workbench/jobs/'+id);if(!['queued','running','cancelling'].includes(j.state))return j;await new Promise(r=>setTimeout(r,80));}
  throw Error('Job deadline exceeded '+id);
}
async function upload(bytes,name){const f=new FormData();f.append('file',new Blob([bytes]),name);return request('/api/workbench/files',f);}
const q='/api/modules/questions/v2';
const doc = text => ({version:2,blocks:text?[{type:'paragraph',runs:[{type:'text',text}]}]:[]});
const fragment = text => ({role:'question',label:'1.',section:'',group:'',text,content:[{text}],continues:'',doubts:[]});
const retained=[];
const results=[];
await start();
try {
  const prefix='{"fragments":['+JSON.stringify(fragment('R35完整前缀：求函数的定义域。'))+',{"role":"question","text":"未完整尾部';
  const cases=[
    ['empty',[''],'failed',0,0],
    ['whitespace',[' \n\t  '],'failed',0,0],
    ['all-empty',['',''],'failed',0,0],
    ['invalid',['not JSON'],'partial',0,1],
    ['prefix',[prefix],'partial',1,1],
    ['mixed-success-first',[JSON.stringify({fragments:[fragment('R35成功页：求交集。')]}),''],'partial',1,0],
    ['mixed-empty-first',['',JSON.stringify({fragments:[fragment('R35后页：求并集。')]})],'partial',1,0],
    ['historical-prefix',[fixture('attempt4/old-page-2.content.txt').toString()],'partial',0,1],
  ];
  for(const [name,responses,state,drafts,fragments] of cases){
    queue=[...responses];const before=calls;const sources=[];
    for(let i=0;i<responses.length;i++){
      const bytes=fixture(name==='historical-prefix'?'attempt4/old-page-2.png':'figure.png');
      const f=await upload(bytes,`${name}-${i+1}.png`);sources.push({id:f.id,sha256:sha(bytes)});
    }
    const created=await request(q+'/imports',{title:'独立受控 '+name,origin:'local adapter only',input:{kind:'files',fileIds:sources.map(f=>f.id),pages:[]}});
    const job=await done(created.jobId), material=await request(q+'/imports/'+created.id);
    write(`extraction-${name}.json`,{inputBodies:responses,job,material,sources,calls:calls-before});
    assert.equal(job.state,state);assert.equal(material.drafts.length,drafts);assert.equal(material.fragments.length,fragments);assert.equal(calls-before,responses.length);
    if(!drafts&&!fragments) assert.ok(job.issues.some(i=>i.code==='empty-response'));
    if(name==='invalid')assert.equal(material.fragments[0].text,'not JSON');
    if(name==='prefix')assert.ok(JSON.stringify(material.drafts[0].body).includes('R35完整前缀'));
    if(name.startsWith('mixed'))assert.ok(JSON.stringify(material.drafts[0].body).includes(name.endsWith('first')&&name.includes('success')?'R35成功页':'R35后页'));
    if(name==='historical-prefix'){assert.equal(material.fragments[0].text,'第2页 · 原题');assert.ok(job.issues.some(i=>i.code==='truncated-response'));}
    for(const source of sources)assert.equal(sha(await request('/api/workbench/files/'+source.id+'/content')),source.sha256);
    retained.push({name,material,job,sources});results.push({name,state,drafts,fragments,result:'PASS'});
  }
  const item = async (title,blocks,answer='')=>request(q+'/items',{title,source:{kind:'manual'},note:'R35_PRIVATE_MUST_NOT_RENDER',starred:false,typeId:null,tagIds:[],answerStatus:answer?'present':'absent',solution:doc(answer),body:{version:2,blocks}});
  async function asset(name,question,mode='question-png',figureFileId=null,includeAnswers=false){
    const accepted=await request(q+'/items/'+question.id+'/assets',{baseVersion:question.version,includeAnswers,mode,figureFileId});const job=await done(accepted.id);
    assert.equal(job.state,'succeeded');const files=[];
    for(const [i,id] of job.outputFileIds.entries()){
      const bytes=await request('/api/workbench/files/'+id+'/content');const file=`${name}-${i}.png`;fs.writeFileSync(path.join(out,file),bytes);
      const meta=await sharp(bytes).metadata();const {data:rgba,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      let transparent=0, visible=0;for(let j=3;j<rgba.length;j+=4){if(rgba[j]===0)transparent++;else visible++;}
      const row={file,id,width:meta.width,height:meta.height,alpha:meta.hasAlpha,transparent,visible,sha256:sha(bytes)};files.push(row);
      assert.equal(meta.width,1600);assert.ok(meta.height<=2400);assert.ok(meta.hasAlpha&&transparent>0&&visible>0);
    }
    write(name+'.json',{question,job,files});return {question,job,files};
  }
  const long=await item('local3 长题分片',Array.from({length:36},(_,i)=>[...doc('第'+(i+1)+'段 长题分片可见边界').blocks,{type:'math',latex:'f(x)=\\frac{\\sqrt{2x-1}}{x-2}'}]).flat());
  const longResult=await asset('long',long);assert.equal(longResult.files.length,3);results.push({name:'long',files:longResult.files,result:'PASS'});
  const picture=async height=>upload(await sharp({create:{width:1504,height,channels:4,background:'#1267ab'}}).png().toBuffer(),`boundary-${height}.png`);
  const first=await picture(1000);
  for(const target of [2399,2400,2401]){
    const second=await picture(target-1112);const question=await item('边界 '+target,[first,second].map(f=>({type:'image',fileId:f.id,alt:'高度边界色块',widthMm:100})));
    const a=await asset('boundary-'+target,question);assert.equal(a.files.length,target<=2400?1:2);if(target<=2400)assert.equal(a.files[0].height,target);results.push({name:'boundary-'+target,heights:a.files.map(f=>f.height),result:'PASS'});
  }
  const tall=await picture(5000);const tallQ=await item('超高单图',[{type:'image',fileId:tall.id,alt:'超高图',widthMm:100}]);
  for(const mode of ['question-png','figure-png']){const a=await asset('tall-'+mode,tallQ,mode,mode==='figure-png'?tall.id:null);assert.equal(a.files.length,1);assert.equal(a.files[0].height,2292);}
  const real=await upload(fixture('figure.png'),'triangle.png');
  const math=await item('实际数学与配图',[...doc('独立复验：求下列函数定义域，并观察三角形。').blocks,{type:'math',latex:'f(x)=\\frac{\\sqrt{2x-1}}{x-2}'},{type:'image',fileId:real.id,alt:'三角形',widthMm:100}], 'ANSWER_ONLY_SEPARATE');
  await asset('math-figure',math);await asset('figure-only',math,'figure-png',real.id);const withAnswer=await asset('math-with-answer',math,'question-png',null,true);assert.equal(withAnswer.files.length,2);
  // Restart the same independently created database once, then verify retained payloads and originals.
  const beforeRestart=calls;await close();await start();
  for(const r of retained){assert.deepEqual(await request(q+'/imports/'+r.material.id),r.material);assert.deepEqual(await request('/api/workbench/jobs/'+r.job.id),r.job);for(const s of r.sources)assert.equal(sha(await request('/api/workbench/files/'+s.id+'/content')),s.sha256);}
  for(const f of longResult.files)assert.equal(sha(await request('/api/workbench/files/'+f.id+'/content')),f.sha256);
  assert.equal(calls,beforeRestart);write('results.json',{results,restart:'PASS',localProviderCalls:calls,productModelRequests:0,productKeyReads:0,data,finishedAt:new Date().toISOString()});
  console.log(JSON.stringify({result:'PASS',scenarios:results.length,restart:'PASS',localProviderCalls:calls}));
} catch(e){write('failure.json',{message:e.message,stack:e.stack,cause:e.cause});throw e;}
finally{await close();}
