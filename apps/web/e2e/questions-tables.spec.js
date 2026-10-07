import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, createHash} from 'node:crypto';
import {createIntegration} from '../../api/test/fixtures/auth-integration/harness.js';
import {registerMath} from './fixtures/math-static/real.mjs';
import {sourceImage} from './fixtures/materials-questions/recognition/replay.mjs';
import {documentText, images, walkBlocks} from '../../api/src/modules/questions/materials-content.js';

const base='/api/modules/questions/v2';
const recordedPages=fileURLToPath(new URL('./fixtures/materials-questions/recognition-document-4/',import.meta.url));
const externalPdf=()=>{
  const bytes=fs.readFileSync(process.env.M33_PRIVATE_PDF);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('b8d34a6aa76a59adfee125c8efb0a12620dffbb797666cbcc6c41b07390d082a');
  return bytes;
};
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
const missing='【思考37】研究以下函数的性质。';
const ordered='(1) $u(t)=2t+9$ (2) $v(t)=t^3-2$ (3) $w(t)=1/t$';
const startTable=body=>table([header,[body,'教学活动','点评']]);
const endTable=body=>table([[body,'','点评']]);

test('HTTP：真实 E9 的数字题号拆成三题，两张原图只属于首题，小结不造题',async()=>{
  test.skip(!process.env.M33_PRIVATE_PDF,'需要下载并指定完整外部E原稿；真实回放随仓库提供');
  const at=name=>path.join(process.env.QUESTIONS_OCR_EXPANDED_DIR??recordedPages,'E-9',name);
  const saved=JSON.parse(fs.readFileSync(at('result.json'))),raw=JSON.parse(fs.readFileSync(at('raw.json')));
  recognizer.revision=saved.revision;
  const file=await upload(externalPdf(),'E.pdf');
  await recognize(file,[9],[input=>{
    const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
    expect(hash(input.bytes)).toBe(saved.inputHash);
    return {raw,width:raw.width,height:raw.height,derivations:saved.derivations,
      assets:saved.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(saved.assetFileIds[i]+'.bin'))})),
      originalAssets:saved.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(saved.originalAssetFileIds[i]+'.bin'))}))};
  }]);
  const {job,material}=await collect(file,[9]);
  expect(job.state).toBe('partial');expect(material.drafts.map(d=>d.title)).toEqual(['1.','2.','3.']);
  expect(material.drafts.map(d=>images(d.body).length)).toEqual([2,0,0]);
  const source={blocks:saved.blocks[2].document.blocks[0].rows[1][0].blocks};
  expect(material.drafts.flatMap(d=>math(d.body))).toEqual(math(source));
  expect(material.drafts.map(d=>math(d.body).length)).toEqual([2,2,4]);
  for(const draft of material.drafts){
    expect(documentText(draft.body)).not.toMatch(/教学成效|调查过程|调查目的|教师在|课后作业|学生学习的难点|辨析偶函数/);
    expect(draft.solution.blocks).toEqual([]);expect(draft.parts.every(p=>p.locations.every(l=>l.page===9&&l.fileId===file.id))).toBe(true);
  }
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('调查过程');
  for(const imageId of images(material.drafts[0].body))expect((await client.request('GET',`/api/workbench/files/${imageId}/content`)).status).toBe(200);
  expect(recognizer.calls).toHaveLength(1);
});

