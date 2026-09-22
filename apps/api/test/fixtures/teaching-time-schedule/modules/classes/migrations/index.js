/**
 * Fixture classes migration: isolated substitute tables only.
 */
export const migrations = [
  {
    id: 'classes_fixture_0001',
    up(db) {
      db.exec(`
        CREATE TABLE teaching_time_fixture_classes (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          name TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT
        );

        CREATE TABLE teaching_time_fixture_records (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          classId TEXT NOT NULL,
          recordedOn TEXT NOT NULL,
          note TEXT NOT NULL,
          position TEXT NOT NULL,
          unfinished TEXT NOT NULL,
          commonIssues TEXT NOT NULL,
          nextNote TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT
        );
      `);
    }
  }
];
