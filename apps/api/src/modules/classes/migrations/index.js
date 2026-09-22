// Classes owns the class, record and link tables. Links are normalised so the
// reverse feedback index is served without reading another module's storage;
// labelAtLink stays with the link because it is the title read at linking time.
export const migrations = [
  {
    id: 'classes_0001_class_tables',
    up(db) {
      db.exec(`
        CREATE TABLE classes_items (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          name TEXT NOT NULL
        );
        CREATE TABLE classes_records (
          id TEXT PRIMARY KEY,
          accountKey TEXT NOT NULL,
          classId TEXT NOT NULL,
          version INTEGER NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT,
          recordedOn TEXT NOT NULL,
          note TEXT NOT NULL,
          position TEXT NOT NULL,
          unfinished TEXT NOT NULL,
          commonIssues TEXT NOT NULL,
          nextNote TEXT NOT NULL
        );
        CREATE TABLE classes_record_sources (
          recordId TEXT NOT NULL,
          accountKey TEXT NOT NULL,
          kind TEXT NOT NULL,
          sourceId TEXT NOT NULL,
          position INTEGER NOT NULL,
          labelAtLink TEXT NOT NULL,
          PRIMARY KEY (recordId, kind, sourceId)
        );
        CREATE INDEX classes_items_account_name_idx
          ON classes_items (accountKey, name, id);
        CREATE INDEX classes_records_class_idx
          ON classes_records (accountKey, classId, recordedOn DESC, updatedAt DESC, id);
        CREATE INDEX classes_record_sources_source_idx
          ON classes_record_sources (accountKey, kind, sourceId);
      `);
    }
  }
];
