import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { restore } from '../src/workbench/reliability/backup.js';
const fixture = new URL('./fixtures/retirement/', import.meta.url);
const metadata = JSON.parse(fs.readFileSync(new URL('metadata.json', fixture)));
const root = path.resolve('test-results/remove-classes/api');
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
test('classes retirement rejects unknown legacy migrations on startup and restore without modifying data', async () => {
  const directory = fs.mkdtempSync(path.join(root, 'retirement-unknown-'));
  await unpack(directory);
  const db = new Database(path.join(directory, 'workspace.sqlite'));
  db.prepare('INSERT INTO workbench_migrations VALUES (?,?,?)').run('classes_9999_unknown', 'classes', new Date().toISOString());
  db.close();
  const before = fs.readFileSync(path.join(directory, 'workspace.sqlite'));
  await assert.rejects(createIntegration({ directory }), /Unsupported retired classes migration/);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'workspace.sqlite')), before);
  const retained = new Database(path.join(directory, 'workspace.sqlite'));
  assert(retained.prepare("SELECT 1 FROM sqlite_master WHERE name='classes_items'").get());
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
