import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import {backup} from '../src/workbench/reliability/backup.js';
import {createIntegration} from './fixtures/auth-integration/harness.js';
import {registerMath} from '../../web/e2e/fixtures/math-static/real.mjs';

const base='/api/workbench/files';
const fixtures=new URL('./fixtures/mineru-recognition/',import.meta.url);
const captured=id=>JSON.parse(fs.readFileSync(new URL(`${id}/middle_json.json`,fixtures)));
const sources=[{id:'D2',width:1775,height:2425,path:'../../web/e2e/fixtures/materials-questions/recognition-document-4/I-2/page.png'},
  {id:'D8',width:1654,height:2339,path:'./fixtures/ocr-selection/pages/D8.png'}];
const write=(client,url,body)=>client.request('POST',url,{body,headers:{'Idempotency-Key':randomUUID()}});
async function waitJob(client,id) {
  for(let i=0;i<400;i++) {
    const response=await client.request('GET',`/api/workbench/jobs/${id}`);
    assert.equal(response.status,200,response.text);
    if(!['queued','running','cancelling'].includes(response.json.state))return response.json;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw Error('Job did not finish');
}
async function upload(client,source) {
  const boundary='mineru-'+randomUUID(),bytes=fs.readFileSync(new URL(source.path,import.meta.url));
  const response=await client.request('POST',base,{headers:{'Idempotency-Key':randomUUID()},contentType:`multipart/form-data; boundary=${boundary}`,
    rawBody:Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${source.id}.png"\r\nContent-Type: image/png\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)])});
  assert.equal(response.status,201,response.text);return response.json;
}

test('official MinerU typed mathematics and table eq survive HTTP persistence, adoption and question extraction',async()=> {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mineru-recognition-'));
  let world,passed=false;
  const recognizer={revision:'mineru-pro-2605/document-6',async run({width,height}) {
    const source=sources.find(item=>item.width===width&&item.height===height);
    assert(source,'Replay requires the captured source dimensions');
    const raw=captured(source.id),images=new URL(`${source.id}/images/`,fixtures);
    const originalAssets=fs.existsSync(images)?fs.readdirSync(images).map(name=>({name:`images/${name}`,bytes:fs.readFileSync(new URL(name,images))})):[];
    return {raw,pageBlocks:raw.pages[0].blocks,width,height,assets:[],originalAssets,derivations:[]};
  }};
  try {
    world=await createIntegration({directory,workbench:{recognition:{recognizer}}});
    let {client}=await registerMath(world,'mineru-replay@example.test');
    const results=[];
    for(const source of sources) {
      const file=await upload(client,source);
      const accepted=await write(client,`${base}/${file.id}/preview`,{});
      assert.equal((await waitJob(client,accepted.json.id)).state,'succeeded');
      const preview=(await client.request('GET',`${base}/${file.id}/preview`)).json;
      const endpoint=`${base}/${file.id}/recognition`,query=`?renditionFileId=${preview.renditionFileId}`;
      const job=await write(client,endpoint,{renditionFileId:preview.renditionFileId,pages:[1]});
      assert.equal(job.status,202,job.text);assert.equal((await waitJob(client,job.json.id)).state,'succeeded');
      const page=(await client.request('GET',`${endpoint}/pages/1${query}`)).json;
      assert.equal(page.state,'ready');
      const raw=captured(source.id);
      assert.deepEqual(JSON.parse((await client.request('GET',`${base}/${page.rawFileId}/content`)).text),raw);
      assert.deepEqual(page.blocks.map(block=>block.id),raw.pages[0].blocks.map((_,index)=>index));
      assert.deepEqual(page.blocks.map(block=>block.type),raw.pages[0].blocks.map(block=>block.type));
      assert.equal(JSON.stringify(page.document).includes('"type":"image"'),false,'formula/table evidence screenshots stay out of the document');
      if(source.id==='D2') {
        assert.deepEqual(page.blocks[1].document.blocks[0].runs,raw.pages[0].blocks[1].content.map(span=>span.type==='equation_inline'
          ? {type:'math',latex:span.content}:{type:'text',text:span.content}));
        const imported=await write(client,'/api/modules/questions/v2/imports',{title:'固定识别页',origin:'固定原件',input:{kind:'files',fileIds:[file.id],pages:[]}});
        assert.equal(imported.status,201,imported.text);assert.equal((await waitJob(client,imported.json.jobId)).state,'succeeded');
        const material=(await client.request('GET',`/api/modules/questions/v2/imports/${imported.json.id}`)).json;
        assert.equal(material.drafts.length,2);
        assert(material.drafts.some(draft=>draft.body.blocks.some(block=>
          block.runs?.some(run=>run.type==='math'&&run.latex===String.raw`\log_2(x - 1) \leq 1`))));
      } else {
        assert(page.originalAssetFileIds.length>0);
        assert(page.document.blocks.some(block=>block.type==='table'&&block.rows.some(row=>row.some(cell=>
          cell.blocks.some(paragraph=>paragraph.runs?.some(run=>run.type==='math'))))));
        const imported=await write(client,'/api/modules/questions/v2/imports',{title:'固定活动表',origin:'固定原件',input:{kind:'files',fileIds:[file.id],pages:[]}});
        assert.equal(imported.status,201,imported.text);assert.equal((await waitJob(client,imported.json.jobId)).state,'partial');
        const material=(await client.request('GET',`/api/modules/questions/v2/imports/${imported.json.id}`)).json;
        assert.equal(material.drafts.length,1);assert.equal(material.fragments.length,1);
        assert.deepEqual(material.fragments[0].document,{version:2,blocks:[page.document.blocks.find(block=>block.type==='table')]});
        const resource=await write(client,'/api/modules/resources/items',{title:'固定活动页',fileId:file.id,folderId:null,tagIds:[],note:''});
        assert.equal(resource.status,201,resource.text);
        const lesson=await write(client,'/api/modules/lessons/v3',{title:'识别内容采用',intro:{version:2,blocks:[]},sections:[],materials:[]});
        const adopted=await write(client,`/api/modules/lessons/v3/${lesson.json.id}/sections/adopt-page`,{
          baseVersion:lesson.json.version,resourceId:resource.json.id,resourceVersion:resource.json.version,fileId:file.id,
          renditionFileId:preview.renditionFileId,page:1,resultId:page.resultId,title:'活动页',content:page.document});
        assert.equal(adopted.status,200,adopted.text);
      }
      results.push({endpoint,query,page});
    }
    const jar=client.jar;
    await world.close();world=await createIntegration({directory});client=world.client();client.jar=jar;
    for(const result of results) {
      const reopened=(await client.request('GET',`${result.endpoint}/pages/1${result.query}`)).json;
      assert.deepEqual(reopened.document,result.page.document);
      assert.deepEqual(reopened.blocks,result.page.blocks);
      assert.equal(reopened.rawFileId,result.page.rawFileId);
    }
    passed=true;
  } finally {
    await world?.close();
    if(passed)fs.rmSync(directory,{recursive:true,force:true});
    else console.error(`Retained MinerU HTTP regression: ${directory}`);
  }
});

test('structured fragment documents retain nested image references and reject foreign assets atomically',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mineru-fragments-'));
  const backupTarget=directory+'-backup';
  const figure=fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png',import.meta.url));
  const raw={pages:[{blocks:[
    {type:'text',bbox:[.1,.1,.9,.2],content:[{type:'text',content:'Q1. 请观察下表。'}]},
    {type:'table',bbox:[.1,.3,.9,.9],content:[{type:'table_body',content:'<table><tr><td>记录</td><td><eq>x<y</eq><img src="imgs/figure.png"/></td></tr></table>'}]},
  ]}]};
  const recognizer={revision:'mineru-pro-2605/document-6',async run({width,height}){
    return {raw,pageBlocks:raw.pages[0].blocks,width,height,assets:[{name:'imgs/figure.png',bytes:figure}],originalAssets:[],derivations:[]};
  }};
  let world,passed=false;
  try {
    world=await createIntegration({directory,workbench:{recognition:{recognizer}}});
    let {client}=await registerMath(world,'fragments-owner@example.test');
    const file=await upload(client,sources[1]);
    const imported=await write(client,'/api/modules/questions/v2/imports',{title:'表格配图',origin:'',input:{kind:'files',fileIds:[file.id],pages:[]}});
    assert.equal(imported.status,201,imported.text);assert.equal((await waitJob(client,imported.json.jobId)).state,'partial');
    const route=`/api/modules/questions/v2/imports/${imported.json.id}`;
    const material=(await client.request('GET',route)).json;
    assert.equal(material.drafts.length,1);assert.equal(material.fragments.length,1);
    const fragment=material.fragments[0],table=fragment.document.blocks[0];
    assert.equal(table.type,'table');
    assert.deepEqual(table.rows[0][1].blocks[0].runs,[{type:'math',latex:'x<y'}]);
    const image=table.rows[0][1].blocks.find(block=>block.type==='image');
    assert(image,'nested image must remain available for manual assignment');
    assert.equal((await client.request('GET',`${base}/${image.fileId}/content`)).status,200);
    const foreign=(await registerMath(world,'fragments-foreign@example.test')).client;
    const foreignFile=await upload(foreign,sources[0]);
    const forged=structuredClone(material.fragments);
    forged[0].document.blocks[0].rows[0][1].blocks.find(block=>block.type==='image').fileId=foreignFile.id;
    const failed=await client.request('PUT',route,{body:{baseVersion:material.version,drafts:material.drafts,fragments:forged},headers:{'Idempotency-Key':randomUUID()}});
    assert.equal(failed.status,404,failed.text);
    assert.deepEqual((await client.request('GET',route)).json,material,'rejected foreign asset must not partially save');
    const saved=await client.request('PUT',route,{body:{baseVersion:material.version,drafts:material.drafts,fragments:material.fragments},headers:{'Idempotency-Key':randomUUID()}});
    assert.equal(saved.status,200,saved.text);assert.deepEqual(saved.json.fragments,material.fragments);
    const exported=await write(client,'/api/reliability/v1/exports',{});
    assert.equal(exported.status,202,exported.text);
    let archive;
    for(let i=0;i<200;i++) {
      archive=(await client.request('GET',`/api/reliability/v1/exports/${exported.json.id}`)).json;
      if(!['queued','running'].includes(archive.state))break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.equal(archive.state,'ready',JSON.stringify(archive));
    const zip=await JSZip.loadAsync(fs.readFileSync(path.join(directory,'personal-exports',`${archive.id}.zip`)));
    const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
    const importedObject=manifest.objects.find(object=>object.key.kind==='import'&&object.key.id===material.id);
    assert(importedObject);
    const exportedImport=JSON.parse(await zip.file(importedObject.dataPath).async('string')).value;
    assert.deepEqual(exportedImport.fragments,material.fragments);
    assert(manifest.relations.some(relation=>relation.from.id===material.id&&relation.to.id===image.fileId&&relation.location.includes('/document/')));
    const imageObject=manifest.objects.find(object=>object.key.kind==='file'&&object.key.id===image.fileId);
    assert(imageObject,'fragment image must be included in the personal archive');
    const imageMetadata=JSON.parse(await zip.file(imageObject.dataPath).async('string')).value;
    const imageEntry=manifest.files.find(entry=>entry.sha256===imageMetadata.sha256&&entry.mediaType===imageMetadata.mediaType);
    assert.deepEqual(await zip.file(imageEntry.path).async('nodebuffer'),figure);
    const jar=client.jar;await world.close();world=await createIntegration({directory});client=world.client();client.jar=jar;
    const reopened=(await client.request('GET',route)).json;
    assert.deepEqual(reopened.fragments,material.fragments);
    assert.equal((await client.request('GET',`${base}/${image.fileId}/content`)).status,200);
    await world.close();world=null;
    const target=backupTarget;
    assert.equal((await backup({database:path.join(directory,'workspace.sqlite'),files:path.join(directory,'files'),target,stopped:true})).state,'backed-up');
    const backedUp=new Database(path.join(target,'workspace.sqlite'),{readonly:true});
    try {
      const record=JSON.parse(backedUp.prepare('SELECT value FROM questions_materials_imports WHERE id=?').get(material.id).value);
      assert.deepEqual(record.fragments,material.fragments);
      assert(backedUp.prepare('SELECT id FROM materials_files WHERE id=?').get(image.fileId));
    } finally {backedUp.close();}
    world=await createIntegration({directory});client=world.client();client.jar=jar;
    const textOnly=structuredClone(reopened.fragments);delete textOnly[0].document;
    const legacy=await client.request('PUT',route,{body:{baseVersion:reopened.version,drafts:reopened.drafts,fragments:textOnly},headers:{'Idempotency-Key':randomUUID()}});
    assert.equal(legacy.status,200,legacy.text);assert.deepEqual(legacy.json.fragments,textOnly,'old pure-text fragments remain writable');
    passed=true;
  } finally {
    await world?.close();
    if(passed) {
      fs.rmSync(directory,{recursive:true,force:true});
      fs.rmSync(backupTarget,{recursive:true,force:true});
    } else console.error(`Retained structured fragment regression: ${directory}, ${backupTarget}`);
  }
});

test('typed table eq keeps source LaTeX through HTTP persistence and reopen',async()=> {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mineru-table-eq-'));
  const cells=[
    {source:'<eq>x<y</eq>',runs:[{type:'math',latex:'x<y'}]},
    {source:'<eq>x<=y</eq>',runs:[{type:'math',latex:'x<=y'}]},
    {source:'<eq>x&lt;y</eq>',runs:[{type:'math',latex:'x<y'}]},
    {source:'<eq>x&y</eq>',runs:[{type:'math',latex:'x&y'}]},
    {source:'<eq>x&amp;lt;y</eq>',runs:[{type:'math',latex:'x&lt;y'}]},
    {source:'前<eq>x<y</eq><eq>a<=b</eq>后',runs:[{type:'text',text:'前'},
      {type:'math',latex:'x<y'},{type:'math',latex:'a<=b'},{type:'text',text:'后'}]},
    {source:'<eq>x<y &amp; z',runs:[{type:'text',text:'<eq>x<y &amp; z'}]},
  ];
  const html=`<table>${cells.map(cell=>`<tr><td>${cell.source}</td></tr>`).join('')}</table>`;
  // Replay the official direct-HTML table branch, without constructing a model.
  const raw={pages:[{blocks:[{type:'table',bbox:[0,0,1,1],content:[{type:'table_body',content:html}]}]}]};
  const recognizer={revision:'mineru-pro-2605/document-6',async run({width,height}) {
    return {raw,pageBlocks:raw.pages[0].blocks,width,height,assets:[],originalAssets:[],derivations:[]};
  }};
  let world,passed=false;
  try {
    world=await createIntegration({directory,workbench:{recognition:{recognizer}}});
    let {client}=await registerMath(world,'mineru-table-eq@example.test');
    const file=await upload(client,sources[0]);
    const accepted=await write(client,`${base}/${file.id}/preview`,{});
    assert.equal((await waitJob(client,accepted.json.id)).state,'succeeded');
    const preview=(await client.request('GET',`${base}/${file.id}/preview`)).json;
    const endpoint=`${base}/${file.id}/recognition`,query=`?renditionFileId=${preview.renditionFileId}`;
    const job=await write(client,endpoint,{renditionFileId:preview.renditionFileId,pages:[1]});
    assert.equal((await waitJob(client,job.json.id)).state,'succeeded');
    const page=(await client.request('GET',`${endpoint}/pages/1${query}`)).json;
    assert.equal(page.state,'ready');
    const jar=client.jar;
    await world.close();world=await createIntegration({directory});client=world.client();client.jar=jar;
    const reopened=(await client.request('GET',`${endpoint}/pages/1${query}`)).json;
    assert.deepEqual(reopened.document,page.document);
    assert.equal(reopened.blocks[0].sourceContent,html);
    assert.deepEqual(JSON.parse((await client.request('GET',`${base}/${reopened.rawFileId}/content`)).text),raw);
    assert.deepEqual(reopened.document.blocks[0].rows.map(row=>row[0].blocks),
      cells.map(cell=>[{type:'paragraph',runs:cell.runs}]),
      JSON.stringify({sourceContent:html,before:page.document,reopened:reopened.document,issues:reopened.issues}));
    assert.deepEqual(reopened.issues.map(issue=>issue.code),['unparsed-math']);
    passed=true;
  } finally {
    await world?.close();
    if(passed)fs.rmSync(directory,{recursive:true,force:true});
    else console.error(`Retained MinerU table eq regression: ${directory}`);
  }
});

test('typed list fragments select original children once, retain long text, math and images, and respect question boundaries',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mineru-list-fragments-'));
  const figure=fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png',import.meta.url));
  const latex=String.raw`f(x)=\begin{cases}x,&x>0\\`+'\n'+String.raw`x^2,&x\leq0\end{cases}`;
  const raw={pages:[{blocks:[
    {type:'list',bbox:[.1,.1,.9,.3],content:[
      {type:'text',content:[{type:'text',content:'教师活动：观察图形 '},{type:'equation_inline',content:latex},{type:'text',content:'。'}]},
      {type:'text',content:[{type:'text',content:'教学点评：'},{type:'text',content:'甲'.repeat(25000)}]},
      {type:'image',content:[{type:'image_body',image_path:'imgs/figure.png'}]},
    ]},
    {type:'list',bbox:[.1,.4,.9,.8],content:[
      {type:'text',content:'Q1. 求第一个值。'},
      {type:'text',content:'Q2. 求第二个值。'},
    ]},
  ]}]};
  const recognizer={revision:'mineru-pro-2605/document-6',async run({width,height}){
    return {raw,pageBlocks:raw.pages[0].blocks,width,height,assets:[{name:'imgs/figure.png',bytes:figure}],originalAssets:[],derivations:[]};
  }};
  let world,passed=false;
  try {
    world=await createIntegration({directory,workbench:{recognition:{recognizer}}});
    let {client}=await registerMath(world,'list-fragments@example.test');
    const file=await upload(client,sources[1]);
    const imported=await write(client,'/api/modules/questions/v2/imports',{title:'列表范围',origin:'',input:{kind:'files',fileIds:[file.id],pages:[]}});
    assert.equal(imported.status,201,imported.text);assert.equal((await waitJob(client,imported.json.jobId)).state,'succeeded');
    const route=`/api/modules/questions/v2/imports/${imported.json.id}`;
    const material=(await client.request('GET',route)).json;
    const machine=(await client.request('GET',`${base}/${file.id}/recognition/pages/1?renditionFileId=${file.id}`)).json;
    assert.deepEqual(material.drafts.map(draft=>draft.title),['Q1.','Q2.']);
    assert.deepEqual(material.drafts.map(draft=>draft.body.blocks[0].items[0].blocks[0].runs[0].text),['求第一个值。','求第二个值。']);
    assert(material.drafts.every(draft=>draft.body.blocks[0].items.length===1));
    assert.equal(material.fragments.length,3);
    assert(material.fragments.every(fragment=>fragment.document.blocks[0].type==='list'&&fragment.document.blocks[0].items.length===1));
    assert.deepEqual(material.fragments.flatMap(fragment=>fragment.document.blocks[0].items),machine.document.blocks[0].items);
    assert.equal(material.fragments[0].document.blocks[0].items[0].blocks[0].runs[1].latex,latex);
    assert.equal(material.fragments[1].text.length,20000);
    assert.equal(material.fragments[1].document.blocks[0].items[0].blocks[0].runs.map(run=>run.text).join('').length,25005);
    const image=material.fragments[2].document.blocks[0].items[0].blocks[0];
    assert.equal(image.type,'image');assert.equal((await client.request('GET',`${base}/${image.fileId}/content`)).status,200);
    const drafts=structuredClone(material.drafts);
    for(const fragment of material.fragments) {
      drafts[0].body.blocks.push(...structuredClone(fragment.document.blocks));
      drafts[0].parts.push({role:'body',locations:fragment.locations});
    }
    const saved=await client.request('PUT',route,{body:{baseVersion:material.version,drafts,fragments:material.fragments.map(fragment=>({...fragment,disposition:'assigned'}))},headers:{'Idempotency-Key':randomUUID()}});
    assert.equal(saved.status,200,saved.text);
    const jar=client.jar;await world.close();world=await createIntegration({directory});client=world.client();client.jar=jar;
    const reopened=(await client.request('GET',route)).json;
    assert.deepEqual(reopened.drafts,drafts);assert.deepEqual(reopened.fragments,saved.json.fragments);
    assert.equal((await client.request('GET',`${base}/${image.fileId}/content`)).status,200);
    passed=true;
  } finally {
    await world?.close();
    if(passed)fs.rmSync(directory,{recursive:true,force:true});
    else console.error(`Retained list fragment regression: ${directory}`);
  }
});
