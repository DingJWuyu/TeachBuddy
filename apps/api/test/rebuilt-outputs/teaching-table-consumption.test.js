import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { createIntegration } from '../support/application.js';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { application, upload, download, preview, json, finished, importFiles, importsPath, filesPath, readFixture, textOf, paragraph } from './helpers.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const header = '<tr><th>教学内容</th><th>师生活动</th><th>设计点评</th></tr>';
const row = (content, activity, note) => `<tr><td>${content}</td><td>${activity}</td><td>${note}</td></tr>`;
const tables = [
  [`<table>${header}${row('【例1】判断下列函数的奇偶性。', '教师：组织学生讨论。', '教师摘录：观察图形。<br/>$m=2$<img src="imgs/note.png"/>')}</table>`],
  [`<table>${row('(1) $f(x)=x^2$<br/>(2) $g(x)=x^3$', '学生：独立判断。', '跨页的教学点评。')}${row('【练习】已知 $f(x)=x^2$，求 $f(2)$。', '教师：巡视。', '巩固概念。')}</table>`],
  [`<table>${row('【例777】已知 $h(x)=2x$，求 $h(1)$。', '缺少可确定的表头。', '位置已改变。')}</table>`, `<table>${header}<tr><td colspan="2">【例888】已知 $k(x)=3x$，求 $k(1)$。</td><td>合并列归属不明。</td></tr></table>`],
];

// Self-authored visible teaching pages and their controlled OCR output share
// the same content. Raster pages are real nonblank inputs, never stand-in E pages.
async function rasterTeachingPdf(directory) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 1000 }, deviceScaleFactor: 1 });
    const image = `data:image/png;base64,${readFixture('questions/figure.png').toString('base64')}`;
    const images = [];
    for (const [index, pageTables] of tables.entries()) {
      const html = `<meta charset="utf-8"><style>body{margin:40px;font:22px sans-serif}table{width:100%;border-collapse:collapse;margin:30px 0}td,th{width:33%;border:2px solid #222;padding:12px;vertical-align:top}img{width:130px}h1{font-size:28px}</style><h1>自编教学表格，第 ${index + 1} 页</h1>${pageTables.join('').replaceAll('imgs/note.png', image)}`;
      fs.writeFileSync(path.join(directory, `table-page-${index + 1}.html`), html);
      await page.setContent(html);
      await page.locator('body').screenshot({ path: path.join(directory, `table-page-${index + 1}.png`) });
      images.push(await page.screenshot());
    }
    await page.setContent(`<style>@page{size:800px 1000px;margin:0}body{margin:0}img{display:block;width:800px;height:1000px;break-after:page}img:last-child{break-after:auto}</style>${images.map(bytes => `<img src="data:image/png;base64,${bytes.toString('base64')}"/>`).join('')}`);
    return await page.pdf({ width: '800px', height: '1000px', printBackground: true });
  } finally { await browser.close(); }
}

