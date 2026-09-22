/**
 * B15 real-service fixture for the first-flow E2E.
 *
 * Starts this worktree's isolated HTTPS runner in the Playwright worker process
 * (real Web build + real API + real SQLite, one origin) so a spec can stop and
 * restart the API, keep the database, and inject a storage fault at the real
 * transaction boundary. Nothing in this file exists in product code; the runner
 * itself only runs with test-principal identities and refuses production.
 *
 * Ports and paths are B15's isolated group (47115/48115/49115); a run never
 * touches a developer database.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFirstFlowRunner } from '../../../../scripts/first-flow/lib/runner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const B15_REPO_ROOT = path.resolve(here, '../../../..');

export const B15_ACCOUNTS = Object.freeze({
  a: 'fixture-teacher-a',
  b: 'fixture-teacher-b'
});

/** Real tables the physical evidence may count; no other name is accepted. */
const COUNTABLE_TABLES = new Set([
  'question_items',
  'lesson_items',
  'lesson_sections',
  'lesson_references',
  'workbench_mutation_keys'
]);

export const B15_PORT = Number(process.env.B15_PORT ?? 47115);
export const B15_ORIGIN = `https://localhost:${B15_PORT}`;
export const B15_DATA_DIR = process.env.B15_DATA_DIR
  ? path.resolve(process.env.B15_DATA_DIR)
  : path.join(B15_REPO_ROOT, 'test-results', 'first-flow', 'b15');

/**
 * The build this suite serves. It is a frozen copy made before the tests start,
 * not `apps/web/dist`: another spec in the same Playwright run may rebuild that
 * directory concurrently, and the runner serves whatever is on disk per
 * request.
 */
export const B15_WEB_DIST = path.join(B15_DATA_DIR, 'web-dist');

/**
 * One runner slot. `start`/`stop` keep the same data directory so a restart
 * reads the same SQLite file, logs and runner-bound identities; `reset` is only
 * used between independent scenarios.
 */
export function createFirstFlowService() {
  let runner = null;

  async function start({ reset = false } = {}) {
    if (runner) throw new Error('The first-flow runner is already started.');
    runner = await startFirstFlowRunner({
      dataDir: B15_DATA_DIR,
      port: B15_PORT,
      fixtures: [],
      web: B15_WEB_DIST,
      reset,
      quiet: true
    });
    return runner;
  }

  return {
    get runner() {
      if (!runner) throw new Error('The first-flow runner is not started.');
      return runner;
    },
    get origin() {
      return B15_ORIGIN;
    },
    start,
    async stop() {
      if (!runner) return;
      const closing = runner;
      runner = null;
      await closing.close();
    },
    async restart({ reset = false } = {}) {
      await this.stop();
      return start({ reset });
    },

    /**
     * Real write failure: the shared SQLite connection refuses to write, so the
     * module transaction and the idempotency record both fail inside the real
     * storage engine. The workbench transport maps it to the contract 503 and
     * no partial row survives.
     */
    refuseWrites() {
      runner?.workbench.db.pragma('query_only = ON');
    },
    allowWrites() {
      runner?.workbench.db.pragma('query_only = OFF');
    },

    /** Direct database read for evidence that cannot be faked by the UI. */
    countRows(table) {
      if (!COUNTABLE_TABLES.has(table)) throw new Error(`Unknown table: ${table}`);
      return runner.workbench.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
    },

    /**
     * Controlled seed: store a document written by a later app version, which
     * the current API cannot produce on purpose. Used only to check that the UI
     * keeps such content readable and read-only.
     */
    seedFutureQuestionBody(questionId, body) {
      runner.workbench.db
        .prepare('UPDATE question_items SET body = @body WHERE id = @id')
        .run({ id: questionId, body: JSON.stringify(body) });
    }
  };
}
