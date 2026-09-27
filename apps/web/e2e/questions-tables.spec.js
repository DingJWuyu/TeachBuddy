import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {createIntegration} from '../../api/test/fixtures/auth-integration/harness.js';
import {registerMath} from './fixtures/math-static/real.mjs';
import {sourceImage} from './fixtures/materials-questions/recognition/replay.mjs';
import {documentText, images, walkBlocks} from '../../api/src/modules/questions/materials-content.js';

const base='/api/modules/questions/v2';
const pdf=path.resolve('apps/web/e2e/fixtures/materials-questions/P.pdf');
const email='questions-tables@example.test';
let world, client, recognizer;
test.beforeEach(async()=>{
  recognizer={revision:'controlled-teaching-table-1',calls:[],async run(){throw Error('Unexpected recognition');}};
  world=await createIntegration({directory:fs.mkdtempSync(path.join(os.tmpdir(),'questions-tables-')),workbench:{recognition:{recognizer}}});
  ({client}=await registerMath(world,email));
});
test.afterEach(async({},info)=>{
  await world.close();
  if(info.status===info.expectedStatus)fs.rmSync(world.directory,{recursive:true,force:true});
  else console.log('保留表格集成现场：'+world.directory);
});
async function request(method,url,body,options={}){
  const result=await client.request(method,url,{body,headers:{'Idempotency-Key':randomUUID()},...options});
  expect(result.status,result.text).toBeGreaterThanOrEqual(200);expect(result.status,result.text).toBeLessThan(300);return result.json;
}
async function upload(bytes,name){
  const boundary='table-'+randomUUID();
  return request('POST','/api/workbench/files',undefined,{contentType:`multipart/form-data; boundary=${boundary}`,
    rawBody:Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)])});
}
async function waitJob(id){
  let job;await expect.poll(async()=>{job=await request('GET',`/api/workbench/jobs/${id}`);return ['queued','running','cancelling'].includes(job.state);},{timeout:30000}).toBe(false);return job;
}
async function recognize(file,pages,responses){
  const offset=recognizer.calls.length;
  recognizer.run=async input=>{
    const response=responses[recognizer.calls.length-offset];recognizer.calls.push({width:input.width,height:input.height});
    if(!response)throw Error('No response for this page');return response(input);
  };
  const previewJob=await request('POST',`/api/workbench/files/${file.id}/preview`,{});
  expect((await waitJob(previewJob.id)).state).toBe('succeeded');
  const preview=await request('GET',`/api/workbench/files/${file.id}/preview`);
  const job=await request('POST',`/api/workbench/files/${file.id}/recognition`,{renditionFileId:preview.renditionFileId,pages});
  expect((await waitJob(job.id)).state).toBe('succeeded');
  return preview;
}
async function collect(file,pages){
  const created=await request('POST',`${base}/imports`,{title:'教学内容表',origin:'',input:{kind:'files',fileIds:[file.id],pages:[{fileId:file.id,pages}]}});
  const job=await waitJob(created.jobId), material=await request('GET',`${base}/imports/${created.id}`);
  return {job,material};
}
const table=rows=>`<table>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</table>`;
const header=['教学内容','师生活动','设计点评'];
const response=(html,assets=[])=>({width,height})=>({width,height,assets,raw:{width,height,parsing_res_list:[
  {block_id:0,block_label:'table',block_bbox:[width*.1,height*.05,width*.9,height*.95],block_content:html},
]}});
const math=document=>{const result=[];walkBlocks(document.blocks,b=>{if(b.type==='math')result.push(b.latex);for(const run of b.runs??[])if(run.type==='math')result.push(run.latex);});return result;};
const intro=()=>response(table([header,['【例19】判断下列函数的性质。','教师组织讨论','设计点评文字']]));
const tail=()=>response(table([['【练习23】计算 $g(t)=7t+4$。','教师巡视','教学目的']]));

test('HTTP：缺少题目数据的引导语换词或含数学名称仍保留为未分配',async()=>{
  const file=await upload(sourceImage('I-1'),'introductions.png');
  const incomplete=[
    '【例61】判断下列函数的奇偶性。',
    '【例62】判断以下函数的奇偶性。',
    '【例63】判断下列函数 $f(x)$ 的奇偶性。',
    '【练习64】研究函数 $g(t)$ 的单调性。',
    '【思考65】判断函数性质。<p>(1)</p><p>(2)</p>',
  ];
  await recognize(file,[1],[response(table([header,...incomplete.map(body=>[body,'教师讨论','点评'])]))]);
  const {job,material}=await collect(file,[1]);
  expect.soft(job.state).toBe('partial');
  expect.soft(material.drafts.map(d=>d.title)).toEqual([]);
  for(const number of [61,62,63,64,65])expect.soft(material.fragments.map(f=>f.text).join('\n')).toContain(String(number));
  expect(recognizer.calls).toHaveLength(1);
});

