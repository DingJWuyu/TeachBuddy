import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createWorld, register, ok, problem, questions, question, doc, editable, write } from './helpers.js';

test('保存：并发原键只创建一次，旧提交跨重启重放且不覆盖新版，账户内键绑定完整请求', async t => {
  const world = await createWorld(t);
  const a = await register(world);
  const b = await register(world);
  const key = randomUUID();
  const body = question();
  const replies = await Promise.all(Array.from({ length: 3 }, () => write(a.client, 'POST', questions, body, key)));
  const first = ok(replies[0], 201);
  for (const response of replies) assert.deepEqual(ok(response, 201), first, '并发重放返回原 ID 和版本');
  assert.equal(ok(await a.client.request('GET', questions)).items.length, 1, '只生成一份题目');
  const changed = ok(await write(a.client, 'PUT', `${questions}/${first.id}`, { ...editable(first), baseVersion: 1, note: '后来写入' }));
  assert.equal(changed.version, 2);
  problem(await write(a.client, 'POST', questions, { ...body, title: '变体' }, key), 409, 'idempotency-key-reused');
  const sameKeyOtherAccount = ok(await write(b.client, 'POST', questions, body, key), 201);
  assert.notEqual(sameKeyOtherAccount.id, first.id, '幂等键以可信账户为作用域');
  await world.restart();
  assert.deepEqual(ok(await write(a.client, 'POST', questions, body, key), 201), first, '进程重启保留原回执');
  assert.equal(ok(await a.client.request('GET', `${questions}/${first.id}`)).note, '后来写入', '重放原回执不能回写旧内容');
});

test('保存：冲突和非法请求不写入或消耗键，SQLite 提交失败同键可重试', async t => {
  const world = await createWorld(t);
  const { client } = await register(world);
  const first = ok(await write(client, 'POST', questions, question()), 201);
  const url = `${questions}/${first.id}`;
  const update = { ...editable(first), baseVersion: 1, note: '新笔记' };
  ok(await write(client, 'PUT', url, update));
  const retryKey = randomUUID();
  problem(await write(client, 'PUT', url, { ...update, note: '旧设备' }, retryKey), 409, 'version-conflict', { currentVersion: 2 });
  assert.equal(ok(await client.request('GET', url)).note, '新笔记', '冲突保留服务器数据');
  const revised = ok(await write(client, 'PUT', url, { ...update, baseVersion: 2, note: '老师整合' }, retryKey));
  assert.equal(revised.version, 3, '失败请求未消耗幂等键');
  const key = randomUUID();
  problem(await write(client, 'POST', questions, question({ unexpected: true }), key), 422, 'invalid-input');
  world.app.workbench.db.exec("CREATE TRIGGER rebuilt_reject_receipt BEFORE INSERT ON workbench_mutation_keys BEGIN SELECT RAISE(ABORT, 'receipt write failed'); END");
  problem(await write(client, 'POST', questions, question(), key), 503, 'temporarily-unavailable');
  assert.equal(ok(await client.request('GET', questions)).items.length, 1, '回执落库失败必须回滚业务创建');
  world.app.workbench.db.exec('DROP TRIGGER rebuilt_reject_receipt');
  ok(await write(client, 'POST', questions, question(), key), 201);
  assert.equal(ok(await client.request('GET', questions)).items.length, 2);
});

