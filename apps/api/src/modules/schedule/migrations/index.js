/**
 * Schedule module migrations. IDs use the `schedule_` prefix, are append-only
 * and own every table the module reads or writes.
 */
export const migrations = [
  {
    id: 'schedule_0001_settings_entries',
    up(db) {
      db.exec(`
        CREATE TABLE schedule_settings (
          accountKey TEXT PRIMARY KEY,
          timeZone TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE TABLE schedule_entries (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          items TEXT NOT NULL,
          timeJson TEXT,
          repeatUntil TEXT,
          courseJson TEXT NOT NULL,
          courseLinks TEXT NOT NULL,
          reminderJson TEXT,
          reminderArmedAt TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT
        );

        CREATE INDEX schedule_entries_account_order
          ON schedule_entries (accountKey, updatedAt DESC, id ASC);

        CREATE TABLE schedule_exceptions (
          entryId TEXT NOT NULL,
          originDate TEXT NOT NULL,
          mode TEXT NOT NULL,
          contentJson TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          PRIMARY KEY (entryId, originDate)
        );

        CREATE INDEX schedule_exceptions_entry
          ON schedule_exceptions (entryId, originDate ASC);

        CREATE TABLE schedule_instance_arms (
          entryId TEXT NOT NULL,
          originDate TEXT NOT NULL,
          armedAt TEXT NOT NULL,
          PRIMARY KEY (entryId, originDate)
        );
      `);
    }
  },
  {
    id: 'schedule_0002_calendar_details',
    up(db) {
      db.exec(`
        ALTER TABLE schedule_entries ADD COLUMN calendarJson TEXT;
        ALTER TABLE schedule_entries ADD COLUMN repeatJson TEXT;
        CREATE TABLE schedule_labels (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX schedule_labels_account ON schedule_labels (accountKey);
      `);
    }
  }
];
