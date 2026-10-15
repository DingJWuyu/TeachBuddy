import { classRetirementMigrations } from '../src/workbench/retire-classes.js';
import { retirementMigrations } from '../src/workbench/retire-lessons.js';
import { recognitionMigrations } from '../src/workbench/recognition/migrations.js';
import { migrations as reliabilityMigrations } from '../src/workbench/reliability/storage.js';
import { preferenceMigrations } from '../src/workbench/preferences.js';
import { navigationMigrations } from '../src/workbench/navigation.js';
import { migrations as agentMigrations } from '../src/agent/store.js';
import { jobMigrations } from '../src/workbench/jobs/migrations.js';
/**
 * WB-019 public responsibility: migrations on an empty database and on a
 * database that already holds an account and layout, with startup failing
 * instead of serving a half-migrated database.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { fileMigrations } from '../src/workbench/files/migrations.js';
import { createMigrationRunner, prefixForModule } from '../src/workbench/migrations.js';
import { openWorkbenchDatabase } from '../src/workbench/storage.js';
import { createWorkbench } from '../src/workbench/index.js';
import { createEnv } from '../src/config/env.js';
import { createDataStore } from './fixtures/legacy-source/dataStore.js';
import { hashPassword } from './fixtures/legacy-source/auth.js';
import { moduleCatalog } from '@teachbuddy/shared';
import { startServer } from '../src/server.js';
import { ACCOUNT_A, createTempRoot, createWorkbenchContext } from './workbench-test-context.js';
import { resolveFixtureSets } from './fixtures/first-flow/catalog.js';

const PRODUCT_MIGRATIONS = ['materials_files_001', 'materials_jobs_001', 'materials_recognition_001', 'reliability_001_manual_data', 'reliability_preferences_001', 'workbench_navigation_001', 'questions_0001_question_items', 'questions_materials_001', 'math_001', 'resources_001', 'resources_002_file_history', 'resources_003_text_cache', 'schedule_0001_settings_entries', 'schedule_0002_calendar_details', 'schedule_0003_remove_teaching_links', 'schedule_reminders_0001_notifications', 'classroom_0001_roster_assessments'];

test('an empty database applies migrations once and records them in the ledger', async () => {
  const context = await createWorkbenchContext();
  try {
    assert.deepEqual(
      context.workbench.migrations.appliedIds(),
      [...PRODUCT_MIGRATIONS, 'workbench_probe_init', 'workbench_retirement_001_lessons', 'workbench_retirement_002_classes', 'agent_001_conversations']
    );

    const table = context.workbench.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workbench_probe_items'")
      .get();
    assert.ok(table, 'the fixture migration table must exist');

    // A second startup on the same database re-runs nothing.
    const migrationResult = context.workbench.migrations.run([...fileMigrations, ...jobMigrations, ...recognitionMigrations, ...reliabilityMigrations, ...preferenceMigrations, ...navigationMigrations, ...context.workbench.loader.moduleMigrations(), ...retirementMigrations, ...classRetirementMigrations, { moduleId: 'agent', migrations: agentMigrations }]);
    assert.deepEqual(migrationResult.applied, []);
    assert.deepEqual(migrationResult.skipped, [...PRODUCT_MIGRATIONS, 'workbench_probe_init', 'workbench_retirement_001_lessons', 'workbench_retirement_002_classes', 'agent_001_conversations']);
  } finally {
    await context.cleanup();
  }
});

test('an existing account and layout database is upgraded without losing its data', async () => {
  const rootDir = createTempRoot('teachbuddy-upgrade-');
  const sqlitePath = path.join(rootDir, 'data', 'workspace.sqlite');
  const layout = {
    hiddenModuleIds: [],
    groups: [{ id: 'focus', name: '专注', moduleIds: [] }],
    ungroupedModuleIds: []
  };

  // Before the workbench exists, the database holds only the shell account and
  // layout tables; the module migrations must add their tables next to them.
  const legacy = createDataStore({ sqlitePath });
  const user = legacy.createUser({
    name: 'Old Teacher',
    email: 'old-teacher@example.test',
    passwordHash: hashPassword('old teacher password'),
    role: 'teacher'
  });
  legacy.forAccount(user.id).create('workspaceLayouts', layout);
  legacy.close();

  // Second start: the workbench applies its migrations on the same file.
  const upgraded = await createWorkbenchContext({ rootDir, sqlitePath });
  try {
    assert.deepEqual(
      upgraded.workbench.migrations.appliedIds(),
      [...PRODUCT_MIGRATIONS, 'workbench_probe_init', 'workbench_retirement_001_lessons', 'workbench_retirement_002_classes', 'agent_001_conversations']
    );

    assert.equal(upgraded.workbench.db.prepare('SELECT * FROM users WHERE email=?').get('old-teacher@example.test').id, user.id);
    const stored = upgraded.workbench.db.prepare('SELECT * FROM workspaceLayouts WHERE ownerId=?').get(user.id);
    for (const key of Object.keys(layout)) assert.deepEqual(JSON.parse(stored[key]), layout[key]);
  } finally {
    await upgraded.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('startServer refuses to open the port when a migration fails', async () => {
  const rootDir = createTempRoot('teachbuddy-startup-');
  const { implementations, entries } = resolveFixtureSets(['workbench-broken']);
  const runtimeEnv = createEnv({
    nodeEnv: 'test',
    port: 0,
    sqlitePath: path.join(rootDir, 'data', 'workspace.sqlite'),
    workbench: {
      mode: 'test-principal',
      testPrincipals: [ACCOUNT_A],
      trustedOrigins: ['https://workbench.test'],
      catalogOverride: [...moduleCatalog, ...entries],
      extraImplementations: implementations
    }
  });

  try {
    await assert.rejects(startServer({ env: runtimeEnv }), /fixture migration failed on purpose/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('a failing migration leaves no ledger row and no partial table', async () => {
  const rootDir = createTempRoot('teachbuddy-broken-');
  const sqlitePath = path.join(rootDir, 'data', 'workspace.sqlite');
  const { implementations, entries } = resolveFixtureSets(['workbench-broken']);
  const runtimeEnv = createEnv({
    nodeEnv: 'test',
    sqlitePath,
    workbench: {
      mode: 'test-principal',
      testPrincipals: [ACCOUNT_A],
      trustedOrigins: ['https://workbench.test'],
      catalogOverride: [...moduleCatalog, ...entries],
      extraImplementations: implementations
    }
  });

  const workbench = createWorkbench({ env: runtimeEnv });
  try {
    await assert.rejects(workbench.initialize(), /fixture migration failed on purpose/);
    // The product migrations ran before the failing fixture one; the failed
    // migration itself left neither a ledger row nor a partial table.
    assert.deepEqual(workbench.migrations.appliedIds(), PRODUCT_MIGRATIONS);
    const table = workbench.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workbench_broken_probe'")
      .get();
    assert.equal(table, undefined, 'the failed migration DDL must be rolled back');
  } finally {
    await workbench.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('the runner validates migration IDs, prefixes and removals', () => {
  const rootDir = createTempRoot('teachbuddy-migration-runner-');
  const db = openWorkbenchDatabase({ sqlitePath: path.join(rootDir, 'runner.sqlite') });
  const runner = createMigrationRunner({ db });
  try {
    assert.equal(prefixForModule('workbench-probe'), 'workbench_probe_');

    assert.throws(
      () => runner.run([{ moduleId: 'questions', migrations: [{ id: 'resources_init', up() {} }] }]),
      /must use the questions prefix/
    );
    assert.throws(
      () => runner.run([{ moduleId: 'questions', migrations: [{ id: 'questions_init' }] }]),
      /synchronous up/
    );
    assert.throws(
      () => runner.run([
        { moduleId: 'questions', migrations: [{ id: 'questions_init', up() {} }] },
        { moduleId: 'questions', migrations: [{ id: 'questions_init', up() {} }] }
      ]),
      /Duplicate migration ID/
    );
    assert.throws(
      () => runner.run([{ moduleId: 'Bad Id', migrations: [] }]),
      /Invalid migration module ID/
    );

    const applied = runner.run([{ moduleId: 'questions', migrations: [{ id: 'questions_init', up() {} }] }]);
    assert.deepEqual(applied.applied, ['questions_init']);

    // An applied migration that is no longer defined means schema drift.
    assert.throws(
      () => runner.run([{ moduleId: 'questions', migrations: [] }]),
      /Applied migrations are no longer defined: questions_init/
    );
  } finally {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
