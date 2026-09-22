export const jobMigrations = [
  {
    moduleId: "materials-jobs",
    migrations: [
      {
        id: "materials_jobs_001",
        up(db) {
          db.exec(`CREATE TABLE materials_jobs (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
    CREATE TABLE materials_previews (fileId TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL);
    CREATE TABLE materials_renditions (fileId TEXT NOT NULL, renditionId TEXT NOT NULL, accountKey TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(fileId, renditionId));`);
        },
      },
    ],
  },
];
