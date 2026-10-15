// Production composition: old Bearer endpoints are retired. Auth protocol
// behavior is covered by auth-contract-* and real HTTPS auth-integration.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createIntegration } from './fixtures/auth-integration/harness.js';

test('application requires explicit persistent code-secret and HTTPS origin', () => {
  assert.throws(() => createApp({ env: { authCodeSecret: '' } }), /AUTH_CODE_SECRET/);
  assert.throws(() => createApp({ env: { authCodeSecret: 'test', workbench: { publicOrigin: 'http://localhost' } } }), /HTTPS/);
});

test('legacy bearer, me, password-reset and layout routes cannot authorize the product', async () => {
  const world = await createIntegration();
  try {
    for (const table of ['users', 'workspaceLayouts', 'passwordResetCodes', 'app_metadata']) {
      assert.equal(world.workbench.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table), undefined, `new databases must not create ${table}`);
    }
    const client = world.client();
    for (const [method, endpoint] of [['GET', '/api/auth/me'], ['GET', '/api/workspace/layout'], ['PUT', '/api/workspace/layout'], ['POST', '/api/auth/password-reset/request'], ['POST', '/api/auth/password-reset/confirm']]) {
      assert.equal((await client.request(method, endpoint, { body: method === 'GET' ? undefined : {}, headers: { Authorization: 'Bearer retired-token' } })).status, 404);
    }
    assert.equal((await client.request('GET', '/api/workbench/context', { headers: { Authorization: 'Bearer retired-token' } })).status, 401);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) n FROM auth_accounts').get().n, 0);
  } finally { await world.close(); }
});

// Exercise the public application lifetime against the real SQLite/lock owner.
import { createWorkbenchContext } from './workbench-test-context.js';
test('application close shares a pending shutdown and retries after failure', async () => {
  const context = await createWorkbenchContext();
  const closeWorkbench = context.workbench.close.bind(context.workbench);
  let attempts = 0;
  context.workbench.close = async () => {
    if (++attempts === 1) throw new Error('injected shutdown failure');
    await closeWorkbench();
  };
  try {
    const first = context.close();
    assert.equal(context.close(), first);
    await assert.rejects(first, /injected shutdown failure/);
    assert.equal(context.workbench.db.open, true);
    await context.close();
    assert.equal(context.workbench.db.open, false);
    assert.equal(attempts, 2);
    const restarted = await createWorkbenchContext({ rootDir: context.rootDir, sqlitePath: context.sqlitePath });
    await restarted.close();
  } finally { await context.cleanup(); }
});
