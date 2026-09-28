// Real-composition harness for the T51 classes suites.
//
// Every request goes through the production workbench: the same SQLite file,
// migration runner, `mutations.execute` transaction, identity seam, HTTP
// transport, origin/protection guards and Problem mapping the API process uses.
// The catalog override and the classes implementation are the T51 fixture: the
// product catalog stays T53-owned until classes is integrated. The clock is
// fixed so contract timestamps are reproducible; requests can never submit it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import request from 'supertest';
import { moduleCatalog } from '@refatos/shared';
import { createApp } from '../src/app.js';
import { createEnv } from '../src/config/env.js';
import { createWorkbench } from '../src/workbench/index.js';
import { createWorkbenchLogger } from '../src/workbench/logger.js';
import { classesCatalogEntry, classesImplementation } from './fixtures/teaching-time-classes/catalog.js';
import { setClassesFixtureClock } from './fixtures/teaching-time-classes/modules/classes/index.js';

export const TRUSTED_ORIGIN = 'https://workbench.t51.test';
export const TEACHING_TIME_ACCOUNTS = Object.freeze(['teacher-a', 'teacher-b']);
export const TEST_NOW = '2026-09-21T06:00:00.000Z';

export function assertProblem(response, status, type) {
  assert.equal(response.status, status);
  assert.match(String(response.headers['content-type']), /^application\/problem\+json/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.type, type);
  return response.body;
}

const FAULT_TABLES = [
  'classes_items',
  'classes_records',
  'classes_record_sources',
  'question_items',
  'lesson_items'
];

export async function createTeachingTimeClassesHarness(options = {}) {
  const externalDatabase = typeof options.databasePath === 'string';
  const sqlitePath = externalDatabase
    ? path.resolve(options.databasePath)
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 't51-classes-')), 'workbench.sqlite');
  const rootDir = path.dirname(sqlitePath);
  const trustedOrigin = options.trustedOrigin ?? TRUSTED_ORIGIN;

  const env = createEnv({
    appName: 'T51 classes harness',
    nodeEnv: 'test',
    sqlitePath,
    workbench: {
      mode: 'test-principal',
      testPrincipals: TEACHING_TIME_ACCOUNTS,
      sessionSecret: 't51-classes-harness-session-secret',
      trustedOrigins: [trustedOrigin],
      logDir: path.join(rootDir, 'logs'),
      extraImplementations: { classes: classesImplementation },
      catalogOverride: moduleCatalog.map(entry => entry.id === 'classes' ? classesCatalogEntry : entry)
    }
  });

  let currentTime = new Date(options.startTime ?? TEST_NOW);
  const clock = () => currentTime;
  // The classes module has no clock in its production factory signature; the
  // T51 fixture exposes a test-only setter so this harness can fix it.
  setClassesFixtureClock(clock);
  let runtime = null;

  async function openRuntime() {
    const logger = createWorkbenchLogger({ logDir: path.join(rootDir, 'logs'), consoleOutput: false });
    const workbench = createWorkbench({ env, logger, clock });
    runtime = createApp({ env, workbench, workbenchLogger: logger, now: clock });
    await runtime.workbench.initialize();
  }

  await openRuntime();

  let sequence = 0;

  function nextUuid() {
    sequence += 1;
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  }

  function createAccount(accountKey) {
    if (!TEACHING_TIME_ACCOUNTS.includes(accountKey)) {
      throw new Error(`Unknown test principal: ${accountKey}`);
    }
    const session = runtime.workbench.identity.testPrincipalCookie(accountKey);
    return { accountKey, token: session.value, cookie: session.header.split(';')[0] };
  }

  function agent(account) {
    function authed(method, url, { body, key, query, headers = {}, cookie, origin, protection } = {}) {
      let req = request(runtime.app)[method](url);
      if (query !== undefined) req = req.query(query);
      if (cookie !== null) req = req.set('Cookie', cookie ?? account.cookie);
      if (origin !== null) req = req.set('Origin', origin ?? trustedOrigin);
      if (protection !== null) req = req.set('X-TeachBuddy-Request', protection ?? '1');
      if (key !== undefined && key !== null) req = req.set('Idempotency-Key', key);
      for (const [name, value] of Object.entries(headers)) req = req.set(name, value);
      if (body !== undefined) req = req.send(body);
      return req;
    }
    return {
      get: (url, query) => authed('get', url, { query, origin: null, protection: null }),
      post: (url, body, options = {}) => authed('post', url, { ...options, body }),
      put: (url, body, options = {}) => authed('put', url, { ...options, body }),
      send: authed
    };
  }

  function failWritesTo(table) {
    if (!FAULT_TABLES.includes(table)) throw new Error(`Unsupported fault table: ${table}`);
    runtime.workbench.db.exec(`
      CREATE TRIGGER IF NOT EXISTS harness_fail_writes_${table}
      BEFORE INSERT ON ${table}
      BEGIN SELECT RAISE(ABORT, 'harness injected write failure'); END;
    `);
  }

  return {
    rootDir,
    sqlitePath,
    trustedOrigin,

    app() {
      return runtime.app;
    },

    raw() {
      return request(runtime.app);
    },

    db() {
      return runtime.workbench.db;
    },

    query(sql, ...params) {
      return runtime.workbench.db.prepare(sql).all(...params);
    },

    count(sql, ...params) {
      return runtime.workbench.db.prepare(sql).get(...params)?.count ?? 0;
    },

    countRows(table) {
      return runtime.workbench.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    },

    createAccount,
    agent,
    nextUuid,

    setNow(iso) {
      currentTime = new Date(iso);
    },

    nowIso() {
      return currentTime.toISOString();
    },

    advance(ms) {
      currentTime = new Date(currentTime.getTime() + ms);
      return currentTime.toISOString();
    },

    /** Close the API (and its database) and open the same isolated file again. */
    async restart() {
      runtime.dataStore.close();
      await openRuntime();
    },

    failWritesTo,

    clearFaults() {
      for (const table of FAULT_TABLES) {
        runtime.workbench.db.exec(`DROP TRIGGER IF EXISTS harness_fail_writes_${table}`);
      }
    },

    close() {
      runtime.dataStore.close();
      if (!externalDatabase) fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

/** Samples mirror apps/api/test/fixtures/contracts/teaching-time-v1-samples.json for classes. */
export function classSample(overrides = {}) {
  return { name: '高一(1)班', ...overrides };
}

export function recordSample(classId, overrides = {}) {
  return {
    classId,
    recordedOn: '2026-09-21',
    note: '例2没讲，任意性还需强调',
    position: '',
    unfinished: '',
    commonIssues: '',
    nextNote: '',
    sources: [],
    ...overrides
  };
}

export function questionSample(overrides = {}) {
  return {
    title: '函数单调性',
    body: { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '判断单调性。' }] }] },
    solution: { version: 1, blocks: [] },
    note: '',
    starred: false,
    source: { kind: 'manual' },
    ...overrides
  };
}

export function lessonSample(overrides = {}) {
  return {
    title: '函数单调性',
    intro: { version: 1, blocks: [] },
    sections: [],
    materials: [],
    ...overrides
  };
}
