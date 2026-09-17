import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env as defaultEnv } from '../config/env.js';
import { hashPassword } from './auth.js';

const tableConfigs = {
  users: {
    name: 'users',
    columns: {
      name: 'TEXT NOT NULL',
      email: 'TEXT NOT NULL',
      passwordHash: 'TEXT NOT NULL',
      role: 'TEXT NOT NULL'
    }
  },
  scheduleItems: {
    name: 'scheduleItems',
    columns: {
      day: 'TEXT NOT NULL',
      startTime: 'TEXT NOT NULL',
      endTime: 'TEXT NOT NULL',
      subject: 'TEXT NOT NULL',
      className: 'TEXT NOT NULL',
      room: 'TEXT',
      note: 'TEXT'
    }
  },
  reminders: {
    name: 'reminders',
    columns: {
      title: 'TEXT NOT NULL',
      dueAt: 'TEXT NOT NULL',
      priority: 'TEXT NOT NULL',
      status: 'TEXT NOT NULL',
      linkedTo: 'TEXT',
      source: 'TEXT',
      recurrence: 'TEXT NOT NULL',
      recurrenceInterval: 'INTEGER NOT NULL',
      parentReminderId: 'TEXT'
    }
  },
  lessonPlans: {
    name: 'lessonPlans',
    columns: {
      topic: 'TEXT NOT NULL',
      className: 'TEXT NOT NULL',
      objective: 'TEXT NOT NULL',
      duration: 'TEXT NOT NULL',
      materials: 'TEXT',
      starter: 'TEXT',
      mainActivity: 'TEXT',
      assessment: 'TEXT',
      resourceIds: 'TEXT NOT NULL'
    },
    jsonColumns: ['resourceIds']
  },
  worksheetDrafts: {
    name: 'worksheetDrafts',
    columns: {
      title: 'TEXT NOT NULL',
      className: 'TEXT NOT NULL',
      format: 'TEXT NOT NULL',
      topic: 'TEXT NOT NULL',
      marks: 'INTEGER NOT NULL',
      duration: 'TEXT NOT NULL',
      instructions: 'TEXT',
      questionCount: 'INTEGER NOT NULL',
      questionItems: 'TEXT NOT NULL',
      generatedFromLessonId: 'TEXT',
      resourceIds: 'TEXT NOT NULL'
    },
    jsonColumns: ['questionItems', 'resourceIds']
  },
  resources: {
    name: 'resources',
    columns: {
      title: 'TEXT NOT NULL',
      originalName: 'TEXT NOT NULL',
      mimeType: 'TEXT NOT NULL',
      tags: 'TEXT NOT NULL',
      moduleLinks: 'TEXT NOT NULL',
      path: 'TEXT'
    },
    jsonColumns: ['tags', 'moduleLinks']
  },
  templates: {
    name: 'templates',
    columns: {
      moduleId: 'TEXT NOT NULL',
      name: 'TEXT NOT NULL',
      payload: 'TEXT NOT NULL'
    },
    jsonColumns: ['payload']
  }
};

const storeKeys = Object.keys(tableConfigs);

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureDirectories(runtimeEnv) {
  ensureDirectory(path.dirname(runtimeEnv.sqlitePath));
  ensureDirectory(runtimeEnv.uploadDir);
  ensureDirectory(runtimeEnv.exportDir);
}