for(const boundary of ['<caption>教学环节：新的活动</caption>','<p>【教学环节】新的活动</p>']){
  test(`HTTP：同识别块的表前边界阻断继承 ${boundary.startsWith('<caption>')?'caption':'paragraph'}`,async()=>{
    const file=await upload(fs.readFileSync(pdf),'material.pdf');
    const continued=table([['【练习2】计算 $z(t)=8t+3$。','教师活动','点评']]);
    const html=boundary.startsWith('<caption>')?continued.replace('<table>',`<table>${boundary}`):boundary+continued;
    await recognize(file,[1,2],[intro(),response(html)]);
    const {material}=await collect(file,[1,2]);
    expect(material.drafts.some(d=>d.title==='练习2')).toBe(false);
    expect(recognizer.calls).toHaveLength(2);
  });
}

test('HTTP：同识别块的表后标题清除跨页范围，新表头仍可重新识别',async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  const boundary='<p>教学环节：新的活动</p>';
  await recognize(file,[1,2,3],[response(table([header,['【例19】判断函数性质。','活动','点评']])+boundary),tail(),
    response(boundary+table([['设计点评','教学内容','师生活动'],['点评','【练习75】求 $r(t)=4t+2$。','活动']]))]);
  const {material}=await collect(file,[1,2,3]);
  expect(material.drafts.some(d=>d.title==='练习23')).toBe(false);
  expect(material.drafts.filter(d=>d.title==='练习75')).toHaveLength(1);
  expect(recognizer.calls).toHaveLength(3);
});

// Both inputs and raw output are external private evidence, not generated here.
test('HTTP：真实 E.pdf 已有识别页分出练习与思考，保留原7/8和配图',async()=>{
  test.skip(!process.env.M33_PRIVATE_PDF||!process.env.QUESTIONS_OCR_EVIDENCE_DIR,'需要固定私有E及已有doc3页证据');
  const directory=process.env.QUESTIONS_OCR_EVIDENCE_DIR;
  const responses=[7,8].map(number=>{
    const at=file=>path.join(directory,`E-${number}`,file);
    const result=JSON.parse(fs.readFileSync(at('result.json'))),raw=JSON.parse(fs.readFileSync(at('raw.json')));
    const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
    return input=>{
      expect(hash(input.bytes)).toBe(hash(fs.readFileSync(at('page.png'))));
      return {raw,width:raw.width,height:raw.height,derivations:result.derivations,
        assets:result.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(result.assetFileIds[i]+'.bin'))})),
        originalAssets:result.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(result.originalAssetFileIds[i]+'.bin'))}))};
    };
  });
  const file=await upload(fs.readFileSync(process.env.M33_PRIVATE_PDF),'E.pdf');
  await recognize(file,[7,8],responses);
  const {job,material}=await collect(file,[7,8]);
  expect(job.state).toBe('partial');expect(recognizer.calls).toHaveLength(2);
  expect(material.drafts.map(d=>d.title)).toEqual(['练习','思考']);
  const [practice,thought]=material.drafts;
  const rawPage=JSON.parse(fs.readFileSync(path.join(directory,'E-8/result.json')));
  expect(math(practice.body)).toEqual(math({blocks:rawPage.blocks[0].document.blocks[0].rows[1][0].blocks}));
  expect(math(thought.body)).toEqual(math({blocks:rawPage.blocks[0].document.blocks[0].rows[2][0].blocks}));
  expect(images(thought.body)).toHaveLength(1);
  for(const draft of material.drafts){
    expect(documentText(draft.body)).not.toMatch(/教师在PPT|学生在教师|设置三个题目|引导学生既要/);
    expect(draft.solution.blocks).toEqual([]);
    expect(draft.parts.every(part=>part.locations.every(l=>l.fileId===file.id&&l.page===8))).toBe(true);
  }
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('【例6】');
  expect(material.fragments.some(f=>f.locations.some(l=>l.page===7))).toBe(true);
  const image=await client.request('GET',`/api/workbench/files/${images(thought.body)[0]}/content`);
  expect(image.status).toBe(200);
});