test('HTTP：最终 document-4 四图保留六题五答案三图，几何下标不经手工重录入库',async()=>{
  const directory=process.env.QUESTIONS_OCR_EXPANDED_DIR??recordedPages;
  const files=[];
  for(const name of ['I-1','I-2','I-3','PS-4']){
    const at=filename=>path.join(directory,name,filename);
    const saved=JSON.parse(fs.readFileSync(at('result.json'))),raw=JSON.parse(fs.readFileSync(at('raw.json')));
    expect(saved.revision).toBe('paddleocr-vl-1.6/document-4');
    const file=await upload(fs.readFileSync(at('page.png')),name+'.png');files.push(file);
    await recognize(file,[1],[input=>{
      const hash=bytes=>createHash('sha256').update(bytes).digest('hex');expect(hash(input.bytes)).toBe(saved.inputHash);
      return {raw,width:raw.width,height:raw.height,derivations:saved.derivations,
        assets:saved.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(saved.assetFileIds[i]+'.bin'))})),
        originalAssets:saved.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(saved.originalAssetFileIds[i]+'.bin'))}))};
    }]);
  }
  const created=await request('POST',`${base}/imports`,{title:'最终四图',origin:'',input:{kind:'files',fileIds:files.map(f=>f.id),pages:[]}});
  expect((await waitJob(created.jobId)).state).toBe('succeeded');
  let material=await request('GET',`${base}/imports/${created.id}`);
  expect(material.drafts.map(d=>d.title)).toEqual(['Q1.','Q2.','Q3.','Q4.','Q5.','Q6.']);
  expect(material.drafts.map(d=>d.answerStatus)).toEqual(['present','present','present','present','present','absent']);
  expect(material.drafts.map(d=>images(d.body).length)).toEqual([0,1,0,0,1,1]);
  expect(math(material.drafts[5].body)).toEqual(['ABCD-A_{1}B_{1}C_{1}D_{1}','AC_{1}']);
  const machine=structuredClone(material.drafts);
  material=await request('PUT',`${base}/imports/${material.id}`,{baseVersion:material.version,
    drafts:material.drafts.map(d=>({...d,issues:d.issues.map(i=>({...i,resolution:'corrected'}))})),fragments:material.fragments});
  const committed=await request('POST',`${base}/imports/${material.id}/commit`,{baseVersion:material.version,draftIds:material.drafts.map(d=>d.id)});
  for(let i=0;i<6;i++){
    const q=await request('GET',`${base}/items/${committed.questions[i].id}`);
    expect(q.body).toEqual(machine[i].body);expect(q.solution).toEqual(machine[i].solution);
  }
  expect(recognizer.calls).toHaveLength(4);
});

test('HTTP：练习范围的变号题目按原顺序拆分，下一题之前的连续双图只归前题',async()=>{
  const figure=fs.readFileSync(new URL('./fixtures/materials-questions/recognition/I-1/derived/imgs/img_in_image_box_323_511_1330_984.png',import.meta.url));
  const file=await upload(sourceImage('I-1'),'numbered.png');
  const html='<p>教学环节：随堂练习</p>'+table([header,[
    '１７． 如图求 $u(t)=1.25t+8$。<img src="imgs/one.png"/><img src="imgs/two.png"/>\\n１８． 判断 $v(t)$ 在 $(2,5]$ 上的性质。',
    '教师：1. 示范 $u(t)=0$。','点评：2. 训练 $v(t)=1$。']]);
  await recognize(file,[1],[response(html,[{name:'imgs/one.png',bytes:figure},{name:'imgs/two.png',bytes:figure}])]);
  const {material}=await collect(file,[1]);
  expect(material.drafts.map(d=>d.title)).toEqual(['１７．','１８．']);
  expect(material.drafts.map(d=>images(d.body).length)).toEqual([2,0]);
  expect(material.drafts.map(d=>math(d.body))).toEqual([['u(t)=1.25t+8'],['v(t)','(2,5]']]);
  expect(material.drafts.every(d=>d.issues.some(i=>i.code==='split-boundary'&&i.resolution==='open'))).toBe(true);
  expect(material.drafts.every(d=>!documentText(d.body).includes('教师')&&!documentText(d.body).includes('点评'))).toBe(true);
  const teacher=material.fragments.find(fragment=>fragment.text.includes('教师：1. 示范'));
  expect(math(teacher.document)).toEqual(['u(t)=0']);
});

for(const scope of ['教学环节：课堂小结','教学环节：回顾练习',''])test(`HTTP：数字列表在${scope||'未明确练习范围'}不生成题目`,async()=>{
  const file=await upload(sourceImage('I-1'),'outline.png');
  await recognize(file,[1],[response((scope?`<p>${scope}</p>`:'')+table([header,['1. 回顾 $f(-x)=f(x)$。<p>2. 总结 $g(-x)=-g(x)$。</p>','活动','点评']]))]);
  const {material}=await collect(file,[1]);expect(material.drafts).toEqual([]);
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('回顾');
});

