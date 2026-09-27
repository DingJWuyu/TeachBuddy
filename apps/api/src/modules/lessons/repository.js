// Persistence for the lesson aggregate. A lesson write replaces the whole
// section/reference set inside the caller's transaction, so a partial
// aggregate can never be observed.

function parseJson(value) {
  return value === null || value === undefined ? null : JSON.parse(value);
}

function toLesson(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountKey: row.accountKey,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    title: row.title,
    intro: parseJson(row.intro),
  };
}

function toSection(row) {
  return {
    lessonId: row.lessonId,
    accountKey: row.accountKey,
    sectionId: row.sectionId,
    position: row.position,
    title: row.title,
    content: parseJson(row.content),
  };
}

function toReference(row) {
  return {
    lessonId: row.lessonId,
    accountKey: row.accountKey,
    referenceId: row.referenceId,
    kind: row.kind,
    sectionId: row.sectionId ?? null,
    position: row.position,
    questionId: row.questionId,
    questionVersion: row.questionVersion,
    note: row.note,
    snapshot: parseJson(row.snapshot),
    afterBlock: row.afterBlock ?? null,
  };
}

export function createLessonsRepository(db) {
  const insertLessonStatement = db.prepare(`
    INSERT INTO lesson_items (id, accountKey, version, createdAt, updatedAt, deletedAt, title, intro)
    VALUES (@id, @accountKey, @version, @createdAt, @updatedAt, @deletedAt, @title, @intro)
  `);
  const updateLessonStatement = db.prepare(`
    UPDATE lesson_items SET
      version = @version,
      updatedAt = @updatedAt,
      deletedAt = @deletedAt,
      title = @title,
      intro = @intro
    WHERE id = @id AND accountKey = @accountKey
  `);
  const getLessonStatement = db.prepare(
    "SELECT * FROM lesson_items WHERE id = ? AND accountKey = ?",
  );
  const listLessonsStatement = db.prepare(
    "SELECT * FROM lesson_items WHERE accountKey = ? ORDER BY updatedAt DESC, id ASC",
  );
  const deleteSectionsStatement = db.prepare(
    "DELETE FROM lesson_sections WHERE lessonId = ?",
  );
  const deleteReferencesStatement = db.prepare(
    "DELETE FROM lesson_references WHERE lessonId = ?",
  );
  const insertSectionStatement = db.prepare(`
    INSERT INTO lesson_sections (lessonId, accountKey, sectionId, position, title, content)
    VALUES (@lessonId, @accountKey, @sectionId, @position, @title, @content)
  `);
  const insertReferenceStatement = db.prepare(`
    INSERT INTO lesson_references (
      lessonId, accountKey, referenceId, sectionId, position,
      questionId, questionVersion, note, snapshot, kind, afterBlock
    ) VALUES (
      @lessonId, @accountKey, @referenceId, @sectionId, @position,
      @questionId, @questionVersion, @note, @snapshot, @kind, @afterBlock
    )
  `);
  const listSectionsStatement = db.prepare(
    "SELECT * FROM lesson_sections WHERE lessonId = ? ORDER BY position ASC",
  );
  const listReferencesStatement = db.prepare(
    "SELECT * FROM lesson_references WHERE lessonId = ? ORDER BY position ASC, referenceId ASC",
  );
  const listUsagesStatement = db.prepare(`
    SELECT
      r.lessonId AS lessonId,
      l.title AS lessonTitle,
      r.sectionId AS sectionId,
      s.title AS sectionTitle,
      r.referenceId AS referenceId,
      r.questionVersion AS questionVersion
    FROM lesson_references r
    JOIN lesson_items l ON l.id = r.lessonId
    LEFT JOIN lesson_sections s ON s.lessonId = r.lessonId AND s.sectionId = r.sectionId
    WHERE r.accountKey = ? AND r.questionId = ? AND l.deletedAt IS NULL
    ORDER BY l.updatedAt DESC, l.id ASC, r.position ASC, r.referenceId ASC
  `);

  return {
    insertLesson(record) {
      insertLessonStatement.run({
        id: record.id,
        accountKey: record.accountKey,
        version: record.version,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
        title: record.title,
        intro: JSON.stringify(record.intro),
      });
      return record;
    },

    updateLesson(record) {
      updateLessonStatement.run({
        id: record.id,
        accountKey: record.accountKey,
        version: record.version,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
        title: record.title,
        intro: JSON.stringify(record.intro),
      });
      return record;
    },

    getLessonForAccount(accountKey, lessonId) {
      return toLesson(getLessonStatement.get(lessonId, accountKey));
    },

    listLessonsForAccount(accountKey) {
      return listLessonsStatement.all(accountKey).map(toLesson);
    },

    purgeLesson(accountKey, lessonId) {
      db.prepare("DELETE FROM lesson_history WHERE accountKey=? AND lessonId=?").run(accountKey, lessonId);
      db.prepare("DELETE FROM lesson_sections WHERE accountKey=? AND lessonId=?")
        .run(accountKey, lessonId);
      db.prepare("DELETE FROM lesson_references WHERE accountKey=? AND lessonId=?")
        .run(accountKey, lessonId);
      db.prepare("DELETE FROM lesson_items WHERE accountKey=? AND id=?")
        .run(accountKey, lessonId);
      const order = db.prepare("SELECT lessonIds FROM lesson_order WHERE accountKey=?")
        .get(accountKey);
      if (order) {
        const remaining = JSON.parse(order.lessonIds).filter(id => id !== lessonId);
        db.prepare("UPDATE lesson_order SET version=version+1, lessonIds=? WHERE accountKey=?")
          .run(JSON.stringify(remaining), accountKey);
      }
    },

    listSections(lessonId) {
      return listSectionsStatement.all(lessonId).map(toSection);
    },

    listReferences(lessonId) {
      return listReferencesStatement.all(lessonId).map(toReference);
    },

    replaceContent(lessonId, sections, references) {
      deleteSectionsStatement.run(lessonId);
      deleteReferencesStatement.run(lessonId);
      for (const section of sections) {
        insertSectionStatement.run({
          lessonId,
          accountKey: section.accountKey,
          sectionId: section.sectionId,
          position: section.position,
          title: section.title,
          content: JSON.stringify(section.content),
        });
      }
      for (const reference of references) {
        insertReferenceStatement.run({
          lessonId,
          accountKey: reference.accountKey,
          referenceId: reference.referenceId,
          sectionId: reference.sectionId,
          position: reference.position,
          questionId: reference.questionId,
          kind: reference.kind ?? "question",
          questionVersion: reference.questionVersion,
          note: reference.note,
          snapshot: JSON.stringify(reference.snapshot),
          afterBlock: reference.afterBlock ?? null,
        });
      }
    },

    listActiveUsages(accountKey, questionId) {
      return listUsagesStatement.all(accountKey, questionId);
    },
  };
}
