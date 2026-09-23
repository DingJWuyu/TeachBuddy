import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startMaterialsHttp } from '../../web/e2e/fixtures/materials-integration/server.mjs';

test('lesson order: persistence, owner isolation, conflict and unknown-result replay', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-order-'));
  let world = await startMaterialsHttp(directory);
  let passed = false;
  async function request(method, route, body, { owner = 'integration-a', key = randomUUID() } = {}) {
    const response = await fetch(world.origin + '/api/modules/lessons/v3' + route, { method, headers: {
      Cookie: world.workbench.identity.testPrincipalCookie(owner).header.split(';')[0], Origin: 'http://localhost',
      'X-TeachBuddy-Request': '1', 'Idempotency-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  try {
    const input = { title: '课题', intro: { version: 2, blocks: [] }, sections: [], materials: [] };
    const a = await request('POST', '', input);
    const b = await request('POST', '', { ...input, title: '第二课题' });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    const before = await request('GET', '/order');
    const key = randomUUID(), payload = { baseVersion: before.body.version, lessonIds: [...before.body.lessonIds].reverse() };
    const saved = await request('PUT', '/order', payload, { key });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.version, 1);
    assert.deepEqual((await request('GET', '')).body.items.map(item => item.id), payload.lessonIds);
    assert.equal((await request('PUT', '/order', { ...payload, baseVersion: 0 })).status, 409);
    assert.equal((await request('PUT', '/order', { baseVersion: 1, lessonIds: [a.body.id] })).status, 422);
    assert.equal((await request('PUT', '/order', payload, { owner: 'integration-b' })).status, 422);
    assert.deepEqual((await request('GET', '/order', undefined, { owner: 'integration-b' })).body, { version: 0, lessonIds: [] });
    assert.equal((await request('GET', `/${a.body.id}`)).body.version, 1);
    await world.close(); world = await startMaterialsHttp(directory);
    assert.deepEqual(await request('PUT', '/order', payload, { key }), saved);
    assert.deepEqual((await request('GET', '')).body.items.map(item => item.id), payload.lessonIds);
    passed = true;
  } finally { await world.close(); if (passed) fs.rmSync(directory, { recursive: true, force: true }); }
});
