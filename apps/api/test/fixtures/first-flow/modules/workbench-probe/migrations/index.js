/**
 * Prober module migration: the smallest real table the B12 seam needs.
 */
export const migrations = [
  {
    id: 'workbench_probe_init',
    up(db) {
      db.exec(`
        CREATE TABLE workbench_probe_items (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          version INTEGER NOT NULL,
          value TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE INDEX workbench_probe_items_account_idx ON workbench_probe_items (accountKey);
      `);
    }
  }
];
