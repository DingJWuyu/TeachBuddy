import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { moduleCatalog } from '@teachbuddy/shared';
import { moduleImplementations } from '../src/workbench/moduleImplementations.js';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { emptySource, newElement } from '../../web/src/features/math/model.js';

const workbench = { catalogOverride: moduleCatalog, extraImplementations: moduleImplementations };
const works = '/api/modules/math/v1/works';

async function register(world, email) {
  const client = world.client();
  assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } })).status, 200);
  const sent = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  const pending = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '组合验证', password: 'composition-password', termsAccepted: true, rememberMe: true,
    challengeId: sent.json.challengeId, verificationCode: world.mailer.lastCode('registration', email)
  } });
  assert.equal(pending.status, 201, pending.text);
  assert.equal((await client.request('GET', works)).status, 401);
  assert.equal((await client.request('POST', '/api/auth/session', { body: {
    action: 'activate', sessionId: pending.json.id, rememberMe: true
  } })).status, 200);
  return { client, session: pending.json };
}

test('isolated static math mapping: real A11, native work, files, replay and two restarts share one composition', async () => {
  assert.deepEqual(moduleCatalog.map(entry => entry.id), ['questions', 'math', 'resources', 'schedule', 'classroom']);
  let world = await createIntegration({ workbench });
  const directory = world.directory;
  try {
    const { client, session } = await register(world, 'math-composition@example.test');
    assert.deepEqual(world.workbench.loader.enabledIds().sort(), ['classroom', 'math', 'questions', 'resources', 'schedule']);
    const catalog = await client.request('GET', '/api/modules');
    assert.equal(catalog.status, 200);
    assert.deepEqual(catalog.json.items.map(entry => entry.id), ['questions', 'math', 'resources', 'schedule', 'classroom']);
    const source = emptySource('plane');
    source.scene.elements = [{ ...newElement('function', 'curve'), expression: 'x^2-2*x-3' }];
    const input = { title: '组合原生函数', source, originalFileId: null };
    const key = randomUUID();
    const save = c => c.request('POST', works, { body: input, headers: { 'Idempotency-Key': key } });
    assert.equal((await client.request('POST', works, { page: null, body: input, headers: { 'Idempotency-Key': key } })).status, 401);
    const saved = await save(client);
    assert.equal(saved.status, 201, saved.text);
    assert.equal(saved.json.render.state, 'ready');
    assert.deepEqual((await save(client)).json, saved.json);
    const workPath = `${works}/${saved.json.id}`;
    const filePath = `/api/workbench/files/${saved.json.render.posterFileId}/content`;
    const bytes = await world.workbench.files.open(session.account, saved.json.render.posterFileId);
    const chunks = [];
    for await (const chunk of bytes) chunks.push(chunk);
    const poster = Buffer.concat(chunks);
    assert.equal(poster.subarray(1, 4).toString(), 'PNG');
    for (const route of [workPath, filePath]) {
      assert.equal((await client.request('GET', route)).status, 200);
      assert.equal((await client.request('GET', route, { page: null })).status, 401);
      assert.equal((await client.request('GET', route, { page: 'b'.repeat(32) })).status, 401);
    }
    const other = await register(world, 'other-composition@example.test');
    assert.equal((await other.client.request('GET', workPath)).status, 404);
    assert.equal((await other.client.request('GET', filePath)).status, 404);
    const ledger = world.workbench.migrations.appliedIds();
    assert.equal(ledger.filter(id => id === 'math_001').length, 1);
    for (let count = 0; count < 2; count++) {
      await world.close();
      world = await createIntegration({ directory, workbench });
      const restored = world.client();
      restored.jar = client.jar;
      restored.pageId = randomUUID().replaceAll('-', '');
      assert.equal((await restored.request('GET', workPath)).status, 401);
      assert.equal((await restored.request('POST', '/api/auth/session', { body: { action: 'restore', sessionId: session.id } })).status, 200);
      assert.deepEqual((await restored.request('GET', workPath)).json, saved.json);
      assert.deepEqual((await save(restored)).json, saved.json);
      assert.deepEqual(world.workbench.migrations.appliedIds(), ledger);
      const stream = await world.workbench.files.open(session.account, saved.json.render.posterFileId);
      const read = [];
      for await (const chunk of stream) read.push(chunk);
      assert.deepEqual(Buffer.concat(read), poster);
      assert.equal((await restored.request('GET', filePath)).status, 200);
    }
    const restored = world.client();
    restored.jar = client.jar;
    assert.equal((await restored.request('POST', '/api/auth/logout', { body: { sessionId: session.id } })).status, 204);
    assert.equal((await restored.request('GET', workPath)).status, 401);
    assert.equal((await restored.request('GET', filePath)).status, 401);
  } finally {
    await world.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
