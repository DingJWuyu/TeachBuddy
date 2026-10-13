import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { ACCOUNT_A, ACCOUNT_B, createWorkbenchContext, workbenchRequestHeaders } from './workbench-test-context.js';

test('async input preparation can replay a committed HTTP write without reopening its input', async () => {
  const context = await createWorkbenchContext();
  const input = {
    principal: { accountKey: ACCOUNT_A },
    key: '901ad697-ec63-4a28-bb9b-0161cde4cb76',
    method: 'POST',
    path: '/api/modules/workbench-probe/items',
    body: { value: 'prepared input' }
  };
  try {
    const { mutations } = context.workbench;
    assert.equal(mutations.peek(input), null);
    assert.equal(mutations.count(ACCOUNT_A), 0);
    const first = await request(context.app).post(input.path)
      .set(workbenchRequestHeaders(context, ACCOUNT_A, { 'Idempotency-Key': input.key }))
      .send(input.body).expect(201);
    assert.deepEqual(mutations.peek(input), { status: 201, body: first.body });
    assert.equal(mutations.peek({ ...input, principal: { accountKey: ACCOUNT_B } }), null);
    assert.throws(() => mutations.peek({ ...input, body: { value: 'different' } }),
      error => error.status === 409);
    const replay = mutations.execute(input, () => { throw new Error('input is no longer available'); });
    assert.deepEqual(replay, { status: 201, body: first.body });
    assert.equal(mutations.count(ACCOUNT_A), 1);
  } finally {
    await context.cleanup();
  }
});
