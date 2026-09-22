/**
 * Schedule migrations on an empty database and on a previous-stage (B16)
 * database: the new tables are added, the old rows and ledger survive, and a
 * restart reads the same data back.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFirstFlowHarness } from './first-flow-harness.js';
import { createScheduleHarness } from './fixtures/teaching-time-schedule/harness.js';
import { timedEntry } from './fixtures/teaching-time-schedule/samples.js';

const SCHEDULE_TABLES = [
  'schedule_settings',
  'schedule_entries',
  'schedule_exceptions',
  'schedule_instance_arms'
];

test('an empty database receives every schedule table and ledger row', async () => {
  const harness = await createScheduleHarness();
  try {
    const tables = harness
      .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((row) => row.name);
    for (const table of SCHEDULE_TABLES) assert.ok(tables.includes(table), `missing ${table}`);

    const applied = harness
      .query('SELECT id, moduleId FROM workbench_migrations ORDER BY rowid')
      .map((row) => `${row.moduleId}:${row.id}`);
    assert.deepEqual(applied, [
      'classes:classes_fixture_0001',
      'lessons:lessons_fixture_0001',
      'schedule:schedule_0001_settings_entries'
    ]);
  } finally {
    harness.close();
  }
});

test('a B16 database upgrades in place and keeps its previous rows', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 't52-upgrade-'));
  const databasePath = path.join(rootDir, 'workspace.sqlite');
  let questionId = null;

  const b16 = await createFirstFlowHarness({ databasePath, baselineOnly: true });
  try {
    const account = b16.createAccount('teacher-a');
    const agent = b16.agent(account);
    const created = await agent.post('/api/modules/questions/items', {
      title: '升级前题目',
      body: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '升级前的题目正文' }] }] },
      solution: { version: 1, blocks: [] },
      note: '',
      starred: false,
      source: { kind: 'manual' }
    }, { key: b16.nextUuid() });
    assert.equal(created.status, 201);
    questionId = created.body.id;
    assert.ok(
      b16.query("SELECT name FROM sqlite_master WHERE type = 'table'").some((row) => row.name === 'question_items')
    );
  } finally {
    b16.close();
  }

  const upgraded = await createScheduleHarness({ databasePath, knownModuleIds: ['schedule'] });
  try {
    const tables = upgraded
      .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((row) => row.name);
    for (const table of SCHEDULE_TABLES) assert.ok(tables.includes(table), `missing ${table}`);

    // The previous stage's rows and ledger entries are untouched.
    const question = upgraded.query('SELECT id, title FROM question_items WHERE id = ?', questionId);
    assert.equal(question.length, 1);
    assert.equal(question[0].title, '升级前题目');
    const ledger = upgraded.query("SELECT id FROM workbench_migrations WHERE moduleId = 'questions'");
    assert.ok(ledger.length > 0);
    const scheduleLedger = upgraded.query("SELECT id FROM workbench_migrations WHERE moduleId = 'schedule'");
    assert.deepEqual(scheduleLedger.map((row) => row.id), ['schedule_0001_settings_entries']);

    // The schedule module is usable on the upgraded database and survives a restart.
    const a = upgraded.agent(upgraded.account('teacher-a'));
    const entry = await a.post('/api/modules/schedule/entries', timedEntry(), { key: crypto.randomUUID() });
    assert.equal(entry.status, 201);
    await upgraded.restart();
    const afterRestart = upgraded.agent(upgraded.account('teacher-a'));
    const reloaded = await afterRestart.get(`/api/modules/schedule/entries/${entry.body.id}`);
    assert.equal(reloaded.status, 200);
    assert.equal(reloaded.body.time.startTime, '15:00');
  } finally {
    upgraded.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
