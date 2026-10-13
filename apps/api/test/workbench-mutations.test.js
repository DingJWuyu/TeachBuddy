/**
 * WB-012 public responsibility: one atomic idempotent write.
 *
 * Covers replay after commit, key reuse, cross-account scoping, rollback of a
 * failed transaction (business row + confirmed-request record together), retry
 * after failure, concurrent identical requests, and replay across a process
 * restart on the same isolated database.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createMutations } from '../src/workbench/mutations.js';
import { ACCOUNT_A, ACCOUNT_B, createWorkbenchContext, workbenchRequestHeaders } from './workbench-test-context.js';

import { openWorkbenchDatabase } from '../src/workbench/storage.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PATH_ITEMS = '/api/modules/workbench-probe/items';
const KEY_1 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const KEY_2 = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const KEY_3 = 'cccccccc-3333-4333-8333-cccccccccccc';

function postItem(context, { key, body, accountKey }) {
  return request(context.app)
    .post(PATH_ITEMS)
    .set(workbenchRequestHeaders(context, accountKey, { 'Idempotency-Key': key }))
    .send(body);
}

test('replaying the same key and request returns the original result exactly once', async () => {
  const context = await createWorkbenchContext();
  try {
    const first = await postItem(context, { key: KEY_1, body: { value: 'replay me' } }).expect(201);
    const replay = await postItem(context, { key: KEY_1, body: { value: 'replay me' } }).expect(201);

    assert.deepEqual(replay.body, first.body);
    assert.equal(context.workbench.mutations.count(ACCOUNT_A), 1);

    const list = await request(context.app)
      .get(PATH_ITEMS)
      .set(workbenchRequestHeaders(context))
      .expect(200);
    assert.equal(list.body.items.length, 1);
  } finally {
    await context.cleanup();
  }
});

test('object key order does not change the request fingerprint but the body does', async () => {
  const context = await createWorkbenchContext();
  try {
    const before = await postItem(context, {
      key: KEY_1,
      body: { value: 'ordered' }
    }).expect(201);

    // Same logical body, different key order in the JSON text: still the same
    // confirmed request, so it replays.
    const replay = await request(context.app)
      .post(PATH_ITEMS)
      .set(workbenchRequestHeaders(context))
      .set('Idempotency-Key', KEY_1)
      .set('Content-Type', 'application/json')
      .send('{"value":"ordered"}')
      .expect(201);
    assert.deepEqual(replay.body, before.body);

    // Different body under the same key is a contract conflict.
    const reused = await postItem(context, { key: KEY_1, body: { value: 'different' } }).expect(409);
    assert.deepEqual(reused.body, { type: '/problems/workbench/idempotency-key-reused' });
    assert.equal(context.workbench.mutations.count(ACCOUNT_A), 1);
  } finally {
    await context.cleanup();
  }
});

test('a failed write rolls back the business row and the confirmed-request record', async () => {
  const context = await createWorkbenchContext();
  try {
    const failed = await request(context.app)
      .post(`${PATH_ITEMS}/00000000-0000-4000-8000-000000000000/fail`)
      .set(workbenchRequestHeaders(context, undefined, { 'Idempotency-Key': KEY_2 }))
      .send({ value: 'never stored' })
      .expect(503);
    assert.deepEqual(failed.body, { type: '/problems/workbench/temporarily-unavailable' });

    const rows = context.workbench.db
      .prepare('SELECT COUNT(*) AS count FROM workbench_probe_items')
      .get();
    assert.equal(rows.count, 0);
    assert.equal(context.workbench.mutations.count(ACCOUNT_A), 0);

    // The same key is still usable after the failure.
    const retry = await postItem(context, { key: KEY_2, body: { value: 'stored now' } }).expect(201);
    assert.equal(retry.body.value, 'stored now');
    assert.equal(context.workbench.mutations.count(ACCOUNT_A), 1);
  } finally {
    await context.cleanup();
  }
});

test('the same key in another account is an independent request', async () => {
  const context = await createWorkbenchContext();
  try {
    const mine = await postItem(context, { key: KEY_1, body: { value: 'account A' } }).expect(201);
    const theirs = await postItem(context, {
      key: KEY_1,
      body: { value: 'account B' },
      accountKey: ACCOUNT_B
    }).expect(201);

    assert.notEqual(mine.body.id, theirs.body.id);
    assert.equal(context.workbench.mutations.count(ACCOUNT_A), 1);
    assert.equal(context.workbench.mutations.count(ACCOUNT_B), 1);
  } finally {
    await context.cleanup();
  }
});

test('concurrent identical requests commit only once and both see the confirmed result', async () => {
  const context = await createWorkbenchContext();
  try {
    const [first, second] = await Promise.all([
      postItem(context, { key: KEY_3, body: { value: 'concurrent' } }).expect(201),
      postItem(context, { key: KEY_3, body: { value: 'concurrent' } }).expect(201)
    ]);

    assert.deepEqual(first.body, second.body);
    assert.equal(context.workbench.mutations.count(ACCOUNT_A), 1);
    const rows = context.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_probe_items').get();
    assert.equal(rows.count, 1);
  } finally {
    await context.cleanup();
  }
});

test('a confirmed request replays after the API process restarts on the same database', async () => {
  const first = await createWorkbenchContext();
  let original;
  try {
    original = await postItem(first, { key: KEY_1, body: { value: 'survives restart' } }).expect(201);
  } finally {
    await first.dataStore.close();
  }

  const restarted = await createWorkbenchContext({
    sqlitePath: first.sqlitePath,
    rootDir: first.rootDir
  });
  try {
    const replay = await postItem(restarted, { key: KEY_1, body: { value: 'survives restart' } }).expect(201);
    assert.deepEqual(replay.body, original.body);

    const rows = restarted.workbench.db.prepare('SELECT COUNT(*) AS count FROM workbench_probe_items').get();
    assert.equal(rows.count, 1);
    assert.equal(restarted.workbench.mutations.count(ACCOUNT_A), 1);
    assert.deepEqual(
      restarted.workbench.migrations.appliedIds(),
      ['materials_files_001', 'materials_jobs_001', 'materials_recognition_001', 'reliability_001_manual_data', 'reliability_preferences_001', 'workbench_navigation_001', 'questions_0001_question_items', 'questions_materials_001', 'math_001', 'resources_001', 'resources_002_file_history', 'resources_003_text_cache', 'schedule_0001_settings_entries', 'schedule_0002_calendar_details', 'schedule_0003_remove_teaching_links', 'schedule_reminders_0001_notifications', 'classroom_0001_roster_assessments', 'workbench_probe_init', 'workbench_retirement_001_lessons', 'workbench_retirement_002_classes', 'agent_001_conversations']
    );
  } finally {
    await restarted.dataStore.close();
    fs.rmSync(restarted.rootDir, { recursive: true, force: true });
  }
});

test('mutations.execute rejects an asynchronous write callback inside the transaction', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-workspace-mutations-'));
  const db = openWorkbenchDatabase({ sqlitePath: path.join(rootDir, 'mutations.sqlite') });
  const mutations = createMutations({ db });
  try {
    assert.throws(
      () => mutations.execute(
        { principal: { accountKey: ACCOUNT_A }, key: KEY_1, method: 'POST', path: '/x', body: {} },
        () => Promise.resolve({ status: 201, body: {} })
      ),
      /must be synchronous/
    );
    assert.equal(mutations.count(ACCOUNT_A), 0);

    assert.throws(
      () => mutations.execute(
        { principal: { accountKey: ACCOUNT_A }, key: KEY_2, method: 'POST', path: '/x', body: {} },
        () => ({ status: 500, body: {} })
      ),
      /must return a 2xx/
    );
    assert.equal(mutations.count(ACCOUNT_A), 0);
  } finally {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
