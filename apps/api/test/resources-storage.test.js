import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import sharp from 'sharp';
import { startResourcesFixture } from '../../web/e2e/fixtures/materials-resources/server.mjs';
import { migrations as authMigrations } from '../src/features/auth/migrations/index.js';
import { backup } from '../src/workbench/reliability/backup.js';

const root = path.resolve('test-results/resources-storage');
fs.mkdirSync(root, { recursive: true });
async function world() {
  const dataDir = fs.mkdtempSync(path.join(root, 'http-'));
  let fixture = await startResourcesFixture({ dataDir, port: 49472 });
  return {
    dataDir,
    get fixture() { return fixture; },
    async restart() { await fixture.close(); fixture = await startResourcesFixture({ dataDir, port: 49472 }); },
    async close() { await fixture.close(); },
    async request(method, route, body, { key = randomUUID(), account = 'r32-a', signal } = {}) {
      return fetch(fixture.origin + route, { method, signal, headers: {
        Cookie: fixture.workbench.identity.testPrincipalCookie(account).header.split(';')[0],
        Origin: fixture.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': key,
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
    },
    async json(method, route, input, options) {
      const response = await this.request(method, route, input, options);
      const body = await response.json();
      assert(response.ok, JSON.stringify({ status: response.status, body }));
      return body;
    },
    async upload(name, bytes = name) {
      const data = new FormData(); data.append('file', new Blob([bytes]), name);
      return this.json('POST', '/api/workbench/files', data);
    },
    create(file) { return this.json('POST', '/api/modules/resources/items', { fileId: file.id, title: file.name, folderId: null, tagIds: [], note: '' }); },
    archive(item) { return this.json('POST', `/api/modules/resources/items/${item.id}/deletion`, { baseVersion: item.version, deleted: true }); },
    purge(item, options) { return this.request('POST', `/api/modules/resources/items/${item.id}/purge`, { baseVersion: item.version }, options); },
    blob(file) { return path.join(dataDir, 'files/blobs', `${file.id}.blob`); },
  };
}
const select = (...items) => ({ items: items.map(item => ({ id: item.id, baseVersion: item.version })) });

test('resource ZIP contains only current originals; names, versions, ownership and failures are atomic', async () => {
  const w = await world();
  try {
    const old = await w.upload('old.txt', 'history'), a = await w.create(old);
    const current = await w.upload('课件.txt', 'current'), bFile = await w.upload('课件.txt', 'second'), collision = await w.upload('课件 (2).txt', 'third');
    const updated = await w.json('PUT', `/api/modules/resources/items/${a.id}/file`, { baseVersion: 1, fileId: current.id });
    const b = await w.archive(await w.create(bFile)), c = await w.create(collision);
    const response = await w.request('POST', '/api/modules/resources/items/download', select(updated, b, c));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/zip');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, Number(response.headers.get('content-length')));
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    assert.deepEqual(Object.keys(zip.files), ['课件.txt', '课件 (2).txt', '课件 (2) (2).txt']);
    assert.deepEqual(await Promise.all(Object.values(zip.files).map(file => file.async('string'))), ['current', 'second', 'third']);
    fs.writeFileSync(path.join(root, 'originals.zip'), bytes);
    for (const [input, options, expected] of [[select(a), {}, 409], [select(updated), { account: 'r32-b' }, 404], [select(updated, updated), {}, 422], [{ items: [] }, {}, 422], [{ items: Array.from({ length: 101 }, () => ({ id: randomUUID(), baseVersion: 1 })) }, {}, 422]]) {
      const response = await w.request('POST', '/api/modules/resources/items/download', input, options);
      assert.equal(response.status, expected, await response.text());
    }
    fs.unlinkSync(w.blob(bFile));
    const missing = await w.request('POST', '/api/modules/resources/items/download', select(updated, b));
    assert.equal(missing.status, 503);
    assert.equal((await missing.json()).type, '/problems/materials/storage-unavailable');
    const work = path.join(w.dataDir, 'files/downloads');
    assert(fs.readdirSync(work).every(account => fs.readdirSync(path.join(work, account)).length === 0));
  } finally { await w.close(); }
});

test('resource purge reclaims exclusive history, previews, caches and jobs while preserving shared owners', async () => {
  const w = await world();
  try {
    const original = await w.upload('image.png', await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).png().toBuffer());
    const first = await w.create(original), shared = await w.create(original);
    await w.json('POST', `/api/workbench/files/${original.id}/preview`, {});
    let preview;
    for (let attempt = 0; attempt < 100; attempt++) {
      preview = await w.json('GET', `/api/workbench/files/${original.id}/preview`);
      if (preview.state === 'ready') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(preview.state, 'ready');
    const page = { id: preview.pages[0].imageFileId };
    const latest = await w.upload('current.txt', 'current exclusive'), updated = await w.json('PUT', `/api/modules/resources/items/${first.id}/file`, { baseVersion: 1, fileId: latest.id });
    await w.json('GET', '/api/modules/resources/items?q=current');
    assert.equal((await w.purge(await w.archive(updated))).status, 200);
    assert(!fs.existsSync(w.blob(latest)));
    assert(fs.existsSync(w.blob(original)) && fs.existsSync(w.blob(page)));
    const archived = await w.archive(shared);
    assert(fs.existsSync(w.blob(original)), 'archive keeps bytes');
    const key = randomUUID(), result = await w.purge(archived, { key });
    assert.equal(result.status, 200, await result.text());
    assert(!fs.existsSync(w.blob(original)) && !fs.existsSync(w.blob(page)));
    for (const table of ['materials_files', 'materials_previews', 'materials_renditions', 'materials_jobs', 'resource_file_history', 'resource_text_cache', 'materials_file_reclamation'])
      assert.equal(w.fixture.workbench.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, table);
    await w.restart();
    assert.equal((await w.purge(archived, { key })).status, 200);
    assert.equal((await w.request('GET', `/api/modules/resources/items/${archived.id}`)).status, 404);
  } finally { await w.close(); }
});

test('failed physical deletion stays locked, rejects backup and completes after restart with original key', async () => {
  const w = await world();
  try {
    const historical = await w.upload('old-before-failure.txt'), item = await w.create(historical);
    const file = await w.upload('retain-on-failure.txt');
    const updated = await w.json('PUT', `/api/modules/resources/items/${item.id}/file`, { baseVersion: item.version, fileId: file.id });
    const archived = await w.archive(updated), key = randomUUID();
    const blob = w.blob(file), saved = blob + '.saved';
    fs.renameSync(blob, saved); fs.mkdirSync(blob); fs.writeFileSync(path.join(blob, 'blocker'), 'failure');
    const failed = await w.purge(archived, { key });
    assert.equal(failed.status, 503, await failed.text());
    assert(!fs.existsSync(w.blob(historical)), 'earlier unlink is durable even though the DB transaction rolls back');
    assert.equal(w.fixture.workbench.db.prepare('SELECT completed FROM resource_purges WHERE id=?').get(archived.id).completed, 0);
    assert.equal((await w.request('POST', `/api/modules/resources/items/${archived.id}/deletion`, { baseVersion: archived.version, deleted: false })).status, 503);
    // The narrow HTTP fixture has no auth router; offline validation still needs
    // the full deployed migration set, even when it refuses before owner checks.
    w.fixture.workbench.migrations.run([{ moduleId: "auth", migrations: authMigrations }], { knownModuleIds: ["auth"] });
    // Test the stopped-instance path against the same interrupted intent.
    await w.fixture.close();
    await assert.rejects(backup({ database: path.join(w.dataDir, 'resources.sqlite'), files: path.join(w.dataDir, 'files'), target: path.join(root, `blocked-backup-${randomUUID()}`), stopped: true }), /reclamation is incomplete/);
    fs.rmSync(blob, { recursive: true }); fs.renameSync(saved, blob);
    await w.restart();
    assert(!fs.existsSync(blob));
    const completed = await w.purge(archived, { key });
    assert.equal(completed.status, 200, await completed.text());
    assert.equal(w.fixture.workbench.db.prepare('SELECT completed FROM resource_purges WHERE id=?').get(archived.id).completed, 1);
  } finally { await w.close(); }
});

test('purge waits for an in-flight preview and does not resurrect jobs or cache after completion', async () => {
  const w = await world();
  try {
    const file = await w.upload('preview.png', await sharp({ create: { width: 2000, height: 2000, channels: 3, background: 'blue' } }).png().toBuffer());
    const item = await w.archive(await w.create(file));
    await w.json('POST', `/api/workbench/files/${file.id}/preview`, {});
    const removed = await w.purge(item);
    assert.equal(removed.status, 200, await removed.text());
    await new Promise(resolve => setTimeout(resolve, 100));
    for (const table of ['materials_files', 'materials_jobs', 'materials_previews', 'materials_renditions'])
      assert.equal(w.fixture.workbench.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, table);
    assert.equal(fs.readdirSync(path.join(w.dataDir, 'files/blobs')).length, 0);
  } finally { await w.close(); }
});

test('cancelled ZIP transfer removes temporary copies and keeps originals usable', async () => {
  const w = await world();
  try {
    const file = await w.upload('large.bin', Buffer.alloc(12 * 1024 * 1024, 61));
    const a = await w.create(file), b = await w.create(file), abort = new AbortController();
    const response = await w.request('POST', '/api/modules/resources/items/download', select(a, b), { signal: abort.signal });
    assert.equal(response.status, 200);
    await response.body.getReader().read();
    abort.abort();
    const work = path.join(w.dataDir, 'files/downloads');
    for (let n = 0; n < 100; n++) {
      if (fs.readdirSync(work).every(account => fs.readdirSync(path.join(work, account)).length === 0)) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(fs.readdirSync(work).every(account => fs.readdirSync(path.join(work, account)).length === 0));
    const content = await w.request('GET', `/api/workbench/files/${file.id}/content`);
    assert.equal(content.status, 200);
    assert.equal((await content.arrayBuffer()).byteLength, file.byteLength);
  } finally { await w.close(); }
});

test('real-auth purge retains adopted question attachments and waits for accepted personal export', async () => {
  const { createIntegration } = await import('./fixtures/auth-integration/harness.js');
  const { registerMath } = await import('../../web/e2e/fixtures/math-static/real.mjs');
  const { http, question, writable, Q } = await import('./teaching-time-classes-materials-fixture.js');
  const directory = fs.mkdtempSync(path.join(root, 'auth-'));
  const world = await createIntegration({ directory });
  try {
    const { client, session } = await registerMath(world, 'resources-storage@example.test');
    const call = http(client), principal = { accountKey: session.account.accountKey };
    const store = (name, bytes) => world.workbench.files.store(principal, { name, bytes }, { key: randomUUID(), method: 'POST', path: '/api/workbench/files' });
    const image = await store('shared.png', await sharp({ create: { width: 10, height: 10, channels: 3, background: 'green' } }).png().toBuffer());
    const resource = await call('POST', '/api/modules/resources/items', { fileId: image.id, title: 'shared attachment', folderId: null, tagIds: [], note: '' }, 201);
    const input = question('has shared attachment'); input.body.blocks.push({ type: 'image', fileId: image.id, alt: 'figure', widthMm: 60 });
    const original = await call('POST', Q, input, 201);
    const copied = await call('POST', `${Q}/${original.id}/copies`, { ...writable(original), baseVersion: original.version }, 201);
    const deletedQuestion = await call('POST', `${Q}/${original.id}/deletion`, { baseVersion: original.version, deleted: true });
    await call('POST', `${Q}/${original.id}/purge`, { baseVersion: deletedQuestion.version });
    const archived = await call('POST', `/api/modules/resources/items/${resource.id}/deletion`, { baseVersion: resource.version, deleted: true });
    await call('POST', `/api/modules/resources/items/${resource.id}/purge`, { baseVersion: archived.version });
    assert.equal(world.workbench.files.read(principal, image.id).id, image.id);
    assert.equal((await call('GET', `${Q}/${copied.id}`)).source.snapshot.body.blocks.at(-1).fileId, image.id);
    const exclusive = await store('exporting.bin', Buffer.alloc(16 * 1024 * 1024, 23));
    const extra = await call('POST', '/api/modules/resources/items', { fileId: exclusive.id, title: 'exported original', folderId: null, tagIds: [], note: '' }, 201);
    const archivedExtra = await call('POST', `/api/modules/resources/items/${extra.id}/deletion`, { baseVersion: extra.version, deleted: true });
    const accepted = await call('POST', '/api/reliability/v1/exports', {}, 202);
    await call('POST', `/api/modules/resources/items/${extra.id}/purge`, { baseVersion: archivedExtra.version });
    const exported = await call('GET', `/api/reliability/v1/exports/${accepted.id}`);
    assert.equal(exported.state, 'ready');
    const archive = await JSZip.loadAsync(fs.readFileSync(path.join(directory, 'personal-exports', `${accepted.id}.zip`)));
    assert(Object.keys(archive.files).some(name => name.includes(exclusive.id)));
    assert(!fs.existsSync(path.join(directory, 'files/blobs', `${exclusive.id}.blob`)));
  } finally { await world.close(); }
  const { restore } = await import('../src/workbench/reliability/backup.js');
  const target = path.join(root, `owned-backup-${randomUUID()}`);
  await backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target, stopped: true });
  restore({ source: target, target: path.join(root, `owned-restored-${randomUUID()}`), stopped: true });
  // A pre-reclamation deployment remains a supported migration source.
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(path.join(directory, 'workspace.sqlite'));
  db.exec("DROP TABLE resource_purges; DROP TABLE materials_file_reclamation; DELETE FROM workbench_migrations WHERE id IN ('resources_004_file_reclamation','materials_files_002_reclamation')");
  db.close();
  const older = path.join(root, `older-backup-${randomUUID()}`), restored = path.join(root, `older-restored-${randomUUID()}`);
  await backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target: older, stopped: true });
  restore({ source: older, target: restored, stopped: true });
  const migrated = new Database(path.join(restored, 'workspace.sqlite'), { readonly: true });
  assert.equal(migrated.prepare("SELECT COUNT(*) n FROM workbench_migrations WHERE id IN ('resources_004_file_reclamation','materials_files_002_reclamation')").get().n, 2);
  migrated.close();
});