test('HTTP：检测表不把空题、函数名称、小数或引用中的数字当新题',async()=>{
  const file=await upload(sourceImage('I-1'),'number-boundaries.png');
  await recognize(file,[1],[response('<p>教学环节：单元检测</p>'+table([header,
    ['1. 判断函数 $f(x)$ 的性质。','活动','点评'],
    ['2.','活动','点评'],
    ['1.5 是一个观测值，$a=1.5$。','活动','点评'],
    ['3. 已知 $h(t)=2t+7$，保留字符串 "\\n4. 示例"。','活动','点评'],
  ]))]);
  const {material}=await collect(file,[1]);expect(material.drafts.map(d=>d.title)).toEqual(['3.']);
  expect(documentText(material.drafts[0].body)).toContain('\\n4. 示例');
});

test('HTTP：数字题后的集中配图不猜归属，新小结及表外报告保持未分配',async()=>{
  const figure=fs.readFileSync(new URL('./fixtures/materials-questions/recognition/I-1/derived/imgs/img_in_image_box_323_511_1330_984.png',import.meta.url));
  const file=await upload(sourceImage('I-1'),'mixed.png');
  const html='<p>教学环节：课后作业</p>'+table([header,['1. 如图判断 $a(t)=2t$。<p>2. 如图判断 $b(t)=t^2$。</p><img src="imgs/shared.png"/>','活动','点评']])+
    '<p>教学环节：课堂小结</p>'+table([header,['1. 回顾 $f(-x)=f(x)$。','活动','点评']])+'<p>1. 调查过程</p><p>调查目的：分析课堂效果。</p>';
  await recognize(file,[1],[response(html,[{name:'imgs/shared.png',bytes:figure}])]);
  const {material}=await collect(file,[1]);expect(material.drafts.map(d=>d.title)).toEqual(['1.','2.']);
  expect(material.drafts.every(d=>images(d.body).length===0&&d.issues.some(i=>i.code==='missing-figure'))).toBe(true);
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('调查过程');
});

test('HTTP：教学表外明确题目和原有答案仍按原路径收录',async()=>{
  const file=await upload(sourceImage('I-1'),'outside-questions.png');
  await recognize(file,[1],[response('<p>Q7. 已知 $g(x)=2x+1$，求 $g(3)$。</p><p>答案：$7$。</p>'+table([header,
    ['【练习8】已知 $f(x)=x^2$，求 $f(3)$。','教师组织讨论','设计点评']])+
    '<p>Q9. 已知 $h(t)=t+4$，求 $h(2)$。</p><p>答案：$6$。</p>')]);
  const {material}=await collect(file,[1]);
  expect(material.drafts.map(d=>d.title)).toEqual(expect.arrayContaining(['Q7.','练习8','Q9.']));
  expect(material.drafts).toHaveLength(3);
  for(const [title,answer] of [['Q7.','7'],['Q9.','6']]){
    const draft=material.drafts.find(d=>d.title===title);
    expect(math(draft.body)).toHaveLength(2);expect(draft.answerStatus).toBe('present');expect(math(draft.solution)).toEqual([answer]);
  }
});

test('HTTP：报告范围不吞后续明确题号和新练习范围，原报告不变成题目',async()=>{
  const file=await upload(sourceImage('I-1'),'bounded-report.png');
  await recognize(file,[1],[response(table([header,['【练习8】计算 $f(x)=x^2$。','活动','点评']])+
    '<h2>（十）教学成效与分析</h2><p>1. 调查过程</p><p>调查目的：了解课堂效果。</p><p>2. 数据记录</p>'+
    '<p>Q9. 求 $g(2)$，其中 $g(x)=3x$。</p><p>答案：$6$。</p>'+
    '<h2>教学环节：课后练习</h2><p>10. 求 $h(1)$，其中 $h(t)=t+3$。</p>')]);
  const {material}=await collect(file,[1]);
  expect(material.drafts.map(d=>d.title)).toEqual(expect.arrayContaining(['练习8','Q9.','10.']));expect(material.drafts).toHaveLength(3);
  expect(material.drafts.every(d=>!documentText(d.body).match(/调查|记录|成效/))).toBe(true);
  expect(math(material.drafts.find(d=>d.title==='Q9.').solution)).toEqual(['6']);
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('数据记录');
});