function createSeedData(runtimeEnv) {
  return {
    users: [
      {
        id: 'users-1',
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z',
        name: 'Refat Teacher',
        email: 'refat@local.test',
        passwordHash: hashPassword(runtimeEnv.demoPassword),
        role: 'teacher'
      }
    ],
    scheduleItems: [
      {
        id: 'scheduleItems-1',
        day: 'Sunday',
        startTime: '08:00',
        endTime: '08:40',
        subject: 'Physics',
        className: 'STD IX',
        room: 'Room 3',
        note: 'Pendulum practical prep',
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z'
      },
      {
        id: 'scheduleItems-2',
        day: 'Monday',
        startTime: '10:00',
        endTime: '10:40',
        subject: 'Mathematics',
        className: 'STD VI',
        room: 'Room 1',
        note: 'Revision on fractions',
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z'
      }
    ],
    reminders: [
      {
        id: 'reminders-1',
        title: 'Prepare CT paper for STD IX Physics',
        dueAt: '2026-04-06T18:00:00.000Z',
        priority: 'high',
        status: 'pending',
        linkedTo: null,
        source: 'manual',
        recurrence: 'weekly',
        recurrenceInterval: 1,
        parentReminderId: null,
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z'
      }
    ],
    lessonPlans: [
      {
        id: 'lessonPlans-1',
        topic: 'Simple Pendulum',
        className: 'STD VI',
        objective: 'Explain oscillation and time period.',
        duration: '35 min',
        materials: 'String, bob, stopwatch, metre rule',
        starter: 'Ask students what makes swings go faster or slower.',
        mainActivity: 'Measure time for 10 oscillations for different lengths.',
        assessment: 'Exit ticket on time period and oscillation.',
        resourceIds: [],
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z'
      }
    ],
    worksheetDrafts: [
      {
        id: 'worksheetDrafts-1',
        title: 'Electricity & Magnetism Practice',
        className: 'STD IX',
        format: 'O-Level structured',
        topic: 'Current electricity',
        marks: 25,
        duration: '40 min',
        instructions: 'Show all working. Use dotted answer spaces.',
        questionCount: 6,
        questionItems: [],
        generatedFromLessonId: null,
        resourceIds: [],
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z'
      }
    ],
    resources: [
      {
        id: 'resources-1',
        title: 'Pendulum Investigation Notes',
        originalName: 'pendulum-investigation-notes.pdf',
        mimeType: 'application/pdf',
        tags: ['science', 'pendulum', 'std-vi'],
        moduleLinks: ['lesson-planner'],
        path: '',
        createdAt: '2026-04-05T00:00:00.000Z',
        updatedAt: '2026-04-05T00:00:00.000Z'
      }
    ],
    templates: [
      {
        id: 'templates-1',
        createdAt: '2026-04-01T12:00:00.000Z',
        updatedAt: '2026-04-01T12:00:00.000Z',
        moduleId: 'lesson-planner',
        name: 'Theory Lesson Starter',
        payload: {
          duration: '35 min',
          starter: 'Quick recall quiz from last class.',
          mainActivity: 'Board explanation, guided examples, and pair discussion.',
          assessment: 'Short exit ticket with 3 questions.'
        }
      },
      {
        id: 'templates-2',
        createdAt: '2026-04-01T12:05:00.000Z',
        updatedAt: '2026-04-01T12:05:00.000Z',
        moduleId: 'worksheet-designer',
        name: 'CT O-Level Short Paper',
        payload: {
          format: 'O-Level structured',
          marks: 15,
          duration: '35 min',
          questionCount: 5,
          instructions: 'Answer all questions. Use dotted answer lines. Leave blank space for diagrams where necessary.'
        }
      }
    ]
  };
}

function createInsertStatement(config) {
  const fields = ['id', 'createdAt', 'updatedAt', ...Object.keys(config.columns)];
  const placeholders = fields.map((field) => `@${field}`).join(', ');
  return `INSERT INTO ${config.name} (${fields.join(', ')}) VALUES (${placeholders})`;
}

function createUpdateStatement(config) {
  const assignments = Object.keys(config.columns)
    .map((field) => `${field} = @${field}`)
    .concat('updatedAt = @updatedAt')
    .join(', ');
  return `UPDATE ${config.name} SET ${assignments} WHERE id = @id`;
}

function normalizeStoredItem(key, item) {
  const config = tableConfigs[key];
  if (!config) return item;
  const normalized = { ...item };

  if (key === 'users' && normalized.password && !normalized.passwordHash) {
    normalized.passwordHash = hashPassword(normalized.password);
    delete normalized.password;
  }

  for (const column of config.jsonColumns || []) {
    if (normalized[column] === undefined || normalized[column] === null || normalized[column] === '') {
      normalized[column] = column === 'payload' ? {} : [];
    }
  }

  if (key === 'reminders' && normalized.parentReminderId === undefined) {
    normalized.parentReminderId = null;
  }

  return normalized;
}

function serializeItem(key, item) {
  const config = tableConfigs[key];
  const normalized = normalizeStoredItem(key, item);
  const row = {
    id: normalized.id,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };

  for (const field of Object.keys(config.columns)) {
    const value = normalized[field];
    row[field] = (config.jsonColumns || []).includes(field) ? JSON.stringify(value ?? (field === 'payload' ? {} : [])) : value ?? null;
  }

  return row;
}

