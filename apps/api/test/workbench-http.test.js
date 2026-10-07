/**
 * WB-018 public responsibility: explicit rejection and honest unknown results.
 *
 * The workbench transport fixes the request-side statuses (400/413/415/422),
 * the single-error selection for invalid input, and the 503 mapping for an
 * unknown storage failure. Source/protection rejections live in the identity
 * suite; this suite keeps identity valid so each rejection stands alone.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { workbenchHeaders, workbenchPaths } from '@refatos/shared';
import {
  ACCOUNT_A,
  TEST_ORIGIN,
  createWorkbenchContext,
  workbenchRequestHeaders
} from './workbench-test-context.js';

const PATH_ITEMS = `${workbenchPaths.modules}/workbench-probe/items`;
const KEY_1 = 'dddddddd-1111-4111-8111-dddddddddddd';

function writeRequest(context, { key = KEY_1, body = { value: 'ok' }, headers = {} } = {}) {
  const agent = request(context.app)
    .post(PATH_ITEMS)
    .set(workbenchRequestHeaders(context, undefined, headers));
  if (key !== null) agent.set('Idempotency-Key', key);
  return agent.send(body);
}

test('the context response is JSON and never cached', async () => {
  const context = await createWorkbenchContext();
  try {
    const response = await request(context.app)
      .get('/api/workbench/context')
      .set(workbenchRequestHeaders(context))
      .expect(200);
    assert.match(response.headers['content-type'], /application\/json/);
    assert.equal(response.headers['cache-control'], 'no-store');
  } finally {
    await context.cleanup();
  }
});

test('a write without the fixed browser protection header is refused before any change', async () => {
  const context = await createWorkbenchContext();
  try {
    const missing = await request(context.app)
      .post(PATH_ITEMS)
      .set('Origin', TEST_ORIGIN)
      .set(workbenchRequestHeaders(context, undefined, { [workbenchHeaders.browserProtection]: '' }))
      .set('Idempotency-Key', KEY_1)
      .send({ value: 'blocked' })
      .expect(403);
    assert.deepEqual(missing.body, { type: '/problems/workbench/request-not-allowed' });

    const wrongValue = await request(context.app)
      .post(PATH_ITEMS)
      .set(workbenchRequestHeaders(context, undefined, { [workbenchHeaders.browserProtection]: 'yes' }))
      .set('Idempotency-Key', KEY_1)
      .send({ value: 'blocked' })
      .expect(403);
    assert.deepEqual(wrongValue.body, { type: '/problems/workbench/request-not-allowed' });

    const rows = context.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_probe_items').get();
    assert.equal(rows.count, 0);
  } finally {
    await context.cleanup();
  }
});

test('media type, malformed JSON and payload size map to their contract statuses', async () => {
  const context = await createWorkbenchContext();
  try {
    const wrongType = await request(context.app)
      .post(PATH_ITEMS)
      .set(workbenchRequestHeaders(context, undefined, { 'Content-Type': 'text/plain' }))
      .set('Idempotency-Key', KEY_1)
      .send('value=ok')
      .expect(415);
    assert.deepEqual(wrongType.body, { type: '/problems/workbench/unsupported-media-type' });
    assert.match(wrongType.headers['content-type'], /application\/problem\+json/);

    const malformed = await request(context.app)
      .post(PATH_ITEMS)
      .set(workbenchRequestHeaders(context, undefined, { 'Content-Type': 'application/json' }))
      .set('Idempotency-Key', KEY_1)
      .send('{"value":')
      .expect(400);
    assert.deepEqual(malformed.body, { type: '/problems/workbench/malformed-json' });

    const oversized = await request(context.app)
      .post(PATH_ITEMS)
      .set(workbenchRequestHeaders(context, undefined, { 'Content-Type': 'application/json' }))
      .set('Idempotency-Key', KEY_1)
      .send(JSON.stringify({ value: 'x'.repeat(2 * 1024 * 1024 + 64) }))
      .expect(413);
    assert.deepEqual(oversized.body, { type: '/problems/workbench/payload-too-large' });
  } finally {
    await context.cleanup();
  }
});

test('the idempotency key header is required and must be a UUID', async () => {
  const context = await createWorkbenchContext();
  try {
    const missing = await writeRequest(context, { key: null }).expect(422);
    assert.deepEqual(missing.body, {
      type: '/problems/workbench/invalid-input',
      field: '/headers/Idempotency-Key',
      reason: 'required'
    });

    const notUuid = await writeRequest(context, { key: 'not-a-uuid' }).expect(422);
    assert.deepEqual(notUuid.body, {
      type: '/problems/workbench/invalid-input',
      field: '/headers/Idempotency-Key',
      reason: 'invalid-type'
    });
  } finally {
    await context.cleanup();
  }
});

test('invalid input returns exactly one located error in the frozen order', async () => {
  const context = await createWorkbenchContext();
  try {
    const missing = await writeRequest(context, { body: {} }).expect(422);
    assert.deepEqual(missing.body, {
      type: '/problems/workbench/invalid-input',
      field: '/value',
      reason: 'required'
    });

    const wrongType = await writeRequest(context, { body: { value: 42 } }).expect(422);
    assert.equal(wrongType.body.field, '/value');
    assert.equal(wrongType.body.reason, 'invalid-type');

    const empty = await writeRequest(context, { body: { value: '' } }).expect(422);
    assert.equal(empty.body.field, '/value');
    assert.equal(empty.body.reason, 'empty-content');

    const tooLong = await writeRequest(context, { body: { value: 'x'.repeat(201) } }).expect(422);
    assert.equal(tooLong.body.field, '/value');
    assert.equal(tooLong.body.reason, 'out-of-range');
  } finally {
    await context.cleanup();
  }
});

test('unknown fields are reported before field content, ordered by key ascending', async () => {
  const context = await createWorkbenchContext();
  try {
    const response = await writeRequest(context, {
      body: { value: 42, zz: 1, aa: 2 }
    }).expect(422);

    assert.deepEqual(response.body, {
      type: '/problems/workbench/invalid-input',
      field: '/aa',
      reason: 'unknown-field'
    });
  } finally {
    await context.cleanup();
  }
});

test('an unknown storage failure rolls back and maps to temporarily-unavailable', async () => {
  const context = await createWorkbenchContext();
  try {
    const response = await request(context.app)
      .post(`${PATH_ITEMS}/00000000-0000-4000-8000-000000000000/explode`)
      .set(workbenchRequestHeaders(context, undefined, { 'Idempotency-Key': KEY_1 }))
      .send({ value: 'boom' })
      .expect(503);

    assert.deepEqual(response.body, { type: '/problems/workbench/temporarily-unavailable' });
    assert.equal(JSON.stringify(response.body).includes('simulated'), false);
    const rows = context.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_probe_items').get();
    assert.equal(rows.count, 0);
    assert.equal(context.workbench.mutations.count(ACCOUNT_A), 0);
  } finally {
    await context.cleanup();
  }
});

test('workbench module paths are owned only for catalog module IDs', async () => {
  // A catalog entry without a compile-time mapping stays a workbench path:
  // identity and source checks apply, then the object is not found.
  const context = await createWorkbenchContext({
    extraCatalogEntries: [{
      id: 'unavailable',
      name: '日程',
      path: '/unavailable',
      navigation: 'top',
      auxiliaryPanel: false,
      requires: []
    }]
  });
  try {
    const notEnabled = await request(context.app)
      .get('/api/modules/unavailable/items')
      .set(workbenchRequestHeaders(context))
      .expect(404);
    assert.deepEqual(notEnabled.body, { type: '/problems/workbench/not-found' });

    const anonymous = await request(context.app)
      .get('/api/modules/unavailable/items')
      .set('Origin', TEST_ORIGIN)
      .expect(401);
    assert.deepEqual(anonymous.body, { type: '/problems/workbench/unauthenticated' });

    // An ID outside the catalog is a workbench not-found, never a legacy error
    // shape, with or without a session.
    const unknownAnonymous = await request(context.app)
      .get('/api/modules/example')
      .expect(404);
    assert.deepEqual(unknownAnonymous.body, { type: '/problems/workbench/not-found' });

    const unknownWithSession = await request(context.app)
      .get('/api/modules/example')
      .set(workbenchRequestHeaders(context))
      .expect(404);
    assert.deepEqual(unknownWithSession.body, { type: '/problems/workbench/not-found' });

    // An enabled module's undeclared sub-path is still a workbench path.
    const undeclared = await request(context.app)
      .post(`${PATH_ITEMS}/nope`)
      .set(workbenchRequestHeaders(context, ACCOUNT_A, { 'Idempotency-Key': KEY_1 }))
      .send({ value: 'x' })
      .expect(404);
    assert.deepEqual(undeclared.body, { type: '/problems/workbench/not-found' });
  } finally {
    await context.cleanup();
  }
});

test('the composed app mounts the catalog handler on the exact contract path', async () => {
  const context = await createWorkbenchContext();
  try {
    // B15 mounts the B12 handler at the contract path inside `createApp`, so the
    // composed app answers it directly with its own identity guard.
    const response = await request(context.app)
      .get(workbenchPaths.modules)
      .set(workbenchRequestHeaders(context))
      .expect(200);

    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.body.version, 3);
    // Only mapped implementations are enabled: the fixture probe and the two
    // product modules of this branch.
    assert.deepEqual(response.body.items.map((entry) => entry.id), ['questions', 'lessons', 'math', 'resources', 'classes', 'schedule', 'workbench-probe']);

    // The retired legacy Bearer route never answers this path: a bearer token is
    // not a workbench identity, so the contract 401 problem is returned.
    const legacyAttempt = await request(context.app)
      .get(workbenchPaths.modules)
      .set('Authorization', 'Bearer retired-legacy-token')
      .expect(401);
    assert.deepEqual(legacyAttempt.body, { type: '/problems/workbench/unauthenticated' });

    const anonymous = await request(context.app)
      .get(workbenchPaths.modules)
      .expect(401);
    assert.deepEqual(anonymous.body, { type: '/problems/workbench/unauthenticated' });

    // A catalog that enables no implementation projects an empty enabled set.
    const bare = await createWorkbenchContext({ fixtures: [] });
    try {
      const empty = await request(bare.app)
        .get(workbenchPaths.modules)
        .set(workbenchRequestHeaders(bare))
        .expect(200);
      assert.equal(empty.body.version, 3);
      assert.deepEqual(empty.body.items.map((entry) => entry.id), ['questions', 'lessons', 'math', 'resources', 'classes', 'schedule']);
    } finally {
      await bare.cleanup();
    }
  } finally {
    await context.cleanup();
  }
});