test('HTTP：教学报告之后的明确答案范围仍与表外原题匹配',async()=>{
  const file=await upload(sourceImage('I-1'),'outside-answer.png');
  await recognize(file,[1],[response('<p>Q7. 已知 $g(x)=2x+1$，求 $g(3)$。</p>'+table([header,
    ['【练习8】计算 $f(x)=x^2$。','活动','点评']])+
    '<h2>课堂小结</h2><p>1. 调查过程</p><h2>参考答案</h2><p>Q7. $7$。</p>')]);
  const {material}=await collect(file,[1]);expect(material.drafts).toHaveLength(2);
  const draft=material.drafts.find(d=>d.title==='Q7.');expect(draft.answerStatus).toBe('present');
  expect(math(draft.solution)).toEqual(['7']);expect(documentText(draft.body)).not.toContain('调查');
});

for(const scope of ['教学环节：课堂小结','调查报告'])test(`HTTP：${scope}范围穿过教学表，表后回顾列表仍未分配`,async()=>{
  const file=await upload(sourceImage('I-1'),'summary-table.png');
  await recognize(file,[1],[response(`<h2>${scope}</h2>`+table([header,
    ['回顾奇偶函数的性质。','学生回顾','整理知识']])+'<p>1. 回顾本节学习内容。</p>')]);
  const {material}=await collect(file,[1]);expect(material.drafts).toEqual([]);
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('回顾本节学习内容');
});

for(const boundary of ['<h2>教学环节：课后练习</h2><p>11.','<p>Q11.'])test(`HTTP：小结表后遇到${boundary.includes('环节')?'新练习环节':'明确Q题号'}恢复表外收录`,async()=>{
  const file=await upload(sourceImage('I-1'),'summary-then-exercise.png');
  await recognize(file,[1],[response('<h2>教学环节：课堂小结</h2>'+table([header,
    ['回顾奇偶函数的性质。','学生回顾','整理知识']])+'<p>1. 回顾本节学习内容。</p>'+boundary+
    ' 已知 $g(t)=t+3$，求 $g(2)$。</p><p>答案：$5$。</p>')]);
  const {material}=await collect(file,[1]);expect(material.drafts).toHaveLength(1);
  const draft=material.drafts[0];expect(draft.title).toBe(boundary.includes('环节')?'11.':'Q11.');
  expect(math(draft.body)).toEqual(['g(t)=t+3','g(2)']);expect(math(draft.solution)).toEqual(['5']);
  expect(documentText(draft.body)).not.toContain('回顾');
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('回顾本节学习内容');
});

test('HTTP：唯一缺题目数据的表格题可续接，保留原片段且跨页疑点阻止入库',async()=>{
  const file=await upload(fs.readFileSync(pdf),'unseen.pdf');
  await recognize(file,[1,2],[response(startTable(missing)),response(endTable(ordered+'\\n【问题12】不能混入题干。\\n教师：组织讨论。'))]);
  let {material}=await collect(file,[1,2]);
  expect(material.drafts.map(d=>d.title)).toEqual(['思考37']);
  const draft=material.drafts[0];
  expect(math(draft.body)).toEqual(['u(t)=2t+9','v(t)=t^3-2','w(t)=1/t']);
  expect(documentText(draft.body)).not.toMatch(/问题12|教师|不能混入/);
  expect(draft.parts[0].locations.map(l=>l.page)).toEqual([1,2]);
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('【思考37】');
  expect(material.fragments.map(f=>f.text).join('\n')).toContain('u(t)=2t+9');
  draft.answerStatus='absent';draft.issues=draft.issues.map(i=>({...i,resolution:i.code==='split-boundary'?'open':'corrected'}));
  material=await request('PUT',`${base}/imports/${material.id}`,{baseVersion:material.version,drafts:material.drafts,fragments:material.fragments});
  const blocked=await client.request('POST',`${base}/imports/${material.id}/commit`,{headers:{'Idempotency-Key':randomUUID()},body:{baseVersion:material.version,draftIds:[draft.id]}});
  expect(blocked.status).toBe(409);expect(blocked.text).toContain('draft-not-ready');
  expect(recognizer.calls).toHaveLength(2);
});