test('purge reclaims a historical supplement PDF and all of its rendered pages', async () => {
  const w = await world();
  try {
    const original = await w.upload('original.txt'), item = await w.create(original);
    const supplement = await w.upload('supplement.pdf', fs.readFileSync(new URL('../../web/e2e/fixtures/materials/samples/c22.pdf', import.meta.url)));
    await w.json('POST', `/api/workbench/files/${supplement.id}/preview`, {});
    let preview;
    for (let n = 0; n < 200; n++) {
      preview = await w.json('GET', `/api/workbench/files/${supplement.id}/preview`);
      if (preview.state === 'ready') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(preview.state, 'ready');
    const supplemented = await w.json('PUT', `/api/modules/resources/items/${item.id}/supplement-preview`, { baseVersion: item.version, fileId: original.id, supplementPreviewFileId: supplement.id });
    const next = await w.upload('new.txt');
    const replaced = await w.json('PUT', `/api/modules/resources/items/${item.id}/file`, { baseVersion: supplemented.version, fileId: next.id });
    const archived = await w.archive(replaced);
    assert(fs.existsSync(w.blob(supplement)), 'history keeps supplement before purge');
    const response = await w.purge(archived);
    assert.equal(response.status, 200, await response.text());
    assert.equal(fs.readdirSync(path.join(w.dataDir, 'files/blobs')).length, 0);
    assert.equal(w.fixture.workbench.db.prepare('SELECT COUNT(*) n FROM materials_files').get().n, 0);
  } finally { await w.close(); }
});
