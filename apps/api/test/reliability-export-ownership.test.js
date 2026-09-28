import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { randomUUID, createHash } from 'node:crypto';
import JSZip from 'jszip';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { emptySource } from '../../web/src/features/math/model.js';
import { doc, question, http, Q } from './teaching-time-classes-materials-fixture.js';
import { replayRecognizer, sourceImage } from '../../web/e2e/fixtures/materials-questions/recognition/replay.mjs';
import { weeklyEntry, overrideContent } from './fixtures/teaching-time-schedule/samples.js';

const L = '/api/modules/lessons/v3', R = '/api/modules/resources/items';
const M = '/api/modules/math/v1/works', S = '/api/modules/schedule/entries';
async function download(world, client, call, id) {
  for (let n = 0; n < 300; n++) {
    const result = await call('GET', `/api/reliability/v1/exports/${id}`);
    if (result.state === 'failed') assert.fail(JSON.stringify(result));
    if (result.state === 'ready') {
      const bytes = await new Promise((resolve, reject) => {
        https.get(new URL(result.downloadPath, world.origin), { rejectUnauthorized: false, headers: {
          Cookie: client.jar.header(), 'X-TeachBuddy-Page': client.pageId,
        } }, response => {
          assert.equal(response.statusCode, 200);
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
          response.on('error', reject);
        }).on('error', reject);
      });
      const zip = await JSZip.loadAsync(bytes);
      return { bytes, zip, manifest: JSON.parse(await zip.file('manifest.json').async('string')) };
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Export timed out');
}

test('six-module export keeps stored values, account boundaries and a read-only acceptance snapshot', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'export-ownership-'));
  let instant = '2026-09-20T00:00:00Z';
  const world = await createIntegration({ directory, workbenchClock: () => new Date(instant) });
  let passed = false;
  try {
    const db = world.workbench.db;
    async function populate(email) {
      const { client, session } = await registerMath(world, email), call = http(client);
      const principal = { accountKey: session.account.accountKey };
      const store = text => world.workbench.files.store(principal, { name: 'source.txt', bytes: Buffer.from(text) }, { key: randomUUID(), method: 'POST', path: '/api/workbench/files' });
      const file = await store(email), replacement = await store(`${email} replacement`);
      const q = await call('POST', Q, question(email), 201);
      const resource = await call('POST', R, { title: email, fileId: file.id, folderId: null, tagIds: [], note: '' }, 201);
      let historical = await call('POST', R, { title: 'Replaced source', fileId: file.id, folderId: null, tagIds: [], note: '' }, 201);
      historical = await call('PUT', `${R}/${historical.id}/file`, { baseVersion: historical.version, fileId: replacement.id });
      const mathInput = { title: email, source: { ...emptySource('formula'), latex: 'x^2' } };
      let math = await call('POST', M, { ...mathInput, originalFileId: null }, 201);
      math = await call('PUT', `${M}/${math.id}`, { ...mathInput, source: { ...mathInput.source, latex: 'x^3' }, baseVersion: math.version });
      const mathExport = await call('POST', `${M}/${math.id}/exports`, { version: math.version, format: 'source', width: 1600, background: 'transparent' }, 201);
      const lesson = await call('POST', L, { title: email, intro: doc(email), sections: [], materials: [] }, 201);
      const classroom = await call('POST', '/api/modules/classes/items', { name: email }, 201);
      let record = await call('POST', '/api/modules/classes/v2/records', { classId: classroom.id, recordedOn: '2026-09-20', note: email, position: '', unfinished: '', commonIssues: '', nextNote: 'next', content: doc('丰富教学记录'), sources: [{ kind: 'question', id: q.id }] }, 201);
      record = await call('POST', `/api/modules/classes/v2/records/${record.id}/next-note-visibility`, { expectedVersion: record.version, hidden: true });
      let entry = await call('POST', S, weeklyEntry({ title: email, reminder: { side: 'before', minutes: 10 } }), 201);
      await call('PUT', `${S}/${entry.id}/exceptions/2026-09-28`, { expectedVersion: entry.version, mode: 'override', content: overrideContent() });
      entry = await call('GET', `${S}/${entry.id}`);
      return { client, call, principal, file, replacement, q, resource, historical, math, mathExport, mathInput, lesson, classroom, record, entry };
    }
    const a = await populate('ownership-a@example.test'), b = await populate('ownership-b@example.test');
    // Empty storage must stay distinct from UI defaults and virtual resource history.
    db.prepare('DELETE FROM resource_file_history WHERE resourceId=?').run(a.resource.id);
    db.prepare('DELETE FROM lesson_history WHERE lessonId=?').run(a.lesson.id);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM schedule_settings').get().n, 0);
    // Two already-settled notifications include a dismissed and a read item.
    const notification = db.prepare('INSERT INTO schedule_notifications VALUES (?,?,?,?,?,?,?,?)');
    for (const [origin, readAt, dismissedAt] of [['2026-09-07', instant, null], ['2026-09-14', null, instant]])
      notification.run(randomUUID(), a.principal.accountKey, a.entry.id, origin, origin, instant, readAt, dismissedAt);
    instant = '2026-09-22T00:00:00Z'; // the first armed occurrence is now due, but not settled
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'question%' OR name LIKE 'lesson_%' OR name LIKE 'resource_%' OR name LIKE 'math_%' OR name LIKE 'classes_%' OR name LIKE 'schedule_%') ORDER BY name").all().map(row => row.name);
    const business = () => Object.fromEntries(tables.map(name => [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]));
    const before = business();
    const accepted = await a.call('POST', '/api/reliability/v1/exports', {}, 202);
    assert.deepEqual(business(), before, 'acceptance must not write any business table');
    const settled = await a.call('GET', '/api/modules/schedule/notifications');
    assert(settled.items.some(item => item.key.originDate === '2026-09-21'), 'the due reminder existed but export did not settle it');
    const expectedExceptions = before.schedule_exceptions.filter(row => row.entryId === a.entry.id).map(row => ({ entryId: row.entryId, originDate: row.originDate, mode: row.mode, content: JSON.parse(row.contentJson), createdAt: row.createdAt, updatedAt: row.updatedAt }));
    await a.call('PUT', `${R}/${a.resource.id}/file`, { baseVersion: a.resource.version, fileId: a.replacement.id });
    await a.call('PUT', `${M}/${a.math.id}`, { ...a.mathInput, baseVersion: a.math.version });
    await a.call('PUT', `${S}/${a.entry.id}/exceptions/2026-09-28`, { expectedVersion: a.entry.version, mode: 'cancelled' });
    const { bytes, zip, manifest } = await download(world, a.client, a.call, accepted.id);
    const values = await Promise.all(manifest.objects.map(async object => ({ ...object.key, value: JSON.parse(await zip.file(object.dataPath).async('string')).value })));
    for (const [kind, expected] of [['question', a.q], ['resource', a.resource], ['math', a.math], ['lesson', a.lesson], ['class', a.classroom], ['record', a.record]])
      assert.deepEqual(values.find(item => item.kind === kind && item.id === expected.id)?.value, expected, kind);
    assert.deepEqual(values.find(item => item.kind === 'entry').value, { entry: a.entry, exceptions: expectedExceptions });
    for (const item of [b.q, b.resource, b.math, b.lesson, b.classroom, b.record, b.entry]) assert(!values.some(value => value.id === item.id));
    assert.deepEqual(values.filter(item => item.kind === 'math-revision').map(item => item.version), [1, 2]);
    const fileRevisions = values.filter(item => item.kind === 'resource-file-revision');
    assert.deepEqual(fileRevisions.map(item => item.version).sort(), [1, 2]);
    assert(fileRevisions.every(item => item.id === a.historical.id));
    assert.equal(fileRevisions.find(item => item.version === 1).value.fileId, a.file.id);
    assert.equal(fileRevisions.find(item => item.version === 2).value.fileId, a.replacement.id);
    const supplemental = JSON.parse(await zip.file('data/supplemental.json').async('string'));
    assert.deepEqual(supplemental.mathExports, [a.mathExport]);
    assert.equal(values.filter(item => item.kind === 'lesson-revision').length, 1);
    assert.equal(values.filter(item => item.kind === 'notification').length, 2);
    assert(values.some(item => item.kind === 'notification' && item.value.dismissedAt));
    assert(values.some(item => item.kind === 'notification' && item.value.readAt));
    for (const kind of ['resource-taxonomy', 'schedule-settings']) assert(!values.some(item => item.kind === kind), kind);
    assert.deepEqual(values.find(item => item.kind === 'question-taxonomy').value, { version: 1, types: [], tags: [] });
    assert(manifest.relations.every(relation => manifest.objects.some(object => JSON.stringify(object.key) === JSON.stringify(relation.to))));
    for (const file of manifest.files) {
      const data = await zip.file(file.path).async('nodebuffer');
      assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256);
    }
    if (process.env.EXPORT_OWNERSHIP_EVIDENCE) {
      const destination = path.resolve(process.env.EXPORT_OWNERSHIP_EVIDENCE);
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(path.join(destination, 'candidate.zip'), bytes);
      for (const file of Object.values(zip.files).filter(file => !file.dir)) {
        const target = path.join(destination, 'unpacked', file.name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, await file.async('nodebuffer'));
      }
    }
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});


