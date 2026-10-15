import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import JSZip from 'jszip';
import {createIntegration} from './fixtures/auth-integration/harness.js';
import {registerMath} from './fixtures/math-real.mjs';

async function legacy(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'questions-legacy-'));
  let runtime=await createIntegration({directory});
  const clients={};
  for(const name of ['r33-a','r33-b']) clients[name]=(await registerMath(runtime,`${name}@example.test`)).client;
  t.after(()=>runtime.close());
  async function request(route,body,method=body===undefined?'GET':'POST',expected,principal='r33-a') {
    let options={body,headers:{'Idempotency-Key':randomUUID(),Connection:'close'}};
    if(body instanceof FormData){
      const encoded=new Response(body);
      options={headers:options.headers,contentType:encoded.headers.get('content-type'),rawBody:Buffer.from(await encoded.arrayBuffer())};
    }
    const response=await clients[principal].request(method,route,options);
    const result=response.json;
    if(expected) assert.equal(response.status,expected,JSON.stringify(result));
    else assert.ok(response.status>=200&&response.status<300,JSON.stringify(result));
    return result;
  }
  return {directory,request,async finish(id){for(let n=0;n<800;n++){const j=await request('/api/workbench/jobs/'+id);if(!['queued','running','cancelling'].includes(j.state))return j;await new Promise(r=>setTimeout(r,50));}throw Error('job timeout');},async restart(){const port=Number(new URL(runtime.origin).port);await runtime.close();runtime=await createIntegration({directory,port});},get runtime(){return runtime}};
}

test('legacy DOC preserves existing equation objects, figures and fixed conversion paragraphs through review and restart',async t=>{
  const h=await legacy(t);
  const bytes=fs.readFileSync(new URL('../../../test/fixtures/materials/w.doc',import.meta.url));
  const form=new FormData();form.append('file',new Blob([bytes]),'legacy.doc');
  const file=await h.request('/api/workbench/files',form);
  const created=await h.request('/api/modules/questions/v2/imports',{title:'旧版数学资料',origin:'固定真实 DOC',input:{kind:'files',fileIds:[file.id],pages:[]}});
  const job=await h.finish(created.jobId);
  assert.ok(['succeeded','partial'].includes(job.state),JSON.stringify(job));
  const material=await h.request('/api/modules/questions/v2/imports/'+created.id);
  assert.equal(material.drafts.length,6);
  assert.match(JSON.stringify(material.drafts[0].body),/\\\\frac/);
  assert.match(JSON.stringify(material.drafts[0].body),/\\\\sqrt/);
  assert.ok(!JSON.stringify(material.drafts[0].body).includes('frac{1}{2,2}'), 'linear Office fractions must retain the visible interval endpoint');
  assert.deepEqual(material.drafts.map(q=>q.body.blocks.filter(b=>b.type==='image').length),[0,1,0,0,1,1]);
  assert.equal(material.drafts[5].answerStatus,'present','this Office original actually contains Q6 answers');
  assert.match(JSON.stringify(material.drafts[5].solution),/\\\\sqrt/);
  assert.ok(!JSON.stringify(material.drafts[2].body).includes('ax+1'),'missing original cases must not be invented');
  assert.ok(material.originalDocuments[0].paragraphs.length>20);
  assert.ok(material.drafts.flatMap(d=>d.parts).flatMap(p=>p.locations).every(l=>l.kind==='docx'&&l.fileId===file.id));
  const preview=await h.request(`/api/workbench/files/${file.id}/preview`);
  assert.equal(preview.state,'limited');assert.ok(preview.issues.includes('legacy-object-loss'));
  const invalid = structuredClone(material.drafts);
  invalid[0].parts[0].locations[0].runEnd = 99999;
  const route = `/api/modules/questions/v2/imports/${material.id}`;
  await h.request(route,{baseVersion:material.version,drafts:invalid,fragments:material.fragments},'PUT',422);
  await h.request(route,undefined,'GET',404,'r33-b');
  invalid[0].parts[0].locations[0] = {...material.drafts[0].parts[0].locations[0],fileId:job.outputFileIds[0]};
  await h.request(route,{baseVersion:material.version,drafts:invalid,fragments:material.fragments},'PUT',422);
  const first=material.drafts[0];first.body.blocks[0].runs.push({type:'text',text:'本课对照练习'});
  const saved=await h.request(`/api/modules/questions/v2/imports/${material.id}`,{baseVersion:material.version,drafts:material.drafts,fragments:material.fragments},'PUT');
  await h.restart();
  const reopened=await h.request(`/api/modules/questions/v2/imports/${material.id}`);
  assert.deepEqual(reopened.originalDocuments,material.originalDocuments);
  assert.deepEqual(reopened.drafts,saved.drafts);
  const exported=await h.request('/api/reliability/v1/exports',{});
  let ready;
  for(let n=0;n<300;n++){
    ready=await h.request('/api/reliability/v1/exports/'+exported.id);
    if(!['queued','running'].includes(ready.state))break;
    await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(ready.state,'ready',JSON.stringify(ready));
  const zip=await JSZip.loadAsync(fs.readFileSync(path.join(h.directory,'personal-exports',exported.id+'.zip')));
  const supplemental=JSON.parse(await zip.file('data/supplemental.json').async('string'));
  const evidence=supplemental.questionRecognitionEvidence.find(e=>e.importId===material.id);
  assert.deepEqual(evidence.originalDocuments[file.id],material.originalDocuments[0].paragraphs);
  const source=evidence.nativeWordSources[file.id];
  assert.equal(source.originalSha256,createHash('sha256').update(bytes).digest('hex'));
  const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
  for(const id of [file.id,source.fileId,...material.drafts.flatMap(d=>d.body.blocks.filter(b=>b.type==='image').map(b=>b.fileId))]){
    const entry=manifest.files.find(f=>f.path.startsWith(`files/${id}/`));assert.ok(entry,id);
    const attached=await zip.file(entry.path).async('nodebuffer');
    assert.equal(createHash('sha256').update(attached).digest('hex'),entry.sha256);
    if(id===file.id)assert.deepEqual(attached,bytes);
    if(id===source.fileId){assert.equal(entry.sha256,source.sha256);const docx=await JSZip.loadAsync(attached);assert.ok(docx.file('word/document.xml'));}
  }
  if(process.env.LEGACY_DOC_EVIDENCE){
    const destination=path.resolve(process.env.LEGACY_DOC_EVIDENCE);
    fs.mkdirSync(destination,{recursive:true});
    fs.copyFileSync(path.join(h.directory,'personal-exports',exported.id+'.zip'),path.join(destination,'personal.zip'));
    fs.writeFileSync(path.join(destination,'material.json'),JSON.stringify(reopened,null,2));
    fs.writeFileSync(path.join(destination,'conversion.json'),JSON.stringify(evidence,null,2));
  }
  t.after(()=>fs.rmSync(h.directory,{recursive:true,force:true}));
});
