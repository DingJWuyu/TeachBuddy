/**
 * T51 real-service fixture for the classes E2E.
 *
 * Starts this worktree's isolated HTTPS runner in the Playwright worker process
 * (real API, real SQLite, one origin) serving the T51 fixture Web build, so a
 * spec can stop and restart the API on the same database and inject a real
 * storage fault. Ports and paths are T51's isolated group (47151/48151/49151);
 * nothing here touches a developer database or the product `apps/web/dist`.
 *
 * The classes implementation and catalog entry are the T51 fixture (the product
 * catalog is T53-owned); the missing `lessons.readForTeachingLink` provider is
 * projected from the real lessons service in the same process.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleCatalog, workbenchHeaders } from '@refatos/shared';
import { createWorkbench } from '../../../api/src/workbench/index.js';
import { createEnv } from '../../../api/src/config/env.js';
import { createWorkbenchLogger } from '../../../api/src/workbench/logger.js';
import { startServer } from '../../../api/src/server.js';
import { ensureCertificates, resetIsolatedData } from '../../../../scripts/first-flow/lib/runner.mjs';
import { TEST_ACCOUNT_KEYS } from '../../../api/test/fixtures/first-flow/accounts.js';
import { classesCatalogEntry, classesImplementation } from '../../../api/test/fixtures/teaching-time-classes/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const T51_REPO_ROOT = path.resolve(here, '../../../..');

export const T51_ACCOUNTS = Object.freeze({
  a: TEST_ACCOUNT_KEYS[0],
  b: TEST_ACCOUNT_KEYS[1]
});

const COUNTABLE_TABLES = new Set([
  'classes_items',
  'classes_records',
  'classes_record_sources',
  'question_items',
  'lesson_items',
  'workbench_mutation_keys'
]);

export const T51_PORT = Number(process.env.T51_PORT ?? 47351);
export const T51_ORIGIN = `https://localhost:${T51_PORT}`;
export const T51_DATA_DIR = process.env.T51_DATA_DIR
  ? path.resolve(process.env.T51_DATA_DIR)
  : path.join(T51_REPO_ROOT, 'test-results', 'teaching-time', 'classes-math');
export const T51_WEB_DIST = path.join(T51_DATA_DIR, 'web-dist');

function writeJson(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf-8', mode });
}

export function createTeachingTimeClassesService({ webDist = T51_WEB_DIST, clock } = {}) {
  let runner = null;

  async function start({ reset = false } = {}) {
    if (runner) throw new Error('The T51 classes runner is already started.');
    if (reset) resetIsolatedData(T51_DATA_DIR);
    fs.mkdirSync(T51_DATA_DIR, { recursive: true });
    if (!fs.existsSync(path.join(webDist, 'index.html'))) {
      throw new Error(`No T51 fixture Web build at ${T51_WEB_DIST}; run without T51_SKIP_BUILD=1 first.`);
    }

    const tls = ensureCertificates(T51_DATA_DIR);
    const env = createEnv({
      appName: 'T51 classes E2E',
      nodeEnv: 'test',
      port: T51_PORT,
      authSecret: 't51-classes-e2e-auth-secret',
      corsOrigins: [T51_ORIGIN],
      sqlitePath: path.join(T51_DATA_DIR, 'data', 'workspace.sqlite'),
      workbench: {
        mode: 'test-principal',
        testPrincipals: TEST_ACCOUNT_KEYS,
        sessionSecret: 't51-classes-e2e-session-secret',
        publicOrigin: T51_ORIGIN,
        trustedOrigins: [T51_ORIGIN],
        tls,
        webDist,
        logDir: path.join(T51_DATA_DIR, 'logs'),
        extraImplementations: { classes: classesImplementation },
        catalogOverride: moduleCatalog.map(entry => entry.id === 'classes' ? classesCatalogEntry : entry)
      }
    });
    const logger = createWorkbenchLogger({ logDir: path.join(T51_DATA_DIR, 'logs'), consoleOutput: false });

    let context;
    for (let attempt = 1; ; attempt += 1) {
      try {
        context = await startServer({ env, workbenchLogger: logger, workbench: createWorkbench({ env, logger, clock }) });
        break;
      } catch (error) {
        if (error?.code !== 'EADDRINUSE' || attempt >= 10) throw error;
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }

    writeJson(path.join(T51_DATA_DIR, 'principals.json'), {
      origin: T51_ORIGIN,
      cookieName: workbenchHeaders.sessionCookie,
      note: 'T51 runner-side test identities. Browsers cannot choose a principal.',
      accounts: Object.fromEntries(
        context.workbench.identity.listTestPrincipals().map((accountKey) => [
          accountKey,
          context.workbench.identity.testPrincipalCookie(accountKey).value
        ])
      )
    });
    writeJson(path.join(T51_DATA_DIR, 'runner.json'), {
      origin: T51_ORIGIN,
      port: T51_PORT,
      mode: 'test-principal',
      dataDir: T51_DATA_DIR,
      database: path.join(T51_DATA_DIR, 'data', 'workspace.sqlite'),
      logs: path.join(T51_DATA_DIR, 'logs'),
      webDist,
      pid: process.pid
    }, 0o644);

    runner = {
      ...context,
      origin: T51_ORIGIN,
      dataDir: T51_DATA_DIR,
      close() {
        return new Promise((resolve) => {
          const closed = context.server.close(() => {
            context.dataStore.close();
            resolve();
          });
          context.server.closeAllConnections();
          return closed;
        });
      }
    };
    return runner;
  }

  return {
    get runner() {
      if (!runner) throw new Error('The T51 classes runner is not started.');
      return runner;
    },
    start,
    async stop() {
      if (!runner) return;
      const closing = runner;
      runner = null;
      await closing.close();
    },
    async restart() {
      await this.stop();
      return start({ reset: false });
    },

    /** Real write failure: the shared SQLite connection refuses every write. */
    refuseWrites() {
      runner?.workbench.db.pragma('query_only = ON');
    },
    allowWrites() {
      runner?.workbench.db.pragma('query_only = OFF');
    },

    countRows(table) {
      if (!COUNTABLE_TABLES.has(table)) throw new Error(`Unknown table: ${table}`);
      return runner.workbench.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    }
  };
}
