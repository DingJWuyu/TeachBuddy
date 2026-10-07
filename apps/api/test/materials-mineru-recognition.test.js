import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
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
