/**
 * Schedule persistence.
 *
 * One Entry is a small aggregate stored as a row plus JSON columns: items keep
 * their order, time/repeat/reminder are fixed shapes the service parses
 * once, and exceptions are one row per (entryId, originDate). No instance rows
 * are pre-generated; the range query expands the weekly rhythm at read time.
 */

function parseJson(value) {
  return value === null || value === undefined ? null : JSON.parse(value);
}

export function mapEntryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountKey: row.accountKey,
    version: row.version,
    title: row.title,
    items: JSON.parse(row.items),
    time: parseJson(row.timeJson),
    repeat: parseJson(row.repeatJson) ?? (row.repeatUntil === null ? null : { until: row.repeatUntil }),
    calendar: parseJson(row.calendarJson) ?? { allDay: false, notes: '', tags: [] },
    reminder: parseJson(row.reminderJson),
    reminderArmedAt: row.reminderArmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  };
}

export function mapExceptionRow(row) {
  if (!row) return null;
  return {
    entryId: row.entryId,
    originDate: row.originDate,
    mode: row.mode,
    content: parseJson(row.contentJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function createScheduleRepository(db) {
  const statements = {
    selectSettings: db.prepare('SELECT * FROM schedule_settings WHERE accountKey = ?'),
    insertSettings: db.prepare(`
      INSERT INTO schedule_settings (accountKey, timeZone, version, createdAt, updatedAt)
      VALUES (@accountKey, @timeZone, @version, @createdAt, @updatedAt)
    `),
    updateSettings: db.prepare(`
      UPDATE schedule_settings
      SET timeZone = @timeZone, version = @version, updatedAt = @updatedAt
      WHERE accountKey = @accountKey
    `),

    selectEntry: db.prepare('SELECT * FROM schedule_entries WHERE accountKey = ? AND id = ?'),
    selectEntries: db.prepare(
      'SELECT * FROM schedule_entries WHERE accountKey = ? ORDER BY updatedAt DESC, id ASC'
    ),
    insertEntry: db.prepare(`
      INSERT INTO schedule_entries (
        id, accountKey, version, title, items, timeJson, repeatUntil,
        reminderJson, reminderArmedAt, createdAt, updatedAt, deletedAt, calendarJson, repeatJson
      ) VALUES (
        @id, @accountKey, @version, @title, @items, @timeJson, @repeatUntil,
        @reminderJson, @reminderArmedAt, @createdAt, @updatedAt, @deletedAt, @calendarJson, @repeatJson
      )
    `),
    updateEntry: db.prepare(`
      UPDATE schedule_entries SET
        version = @version,
        title = @title,
        items = @items,
        timeJson = @timeJson,
        repeatUntil = @repeatUntil,
        repeatJson = @repeatJson,
        calendarJson = @calendarJson,
        reminderJson = @reminderJson,
        reminderArmedAt = @reminderArmedAt,
        updatedAt = @updatedAt,
        deletedAt = @deletedAt
      WHERE accountKey = @accountKey AND id = @id
    `),

    selectExceptions: db.prepare(
      'SELECT * FROM schedule_exceptions WHERE entryId = ? ORDER BY originDate ASC'
    ),
    selectException: db.prepare(
      'SELECT * FROM schedule_exceptions WHERE entryId = ? AND originDate = ?'
    ),
    upsertException: db.prepare(`
      INSERT INTO schedule_exceptions (entryId, originDate, mode, contentJson, createdAt, updatedAt)
      VALUES (@entryId, @originDate, @mode, @contentJson, @createdAt, @updatedAt)
      ON CONFLICT (entryId, originDate) DO UPDATE SET
        mode = excluded.mode,
        contentJson = excluded.contentJson,
        updatedAt = excluded.updatedAt
    `),
    deleteException: db.prepare(
      'DELETE FROM schedule_exceptions WHERE entryId = ? AND originDate = ?'
    ),
    clearExceptions: db.prepare('DELETE FROM schedule_exceptions WHERE entryId = ?'),
    clearArms: db.prepare('DELETE FROM schedule_instance_arms WHERE entryId = ?'),

    selectArms: db.prepare('SELECT * FROM schedule_instance_arms WHERE entryId = ?'),
    selectArm: db.prepare(
      'SELECT * FROM schedule_instance_arms WHERE entryId = ? AND originDate = ?'
    ),
    upsertArm: db.prepare(`
      INSERT INTO schedule_instance_arms (entryId, originDate, armedAt)
      VALUES (@entryId, @originDate, @armedAt)
      ON CONFLICT (entryId, originDate) DO UPDATE SET armedAt = excluded.armedAt
    `),
    deleteArm: db.prepare(
      'DELETE FROM schedule_instance_arms WHERE entryId = ? AND originDate = ?'
    )
  };

  function entryWriteFields(entry) {
    return {
      id: entry.id,
      accountKey: entry.accountKey,
      version: entry.version,
      title: entry.title,
      items: JSON.stringify(entry.items),
      timeJson: entry.time === null ? null : JSON.stringify(entry.time),
      repeatUntil: entry.repeat === null ? null : entry.repeat.until,
      repeatJson: entry.repeat == null ? null : JSON.stringify(entry.repeat),
      calendarJson: entry.calendar == null ? null : JSON.stringify(entry.calendar),
      reminderJson: entry.reminder === null ? null : JSON.stringify(entry.reminder),
      reminderArmedAt: entry.reminderArmedAt ?? null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      deletedAt: entry.deletedAt ?? null
    };
  }

  return {
    deleteEntry(accountKey, id) {
      db.prepare('DELETE FROM schedule_exceptions WHERE entryId = ?').run(id);
      db.prepare('DELETE FROM schedule_instance_arms WHERE entryId = ?').run(id);
      db.prepare('DELETE FROM schedule_entries WHERE accountKey = ? AND id = ?').run(accountKey, id);
    },
    listLabels(accountKey) {
      return db.prepare('SELECT id, name, color, version FROM schedule_labels WHERE accountKey = ? AND deleted = 0 ORDER BY name, id').all(accountKey);
    },
    findLabel(accountKey, id) {
      return db.prepare('SELECT id, name, color, version, deleted FROM schedule_labels WHERE accountKey = ? AND id = ?').get(accountKey, id);
    },
    insertLabel(label) {
      db.prepare('INSERT INTO schedule_labels (id, accountKey, name, color) VALUES (@id, @accountKey, @name, @color)').run(label);
    },
    writeLabel(label) {
      db.prepare('UPDATE schedule_labels SET name = @name, color = @color, version = @version, deleted = @deleted WHERE accountKey = @accountKey AND id = @id').run(label);
    },
    readSettings(accountKey) {
      return statements.selectSettings.get(accountKey) ?? null;
    },
    insertSettings(row) {
      statements.insertSettings.run(row);
    },
    writeSettings(row) {
      statements.updateSettings.run(row);
    },

    listEntries(accountKey) {
      return statements.selectEntries.all(accountKey).map(mapEntryRow);
    },
    findEntry(accountKey, id) {
      return mapEntryRow(statements.selectEntry.get(accountKey, id));
    },
    insertEntry(entry) {
      statements.insertEntry.run(entryWriteFields(entry));
    },
    writeEntry(entry) {
      statements.updateEntry.run(entryWriteFields(entry));
    },

    listExceptions(entryId) {
      return statements.selectExceptions.all(entryId).map(mapExceptionRow);
    },
    findException(entryId, originDate) {
      return mapExceptionRow(statements.selectException.get(entryId, originDate));
    },
    writeException({ entryId, originDate, mode, content, now }) {
      const existing = statements.selectException.get(entryId, originDate);
      statements.upsertException.run({
        entryId,
        originDate,
        mode,
        contentJson: content === null ? null : JSON.stringify(content),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
    },
    removeException(entryId, originDate) {
      statements.deleteException.run(entryId, originDate);
    },
    clearSeries(entryId) {
      statements.clearExceptions.run(entryId);
      statements.clearArms.run(entryId);
    },

    listArms(entryId) {
      return statements.selectArms.all(entryId);
    },
    findArm(entryId, originDate) {
      return statements.selectArm.get(entryId, originDate) ?? null;
    },
    writeArm({ entryId, originDate, armedAt }) {
      statements.upsertArm.run({ entryId, originDate, armedAt });
    },
    removeArm(entryId, originDate) {
      statements.deleteArm.run(entryId, originDate);
    }
  };
}
