import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../support/application.js';

export const filesPath = '/api/workbench/files';
export const importsPath = '/api/modules/questions/v2/imports';
export const worksPath = '/api/modules/math/v1/works';
export const paragraph = text => ({ type: 'paragraph', runs: [{ type: 'text', text }] });
export const document = text => ({ version: 2, blocks: text ? [paragraph(text)] : [] });
export const textOf = value => JSON.stringify(value);
export const readFixture = file => fs.readFileSync(path.resolve('test/fixtures', file));

export async function application(t, options = {}) {
  const world = await createIntegration(options);
  let passed = false;
  t.after(async () => {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
    else t.diagnostic(`保留隔离现场 ${world.directory}`);
  });
  const client = world.client();
  await json(client, 'POST', '/api/auth/session', { action: 'bootstrap' });
  const email = `outputs-${randomUUID()}@example.test`;
  const sent = await json(client, 'POST', '/api/auth/registration-codes', { email });
  const session = await json(client, 'POST', '/api/auth/register', {
    email, nickname: '成果教师', password: 'outputs-password', termsAccepted: true,
    rememberMe: true, challengeId: sent.challengeId,
    verificationCode: world.mailer.lastCode('registration', email),
  }, 201);
  await json(client, 'POST', '/api/auth/session', { action: 'activate', sessionId: session.id, rememberMe: true });
  return { ...world, client, session, complete() { passed = true; } };
}

export async function json(client, method, url, body, status = 200, key = randomUUID()) {
  const response = await client.request(method, url, { body, headers: { 'Idempotency-Key': key } });
  assert.equal(response.status, status, `${method} ${url}: ${JSON.stringify(response.json)}`);
  return response.json;
}

export async function upload(client, name, bytes) {
  const boundary = `outputs-${randomUUID()}`;
  const response = await client.request('POST', filesPath, {
    headers: { 'Idempotency-Key': randomUUID() },
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.status, 201, `上传 ${name}: ${JSON.stringify(response.json)}`);
  return response.json;
}

export async function download(client, id) {
  const response = await client.request('GET', `${filesPath}/${id}/content`);
  assert.equal(response.status, 200, `下载 ${id}`);
  return response.bytes;
}

export async function finished(client, jobId) {
  const deadline = Date.now() + 150000;
  let job;
  do {
    job = await json(client, 'GET', `/api/workbench/jobs/${jobId}`);
    if (!['queued', 'running', 'cancelling'].includes(job.state)) return job;
    await new Promise(resolve => setTimeout(resolve, 40));
  } while (Date.now() < deadline);
  assert.fail(`任务未结束 ${jobId}: ${JSON.stringify(job)}`);
}

export async function preview(client, fileId, expectedState = 'succeeded') {
  const job = await json(client, 'POST', `${filesPath}/${fileId}/preview`, {}, 202);
  const done = await finished(client, job.id);
  assert.equal(done.state, expectedState, `预览任务: ${JSON.stringify(done)}`);
  return json(client, 'GET', `${filesPath}/${fileId}/preview`);
}

export async function importFiles(client, fileIds, title = '固定材料') {
  const value = await json(client, 'POST', importsPath, { title, origin: '固定输入，无真实模型调用', input: { kind: 'files', fileIds, pages: [] } }, 201);
  const job = await finished(client, value.jobId);
  assert.ok(['succeeded', 'partial'].includes(job.state), `材料提取: ${JSON.stringify(job)}`);
  return json(client, 'GET', `${importsPath}/${value.id}`);
}
