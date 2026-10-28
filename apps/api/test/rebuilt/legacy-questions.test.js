import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { extractLegacySource } from '../fixtures/legacy-source/extract.mjs';
import { startQuestionsFixture } from '../fixtures/questions/server.mjs';
import { doc, editable } from './helpers.js';

test('A-R4 固定R31题库：v1文稿和原路径成功回执跨升级/两次重启保留，旧重放不覆盖新稿', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuilt-r31-questions-'));
  let runtime;
  t.after(async () => { await runtime?.close(); if (t.passed) fs.rmSync(root, { recursive: true, force: true }); else console.error(`R31升级现场保留: ${root}`); });
  const source = extractLegacySource('r31-questions', path.join(root, 'source'));
  const { startFixture } = await import(pathToFileURL(path.join(source, 'scripts/materials/fixture.mjs')));
  const dataDir = path.join(root, 'data');
  runtime = await startFixture({ dataDir, port: 0 });
  // 旧版无真实认证模块，此兼容场景只使用它原有的可信测试身份。
  const request = async (method, route, body, key = randomUUID()) => {
    const response = await fetch(`http://localhost:${runtime.server.address().port}${route}`, {
      method, headers: { Cookie: runtime.workbench.identity.testPrincipalCookie('r31-a').header.split(';')[0],
        Origin: 'http://localhost:0', 'X-TeachBuddy-Request': '1', 'Content-Type': 'application/json', 'Idempotency-Key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  };
  const input = { title: '旧题原名', body: doc('R31原始题面'), solution: doc('原答案'), note: '原笔记', starred: true, source: { kind: 'paste', text: '固定原稿不可修改' } };
  const oldPath = '/api/modules/questions/items', key = randomUUID();
  const accepted = await request('POST', oldPath, input, key);
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  await runtime.close(); runtime = null;
  let latest;
  for (let restart = 0; restart < 2; restart++) {
    runtime = await startQuestionsFixture({ dataDir, port: 0, principals: ['r31-a'] });
    const read = await request('GET', `/api/modules/questions/v2/items/${accepted.body.id}`);
    assert.equal(read.status, 200);
    if (restart === 0) {
      assert.equal(read.body.version, 1);
      assert.deepEqual(read.body.body, input.body, '升级不重写v1原文稿');
      assert.deepEqual(read.body.source, input.source);
      assert.equal(read.body.note, input.note);
      assert.equal(read.body.typeId, null);
      assert.deepEqual(read.body.tagIds, []);
      const changed = await request('PUT', `/api/modules/questions/v2/items/${read.body.id}`, { ...editable(read.body), title: '当前新版修改', baseVersion: 1 });
      assert.equal(changed.status, 200);
      latest = changed.body;
    } else assert.deepEqual(read.body, latest, '第二次启动保留新版修改');
    assert.deepEqual(await request('POST', oldPath, input, key), accepted, '原路径原键必须返回原始成功回执');
    assert.deepEqual((await request('GET', `/api/modules/questions/v2/items/${accepted.body.id}`)).body, latest, '旧回执重放不覆盖当前内容');
    assert.equal((await request('GET', '/api/modules/questions/v2/items')).body.items.length, 1, '升级和旧重放不产生重复对象');
    await runtime.close(); runtime = null;
  }
});
