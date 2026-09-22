import { materialsMigrations } from "../materials-store.js";
// Questions owns its tables and its migration IDs. The public migration
// runner executes these in order and records each ID in the same transaction.
export const migrations = [
  {
    id: "questions_0001_question_items",
    up(db) {
      db.exec(`
        CREATE TABLE question_items (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          solution TEXT NOT NULL,
          note TEXT NOT NULL,
          starred INTEGER NOT NULL,
          source TEXT NOT NULL,
          sourceQuestionId TEXT
        );
        CREATE INDEX question_items_account_updated_idx
          ON question_items (accountKey, updatedAt DESC, id);
        CREATE INDEX question_items_source_idx
          ON question_items (accountKey, sourceQuestionId);
      `);
    },
  },
  ...materialsMigrations,
];
