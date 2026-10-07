import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from 'better-sqlite3';
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { registerMath } from "../../web/e2e/fixtures/math-static/real.mjs";
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';
import { replayRecognizer, sourceImage } from '../../web/e2e/fixtures/materials-questions/recognition/replay.mjs';

const base = "/api/workbench/files";
const image = fs.readFileSync(new URL("../../web/e2e/fixtures/materials-questions/figure.png", import.meta.url));

test('HTTP cancellation during raw storage waits for owned model stop and retains complete evidence', async () => {
  const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const storing = gate(), releaseStorage = gate(), stopping = gate(), releaseStop = gate();
  let stoppedAccount, world;
  try {
    world = await createIntegration({ workbench: { recognition: { recognizer: {
      revision: 'storage-boundary-1', async run() { return machinePage(); },
      async stopAccountAndWait(accountKey) { stoppedAccount = accountKey; stopping.resolve(); await releaseStop.promise; },
    } } } });
    const { client, session } = await registerMath(world, 'storage-boundary@example.test');
    const file = await upload(client), source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`;
    const original = world.workbench.files.store;
    world.workbench.files.store = async (principal, input, ...args) => {
      if (input.name === 'recognition.json') { storing.resolve(); await releaseStorage.promise; }
      return original(principal, input, ...args);
    };
    const accepted = await write(client, endpoint, { renditionFileId: source.renditionFileId, pages: [1] });
    await storing.promise;
    assert.equal((await write(client, `/api/workbench/jobs/${accepted.json.id}/cancel`, {})).status, 200);
    await stopping.promise;
    assert.equal(stoppedAccount, session.account.accountKey);
    releaseStorage.resolve();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal((await client.request('GET', `/api/workbench/jobs/${accepted.json.id}`)).json.state, 'cancelling');
    releaseStop.resolve();
    const job = await waitJob(client, accepted.json.id);
    assert.equal(job.state, 'cancelled');
    const page = (await client.request('GET', `${endpoint}/pages/1?renditionFileId=${source.renditionFileId}`)).json;
    assert.equal(page.state, 'interrupted');
    const request = JSON.parse(world.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(job.id).value);
    assert.equal(request.lateResult.rawFileId, page.rawFileId);
    assert.equal((await client.request('GET', `${base}/${page.rawFileId}/content`)).status, 200);
  } finally {
    releaseStorage.resolve(); releaseStop.resolve();
    await world?.close();
  }
});
async function upload(client, name = "scan.png", bytes = image) {
  const boundary = `ocr-${randomUUID()}`;
  const response = await client.request("POST", base, {
    headers: { "Idempotency-Key": randomUUID() },
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),
      bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.status, 201, response.text);
  return response.json;
}
async function write(client, url, body, key = randomUUID()) {
  return client.request("POST", url, { body, headers: { "Idempotency-Key": key } });
}
async function waitJob(client, id) {
  for (let i = 0; i < 200; i++) {
    const result = await client.request("GET", `/api/workbench/jobs/${id}`);
    assert.equal(result.status, 200, result.text);
    if (!["queued", "running", "cancelling"].includes(result.json.state)) return result.json;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error("Recognition job did not finish");
}
async function preview(client, file) {
  const accepted = await write(client, `${base}/${file.id}/preview`, {});
  assert.equal(accepted.status, 202, accepted.text);
  assert.equal((await waitJob(client, accepted.json.id)).state, "succeeded");
  return (await client.request("GET", `${base}/${file.id}/preview`)).json;
}
function machinePage() {
  const text = "原稿中文 $\\frac{1}{x-2}$，未经校对。";
  return { width: 240, height: 160, raw: { width: 240, height: 160, parsing_res_list: [
    { block_id: 0, block_label: "text", block_content: text, block_bbox: [10, 10, 200, 50], block_order: 1 },
  ] }, markdown: text, assets: [] };
}

test('captured OCR geometry recovers inline subscripts through HTTP and survives restart without changing raw', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-format-'));
  const recognizer = await replayRecognizer();
  let world, passed = false;
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    let { client } = await registerMath(world, 'recognition-format@example.test');
    const file = await upload(client, 'geometry.png', sourceImage('I-3'));
    const source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`;
    const query = `?renditionFileId=${source.renditionFileId}`;
    const accepted = await write(client, endpoint, { renditionFileId: source.renditionFileId, pages: [1] });
    assert.equal((await waitJob(client, accepted.json.id)).state, 'succeeded');
    const page = (await client.request('GET', `${endpoint}/pages/1${query}`)).json;
    const raw = JSON.parse(fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/recognition/I-3/raw.json', import.meta.url)));
    const storedRaw = await client.request('GET', `${base}/${page.rawFileId}/content`);
    assert.deepEqual(JSON.parse(storedRaw.text), raw);
    assert.deepEqual(page.blocks.map(b => b.block_content), raw.parsing_res_list.map(b => b.block_content));
    assert.deepEqual(page.blocks.find(b => b.block_id === 4).document.blocks[0].runs, [
      { type: 'text', text: 'Q6. 正方体 ' },
      { type: 'math', latex: 'ABCD-A_{1}B_{1}C_{1}D_{1}' },
      { type: 'text', text: ' 的棱长为 2。' },
    ]);
    assert.deepEqual(page.blocks.find(b => b.block_id === 5).document.blocks[0].runs, [
      { type: 'text', text: '（1）求体对角线' }, { type: 'math', latex: 'AC_{1}' },
      { type: 'text', text: '的长；（2）求体积。' },
    ]);
    assert(page.issues.some(i => i.code === 'math-recovered' && i.blockId === 4));
    assert.equal(page.issues.some(i => i.code === 'unparsed-math'), false);
    assert.equal(page.document.blocks.filter(b => b.type === 'image').length, 2);
    const jar = client.jar;
    await world.close(); world = null;
    world = await createIntegration({ directory });
    client = world.client(); client.jar = jar;
    const reopened = (await client.request('GET', `${endpoint}/pages/1${query}`)).json;
    assert.deepEqual(reopened.document, page.document);
    assert.deepEqual(reopened.issues, page.issues);
    assert.deepEqual(reopened.location, page.location);
    assert.equal(reopened.rawFileId, page.rawFileId);
    assert.deepEqual(recognizer.calls, ['I-3']);
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error(`Retained recognition reproduction: ${directory}`);
  }
});

test('OCR formatting recovers bounded notation and table lines while preserving literal contexts over HTTP', async () => {
  const sources = [
    '连接P_{12}Q_{3}，保留 ABC 与 ordinary English。',
    String.raw`<table><tr><td>第一行\n第二行 $f(x)=\begin{cases}x,&x<0\\-x,&x>0\end{cases}$\n(2) 下一问</td><td>相邻单元格</td></tr></table>`,
    'file_name version_1 abcA_{1} A_{1}word A_{1}B_{2 A_{1}_{2} A_{i+1}',
    String.raw`\neq \nu \nabla \newcommand \{A_{1}\} A_{1}.png C:\notes C:\n https://example.test/A_{1} /tmp/A_{1} A_{1}/B`,
    '`A_{1}\\nB`',
    '```text\nA_{1}\\nB\n```',
    String.raw`<pre>A_{1}\nB</pre><code>C_{2}\nD</code>`,
    String.raw`双反斜杠\\n保留。`,
    String.raw`[A_{1}\nB](https://example.test/A_{1})`,
    String.raw`<a href="https://example.test/A_{1}">A_{1}\nB</a>`,
    String.raw`文本 $A_{1}\neq B_{2}$ 后续。`,
    String.raw`输入 \n 表示换行，原字符串 "P_{2}\n中文" 保留。`,
    String.raw`前缀\nSuffix ABC version_1。`,
    String.raw`源码 " P_{2} \n 中文 " 与 ‘Q_{3}\n测试’ 保留。`,
  ];
  const raw = { width: 240, height: 160, parsing_res_list: sources.map((block_content, block_id) => ({
    block_id, block_label: 'text', block_content, block_bbox: [1,1,200,100],
  })) };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-boundaries-'));
  let world, passed = false;
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer: {
      revision: 'format-boundaries', async run() { return {raw, assets: [], width: 240, height: 160}; },
    } } } });
    const {client} = await registerMath(world, 'recognition-boundaries@example.test');
    const file = await upload(client), source = await preview(client, file);
    const baseUrl = `${base}/${file.id}/recognition`;
    const accepted = await write(client, baseUrl, {renditionFileId:source.renditionFileId,pages:[1]});
    assert.equal((await waitJob(client, accepted.json.id)).state, 'succeeded');
    const page = (await client.request('GET', `${baseUrl}/pages/1?renditionFileId=${source.renditionFileId}`)).json;
    const content = id => page.blocks.find(b=>b.block_id===id).document.blocks;
    const runs = blocks => blocks.flatMap(b=>b.runs ?? (b.rows ?? []).flatMap(row=>row.flatMap(cell=>runs(cell.blocks))));
    assert.deepEqual(runs(content(0)).filter(r=>r.type==='math').map(r=>r.latex), ['P_{12}Q_{3}']);
    const table = content(1)[0];
    assert.equal(table.type, 'table');
    assert.equal(table.rows[0].length, 2);
    assert.equal(table.rows[0][0].blocks.length, 3, 'literal newlines become visible paragraph boundaries');
    assert.deepEqual(table.rows[0][0].blocks.map(b=>b.runs.map(r=>r.text ?? r.latex).join('')), [
      '第一行', String.raw`第二行 f(x)=\begin{cases}x,&x<0\\-x,&x>0\end{cases}`, '(2) 下一问',
    ]);
    assert.equal(table.rows[0][1].blocks[0].runs[0].text, '相邻单元格');
    assert(page.issues.some(i=>i.code==='text-lines-recovered' && i.blockId===1));
    for(const id of [2,3,4,5,6,7,8,9,11,12,13]) {
      assert.equal(runs(content(id)).some(r=>r.type==='math'), false, `literal source ${id} is not a formula`);
      assert.equal(page.issues.some(i=>['math-recovered','text-lines-recovered'].includes(i.code) && i.blockId===id),false, `literal source ${id} has no recovery`);
    }
    assert.equal(content(2)[0].runs.map(r=>r.text).join(''),sources[2]);
    assert.equal(content(3)[0].runs.map(r=>r.text).join(''),sources[3]);
    assert.equal(content(4)[0].runs[0].text,'A_{1}\\nB');
    assert.equal(content(5)[0].runs[0].text,'A_{1}\\nB');
    assert.deepEqual(content(6).map(b=>b.runs[0].text),['A_{1}\\nB','C_{2}\\nD']);
    assert.equal(content(7)[0].runs[0].text,sources[7]);
    for(const id of [11,12,13]) assert.equal(content(id)[0].runs.map(r=>r.text).join(''),sources[id]);
    assert(page.issues.some(i=>i.code==='text-format-uncertain' && i.blockId===11));
    assert.deepEqual(runs(content(10)).filter(r=>r.type==='math').map(r=>r.latex),[String.raw`A_{1}\neq B_{2}`]);
    assert(page.issues.some(i=>i.code==='unparsed-math' && i.blockId===2));
    assert.deepEqual(JSON.parse((await client.request('GET',`${base}/${page.rawFileId}/content`)).text),raw);
    passed = true;
  } finally {
    await world?.close();
    if(passed)fs.rmSync(directory,{recursive:true,force:true});
    else console.error(`Retained boundary reproduction: ${directory}`);
  }
});

