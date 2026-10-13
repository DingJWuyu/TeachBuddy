import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import JSZip from 'jszip';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { doc, paragraph, http, Q } from './teaching-time-classes-materials-fixture.js';
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';

const evidence = path.resolve('test-results/questions-core/notes-reliability');
const imports = '/api/modules/questions/v2/imports';
const email = 'question-notes@example.test';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function until(read, done) {
  for (let n = 0; n < 300; n++) {
    const result = await read();
    if (done(result)) return result;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Question note integration timed out');
}

async function upload(client, png, name = 'note.png') {
  const boundary = `notes-${randomUUID()}`;
  const response = await client.request('POST', '/api/workbench/files', {
    headers: { 'Idempotency-Key': randomUUID() },
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),
      png, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json.id;
}

async function prepare(t) {
  fs.mkdirSync(evidence, { recursive: true });
  const directory = fs.mkdtempSync(path.join(evidence, 'instance-'));
  const state = { directory, trace: [], world: null };
  t.after(async () => {
    await state.world?.close();
    if (state.passed) fs.rmSync(directory, { recursive: true, force: true });
    else fs.writeFileSync(path.join(directory, 'http-trace.json'), JSON.stringify(state.trace, null, 2));
  });
  state.world = await createIntegration({ directory });
  const { client } = await registerMath(state.world, email);
  state.client = client;
  state.call = http(client, state.trace);
  state.png = fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png', import.meta.url));
  state.fileId = await upload(client, state.png);
  const accepted = await state.call('POST', imports, {
    title: '含教学说明的原始材料', origin: '真实文本解析，不调用模型',
    input: { kind: 'text', text: '1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$\n教学建议：先判断零点，再解释图像。' },
  }, 201);
  await until(() => state.call('GET', `/api/workbench/jobs/${accepted.jobId}`), job => !['queued', 'running'].includes(job.state));
  let material = await state.call('GET', `${imports}/${accepted.id}`);
  assert.equal(material.drafts.length, 1);
  const fragment = material.fragments.find(f => f.text.includes('教学建议'));
  assert.ok(fragment, 'Native text import must produce the real teaching fragment');
  state.noteFragments = [{
    id: fragment.id, importId: material.id, locations: fragment.locations,
    document: { version: 2, blocks: [
      ...doc(fragment.text).blocks,
      { type: 'image', fileId: state.fileId, alt: '笔记独有配图', widthMm: 60 },
      { type: 'math', latex: 'x=\\pm2' },
      { type: 'table', rows: [[{ blocks: [paragraph('笔记表格')] }, { blocks: [paragraph('两个零点')] }]] },
    ] },
  }];
  material = await state.call('PUT', `${imports}/${material.id}`, {
    baseVersion: material.version,
    drafts: material.drafts.map(d => ({ ...d, noteFragments: state.noteFragments,
      issues: d.issues.map(i => ({ ...i, resolution: 'corrected' })) })),
    fragments: material.fragments.map(f => f.id === fragment.id ? { ...f, disposition: 'assigned' } : f),
  });
  const committed = await state.call('POST', `${imports}/${material.id}/commit`, {
    baseVersion: material.version, draftIds: [material.drafts[0].id],
  });
  state.question = committed.questions[0];
  assert.deepEqual(state.question.noteFragments, state.noteFragments);
  const deleted = await state.call('POST', `${imports}/${material.id}/deletion`, {
    baseVersion: committed.import.version, deleted: true,
  });
  await state.call('POST', `${imports}/${material.id}/purge`, { baseVersion: deleted.version });
  await state.call('GET', `${imports}/${material.id}`, undefined, 404);
  assert.deepEqual((await state.call('GET', `${Q}/${state.question.id}`)).noteFragments, state.noteFragments);
  return state;
}

async function exported(state) {
  const accepted = await state.call('POST', '/api/reliability/v1/exports', {}, 202);
  return until(() => state.call('GET', `/api/reliability/v1/exports/${accepted.id}`), result => !['queued', 'running'].includes(result.state));
}

test('real-auth personal archive preserves question note documents and local attachments after import purge', async t => {
  const state = await prepare(t);
  const result = await exported(state);
  assert.equal(result.state, 'ready', JSON.stringify(result));
  assert.equal((await state.client.request('GET', result.downloadPath)).status, 200);
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(state.directory, 'personal-exports', `${result.id}.zip`)));
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const item = manifest.objects.find(o => o.key.kind === 'question' && o.key.id === state.question.id);
  assert.ok(item);
  const json = JSON.parse(await zip.file(item.dataPath).async('string'));
  assert.deepEqual(json.value.noteFragments, state.noteFragments);
  assert.deepEqual(json.value.source, state.question.source);
  assert.ok(manifest.relations.every(relation => manifest.objects.some(object => JSON.stringify(object.key) === JSON.stringify(relation.to))));
  const html = await zip.file(item.readablePath).async('string');
  const readable = html.split('<details>')[0];
  for (const text of ['教学建议', '笔记独有配图', 'x=\\pm2', '笔记表格', '两个零点']) assert.ok(readable.includes(text), `Missing readable note content: ${text}`);
  const attachment = manifest.files.find(f => f.path.startsWith(`files/${state.fileId}/`));
  assert.ok(attachment, 'Image referenced only by note must be included');
  assert.deepEqual(await zip.file(attachment.path).async('nodebuffer'), state.png);
  assert.equal(attachment.sha256, hash(state.png));
  assert.equal(attachment.bytes, state.png.length);
  const fileObject = manifest.objects.find(o => o.key.kind === 'file' && o.key.id === state.fileId);
  assert.ok(fileObject);
  assert.ok(html.includes(fileObject.readablePath), 'Question must link to its captured note image');
  const fileHtml = await zip.file(fileObject.readablePath).async('string');
  assert.ok(fileHtml.includes(attachment.path), 'File page must expose the local image download');
  for (const [name, contents] of [[item.readablePath, html], [fileObject.readablePath, fileHtml]]) {
    for (const [, href] of contents.matchAll(/href="([^"]+)"/g)) {
      const local = path.posix.normalize(path.posix.join(path.posix.dirname(name), decodeURIComponent(href)));
      assert.ok(zip.file(local), `Missing offline target ${href}`);
    }
  }
  state.passed = true;
});

