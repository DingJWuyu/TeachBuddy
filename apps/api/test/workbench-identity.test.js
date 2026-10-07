/**
 * WB-016 public responsibility: trusted identity and source protection cannot
 * be bypassed. The fixture module supplies a real write/read surface; the
 * production guard is exercised in-process and, at process level, by the
 * isolated runner check.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { moduleCatalog, workbenchHeaders, workbenchPaths } from '@refatos/shared';
import { createWorkbench } from '../src/workbench/index.js';
import { createEnv } from '../src/config/env.js';
import {
  ACCOUNT_A,
  ACCOUNT_B,
  TEST_ORIGIN,
  cookieFor,
  createTempRoot,
  createWorkbenchContext,
  workbenchRequestHeaders
} from './workbench-test-context.js';

const PROBLEM_CONTENT_TYPE = /application\/problem\+json/;
const PROBE_ITEMS_PATH = `${workbenchPaths.modules}/workbench-probe/items`;

test('an anonymous workbench request is unauthenticated and never cached', async () => {
  const context = await createWorkbenchContext();
  try {
    const response = await request(context.app)
      .get('/api/workbench/context')
      .set('Origin', TEST_ORIGIN)
      .expect(401);

    assert.match(response.headers['content-type'], PROBLEM_CONTENT_TYPE);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body, { type: '/problems/workbench/unauthenticated' });

    const moduleResponse = await request(context.app)
      .get(PROBE_ITEMS_PATH)
      .set('Origin', TEST_ORIGIN)
      .expect(401);
    assert.deepEqual(moduleResponse.body, { type: '/problems/workbench/unauthenticated' });
  } finally {
    await context.cleanup();
  }
});

test('write source protection rejects a wrong, null or missing origin before identity', async () => {
  const context = await createWorkbenchContext();
  const writeHeaders = (extra) => workbenchRequestHeaders(context, ACCOUNT_A, {
    'Idempotency-Key': '44444444-4444-4444-8444-444444444444',
    ...extra
  });
  try {
    const wrongOrigin = await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(writeHeaders({ Origin: 'https://attacker.test' }))
      .send({ value: 'blocked' })
      .expect(403);
    assert.deepEqual(wrongOrigin.body, { type: '/problems/workbench/request-not-allowed' });

    await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(writeHeaders({ Origin: 'null' }))
      .send({ value: 'blocked' })
      .expect(403);

    // An empty Origin is a present but invalid source: no Referer fallback.
    await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(writeHeaders({ Origin: '', Referer: `${TEST_ORIGIN}/app` }))
      .send({ value: 'blocked' })
      .expect(403);

    await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set('Cookie', cookieFor(context, ACCOUNT_A))
      .set(workbenchHeaders.browserProtection, workbenchHeaders.browserProtectionValue)
      .set('Idempotency-Key', '44444444-4444-4444-8444-444444444444')
      .send({ value: 'blocked' })
      .expect(403);

    await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(writeHeaders({ Origin: undefined, Referer: 'https://attacker.test/some/page' }))
      .send({ value: 'blocked' })
      .expect(403);

    // Origin missing: a trusted Referer is accepted, and a trusted Origin is
    // not overridden by an untrusted Referer.
    await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(writeHeaders({
        Origin: undefined,
        Referer: `${TEST_ORIGIN}/app`,
        'Idempotency-Key': '55555555-5555-4555-8555-555555555555'
      }))
      .send({ value: 'accepted via referer' })
      .expect(201);

    await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(writeHeaders({
        Referer: 'https://attacker.test/some/page',
        'Idempotency-Key': '66666666-6666-4666-8666-666666666666'
      }))
      .send({ value: 'accepted via origin' })
      .expect(201);

    const rows = context.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_probe_items').get();
    assert.equal(rows.count, 2, 'only the two trusted-source writes commit');
  } finally {
    await context.cleanup();
  }
});

test('reads carry no source requirement in the frozen contract', async () => {
  const context = await createWorkbenchContext();
  try {
    // GET /api/workbench/context declares 200/401/404/503 only, so a direct
    // read without Origin or Referer must still resolve the identity.
    const read = await request(context.app)
      .get('/api/workbench/context')
      .set('Cookie', cookieFor(context, ACCOUNT_A))
      .expect(200);
    assert.deepEqual(read.body, { accountKey: ACCOUNT_A });
  } finally {
    await context.cleanup();
  }
});

test('the test runner binds two independent identities and rejects forged identity input', async () => {
  const context = await createWorkbenchContext();
  try {
    const a = await request(context.app)
      .get('/api/workbench/context')
      .set(workbenchRequestHeaders(context, ACCOUNT_A))
      .expect(200);
    const b = await request(context.app)
      .get('/api/workbench/context')
      .set(workbenchRequestHeaders(context, ACCOUNT_B))
      .expect(200);
    assert.deepEqual(a.body, { accountKey: ACCOUNT_A });
    assert.deepEqual(b.body, { accountKey: ACCOUNT_B });

    await request(context.app)
      .get('/api/workbench/context')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', `${workbenchHeaders.sessionCookie}=not-a-real-token`)
      .expect(401);

    // A client cannot choose a principal through the body or an identity header.
    const forgedBody = await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(workbenchRequestHeaders(context, ACCOUNT_B, { 'Idempotency-Key': '11111111-1111-4111-8111-111111111111' }))
      .send({ value: 'forged', accountKey: ACCOUNT_A, accountId: ACCOUNT_A })
      .expect(422);
    assert.equal(forgedBody.body.type, '/problems/workbench/invalid-input');
    assert.equal(forgedBody.body.field, '/accountId');
    assert.equal(forgedBody.body.reason, 'unknown-field');

    const created = await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(workbenchRequestHeaders(context, ACCOUNT_B, {
        'Idempotency-Key': '22222222-2222-4222-8222-222222222222',
        'X-Workbench-Account': ACCOUNT_A
      }))
      .send({ value: 'owned by B' })
      .expect(201);

    // The forged header had no effect: the object belongs to B, and A cannot see it.
    await request(context.app)
      .get(`${PROBE_ITEMS_PATH}/${created.body.id}`)
      .set(workbenchRequestHeaders(context, ACCOUNT_A))
      .expect(404);
    const aList = await request(context.app)
      .get(PROBE_ITEMS_PATH)
      .set(workbenchRequestHeaders(context, ACCOUNT_A))
      .expect(200);
    assert.deepEqual(aList.body, { items: [] });
  } finally {
    await context.cleanup();
  }
});

test('another account cannot read or list an account object and never sees its content', async () => {
  const context = await createWorkbenchContext();
  try {
    const created = await request(context.app)
      .post(PROBE_ITEMS_PATH)
      .set(workbenchRequestHeaders(context, ACCOUNT_A, { 'Idempotency-Key': '33333333-3333-4333-8333-333333333333' }))
      .send({ value: 'A private value' })
      .expect(201);

    const bRead = await request(context.app)
      .get(`${PROBE_ITEMS_PATH}/${created.body.id}`)
      .set(workbenchRequestHeaders(context, ACCOUNT_B))
      .expect(404);
    assert.deepEqual(bRead.body, { type: '/problems/workbench/not-found' });
    assert.equal(JSON.stringify(bRead.body).includes('A private value'), false);

    const bList = await request(context.app)
      .get(PROBE_ITEMS_PATH)
      .set(workbenchRequestHeaders(context, ACCOUNT_B))
      .expect(200);
    assert.deepEqual(bList.body, { items: [] });

    const aList = await request(context.app)
      .get(PROBE_ITEMS_PATH)
      .set(workbenchRequestHeaders(context, ACCOUNT_A))
      .expect(200);
    assert.equal(aList.body.items.length, 1);
    assert.equal(aList.body.items[0].value, 'A private value');
  } finally {
    await context.cleanup();
  }
});

test('a production process refuses the test-principal identity mode', () => {
  const rootDir = createTempRoot('teacher-workspace-refused-');
  const sqlitePath = path.join(rootDir, 'data', 'workspace.sqlite');
  const productionEnv = createEnv({
    nodeEnv: 'production',
    sqlitePath,
    workbench: {
      mode: 'test-principal',
      testPrincipals: [ACCOUNT_A],
      trustedOrigins: [TEST_ORIGIN]
    }
  });

  assert.throws(
    () => createWorkbench({ env: productionEnv }),
    /test-principal identity mode is not allowed in production/
  );

  const fixtureEnv = createEnv({
    nodeEnv: 'production',
    sqlitePath,
    workbench: {
      mode: 'none',
      catalogOverride: moduleCatalog
    }
  });

  assert.throws(
    () => createWorkbench({ env: fixtureEnv }),
    /test fixture modules are not allowed in production/
  );

  fs.rmSync(rootDir, { recursive: true, force: true });
});
