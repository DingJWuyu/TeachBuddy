export const migrations = [
  {
    id: "resources_001",
    up(db) {
      db.exec(`CREATE TABLE resource_items (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
      CREATE INDEX resource_account ON resource_items(accountKey);
      CREATE TABLE resource_taxonomy (accountKey TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    },
  },
  {
    id: "resources_002_file_history",
    up(db) {
      db.exec(`CREATE TABLE resource_file_history (
        accountKey TEXT NOT NULL, resourceId TEXT NOT NULL,
        version INTEGER NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY (accountKey, resourceId, version)
      )`);
      const insert = db.prepare(
        "INSERT INTO resource_file_history VALUES (?, ?, ?, ?)",
      );
      for (const row of db
        .prepare("SELECT accountKey, value FROM resource_items")
        .all()) {
        const item = JSON.parse(row.value);
        insert.run(
          row.accountKey,
          item.id,
          item.version,
          JSON.stringify({
            version: item.version,
            createdAt: item.updatedAt,
            fileId: item.fileId,
            supplementPreviewFileId: item.supplementPreviewFileId,
          }),
        );
      }
    },
  },
  {
    id: "resources_003_text_cache",
    up(db) {
      db.exec(`CREATE TABLE resource_text_cache (
        accountKey TEXT NOT NULL, fileId TEXT NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY (accountKey, fileId)
      )`);
    },
  },
];