test('same-version offline backup restores independently captured question notes after import purge', async t => {
  const state = await prepare(t);
  // Backup destinations must be outside the source instance.
  const archive = `${state.directory}-backup`, restored = `${state.directory}-restored`;
  t.after(() => { if (state.passed) for (const d of [archive, restored]) fs.rmSync(d, { recursive: true, force: true }); });
  await state.world.close(); state.world = null;
  assert.equal((await backup({ database: path.join(state.directory, 'workspace.sqlite'), files: path.join(state.directory, 'files'), target: archive, stopped: true })).state, 'backed-up');
  assert.equal(restore({ source: archive, target: restored, stopped: true }).state, 'prepared');
  assert.equal(activate({ target: restored, stopped: true }).state, 'activated');
  state.world = await createIntegration({ directory: restored });
  state.client = state.world.client(); state.call = http(state.client, state.trace);
  await state.call('POST', '/api/auth/session', { action: 'bootstrap' });
  const login = await state.call('POST', '/api/auth/login', { email, password: 'math-password', rememberMe: true });
  await state.call('POST', '/api/auth/session', { action: 'activate', sessionId: login.id, rememberMe: true });
  assert.deepEqual((await state.call('GET', `${Q}/${state.question.id}`)).noteFragments, state.noteFragments);
  assert.equal((await state.client.request('GET', `/api/workbench/files/${state.fileId}/content`)).status, 200);
  const file = state.world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(state.fileId);
  assert.deepEqual(fs.readFileSync(path.join(restored, 'files', 'blobs', file.blobName)), state.png);
  state.passed = true;
});

