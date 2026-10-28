import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { replayRecognizer, sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';
import { application, upload, download, json, importFiles, importsPath, textOf, paragraph } from './helpers.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('C2 固定 OCR 的公式、配图、原始证据与人工校对分别保存，资源复用同页结果', { timeout: 180000 }, async t => {
  const recognizer = await replayRecognizer();
  const world = await application(t, { workbench: { recognition: { recognizer } } });
  const { client } = world;
  const image = await upload(client, '固定识别第1页.png', sourceImage('I-1'));
  let material = await importFiles(client, [image.id], '公式与函数图固定回放');
  assert.equal(material.drafts.length, 2, '第1页应形成定义域和抛物线两道题');
  assert.match(textOf(material.drafts), /sqrt|\\\\sqrt/, '机器根式必须进入草稿可编辑数学源');
  const diagram = material.drafts.find(draft => /零点|抛物线/.test(textOf(draft.body)));
  assert.ok(diagram, '函数题必须成为独立草稿');
  const figures = diagram.body.blocks.filter(block => block.type === 'image');
  assert.equal(figures.length, 1, '函数题必须关联本页实际配图');
  const png = await download(client, figures[0].fileId);
  assert.equal((await sharp(png).metadata()).format, 'png');
  const source = diagram.parts.flatMap(part => part.locations).find(location => location.kind === 'page');
  assert.ok(source, '识别题须保留固定原页定位');
  assert.equal(source.fileId, image.id);
  const recognitionUrl = `/api/workbench/files/${image.id}/recognition/pages/1?renditionFileId=${source.renditionFileId}`;
  const page = await json(client, 'GET', recognitionUrl);
  assert.equal(page.state, 'ready');
  const raw = await download(client, page.rawFileId);
  const rawHash = hash(raw);
  assert.ok(page.blocks.length > 0 && page.document.blocks.length > 0, '机器文稿与版面块不能被消费过程丢弃');
  assert.ok(diagram.issues.length > 0, '固定回放的定位疑点须显式呈现');
  diagram.body.blocks.unshift(paragraph('教师校对：抛物线顶点为 (1,-4)，保留原图。'));
  material = await json(client, 'PUT', `${importsPath}/${material.id}`, {
    baseVersion: material.version,
    drafts: material.drafts.map(draft => ({ ...draft, issues: draft.issues.map(issue => ({ ...issue, resolution: 'corrected' })) })),
    fragments: material.fragments,
  });
  const reopened = await json(client, 'GET', `${importsPath}/${material.id}`);
  const corrected = reopened.drafts.find(draft => draft.id === diagram.id);
  assert.deepEqual(corrected.body, diagram.body, '重新读取应得到教师校对后的文稿与图');
  assert.ok(corrected.issues.every(issue => issue.resolution === 'corrected'), '具体疑点处置必须保存');
  const committed = await json(client, 'POST', `${importsPath}/${material.id}/commit`, { baseVersion: reopened.version, draftIds: [diagram.id] });
  const saved = await json(client, 'GET', `/api/modules/questions/v2/items/${committed.questions[0].id}`);
  assert.deepEqual(saved.body, corrected.body, '题库采用稿不能退回机器原稿');
  const machineAfter = await json(client, 'GET', recognitionUrl);
  assert.deepEqual(machineAfter.document, page.document, '教师采用稿不得覆盖机器文稿');
  assert.equal(hash(await download(client, machineAfter.rawFileId)), rawHash, '原始机器证据须保持不可变');
  const resource = await json(client, 'POST', '/api/modules/resources/items', {
    title: '已识别的教学原页', fileId: image.id, folderId: null, tagIds: [], note: '',
  }, 201);
  const results = await json(client, 'GET', '/api/modules/resources/items?q=%E5%87%BD%E6%95%B0');
  assert.ok(results.items.some(item => item.id === resource.id), '资源正文检索必须消费公共已识别正文');
  assert.deepEqual(recognizer.calls, ['I-1'], '两个消费者应复用同页识别，不重新调用模型');
  world.complete();
});

test('C2 固定分段公式与答案页按题号关联，未匹配答案保留为片段', { timeout: 180000 }, async t => {
  const recognizer = await replayRecognizer();
  const world = await application(t, { workbench: { recognition: { recognizer } } });
  const files = [];
  for (const name of ['I-2', 'PS-4']) files.push(await upload(world.client, `${name}.png`, sourceImage(name)));
  const material = await importFiles(world.client, files.map(file => file.id), '分段函数与独立答案页');
  assert.equal(material.drafts.length, 2, '只有 Q3 与 Q4 题干能建立草稿');
  const piecewise = material.drafts.find(draft => /cases/.test(textOf(draft.body)));
  assert.ok(piecewise, '机器两行 cases 必须进入可编辑数学源');
  const body = textOf(piecewise.body);
  assert.match(body, /ax.*1/);
  assert.match(body, /x.*<.*0/);
  assert.match(body, /x.*geq.*0/);
  assert.equal(piecewise.answerStatus, 'present');
  assert.match(textOf(piecewise.solution), /a.*-1.*f\(1\).*0/, 'Q3 必须匹配自己的已有答案');
  const logarithm = material.drafts.find(draft => /log/.test(textOf(draft.body)));
  assert.ok(logarithm);
  assert.match(textOf(logarithm.solution), /1.*x.*3/, 'Q4 不等式须保留原有定义域答案');
  for (const content of ['答案 B', '单调递增区间', 'BC=5'])
    assert.ok(material.fragments.some(fragment => fragment.text.includes(content) && fragment.disposition === 'unassigned'), `未匹配答案须留待分配：${content}`);
  assert.deepEqual(recognizer.calls, ['I-2', 'PS-4']);
  world.complete();
});