test('OCR numbered line boundaries and adjacent HTML image separators recover without decoding commands', async () => {
  const sources = [
    String.raw`<table><tr><td>定义。\n12. 下一条。\n3.总结。\n4) 第四条。</td><td>保留</td></tr></table>`,
    String.raw`<table><tr><td><img src="one.png" alt="one"/>\n<img src="two.png" alt="two\n20. caption"/></td></tr></table>`,
    String.raw`保留 \n2 与 \n2.5、\n2_{1}、\nu2、\n{2}、\n[2]、\n^2、\n2.、\n3.foo。`,
    String.raw`<table><tr><td>\n</td><td><img src="one.png"/>\n<span>说明</span></td></tr></table>`,
    String.raw`<img src="one.png"/>\\n<img src="two.png"/>`,
    String.raw`<table><tr><td><code>\n12. test</code></td><td>"句子\n23.下一句"</td><td>C:\n24. 路径</td><td>https://example.test/\n25. 路径</td><td>双转义\\n26.文字</td></tr></table>`,
    String.raw`P_{12}\n第二行`,
    String.raw`命令 <code>A_{1}\n中文</code> 保持字面`,
    String.raw`链接 <a href="https://example.test/A_{1}">A_{1}\n中文</a> 保持字面`,
    String.raw`命令 **<code>*B_{2}*\n中文</code>** 保持字面`,
    String.raw`命令 **前缀 <code>A_{1}**\n中文</code> 保持字面`,
    String.raw`链接 **前缀 <a href="https://example.test/A_{1}">A_{1}**\n中文</a> 保持字面`,
    '命令 <code>`A_{1}</code>剩余` 后文',
    '命令 <code>A_{1}\n\n第二段</code> 后文\n\n恢复 P_{12}\\n最后',
    '命令 **前缀 <code>A_{1}**\\n中文\n\n下一段 P_{12}\\n最后',
    '命令 <code>A_{1} **前缀</code> 后缀** 结束',
    '1. <code>A_{1}\n2. B_{2}</code> 后文\n3. P_{12}\\n最后',
  ];
  const raw = {width:240,height:160,parsing_res_list:sources.map((block_content,block_id)=>({
    block_id,block_label:'text',block_content,block_bbox:[1,1,200,100],
  }))};
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'recognition-numbered-lines-'));
  let world, passed = false;
  try {
    world = await createIntegration({directory,workbench:{recognition:{recognizer:{
      revision:'format-numbered-lines',async run(){return {raw,width:240,height:160,
        assets:['one.png','two.png'].map(name=>({name,bytes:image}))};},
    }}}});
    let {client} = await registerMath(world,'recognition-numbered-lines@example.test');
    const file=await upload(client),source=await preview(client,file),endpoint=`${base}/${file.id}/recognition`;
    const accepted=await write(client,endpoint,{renditionFileId:source.renditionFileId,pages:[1]});
    assert.equal((await waitJob(client,accepted.json.id)).state,'succeeded');
    const url=`${endpoint}/pages/1?renditionFileId=${source.renditionFileId}`;
    const page=(await client.request('GET',url)).json;
    const content=id=>page.blocks.find(b=>b.block_id===id).document.blocks;
    assert.deepEqual(content(0)[0].rows[0][0].blocks.map(b=>b.runs.map(r=>r.text).join('')),
      ['定义。','12. 下一条。','3.总结。','4) 第四条。']);
    assert.deepEqual(content(1)[0].rows[0][0].blocks.map(b=>b.type),['image','image']);
    assert.equal(content(1)[0].rows[0][0].blocks[1].alt,String.raw`two\n20. caption`);
    assert.equal(content(2)[0].runs.map(r=>r.text).join(''),sources[2]);
    assert.equal(content(3)[0].rows[0][0].blocks[0].runs[0].text,String.raw`\n`);
    assert(content(3)[0].rows[0][1].blocks.some(b=>b.runs?.some(r=>r.text===String.raw`\n`)));
    assert(content(4).some(b=>b.runs?.some(r=>r.text===String.raw`\\n`)));
    assert.deepEqual(content(6),[
      {type:'paragraph',runs:[{type:'math',latex:'P_{12}'}]},
      {type:'paragraph',runs:[{type:'text',text:'第二行'}]},
    ]);
    for(const [id,expected] of [[7,String.raw`A_{1}\n中文`],[8,String.raw`A_{1}\n中文`],[9,String.raw`*B_{2}*\n中文`]]) {
      assert(content(id).some(b=>b.runs?.some(r=>r.type==='text' && r.text===expected)),`inline HTML literal ${id}`);
      assert.equal(content(id).some(b=>b.runs?.some(r=>r.type==='math')),false);
      assert.equal(content(id).flatMap(b=>b.runs ?? []).map(r=>r.text).join(''),
        `${id===8 ? '链接' : '命令'} ${expected} 保持字面`);
    }
    for (const id of [10,11]) {
      const expected=String.raw`A_{1}**\n中文`;
      assert(content(id).some(b=>b.runs?.some(r=>r.type==='text' && r.text===expected)),`cross-subtree HTML literal ${id}`);
      assert.equal(content(id).flatMap(b=>b.runs ?? []).map(r=>r.text ?? r.latex).join(''),
        `${id===11 ? '链接' : '命令'} 前缀 ${expected} 保持字面`);
      assert.equal(page.issues.some(i=>['text-lines-recovered','math-recovered','text-format-uncertain'].includes(i.code) && i.blockId===id),false);
    }
    const textOf=id=>content(id).flatMap(b=>b.runs ?? []).map(r=>r.text ?? r.latex).join('');
    assert.equal(textOf(12),'命令 `A_{1}剩余` 后文');
    assert(page.issues.some(i=>i.code==='text-format-uncertain' && i.blockId===12));
    assert.equal(textOf(13),'命令 A_{1}\n\n第二段 后文恢复 P_{12}最后');
    assert(content(13).some(b=>b.runs?.some(r=>r.text==='A_{1}\n\n第二段')));
    assert.equal(page.issues.some(i=>i.code==='text-format-uncertain' && i.blockId===13),false);
    assert.equal(textOf(14),'命令 前缀 A_{1}**\\n中文下一段 P_{12}最后');
    assert(page.issues.some(i=>i.code==='text-format-uncertain' && i.blockId===14));
    for (const id of [13,14]) {
      assert.deepEqual(content(id).flatMap(b=>b.runs ?? []).filter(r=>r.type==='math').map(r=>r.latex),['P_{12}']);
      assert.equal(content(id).at(-1).runs[0].text,'最后');
    }
    assert.equal(textOf(15),'命令 A_{1} **前缀 后缀 结束');
    assert.equal(page.issues.some(i=>['text-lines-recovered','math-recovered','text-format-uncertain'].includes(i.code) && i.blockId===15),false);
    assert.deepEqual(content(16),[{type:'list',role:'plain',items:[
      {label:'1.',blocks:[{type:'paragraph',runs:[{type:'text',text:'A_{1}\n2. B_{2}'}]}]},
      {label:'',blocks:[{type:'paragraph',runs:[{type:'text',text:' 后文'}]}]},
      {label:'3.',blocks:[{type:'paragraph',runs:[{type:'math',latex:'P_{12}'}]},
        {type:'paragraph',runs:[{type:'text',text:'最后'}]}]},
    ]}]);
    assert(page.issues.some(i=>i.code==='text-lines-recovered' && i.blockId===0));
    assert(page.issues.some(i=>i.code==='text-lines-recovered' && i.blockId===1));
    for(const id of [2,3,4,5,7,8,9])assert.equal(page.issues.some(i=>i.code==='text-lines-recovered' && i.blockId===id),false,`protected block ${id}`);
    assert.deepEqual(JSON.parse((await client.request('GET',`${base}/${page.rawFileId}/content`)).text),raw);
    const jar=client.jar;await world.close();world=null;
    world=await createIntegration({directory});client=world.client();client.jar=jar;
    assert.deepEqual((await client.request('GET',url)).json,page);
    passed=true;
  } finally {
    await world?.close();
    if(passed)fs.rmSync(directory,{recursive:true,force:true});
    else console.error(`Retained numbered line reproduction: ${directory}`);
  }
});

