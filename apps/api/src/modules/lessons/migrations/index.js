import { materialsMigrations } from "./materials.js";
// Lessons owns the lesson aggregate tables. Sections and references are
// normalised because usage lookups must find them without reading another
// module's storage, while snapshots stay denormalised with each reference.
export const migrations = [
  {
    id: "lessons_0001_lesson_tables",
    up(db) {
      db.exec(`
        CREATE TABLE lesson_items (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          title TEXT NOT NULL,
          intro TEXT NOT NULL
        );
        CREATE TABLE lesson_sections (
          lessonId TEXT NOT NULL,
          accountKey TEXT NOT NULL,
          sectionId TEXT NOT NULL,
          position INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          PRIMARY KEY (lessonId, sectionId)
        );
        CREATE TABLE lesson_references (
          lessonId TEXT NOT NULL,
          accountKey TEXT NOT NULL,
          referenceId TEXT NOT NULL,
          sectionId TEXT,
          position INTEGER NOT NULL,
          questionId TEXT NOT NULL,
          questionVersion INTEGER NOT NULL,
          note TEXT NOT NULL,
          snapshot TEXT NOT NULL,
          PRIMARY KEY (lessonId, referenceId)
        );
        CREATE INDEX lesson_items_account_updated_idx
          ON lesson_items (accountKey, updatedAt DESC, id);
        CREATE INDEX lesson_sections_lesson_idx
          ON lesson_sections (lessonId, position);
        CREATE INDEX lesson_references_lesson_idx
          ON lesson_references (lessonId, position);
        CREATE INDEX lesson_references_question_idx
          ON lesson_references (accountKey, questionId);
      `);
    },
  },
  ...materialsMigrations,
  {
    id: "lessons_0003_order",
    up(db) {
      db.exec(`CREATE TABLE lesson_order (
        accountKey TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        lessonIds TEXT NOT NULL
      )`);
    },
  },
];
