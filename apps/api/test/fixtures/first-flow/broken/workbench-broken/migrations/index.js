/**
 * Test-only migration that fails after creating a table: proves the runner
 * rolls the whole migration (including its DDL) back and leaves no ledger row.
 */
export const migrations = [
  {
    id: 'workbench_broken_init',
    up(db) {
      db.exec('CREATE TABLE workbench_broken_probe (id TEXT PRIMARY KEY);');
      throw new Error('workbench-broken fixture migration failed on purpose');
    }
  }
];
