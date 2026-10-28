import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import sharp from 'sharp';
import { generateDocx } from '../../src/workbench/files/pandoc.js';
import { application, upload, download, preview, json, finished, paragraph, document, readFixture } from './helpers.js';

const officeMath = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

test('C3 公共文稿输出为真实可编辑 OMML、表格和配图，PDF 可读', { timeout: 180000 }, async t => {
  const world = await application(t);
  const { client } = world;
  const image = await upload(client, '三角形.png', readFixture('questions/figure.png'));
  const principal = await world.workbench.identity.resolvePrincipal({ headers: { cookie: client.jar.header(), 'x-teachbuddy-page': client.pageId } });
  assert.ok(principal?.accountKey, '共享文稿转换使用真实验证后的 principal');
  const blocks = [
    { type: 'heading', level: 1, runs: [{ type: 'text', text: '分式与分段函数的课堂讲义' }] },
    { type: 'paragraph', runs: [{ type: 'text', text: '例题定义域：' }, { type: 'math', latex: '\\frac{\\sqrt{2x-1}}{x-2}' }] },
    { type: 'math', latex: 'f(x)=\\begin{cases}ax+1&x<0\\\\x^2-1&x\\ge 0\\end{cases}' },
    { type: 'table', rows: [
      [{ blocks: [paragraph('参数')] }, { blocks: [paragraph('取值与结论')] }],
      [{ blocks: [paragraph('a=-1')] }, { blocks: [paragraph('f(1)=0')] }],
    ] },
    { type: 'image', fileId: image.id, alt: 'AB=4，AC=3 的直角三角形', widthMm: 60 },
    paragraph('请修改分母、根式指数和中文说明，再继续编辑。'),
  ];
  const bytes = await generateDocx(blocks, { files: world.workbench.files, principal, signal: new AbortController().signal });
  const stored = await world.workbench.files.store(principal, { name: '真实讲义.docx', bytes }, { key: randomUUID(), method: 'POST', path: '/internal/rebuilt-document' });
  const downloaded = await download(client, stored.id);
  const zip = await JSZip.loadAsync(downloaded);
  const xml = await zip.file('word/document.xml').async('string');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const nodes = name => [...parsed.getElementsByTagNameNS(officeMath, name)];
  assert.ok(nodes('f').length >= 1, '分式必须具有可编辑的分子分母结构');
  assert.ok(nodes('rad').length >= 1, '根式必须具有可编辑的根号结构');
  assert.ok(nodes('sSup').length >= 1, '指数必须保留为可编辑上标');
  const matrix = nodes('m')[0];
  assert.ok(matrix, '分段函数必须具有真实数学矩阵');
  const rows = [...matrix.getElementsByTagNameNS(officeMath, 'mr')];
  assert.equal(rows.length, 2, '分段条件应保持两行对应');
  assert.match(rows[0].textContent, /ax\+1.*x<0/);
  assert.match(rows[1].textContent, /x2.*1.*x≥0/);
  assert.match(xml, /分式与分段函数/);
  assert.match(xml, /<w:tbl[ >]/, '活动表格须保留结构');
  assert.match(xml, /<w:drawing[ >]/, '配图须使用实际图片关系');
  const rels = await zip.file('word/_rels/document.xml.rels').async('string');
  assert.match(rels, /relationships\/image/);
  const media = Object.values(zip.files).filter(file => file.name.startsWith('word/media/') && !file.dir);
  assert.equal(media.length, 1);
  const metadata = await sharp(await media[0].async('nodebuffer')).metadata();
  assert.ok(metadata.width > 20 && metadata.height > 20);
  const view = await preview(client, stored.id);
  const pdf = await download(client, view.renditionFileId);
  const output = path.join(world.directory, '讲义.pdf');
  fs.writeFileSync(output, pdf);
  const text = execFileSync('pdftotext', [output, '-'], { encoding: 'utf8' });
  assert.match(text, /分式与分段函数/, 'PDF 须保留可读中文正文');
  assert.match(text, /请修改分母/, 'PDF 不能在公式或表格后截断正文');
  assert.ok(view.pages.length >= 1);
  world.complete();
});

test('C3 题面 PNG 为真实透明分片，长期笔记修改不进入输出', { timeout: 180000 }, async t => {
  const world = await application(t);
  const { client } = world;
  const image = await upload(client, '直角三角形.png', readFixture('questions/figure.png'));
  const body = document('直角三角形 ABC，AB=4，AC=3，求 BC。');
  body.blocks.push({ type: 'math', latex: 'BC=\\sqrt{4^2+3^2}' }, { type: 'image', fileId: image.id, alt: '三角形', widthMm: 60 });
  const question = await json(client, 'POST', '/api/modules/questions/v2/items', {
    title: '题面输出', body, solution: document('BC=5'), answerStatus: 'present', note: '不得输出的长期笔记', starred: false,
    typeId: null, tagIds: [], source: { kind: 'manual' },
  }, 201);
  const job = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: question.version, mode: 'question-png', includeAnswers: true, figureFileId: null,
  }, 202);
  const done = await finished(client, job.id);
  assert.equal(done.state, 'succeeded', JSON.stringify(done));
  assert.ok(done.outputFileIds.length >= 2, '题面和答案必须分别输出');
  for (const id of done.outputFileIds) {
    const bytes = await download(client, id);
    const metadata = await sharp(bytes).metadata();
    const stats = await sharp(bytes).stats();
    assert.equal(metadata.width, 1600);
    assert.ok(metadata.height <= 2400 && metadata.height > 20);
    assert.equal(metadata.hasAlpha, true, '题面图片须保留透明背景');
    assert.ok(stats.channels[3].min === 0 && stats.channels[3].max === 255, '输出应同时包含透明留白与真实可见像素');
  }
  await json(client, 'PUT', `/api/modules/questions/v2/items/${question.id}`, {
    baseVersion: question.version, title: question.title, body: question.body, solution: question.solution,
    answerStatus: question.answerStatus, note: '另一条绝不能进入输出的私密笔记', starred: false, typeId: null, tagIds: [],
  });
  const again = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: question.version + 1, mode: 'question-png', includeAnswers: true, figureFileId: null,
  }, 202);
  const againDone = await finished(client, again.id);
  assert.equal(againDone.state, 'succeeded');
  assert.equal(againDone.outputFileIds.length, done.outputFileIds.length);
  for (const [index, id] of done.outputFileIds.entries())
    assert.deepEqual(await download(client, againDone.outputFileIds[index]), await download(client, id), '长期笔记不能影响公开题面与答案图片');
  const figureJob = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: question.version + 1, mode: 'figure-png', includeAnswers: false, figureFileId: image.id,
  }, 202);
  const figureDone = await finished(client, figureJob.id);
  assert.equal(figureDone.state, 'succeeded');
  assert.equal(figureDone.outputFileIds.length, 1, '配图模式应只生成选定配图');
  world.complete();
});
