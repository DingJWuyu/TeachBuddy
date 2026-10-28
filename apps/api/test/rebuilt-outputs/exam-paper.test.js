import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, register, ok, problem, write, upload, classes } from '../rebuilt/helpers.js';
import { sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

async function preview(client, fileId) {
  const job = ok(await write(client, 'POST', `/api/workbench/files/${fileId}/preview`, {}), 202);
  for (let i = 0; i < 200; i++) {
    const current = ok(await client.request('GET', `/api/workbench/jobs/${job.id}`));
    if (current.state === 'succeeded') break;
    assert.ok(['queued', 'running'].includes(current.state), JSON.stringify(current));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const result = ok(await client.request('GET', `/api/workbench/files/${fileId}/preview`));
  assert.equal(result.state, 'ready');
  assert.equal(result.pageCount, 1);
  return result;
}

test('D13 考试原卷：真实PNG固定定位重启保留，同账户无关rendition及源外定位拒绝且原考试不变', async t => {
  const world = await createWorld(t), { client } = await register(world);
  const file = ok(await upload(client, sourceImage('I-1'), '考试原卷.png'), 201);
  const unrelated = ok(await upload(client, sourceImage('I-2'), '同账户另一原卷.png'), 201);
  const view = await preview(client, file.id), otherView = await preview(client, unrelated.id);
  const source = { fileId: file.id, renditionFileId: view.renditionFileId };
  const body = { name: '固定定位考试', subject: '数学', occurredOn: '2026-01-05', totalMax: 10, source: [source],
    questions: [{ label: '1', groupLabel: null, maxScore: 10, tagIds: [], locations: [{ ...source, page: 1, box: { x: .1, y: .2, width: .7, height: .4 } }] }] };
  const exam = ok(await write(client, 'POST', `${classes}/exams`, body), 201);
  const url = `${classes}/exams/${exam.id}`;
  for (const patch of [
    { source: [{ ...source, renditionFileId: otherView.renditionFileId }] },
    { questions: exam.questions.map(question => ({ ...question, locations: [{ fileId: unrelated.id, renditionFileId: otherView.renditionFileId, page: 1, box: null }] })) }
  ]) {
    problem(await write(client, 'PUT', url, { ...body, questions: exam.questions, baseVersion: exam.version, ...patch }), 422, 'invalid-input');
    assert.deepEqual(ok(await client.request('GET', url)), exam, '无效成员关系不得部分替换原卷或定位');
  }
  await world.restart();
  assert.deepEqual(ok(await client.request('GET', url)), exam, '重启后固定File/rendition/页号/选区及ID保持');
});
