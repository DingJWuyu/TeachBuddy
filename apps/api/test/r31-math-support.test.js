import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { createApp } from '../src/app.js';
import { createEnv } from '../src/config/env.js';
import { createWorkbench } from '../src/workbench/index.js';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';

test('R31 pinned Node packages render real formula SVG/transparent PNG and local Chinese font', async () => {
  const require = createRequire(import.meta.url);
  assert.equal(require('mathjax-full/package.json').version, '3.2.2');
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const document = mathjax.document('', { InputJax: new TeX(), OutputJax: new SVG({ fontCache: 'none' }) });
  const node = document.convert(String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`, { display: true });
  const svg = adaptor.outerHTML(adaptor.firstChild(node));
  assert.match(svg, /<path/);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.hasAlpha, true);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Array.from(data).filter((_, index) => index % info.channels === 3);
  assert.equal(Math.min(...alpha), 0);
  assert.equal(Math.max(...alpha), 255);
  const fontfile = require.resolve('@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff');
  const chinese = await sharp({ text: { text: '函数图像与中文说明', font: 'Noto Sans SC 24', fontfile, rgba: true } }).png().toBuffer();
  assert.ok((await sharp(chinese).metadata()).width > 100);
});

async function register(world, email) {
  const client = world.client();
  assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } })).status, 200);
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const pending = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '数学教师', password: 'support-password', termsAccepted: true, rememberMe: true,
    challengeId: sent.json.challengeId, verificationCode: world.mailer.lastCode('registration', email)
  } });
  assert.equal(pending.status, 201, pending.text);
  return { client, session: pending.json };
}

async function activate(client, session) {
  assert.equal((await client.request('POST', '/api/auth/session', { body: {
    action: 'activate', sessionId: session.id, rememberMe: true
  } })).status, 200);
}

function upload(client, bytes, key = randomUUID(), options = {}) {
  const boundary = 'r31-math-upload';
  const rawBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="poster.png"\r\nContent-Type: image/png\r\n\r\n`),
    bytes, Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  return client.request('POST', '/api/workbench/files', {
    rawBody, contentType: `multipart/form-data; boundary=${boundary}`,
    headers: { 'Idempotency-Key': key }, ...options
  });
}

test('R31 real HTTPS: files enforce A11 page binding, restore, expiry and revocation', async () => {
  const world = await createIntegration();
  try {
    const { client, session } = await register(world, 'math-a@example.test');
    const bytes = await sharp({ create: { width: 24, height: 16, channels: 4, background: '#2468ac80' } }).png().toBuffer();
    assert.equal((await upload(client, bytes)).status, 401, 'pending cannot store files');
    await activate(client, session);
    assert.equal((await upload(client, bytes, randomUUID(), { page: null })).status, 401);
    assert.equal((await upload(client, bytes, randomUUID(), { origin: 'https://foreign.invalid' })).status, 403);
    assert.equal((await upload(client, bytes, randomUUID(), { protect: false })).status, 403);
    const key = randomUUID();
    const saved = await upload(client, bytes, key);
    assert.equal(saved.status, 201, saved.text);
    assert.deepEqual((await upload(client, bytes, key)).json, saved.json);
    assert.equal((await upload(client, Buffer.from('different'), key)).status, 409);
    const route = `/api/workbench/files/${saved.json.id}`;
    for (const endpoint of [route, `${route}/content`]) {
      assert.equal((await client.request('GET', endpoint, { page: null })).status, 401);
      assert.equal((await client.request('GET', endpoint, { page: 'b'.repeat(32) })).status, 401);
      assert.equal((await client.request('GET', endpoint, { cookie: null })).status, 401);
      assert.equal((await client.request('GET', endpoint)).status, 200);
    }
    const other = await register(world, 'math-b@example.test');
    await activate(other.client, other.session);
    assert.equal((await other.client.request('GET', route)).status, 404);
    assert.equal((await other.client.request('GET', `${route}/content`)).status, 404);
    client.pageId = 'b'.repeat(32);
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'restore', sessionId: session.id } })).status, 200);
    assert.deepEqual((await client.request('GET', route)).json, saved.json);
    for (const table of ['auth_accounts', 'auth_sessions']) {
      world.workbench.db.exec(`ALTER TABLE ${table} RENAME TO ${table}_unavailable`);
      assert.equal((await client.request('GET', route)).status, 503);
      world.workbench.db.exec(`ALTER TABLE ${table}_unavailable RENAME TO ${table}`);
    }
    assert.equal((await client.request('POST', '/api/auth/logout', { body: { sessionId: session.id } })).status, 204);
    assert.equal((await client.request('GET', route)).status, 401);
    assert.equal((await upload(client, bytes)).status, 401);
    world.clock.advance(7 * 86400000 + 1);
    assert.equal((await other.client.request('GET', route)).status, 401);
  } finally {
    await world.close();
    fs.rmSync(world.directory, { recursive: true, force: true });
  }
});

test('R31 real HTTPS: file/content, idempotency and migration ledger survive two restarts', async () => {
  let world = await createIntegration();
  const directory = world.directory;
  try {
    const { client, session } = await register(world, 'persistent@example.test');
    await activate(client, session);
    const key = randomUUID();
    const bytes = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#34678980' } }).png().toBuffer();
    const saved = await upload(client, bytes, key);
    assert.equal(saved.status, 201, saved.text);
    const principal = session.account;
    const document = { version: 2, blocks: [{ type: 'image', fileId: saved.json.id, alt: '中文说明', widthMm: 30 }] };
    assert.deepEqual(world.workbench.content.validate(principal, document), document);
    const ledger = world.workbench.migrations.appliedIds();
    const fileRows = world.workbench.db.prepare('SELECT * FROM materials_files').all();
    for (let i = 0; i < 2; i++) {
      await world.close();
      world = await createIntegration({ directory });
      const restored = world.client();
      restored.jar = client.jar;
      assert.deepEqual((await restored.request('GET', `/api/workbench/files/${saved.json.id}`)).json, saved.json);
      assert.deepEqual((await upload(restored, bytes, key)).json, saved.json);
      const stream = await world.workbench.files.open(principal, saved.json.id);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      assert.deepEqual(Buffer.concat(chunks), bytes);
      assert.deepEqual(world.workbench.content.validate(principal, document), document);
      assert.deepEqual(world.workbench.migrations.appliedIds(), ledger);
      assert.deepEqual(world.workbench.db.prepare('SELECT * FROM materials_files').all(), fileRows);
    }
  } finally {
    await world.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('R31 composition: injected workbench binds real auth; production refuses fixture handlers', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'r31-support-composition-'));
  const env = createEnv({ nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'), authCodeSecret: 'isolated-support',
    workbench: { publicOrigin: 'https://fixture.invalid', trustedOrigins: ['https://fixture.invalid'] } });
  const workbench = createWorkbench({ env, identity: { resolvePrincipal: () => ({ accountKey: 'forged' }) } });
  try {
    const context = createApp({ env, workbench, sendCode: async () => {} });
    await workbench.initialize();
    assert.equal(await context.workbench.identity.resolvePrincipal({ headers: {} }), null);
    assert.throws(() => createApp({ env: { ...env, nodeEnv: 'production', workbench: { ...env.workbench, jobHandlers: { extraction: { fixture: true } } } }, workbench }), /preview, extraction, export and question-asset/);
  } finally {
    await workbench.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
