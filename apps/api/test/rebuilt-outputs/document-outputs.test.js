import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { application, upload, download, json, finished, document, readFixture } from './helpers.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
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
    assert.equal(sha(await download(client, againDone.outputFileIds[index])), sha(await download(client, id)), '长期笔记不能影响公开题面与答案图片');
  const figureJob = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: question.version + 1, mode: 'figure-png', includeAnswers: false, figureFileId: image.id,
  }, 202);
  const figureDone = await finished(client, figureJob.id);
  assert.equal(figureDone.state, 'succeeded');
  assert.equal(figureDone.outputFileIds.length, 1, '配图模式应只生成选定配图');
  world.complete();
});