const continuationCases=[
  ['新题标题',startTable(missing),endTable('【练习88】'+ordered)],
  ['教师活动开头',startTable(missing),endTable('教师：组织讨论。\\n'+ordered)],
  ['独立新题说明',startTable(missing),endTable('独立练习：计算以下各式。\\n'+ordered)],
  ['空小问',startTable(missing),endTable('(1) $u(t)=2t$ (2)')],
  ['小问序号断开',startTable(missing),endTable('(1) $u(t)=2t$ (3) $v(t)=t^2$')],
  ['同格两个待续题',startTable('【例31】判断函数性质。【思考37】研究以下函数的性质。'),endTable(ordered)],
  ['两行待续题',table([header,['【例31】判断函数性质。','活动','点评'],[missing,'活动','点评']]),endTable(ordered)],
  ['前题后有教师活动',startTable(missing+'\\n教师：下面另做练习。'),endTable(ordered)],
  ['列数变化',startTable(missing),table([[ordered,'活动','点评','旁注']])],
  ['续行合并格',startTable(missing),`<table><tr><td colspan="2">${ordered}</td><td>点评</td></tr></table>`],
  ['前页题目合并格',`<table><tr>${header.map(h=>`<td>${h}</td>`).join('')}</tr><tr><td colspan="2">${missing}</td><td>点评</td></tr></table>`,endTable(ordered)],
  ['跨行覆盖',startTable(missing),`<table><tr><td>${ordered}</td><td rowspan="2">活动</td><td>点评</td></tr><tr><td>教师活动</td><td>点评</td></tr></table>`],
  ['续行缺少单元格',startTable(missing),table([[ordered,'点评'],['课堂小结','活动','点评']])],
  ['新caption',startTable(missing),endTable(ordered).replace('<table>','<table><caption>教学环节：新的活动</caption>')],
  ['表前新标题',startTable(missing),'<p>教学环节：新的活动</p>'+endTable(ordered)],
];
for(const [name,first,last] of continuationCases)test(`HTTP：隐式续题不跨越${name}`,async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  await recognize(file,[1,2],[response(first),response(last)]);
  const {material}=await collect(file,[1,2]);
  expect(material.drafts.some(d=>d.parts.some(part=>new Set(part.locations.map(l=>l.page)).size>1))).toBe(false);
  expect(recognizer.calls).toHaveLength(2);
});

test('HTTP：隐式续题不借用未选前页、非相邻页或另一原件',async()=>{
  const file=await upload(fs.readFileSync(pdf),'material.pdf');
  await recognize(file,[1,2,3],[response(startTable(missing)),response(endTable(ordered)),response(endTable(ordered))]);
  for(const pages of [[2],[1,3]]){
    const {material}=await collect(file,pages);expect(material.drafts.some(d=>d.title==='思考37')).toBe(false);
  }
  const first=await upload(sourceImage('I-1'),'first.png'),second=await upload(sourceImage('I-2'),'second.png');
  await recognize(first,[1],[response(startTable(missing))]);await recognize(second,[1],[response(endTable(ordered))]);
  const created=await request('POST',`${base}/imports`,{title:'两个原件',origin:'',input:{kind:'files',fileIds:[first.id,second.id],pages:[]}});
  await waitJob(created.jobId);const material=await request('GET',`${base}/imports/${created.id}`);
  expect(material.drafts).toEqual([]);expect(recognizer.calls).toHaveLength(5);
});