test('HTTP：表头换列及例号系数变化仍只取内容列，保留原公式和同格图',async()=>{
  const figure=fs.readFileSync(new URL('./fixtures/materials-questions/recognition/I-1/derived/imgs/img_in_image_box_323_511_1330_984.png',import.meta.url));
  const file=await upload(sourceImage('I-1'),'table.png');
  await recognize(file,[1],[response(table([['设计点评','教学内容','教师活动'],
    ['点评不能进题干','【练习42】求 $h(s)=9s-2$。\\n(1) 计算 $h(3)$。','活动不能进题干'],
    ['另一个点评','【思考】如图判断函数性质。<img src="imgs/plot.png"/>','另一个活动']]),[{name:'imgs/plot.png',bytes:figure}])]);
  const {job,material}=await collect(file,[1]);expect(job.state).toBe('succeeded');
  expect(material.drafts.map(d=>d.title)).toEqual(['练习42','思考']);
  expect(math(material.drafts[0].body)).toEqual(['h(s)=9s-2','h(3)']);
  expect(documentText(material.drafts[0].body)).not.toContain('\\n');
  expect(material.drafts.every(d=>d.answerStatus==='absent')).toBe(true);
  expect(images(material.drafts[1].body)).toHaveLength(1);
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('活动不能进题干');
  expect(recognizer.calls).toHaveLength(1);
});

test('HTTP：只在连续原页继承表头，单页选择不借用未选前页',async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  await recognize(file,[1,2],[intro(),tail()]);
  const together=await collect(file,[2,1]);
  expect(together.material.drafts.map(d=>d.title)).toEqual(['练习23']);
  expect(together.material.drafts[0].parts[0].locations[0].page).toBe(2);
  const alone=await collect(file,[2]);
  // This page has no proved table schema, so the original native PDF path stays in use.
  expect(alone.material.drafts.some(d=>d.title==='练习23')).toBe(false);
  expect(recognizer.calls).toHaveLength(2);
});

test('HTTP：不连续页和列数变化不继承表头',async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  await recognize(file,[1,2,3],[intro(),response(table([['【思考】这是另一种列结构。','旁注']])),tail()]);
  for(const pages of [[1,3],[1,2]]){
    const {material}=await collect(file,pages);
    expect(material.drafts.some(d=>['练习23','思考'].includes(d.title))).toBe(false);
  }
  expect(recognizer.calls).toHaveLength(3);
});

test('HTTP：新环节及含跨列内容的表格保持待处理，普通回顾列表不造题',async()=>{
  const file=await upload(sourceImage('I-1'),'table.png');
  const html='<table><tr><td>教学内容</td><td>师生活动</td><td>设计点评</td></tr>'+
    '<tr><td colspan="2">【练习】这段跨列内容不能判定归属。</td><td>点评</td></tr>'+
    '<tr><td colspan="3">【教学环节】总结</td></tr>'+
    '<tr><td>【思考】尚无新表头。</td><td>活动</td><td>点评</td></tr>'+
    '<tr><td>教学内容</td><td>师生活动</td><td>设计点评</td></tr>'+
    '<tr><td>1. 回顾课堂知识。</td><td>活动</td><td>点评</td></tr></table>';
  await recognize(file,[1],[response(html)]);
  const {job,material}=await collect(file,[1]);
  expect(job.state).toBe('partial');expect(material.drafts).toEqual([]);
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('回顾课堂知识');
});

test('HTTP：同格多个题目不猜配图，字面文本与数学转义分别保留',async()=>{
  const figure=fs.readFileSync(new URL('./fixtures/materials-questions/recognition/I-1/derived/imgs/img_in_image_box_323_511_1330_984.png',import.meta.url));
  const file=await upload(sourceImage('I-1'),'table.png');
  await recognize(file,[1],[response(table([header,['【练习1】如图，保留字符串 \\name。 $\\begin{cases} t,&t&lt;0\\\\t^2,&t&gt;0\\end{cases}$'+
    '【练习2】如图分析。<img src="imgs/plot.png"/>','教师说明','点评']]),[{name:'imgs/plot.png',bytes:figure}])]);
  const {job,material}=await collect(file,[1]);expect(job.state).toBe('partial');
  expect(material.drafts).toHaveLength(2);expect(material.drafts.every(d=>images(d.body).length===0)).toBe(true);
  expect(material.drafts.every(d=>d.issues.some(i=>i.code==='missing-figure'))).toBe(true);
  expect(documentText(material.drafts[0].body)).toContain('\\name');
  expect(math(material.drafts[0].body)[0]).toContain('\\\\t^2');
});

