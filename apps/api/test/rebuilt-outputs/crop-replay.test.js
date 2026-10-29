import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createIntegration } from '../support/application.js';
import { application, upload, preview, json, download, filesPath } from './helpers.js';

test('裁图公共回执保护并发同键、异体冲突、失败键重用及无rendition跨重启重放', async t => {
  const world = await application(t);
  const send = world.client.request.bind(world.client);
  world.client.request = (method, url, options = {}) => send(method, url, { ...options,
    headers: { Connection: 'close', ...options.headers } });
  const file = await upload(world.client, '裁图.png', fs.readFileSync('test/fixtures/questions/recognition/I-1/page.png'));
  const view = await preview(world.client, file.id);
  const endpoint = `${filesPath}/crops`, key = randomUUID();
  const input = { location: { kind: 'page', fileId: file.id, renditionFileId: view.renditionFileId, page: 1,
    box: { x: 0, y: 0, width: .5, height: .5 } } };
  const request = (body, requestKey) => world.client.request('POST', endpoint, { body, headers: { 'Idempotency-Key': requestKey } });
  const [first, same] = await Promise.all([request(input, key), request(input, key)]);
  assert.equal(first.status, 201); assert.equal(same.status, 201);
  assert.deepEqual(first.json, same.json);
  const changed = structuredClone(input); changed.location.box.x = .1;
  const raceKey = randomUUID();
  const raced = await Promise.all([request(input, raceKey), request(changed, raceKey)]);
  assert.deepEqual(raced.map(response => response.status).sort(), [201, 409]);
  const failedKey = randomUUID(), invalid = structuredClone(input); invalid.location.page = 2;
  assert.equal((await request(invalid, failedKey)).status, 422);
  assert.equal((await request(input, failedKey)).status, 201);
  assert.equal((await request(changed, key)).status, 409);
  world.workbench.db.prepare('DELETE FROM materials_renditions WHERE fileId=?').run(file.id);
  assert.deepEqual(await json(world.client, 'POST', endpoint, input, 201, key), first.json);
  const bytes = await download(world.client, first.json.id);
  const port = Number(new URL(world.origin).port);
  await world.close();
  const reopened = await createIntegration({ directory: world.directory, port });
  try {
    assert.deepEqual(await json(world.client, 'POST', endpoint, input, 201, key), first.json);
    assert.deepEqual(await download(world.client, first.json.id), bytes);
    assert.equal((await request(changed, key)).status, 409);
    world.complete();
  } finally { await reopened.close(); }
});
