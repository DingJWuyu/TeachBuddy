import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import pathTools from 'node:path';
import Database from 'better-sqlite3';
import { backup, restore } from '../src/workbench/reliability/backup.js';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { defaultNavigation } from '@refatos/shared';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { takeSnapshot } from '../src/workbench/reliability/portable.js';

const path = '/api/workbench/navigation';
const put = (client, body, key = randomUUID()) => client.request('PUT', path, { body, headers: { 'Idempotency-Key': key } });
test('real auth navigation: isolation, atomic rollback, CAS, replay after restart, validation and export', async () => {
  let world = await createIntegration();
  const directory = world.directory;
  let passed = false;
  try {
    const a = await registerMath(world, 'navigation-a@example.test');
    const b = await registerMath(world, 'navigation-b@example.test');
    const accountKey = a.session.account.accountKey;
    const initial = await a.client.request('GET', path);
    assert.equal(initial.status, 200);
    assert.equal(initial.headers['cache-control'], 'no-store');
    assert.equal(initial.json.updatedAt, null);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) AS n FROM workbench_navigation').get().n, 0);
    assert.equal((await world.client().request('GET', path)).status, 401);
    assert.equal((await a.client.request('GET', path, { headers: { 'X-TeachBuddy-Page': '1'.repeat(32) } })).status, 401);
    const layout = defaultNavigation();
    layout.groups.splice(1, 0, { id: 'custom', name: '个人备课', moduleIds: ['dormant-module'] });
    layout.groups[0].moduleIds = layout.groups[0].moduleIds.filter(id => id !== 'resources');
    layout.hiddenModuleIds = ['resources', 'dormant-hidden'];
    const body = { baseVersion: 1, layout }, key = randomUUID();
    world.workbench.db.exec("CREATE TRIGGER reject_navigation BEFORE INSERT ON workbench_navigation BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    assert.equal((await put(a.client, body, key)).status, 503);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) AS n FROM workbench_navigation').get().n, 0);
    assert.equal(world.workbench.mutations.count(accountKey), 0);
    world.workbench.db.exec('DROP TRIGGER reject_navigation');
    const saved = await put(a.client, body, key);
    assert.equal(saved.status, 200);
    assert.equal(saved.json.version, 2);
    assert.deepEqual(saved.json.layout, layout);
    assert.deepEqual((await b.client.request('GET', path)).json.layout, defaultNavigation());
    assert.equal((await b.client.request('GET', path)).json.updatedAt, null);
    assert.equal((await put(a.client, body)).status, 409);
    assert.deepEqual((await put(a.client, body, key)).json, saved.json);
    assert.equal((await put(a.client, { ...body, baseVersion: 2 }, key)).status, 409);
    const changed = structuredClone(layout); changed.groups[1].name = '更新备课';
    const concurrent = await Promise.all([put(a.client, { baseVersion: 2, layout: changed }), put(a.client, { baseVersion: 2, layout })]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    for (const invalid of [
      { baseVersion: 3, layout, accountKey: 'forged' },
      { baseVersion: 3, layout: { ...layout, groups: [...layout.groups, layout.groups[0]] } },
      { baseVersion: 3, layout: { ...layout, hiddenModuleIds: [...layout.hiddenModuleIds, 'questions'] } },
      { baseVersion: 3, layout: { ...layout, groups: layout.groups.slice(0, -1) } },
      { baseVersion: 3, layout: { ...layout, structureVersion: 2 } },
      { baseVersion: 3, layout: { ...layout, collapsed: true } }
    ]) assert.equal((await put(a.client, invalid)).status, 422);
    assert.equal((await a.client.request('PUT', path, { body, headers: { 'Idempotency-Key': randomUUID(), Origin: 'https://wrong.test' } })).status, 403);
    assert.equal((await a.client.request('GET', path + '?accountKey=forged')).status, 422);
    const current = (await a.client.request('GET', path)).json;
    const snapshot = takeSnapshot(world.workbench.db, { accountKey }, world.workbench.loader);
    assert.ok(snapshot.objects.some(o => o.kind === 'layout' && o.value?.groups?.some(g => g.id === 'custom')));
    assert.deepEqual(JSON.parse(world.workbench.db.prepare('SELECT layoutJson FROM workbench_navigation WHERE accountKey=?').get(accountKey).layoutJson), current.layout);
    await world.close();
    world = await createIntegration({ directory });
    const client = world.client();
    await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    const pending = await client.request('POST', '/api/auth/login', { body: { email: 'navigation-a@example.test', password: 'math-password', rememberMe: true } });
    assert.equal(pending.status, 200);
    await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: pending.json.id, rememberMe: true } });
    assert.deepEqual((await client.request('GET', path)).json, current);
    assert.deepEqual((await put(client, body, key)).json, saved.json);
    assert.deepEqual((await client.request('GET', path)).json, current);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error(`Navigation fixture retained at ${directory}`);
  }
});

