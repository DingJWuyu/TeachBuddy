export const materialsMigrations = [
  {
    id: "lessons_materials_001",
    up(db) {
      db.exec(`ALTER TABLE lesson_references ADD COLUMN kind TEXT NOT NULL DEFAULT 'question';
   CREATE TABLE lesson_exports (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, lessonId TEXT NOT NULL, createdAt TEXT NOT NULL, record TEXT NOT NULL, snapshot TEXT NOT NULL);
   CREATE INDEX lesson_exports_account_lesson ON lesson_exports(accountKey, lessonId, createdAt DESC, id);`);
    },
  },
];