for(const interruption of ['failed','cancelled'])test(`HTTP：隐式续题在${interruption}后重试，人工稿、忽略和入库身份保留`,async()=>{
  const file=await upload(fs.readFileSync(path.resolve('apps/web/e2e/fixtures/materials-questions/PS.pdf')),'scan.pdf');
  let entered, resumed=false;const reached=new Promise(resolve=>{entered=resolve;});
  recognizer.run=async input=>{
    recognizer.calls.push('controlled');
    if(recognizer.calls.length===1)return response(startTable(missing))(input);
    if(!resumed){
      if(interruption==='failed')throw Error('Controlled page failure');
      entered();await new Promise((resolve,reject)=>input.signal.addEventListener('abort',()=>reject(input.signal.reason),{once:true}));
    }
    return response(endTable(ordered))(input);
  };
  const created=await request('POST',`${base}/imports`,{title:'可恢复续题',origin:'',input:{kind:'files',fileIds:[file.id],pages:[{fileId:file.id,pages:[1,2]}]}});
  if(interruption==='cancelled'){await reached;await request('POST',`/api/workbench/jobs/${created.jobId}/cancel`,{});}
  const stopped=await waitJob(created.jobId);expect(stopped.state).toBe(interruption==='failed'?'partial':'cancelled');
  expect((await request('GET',`${base}/imports/${created.id}`)).drafts).toEqual([]);
  resumed=true;
  let retry=await request('POST',`/api/workbench/jobs/${created.jobId}/retry`,{unitIds:[]});await waitJob(retry.id);
  let material=await request('GET',`${base}/imports/${created.id}`);expect(material.drafts).toHaveLength(1);
  const draft=structuredClone(material.drafts[0]);draft.title='老师的跨页校对';draft.disposition='ignored';
  walkBlocks(draft.body.blocks,b=>{for(const r of b.runs??[])if(r.type==='math')r.latex='u(t)=17t+6';});
  material=await request('PUT',`${base}/imports/${created.id}`,{baseVersion:material.version,drafts:[draft],fragments:material.fragments});
  retry=await request('POST',`/api/workbench/jobs/${retry.id}/retry`,{unitIds:[`file:${file.id}:page:2`]});await waitJob(retry.id);
  material=await request('GET',`${base}/imports/${created.id}`);expect(material.drafts).toEqual([draft]);
  draft.disposition='pending';draft.answerStatus='absent';draft.issues=draft.issues.map(i=>({...i,resolution:'corrected'}));
  material=await request('PUT',`${base}/imports/${created.id}`,{baseVersion:material.version,drafts:[draft],fragments:material.fragments});
  const committed=await request('POST',`${base}/imports/${created.id}/commit`,{baseVersion:material.version,draftIds:[draft.id]});
  retry=await request('POST',`/api/workbench/jobs/${retry.id}/retry`,{unitIds:[`file:${file.id}:page:2`]});await waitJob(retry.id);
  material=await request('GET',`${base}/imports/${created.id}`);expect(material.drafts).toHaveLength(1);
  expect(material.drafts[0].questionId).toBe(committed.questions[0].id);expect(material.drafts[0].body).toEqual(draft.body);
  expect((await request('GET',`${base}/items/${committed.questions[0].id}`)).body).toEqual(draft.body);
  expect(recognizer.calls).toHaveLength(3);
});

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