function corrupt(db, questionId, mutate) {
  const row = db.prepare('SELECT value FROM questions_materials_meta WHERE id=?').get(questionId);
  const value = JSON.parse(row.value);
  assert.ok(value.noteFragments?.length, 'Notes must be persisted as independent question metadata');
  mutate(value.noteFragments[0].document);
  db.prepare('UPDATE questions_materials_meta SET value=? WHERE id=?').run(JSON.stringify(value), questionId);
}

for (const kind of ['foreign-file', 'unknown-document-version']) {
  test(`note metadata ${kind}: backup/restore reject unsupported content and export preserves readable data boundaries`, async t => {
    const state = await prepare(t);
    const other = await registerMath(state.world, `notes-${kind}@example.test`);
    const foreignFile = await upload(other.client, state.png, 'foreign-note.png');
    const mutate = document => {
      if (kind === 'foreign-file') document.blocks.find(b => b.type === 'image').fileId = foreignFile;
      else document.version = 999;
    };
    const rejectedContent = error => kind === 'foreign-file'
      ? /foreign file reference/.test(error.message)
      : error.problem?.reason === 'unsupported-content-version';
    const archive = `${state.directory}-backup`, restored = `${state.directory}-rejected-restore`, rejectedBackup = `${state.directory}-rejected-backup`;
    t.after(() => { if (state.passed) for (const d of [archive, restored, rejectedBackup]) fs.rmSync(d, { recursive: true, force: true }); });
    await state.world.close(); state.world = null;
    await backup({ database: path.join(state.directory, 'workspace.sqlite'), files: path.join(state.directory, 'files'), target: archive, stopped: true });
    const db = new Database(path.join(state.directory, 'workspace.sqlite'));
    try { corrupt(db, state.question.id, mutate); } finally { db.close(); }
    await assert.rejects(backup({ database: path.join(state.directory, 'workspace.sqlite'), files: path.join(state.directory, 'files'), target: rejectedBackup, stopped: true }), rejectedContent);
    assert.ok(!fs.existsSync(rejectedBackup));
    const archiveDb = new Database(path.join(archive, 'workspace.sqlite'));
    try { corrupt(archiveDb, state.question.id, mutate); } finally { archiveDb.close(); }
    const manifestPath = path.join(archive, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const bytes = fs.readFileSync(path.join(archive, 'workspace.sqlite'));
    manifest.database.bytes = bytes.length; manifest.database.sha256 = hash(bytes);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    assert.throws(() => restore({ source: archive, target: restored, stopped: true }), rejectedContent);
    assert.ok(!fs.existsSync(path.join(restored, 'recovery-prepared.json')));
    state.world = await createIntegration({ directory: state.directory });
    const client = state.world.client();
    // Login to the original account, whose captured note metadata is corrupt.
    await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    state.client = client; state.call = http(client, state.trace);
    const login = await state.call('POST', '/api/auth/login', { email, password: 'math-password', rememberMe: true });
    await state.call('POST', '/api/auth/session', { action: 'activate', sessionId: login.id, rememberMe: true });
    const result = await exported(state);
    if (kind === 'foreign-file') {
      assert.equal(result.state, 'failed');
      assert.equal(result.downloadPath, null);
      assert.ok(!fs.existsSync(path.join(state.directory, 'personal-exports', `${result.id}.zip`)));
    } else {
      // Reading/exporting preserves unknown raw documents. This does not prove
      // that their layout is renderable, and deployment recovery rejects them.
      assert.equal(result.state, 'ready', JSON.stringify(result));
      const zip = await JSZip.loadAsync(fs.readFileSync(path.join(state.directory, 'personal-exports', `${result.id}.zip`)));
      const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
      const item = manifest.objects.find(o => o.key.kind === 'question' && o.key.id === state.question.id);
      assert.ok(item);
      const expected = structuredClone(state.noteFragments);
      expected[0].document.version = 999;
      assert.deepEqual(JSON.parse(await zip.file(item.dataPath).async('string')).value.noteFragments, expected);
    }
    state.passed = true;
  });
}
