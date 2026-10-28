import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTestDirectory } from '../support/directories.js';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../support/application.js';
import { createClient, createClock } from '../fixtures/auth-contract/harness.js';

export const questions = '/api/modules/questions/v2/items';
export const classes = '/api/modules/classroom';
export const schedule = '/api/modules/schedule';
export const doc = text => ({ version: 1, blocks: text ? [{ type: 'paragraph', runs: [{ type: 'text', text }] }] : [] });
export const question = (overrides = {}) => ({ title: '一次函数', body: doc('求 y=2x+1 的零点'), solution: doc('x=-1/2'), answerStatus: 'present', note: '', starred: false, typeId: null, tagIds: [], source: { kind: 'manual' }, ...overrides });
export function editable(value) {
  return Object.fromEntries(['title', 'body', 'solution', 'answerStatus', 'note', 'starred', 'typeId', 'tagIds'].map(key => [key, value[key]]));
}
export function ok(response, status = 200, message = '请求应成功') {
  assert.equal(response.status, status, `${message}: ${response.text}`);
  assert.equal(response.headers['cache-control'], 'no-store', '业务响应不可缓存');
  return response.json;
}
export function problem(response, status, type, extra = {}) {
  assert.equal(response.status, status, `${type}: ${response.text}`);
  assert.match(response.headers['content-type'], /^application\/problem\+json/, '拒绝必须返回 Problem');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.json.type.split('/').at(-1), type);
  for (const [key, value] of Object.entries(extra)) assert.deepEqual(response.json[key], value, `${type}.${key}`);
  return response.json;
}
export const write = (client, method, url, body, key = randomUUID(), options = {}) => client.request(method, url, { body, ...options, headers: { 'Idempotency-Key': key, ...options.headers } });
export async function createWorld(t, options = {}) {
  const directory = createTestDirectory('rebuilt-business-');
  const clock = createClock();
  let app = await createIntegration({ directory, clock, workbenchClock: () => new Date(clock.now()), ...options });
  const world = { get app() { return app; }, directory, clock,
    client: () => {
      const client = app.client();
      const request = client.request.bind(client);
      client.request = (method, url, options = {}) => request(method, url, { ...options, headers: { Connection: 'close', ...options.headers } });
      return client;
    },
    async restart() {
      const port = Number(new URL(app.origin).port);
      await app.close();
      app = await createIntegration({ directory, port, clock, workbenchClock: () => new Date(clock.now()), ...options });
    }
  };
  t.after(async () => {
    await app.close();
    if (t.passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error(`失败现场保留: ${directory}`);
  });
  return world;
}
export async function register(world, email = `${randomUUID()}@example.test`, options = {}) {
  const client = options.client ?? world.client();
  ok(await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } }));
  const sent = ok(await client.request('POST', '/api/auth/registration-codes', { body: { email } }));
  const body = { email, nickname: '林老师', password: 'teacher-password-9', termsAccepted: true, rememberMe: true,
    challengeId: sent.challengeId, verificationCode: world.app.mailer.lastCode('registration', email.trim().toLowerCase()), ...options.body };
  const pending = ok(await client.request('POST', '/api/auth/register', { body }), 201);
  if (!options.pending) ok(await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: pending.id, rememberMe: body.rememberMe } }));
  return { client, sessionId: pending.id, account: pending.account, email: pending.account.email, password: body.password };
}
export async function login(world, account, options = {}) {
  const client = options.client ?? world.client();
  ok(await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } }));
  const session = ok(await client.request('POST', '/api/auth/login', { body: { email: account.email, password: account.password, rememberMe: options.rememberMe ?? true } }));
  ok(await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: session.id, rememberMe: options.rememberMe ?? true } }));
  return { client, sessionId: session.id };
}
export function anotherPage(world, client) {
  return createClient(world.app.origin, { transport: https, jar: client.jar, pageId: randomUUID().replaceAll('-', '') });
}
export async function upload(client, bytes, name, key = randomUUID()) {
  const boundary = `tb-${randomUUID()}`;
  const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  return client.request('POST', '/api/workbench/files', { rawBody: payload, contentType: `multipart/form-data; boundary=${boundary}`, headers: { 'Idempotency-Key': key } });
}
export async function bytes(client, url) {
  return new Promise((resolve, reject) => {
    const req = https.get(new URL(url, client.baseUrl), { rejectUnauthorized: false, headers: { Cookie: client.jar.header(), 'X-TeachBuddy-Page': client.pageId } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, bytes: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}