test('C-R3 教学表续题与歧义保留，删源后的带图摘录可导出并经停服恢复读回', { timeout: 180000 }, async t => {
  const inputPages = new Map();
  const calls = [];
  const recognizer = { revision: 'authored-teaching-table-1', available: true, async run({ bytes, width, height }) {
    const index = inputPages.get(sha(bytes));
    assert.notEqual(index, undefined, '回放必须绑定本次真实原页像素');
    calls.push(index);
    return {
      width, height,
      raw: { width, height, parsing_res_list: tables[index].map((html, block) => ({ block_label: 'table', block_content: html, block_id: block,
        block_order: block, block_bbox: [(index === 2 ? .2 : .05) * width, (.1 + block * .4) * height, .95 * width, (.45 + block * .4) * height] })) },
      assets: index === 0 ? [{ name: 'imgs/note.png', bytes: readFixture('questions/figure.png') }] : [], originalAssets: [], derivations: [],
    };
  } };
  const world = await application(t, { workbench: { recognition: { recognizer } } });
  const pdf = await rasterTeachingPdf(world.directory);
  fs.writeFileSync(path.join(world.directory, 'teaching-table.pdf'), pdf);
  const file = await upload(world.client, '自编三页教学表.pdf', pdf);
  const view = await preview(world.client, file.id);
  assert.equal(view.pages.length, 3);
  for (const [index, page] of view.pages.entries()) inputPages.set(sha(await download(world.client, page.imageFileId)), index);
  const job = await json(world.client, 'POST', `${filesPath}/${file.id}/recognition`, { renditionFileId: view.renditionFileId, pages: [1, 2, 3] }, 202);
  assert.equal((await finished(world.client, job.id)).state, 'succeeded');
  let material = await importFiles(world.client, [file.id], '自编跨页教学表');
  assert.equal(material.drafts.length, 2, '唯一续题与练习各成一题，歧义和教师列不能造题');
  const example = material.drafts.find(draft => /g\(x\)/.test(textOf(draft.body)));
  assert.ok(example, '跨页小问须并回唯一例题');
  assert.match(textOf(example.body), /f\(x\).*x\^2/);
  assert.match(textOf(example.body), /g\(x\).*x\^3/);
  const pages = example.parts.flatMap(part => part.locations).map(location => location.page);
  assert.ok(pages.includes(1) && pages.includes(2), '续题须保留两页原稿位置');
  assert.ok(material.drafts.every(draft => draft.answerStatus !== 'present' && draft.solution.blocks.length === 0), '教师活动与点评不能冒充答案');
  assert.doesNotMatch(textOf(material.drafts.map(draft => draft.body)), /教师：|教学点评|例777|例888/, '教师列、换位和合并歧义均不得混入题干');
  for (const marker of ['例777', '例888']) assert.ok(material.fragments.some(fragment => fragment.text.includes(marker)), `${marker} 仍须保留供人工判断`);
  const note = material.fragments.find(fragment => textOf(fragment.document).includes('"type":"image"'));
  assert.ok(note?.document, '点评中的真实图片应保留为未分配文稿');
  const imageId = note.document.blocks.find(block => block.type === 'image').fileId;
  const imageBytes = await download(world.client, imageId);
  example.noteFragments = [{ id: note.id, importId: material.id, document: { ...note.document, blocks: [...note.document.blocks, paragraph('教师已核对并采用。')] }, locations: note.locations }];
  note.disposition = 'assigned';
  material = await json(world.client, 'PUT', `${importsPath}/${material.id}`, {
    baseVersion: material.version,
    drafts: material.drafts.map(draft => ({ ...draft, answerStatus: 'absent', issues: draft.issues.map(issue => ({ ...issue, resolution: 'corrected' })) })), fragments: material.fragments,
  });
  const committed = await json(world.client, 'POST', `${importsPath}/${material.id}/commit`, { baseVersion: material.version, draftIds: [example.id] });
  const expected = committed.questions[0].noteFragments;
  const archived = await json(world.client, 'POST', `${importsPath}/${material.id}/deletion`, { baseVersion: committed.import.version, deleted: true });
  await json(world.client, 'POST', `${importsPath}/${material.id}/purge`, { baseVersion: archived.version });
  const question = await json(world.client, 'GET', `/api/modules/questions/v2/items/${committed.questions[0].id}`);
  assert.deepEqual(question.noteFragments, expected, '材料彻底删除后题目的采用稿及固定来源仍可读');
  assert.deepEqual(await download(world.client, imageId), imageBytes, '采用稿引用的真实附件不能随材料删除');
  assert.deepEqual(calls, [0, 1, 2], '导入须消费已保存页结果，不额外运行识别');
  // D05 personal ZIP is content takeout. Original IDs and relationships are
  // recovered only through the stopped deployment backup/restore/activate path.
  const exported = await json(world.client, 'POST', '/api/reliability/v1/exports', {}, 202);
  const exportUrl = `/api/reliability/v1/exports/${exported.id}`;
  let archive;
  const deadline = Date.now() + 150000;
  do {
    archive = await json(world.client, 'GET', exportUrl);
    if (!['queued', 'running'].includes(archive.state)) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  assert.equal(archive.state, 'ready', `删源后的独立摘录必须可导出：${JSON.stringify(archive.problem)}`);
  const response = await world.client.request('GET', `${exportUrl}/content`);
  assert.equal(response.status, 200);
  const zip = await JSZip.loadAsync(response.bytes);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const entry = manifest.objects.find(object => object.key.kind === 'question' && object.key.id === question.id);
  assert.ok(entry, '个人包须含删源后仍独立保存的题目');
  const packedQuestion = JSON.parse(await zip.file(entry.dataPath).async('string')).value;
  assert.deepEqual(packedQuestion.noteFragments, expected, '个人包必须保留独立摘录的实际文稿和固定来源');
  assert.ok(!manifest.objects.some(object => object.key.kind === 'import' && object.key.id === material.id), '个人包不应复活已彻底删除的材料');
  const attachment = manifest.files.find(file => file.path.startsWith(`files/${imageId}/`));
  assert.ok(attachment, '独立摘录引用的图片必须实际进入资料包');
  assert.ok(manifest.relations.some(relation => relation.from.kind === 'question' && relation.from.id === question.id && relation.to.kind === 'file' && relation.to.id === imageId && relation.location.includes('noteFragments')), '资料包须保留摘录文稿到实际图片的关系');
  const packedImage = await zip.file(attachment.path).async('nodebuffer');
  assert.equal(attachment.bytes, imageBytes.length);
  assert.equal(attachment.sha256, sha(imageBytes));
  assert.equal(sha(packedImage), sha(imageBytes), '带走的图片字节必须与教师采用稿原图一致');
  const readable = await zip.file(entry.readablePath).async('string');
  assert.ok(readable.includes('教师已核对并采用。'), '可读层应呈现教师采用稿');
  assert.ok(readable.includes('m=2'), '可读层应保留摘录中的公式源');

  const maintenance = fs.mkdtempSync(path.join(os.tmpdir(), 'teachbuddy-notes-recovery-'));
  let restored, complete = false;
  t.after(async () => {
    await restored?.close();
    if (complete) fs.rmSync(maintenance, { recursive: true, force: true });
    else t.diagnostic(`保留摘录恢复现场 ${maintenance}`);
  });
  const cli = (...args) => JSON.parse(execFileSync(process.execPath, ['apps/api/src/scripts/reliability.js', ...args, '--stopped'], { encoding: 'utf8' }));
  await world.close();
  const backupDirectory = path.join(maintenance, 'backup');
  assert.equal(cli('backup', '--database', path.join(world.directory, 'workspace.sqlite'), '--files', path.join(world.directory, 'files'), '--target', backupDirectory).state, 'backed-up');
  const target = path.join(maintenance, 'restored');
  assert.equal(cli('restore', '--source', backupDirectory, '--target', target).state, 'prepared');
  assert.equal(cli('activate', '--target', target).state, 'activated');
  restored = await createIntegration({ directory: target, clock: world.clock });
  const client = restored.client();
  await json(client, 'POST', '/api/auth/session', { action: 'bootstrap' });
  const session = await json(client, 'POST', '/api/auth/login', { email: world.session.account.email, password: 'outputs-password', rememberMe: true });
  await json(client, 'POST', '/api/auth/session', { action: 'activate', sessionId: session.id, rememberMe: true });
  const recovered = await json(client, 'GET', `/api/modules/questions/v2/items/${question.id}`);
  assert.equal(recovered.id, question.id, '部署恢复须保留题目原 ID');
  assert.deepEqual(recovered.noteFragments, expected, '部署恢复须保留已删来源的独立摘录与真实文稿');
  assert.equal(sha(await download(client, imageId)), sha(imageBytes), '恢复后的采用稿附件须保留原字节并可经身份读取');
  assert.equal((await client.request('GET', `${importsPath}/${material.id}`)).status, 404, '部署恢复不能复活备份时已经删除的源材料');
  world.complete();
  complete = true;
});
