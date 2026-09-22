// Persistence for question items. Rows are stored with a trusted account key,
// a monotonic version and JSON documents; nothing outside the module reads
// these statements.

function parseJsonColumn(value) {
  return value === null || value === undefined ? null : JSON.parse(value);
}

function toRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountKey: row.accountKey,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    title: row.title,
    body: parseJsonColumn(row.body),
    solution: parseJsonColumn(row.solution),
    note: row.note,
    starred: row.starred === 1,
    source: parseJsonColumn(row.source),
    sourceQuestionId: row.sourceQuestionId ?? null
  };
}

export function createQuestionsRepository(db) {
  const insertStatement = db.prepare(`
    INSERT INTO question_items (
      id, accountKey, version, createdAt, updatedAt, deletedAt, title, body,
      solution, note, starred, source, sourceQuestionId
    ) VALUES (
      @id, @accountKey, @version, @createdAt, @updatedAt, @deletedAt, @title,
      @body, @solution, @note, @starred, @source, @sourceQuestionId
    )
  `);
  const updateStatement = db.prepare(`
    UPDATE question_items SET
      version = @version,
      updatedAt = @updatedAt,
      deletedAt = @deletedAt,
      title = @title,
      body = @body,
      solution = @solution,
      note = @note,
      starred = @starred,
      source = @source,
      sourceQuestionId = @sourceQuestionId
    WHERE id = @id AND accountKey = @accountKey
  `);
  const getStatement = db.prepare('SELECT * FROM question_items WHERE id = ? AND accountKey = ?');
  const listStatement = db.prepare(
    'SELECT * FROM question_items WHERE accountKey = ? ORDER BY updatedAt DESC, id ASC'
  );
  const listDerivativesStatement = db.prepare(`
    SELECT * FROM question_items
    WHERE accountKey = ? AND sourceQuestionId = ?
    ORDER BY updatedAt DESC, id ASC
  `);

  function serialize(record) {
    return {
      id: record.id,
      accountKey: record.accountKey,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      title: record.title,
      body: JSON.stringify(record.body),
      solution: JSON.stringify(record.solution),
      note: record.note,
      starred: record.starred ? 1 : 0,
      source: JSON.stringify(record.source),
      sourceQuestionId: record.sourceQuestionId ?? null
    };
  }

  return {
    insert(record) {
      insertStatement.run(serialize(record));
      return record;
    },

    update(record) {
      updateStatement.run(serialize(record));
      return record;
    },

    getForAccount(accountKey, id) {
      return toRecord(getStatement.get(id, accountKey));
    },

    listForAccount(accountKey) {
      return listStatement.all(accountKey).map(toRecord);
    },

    listDerivativesOf(accountKey, questionId) {
      return listDerivativesStatement.all(accountKey, questionId).map(toRecord);
    }
  };
}
