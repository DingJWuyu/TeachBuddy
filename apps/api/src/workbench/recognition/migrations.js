export const recognitionMigrations = [{
  moduleId: 'materials-recognition',
  migrations: [{
    id: 'materials_recognition_001',
    up(db) {
      db.exec(`
        CREATE TABLE materials_recognition_results (
          id TEXT PRIMARY KEY, accountKey TEXT NOT NULL,
          inputHash TEXT NOT NULL, revision TEXT NOT NULL, value TEXT NOT NULL,
          UNIQUE(accountKey, inputHash, revision)
        );
        CREATE TABLE materials_recognition_requests (
          jobId TEXT PRIMARY KEY, accountKey TEXT NOT NULL,
          fileId TEXT NOT NULL, renditionFileId TEXT NOT NULL, value TEXT NOT NULL
        );
      `);
    },
  }],
}];