// Recorded document-4 raw and figure excerpts are bundled; the full external PDF is supplied explicitly.
test('HTTP：真实 E.pdf 提取三题，例题续页保留四个原式与两页来源',async()=>{
  test.skip(!process.env.M33_PRIVATE_PDF,'需要下载并指定完整外部E原稿；真实回放随仓库提供');
  const directory=process.env.QUESTIONS_OCR_EVIDENCE_DIR??recordedPages;
  const responses=[7,8].map(number=>{
    const at=file=>path.join(directory,`E-${number}`,file);
    const result=JSON.parse(fs.readFileSync(at('result.json'))),raw=JSON.parse(fs.readFileSync(at('raw.json')));
    const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
    return input=>{
      expect(hash(input.bytes)).toBe(result.inputHash);
      return {raw,width:raw.width,height:raw.height,derivations:result.derivations,
        assets:result.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(result.assetFileIds[i]+'.bin'))})),
        originalAssets:result.derivations.map((d,i)=>({name:d.name,bytes:fs.readFileSync(at(result.originalAssetFileIds[i]+'.bin'))}))};
    };
  });
  const file=await upload(externalPdf(),'E.pdf');
  await recognize(file,[7,8],responses);
  const {job,material}=await collect(file,[7,8]);
  expect(job.state).toBe('partial');expect(recognizer.calls).toHaveLength(2);
  expect(material.drafts.map(d=>d.title)).toEqual(['例6','练习','思考']);
  const [example,practice,thought]=material.drafts;
  const rawPage=JSON.parse(fs.readFileSync(path.join(directory,'E-8/result.json')));
  expect(math(example.body)).toEqual(math({blocks:rawPage.blocks[0].document.blocks[0].rows[0][0].blocks}));
  expect(math(example.body)).toHaveLength(4);
  expect(documentText(example.body)).not.toMatch(/问题6|除了定义法|教师/);
  expect([...new Set(example.parts.flatMap(part=>part.locations.map(l=>l.page)))]).toEqual([7,8]);
  expect(example.issues.some(i=>i.code==='split-boundary'&&i.resolution==='open')).toBe(true);
  expect(math(practice.body)).toEqual(math({blocks:rawPage.blocks[0].document.blocks[0].rows[1][0].blocks}));
  expect(math(thought.body)).toEqual(math({blocks:rawPage.blocks[0].document.blocks[0].rows[2][0].blocks}));
  expect(images(thought.body)).toHaveLength(1);
  for(const draft of [practice,thought]){
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

for(const withFigure of [false,true])test(withFigure
  ? '浏览器：受控图文表片段归入题干后保存、刷新和入库保留图片引用与来源'
  : '浏览器：D8 未分配活动表归入题干后保存、刷新和入库保留原结构与来源',async({page},info)=>{
  // Replay the checked-in official MinerU output. This does not run OCR inference.
  // The separate controlled image case tests assignment, not OCR quality.
  const fixtures=path.resolve('apps/api/test/fixtures/mineru-recognition/D8');
  const raw=withFigure?{pages:[{blocks:[
    {type:'text',bbox:[.1,.1,.9,.2],content:[{type:'text',content:'Q1. 请观察下表。'}]},
    {type:'table',bbox:[.1,.3,.9,.9],content:[{type:'table_body',content:'<table><tr><td>记录</td><td><eq>x<y</eq><img src="imgs/figure.png"/></td></tr></table>'}]},
  ]}]}:JSON.parse(fs.readFileSync(path.join(fixtures,'middle_json.json')));
  recognizer.revision='mineru-pro-2605/document-6';
  recognizer.run=async({width,height})=>{
    recognizer.calls.push({width,height});
    return {raw,pageBlocks:raw.pages[0].blocks,width,height,assets:withFigure?[{
      name:'imgs/figure.png',bytes:fs.readFileSync(path.resolve('apps/web/e2e/fixtures/materials-questions/figure.png')),
    }]:[],derivations:[],
      originalAssets:fs.readdirSync(path.join(fixtures,'images')).map(name=>({name:`images/${name}`,bytes:fs.readFileSync(path.join(fixtures,'images',name))}))};
  };
  await page.goto(world.origin+'/questions');
  await page.getByLabel('邮箱',{exact:true}).fill(email);
  await page.getByLabel('密码',{exact:true}).fill('math-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const welcome=page.getByRole('button',{name:'知道了',exact:true});
  if(await welcome.isVisible())await welcome.click();
  await page.getByRole('button',{name:'从资料收录',exact:true}).first().click();
  await page.getByRole('button',{name:/^上传图片/}).click();
  await page.getByLabel('选择原稿').setInputFiles(path.resolve('apps/api/test/fixtures/ocr-selection/pages/D8.png'));
  const accepted=page.waitForResponse(r=>r.url().endsWith('/questions/v2/imports')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'开始整理',exact:true}).click();
  const created=await(await accepted).json();
  expect((await waitJob(created.jobId)).state).toBe('partial');
  const before=await request('GET',`${base}/imports/${created.id}`);
  expect(before.drafts).toHaveLength(1);expect(before.fragments).toHaveLength(1);
  const fileId=created.input.fileIds[0];
  const machine=await request('GET',`/api/workbench/files/${fileId}/recognition/pages/1?renditionFileId=${fileId}`);
  const originalTable=machine.document.blocks.find(block=>block.type==='table');
  expect(originalTable).toBeTruthy();expect(math({blocks:[originalTable]})).toHaveLength(withFigure?1:4);
  const originalBody=before.drafts[0].body;
  await expect(page.getByRole('button',{name:'修改题目',exact:true})).toBeEnabled();
  await page.locator('summary').filter({hasText:'未分配片段'}).click();
  await page.screenshot({path:info.outputPath('D8-before.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'归入题干',exact:true}).click();
  await page.getByRole('button',{name:'保存检查进度',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('button',{name:'修改题目',exact:true})).toBeEnabled();
  const reopened=await request('GET',`${base}/imports/${created.id}`);
  fs.writeFileSync(info.outputPath('D8-saved-reopened.json'),JSON.stringify({before,machine,reopened},null,2));
  await page.screenshot({path:info.outputPath('D8-reopened.png'),fullPage:true,animations:'disabled'});
  expect(reopened.drafts[0].body.blocks).toEqual([...originalBody.blocks,originalTable]);
  expect(reopened.fragments[0].document.blocks).toEqual([originalTable]);
  expect(reopened.drafts[0].parts.at(-1)).toEqual({role:'body',locations:before.fragments[0].locations});
  await expect(page.getByRole('article',{name:'待检查题干',exact:true}).locator('table')).toBeVisible();
  await page.locator('summary').filter({hasText:'未分配片段'}).click();
  await expect(page.getByLabel('片段处理')).toHaveValue('assigned');
  await expect(page.getByRole('button',{name:'归入题干',exact:true})).toBeDisabled();
  await page.getByLabel('片段处理').selectOption('unassigned');
  await expect(page.getByRole('button',{name:'归入题干',exact:true})).toBeEnabled();
  await page.getByLabel('片段处理').selectOption('ignored');
  await page.locator('summary').filter({hasText:'未分配片段'}).click();
  await page.getByRole('button',{name:'修改题目',exact:true}).click();
  await page.getByLabel('答案状态',{exact:true}).selectOption('absent');
  await page.getByRole('button',{name:'完成修改',exact:true}).click();
  for(const select of await page.locator('.q-review-checks select').all())await select.selectOption('corrected');
  await page.getByRole('button',{name:'确认这道题',exact:true}).click();
  await expect(page.getByText('这道题已入库',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('这道题已入库',{exact:true})).toBeVisible();
  const confirmed=await request('GET',`${base}/imports/${created.id}`);
  const question=await request('GET',`${base}/items/${confirmed.drafts[0].questionId}`);
  fs.writeFileSync(info.outputPath('confirmed-readback.json'),JSON.stringify({withFigure,confirmed,question},null,2));
  expect(question.body).toEqual(confirmed.drafts[0].body);
  expect(question.body.blocks.at(-1)).toEqual(originalTable);
  expect(question.source.parts.at(-1)).toEqual({role:'body',locations:before.fragments[0].locations});
  expect(recognizer.calls).toHaveLength(1);
  await page.getByRole('button',{name:'查看题目',exact:true}).click();
  await expect(page.getByRole('article',{name:'题干',exact:true}).locator('table')).toBeVisible();
  if(withFigure) {
    const imageIds=images(question.body);
    expect(imageIds).toEqual(images({blocks:[originalTable]}));expect(imageIds).toHaveLength(1);
    const image=page.getByRole('article',{name:'题干',exact:true}).locator('img');
    await expect(image).toBeVisible();expect(await image.evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
    expect((await client.request('GET',`/api/workbench/files/${imageIds[0]}/content`)).status).toBe(200);
  }
  for(const theme of ['light','dark']) {
    if(theme==='dark') {
      await page.setViewportSize({width:1440,height:900});
      await page.getByRole('link',{name:'账户：数学教师',exact:true}).click();
      await page.getByRole('button',{name:'深色',exact:true}).click();
      await page.getByRole('navigation',{name:'功能模块'}).getByRole('link',{name:/^题库/}).click();
      await expect(page.locator('html')).toHaveAttribute('data-workbench-theme','dark');
    }
    for(const width of [1440,600]) {
      await page.setViewportSize({width,height:900});
      const table=page.getByRole('article',{name:'题干',exact:true}).locator('table');
      await table.scrollIntoViewIfNeeded();
      await expect(table.locator('tr')).toHaveCount(withFigure?1:6);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
      await page.screenshot({path:info.outputPath(`D8-${theme}-${width}.png`),fullPage:true,animations:'disabled'});
    }
  }
});
