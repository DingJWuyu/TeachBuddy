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
      email: 'TEXT NOT NULL COLLATE NOCASE',
      passwordHash: 'TEXT NOT NULL',
      role: 'TEXT NOT NULL'
    }
  },
  scheduleItems: {
    name: 'scheduleItems',
    columns: {
      ownerId: 'TEXT NOT NULL',
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

  const scheduleColumns = db.prepare('PRAGMA table_info(scheduleItems)').all();
  if (!scheduleColumns.some((column) => column.name === 'ownerId')) {
    db.exec('ALTER TABLE scheduleItems ADD COLUMN ownerId TEXT');
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email COLLATE NOCASE);');
  db.exec('CREATE INDEX IF NOT EXISTS schedule_items_owner_id_idx ON scheduleItems (ownerId);');
}

function getMetadata(db, key) {
  const result = db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key);
  return result?.value ?? null;
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

  const accountScopedKeys = storeKeys.filter((key) => tableConfigs[key].columns.ownerId);
  const accountListStatements = Object.fromEntries(
    accountScopedKeys.map((key) => [
      key,
      db.prepare(`SELECT * FROM ${key} WHERE ownerId = ?`)
    ])
  );

  const accountGetStatements = Object.fromEntries(
    accountScopedKeys.map((key) => [
      key,
      db.prepare(`SELECT * FROM ${key} WHERE id = ? AND ownerId = ?`)
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

  function assertAccountScopedKey(key) {
    if (!tableConfigs[key]?.columns.ownerId) {
      throw new Error(`Data store key ${key} does not support account ownership.`);
    }
  }

  function createAccountStore(accountId) {
    if (typeof accountId !== 'string' || !accountId.trim()) {
      throw new TypeError('An account ID is required for account-scoped data access.');
    }

    return {
      list(key) {
        assertAccountScopedKey(key);
        return sortByCreatedDesc(accountListStatements[key].all(accountId).map((row) => deserializeRow(key, row)));
      },

      get(key, id) {
        assertAccountScopedKey(key);
        return deserializeRow(key, accountGetStatements[key].get(id, accountId));
      },

      create(key, value) {
        assertAccountScopedKey(key);
        return dataStore.create(key, { ...value, ownerId: accountId });
      },

      update(key, id, updates) {
        assertAccountScopedKey(key);
        const currentItem = this.get(key, id);
        if (!currentItem) return null;
        return dataStore.update(key, id, { ...updates, ownerId: accountId });
      },

      remove(key, id) {
        assertAccountScopedKey(key);
        const currentItem = this.get(key, id);
        if (!currentItem) return null;
        return dataStore.remove(key, id);
      }
    };
  }

  const dataStore = {
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
      sqliteFile: runtimeEnv.sqlitePath
    },

    metadata: {
      get(key) {
        return getMetadata(db, key);
      }
    },

    forAccount(accountId) {
      return createAccountStore(accountId);
    }
  };

  return dataStore;
}