test('cancelled extraction keeps each attempt’s late OCR evidence and managed attachments after retry', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'export-late-'));
  const replay = await replayRecognizer();
  let entered, release, calls = 0;
  const started = new Promise(resolve => { entered = resolve; });
  // Replay validates captured input pixels. The first completed response waits
  // across cancellation to reproduce a provider returning after abort.
  const recognizer = { revision: replay.revision, async run(input) {
    const result = await replay.run(input);
    if (++calls === 1) {
      const gate = new Promise(resolve => { release = resolve; });
      entered();
      await gate;
    }
    return result;
  } };
  const world = await createIntegration({ directory, workbench: { recognition: { recognizer } } });
  let passed = false;
  try {
    const { client, session } = await registerMath(world, 'late-export@example.test'), call = http(client);
    const file = await world.workbench.files.store({ accountKey: session.account.accountKey },
      { name: 'scan.png', bytes: sourceImage('I-1') }, { key: randomUUID(), method: 'POST', path: '/api/workbench/files' });
    const imported = await call('POST', '/api/modules/questions/v2/imports', {
      title: 'Cancelled captured scan', origin: '', input: { kind: 'files', fileIds: [file.id], pages: [] },
    }, 201);
    await started;
    await call('POST', `/api/workbench/jobs/${imported.jobId}/cancel`, {});
    release();
    async function finish(id) {
      for (let n = 0; n < 300; n++) {
        const job = await call('GET', `/api/workbench/jobs/${id}`);
        if (!['queued', 'running', 'cancelling'].includes(job.state)) return job;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.fail('Extraction did not finish');
    }
    assert.equal((await finish(imported.jobId)).state, 'cancelled');
    const db = world.workbench.db;
    const old = JSON.parse(db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?').get(imported.jobId).value);
    assert(Object.keys(old.lateResults).length > 0);
    const retried = await call('POST', `/api/workbench/jobs/${imported.jobId}/retry`, { unitIds: [] }, 202);
    assert.equal((await finish(retried.id)).state, 'succeeded');
    assert.equal((await call('GET', `/api/modules/questions/v2/imports/${imported.id}`)).jobId, retried.id);
    const accepted = await call('POST', '/api/reliability/v1/exports', {}, 202);
    const { zip, manifest } = await download(world, client, call, accepted.id);
    const supplemental = JSON.parse(await zip.file('data/supplemental.json').async('string'));
    const evidence = supplemental.questionRecognitionEvidence.find(item => item.jobId === imported.jobId);
    assert.deepEqual(evidence, { jobId: imported.jobId, importId: imported.id, lateResults: old.lateResults });
    for (const result of Object.values(evidence.lateResults)) {
      assert.equal(result.source.fileId, file.id);
      assert.equal(result.source.page, 1);
      assert(result.originalAssetFileIds.length > 0);
      assert(result.derivations.length > 0);
      for (const id of [result.rawFileId, ...result.assetFileIds, ...result.originalAssetFileIds]) {
        const attachment = manifest.files.find(item => item.path.startsWith(`files/${id}/`));
        assert(attachment, id);
        const bytes = await zip.file(attachment.path).async('nodebuffer');
        assert.equal(createHash('sha256').update(bytes).digest('hex'), attachment.sha256);
      }
    }
    passed = true;
  } finally {
    release?.();
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('personal export retains persisted lesson output and its accepted snapshot independently of job display state', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'export-lesson-output-'));
  const world = await createIntegration({ directory });
  let passed = false;
  try {
    const { client } = await registerMath(world, 'output-export@example.test'), call = http(client);
    const lesson = await call('POST', L, { title: '保存输出', intro: doc('受理时文稿'), sections: [], materials: [] }, 201);
    const output = await call('POST', `${L}/${lesson.id}/exports`, {
      baseVersion: lesson.version, kind: 'lesson-plan', format: 'docx', includeAnswers: false,
      includeTeacherNotes: false, sectionIds: [], materialReferenceIds: [], answerSpaceLines: 0,
    }, 202);
    let job;
    for (let n = 0; n < 300; n++) {
      job = await call('GET', `/api/workbench/jobs/${output.jobId}`);
      if (!['queued', 'running', 'cancelling'].includes(job.state)) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(job.state, 'succeeded', JSON.stringify(job));
    const db = world.workbench.db;
    const stored = db.prepare('SELECT record,snapshot FROM lesson_exports WHERE id=?').get(output.id);
    const expected = JSON.parse(stored.record);
    assert(expected.fileId);
    // A saved output can outlive its job's succeeded display state. The archive
    // preserves the stored record, while the normal list intentionally hides it.
    db.prepare('UPDATE materials_jobs SET value=? WHERE id=?').run(JSON.stringify({ ...job, state: 'failed' }), job.id);
    assert.equal((await call('GET', `${L}/${lesson.id}/exports`)).items[0].fileId, null);
    const accepted = await call('POST', '/api/reliability/v1/exports', {}, 202);
    const { zip, manifest } = await download(world, client, call, accepted.id);
    const entry = manifest.objects.find(item => item.key.kind === 'lesson-export');
    assert.deepEqual(JSON.parse(await zip.file(entry.dataPath).async('string')).value, expected);
    const supplemental = JSON.parse(await zip.file('data/supplemental.json').async('string'));
    assert.deepEqual(supplemental.lessonExportSnapshots, [{ id: expected.id, snapshot: JSON.parse(stored.snapshot) }]);
    const attachment = manifest.files.find(file => file.path.startsWith(`files/${expected.fileId}/`));
    const document = await JSZip.loadAsync(await zip.file(attachment.path).async('nodebuffer'));
    assert((await document.file('word/document.xml').async('string')).includes('受理时文稿'));
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});
