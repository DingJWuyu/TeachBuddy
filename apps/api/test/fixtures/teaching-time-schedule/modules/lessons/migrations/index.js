/**
 * Fixture lessons migration: one isolated substitute table.
 */
export const migrations = [
  {
    id: 'lessons_fixture_0001',
    up(db) {
      db.exec(`
        CREATE TABLE teaching_time_fixture_lessons (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          title TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT
        );
      `);
    }
  }
];
