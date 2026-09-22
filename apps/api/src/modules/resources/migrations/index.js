export const migrations = [
  {
    id: "resources_001",
    up(db) {
      db.exec(`CREATE TABLE resource_items (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
      CREATE INDEX resource_account ON resource_items(accountKey);
      CREATE TABLE resource_taxonomy (accountKey TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    },
  },
];
