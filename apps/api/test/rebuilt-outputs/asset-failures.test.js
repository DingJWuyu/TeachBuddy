import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { application, json, finished, download, document } from './helpers.js';

import { questions, question } from '../rebuilt/helpers.js';
async function generate(client, item) {
  const job = await json(client, 'POST', `${questions}/${item.id}/assets`, {
    baseVersion: item.version, mode: 'question-png', includeAnswers: false, figureFileId: null,
  }, 202);
  return finished(client, job.id);
}

test('题面素材通过真实 HTTP 区分公式、浏览器与文件落库失败，恢复后明确重新生成', async t => {
  const diagnostics = [];
  const world = await application(t, { logger: { info() {}, request() {}, error(scope, error) {
    diagnostics.push({ scope, message: error.message, code: error.code });
  } } });
  const create = body => json(world.client, 'POST', questions, question({ body, title: '素材故障隔离' }), 201);
  const valid = await create(document('有效的纯文本题面'));
  const formula = await create({ version: 2, blocks: [{ type: 'math', latex: '\\unknownProbeCommand{x}' }] });
  const launch = chromium.launch;
  let browser;
  chromium.launch = async () => { throw Error('/private/path?token=secret 有效的纯文本题面'); };
  try { browser = await generate(world.client, valid); } finally { chromium.launch = launch; }
  assert.equal(browser.state, 'failed');
  assert.deepEqual(browser.outputFileIds, []);
  assert.equal(browser.issues[0].code, 'asset-render-failed');
  assert.equal(browser.issues[0].field, null);
  const recoveredBrowser = await generate(world.client, valid);
  assert.equal(recoveredBrowser.state, 'succeeded');
  assert.ok((await download(world.client, recoveredBrowser.outputFileIds[0])).length);
  world.workbench.db.exec("CREATE TRIGGER asset_test_storage BEFORE INSERT ON materials_files BEGIN SELECT RAISE(ABORT,'/private/storage secret'); END");
  let storage;
  try { storage = await generate(world.client, valid); }
  finally { world.workbench.db.exec('DROP TRIGGER asset_test_storage'); }
  assert.equal(storage.state, 'failed');
  assert.deepEqual(storage.outputFileIds, []);
  assert.equal(storage.issues[0].code, 'asset-storage-failed');
  assert.equal(storage.issues[0].field, null);
  assert.equal((await generate(world.client, valid)).state, 'succeeded');
  for (let attempt = 0; attempt < 2; attempt++) {
    const invalid = await generate(world.client, formula);
    assert.equal(invalid.state, 'failed');
    assert.deepEqual(invalid.outputFileIds, []);
    assert.equal(invalid.issues[0].code, 'unsupported-formula');
    assert.equal(invalid.issues[0].field, '/body');
  }
  for (const [job, stage] of [[browser, 'browser-start'], [storage, 'output-store']]) {
    assert.ok(diagnostics.some(d => d.scope.includes(job.id) && d.message.includes(`stage=${stage}`)));
  }
  assert.ok(diagnostics.some(d => d.message.includes('stage=formula')));
  assert.doesNotMatch(JSON.stringify(diagnostics), /private|secret|有效的纯文本|unknownProbeCommand/);
  assert.doesNotMatch(JSON.stringify([browser.issues, storage.issues]), /private|secret|有效的纯文本/);
  world.complete();
});
