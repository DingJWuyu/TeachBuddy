import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { startMathFixture } from './fixtures/math/server.mjs';

async function source(xml = '<geogebra format="5.0"><construction/></geogebra>', appName = 'classic') {
  const zip = new JSZip();
  zip.file('geogebra.xml', xml);
  return { schemaVersion: 1, kind: 'geogebra', appName,
    base64: await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' }) };
}

test('native GeoGebra survives HTTP save, history, copy, archive, restart and source export', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-geogebra-'));
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
    const initial = await source();
    const createInput = { title: '原生GGB', source: initial, originalFileId: null };
    const createKey = randomUUID();
    const created = await request('POST', base, createInput, createKey);
    assert.equal(created.status, 201, JSON.stringify(created));
    assert.deepEqual(created.body.render, { state: 'source-only', posterFileId: null, presentationFileId: null, reason: null });
    const id = created.body.id, route = `${base}/${id}`;
    assert.equal((await request('GET', `${base}?kind=geogebra`)).body.items.length, 1);
    assert.equal((await request('GET', route, undefined, undefined, 'm41-b')).status, 404);
    const revised = await source('<geogebra format="5.0"><construction><element type="point" label="A"/></construction></geogebra>', 'geometry');
    const updated = await request('PUT', route, { baseVersion: 1, title: '已修改GGB', source: revised });
    assert.equal(updated.status, 200, JSON.stringify(updated));
    assert.deepEqual(updated.body.source, revised);
    assert.deepEqual((await request('GET', `${route}/versions/1`)).body.source, initial);
    assert.equal((await request('PUT', route, { baseVersion: 1, title: '冲突', source: initial })).status, 409);
    const copied = await request('POST', `${route}/copy`, { baseVersion: 2, title: '副本' });
    assert.equal(copied.status, 201, JSON.stringify(copied));
    assert.notEqual(copied.body.id, id);
    assert.deepEqual(copied.body.source, revised);
    // Restoring history creates a new revision, preserving the previous versions.
    const restoredHistory = await request('PUT', route, { baseVersion: 2, title: '历史恢复', source: initial });
    assert.equal(restoredHistory.body.version, 3);
    assert.deepEqual((await request('GET', `${route}/versions/2`)).body.source, revised);
    const archived = await request('POST', `${route}/deletion`, { baseVersion: 3, deleted: true });
    assert.equal(archived.body.version, 4);
    const restored = await request('POST', `${route}/deletion`, { baseVersion: 4, deleted: false });
    assert.equal(restored.body.version, 5);
    assert.deepEqual(restored.body.source, initial);
    const exported = await request('POST', `${route}/exports`, { version: 2, format: 'source', background: 'transparent', width: 1600 });
    assert.equal(exported.status, 201, JSON.stringify(exported));
    const stream = await world.workbench.files.open({ accountKey: 'm41-a' }, exported.body.file.id);
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), revised);
    for (const format of ['png', 'svg', 'html']) {
      assert.equal((await request('POST', `${route}/exports`, { version: 5, format, background: 'transparent', width: 1600 })).status, 422);
    }
    assert.equal(world.workbench.db.prepare('SELECT count(*) AS n FROM math_works').get().n, 2);
    await world.close();
    world = await startMathFixture({ dataDir: directory, port: 0 });
    assert.deepEqual((await request('GET', route)).body.source, initial);
    assert.deepEqual(await request('POST', base, createInput, createKey), created);
    assert.equal((await request('GET', `${route}/versions`)).body.items.length, 5);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('native GeoGebra rejects malformed or oversized archives without SQLite writes', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-geogebra-invalid-'));
  const world = await startMathFixture({ dataDir: directory, port: 0 });
  let passed = false;
  try {
    const valid = await source();
    const missing = new JSZip(); missing.file('readme.txt', 'not a construction');
    const bomb = new JSZip(); bomb.file('geogebra.xml', 'x'.repeat(16 * 1024 * 1024 + 1));
    const corrupt = new JSZip(); corrupt.file('geogebra.xml', '<geogebra/>');
    const corruptBytes = await corrupt.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    corruptBytes[corruptBytes.indexOf(Buffer.from('<geogebra/>'))] ^= 1;
    const rejected = [
      { ...valid, base64: '%%%invalid%%%' },
      { ...valid, base64: Buffer.from('not a zip').toString('base64') },
      { ...valid, base64: valid.base64.slice(0, -8) },
      { ...valid, base64: await missing.generateAsync({ type: 'base64' }) },
      await source(''),
      { ...valid, base64: await bomb.generateAsync({ type: 'base64', compression: 'DEFLATE' }) },
      { ...valid, base64: corruptBytes.toString('base64') },
      { ...valid, base64: 'A'.repeat(1048580) },
      { ...valid, appName: 'unknown' },
    ];
    for (const candidate of rejected) {
      const response = await fetch(`${world.origin}/api/modules/math/v1/works`, {
        method: 'POST', headers: {
          Cookie: world.workbench.identity.testPrincipalCookie('m41-a').header.split(';')[0],
          Origin: world.origin, 'X-TeachBuddy-Request': '1',
          'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(),
        }, body: JSON.stringify({ title: '不应保存', source: candidate, originalFileId: null }),
      });
      assert.equal(response.status, 422, await response.text());
      assert.equal(world.workbench.db.prepare('SELECT count(*) AS n FROM math_works').get().n, 0);
      assert.equal(world.workbench.db.prepare('SELECT count(*) AS n FROM math_revisions').get().n, 0);
    }
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
