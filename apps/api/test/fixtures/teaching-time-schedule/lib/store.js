// Classes reference substitutes for the isolated schedule suites.
import crypto from 'node:crypto';
import { contractError, problems } from '../../../../src/workbench/problems.js';
import { assertPortAvailable } from '../runtime.js';

export const recordLabelFields = ['note', 'position', 'unfinished', 'commonIssues', 'nextNote'];

function truncateCodePoints(value, limit) {
  return [...value].slice(0, limit).join('');
}

/** RecordReference.label: note, else the first non-blank detail field. */
export function recordReferenceLabel(record) {
  for (const field of recordLabelFields) {
    const text = String(record[field] ?? '').trim();
    if (text !== '') return truncateCodePoints(text, 300);
  }
  return '';
}

export function createFixtureStore(db) {
  const statements = {
    insertClass: db.prepare(`
      INSERT INTO teaching_time_fixture_classes (id, accountKey, name, version, createdAt, updatedAt, deletedAt)
      VALUES (@id, @accountKey, @name, 1, @now, @now, NULL)
    `),
    listClasses: db.prepare('SELECT * FROM teaching_time_fixture_classes WHERE accountKey = ? ORDER BY name ASC, id ASC'),
    findClass: db.prepare('SELECT * FROM teaching_time_fixture_classes WHERE accountKey = ? AND id = ?'),
    setClassDeleted: db.prepare(`
      UPDATE teaching_time_fixture_classes
      SET deletedAt = @deletedAt, version = version + 1, updatedAt = @now
      WHERE accountKey = @accountKey AND id = @id
    `),

    insertRecord: db.prepare(`
      INSERT INTO teaching_time_fixture_records (
        id, accountKey, classId, recordedOn, note, position, unfinished, commonIssues, nextNote,
        version, createdAt, updatedAt, deletedAt
      ) VALUES (
        @id, @accountKey, @classId, @recordedOn, @note, @position, @unfinished, @commonIssues, @nextNote,
        1, @now, @now, NULL
      )
    `),
    listRecords: db.prepare(`
      SELECT * FROM teaching_time_fixture_records
      WHERE accountKey = ? AND (@classId IS NULL OR classId = @classId)
      ORDER BY recordedOn DESC, updatedAt DESC, id ASC
    `),
    findRecord: db.prepare('SELECT * FROM teaching_time_fixture_records WHERE accountKey = ? AND id = ?'),
    setRecordDeleted: db.prepare(`
      UPDATE teaching_time_fixture_records
      SET deletedAt = @deletedAt, version = version + 1, updatedAt = @now
      WHERE accountKey = @accountKey AND id = @id
    `)
  };

  function now() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  const store = {
    createClass(accountKey, { name }) {
      const id = crypto.randomUUID();
      statements.insertClass.run({ id, accountKey, name, now: now() });
      return store.findClass(accountKey, id);
    },
    listClasses(accountKey) {
      return statements.listClasses.all(accountKey);
    },
    findClass(accountKey, id) {
      return statements.findClass.get(accountKey, id) ?? null;
    },
    setClassDeleted(accountKey, id, deleted) {
      const existing = store.findClass(accountKey, id);
      if (!existing) throw contractError(problems.notFound());
      statements.setClassDeleted.run({
        accountKey,
        id,
        deletedAt: deleted ? now() : null,
        now: now()
      });
      return store.findClass(accountKey, id);
    },

    createRecord(accountKey, input) {
      const id = crypto.randomUUID();
      statements.insertRecord.run({
        id,
        accountKey,
        classId: input.classId,
        recordedOn: input.recordedOn,
        note: input.note ?? '',
        position: input.position ?? '',
        unfinished: input.unfinished ?? '',
        commonIssues: input.commonIssues ?? '',
        nextNote: input.nextNote ?? '',
        now: now()
      });
      return store.findRecord(accountKey, id);
    },
    listRecords(accountKey, classId = null) {
      return statements.listRecords.all(accountKey, { classId });
    },
    findRecord(accountKey, id) {
      return statements.findRecord.get(accountKey, id) ?? null;
    },
    setRecordDeleted(accountKey, id, deleted) {
      const existing = store.findRecord(accountKey, id);
      if (!existing) throw contractError(problems.notFound());
      statements.setRecordDeleted.run({ accountKey, id, deletedAt: deleted ? now() : null, now: now() });
      return store.findRecord(accountKey, id);
    },

    /** Public port: ClassReference; another account is a 404, never a leak. */
    readClassReference(principal, id) {
      assertPortAvailable('classes.readClass');
      const row = store.findClass(principal.accountKey, id);
      if (!row) throw contractError(problems.notFound());
      return {
        id: row.id,
        version: row.version,
        name: row.name,
        deletedAt: row.deletedAt
      };
    },

    /** Public port: RecordReference with classDeletedAt derived from the class. */
    readRecordReference(principal, id) {
      assertPortAvailable('classes.readRecord');
      const row = store.findRecord(principal.accountKey, id);
      if (!row) throw contractError(problems.notFound());
      const classroom = store.findClass(principal.accountKey, row.classId);
      return {
        id: row.id,
        version: row.version,
        classId: row.classId,
        label: recordReferenceLabel(row),
        deletedAt: row.deletedAt,
        classDeletedAt: classroom?.deletedAt ?? null
      };
    }
  };

  return store;
}

export function readString(body, key, fallback = '') {
  const value = body?.[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') throw contractError(problems.invalidInput(`/${key}`, 'invalid-type'));
  return value;
}

export function readBoolean(body, key) {
  const value = body?.[key];
  if (typeof value !== 'boolean') throw contractError(problems.invalidInput(`/${key}`, 'invalid-type'));
  return value;
}
