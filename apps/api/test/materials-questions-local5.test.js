import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { startQuestionsFixture } from '../../web/e2e/fixtures/materials-questions/server.mjs';

const evidence = process.env.R33_LOCAL5_EVIDENCE;
async function world(t, provider) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'r33-local5-api-'));
  const runtime = await startQuestionsFixture({ dataDir: directory, port: 0, provider });
  const origin = `http://localhost:${runtime.server.address().port}`;
  const trace = [];
  t.after(async () => {
    await runtime.close();
    if (evidence) {
      fs.mkdirSync(evidence, { recursive: true });
      fs.writeFileSync(path.join(evidence, `${t.name}.json`), JSON.stringify({ directory, trace }, null, 2));
    }
  });
  async function request(route, data, method = 'POST') {
    const at = new Date().toISOString();
    const headers = {
      Cookie: runtime.workbench.identity.testPrincipalCookie('r33-a').header.split(';')[0],
      Origin: 'http://localhost:0', 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID(),
      ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    };
    let response;
    try {
      response = await fetch(origin + route, { method, headers, ...(data ? { body: data instanceof FormData ? data : JSON.stringify(data) } : {}) });
    } catch (error) {
      trace.push({ at, route, method, error: error.message, cause: error.cause });
      throw error;
    }
    const body = route.endsWith('/content') ? Buffer.from(await response.arrayBuffer()) : await response.json();
    trace.push({ at, route, method, status: response.status, request: data instanceof FormData ? 'image upload' : data, response: Buffer.isBuffer(body) ? { bytes: body.length } : body });
    assert.ok(response.ok, JSON.stringify(body));
    return body;
  }
  async function job(id) {
    for (let n = 0; n < 400; n++) {
      const result = await request('/api/workbench/jobs/' + id, null, 'GET');
      if (!['queued', 'running', 'cancelling'].includes(result.state)) return result;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw Error('Job timeout');
  }
  return { request, job };
}
const qp = '/api/modules/questions/v2';
const doc = text => ({ version: 2, blocks: text ? [{ type: 'paragraph', runs: [{ type: 'text', text }] }] : [] });

test('LOCAL005-empty', async t => {
  const e = await world(t, { extract: async () => ({ content: '' }) });
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png', import.meta.url))]), 'triangle.png');
  const file = await e.request('/api/workbench/files', form);
  const input = { title: '空正文', origin: '', input: { kind: 'files', fileIds: [file.id], pages: [] } };
  const created = await e.request(qp + '/imports', input);
  const job = await e.job(created.jobId);
  const material = await e.request(qp + '/imports/' + created.id, null, 'GET');
  assert.equal(material.drafts.length, 0);
  assert.equal(material.fragments.length, 0);
  assert.ok(job.issues.some(i => i.code === 'empty-response'));
  assert.equal(job.state, 'failed');
});

test('LOCAL003-long-png', async t => {
  const e = await world(t);
  const question = await e.request(qp + '/items', {
    title: 'local3 长题分片', source: { kind: 'manual' }, note: 'NEVER_PRIVATE_NOTE_LOCAL3', starred: false, typeId: null, tagIds: [],
    answerStatus: 'absent', solution: doc(''),
    body: { version: 2, blocks: Array.from({ length: 36 }, (_, i) => [
      ...doc('第' + (i + 1) + '段 长题分片可见边界').blocks,
      { type: 'math', latex: 'f(x)=\\frac{\\sqrt{2x-1}}{x-2}' },
    ]).flat() },
  });
  const accepted = await e.request(qp + '/items/' + question.id + '/assets', { baseVersion: question.version, includeAnswers: false, mode: 'question-png', figureFileId: null });
  const result = await e.job(accepted.id);
  assert.equal(result.state, 'succeeded');
  assert.ok(result.outputFileIds.length > 1);
  const dimensions = [];
  for (const [i, id] of result.outputFileIds.entries()) {
    const bytes = await e.request('/api/workbench/files/' + id + '/content', null, 'GET');
    const meta = await sharp(bytes).metadata();
    dimensions.push({ width: meta.width, height: meta.height, alpha: meta.hasAlpha });
    if (evidence) { fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, `long-${i}.png`), bytes); }
  }
  console.log(JSON.stringify(dimensions));
  for (const size of dimensions) {
    assert.equal(size.width, 1600);
    assert.equal(size.alpha, true);
    assert.ok(size.height <= 2400, `height ${size.height} exceeds 2400`);
  }
});

