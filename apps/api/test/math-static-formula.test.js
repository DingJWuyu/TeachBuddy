import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { startRealMath, registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { emptySource } from '../../web/src/features/math/model.js';
const root = '/api/modules/math/v1/works';
const formula = (latex = String.raw`x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`) => ({ ...emptySource('formula'), latex, caption: '判别式决定实数根的个数' });
const evidence = path.resolve(process.env.M41_EVIDENCE_DIR || 'test-results/m41/formula-output');

test('MC01/08/09/13 real-auth formula source, immutable files/history, failures and two restarts', async () => {
  let world = await startRealMath();
  const directory = world.directory;
  let passed = false;
  fs.mkdirSync(evidence, { recursive: true });
  try {
    let { client, session } = await registerMath(world, 'formula@example.test');
    const other = await registerMath(world, 'formula-other@example.test');
    const key = randomUUID(), input = { title: '求根公式', source: formula(), originalFileId: null };
    const write = (method, route, body, requestKey = randomUUID(), c = client, extra = {}) => c.request(method, route, { body, headers: { 'Idempotency-Key': requestKey }, ...extra });
    const created = await write('POST', root, input, key);
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.render.state, 'ready');
    const id = created.json.id, route = `${root}/${id}`;
    const get = (url, options) => client.request('GET', url, options);
    const changed = await write('PUT', route, { baseVersion: 1, title: input.title, source: { ...input.source, fontSize: 40, color: '#2855a6', caption: '判别式大于零时有两个不相等的实数根' } });
    assert.equal(changed.status, 200, changed.text);
    assert.equal(changed.json.version, 2);
    assert.equal((await write('PUT', route, { baseVersion: 1, title: input.title, source: input.source })).status, 409);
    assert.equal((await write('POST', root, { ...input, title: '不同' }, key)).status, 409);
    assert.deepEqual((await get(`${route}/versions/1`)).json.source, input.source);
    const exportInput = { version: 2, format: 'png', background: 'transparent', width: 1600 };
    const exports = [];
    for (const format of ['png', 'svg', 'source']) {
      const exported = await write('POST', `${route}/exports`, { ...exportInput, format });
      assert.equal(exported.status, 201, exported.text);
      exports.push(exported.json);
      const stream = await world.workbench.files.open(session.account, exported.json.file.id);
      const chunks = []; for await (const chunk of stream) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      fs.writeFileSync(path.join(evidence, `formula.${format === 'source' ? 'json' : format}`), bytes);
      if (format === 'png') {
        const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.width, 1600);
        let opaque = 0, border = 0;
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
          const a = data[(y * info.width + x) * 4 + 3];
          if (a) opaque++;
          if (a && (x < 3 || y < 3 || x >= info.width - 3 || y >= info.height - 3)) border++;
        }
        assert(opaque > 1000); assert.equal(border, 0);
      }
      if (format === 'svg') {
        assert.match(bytes.toString(), /<path/); assert.match(bytes.toString(), /判别式大于零/);
        assert.match(bytes.toString(), /data:font\/woff;base64/);
        assert.doesNotMatch(bytes.toString(), /<script|<foreignObject|href="https?:/);
      }
    }
    assert.equal((await write('POST', root, { ...input, accountId: session.account.accountKey })).status, 422);
    assert.equal((await write('POST', root, { ...input, snapshot: created.json })).status, 422);
    const port = world.workbench.loader.get('math').port;
    const portSource = formula(String.raw`f(x)=\begin{cases}-x^2 & x<0\\x-1 & x\ge0\end{cases}`);
    const viaPort = await port.operations.createWork({ principal: session.account, key: randomUUID(), input: { title: 'port cases', source: portSource, originalFileId: null } });
    assert.equal(viaPort.status, 201);
    assert.deepEqual((await get(`${root}/${viaPort.body.id}`)).json, viaPort.body);
    const portUpdated = await port.operations.updateWork({ principal: session.account, id: viaPort.body.id, key: randomUUID(), input: { baseVersion: 1, title: 'port cases', source: { ...portSource, includeCaption: false } } });
    const portExported = await port.operations.exportWork({ principal: session.account, id: viaPort.body.id, key: randomUUID(), input: { ...exportInput, format: 'svg' } });
    assert.equal(portExported.status, 201);
    const portStream = await world.workbench.files.open(session.account, portExported.body.file.id);
    const portChunks = []; for await (const chunk of portStream) portChunks.push(chunk);
    assert.doesNotMatch(Buffer.concat(portChunks).toString(), /判别式决定/);
    fs.writeFileSync(path.join(evidence, 'provider-fixtures.json'), JSON.stringify({ created: viaPort, updated: portUpdated, reference: (await get(`${root}/${viaPort.body.id}/reference`)).json, exported: portExported, rejectedInput: { status: 422, type: '/problems/workbench/invalid-input', field: '/accountId' } }, null, 2));
    assert.equal((await get(`${route}/reference`)).json.snapshot.workVersion, 2);
    assert.deepEqual((await port.operations.getWork({ principal: session.account, id })).body, changed.json);
    assert((await port.operations.listWorks({ principal: session.account })).body.items.some(w => w.id === id));
    for (const latex of [String.raw`\frac{1`, String.raw`\require{html}\href{https://example.test}{x}`, String.raw`\htmlClass{evil}{x}`]) {
      const invalid = await write('POST', root, { ...input, source: formula(latex) });
      assert.equal(invalid.status, 201, invalid.text);
      assert.equal(invalid.json.render.state, 'invalid');
      assert.equal(invalid.json.render.posterFileId, null);
      assert.equal((await write('POST', `${root}/${invalid.json.id}/exports`, { ...exportInput, version: 1 })).status, 422);
      assert.equal((await write('POST', `${root}/${invalid.json.id}/exports`, { ...exportInput, version: 1, format: 'source' })).status, 201);
    }
    const routes = [route, `${route}/versions/1`, `${route}/versions`, `${route}/reference`, `/api/workbench/files/${created.json.render.posterFileId}`, `/api/workbench/files/${created.json.render.posterFileId}/content`];
    for (const url of routes) {
      assert.equal((await get(url)).status, 200, url);
      assert.equal((await get(url, { page: null })).status, 401, url);
      assert.equal((await get(url, { page: 'f'.repeat(32) })).status, 401, url);
      assert.equal((await get(url, { cookie: null })).status, 401, url);
      assert.equal((await other.client.request('GET', url)).status, 404, url);
    }
    assert.equal((await write('POST', `${route}/exports`, exportInput, randomUUID(), other.client)).status, 404);
    assert.equal((await write('POST', `${route}/exports`, exportInput, randomUUID(), client, { page: null })).status, 401);
    assert.equal((await write('POST', root, {}, randomUUID(), client, { origin: 'https://wrong.example', page: null })).status, 403);
    const ledger = world.workbench.migrations.appliedIds();
    for (let i = 0; i < 2; i++) {
      const jar = client.jar;
      await world.close(); world = await startRealMath({ directory });
      client = world.client(); client.jar = jar; client.pageId = randomUUID().replaceAll('-', '');
      assert.equal((await get(route)).status, 401);
      assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'restore', sessionId: session.id } })).status, 200);
      assert.deepEqual((await write('POST', root, input, key)).json, created.json);
      assert.deepEqual((await get(route)).json, changed.json);
      assert.deepEqual((await get(`${route}/versions/1`)).json.source, input.source);
      assert.deepEqual(world.workbench.migrations.appliedIds(), ledger);
      for (const record of exports) assert.equal((await get(`/api/workbench/files/${record.file.id}/content`)).status, 200);
    }
    const blob = world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(changed.json.render.posterFileId);
    // Locate only this isolated fixture's registered blob, never source trees.
    function find(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isDirectory()) { const result = find(p); if (result) return result; } else if (entry.name === blob.blobName) return p; } }
    const filename = find(directory); assert(filename);
    fs.renameSync(filename, filename + '.held');
    assert.equal((await get(route)).status, 503);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) AS n FROM math_works WHERE id=?').get(id).n, 1);
    fs.renameSync(filename + '.held', filename);
    assert.equal((await get(route)).status, 200);
    world.clock.advance(8 * 86400000);
    for (const url of routes) assert.equal((await get(url)).status, 401);
    fs.writeFileSync(path.join(evidence, 'real-api.json'), JSON.stringify({ scenarios: ['MC01','MC08','MC09','MC13'], identity: 'real-auth/fake-mail', restarts: 2, source: changed.json.source, rendererVersion: changed.json.rendererVersion, routes, missingFile: 503, expired: 401 }, null, 2));
    passed = true;
  } finally { await world.close(); if (passed) fs.rmSync(directory, { recursive: true, force: true }); }
});
