import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { application, upload, download, json, finished, document, readFixture } from './helpers.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('C3 真实 PNG 保留透明题面、独立答案与80行完整分页，长期笔记不进入输出', { timeout: 180000 }, async t => {
  const world = await application(t);
  const { client } = world;
  const image = await upload(client, '直角三角形.png', readFixture('questions/figure.png'));
  const body = document('直角三角形 ABC，AB=4，AC=3，求 BC。');
  body.blocks.push({ type: 'math', latex: 'BC=\\sqrt{4^2+3^2}' }, { type: 'image', fileId: image.id, alt: '三角形', widthMm: 60 });
  const question = await json(client, 'POST', '/api/modules/questions/v2/items', {
    title: '题面输出', body, solution: document('BC=5'), answerStatus: 'present', note: '不得输出的长期笔记', starred: false,
    typeId: null, tagIds: [], source: { kind: 'manual' },
  }, 201);
  const digests = ids => Promise.all(ids.map(async id => sha(await download(client, id))));
  const bodyJob = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: question.version, mode: 'question-png', includeAnswers: false, figureFileId: null,
  }, 202);
  const bodyDone = await finished(client, bodyJob.id);
  assert.equal(bodyDone.state, 'succeeded');
  const bodyHashes = await digests(bodyDone.outputFileIds);
  const job = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: question.version, mode: 'question-png', includeAnswers: true, figureFileId: null,
  }, 202);
  const done = await finished(client, job.id);
  assert.equal(done.state, 'succeeded', JSON.stringify(done));
  const originalHashes = await digests(done.outputFileIds);
  assert.deepEqual(originalHashes.slice(0, bodyHashes.length), bodyHashes, '带答案导出的题面前缀须逐片等于纯题面输出');
  assert.ok(originalHashes.length > bodyHashes.length, '题面之后必须另有实际答案分片');
  for (const id of done.outputFileIds) {
    const bytes = await download(client, id);
    const metadata = await sharp(bytes).metadata();
    const stats = await sharp(bytes).stats();
    assert.equal(metadata.width, 1600);
    assert.ok(metadata.height <= 2400 && metadata.height > 20);
    assert.equal(metadata.hasAlpha, true, '题面图片须保留透明背景');
    assert.ok(stats.channels[3].min === 0 && stats.channels[3].max === 255, '输出应同时包含透明留白与真实可见像素');
  }
  const noted = await json(client, 'PUT', `/api/modules/questions/v2/items/${question.id}`, {
    baseVersion: question.version, title: question.title, body: question.body, solution: question.solution,
    answerStatus: question.answerStatus, note: '另一条绝不能进入输出的私密笔记', starred: false, typeId: null, tagIds: [],
  });
  const again = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: noted.version, mode: 'question-png', includeAnswers: true, figureFileId: null,
  }, 202);
  const againDone = await finished(client, again.id);
  assert.equal(againDone.state, 'succeeded');
  assert.equal(againDone.outputFileIds.length, done.outputFileIds.length);
  for (const [index, id] of done.outputFileIds.entries())
    assert.equal(sha(await download(client, againDone.outputFileIds[index])), sha(await download(client, id)), '长期笔记不能影响公开题面与答案图片');
  const figureJob = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: noted.version, mode: 'figure-png', includeAnswers: false, figureFileId: image.id,
  }, 202);
  const figureDone = await finished(client, figureJob.id);
  assert.equal(figureDone.state, 'succeeded');
  assert.equal(figureDone.outputFileIds.length, 1, '配图模式应只生成选定配图');
  const solved = await json(client, 'PUT', `/api/modules/questions/v2/items/${question.id}`, {
    baseVersion: noted.version, title: noted.title, body: noted.body,
    solution: document('更新解析：由勾股定理，BC=5，且 tan B=3/4。'),
    answerStatus: noted.answerStatus, note: noted.note, starred: noted.starred, typeId: noted.typeId, tagIds: noted.tagIds,
  });
  const solvedJob = await json(client, 'POST', `/api/modules/questions/v2/items/${question.id}/assets`, {
    baseVersion: solved.version, mode: 'question-png', includeAnswers: true, figureFileId: null,
  }, 202);
  const solvedDone = await finished(client, solvedJob.id);
  assert.equal(solvedDone.state, 'succeeded');
  const solvedHashes = await digests(solvedDone.outputFileIds);
  assert.deepEqual(solvedHashes.slice(0, bodyHashes.length), bodyHashes, '只修改答案不能改变题面分片');
  assert.ok(solvedHashes.length > bodyHashes.length, '修改答案后仍须输出答案分片');
  assert.notDeepEqual(solvedHashes.slice(bodyHashes.length), originalHashes.slice(bodyHashes.length), '只修改 solution 必须改变实际答案分片，不能用重复题面冒充答案');

  const lines = Array.from({ length: 80 }, (_, index) => `第${String(index + 1).padStart(3, '0')}行：完整保留教学内容与末尾。`);
  const longQuestion = await json(client, 'POST', '/api/modules/questions/v2/items', {
    title: '八十行长段落', body: document(lines.join('\n')), solution: document(''), answerStatus: 'absent',
    note: '', starred: false, typeId: null, tagIds: [], source: { kind: 'manual' },
  }, 201);
  const longJob = await json(client, 'POST', `/api/modules/questions/v2/items/${longQuestion.id}/assets`, {
    baseVersion: longQuestion.version, mode: 'question-png', includeAnswers: false, figureFileId: null,
  }, 202);
  const longDone = await finished(client, longJob.id);
  assert.equal(longDone.state, 'succeeded');
  let inkBands = 0;
  for (const id of longDone.outputFileIds) {
    const { data, info } = await sharp(await download(client, id)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.ok(info.height <= 2400);
    let previous = false;
    for (let y = 0; y < info.height; y++) {
      let ink = false;
      for (let x = 48; x < info.width - 48 && !ink; x++) ink = data[(y * info.width + x) * 4 + 3] > 20;
      if (ink && !previous) inkBands++;
      previous = ink;
    }
  }
  assert.equal(inkBands, lines.length, '全部分片必须保留80条完整文字行，包括末尾，不能丢尾、重复或切断行');
  assert.ok(longDone.outputFileIds.length >= 3, '80行应跨多个实际 PNG 分片');
  world.complete();
});