async function uploadImage(e, bytes, name = 'triangle.png') {
  const form = new FormData();
  form.append('file', new Blob([bytes]), name);
  return e.request('/api/workbench/files', form);
}
const fragment = text => ({ role: 'question', label: '1.', section: '', group: '', text, content: [{ text }], continues: '', doubts: [] });
for (const [name, contents, expected, drafts, fragments] of [
  ['whitespace', [' \n\t '], 'failed', 0, 0],
  ['invalid-json', ['not JSON'], 'partial', 0, 1],
  ['complete-prefix', ['{"fragments":[' + JSON.stringify(fragment('完整题干')) + ',{"role":"question"'], 'partial', 1, 1],
  ['success-and-empty', [JSON.stringify({ fragments: [fragment('完整题干')] }), ''], 'partial', 1, 0],
  ['all-empty', ['', ''], 'failed', 0, 0],
]) {
  test('LOCAL005-' + name, async t => {
    let calls = 0;
    const e = await world(t, { extract: async () => ({ content: contents[calls++] }) });
    const fileIds = [];
    for (let i = 0; i < contents.length; i++) fileIds.push((await uploadImage(e, fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png', import.meta.url)))).id);
    const created = await e.request(qp + '/imports', { title: name, origin: 'local provider control', input: { kind: 'files', fileIds, pages: [] } });
    const job = await e.job(created.jobId);
    const material = await e.request(qp + '/imports/' + created.id, null, 'GET');
    assert.equal(job.state, expected);
    assert.equal(material.drafts.length, drafts);
    assert.equal(material.fragments.length, fragments);
    assert.equal(calls, contents.length);
    if (name === 'invalid-json') assert.equal(material.fragments[0].text, 'not JSON');
    if (drafts) assert.ok(JSON.stringify(material.drafts[0].body).includes('完整题干'));
  });
}

test('LOCAL003-height-boundaries', async t => {
  const e = await world(t);
  async function picture(height) {
    return uploadImage(e, await sharp({ create: { width: 1504, height, channels: 4, background: '#1267ab' } }).png().toBuffer(), `height-${height}.png`);
  }
  const first = await picture(1000);
  for (const target of [2399, 2400, 2401]) {
    const second = await picture(target - 112 - 1000);
    const question = await e.request(qp + '/items', {
      title: `边界${target}`, source: { kind: 'manual' }, note: '', starred: false, typeId: null, tagIds: [], answerStatus: 'absent', solution: doc(''),
      body: { version: 2, blocks: [first, second].map(file => ({ type: 'image', fileId: file.id, alt: '边界色块', widthMm: 100 })) },
    });
    const accepted = await e.request(qp + '/items/' + question.id + '/assets', { baseVersion: question.version, includeAnswers: false, mode: 'question-png', figureFileId: null });
    const job = await e.job(accepted.id);
    assert.equal(job.state, 'succeeded');
    assert.equal(job.outputFileIds.length, target <= 2400 ? 1 : 2);
    const heights = [];
    for (const [i, id] of job.outputFileIds.entries()) {
      const bytes = await e.request('/api/workbench/files/' + id + '/content', null, 'GET');
      const meta = await sharp(bytes).metadata();
      heights.push(meta.height);
      assert.equal(meta.width, 1600);
      assert.ok(meta.height <= 2400);
      assert.equal(meta.hasAlpha, true);
      if (evidence) fs.writeFileSync(path.join(evidence, `boundary-${target}-${i}.png`), bytes);
    }
    if (target <= 2400) assert.equal(heights[0], target);
    console.log(JSON.stringify({ target, heights }));
  }
  const tall = await picture(5000);
  const question = await e.request(qp + '/items', {
    title: '超高单图', source: { kind: 'manual' }, note: '', starred: false, typeId: null, tagIds: [], answerStatus: 'absent', solution: doc(''),
    body: { version: 2, blocks: [{ type: 'image', fileId: tall.id, alt: '超高图', widthMm: 100 }] },
  });
  for (const mode of ['question-png', 'figure-png']) {
    const accepted = await e.request(qp + '/items/' + question.id + '/assets', { baseVersion: question.version, includeAnswers: false, mode, figureFileId: mode === 'figure-png' ? tall.id : null });
    const job = await e.job(accepted.id);
    assert.equal(job.state, 'succeeded');
    const bytes = await e.request('/api/workbench/files/' + job.outputFileIds[0] + '/content', null, 'GET');
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.height, 2292);
    assert.equal(meta.width, 1600);
  }
});
