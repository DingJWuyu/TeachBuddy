import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { startMaterialsHttp } from '../../web/e2e/fixtures/materials-integration/server.mjs';

const doc = (text = '') => ({ version: 2, blocks: text ? [{ type: 'paragraph', runs: [{ type: 'text', text }] }] : [] });
const future = { version: 99, blocks: [{ type: 'future-node', payload: { text: '完整保留', opaque: [1, { future: true }] } }] };

test('stored future Documents reject deletion and replacement atomically through question v2 HTTP', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'materials-protection-'));
  const world = await startMaterialsHttp(directory);
  const db = new Database(path.join(directory, 'workspace.sqlite'));
  t.after(async () => {
    db.close(); await world.close();
    if (t.passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.log('保留文稿保护测试现场：' + directory);
  });
  async function call(route, method = 'GET', input, key = randomUUID(), who = 'integration-a') {
    const response = await fetch(world.origin + route, { method, headers: {
      Cookie: world.workbench.identity.testPrincipalCookie(who).header.split(';')[0],
      Origin: 'http://localhost', 'X-TeachBuddy-Request': '1', 'Idempotency-Key': key, 'Content-Type': 'application/json',
    }, ...(input ? { body: JSON.stringify(input) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const questionInput = { title: '版本保护题', body: doc('题干'), solution: doc('答案'), answerStatus: 'present', note: '', starred: false, typeId: null, tagIds: [], source: { kind: 'manual' } };
  const qbase = '/api/modules/questions/v2/items';
  const source = await call(qbase, 'POST', questionInput);
  assert.equal(source.status, 201);
  for (const location of ['body', 'solution', 'source', 'noteFragments']) {
    const created = await call(qbase, 'POST', questionInput);
    const id = created.body.id;
    const value = location === 'source' ? { kind: 'copy', questionId: source.body.id, questionVersion: 1, snapshot: { title: '原题', body: future, solution: doc(), answerStatus: 'absent' } } : future;
    if (location === 'noteFragments') {
      const row = db.prepare('SELECT value FROM questions_materials_meta WHERE id=?').get(id);
      const meta = { ...JSON.parse(row.value), noteFragments: [{ id: randomUUID(), importId: randomUUID(), document: future, locations: [{ kind: 'text', start: 0, end: 1 }] }] };
      db.prepare('UPDATE questions_materials_meta SET value=? WHERE id=?').run(JSON.stringify(meta), id);
    } else db.prepare(`UPDATE question_items SET ${location}=? WHERE id=?`).run(JSON.stringify(value), id);
    const metadata = db.prepare('SELECT value FROM questions_materials_meta WHERE id=?').get(id);
    const before = db.prepare('SELECT * FROM question_items WHERE id=?').get(id);
    assert.equal((await call(qbase + '/' + id)).status, 200);
    const { source: omitted, ...fields } = questionInput;
    for (const [method, suffix, input] of [
      ['PUT', '', { ...fields, baseVersion: 1 }],
      ['POST', '/deletion', { baseVersion: 1, deleted: true }],
      ['POST', '/copies', { ...fields, baseVersion: 1 }],
    ]) {
      const result = await call(qbase + '/' + id + suffix, method, input);
      assert.equal(result.status, 422, JSON.stringify({ location, result }));
      assert.equal(result.body.reason, 'unsupported-content-version');
      assert.deepEqual(db.prepare('SELECT * FROM question_items WHERE id=?').get(id), before);
      assert.deepEqual(db.prepare('SELECT value FROM questions_materials_meta WHERE id=?').get(id), metadata);
    }
    assert.equal((await call(qbase + '/' + id, 'PUT', { ...fields, baseVersion: 9 })).status, 409);
    assert.equal((await call(qbase + '/' + id, 'PUT', { ...fields, baseVersion: 1 }, randomUUID(), 'integration-b')).status, 404);
  }
  const { source: omitted, ...fields } = questionInput;
  assert.equal((await call(qbase + '/' + source.body.id, 'PUT', { ...fields, title: '正常修改', baseVersion: 1 })).status, 200);
  assert.equal((await call(qbase + '/' + source.body.id + '/deletion', 'POST', { baseVersion: 2, deleted: true })).status, 200);
  assert.equal((await call(qbase + '/' + source.body.id + '/deletion', 'POST', { baseVersion: 3, deleted: false })).status, 200);

  const tag = randomUUID();
  assert.equal((await call('/api/modules/questions/v2/taxonomy', 'PUT', { baseVersion: 1, types: [], tags: [{ id: tag, name: '保护标签' }] })).status, 200);
  const tagged = await call(qbase, 'POST', { ...questionInput, tagIds: [tag] });
  db.prepare('UPDATE question_items SET solution=? WHERE id=?').run(JSON.stringify(future), tagged.body.id);
  const before = db.prepare('SELECT * FROM question_items WHERE id=?').get(tagged.body.id);
  const taxonomy = await call('/api/modules/questions/v2/taxonomy');
  const rejected = await call('/api/modules/questions/v2/taxonomy', 'PUT', { baseVersion: 2, types: [], tags: [] });
  assert.equal(rejected.status, 422);
  assert.deepEqual(await call('/api/modules/questions/v2/taxonomy'), taxonomy);
  assert.deepEqual(db.prepare('SELECT * FROM question_items WHERE id=?').get(tagged.body.id), before);
  // An already deleted future object is also read-only, including restoration.
  db.prepare('UPDATE question_items SET deletedAt=? WHERE id=?').run('2026-01-01T00:00:00.000Z', tagged.body.id);
  assert.equal((await call(qbase + '/' + tagged.body.id + '/deletion', 'POST', { baseVersion: 1, deleted: false })).status, 422);
  assert.equal(db.prepare('SELECT solution FROM question_items WHERE id=?').get(tagged.body.id).solution, JSON.stringify(future));
});
