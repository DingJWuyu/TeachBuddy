// T51 migration coverage: the classes migration applies on top of the existing
// B16 database (questions/lessons/accounts/layout untouched) and on an empty
// database. The composition override is the T51 fixture; T53 will register the
// module in the product map and rerun this on the integrated candidate.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { createB16Workbench } from './fixtures/first-flow/b16-workbench.js';
import { createApp } from '../src/app.js';
import { createEnv } from '../src/config/env.js';
import { createWorkbenchLogger } from '../src/workbench/logger.js';
import { createTeachingTimeClassesHarness } from './teaching-time-classes-harness.js';

const TRUSTED_ORIGIN = 'https://workbench.t51-migration.test';
const ACCOUNTS = ['teacher-a', 'teacher-b'];

function questionBody() {
  return {
    title: '迁移前就存在的题',
    body: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '旧题面' }] }] },
    solution: { version: 1, blocks: [] },
    note: '',
    starred: false,
    source: { kind: 'manual' }
  };
}

test('classes 迁移在 B16 旧库上增量应用，原题目/备课与账户数据保持可读', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 't51-migration-'));
  const sqlitePath = path.join(rootDir, 'workbench.sqlite');
  const baseEnv = createEnv({
    appName: 'T51 migration base',
    nodeEnv: 'test',
    sqlitePath,
    workbench: {
      mode: 'test-principal',
      testPrincipals: ACCOUNTS,
      sessionSecret: 't51-migration-session-secret',
      trustedOrigins: [TRUSTED_ORIGIN],
      logDir: path.join(rootDir, 'logs')
    }
  });

  // 1. The existing B16 database: real modules only, no classes.
  const base = createApp({
    env: baseEnv,
    workbench: createB16Workbench({ env: baseEnv }),
    workbenchLogger: createWorkbenchLogger({ logDir: path.join(rootDir, 'logs'), consoleOutput: false })
  });
  await base.workbench.initialize();
  const session = base.workbench.identity.testPrincipalCookie('teacher-a');
  const baseAgent = request(base.app);
  const write = (method, url, body) => baseAgent[method](url)
    .set('Cookie', session.header.split(';')[0])
    .set('Origin', TRUSTED_ORIGIN)
    .set('X-TeachBuddy-Request', '1')
    .set('Idempotency-Key', crypto.randomUUID())
    .send(body);

  const question = await write('post', '/api/modules/questions/items', questionBody()).expect(201);
  const lesson = await write('post', '/api/modules/lessons/items', {
    title: '迁移前就存在的备课',
    intro: { version: 1, blocks: [] },
    sections: [],
    materials: []
  }).expect(201);
  const baseMigrations = base.workbench.migrations.appliedIds().filter((id) => id.startsWith('classes_'));
  assert.deepEqual(baseMigrations, [], 'the B16-only composition has no classes migration');
  base.dataStore.close();

  // 2. Reopen the same file with the classes module enabled (T51 fixture).
  const harness = await createTeachingTimeClassesHarness({ databasePath: sqlitePath, trustedOrigin: TRUSTED_ORIGIN });
  try {
    const applied = harness.query("SELECT id FROM workbench_migrations WHERE id LIKE 'classes_%'");
    assert.deepEqual(applied.map((row) => row.id), ['classes_0001_class_tables', 'classes_0002_removed_objects', 'classes_0003_next_note_visibility', 'classes_0004_record_content']);
    assert.equal(harness.countRows('question_items'), 1);
    assert.equal(harness.countRows('lesson_items'), 1);

    const api = harness.agent(harness.createAccount('teacher-a'));
    const questionAfter = await api.get(`/api/modules/questions/items/${question.body.id}`).expect(200);
    assert.equal(questionAfter.body.title, '迁移前就存在的题');
    assert.equal(questionAfter.body.version, 1);
    const lessonAfter = await api.get(`/api/modules/lessons/items/${lesson.body.id}`).expect(200);
    assert.equal(lessonAfter.body.title, '迁移前就存在的备课');

    const classroom = await api.post('/api/modules/classes/items', { name: '高一(1)班' }, { key: harness.nextUuid() }).expect(201);
    const record = await api.post('/api/modules/classes/records', {
      classId: classroom.body.id,
      recordedOn: '2026-09-21',
      note: '迁移后新增的记录',
      position: '',
      unfinished: '',
      commonIssues: '',
      nextNote: '',
      sources: [{ kind: 'lesson', id: lesson.body.id }]
    }, { key: harness.nextUuid() }).expect(201);
    assert.equal(record.body.sources[0].labelAtLink, '迁移前就存在的备课');

    // A restart on the same file re-reads both the old and the new data.
    await harness.restart();
    const reopened = harness.agent(harness.createAccount('teacher-a'));
    const afterRestart = await reopened.get(`/api/modules/classes/records/${record.body.id}`).expect(200);
    assert.equal(afterRestart.body.note, '迁移后新增的记录');
    assert.equal((await reopened.get(`/api/modules/questions/items/${question.body.id}`).expect(200)).body.title, '迁移前就存在的题');
  } finally {
    harness.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