// The injected recognizer only exercises persistence/recovery. Real model
// fidelity and the complete upload-to-module path are verified separately.
test("real-auth page recognition replays acceptance, shares completed pixels and preserves source ownership", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "materials-recognition-"));
  let calls = 0;
  const recognizer = { revision: "integration-1", async run({ bytes, signal }) {
    signal.throwIfAborted();
    assert(bytes.length > 0);
    calls++;
    return machinePage();
  } };
  let world, passed = false;
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    const { client, session } = await registerMath(world, "recognition-a@example.test");
    const other = (await registerMath(world, "recognition-b@example.test")).client;
    const file = await upload(client), source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`;
    const query = `?renditionFileId=${source.renditionFileId}`;
    const before = await client.request("GET", endpoint + query);
    assert.equal(before.status, 200, before.text);
    assert.equal(before.json.pages[0].state, "unprocessed");
    assert.equal(calls, 0, "reading never runs the model");
    const body = { renditionFileId: source.renditionFileId, pages: [1] }, key = randomUUID();
    const accepted = await write(client, endpoint, body, key);
    assert.equal(accepted.status, 202, accepted.text);
    assert.equal((await write(client, endpoint, body, key)).json.id, accepted.json.id);
    assert.equal((await waitJob(client, accepted.json.id)).state, "succeeded");
    const page = (await client.request("GET", `${endpoint}/pages/1${query}`)).json;
    assert.equal(page.state, "ready");
    assert.match(page.text, /原稿中文/);
    assert.equal(page.document.version, 2);
    assert(page.document.blocks.some(block => block.runs?.some(run => run.type === "math" && run.latex === "\\frac{1}{x-2}")));
    assert.equal(page.location.fileId, file.id);
    assert.equal(page.location.page, 1);
    assert.equal(calls, 1);
    assert.equal((await client.request("GET", `${base}/${page.rawFileId}/content`)).status, 200);
    assert.equal((await other.request("GET", endpoint + query)).status, 404);
    assert.equal((await write(other, endpoint, body)).status, 404);

    const duplicate = await upload(client, "same-pixels.png"), duplicatePreview = await preview(client, duplicate);
    const second = await write(client, `${base}/${duplicate.id}/recognition`, { renditionFileId: duplicatePreview.renditionFileId, pages: [1] });
    assert.equal(second.status, 202, second.text);
    assert.equal((await waitJob(client, second.json.id)).state, "succeeded");
    const copy = (await client.request("GET", `${base}/${duplicate.id}/recognition/pages/1?renditionFileId=${duplicatePreview.renditionFileId}`)).json;
    assert.equal(copy.resultId, page.resultId, "the same owned pixels reuse one machine result");
    assert.equal(copy.location.fileId, duplicate.id, "location binds to the actual source being read");
    assert.equal(calls, 1);
    const resource = await write(client, '/api/modules/resources/items', {
      title: '识别来源', fileId: file.id, folderId: null, tagIds: [], note: '',
    });
    assert.equal(resource.status, 201, resource.text);
    const created = await write(client, '/api/modules/lessons/v3', {
      title: '采用识别页', intro: { version: 2, blocks: [] }, sections: [], materials: [],
    });
    assert.equal(created.status, 201, created.text);
    const adopted = await write(client, `/api/modules/lessons/v3/${created.json.id}/sections/adopt-page`, {
      baseVersion: created.json.version, resourceId: resource.json.id, resourceVersion: resource.json.version,
      fileId: file.id, renditionFileId: source.renditionFileId, page: 1, resultId: page.resultId,
      title: '识别页', content: page.document,
    });
    assert.equal(adopted.status, 200, adopted.text);
    const foreign = await upload(other, 'foreign-source.png');
    await world.close();
    world = null;
    const db = new Database(path.join(directory, 'workspace.sqlite'));
    const section = db.prepare('SELECT * FROM lesson_sections WHERE lessonId=?').get(created.json.id);
    const broken = { ...JSON.parse(section.pageSource), rawFileId: foreign.id };
    db.prepare('UPDATE lesson_sections SET pageSource=? WHERE sectionId=?').run(JSON.stringify(broken), section.sectionId);
    try {
      await assert.rejects(backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target: `${directory}-foreign`, stopped: true }), /foreign file reference/,
        'current page source is checked even while the historical snapshot remains valid');
    } finally {
      db.prepare('UPDATE lesson_sections SET pageSource=? WHERE sectionId=?').run(section.pageSource, section.sectionId);
      db.close();
    }
    await backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target: `${directory}-backup`, stopped: true });
    restore({ source: `${directory}-backup`, target: `${directory}-restored`, stopped: true });
    activate({ target: `${directory}-restored`, stopped: true });
    world = await createIntegration({ directory: `${directory}-restored` });
    const restored = world.workbench.recognition.readResult({ accountKey: session.account.accountKey }, page.resultId,
      { fileId: file.id, renditionFileId: source.renditionFileId, page: 1 });
    assert.deepEqual(restored.document, page.document);
    const restoredLesson = world.workbench.loader.get('lessons').port.operations.getLessonV3({
      principal: { accountKey: session.account.accountKey }, id: created.json.id,
    }).body;
    assert.deepEqual(restoredLesson, adopted.json);
    assert.equal(world.workbench.recognition.get({ accountKey: session.account.accountKey }, { fileId: file.id, renditionFileId: source.renditionFileId }).pages[0].state, 'ready', 'saved OCR remains readable with the engine unconfigured');
    assert.equal(calls, 1);
    passed = true;
  } finally {
    await world?.close();
    if (passed) for (const target of [directory, `${directory}-backup`, `${directory}-restored`]) fs.rmSync(target, { recursive: true, force: true });
  }
});

test("recognition failure and cancellation need explicit retry; service restart never resends a page", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "materials-recognition-recovery-"));
  let mode = "fail", calls = 0, entered, releaseLate, lastAccount;
  const cleanedAccounts = [];
  const recognizer = { revision: "integration-recovery-1", async cleanupAccount(accountKey) {
    cleanedAccounts.push(accountKey);
  }, async run({ signal, accountKey }) {
    lastAccount = accountKey;
    calls++;
    entered?.();
    if (mode === "fail") throw new Error("Model unavailable");
    if (mode === "wait" || mode === 'cleanup-failure') await new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(mode === 'cleanup-failure'
        ? Object.assign(new Error('Scope stop failed'), { code: 'recognition-cleanup' }) : signal.reason), { once: true });
      if (signal.aborted) reject(signal.reason);
    });
    if (mode === 'late') await new Promise(resolve => { releaseLate = resolve; });
    return { ...machinePage(), assets: mode === 'late' ? [{ name: 'late-image.png', bytes: image }] : [] };
  } };
  let world, passed = false;
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    let { client, session } = await registerMath(world, "recognition-recovery@example.test");
    const file = await upload(client), source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`;
    const query = `?renditionFileId=${source.renditionFileId}`;
    const body = { renditionFileId: source.renditionFileId, pages: [1] };
    const failed = await write(client, endpoint, body);
    assert.equal((await waitJob(client, failed.json.id)).state, "failed");
    assert.equal((await client.request("GET", `${endpoint}/pages/1${query}`)).json.state, "failed");
    assert.equal(calls, 1);
    assert.equal(lastAccount, session.account.accountKey, 'runtime receives the authenticated account owner');
    await world.workbench.recognition.cleanupAccount(session.account.accountKey);
    assert.deepEqual(cleanedAccounts, [session.account.accountKey]);
    assert.equal((await client.request("GET", endpoint + query)).json.pages[0].state, "failed");
    assert.equal(calls, 1);
    mode = "wait";
    let started = new Promise(resolve => { entered = resolve; });
    const retry = await write(client, `/api/workbench/jobs/${failed.json.id}/retry`, { unitIds: ["page:1"] });
    assert.equal(retry.status, 202, retry.text);
    await started;
    assert.equal((await write(client, `/api/workbench/jobs/${retry.json.id}/cancel`, {})).status, 200);
    assert.equal((await waitJob(client, retry.json.id)).state, "cancelled");
    assert.equal(calls, 2);

    mode = 'late';
    started = new Promise(resolve => { entered = resolve; });
    const late = await write(client, endpoint, body);
    await started;
    await write(client, `/api/workbench/jobs/${late.json.id}/cancel`, {});
    releaseLate();
    const stopped = await waitJob(client, late.json.id);
    assert.equal(stopped.state, 'cancelled');
    assert.equal(stopped.outputFileIds.length, 1, 'late raw output is retained without reopening the job');
    const evidence = JSON.parse(world.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(late.json.id).value).lateResult;
    assert.equal(evidence.assetFileIds.length, 1);
    assert.equal((await client.request('GET', `${base}/${evidence.rawFileId}/content`)).status, 200);
    assert.equal((await client.request('GET', `${base}/${evidence.assetFileIds[0]}/content`)).status, 200);
    assert.equal((await client.request('GET', `${endpoint}/pages/1${query}`)).json.state, 'interrupted');

    mode = 'cleanup-failure';
    started = new Promise(resolve => { entered = resolve; });
    const cleanup = await write(client, endpoint, body);
    await started;
    await write(client, `/api/workbench/jobs/${cleanup.json.id}/cancel`, {});
    const unresolved = await waitJob(client, cleanup.json.id);
    assert.equal(unresolved.state, 'failed', 'unconfirmed cleanup never claims cancellation completed');
    assert.match(unresolved.issues[0].detail, /尚未确认识别进程停止/);
    assert.equal((await client.request('GET', `${endpoint}/pages/1${query}`)).json.issues[0].code, 'recognition-cleanup');

    mode = 'wait';
    started = new Promise(resolve => { entered = resolve; });
    const interrupted = await write(client, endpoint, body);
    await started;
    const jar = client.jar;
    await world.close();
    world = null;
    // Reconnect with the same authenticated cookie on a fresh TCP connection.
    // A new ephemeral port avoids reusing a socket closed by the old server.
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    client = world.client();
    client.jar = jar;
    assert.equal((await client.request("GET", `/api/workbench/jobs/${interrupted.json.id}`)).json.state, "interrupted");
    assert.equal((await client.request("GET", `${endpoint}/pages/1${query}`)).json.state, "interrupted");
    assert.equal(calls, 5);
    mode = "success";
    const resumed = await write(client, `/api/workbench/jobs/${interrupted.json.id}/retry`, { unitIds: [] });
    assert.equal(resumed.status, 202, resumed.text);
    assert.equal((await waitJob(client, resumed.json.id)).state, "succeeded");
    assert.equal(calls, 6);
    assert.equal((await client.request("GET", `${endpoint}/pages/1${query}`)).json.state, "ready");
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('retrying a partial job after an engine revision change preserves the original successful page', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'materials-recognition-revision-'));
  let calls = 0, passed = false, world;
  const recognizer = { revision: 'revision-1', async run() {
    if (++calls === 2) throw new Error('Second page failed');
    return machinePage();
  } };
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    let { client } = await registerMath(world, 'recognition-revision@example.test');
    const pdf = fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/P.pdf', import.meta.url));
    const file = await upload(client, 'two-pages.pdf', pdf), source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`, query = `?renditionFileId=${source.renditionFileId}`;
    const accepted = await write(client, endpoint, { renditionFileId: source.renditionFileId, pages: [1, 2] });
    assert.equal((await waitJob(client, accepted.json.id)).state, 'partial');
    const original = (await client.request('GET', `${endpoint}/pages/1${query}`)).json;
    assert.equal(original.state, 'ready');
    const jar = client.jar;
    await world.close();
    world = null;
    recognizer.revision = 'revision-2';
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    client = world.client();
    client.jar = jar;
    const retry = await write(client, `/api/workbench/jobs/${accepted.json.id}/retry`, { unitIds: [] });
    assert.equal(retry.status, 409, retry.text);
    assert.equal(retry.json.type, '/problems/materials/job-not-retryable');
    assert.equal(calls, 2, 'an old request cannot silently rerun its successful pages on a new engine');
    const stored = JSON.parse(world.workbench.db.prepare('SELECT value FROM materials_recognition_results WHERE id=?').get(original.resultId).value);
    assert.deepEqual(stored.document, original.document);
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('fixed rendition HTTP reads preserve source ownership, local page availability and first errors', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rendition-boundary-'));
  const world = await createIntegration({ directory });
  let passed = false;
  try {
    const { client } = await registerMath(world, 'rendition-a@example.test');
    const { client: other } = await registerMath(world, 'rendition-b@example.test');
    const first = await upload(client), old = await preview(client, first);
    const sharp = (await import('sharp')).default;
    const second = await upload(client, 'other.png', await sharp(image).resize(120, 80).png().toBuffer()), next = await preview(client, second);
    const foreign = await upload(other), foreignPreview = await preview(other, foreign);
    const untouched = await upload(client, 'unconverted.png');
    const page = (fileId, renditionId, number = 1) => client.request('GET', `${base}/${fileId}/recognition/pages/${number}?renditionFileId=${renditionId}`);
    const location = { kind: 'page', fileId: first.id, renditionFileId: old.renditionFileId, page: 1, box: { x: 0, y: 0, width: 0.5, height: 0.5 } };
    const crop = (patch = {}, key) => write(client, `${base}/crops`, { location: { ...location, ...patch } }, key);
    function invalid(response, field, status = 422) {
      assert.equal(response.status, status, response.text);
      if (status === 422) {
        assert.equal(response.json.type, '/problems/workbench/invalid-input');
        assert.equal(response.json.reason, 'out-of-range');
        assert.equal(response.json.field, field);
      }
    }
    for (const [fileId, renditionFileId, status] of [
      [first.id, next.renditionFileId, 422],
      [first.id, foreignPreview.renditionFileId, 404],
      [foreign.id, old.renditionFileId, 404],
      [untouched.id, untouched.id, 422],
    ]) {
      invalid(await page(fileId, renditionFileId), '/renditionFileId', status);
      invalid(await crop({ fileId, renditionFileId }), '/location', status);
    }
    const noPreview = await client.request('GET', `${base}/${untouched.id}/recognition`);
    assert.equal(noPreview.status, 409);
    assert.equal(noPreview.json.type, '/problems/materials/preview-required');
    invalid(await page(first.id, old.renditionFileId, 2), '/page');
    invalid(await page(foreign.id, old.renditionFileId, 0), '/page');
    invalid(await crop({ page: 2 }), '/location/page');
    invalid(await crop({ page: 2, box: null }), '/location');
    invalid(await crop({ page: 2, box: { x: 0.9, y: 0, width: 0.5, height: 0.5 } }), '/location');
    // Persist a second valid fixed mapping and change only the current preview.
    // This fixture checks fixed mapping consumption, not the converter itself.
    const db = world.workbench.db;
    const account = db.prepare('SELECT accountKey FROM materials_files WHERE id=?').get(first.id).accountKey;
    const current = { ...next, fileId: first.id };
    db.prepare('INSERT INTO materials_renditions VALUES (?,?,?,?)').run(first.id, next.renditionFileId, account, JSON.stringify(current));
    db.prepare('UPDATE materials_previews SET value=? WHERE fileId=?').run(JSON.stringify(current), first.id);
    const limited = { ...old, state: 'limited', pageCount: 2, issues: ['legacy-object-loss'], pages: [...old.pages, { ...old.pages[0], page: 2, imageFileId: randomUUID() }] };
    db.prepare('UPDATE materials_renditions SET value=? WHERE fileId=? AND renditionId=?').run(JSON.stringify(limited), first.id, old.renditionFileId);
    const fixed = await page(first.id, old.renditionFileId);
    assert.equal(fixed.status, 200, fixed.text);
    assert.equal(fixed.json.imageFileId, old.pages[0].imageFileId);
    assert.deepEqual(fixed.json.location, { ...location, box: null });
    const key = randomUUID(), saved = await crop({}, key);
    assert.equal(saved.status, 201, saved.text);
    const cropRow = db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(saved.json.id);
    const size = await sharp(fs.readFileSync(path.join(directory, 'files/blobs', cropRow.blobName))).metadata();
    assert.equal(size.width, Math.round(old.pages[0].width / 2));
    assert.equal(size.height, Math.round(old.pages[0].height / 2));
    assert.equal((await client.request('GET', `${base}/${first.id}/preview`)).json.renditionFileId, next.renditionFileId);
    const renditionRow = db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(next.renditionFileId);
    const renditionDisk = path.join(directory, 'files/blobs', renditionRow.blobName), renditionBytes = fs.readFileSync(renditionDisk);
    fs.appendFileSync(renditionDisk, 'corrupt digest');
    try {
      assert.equal((await page(first.id, next.renditionFileId)).status, 503);
      assert.equal((await crop({ renditionFileId: next.renditionFileId, box: null })).status, 503);
    } finally { fs.writeFileSync(renditionDisk, renditionBytes); }
    const original = db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(first.id);
    const disk = path.join(directory, 'files/blobs', original.blobName), bytes = fs.readFileSync(disk);
    fs.unlinkSync(disk);
    try {
      assert.equal((await page(first.id, old.renditionFileId)).status, 503);
      assert.equal((await crop({ page: 2, box: null })).status, 503);
      const replayed = await crop({}, key);
      assert.equal(replayed.status, 201, replayed.text);
      assert.equal(replayed.json.id, saved.json.id);
    } finally { fs.writeFileSync(disk, bytes); }
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('localized content issues survive HTTP save and restart without blocking another question in the same OCR block', async () => {
  const content = '1. 已知函数 y=7x，求当 x=2 时的值。\n\n2. 计算 8+6 的值。';
  const raw = { width: 240, height: 160, parsing_res_list: [
    {block_id: 0, block_label: 'text', block_content: content, block_bbox: [5,5,235,150]},
  ], content_check: {revision:'pp-ocrv5-mobile/content-check-2', raw:{rec_texts:['求当 x= 时的值']}, issues:[
    {code:'ocr-text-conflict', blockId:0, bbox:[90,20,170,40], sourceStart:content.indexOf('当'), sourceEnd:content.indexOf('时')+1},
  ]}};
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'recognition-content-'));
  let world,passed=false;
  try {
    world=await createIntegration({directory,workbench:{recognition:{recognizer:{revision:'content-http',async run(){return {raw,width:240,height:160,assets:[]}}}}}});
    let {client}=await registerMath(world,'content-http@example.test');
    const file=await upload(client);
    const baseImport='/api/modules/questions/v2/imports';
    const accepted=await write(client,baseImport,{title:'局部疑点',origin:'固定原件',input:{kind:'files',fileIds:[file.id],pages:[]}});
    assert.equal(accepted.status,201,accepted.text);
    assert.equal((await waitJob(client,accepted.json.jobId)).state,'succeeded');
    const url=`${baseImport}/${accepted.json.id}`;
    let material=(await client.request('GET',url)).json;
    assert.equal(material.drafts.length,2);
    const issues=material.drafts.map(d=>d.issues.filter(i=>i.code==='uncertain-text'));
    assert.equal(issues[0].length,1);assert.equal(issues[1].length,0);
    assert.equal(issues[0][0].detail,'这行有不一致的识别结果，请对照原稿核对。');
    assert.deepEqual(issues[0][0].locations[0].box,{x:90/240,y:20/160,width:80/240,height:20/160});
    const source=await preview(client,file);
    const pageUrl=`${base}/${file.id}/recognition/pages/1?renditionFileId=${source.renditionFileId}`;
    const page=(await client.request('GET',pageUrl)).json;
    assert.deepEqual(JSON.parse((await client.request('GET',`${base}/${page.rawFileId}/content`)).text),raw);
    const drafts=structuredClone(material.drafts);
    drafts[1].issues=drafts[1].issues.map(issue=>({...issue,resolution:'corrected'}));
    let saved=await client.request('PUT',url,{body:{baseVersion:material.version,drafts,fragments:material.fragments},headers:{'Idempotency-Key':randomUUID()}});
    assert.equal(saved.status,200,saved.text);
    const committed=await write(client,url+'/commit',{baseVersion:saved.json.version,draftIds:[drafts[1].id]});
    assert.equal(committed.status,200,committed.text);
    assert.equal(committed.json.questions.length,1);
    material=committed.json.import;
    const corrected=structuredClone(material.drafts);
    corrected[0].body={version:2,blocks:[{type:'paragraph',runs:[{type:'text',text:'已知函数 y=7x，x 的值在原稿中缺失，待补充。'}]}]};
    corrected[0].issues=corrected[0].issues.map(issue=>({...issue,resolution:'corrected'}));
    saved=await client.request('PUT',url,{body:{baseVersion:material.version,drafts:corrected,fragments:material.fragments},headers:{'Idempotency-Key':randomUUID()}});
    assert.equal(saved.status,200,saved.text);
    const jar=client.jar;await world.close();world=null;
    world=await createIntegration({directory});client=world.client();client.jar=jar;
    const reopened=(await client.request('GET',url)).json;
    assert.deepEqual(reopened.drafts[0].body,corrected[0].body);
    assert.deepEqual(reopened.drafts[0].issues,corrected[0].issues);
    assert.equal(reopened.drafts[1].disposition,'confirmed');
    assert.deepEqual((await client.request('GET',pageUrl)).json,page);
    passed=true;
  }finally{
    await world?.close();
    if(passed)fs.rmSync(directory,{recursive:true,force:true});
    else console.error(`Retained content issue integration: ${directory}`);
  }
});

// This exercises the real HTTP/SQLite/file shutdown boundary. The provider
// output is injected here; real MinerU process teardown is checked separately.
test('complete timed-out output stays failed, binds task evidence, and survives a successful retry', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-timeout-evidence-'));
  let timedOut = true, calls = 0, world, passed = false;
  const recognizer = { revision: 'timeout-evidence', async run() {
    calls++;
    return { ...machinePage(), assets: [{ name: 'late.png', bytes: image }], originalAssets: [],
      ...(timedOut ? { termination: { code: 'recognition-timeout' } } : {}) };
  } };
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    const { client } = await registerMath(world, 'timeout-evidence@example.test');
    const pdf = fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/P.pdf', import.meta.url));
    const file = await upload(client, 'timeout-pages.pdf', pdf), source = await preview(client, file);
    const endpoint = `${base}/${file.id}/recognition`;
    const pageUrl = `${endpoint}/pages/1?renditionFileId=${source.renditionFileId}`;
    const accepted = await write(client, endpoint, { renditionFileId: source.renditionFileId, pages: [1, 2] });
    const job = await waitJob(client, accepted.json.id);
    assert.equal(job.state, 'failed', 'complete raw evidence does not count as a successful page');
    assert.equal(calls, 1, 'timeout stops subsequent pages of the same request');
    assert.equal((await client.request('GET', `${endpoint}/pages/2?renditionFileId=${source.renditionFileId}`)).json.state, 'unprocessed');
    const page = (await client.request('GET', pageUrl)).json;
    assert.equal(page.state, 'failed');
    assert.equal(page.issues[0].code, 'recognition-timeout');
    const requestValue = () => JSON.parse(world.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(job.id).value);
    const evidence = requestValue().lateResult;
    assert.equal(evidence.rawFileId, page.rawFileId);
    assert.equal(evidence.assetFileIds.length, 1);
    assert.deepEqual(job.outputFileIds, [evidence.rawFileId]);
    assert.equal((await client.request('GET', `${base}/${evidence.assetFileIds[0]}/content`)).status, 200);
    timedOut = false;
    const retry = await write(client, `/api/workbench/jobs/${job.id}/retry`, { unitIds: ['page:1'] });
    assert.equal((await waitJob(client, retry.json.id)).state, 'succeeded');
    assert.equal((await client.request('GET', pageUrl)).json.state, 'ready');
    assert.deepEqual(requestValue().lateResult, evidence, 'retry keeps the original timeout evidence binding');
    assert.equal((await client.request('GET', `${base}/${evidence.rawFileId}/content`)).status, 200);
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error(`Retained timeout evidence integration: ${directory}`);
  }
});

test('normal API close waits for late evidence and handler persistence before closing SQLite', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'recognition-close-evidence-'));
  let enter, world, passed = false;
  const entered = new Promise(resolve => { enter = resolve; });
  const recognizer = { revision: 'close-evidence', async run({ signal }) {
    enter();
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    // Real files.store persistence below must run while SQLite is still open.
    return { ...machinePage(), assets: [{ name: 'late-close.png', bytes: image }], originalAssets: [] };
  } };
  try {
    world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
    const { client } = await registerMath(world, 'close-evidence@example.test');
    const file = await upload(client), source = await preview(client, file);
    const accepted = await write(client, `${base}/${file.id}/recognition`, { renditionFileId: source.renditionFileId, pages: [1] });
    await entered;
    const jar = client.jar;
    await world.close(); world = null;
    world = await createIntegration({ directory });
    const reopened = world.client(); reopened.jar = jar;
    const job = (await reopened.request('GET', `/api/workbench/jobs/${accepted.json.id}`)).json;
    assert.equal(job.state, 'interrupted');
    const evidence = JSON.parse(world.workbench.db.prepare('SELECT value FROM materials_recognition_requests WHERE jobId=?').get(job.id).value).lateResult;
    assert.deepEqual(job.outputFileIds, [evidence.rawFileId]);
    for (const id of [evidence.rawFileId, ...evidence.assetFileIds])
      assert.equal((await reopened.request('GET', `${base}/${id}/content`)).status, 200);
    assert.equal((await reopened.request('GET', `${base}/${file.id}/recognition/pages/1?renditionFileId=${source.renditionFileId}`)).json.state, 'interrupted');
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error(`Retained close evidence integration: ${directory}`);
  }
});