test('HTTP：单页重试保留同名题目的人工公式配图、入库和忽略状态',async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  const figure=fs.readFileSync(new URL('./fixtures/materials-questions/recognition/I-1/derived/imgs/img_in_image_box_323_511_1330_984.png',import.meta.url));
  await recognize(file,[1,2],[intro(),response(table([
    ['(1) 前题内容待归属。','教师巡视','教学目的'],
    ['【练习】如图计算 $g(t)=7t+4$。<img src="imgs/plot.png"/>','教师巡视','教学目的'],
    ['【练习】计算 $h(t)=9t-2$。','教师巡视','教学目的'],
    ['【练习】计算 $p(t)=3t+8$。','教师巡视','教学目的'],
  ]),[{name:'imgs/plot.png',bytes:figure}])]);
  let {job,material}=await collect(file,[1,2]);
  expect(material.drafts).toHaveLength(3);
  expect(new Set(material.drafts.map(d=>d.id)).size).toBe(3);
  const [edited,confirmed,ignored]=structuredClone(material.drafts);
  edited.title='老师的校对标题';
  walkBlocks(edited.body.blocks,b=>{for(const run of b.runs??[])if(run.type==='math')run.latex='g(t)=11t+5';});
  edited.body.blocks.push({type:'paragraph',runs:[{type:'text',text:'老师保留的条件。'}]});
  confirmed.answerStatus='absent';confirmed.issues=confirmed.issues.map(i=>({...i,resolution:'corrected'}));
  ignored.disposition='ignored';
  material=await request('PUT',`${base}/imports/${material.id}`,{baseVersion:material.version,
    drafts:[ignored,edited,confirmed],fragments:material.fragments});
  const committed=await request('POST',`${base}/imports/${material.id}/commit`,{baseVersion:material.version,draftIds:[confirmed.id]});
  const retry=await request('POST',`/api/workbench/jobs/${job.id}/retry`,{unitIds:[`file:${file.id}:page:2`]});
  await waitJob(retry.id);
  material=await request('GET',`${base}/imports/${material.id}`);
  expect(material.drafts).toHaveLength(3);
  expect(material.drafts.find(d=>d.id===edited.id).body).toEqual(edited.body);
  expect(material.drafts.find(d=>d.id===edited.id).title).toBe(edited.title);
  expect(material.drafts.find(d=>d.id===ignored.id).disposition).toBe('ignored');
  expect(material.drafts.find(d=>d.id===confirmed.id).questionId).toBe(committed.questions[0].id);
  expect(material.drafts.find(d=>d.id===confirmed.id).disposition).toBe('confirmed');
  const reopened=await request('GET',`${base}/items/${committed.questions[0].id}`);
  expect(reopened.body).toEqual(confirmed.body);
  expect(recognizer.calls).toHaveLength(2);
});

test('HTTP：已有非教学表识别保持原生路径，识别修订变化也不追加识别',async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  const before=await collect(file,[1]);expect(before.material.drafts.length).toBeGreaterThan(0);expect(recognizer.calls).toHaveLength(0);
  await recognize(file,[1],[response(table([['其他内容','备注'],['【练习】假的识别内容','备注']]))]);
  let result=await collect(file,[1]);expect(result.material.drafts.some(d=>documentText(d.body).includes('假的识别内容'))).toBe(false);
  const directory=world.directory;await world.close();recognizer.revision='controlled-teaching-table-2';
  world=await createIntegration({directory,workbench:{recognition:{recognizer}}});client=world.client();
  await request('POST','/api/auth/session',{action:'bootstrap'});
  const session=await request('POST','/api/auth/login',{email,password:'math-password',rememberMe:true});
  await request('POST','/api/auth/session',{action:'activate',sessionId:session.id,rememberMe:true});
  result=await collect(file,[1]);expect(result.material.drafts.length).toBeGreaterThan(0);
  expect(recognizer.calls).toHaveLength(1);
});


test('HTTP：同列数却换角色时停止继承，新表头重新确定内容列',async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  await recognize(file,[1,2,3],[intro(),response(table([['教师：新表的点评文字','【练习】角色已经变化，不能取旧列。','教师活动']])),
    response(table([['设计点评','教学内容','师生活动'],['点评','【练习73】求 $r(t)=5t+6$。','教师活动']]))]);
  const {material}=await collect(file,[1,2,3]);
  expect(material.drafts.map(d=>d.title)).toEqual(['练习73']);
  expect(math(material.drafts[0].body)).toEqual(['r(t)=5t+6']);
  expect(recognizer.calls).toHaveLength(3);
});

test('HTTP：不同原件不继承教学表头',async()=>{
  const first=await upload(sourceImage('I-1'),'first.png'),second=await upload(sourceImage('I-2'),'second.png');
  await recognize(first,[1],[intro()]);await recognize(second,[1],[tail()]);
  const created=await request('POST',`${base}/imports`,{title:'不同原件',origin:'',input:{kind:'files',fileIds:[first.id,second.id],pages:[]}});
  expect((await waitJob(created.jobId)).state).toBe('partial');
  const material=await request('GET',`${base}/imports/${created.id}`);expect(material.drafts).toEqual([]);
  expect(recognizer.calls).toHaveLength(2);
});