test('offline backup restores navigation values and upgrades databases predating navigation', async () => {
  const root = fs.mkdtempSync(pathTools.join(os.tmpdir(), 'navigation-backup-'));
  const directory = pathTools.join(root, 'source'); fs.mkdirSync(directory);
  let world = await createIntegration({ directory });
  let passed = false;
  try {
    const { client, session } = await registerMath(world, 'navigation-backup@example.test');
    const layout = defaultNavigation(); layout.groups[0].name = '备份中的布局'; delete layout.groups[0].nameKey;
    const result = await put(client, { baseVersion: 1, layout });
    assert.equal(result.status, 200);
    const accountKey = session.account.accountKey;
    await world.close(); world = null;
    const database = pathTools.join(directory, 'workspace.sqlite');
    await backup({ database, files: pathTools.join(directory, 'files'), target: pathTools.join(root, 'backup'), stopped: true });
    restore({ source: pathTools.join(root, 'backup'), target: pathTools.join(root, 'restored'), stopped: true });
    const restored = new Database(pathTools.join(root, 'restored/workspace.sqlite'));
    assert.deepEqual(JSON.parse(restored.prepare('SELECT layoutJson FROM workbench_navigation WHERE accountKey=?').get(accountKey).layoutJson), layout);
    restored.close();
    // Recreate the additive migration boundary of the pre-navigation product.
    const old = new Database(database);
    const accountBefore = old.prepare('SELECT * FROM auth_accounts WHERE accountKey=?').get(accountKey);
    old.exec("DROP TABLE auth_account_deletions; DELETE FROM workbench_migrations WHERE id='auth_0008_account_deletions'");
    old.exec("DROP TABLE workbench_navigation; DELETE FROM workbench_migrations WHERE moduleId='workbench-navigation'; DELETE FROM workbench_mutation_keys WHERE path='/api/workbench/navigation'");
    old.close();
    await backup({ database, files: pathTools.join(directory, 'files'), target: pathTools.join(root, 'old-backup'), stopped: true });
    restore({ source: pathTools.join(root, 'old-backup'), target: pathTools.join(root, 'old-restored'), stopped: true });
    const upgraded = new Database(pathTools.join(root, 'old-restored/workspace.sqlite'));
    assert.equal(upgraded.prepare('SELECT COUNT(*) AS n FROM workbench_navigation').get().n, 0);
    assert.ok(upgraded.prepare("SELECT id FROM workbench_migrations WHERE id='workbench_navigation_001'").get());
    assert.deepEqual(upgraded.prepare('SELECT * FROM auth_accounts WHERE accountKey=?').get(accountKey), accountBefore);
    assert.equal(upgraded.prepare('SELECT count(*) n FROM auth_account_deletions').get().n, 0);
    assert.ok(upgraded.prepare("SELECT 1 FROM workbench_migrations WHERE id='auth_0008_account_deletions'").get());
    upgraded.close();
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(root, { recursive: true, force: true });
    else console.error(`Navigation backup fixture retained at ${root}`);
  }
});