test('题库：改编固定来源快照和独立 ID，分类变化升版，搜索范围明确，归档恢复与永久删除保留采用事实', async t => {
  const world = await createWorld(t);
  const { client } = await register(world);
  const taxonomyUrl = '/api/modules/questions/v2/taxonomy';
  const type = { id: randomUUID(), name: '函数' }, tag = { id: randomUUID(), name: '零点' };
  ok(await write(client, 'PUT', taxonomyUrl, { baseVersion: 1, types: [type], tags: [tag] }));
  const original = ok(await write(client, 'POST', questions, question({ note: '个人笔记ONLYNOTE', starred: true, typeId: type.id, tagIds: [tag.id], solution: doc('ONLYANSWER') })), 201);
  const copy = ok(await write(client, 'POST', `${questions}/${original.id}/copies`, { ...editable(original), title: '改编题', body: doc('改编后的题面'), note: '', starred: false, baseVersion: 1 }), 201);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.note, '');
  assert.equal(copy.starred, false);
  assert.equal(copy.source.questionId, original.id);
  assert.equal(copy.source.questionVersion, 1);
  const source = structuredClone(copy.source);
  assert.equal(ok(await client.request('GET', `${questions}/${original.id}/copies`)).items[0].id, copy.id);
  assert.equal(ok(await client.request('GET', `${questions}?q=ONLYANSWER`)).items.length, 0, '默认搜索不含答案');
  assert.equal(ok(await client.request('GET', `${questions}?q=ONLYNOTE`)).items[0].id, original.id);
  const updated = ok(await write(client, 'PUT', `${questions}/${original.id}`, { ...editable(original), body: doc('原题已修改'), baseVersion: 1 }));
  assert.equal(updated.id, original.id, '直接修改保持原 ID');
  assert.deepEqual(ok(await client.request('GET', `${questions}/${copy.id}`)).source, source, '原题修改不改变已采用快照');
  problem(await write(client, 'POST', `${questions}/${original.id}/copies`, { ...editable(original), baseVersion: 1 }), 409, 'version-conflict');
  ok(await write(client, 'PUT', taxonomyUrl, { baseVersion: 2, types: [], tags: [] }));
  const reclassified = ok(await client.request('GET', `${questions}/${copy.id}`));
  assert.equal(reclassified.typeId, null);
  assert.deepEqual(reclassified.tagIds, []);
  assert.equal(reclassified.version, copy.version + 1, '分类删除推进受影响对象版本');
  let archived = ok(await write(client, 'POST', `${questions}/${original.id}/deletion`, { baseVersion: 3, deleted: true }));
  assert.equal(ok(await client.request('GET', `${questions}?state=deleted`)).items[0].id, original.id);
  problem(await write(client, 'PUT', `${questions}/${original.id}`, { ...editable(updated), baseVersion: archived.version }), 409, 'object-deleted');
  const restored = ok(await write(client, 'POST', `${questions}/${original.id}/deletion`, { baseVersion: archived.version, deleted: false }));
  assert.equal(restored.id, original.id);
  assert.equal(restored.version, archived.version + 1);
  archived = ok(await write(client, 'POST', `${questions}/${original.id}/deletion`, { baseVersion: restored.version, deleted: true }));
  ok(await write(client, 'POST', `${questions}/${original.id}/purge`, { baseVersion: archived.version }));
  problem(await client.request('GET', `${questions}/${original.id}`), 404, 'not-found');
  assert.deepEqual(ok(await client.request('GET', `${questions}/${copy.id}`)).source, source, '永久删除来源仍保留改编快照');
});

test('账户隔离：对象查询、写入、来源、复制和客户端自报账户均不能越界', async t => {
  const world = await createWorld(t);
  const a = await register(world), b = await register(world);
  const first = ok(await write(a.client, 'POST', questions, question()), 201);
  const url = `${questions}/${first.id}`;
  for (const [method, suffix, body] of [
    ['GET', '', undefined], ['GET', '/copies', undefined], ['GET', '/for-reference', undefined],
    ['PUT', '', { ...editable(first), baseVersion: 1 }],
    ['POST', '/copies', { ...editable(first), baseVersion: 1 }],
    ['POST', '/deletion', { baseVersion: 1, deleted: true }]
  ]) {
    const response = method === 'GET' ? await b.client.request(method, url + suffix) : await write(b.client, method, url + suffix, body);
    problem(response, 404, 'not-found');
  }
  assert.deepEqual(ok(await b.client.request('GET', questions, { headers: { 'X-Account-Id': a.account.accountKey, Authorization: `Bearer ${a.account.accountKey}` } })).items, []);
  assert.equal(ok(await a.client.request('GET', url)).version, 1);
});
