import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startMathFixture } from '../../web/e2e/fixtures/math-static/server.mjs';
import { emptySource } from '../../web/src/features/math/model.js';

test('math archive and purge: version, account, rollback, replay and restart', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-archive-'));
  let world = await startMathFixture({ dataDir: directory, port: 0 });
  let passed = false;
  const base = '/api/modules/math/v1/works';
  async function request(method, route, input, key = randomUUID(), account = 'm41-a') {
    const response = await fetch(`${world.origin}${route}`, { method, headers: {
      Cookie: world.workbench.identity.testPrincipalCookie(account).header.split(';')[0],
      Origin: world.origin, 'X-TeachBuddy-Request': '1',
      ...(input ? { 'Content-Type': 'application/json', 'Idempotency-Key': key } : {}),
    }, ...(input ? { body: JSON.stringify(input) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  try {
    const source = { ...emptySource('formula'), latex: 'x^2' };
    const created = await request('POST', base, { title: '归档作品', source, originalFileId: null });
    assert.equal(created.status, 201);
    const id = created.body.id, route = `${base}/${id}`;
    assert.equal((await request('POST', `${route}/purge`, { baseVersion: 1 })).status, 422);
    const exported = await request('POST', `${route}/exports`, { version: 1, format: 'source', background: 'transparent', width: 1600 });
    assert.equal(exported.status, 201);
    await request('POST', `${route}/deletion`, { baseVersion: 1, deleted: true });
    assert.equal((await request('POST', `${route}/purge`, { baseVersion: 1 })).status, 409);
    assert.equal((await request('POST', `${route}/purge`, { baseVersion: 2 }, randomUUID(), 'm41-b')).status, 404);
    const restored = await request('POST', `${route}/deletion`, { baseVersion: 2, deleted: false });
    assert.equal(restored.body.source.latex, 'x^2');
    await request('POST', `${route}/deletion`, { baseVersion: 3, deleted: true });
    const key = randomUUID(), input = { baseVersion: 4 };
    world.workbench.db.exec("CREATE TRIGGER fail_math_purge BEFORE DELETE ON math_works BEGIN SELECT RAISE(ABORT, 'storage failure'); END");
    assert.equal((await request('POST', `${route}/purge`, input, key)).status, 503);
    assert.equal((await request('GET', `${route}/versions`)).body.items.length, 4);
    assert.equal(world.workbench.db.prepare('SELECT count(*) AS n FROM math_exports').get().n, 1);
    world.workbench.db.exec('DROP TRIGGER fail_math_purge');
    const purged = await request('POST', `${route}/purge`, input, key);
    assert.deepEqual(purged, { status: 200, body: { id, permanentlyDeleted: true } });
    assert.equal(world.workbench.db.prepare('SELECT count(*) AS n FROM math_revisions WHERE workId=?').get(id).n, 0);
    assert.equal(world.workbench.db.prepare('SELECT count(*) AS n FROM math_exports').get().n, 0);
    for (const suffix of ['', '/versions', '/versions/1', '/reference']) assert.equal((await request('GET', `${route}${suffix}`)).status, 404);
    assert.equal((await request('POST', `${route}/deletion`, { baseVersion: 4, deleted: false })).status, 404);
    assert.equal((await request('GET', `${base}?state=deleted`)).body.items.length, 0);
    await world.close();
    world = await startMathFixture({ dataDir: directory, port: 0 });
    assert.deepEqual(await request('POST', `${route}/purge`, input, key), purged);
    assert.equal((await request('GET', route)).status, 404);
    assert.equal((await request('POST', `${route}/purge`, { baseVersion: 5 }, key)).status, 409);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
