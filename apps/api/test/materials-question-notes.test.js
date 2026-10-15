import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startQuestionsFixture } from './fixtures/questions/server.mjs';

const doc = text => ({ version: 2, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text }] }] });
const writable = q => Object.fromEntries(['title', 'body', 'solution', 'answerStatus', 'note', 'starred', 'typeId', 'tagIds'].map(key => [key, q[key]]));
async function environment(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'question-notes-'));
  let passed = false;
  let runtime = await startQuestionsFixture({ dataDir: directory, port: 0 });
  t.after(async () => {
    await runtime.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  });
  const call = async (route, body, method = 'POST', account = 'r33-a') => {
    const response = await fetch(`http://localhost:${runtime.server.address().port}${route}`, {
      method,
      headers: {
        Cookie: runtime.workbench.identity.testPrincipalCookie(account).header.split(';')[0],
        Origin: 'http://localhost:0', 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID(),
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const q = (route, ...args) => call('/api/modules/questions/v2' + route, ...args);
  return { q, call, passed: () => { passed = true; },
    async restart() { await runtime.close(); runtime = await startQuestionsFixture({ dataDir: directory, port: 0 }); },
    async material() {
      const created = await q('/imports', { title: '归入笔记', origin: '', input: { kind: 'text', text: '1. 求一加一。\n2. 求二加二。\n教师活动：讨论不同解法。' } });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      for (let n = 0; n < 200; n++) {
        const job = (await call('/api/workbench/jobs/' + created.body.jobId, null, 'GET')).body;
        if (!['queued', 'running', 'cancelling'].includes(job.state)) {
          assert.equal(job.state, 'succeeded', JSON.stringify(job));
          return (await q('/imports/' + created.body.id, null, 'GET')).body;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw Error('Import timed out');
    },
  };
}
function review(material, document = doc('保留的教学提示')) {
  const m = structuredClone(material), f = m.fragments[0];
  assert.ok(f);
  m.drafts[0].noteFragments = [{ id: f.id, importId: m.id, document, locations: f.locations }];
  f.disposition = 'assigned';
  for (const d of m.drafts) for (const issue of d.issues) issue.resolution = 'corrected';
  return { baseVersion: m.version, drafts: m.drafts, fragments: m.fragments };
}

test('import list reports job state and adopted notes survive old clients, restart, commit and source purge', async t => {
  const e = await environment(t), m = await e.material();
  const listing = await e.q('/imports', null, 'GET');
  assert.equal(listing.body.items[0].jobState, 'succeeded');
  const png = fs.readFileSync(new URL('../../../test/fixtures/questions/figure.png', import.meta.url));
  const form = new FormData(); form.append('file', new Blob([png]), 'note.png');
  const uploaded = await e.call('/api/workbench/files', form);
  assert.equal(uploaded.status, 201);
  const rich = { version: 2, blocks: [
    ...doc('私有提示').blocks,
    { type: 'table', rows: [[{ blocks: [{ type: 'math', latex: 'q_{note}+7' }] }]] },
    { type: 'image', fileId: uploaded.body.id, alt: '笔记配图', widthMm: 40 },
  ] };
  let saved = await e.q('/imports/' + m.id, review(m, rich), 'PUT');
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const notes = saved.body.drafts[0].noteFragments;
  let oldClient = structuredClone(saved.body.drafts);
  delete oldClient[0].noteFragments;
  saved = await e.q('/imports/' + m.id, { baseVersion: saved.body.version, drafts: oldClient, fragments: saved.body.fragments }, 'PUT');
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.deepEqual(saved.body.drafts[0].noteFragments, notes);
  await e.restart();
  assert.deepEqual((await e.q('/imports/' + m.id, null, 'GET')).body.drafts[0].noteFragments, notes);
  const committed = await e.q('/imports/' + m.id + '/commit', { baseVersion: saved.body.version, draftIds: [m.drafts[0].id] });
  assert.equal(committed.status, 200, JSON.stringify(committed.body));
  let q = committed.body.questions[0];
  assert.deepEqual(q.noteFragments, notes);
  oldClient = structuredClone(committed.body.import.drafts); delete oldClient[0].noteFragments;
  const confirmed = await e.q('/imports/' + m.id, { baseVersion: committed.body.import.version, drafts: oldClient, fragments: committed.body.import.fragments }, 'PUT');
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  const updated = await e.q('/items/' + q.id, { ...writable(q), note: '手写备注', baseVersion: q.version }, 'PUT');
  assert.equal(updated.status, 200, JSON.stringify(updated.body)); q = updated.body;
  assert.deepEqual(q.noteFragments, notes);
  assert.equal((await e.q('/items?q=q_%7Bnote%7D', null, 'GET')).body.items[0].id, q.id);
  assert.equal((await e.q('/items/' + q.id, null, 'GET', 'r33-b')).status, 404);
  const reference = await e.q('/items/' + q.id + '/for-reference', null, 'GET');
  assert.equal(reference.status, 200, JSON.stringify(reference.body));
  assert.equal(reference.body.snapshot.noteFragments, undefined);
  const figure = await e.q('/items/' + q.id + '/assets', { baseVersion: q.version, mode: 'figure-png', includeAnswers: false, figureFileId: uploaded.body.id });
  assert.equal(figure.status, 422);
  const copied = await e.q('/items/' + q.id + '/copies', { ...writable(q), note: '', baseVersion: q.version });
  assert.equal(copied.status, 201, JSON.stringify(copied.body));
  assert.equal(copied.body.note, ''); assert.equal(copied.body.noteFragments?.length ?? 0, 0);
  const archived = await e.q('/imports/' + m.id + '/deletion', { baseVersion: confirmed.body.version, deleted: true });
  assert.equal(archived.status, 200);
  assert.equal((await e.q('/imports/' + m.id + '/purge', { baseVersion: archived.body.version })).status, 200);
  await e.restart();
  q = (await e.q('/items/' + q.id, null, 'GET')).body;
  assert.deepEqual(q.noteFragments, notes);
  const edited = [{ ...notes[0], document: doc('修改后的提示') }];
  const edit = await e.q('/items/' + q.id, { ...writable(q), baseVersion: q.version, noteFragments: edited }, 'PUT');
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.deepEqual(edit.body.noteFragments, edited);
  const cleared = await e.q('/items/' + q.id, { ...writable(edit.body), baseVersion: edit.body.version, noteFragments: [] }, 'PUT');
  assert.equal(cleared.status, 200); assert.deepEqual(cleared.body.noteFragments, []);
  e.passed();
});

test('note assignment rejects forged sources, duplicate adoption and foreign images', async t => {
  const e = await environment(t), m = await e.material(), input = review(m);
  for (const mutate of [
    x => { x.drafts[0].noteFragments[0].id = randomUUID(); },
    x => { x.drafts[0].noteFragments[0].importId = randomUUID(); },
    x => { x.drafts[0].noteFragments[0].locations[0].end--; },
    x => { x.drafts[1].noteFragments = x.drafts[0].noteFragments; },
    x => { x.fragments[0].disposition = 'unassigned'; },
  ]) {
    const bad = structuredClone(input); mutate(bad);
    assert.equal((await e.q('/imports/' + m.id, bad, 'PUT')).status, 422);
  }
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(new URL('../../../test/fixtures/questions/figure.png', import.meta.url))]), 'foreign.png');
  const file = await e.call('/api/workbench/files', form, 'POST', 'r33-b');
  const bad = structuredClone(input);
  bad.drafts[0].noteFragments[0].document = { version: 2, blocks: [{ type: 'image', fileId: file.body.id, alt: '', widthMm: 40 }] };
  assert.equal((await e.q('/imports/' + m.id, bad, 'PUT')).status, 404);
  const saved = await e.q('/imports/' + m.id, input, 'PUT');
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const committed = await e.q('/imports/' + m.id + '/commit', { baseVersion: saved.body.version, draftIds: [m.drafts[0].id] });
  const q = committed.body.questions[0];
  for (const mutate of [
    n => { n[0].id = randomUUID(); },
    n => { n[0].importId = randomUUID(); },
    n => { n[0].locations[0].end--; },
    n => { n.push(structuredClone(n[0])); },
  ]) {
    const notes = structuredClone(q.noteFragments); mutate(notes);
    assert.equal((await e.q('/items/' + q.id, { ...writable(q), baseVersion: q.version, noteFragments: notes }, 'PUT')).status, 422);
  }
  e.passed();
});
