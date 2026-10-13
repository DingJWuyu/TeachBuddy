import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { doc, question, http, writable, Q } from './materials-http-fixture.js';
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';

const email = 'snapshots@example.test';
async function prepare() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'material-snapshots-'));
  const world = await createIntegration({ directory });
  try {
    const { client, session } = await registerMath(world, email);
    const call = http(client), principal = { accountKey: session.account.accountKey };
    const png = fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png', import.meta.url));
    const file = await world.workbench.files.store(principal, { name: 'figure.png', bytes: png },
      { key: randomUUID(), method: 'POST', path: '/api/workbench/files' });
    const input = question('原题 <script>alert("title")</script>');
    input.body = { version: 2, blocks: [
      ...doc('图片之前').blocks,
      { type: 'image', fileId: file.id, alt: '原题配图', widthMm: 60 },
      ...doc('图片之后').blocks,
      { type: 'math', latex: 'y=\\frac{1}{x+3}' },
    ] };
    const original = await call('POST', Q, input, 201);
    const copy = await call('POST', `${Q}/${original.id}/copies`, {
      ...writable(original), title: '独立改编题 <script>alert("title")</script>', baseVersion: original.version,
    }, 201);
    const archived = await call('POST', `${Q}/${original.id}/deletion`, { baseVersion: original.version, deleted: true });
    await call('POST', `${Q}/${original.id}/purge`, { baseVersion: archived.version });
    assert.deepEqual((await call('GET', `${Q}/${copy.id}`)).source.snapshot, copy.source.snapshot);
    return { directory, world, client, call, copy, fileId: file.id, png };
  } catch (error) { await world.close(); throw error; }
}
async function exportResult(state, accepted) {
  for (let n = 0; n < 200; n++) {
    const result = await state.call('GET', `/api/reliability/v1/exports/${accepted.id}`);
    if (!['queued', 'running'].includes(result.state)) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Personal export timed out');
}
async function archive(state, accepted) {
  accepted ??= await state.call('POST', '/api/reliability/v1/exports', {}, 202);
  const result = await exportResult(state, accepted);
  assert.equal(result.state, 'ready', JSON.stringify(result));
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(state.directory, 'personal-exports', `${result.id}.zip`)));
  return { zip, manifest: JSON.parse(await zip.file('manifest.json').async('string')), result };
}

test('real-auth export preserves copied question snapshots, ordered content and files after source purge', async () => {
  const state = await prepare();
  let passed = false;
  try {
    const other = await registerMath(state.world, 'snapshot-other@example.test');
    const foreign = await http(other.client)('POST', Q, question('另一账户私有题目'), 201);
    const accepted = await state.call('POST', '/api/reliability/v1/exports', {}, 202);
    await state.call('PUT', `${Q}/${state.copy.id}`, {
      ...writable(state.copy), baseVersion: state.copy.version, title: '受理之后的修改',
    });
    const { zip, manifest, result } = await archive(state, accepted);
    assert.equal((await other.client.request('GET', result.downloadPath)).status, 404);
    const item = manifest.objects.find(o => o.key.kind === 'question' && o.key.id === state.copy.id);
    assert.deepEqual(JSON.parse(await zip.file(item.dataPath).async('string')).value, state.copy);
    assert(!manifest.objects.some(o => o.key.id === foreign.id));
    assert(manifest.relations.every(r => manifest.objects.some(o => JSON.stringify(o.key) === JSON.stringify(r.to))));
    const html = await zip.file(item.readablePath).async('string');
    assert(html.includes('y=\\frac{1}{x+3}'));
    const before = html.indexOf('图片之前'), after = html.indexOf('图片之后');
    assert(before >= 0 && after > before);
    assert.match(html.slice(before, after), /原题配图/);
    assert(!html.includes('<script>alert("title")</script>'));
    assert(html.includes('&lt;script&gt;'));
    const attachment = manifest.files.find(f => f.path.startsWith(`files/${state.fileId}/`));
    assert.deepEqual(await zip.file(attachment.path).async('nodebuffer'), state.png);
    for (const entry of manifest.files) {
      const bytes = await zip.file(entry.path).async('nodebuffer');
      assert.equal(bytes.length, entry.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    }
    for (const entry of Object.values(zip.files).filter(f => f.name.endsWith('.html'))) {
      const contents = await entry.async('string');
      assert(!contents.includes('另一账户私有题目'));
      for (const [, href] of contents.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(entry.name), decodeURIComponent(href)));
        assert(zip.file(target), `${entry.name}: missing local link ${href}`);
      }
    }
    passed = true;
  } finally {
    await state.world.close();
    if (passed) fs.rmSync(state.directory, { recursive: true, force: true });
  }
});

