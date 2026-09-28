import { emptyRecordContent } from '@refatos/shared';
// Storage for the classes module: classes, actual records and their links to
// lesson/question sources. The module owns these tables and no other module
// reads them; reverse lookups are served from the link index maintained here.
//
// Sorting is fixed by the contract: classes by name then id ascending (SQLite's
// BINARY collation over UTF-8 is Unicode code point order), records by
// recordedOn desc, updatedAt desc, id asc for v1. The service projects v2
// records by recordedOn desc, createdAt desc, id asc.
// One column list drives both the plain and the `r.`-prefixed select, so the
// reverse-feedback join cannot drift from the record projection.
const RECORD_COLUMNS = [
  'id', 'accountKey', 'classId', 'version', 'createdAt', 'updatedAt', 'deletedAt',
  'recordedOn', 'note', 'position', 'unfinished', 'commonIssues', 'nextNote', 'nextNoteHidden', 'content'
];

const decode = row => row ? { ...row, content: JSON.parse(row.content) } : null;
const encode = row => ({ ...row, nextNoteHidden: row.nextNoteHidden ?? 0, content: JSON.stringify(row.content ?? emptyRecordContent()) });

export function createClassesRepository(db) {
  const recordColumns = RECORD_COLUMNS.join(', ');
  const joinedRecordColumns = RECORD_COLUMNS.map((column) => `r.${column}`).join(', ');

  const insertClass = db.prepare(`
    INSERT INTO classes_items (id, accountKey, version, createdAt, updatedAt, deletedAt, name)
    VALUES (@id, @accountKey, @version, @createdAt, @updatedAt, @deletedAt, @name)
  `);
  const updateClass = db.prepare(`
    UPDATE classes_items
    SET version = @version, updatedAt = @updatedAt, deletedAt = @deletedAt, name = @name
    WHERE id = @id AND accountKey = @accountKey
  `);
  const selectClass = db.prepare(`
    SELECT id, accountKey, version, createdAt, updatedAt, deletedAt, name
    FROM classes_items WHERE id = ? AND accountKey = ?
  `);
  const selectClasses = db.prepare(`
    SELECT id, accountKey, version, createdAt, updatedAt, deletedAt, name
    FROM classes_items WHERE accountKey = ? ORDER BY name ASC, id ASC
  `);
  const removeClass = db.prepare('DELETE FROM classes_items WHERE id = ? AND accountKey = ?');
  const removeRecords = db.prepare('DELETE FROM classes_records WHERE classId = ? AND accountKey = ?');
  const removeClassSources = db.prepare(`DELETE FROM classes_record_sources WHERE accountKey = ? AND recordId IN
    (SELECT id FROM classes_records WHERE classId = ? AND accountKey = ?)`);
  const rememberRemovedClass = db.prepare(`INSERT INTO classes_removed_objects (id, accountKey, kind, classId, version, removedAt)
    SELECT id, accountKey, 'class', id, version + 1, ? FROM classes_items WHERE id = ? AND accountKey = ?`);
  const rememberRemovedRecords = db.prepare(`INSERT INTO classes_removed_objects (id, accountKey, kind, classId, version, removedAt)
    SELECT id, accountKey, 'record', classId, version + 1, ? FROM classes_records WHERE classId = ? AND accountKey = ?`);
  const selectRemoved = db.prepare('SELECT id, classId, version, removedAt FROM classes_removed_objects WHERE id = ? AND accountKey = ? AND kind = ?');

  const insertRecord = db.prepare(`
    INSERT INTO classes_records (
      id, accountKey, classId, version, createdAt, updatedAt, deletedAt,
      recordedOn, note, position, unfinished, commonIssues, nextNote, nextNoteHidden, content
    ) VALUES (
      @id, @accountKey, @classId, @version, @createdAt, @updatedAt, @deletedAt,
      @recordedOn, @note, @position, @unfinished, @commonIssues, @nextNote, @nextNoteHidden, @content
    )
  `);
  const updateRecord = db.prepare(`
    UPDATE classes_records
    SET version = @version, updatedAt = @updatedAt, deletedAt = @deletedAt,
        recordedOn = @recordedOn, note = @note, position = @position,
        unfinished = @unfinished, commonIssues = @commonIssues, nextNote = @nextNote, nextNoteHidden = @nextNoteHidden, content = @content
    WHERE id = @id AND accountKey = @accountKey
  `);
  const selectRecord = db.prepare(`
    SELECT id, accountKey, classId, version, createdAt, updatedAt, deletedAt,
           recordedOn, note, position, unfinished, commonIssues, nextNote, nextNoteHidden, content
    FROM classes_records WHERE id = ? AND accountKey = ?
  `);
  const selectRecordsForClass = db.prepare(`
    SELECT ${recordColumns} FROM classes_records
    WHERE accountKey = ? AND classId = ?
    ORDER BY recordedOn DESC, updatedAt DESC, id ASC
  `);

  const selectSources = db.prepare(`
    SELECT recordId, kind, sourceId, position, labelAtLink
    FROM classes_record_sources WHERE recordId = ? ORDER BY position ASC
  `);
  const deleteSources = db.prepare('DELETE FROM classes_record_sources WHERE recordId = ?');
  const insertSource = db.prepare(`
    INSERT INTO classes_record_sources (recordId, accountKey, kind, sourceId, position, labelAtLink)
    VALUES (@recordId, @accountKey, @kind, @sourceId, @position, @labelAtLink)
  `);
  // Reverse feedback: active records in active classes that still link the
  // source, in the records list order. A deleted class or record is excluded
  // here; viewing deleted feedback goes through the class's own deleted filter.
  const selectActiveRecordsForSource = db.prepare(`
    SELECT ${joinedRecordColumns}
    FROM classes_record_sources s
    JOIN classes_records r ON r.id = s.recordId
    JOIN classes_items c ON c.id = r.classId
    WHERE s.accountKey = ? AND s.kind = ? AND s.sourceId = ?
      AND r.deletedAt IS NULL AND c.deletedAt IS NULL
    ORDER BY r.recordedOn DESC, r.updatedAt DESC, r.id ASC
  `);

  function replaceSources(recordId, accountKey, sources) {
    deleteSources.run(recordId);
    sources.forEach((source, index) => {
      insertSource.run({
        recordId,
        accountKey,
        kind: source.kind,
        sourceId: source.id,
        position: index,
        labelAtLink: source.labelAtLink
      });
    });
  }

  return {
    insertClass: (row) => insertClass.run(row),
    updateClass: (row) => updateClass.run(row),
    getClassForAccount: (accountKey, id) => selectClass.get(id, accountKey) ?? null,
    listClassesForAccount: (accountKey) => selectClasses.all(accountKey),
    getRemovedForAccount: (accountKey, id, kind) => selectRemoved.get(id, accountKey, kind) ?? null,
    purgeClass(accountKey, classId, at) {
      rememberRemovedClass.run(at, classId, accountKey);
      rememberRemovedRecords.run(at, classId, accountKey);
      removeClassSources.run(accountKey, classId, accountKey);
      removeRecords.run(classId, accountKey);
      removeClass.run(classId, accountKey);
    },

    listRecordsForAccount: accountKey => db.prepare(`SELECT ${recordColumns} FROM classes_records WHERE accountKey = ?`).all(accountKey).map(decode),
    listActiveRecordsForAccount: accountKey => db.prepare('SELECT * FROM classes_records WHERE accountKey = ? AND deletedAt IS NULL ORDER BY recordedOn DESC, createdAt DESC, id ASC').all(accountKey).map(decode),
    purgeRecord(accountKey, recordId, at) {
      db.prepare(`INSERT INTO classes_removed_objects (id, accountKey, kind, classId, version, removedAt)
        SELECT id, accountKey, 'record', classId, version + 1, ? FROM classes_records WHERE id = ? AND accountKey = ?`).run(at, recordId, accountKey);
      db.prepare('DELETE FROM classes_record_sources WHERE recordId = ? AND accountKey = ?').run(recordId, accountKey);
      db.prepare('DELETE FROM classes_records WHERE id = ? AND accountKey = ?').run(recordId, accountKey);
    },
    insertRecord: (row) => insertRecord.run(encode(row)),
    updateRecord: (row) => updateRecord.run(encode(row)),
    getRecordForAccount: (accountKey, id) => decode(selectRecord.get(id, accountKey)),
    listRecordsForClass: (accountKey, classId) => selectRecordsForClass.all(accountKey, classId).map(decode),
    listActiveRecordsForSource: (accountKey, kind, sourceId) =>
      selectActiveRecordsForSource.all(accountKey, kind, sourceId).map(decode),

    listSources: (recordId) => selectSources.all(recordId),
    replaceSources
  };
}
