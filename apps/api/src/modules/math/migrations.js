export const migrations = [
  {
    id: "math_001",
    up(db) {
      db.exec(`
    CREATE TABLE math_works (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
    CREATE INDEX math_works_account ON math_works(accountKey);
    CREATE TABLE math_revisions (workId TEXT NOT NULL, version INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(workId,version));
    CREATE TABLE math_exports (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
  `);
    },
  },
];
