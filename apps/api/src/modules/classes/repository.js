// Storage for the classes module: classes, actual records and their links to
// lesson/question sources. The module owns these tables and no other module
// reads them; reverse lookups are served from the link index maintained here.
//
// Sorting is fixed by the contract: classes by name then id ascending (SQLite's
// BINARY collation over UTF-8 is Unicode code point order), records by
// recordedOn desc, updatedAt desc, id asc.
// One column list drives both the plain and the `r.`-prefixed select, so the
// reverse-feedback join cannot drift from the record projection.
const RECORD_COLUMNS = [
  'id', 'accountKey', 'classId', 'version', 'createdAt', 'updatedAt', 'deletedAt',
  'recordedOn', 'note', 'position', 'unfinished', 'commonIssues', 'nextNote'
];

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

  const insertRecord = db.prepare(`
    INSERT INTO classes_records (
      id, accountKey, classId, version, createdAt, updatedAt, deletedAt,
      recordedOn, note, position, unfinished, commonIssues, nextNote
    ) VALUES (
      @id, @accountKey, @classId, @version, @createdAt, @updatedAt, @deletedAt,
      @recordedOn, @note, @position, @unfinished, @commonIssues, @nextNote
    )
  `);
  const updateRecord = db.prepare(`
    UPDATE classes_records
    SET version = @version, updatedAt = @updatedAt, deletedAt = @deletedAt,
        recordedOn = @recordedOn, note = @note, position = @position,
        unfinished = @unfinished, commonIssues = @commonIssues, nextNote = @nextNote
    WHERE id = @id AND accountKey = @accountKey
  `);
  const selectRecord = db.prepare(`
    SELECT id, accountKey, classId, version, createdAt, updatedAt, deletedAt,
           recordedOn, note, position, unfinished, commonIssues, nextNote
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

    insertRecord: (row) => insertRecord.run(row),
    updateRecord: (row) => updateRecord.run(row),
    getRecordForAccount: (accountKey, id) => selectRecord.get(id, accountKey) ?? null,
    listRecordsForClass: (accountKey, classId) => selectRecordsForClass.all(accountKey, classId),
    listActiveRecordsForSource: (accountKey, kind, sourceId) =>
      selectActiveRecordsForSource.all(accountKey, kind, sourceId),

    listSources: (recordId) => selectSources.all(recordId),
    replaceSources
  };
}
