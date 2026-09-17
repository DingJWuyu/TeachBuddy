import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env as defaultEnv } from '../config/env.js';

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
      ownerId: 'TEXT NOT NULL',
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
      ownerId: 'TEXT NOT NULL',
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
      ownerId: 'TEXT NOT NULL',
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
      ownerId: 'TEXT NOT NULL',
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
      ownerId: 'TEXT NOT NULL',
      moduleId: 'TEXT NOT NULL',
      name: 'TEXT NOT NULL',
      payload: 'TEXT NOT NULL'
    },
    jsonColumns: ['payload']
  },
  workspaceLayouts: {
    name: 'workspaceLayouts',
    columns: {
      ownerId: 'TEXT NOT NULL',
      hiddenModuleIds: 'TEXT NOT NULL',
      groups: 'TEXT NOT NULL',
      ungroupedModuleIds: 'TEXT NOT NULL'
    },
    jsonColumns: ['hiddenModuleIds', 'groups', 'ungroupedModuleIds']
  },
  passwordResetCodes: {
    name: 'passwordResetCodes',
    columns: {
      userId: 'TEXT NOT NULL',
      codeHash: 'TEXT NOT NULL',
      codeSalt: 'TEXT NOT NULL',
      expiresAt: 'TEXT NOT NULL',
      usedAt: 'TEXT'
    }
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

function ownerIndexName(key) {
  return `${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_owner_id_idx`;
}

function createInsertStatement(config) {
  const fields = ['id', 'createdAt', 'updatedAt', ...Object.keys(config.columns)];
  const placeholders = fields.map((field) => `@${field}`).join(', ');
  return `INSERT INTO ${config.name} (${fields.join(', ')}) VALUES (${placeholders})`;
}

function createAccountUpdateStatement(config) {
  const assignments = Object.keys(config.columns)
    .map((field) => `${field} = @${field}`)
    .concat('updatedAt = @updatedAt')
    .join(', ');
  return `UPDATE ${config.name} SET ${assignments} WHERE id = @id AND ownerId = @ownerId`;
}

function normalizeStoredItem(key, item) {
  const config = tableConfigs[key];
  if (!config) return item;
  const normalized = { ...item };

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

  for (const [key, config] of Object.entries(tableConfigs)) {
    if (!config.columns.ownerId) continue;
    const columns = db.prepare(`PRAGMA table_info(${config.name})`).all();
    if (!columns.some((column) => column.name === 'ownerId')) {
      db.exec(`ALTER TABLE ${config.name} ADD COLUMN ownerId TEXT`);
    }
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email COLLATE NOCASE);');
  for (const [key, config] of Object.entries(tableConfigs)) {
    if (!config.columns.ownerId) continue;
    db.exec(`CREATE INDEX IF NOT EXISTS ${ownerIndexName(key)} ON ${config.name} (ownerId);`);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS workspace_layouts_owner_unique ON workspaceLayouts (ownerId);');
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

  const findUserByEmailStatement = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
  const userPasswordUpdateStatement = db.prepare(
    'UPDATE users SET passwordHash = @passwordHash, updatedAt = @updatedAt WHERE id = @id'
  );
  const passwordResetCodeListStatement = db.prepare('SELECT * FROM passwordResetCodes WHERE userId = ?');
  const passwordResetCodeGetStatement = db.prepare('SELECT * FROM passwordResetCodes WHERE id = ? AND userId = ?');
  const passwordResetCodeUseStatement = db.prepare(
    'UPDATE passwordResetCodes SET usedAt = @usedAt, updatedAt = @updatedAt WHERE id = @id AND userId = @userId'
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

  const insertStatements = Object.fromEntries(
    storeKeys.map((key) => [
      key,
      db.prepare(createInsertStatement(tableConfigs[key]))
    ])
  );

  const accountUpdateStatements = Object.fromEntries(
    accountScopedKeys.map((key) => [
      key,
      db.prepare(createAccountUpdateStatement(tableConfigs[key]))
    ])
  );

  const accountRemoveStatements = Object.fromEntries(
    accountScopedKeys.map((key) => [
      key,
      db.prepare(`DELETE FROM ${key} WHERE id = ? AND ownerId = ?`)
    ])
  );

  function assertAccountScopedKey(key) {
    if (!tableConfigs[key]?.columns.ownerId) {
      throw new Error(`Data store key ${key} does not support account ownership.`);
    }
  }

  function createItem(key, value) {
    const timestamp = new Date().toISOString();
    const item = normalizeStoredItem(key, {
      id: generateId(key),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...value
    });
    insertStatements[key].run(serializeItem(key, item));
    return item;
  }

  function updateAccountItem(key, id, accountId, updates) {
    const currentItem = deserializeRow(key, accountGetStatements[key].get(id, accountId));
    if (!currentItem) return null;
    const updatedItem = normalizeStoredItem(key, {
      ...currentItem,
      ...updates,
      ownerId: accountId,
      id,
      updatedAt: new Date().toISOString()
    });
    accountUpdateStatements[key].run(serializeItem(key, updatedItem));
    return updatedItem;
  }

  function removeAccountItem(key, id, accountId) {
    const item = deserializeRow(key, accountGetStatements[key].get(id, accountId));
    if (!item) return null;
    accountRemoveStatements[key].run(id, accountId);
    return item;
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
        return createItem(key, { ...value, ownerId: accountId });
      },

      update(key, id, updates) {
        assertAccountScopedKey(key);
        return updateAccountItem(key, id, accountId, updates);
      },

      remove(key, id) {
        assertAccountScopedKey(key);
        return removeAccountItem(key, id, accountId);
      }
    };
  }

  const dataStore = {
    findUserByEmail(email) {
      return deserializeRow('users', findUserByEmailStatement.get(email));
    },

    createUser(value) {
      return createItem('users', value);
    },

    updateUserPassword(userId, passwordHash) {
      const result = userPasswordUpdateStatement.run({
        id: userId,
        passwordHash,
        updatedAt: new Date().toISOString()
      });
      return result.changes > 0;
    },

    createPasswordResetCode(value) {
      return createItem('passwordResetCodes', value);
    },

    listPasswordResetCodes(userId) {
      return sortByCreatedDesc(passwordResetCodeListStatement.all(userId).map((row) => deserializeRow('passwordResetCodes', row)));
    },

    markPasswordResetCodeUsed(id, userId, usedAt) {
      const currentItem = deserializeRow('passwordResetCodes', passwordResetCodeGetStatement.get(id, userId));
      if (!currentItem) return null;
      passwordResetCodeUseStatement.run({
        id,
        userId,
        usedAt,
        updatedAt: new Date().toISOString()
      });
      return deserializeRow('passwordResetCodes', passwordResetCodeGetStatement.get(id, userId));
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
