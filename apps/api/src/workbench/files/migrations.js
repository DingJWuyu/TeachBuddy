export const fileMigrations = [
  {
    moduleId: 'materials-files',
    migrations: [
      {
        id: 'materials_files_001',
        up(db) {
          db.exec(`CREATE TABLE materials_files (
        id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, metadata TEXT NOT NULL,
        blobName TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL
      );
      CREATE INDEX materials_files_account_digest ON materials_files(accountKey, sha256);`);
        }
      }
    ]
  }
];
