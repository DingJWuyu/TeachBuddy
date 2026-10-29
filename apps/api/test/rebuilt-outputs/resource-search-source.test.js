import test from 'node:test';
import assert from 'node:assert/strict';
import { application, upload, json } from './helpers.js';

test('纯文本原生命中固定真实文件且页码为null，替换后不复用旧正文', async t => {
  const world = await application(t);
  const file = await upload(world.client, 'plain.txt', Buffer.from('immutable uniqueneedle source'));
  const resource = await json(world.client, 'POST', '/api/modules/resources/items', {
    title: '纯文本来源', fileId: file.id, folderId: null, tagIds: [], note: '',
  }, 201);
  const result = await json(world.client, 'GET', '/api/modules/resources/items?q=uniqueneedle');
  assert.equal(result.search.matches[resource.id].page, null);
  assert.deepEqual(result.search.matches[resource.id].native, { fileId: file.id, textFileId: file.id, renditionFileId: null });
  const newer = await upload(world.client, 'new.txt', Buffer.from('replacement without target'));
  await json(world.client, 'PUT', `/api/modules/resources/items/${resource.id}/file`, { baseVersion: resource.version, fileId: newer.id });
  assert.equal((await json(world.client, 'GET', '/api/modules/resources/items?q=uniqueneedle')).items.length, 0);
  world.complete();
});
