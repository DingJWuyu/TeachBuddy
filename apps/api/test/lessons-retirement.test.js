import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';
import { retirementMigrationId } from '../src/workbench/retire-lessons.js';
const fixture = new URL('./fixtures/retirement/', import.meta.url);
const metadata = JSON.parse(fs.readFileSync(new URL('metadata.json', fixture)));
const root = path.resolve('test-results/remove-lessons/api');
fs.mkdirSync(root, { recursive: true });

async function unpack(destination) {
  const bytes = fs.readFileSync(new URL('pre-retirement-backup.zip', fixture));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.backupSha256);
  const zip = await JSZip.loadAsync(bytes);
  for (const [name, item] of Object.entries(zip.files)) if (!item.dir) {
    const target = path.join(destination, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await item.async('nodebuffer'));
  }
}
async function login(world) {
  const client = world.client();
  const call = async (method, url, body) => {
    const response = await client.request(method, url, { body, headers: { 'Idempotency-Key': randomUUID() } });
    assert(response.status < 300, response.text); return response.json;
  };
  await call('POST', '/api/auth/session', { action: 'bootstrap' });
  const session = await call('POST', '/api/auth/login', { email: metadata.email, password: metadata.password, rememberMe: true });
  await call('POST', '/api/auth/session', { action: 'activate', sessionId: session.id, rememberMe: true });
  return { client, call };
}
async function verify(world) {
  const { client, call } = await login(world), ids = metadata.ids, db = world.workbench.db;
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'lesson_*'").all(), []);
  assert.deepEqual(db.prepare("SELECT id FROM workbench_migrations WHERE moduleId='lessons'").all(), []);
  assert(db.prepare('SELECT 1 FROM workbench_migrations WHERE id=?').get(retirementMigrationId));
  const catalog = await call('GET', '/api/modules');
  assert(!JSON.stringify(catalog).includes('lessons'));
  assert(!JSON.stringify(await call('GET', '/api/workbench/navigation')).includes('lessons'));
  assert.equal((await client.request('GET', `/api/workbench/jobs/${metadata.exportJobId}`)).status, 404);
  assert.equal((await client.request('GET', `/api/reliability/v1/exports/${metadata.personalExportId}`)).status, 404);
  assert(!db.prepare("SELECT 1 FROM workbench_mutation_keys WHERE path LIKE '/api/modules/lessons/%'").get());
  assert.equal((await client.request('GET', `/api/modules/lessons/v3/${ids.lesson}`)).status, 404);
  assert.equal((await call('GET', `/api/modules/questions/v2/items/${ids.question}`)).title, '保留题目');
  assert.equal((await call('GET', `/api/modules/resources/items/${ids.resource}`)).note, '保留资源备注');
  assert.equal((await call('GET', `/api/modules/math/v1/works/${ids.math}`)).source.latex, 'x^2');
  assert.equal((await call('GET', `/api/modules/classes/items/${ids.class}`)).name, '保留班级');
  const record = await call('GET', `/api/modules/classes/v2/records/${ids.record}`);
  assert.equal(record.note, '保留教学记录');
  assert.deepEqual(record.sources.map(source => source.kind), ['question', 'math']);
  const entry = await call('GET', `/api/modules/schedule/entries/${ids.entry}`);
  assert.equal(entry.title, '保留日程');
  assert.deepEqual(entry.course, { classId: ids.class, recordIds: [] });
  const exceptions = await call('GET', `/api/modules/schedule/entries/${ids.entry}/exceptions`);
  assert(!JSON.stringify(exceptions).includes('lesson'));
  assert(JSON.stringify(exceptions).includes(ids.record));
  const draft = (await call('GET', `/api/agent/conversations/${ids.conversation}`)).draft;
  assert.equal(draft.text, '保留助理草稿');
  assert.deepEqual(draft.references.map(ref => ref.kind), ['question']);
  const chunks = [];
  for await (const chunk of await world.workbench.files.open({ accountKey: metadata.accountKey }, ids.file)) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(), '保留公共附件与资源原件');
}

test('retirement upgrades an existing database, restarts, and preserves five modules and shared files', async () => {
  const directory = fs.mkdtempSync(path.join(root, 'retirement-start-'));
  await unpack(directory);
  const cache = path.join(directory, 'personal-exports', `${metadata.personalExportId}.zip`);
  fs.mkdirSync(path.dirname(cache), { recursive: true }); fs.writeFileSync(cache, 'retired package');
  let world;
  try {
    world = await createIntegration({ directory }); await verify(world); assert(!fs.existsSync(cache)); await world.close(); world = null;
    world = await createIntegration({ directory }); await verify(world);
  } finally { await world?.close(); }
});

test('retirement restores the fixed former backup and roundtrips a current backup without changing its source', async () => {
  const directory = fs.mkdtempSync(path.join(root, 'retirement-backup-'));
  const source = path.join(directory, 'source'), target = path.join(directory, 'restored');
  await unpack(source);
  const before = fs.readFileSync(path.join(source, 'workspace.sqlite'));
  const receipt = restore({ source, target, stopped: true });
  assert.equal(receipt.state, 'prepared');
  assert.deepEqual(fs.readFileSync(path.join(source, 'workspace.sqlite')), before);
  activate({ target, stopped: true });
  let world;
  try {
    world = await createIntegration({ directory: target }); await verify(world); await world.close(); world = null;
    const saved = path.join(directory, 'current-backup');
    await backup({ database: path.join(target, 'workspace.sqlite'), files: path.join(target, 'files'), target: saved, stopped: true });
    const second = path.join(directory, 'second');
    restore({ source: saved, target: second, stopped: true }); activate({ target: second, stopped: true });
    world = await createIntegration({ directory: second }); await verify(world);
  } finally { await world?.close(); }
});

test('retirement does not accept unknown former migration IDs', async () => {
  const directory = fs.mkdtempSync(path.join(root, 'retirement-unknown-'));
  await unpack(directory);
  const db = new Database(path.join(directory, 'workspace.sqlite'));
  db.prepare('INSERT INTO workbench_migrations VALUES (?,?,?)').run('lessons_9999_unknown', 'lessons', new Date().toISOString());
  db.close();
  await assert.rejects(createIntegration({ directory }), /Unsupported retired lessons migration/);
  const retained = new Database(path.join(directory, 'workspace.sqlite'));
  assert(retained.prepare("SELECT 1 FROM sqlite_master WHERE name='lesson_items'").get());
  const migrationIds = retained.prepare('SELECT id FROM workbench_migrations ORDER BY id').all().map(row => row.id);
  retained.close();
  const manifestPath = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const bytes = fs.readFileSync(path.join(directory, 'workspace.sqlite'));
  manifest.database.bytes = bytes.length;
  manifest.database.sha256 = createHash('sha256').update(bytes).digest('hex');
  manifest.migrationIds = migrationIds;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => restore({ source: directory, target: directory + '-rejected', stopped: true }), /Unsupported migration set/);
});
