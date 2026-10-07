/**
 * Real-composition harness for the T52 schedule suites.
 *
 * Every request goes through the production workbench transport: the same
 * SQLite file, migration runner, `mutations.execute` transaction, identity
 * seam, origin/protection guards and Problem mapping the API process uses. The
 * only substitutions are the classes/lessons provider ports (T51/T53 deliver
 * the real ones) and the fixture clock/beforeChange the composition root would
 * otherwise own.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createEnv } from '../../../src/config/env.js';
import { createTeachingTimeWorkbench } from './workbench.js';
import { createWorkbenchLogger } from '../../../src/workbench/logger.js';
import { resetFixtureRuntime } from './runtime.js';

export const TRUSTED_ORIGIN = 'https://workbench.t52.test';
export const TEACHING_TIME_ACCOUNTS = Object.freeze(['teacher-a', 'teacher-b']);

export function assertProblem(response, status, type) {
  assert.equal(response.status, status);
  assert.match(String(response.headers['content-type']), /^application\/problem\+json/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.type, type);
  return response.body;
}

export async function createScheduleHarness(options = {}) {
  const externalDatabase = typeof options.databasePath === 'string';
  const sqlitePath = externalDatabase
    ? path.resolve(options.databasePath)
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 't52-schedule-')), 'workbench.sqlite');
  const rootDir = path.dirname(sqlitePath);
  const trustedOrigin = options.trustedOrigin ?? TRUSTED_ORIGIN;

  resetFixtureRuntime({ now: options.now ?? undefined });

  const env = createEnv({
    appName: 'T52 schedule harness',
    nodeEnv: 'test',
    sqlitePath,
    workbench: {
      mode: 'test-principal',
      testPrincipals: TEACHING_TIME_ACCOUNTS,
      sessionSecret: 't52-schedule-harness-session-secret',
      trustedOrigins: [trustedOrigin],
      logDir: path.join(rootDir, 'logs')
    }
  });

  let runtime = null;

  async function openRuntime() {
    const workbench = createTeachingTimeWorkbench({
      env,
      knownModuleIds: options.knownModuleIds ?? null,
      logger: options.debug
        ? createWorkbenchLogger({ logDir: path.join(rootDir, 'logs'), consoleOutput: true })
        : undefined
    });
    runtime = createApp({ env, workbench });
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

  const accountCache = new Map();

  function accountFor(accountKey) {
    if (!accountCache.has(accountKey)) accountCache.set(accountKey, createAccount(accountKey));
    return accountCache.get(accountKey);
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

  return {
    rootDir,
    sqlitePath,
    trustedOrigin,
    env,

    app() {
      return runtime.app;
    },

    workbench() {
      return runtime.workbench;
    },

    raw() {
      return request(runtime.app);
    },

    query(sql, ...params) {
      return runtime.workbench.db.prepare(sql).all(...params);
    },

    count(sql, ...params) {
      return runtime.workbench.db.prepare(sql).get(...params)?.count ?? 0;
    },

    account: accountFor,
    agent,

    /** Writer helper: a fresh UUID idempotency key per logical request. */
    key() {
      return nextUuid();
    },

    async restart() {
      await runtime.dataStore.close();
      await openRuntime();
    },

    async close() {
      await runtime.dataStore.close();
      if (!externalDatabase) fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };
}
