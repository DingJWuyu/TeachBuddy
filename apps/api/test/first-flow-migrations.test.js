// WB-019 storage migration coverage: the module runner must give a fresh
// database and a previous-stage account/layout database the same questions and
// lessons tables, keep the old rows, and never repeat an applied migration ID.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDataStore } from '../src/core/dataStore.js';
import {
  createFirstFlowHarness,
  lessonSample,
  manualQuestionSample,
  sectionInput
} from './first-flow-harness.js';

const QUESTIONS = '/api/modules/questions/items';
const LESSONS = '/api/modules/lessons/items';
const MIGRATION_IDS = ['agent_001_conversations', 'classes_0001_class_tables', 'lessons_0001_lesson_tables', 'lessons_0003_order', 'lessons_materials_001', 'materials_files_001', 'materials_jobs_001', 'math_001', 'questions_0001_question_items', 'questions_materials_001', 'reliability_001_manual_data', 'reliability_preferences_001', 'resources_001', 'schedule_0001_settings_entries', 'schedule_reminders_0001_notifications'];

function appliedMigrations(harness) {
  return harness
    .query('SELECT id FROM workbench_migrations ORDER BY id')
    .map((row) => row.id);
}

function tableNames(harness) {
  return harness
    .query("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((row) => row.name);
}

test('WB-019: a fresh database applies both module migrations once and survives restart', async () => {
  const harness = await createFirstFlowHarness();
  try {
    assert.deepEqual(appliedMigrations(harness), MIGRATION_IDS);
    for (const table of ['question_items', 'lesson_items', 'lesson_sections', 'lesson_references']) {
      assert.ok(tableNames(harness).includes(table), `${table} exists after migration`);
    }

    const api = harness.agent(harness.createAccount('teacher-a'));
    const question = (
      await api.post(QUESTIONS, manualQuestionSample(), { key: harness.nextUuid() }).expect(201)
    ).body;

    harness.restart();
    assert.deepEqual(appliedMigrations(harness), MIGRATION_IDS, 'applied IDs are not run twice');
    assert.equal((await api.get(`${QUESTIONS}/${question.id}`).expect(200)).body.version, 1);
  } finally {
    harness.close();
  }
});

test('WB-019: a previous-stage account and layout database upgrades without losing rows', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b13-migration-'));
  const sqlitePath = path.join(rootDir, 'workbench.sqlite');
  let harness = null;
  try {
    // The previous stage owns the shell tables: one account, its saved layout
    // and a password-reset record. B13 must add module tables next to them.
    const previous = createDataStore({ sqlitePath });
    const user = previous.createUser({
      name: '既有老师',
      email: 'existing@example.test',
      passwordHash: 'hash',
      role: 'teacher'
    });
    const layout = previous.forAccount(user.id).create('workspaceLayouts', {
      hiddenModuleIds: ['schedule'],
      groups: [{ id: 'group-1', moduleIds: ['questions'] }],
      ungroupedModuleIds: ['lessons']
    });
    previous.createPasswordResetCode({
      userId: user.id,
      codeHash: 'code-hash',
      codeSalt: 'code-salt',
      expiresAt: '2026-09-22T00:00:00.000Z',
      usedAt: null
    });
    previous.close();

    harness = await createFirstFlowHarness({ databasePath: sqlitePath });
    assert.deepEqual(appliedMigrations(harness), MIGRATION_IDS);
    for (const table of ['question_items', 'lesson_items', 'lesson_sections', 'lesson_references']) {
      assert.ok(tableNames(harness).includes(table), `${table} exists after upgrade`);
    }

    assert.deepEqual(harness.query('SELECT id, email, role FROM users'), [
      { id: user.id, email: 'existing@example.test', role: 'teacher' }
    ]);
    const [storedLayout] = harness.query(
      'SELECT id, ownerId, hiddenModuleIds, groups, ungroupedModuleIds FROM workspaceLayouts'
    );
    assert.equal(storedLayout.id, layout.id);
    assert.equal(storedLayout.ownerId, user.id);
    assert.deepEqual(JSON.parse(storedLayout.hiddenModuleIds), ['schedule']);
    assert.deepEqual(JSON.parse(storedLayout.groups), [{ id: 'group-1', moduleIds: ['questions'] }]);
    assert.deepEqual(JSON.parse(storedLayout.ungroupedModuleIds), ['lessons']);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM passwordResetCodes'), 1);

    const api = harness.agent(harness.createAccount('teacher-a'));
    const question = (
      await api.post(QUESTIONS, manualQuestionSample(), { key: harness.nextUuid() }).expect(201)
    ).body;
    const lesson = (
      await api.post(LESSONS, lessonSample({ sections: [sectionInput(harness.nextUuid())] }), {
        key: harness.nextUuid()
      }).expect(201)
    ).body;

    harness.restart();
    assert.deepEqual(appliedMigrations(harness), MIGRATION_IDS, 'the upgraded database is not re-migrated');
    assert.equal((await api.get(`${QUESTIONS}/${question.id}`).expect(200)).body.version, 1);
    assert.equal((await api.get(`${LESSONS}/${lesson.id}`).expect(200)).body.version, 1);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM users'), 1, 'the old account row is untouched');
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM workspaceLayouts'), 1);
  } finally {
    harness?.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