function deserializeRow(key, row) {
  if (!row) return null;
  const config = tableConfigs[key];
  const item = { ...row };

  for (const field of config.jsonColumns || []) {
    item[field] = safeJsonParse(item[field], field === 'payload' ? {} : []);
  }

  return item;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  for (const [key, config] of Object.entries(tableConfigs)) {
    const columnDefinitions = Object.entries(config.columns)
      .map(([field, type]) => `${field} ${type}`)
      .join(', ');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${key} (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        ${columnDefinitions}
      );
    `);
  }
}

function isStoreEmpty(db) {
  return storeKeys.every((key) => {
    const result = db.prepare(`SELECT COUNT(*) AS count FROM ${key}`).get();
    return Number(result.count) === 0;
  });
}

function readLegacyStore(runtimeEnv) {
  if (!fs.existsSync(runtimeEnv.legacyDataFile)) {
    return null;
  }

  try {
    const store = JSON.parse(fs.readFileSync(runtimeEnv.legacyDataFile, 'utf-8'));
    const hasData = storeKeys.some((key) => Array.isArray(store[key]) && store[key].length > 0);
    return hasData ? store : null;
  } catch {
    return null;
  }
}

function importStore(db, store) {
  const insertions = storeKeys.map((key) => {
    const statement = db.prepare(createInsertStatement(tableConfigs[key]));
    return { key, statement };
  });

  const insertTransaction = db.transaction((payload) => {
    for (const { key, statement } of insertions) {
      const items = Array.isArray(payload[key]) ? payload[key] : [];
      for (const item of items) {
        statement.run(serializeItem(key, item));
      }
    }
  });

  insertTransaction(payloadFromStore(store));
}

function payloadFromStore(store) {
  return storeKeys.reduce((accumulator, key) => {
    accumulator[key] = (store[key] || []).map((item) => normalizeStoredItem(key, item));
    return accumulator;
  }, {});
}

function setMetadata(db, key, value) {
  db.prepare(`
    INSERT INTO app_metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function getMetadata(db, key) {
  const result = db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key);
  return result?.value ?? null;
}

function bootstrapDatabase(db, runtimeEnv) {
  if (!isStoreEmpty(db)) {
    return;
  }

  const legacyStore = readLegacyStore(runtimeEnv);
  if (legacyStore) {
    importStore(db, legacyStore);
    setMetadata(db, 'bootstrapSource', 'legacy-import');
    setMetadata(db, 'legacyImportComplete', 'true');
    return;
  }

  importStore(db, createSeedData(runtimeEnv));
  setMetadata(db, 'bootstrapSource', 'seed');
}

function generateId(key) {
  return `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getComparableTime(item) {
  return item.updatedAt || item.createdAt || '';
}

function sortByCreatedDesc(items) {
  return [...items].sort((a, b) => (getComparableTime(a) < getComparableTime(b) ? 1 : -1));
}

export function createDataStore(runtimeEnv = defaultEnv) {
  ensureDirectories(runtimeEnv);
  const db = new Database(runtimeEnv.sqlitePath);
  db.pragma('journal_mode = WAL');
  ensureSchema(db);
  bootstrapDatabase(db, runtimeEnv);

  const listStatements = Object.fromEntries(
    storeKeys.map((key) => [
      key,
      db.prepare(`SELECT * FROM ${key}`)
    ])
  );

  const getStatements = Object.fromEntries(
    storeKeys.map((key) => [
      key,
      db.prepare(`SELECT * FROM ${key} WHERE id = ?`)
    ])
  );

  const removeStatements = Object.fromEntries(
    storeKeys.map((key) => [
      key,
      db.prepare(`DELETE FROM ${key} WHERE id = ?`)
    ])
  );

  const insertStatements = Object.fromEntries(
    storeKeys.map((key) => [
      key,
      db.prepare(createInsertStatement(tableConfigs[key]))
    ])
  );

  const updateStatements = Object.fromEntries(
    storeKeys.map((key) => [
      key,
      db.prepare(createUpdateStatement(tableConfigs[key]))
    ])
  );

  return {
    list(key) {
      return sortByCreatedDesc(listStatements[key].all().map((row) => deserializeRow(key, row)));
    },

    listWhere(key, predicate) {
      return this.list(key).filter(predicate);
    },

    get(key, id) {
      return deserializeRow(key, getStatements[key].get(id));
    },

    create(key, value) {
      const timestamp = new Date().toISOString();
      const item = normalizeStoredItem(key, {
        id: generateId(key),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...value
      });
      insertStatements[key].run(serializeItem(key, item));
      return item;
    },

    update(key, id, updates) {
      const currentItem = this.get(key, id);
      if (!currentItem) return null;
      const updatedItem = normalizeStoredItem(key, {
        ...currentItem,
        ...updates,
        id,
        updatedAt: new Date().toISOString()
      });
      updateStatements[key].run(serializeItem(key, updatedItem));
      return updatedItem;
    },

    remove(key, id) {
      const item = this.get(key, id);
      if (!item) return null;
      removeStatements[key].run(id);
      return item;
    },

    snapshot() {
      return storeKeys.reduce((accumulator, key) => {
        accumulator[key] = this.list(key);
        return accumulator;
      }, {});
    },

    close() {
      db.close();
    },

    paths: {
      uploadDir: runtimeEnv.uploadDir,
      exportDir: runtimeEnv.exportDir,
      dataFile: runtimeEnv.sqlitePath,
      sqliteFile: runtimeEnv.sqlitePath,
      legacyDataFile: runtimeEnv.legacyDataFile
    },

    metadata: {
      get(key) {
        return getMetadata(db, key);
      }
    }
  };
}

export const dataStore = createDataStore();