test('personal export rejects missing bytes and foreign attachments in preserved question snapshots', async () => {
  const state = await prepare();
  let passed = false;
  try {
    const db = state.world.workbench.db;
    const file = db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(state.fileId);
    const blob = path.join(state.directory, 'files', 'blobs', file.blobName);
    fs.unlinkSync(blob);
    let accepted = await state.call('POST', '/api/reliability/v1/exports', {}, 202);
    let failed = await exportResult(state, accepted);
    assert.equal(failed.state, 'failed');
    assert.equal(failed.downloadPath, null);
    assert(!fs.existsSync(path.join(state.directory, 'personal-exports', `${accepted.id}.zip`)));
    fs.writeFileSync(blob, state.png);
    const other = await registerMath(state.world, 'foreign-snapshot-file@example.test');
    const foreignFile = await state.world.workbench.files.store(
      { accountKey: other.session.account.accountKey }, { name: 'foreign.png', bytes: state.png },
      { key: randomUUID(), method: 'POST', path: '/api/workbench/files' });
    const row = db.prepare('SELECT source FROM question_items WHERE id=?').get(state.copy.id);
    const source = JSON.parse(row.source);
    source.snapshot.body.blocks[1].fileId = foreignFile.id;
    db.prepare('UPDATE question_items SET source=? WHERE id=?').run(JSON.stringify(source), state.copy.id);
    accepted = await state.call('POST', '/api/reliability/v1/exports', {}, 202);
    failed = await exportResult(state, accepted);
    assert.equal(failed.state, 'failed');
    assert.equal(failed.downloadPath, null);
    assert(!fs.existsSync(path.join(state.directory, 'personal-exports', `${accepted.id}.zip`)));
    passed = true;
  } finally {
    await state.world.close();
    if (passed) fs.rmSync(state.directory, { recursive: true, force: true });
  }
});

test('same-version backup restores copied question snapshots and files after source purge', async () => {
  const state = await prepare();
  const target = `${state.directory}-backup`, restored = `${state.directory}-restored`;
  let world = state.world, passed = false;
  try {
    await world.close(); world = null;
    assert.equal((await backup({ database: path.join(state.directory, 'workspace.sqlite'), files: path.join(state.directory, 'files'), target, stopped: true })).state, 'backed-up');
    assert.equal(restore({ source: target, target: restored, stopped: true }).state, 'prepared');
    assert.equal(activate({ target: restored, stopped: true }).state, 'activated');
    world = await createIntegration({ directory: restored });
    const client = world.client(), call = http(client);
    await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    const login = await call('POST', '/api/auth/login', { email, password: 'math-password', rememberMe: true });
    await call('POST', '/api/auth/session', { action: 'activate', sessionId: login.id, rememberMe: true });
    assert.deepEqual((await call('GET', `${Q}/${state.copy.id}`)).source.snapshot, state.copy.source.snapshot);
    assert.equal((await client.request('GET', `/api/workbench/files/${state.fileId}/content`)).status, 200);
    passed = true;
  } finally {
    await world?.close();
    if (passed) for (const directory of [state.directory, target, restored]) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('snapshot backup rejects a copied question source owned by another account', async () => {
  const state = await prepare();
  let db, passed = false;
  try {
    const other = await registerMath(state.world, 'another-owner@example.test');
    const foreign = await http(other.client)('POST', Q, question('另一账户的原题'), 201);
    await state.world.close();
    db = new Database(path.join(state.directory, 'workspace.sqlite'));
    db.prepare('UPDATE question_items SET sourceQuestionId=? WHERE id=?').run(foreign.id, state.copy.id);
    await assert.rejects(backup({ database: path.join(state.directory, 'workspace.sqlite'), files: path.join(state.directory, 'files'), target: `${state.directory}-rejected`, stopped: true }), /foreign object reference/);
    assert(!fs.existsSync(`${state.directory}-rejected`));
    passed = true;
  } finally {
    db?.close();
    if (passed) fs.rmSync(state.directory, { recursive: true, force: true });
  }
});
