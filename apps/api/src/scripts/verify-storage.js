import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEnv } from '../config/env.js';
import { createApp } from '../app.js';

/**
 * API build check.
 *
 * Runs module loading, catalog projection and pending migrations against a
 * throwaway database in the OS temp directory, then verifies the baseline and
 * workbench tables exist. It must never open or write the developer's user
 * database: a build validates code and an isolated fixture database only.
 */
const silentLogger = { logDir: null, info() {}, request() {}, error() {} };
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-workspace-build-'));
const sqlitePath = path.join(tempDir, 'data', 'build.sqlite');

let workbench;
let dataStore;
try {
  const runtimeEnv = createEnv({ nodeEnv: 'test', sqlitePath, authCodeSecret: 'isolated-build-secret', workbench: { publicOrigin: 'https://build.invalid' } });
  ({ workbench, dataStore } = createApp({ env: runtimeEnv, workbenchLogger: silentLogger, sendCode: async () => {} }));
  const migrationResult = await workbench.initialize();

  const tables = new Set(
    workbench.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );
  const requiredTables = [
    'app_metadata',
    'users',
    'auth_accounts',
    'auth_sessions',
    'auth_page_bindings',
    'workspaceLayouts',
    'passwordResetCodes',
    'workbench_migrations',
    'workbench_mutation_keys'
  ];
  const missing = requiredTables.filter((table) => !tables.has(table));
  if (missing.length) {
    throw new Error(`Missing storage tables after startup: ${missing.join(', ')}`);
  }

  console.log(
    `Storage verified at isolated build database ${sqlitePath} `
    + `(modules: ${workbench.loader.enabledIds().join(', ') || 'none'}; `
    + `migrations applied: ${migrationResult.applied.length})`
  );
} finally {
  await dataStore?.close();
  if (workbench?.db.open) await workbench.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
