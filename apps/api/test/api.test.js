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
    const client = world.client();
    for (const [method, endpoint] of [['GET', '/api/auth/me'], ['GET', '/api/workspace/layout'], ['PUT', '/api/workspace/layout'], ['POST', '/api/auth/password-reset/request'], ['POST', '/api/auth/password-reset/confirm']]) {
      assert.equal((await client.request(method, endpoint, { body: method === 'GET' ? undefined : {}, headers: { Authorization: 'Bearer retired-token' } })).status, 404);
    }
    assert.equal((await client.request('GET', '/api/workbench/context', { headers: { Authorization: 'Bearer retired-token' } })).status, 401);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) n FROM auth_accounts').get().n, 0);
  } finally { await world.close(); }
});
