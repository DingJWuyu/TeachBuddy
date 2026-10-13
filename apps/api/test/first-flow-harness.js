// Real-composition harness for the B13 first-flow suites.
//
// Every request goes through the production workbench: the same SQLite file,
// migration runner, `mutations.execute` transaction, identity seam, HTTP
// transport, origin/protection guards and Problem mapping the API process uses.
// Nothing here substitutes a seam: the modules under test are the real modules,
// and the only test-only parts are the isolated database, the deterministic
// idempotency keys, the fault-injection triggers and the runner's test
// principals (server-side sessions; a client cannot choose its principal).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createB16Workbench } from './fixtures/first-flow/b16-workbench.js';
import { createApp } from '../src/app.js';
import { createEnv } from '../src/config/env.js';
import { createWorkbenchLogger } from '../src/workbench/logger.js';

export const TRUSTED_ORIGIN = 'https://workbench.first-flow.test';

// Test-only identities of this harness. The runner derives their session
// tokens from a fixed secret, so an independent process restart keeps them.
export const FIRST_FLOW_ACCOUNTS = Object.freeze(['teacher-a', 'teacher-b']);

// Assertions for the problem+json contract. The literal type strings are kept
// here so a wrong constant in production code cannot mask a broken response.
export function assertProblem(response, status, type) {
  assert.equal(response.status, status);
  assert.match(String(response.headers['content-type']), /^application\/problem\+json/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.type, type);
  return response.body;
}

const FAULT_TABLES = ['question_items'];

export async function createFirstFlowHarness(options = {}) {
  // Tests may hand in a database that already holds a previous-stage schema and
  // rows: migrations then run as an upgrade and the file is not deleted here.
  const externalDatabase = typeof options.databasePath === 'string';
  const sqlitePath = externalDatabase
    ? path.resolve(options.databasePath)
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b13-first-flow-')), 'workbench.sqlite');
  const rootDir = path.dirname(sqlitePath);
  const trustedOrigin = options.trustedOrigin ?? TRUSTED_ORIGIN;

  const env = createEnv({
    appName: 'B13 first-flow harness',
    nodeEnv: 'test',
    sqlitePath,
    workbench: {
      mode: 'test-principal',
      testPrincipals: FIRST_FLOW_ACCOUNTS,
      sessionSecret: 'b13-first-flow-harness-session-secret',
      trustedOrigins: [trustedOrigin],
      logDir: path.join(rootDir, 'logs')
    }
  });

  let runtime = null;

  async function openRuntime() {
    runtime = createApp({
      env,
      workbenchClock: options.clock,
      ...(options.baselineOnly ? { workbench: createB16Workbench({env}) } : {}),
      workbenchLogger: createWorkbenchLogger({
        logDir: path.join(rootDir, 'logs'),
        consoleOutput: false
      })
    });
    await runtime.workbench.initialize();
  }

  await openRuntime();

  let sequence = 0;

  function nextUuid() {
    sequence += 1;
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  }

  function createAccount(accountKey) {
    if (!FIRST_FLOW_ACCOUNTS.includes(accountKey)) {
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

    injectFault(sql) { runtime.workbench.db.exec(sql); },

    query(sql, ...params) {
      return runtime.workbench.db.prepare(sql).all(...params);
    },

    count(sql, ...params) {
      return runtime.workbench.db.prepare(sql).get(...params)?.count ?? 0;
    },

    createAccount,
    agent,
    nextUuid,

    /** Close the API (and its database) and open the same isolated file again. */
    async restart() {
      await runtime.dataStore.close();
      await openRuntime();
    },

    failWritesTo,

    clearFaults() {
      for (const table of FAULT_TABLES) {
        runtime.workbench.db.exec(`DROP TRIGGER IF EXISTS harness_fail_writes_${table}`);
      }
    },

    async close() {
      await runtime.dataStore.close();
      if (!externalDatabase) fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

// Samples come from the OpenAPI components.examples so tests and the frontend
// substitute share one dataset (first-flow-cases.md).
export function pastedQuestionSample(overrides = {}) {
  return {
    title: '二次函数最小值',
    body: {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          runs: [
            { type: 'text', text: '已知函数 ' },
            { type: 'math', latex: 'f(x)=x^2-2x' },
            { type: 'text', text: '，求最小值，并说明理由。' }
          ]
        }
      ]
    },
    solution: {
      version: 1,
      blocks: [
        { type: 'math', latex: 'f(x)=(x-1)^2-1\\geq -1' },
        { type: 'paragraph', runs: [{ type: 'text', text: '当 x=1 时取等号。' }] }
      ]
    },
    note: '先让学生尝试配方。',
    starred: true,
    source: {
      kind: 'paste',
      text: '已知函数 f(x)=x^2-2x，求最小值，并说明理由。\n\n答案：-1；配方求解。'
    },
    ...overrides
  };
}

export function manualQuestionSample(overrides = {}) {
  return {
    title: '自建题目',
    body: {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          runs: [
            { type: 'text', text: '计算 ' },
            { type: 'math', latex: '1+1' }
          ]
        }
      ]
    },
    solution: { version: 1, blocks: [] },
    note: '',
    starred: false,
    source: { kind: 'manual' },
    ...overrides
  };
}

export function variantCopySample(baseVersion, overrides = {}) {
  return {
    baseVersion,
    title: '二次函数变式',
    body: {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          runs: [
            { type: 'text', text: '已知函数 ' },
            { type: 'math', latex: 'g(x)=x^2-4x' },
            { type: 'text', text: '，求最小值，并说明理由。' }
          ]
        }
      ]
    },
    solution: {
      version: 1,
      blocks: [
        { type: 'math', latex: 'g(x)=(x-2)^2-4\\geq -4' },
        { type: 'paragraph', runs: [{ type: 'text', text: '当 x=2 时取等号。' }] }
      ]
    },
    note: '',
    starred: false,
    ...overrides
  };
}
