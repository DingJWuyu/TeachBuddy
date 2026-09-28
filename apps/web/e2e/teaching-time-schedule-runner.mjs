/**
 * Isolated runner for the T52 schedule browser suite.
 *
 * One process serves the built schedule harness page and the real workbench API
 * from a single HTTPS origin with runner-bound test identities. The composition
 * is the T52 fixture (real schedule module plus classes/lessons substitutes);
 * the web build comes from `teaching-time-schedule.vite.config.mjs`, so the
 * browser sees the production pipeline of the current candidate.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createEnv } from '../../api/src/config/env.js';
import { createApp } from '../../api/src/app.js';
import { createHttpServer } from '../../api/src/server.js';
import { createTeachingTimeWorkbench } from '../../api/test/fixtures/teaching-time-schedule/workbench.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..', '..');
export const webDist = path.join(repoRoot, 'test-results', 't52-schedule-web');
export const SCHEDULE_ACCOUNTS = Object.freeze(['teacher-a', 'teacher-b']);
export const SCHEDULE_PAGE = '/e2e/teaching-time-schedule.html';

/** Build the harness page through the production pipeline. */
export function buildScheduleWeb() {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'), 'build',
      '--config', path.join(here, 'teaching-time-schedule.vite.config.mjs')],
    { cwd: repoRoot, stdio: 'pipe' }
  );
  const page = path.join(webDist, 'e2e', 'teaching-time-schedule.html');
  if (!fs.existsSync(page)) throw new Error(`Schedule harness build missing at ${page}`);
  return page;
}

/** Self-signed certificate for localhost, created once per data directory. */
export function ensureCertificates(dataDir) {
  const certDir = path.join(dataDir, 'certs');
  const cert = path.join(certDir, 'localhost-cert.pem');
  const key = path.join(certDir, 'localhost-key.pem');
  if (fs.existsSync(cert) && fs.existsSync(key)) return { cert, key };
  fs.mkdirSync(certDir, { recursive: true });
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'
  ], { stdio: 'pipe' });
  return { cert, key };
}

export async function startScheduleRunner({ dataDir, port = 47113, reset = true } = {}) {
  const rootDir = dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 't52-schedule-e2e-'));
  if (reset) fs.rmSync(path.join(rootDir, 'workspace.sqlite'), { force: true });
  fs.mkdirSync(rootDir, { recursive: true });

  const origin = `https://localhost:${port}`;
  const { cert, key } = ensureCertificates(rootDir);

  const env = createEnv({
    appName: 'T52 schedule e2e runner',
    nodeEnv: 'test',
    port,
    sqlitePath: path.join(rootDir, 'workspace.sqlite'),
    workbench: {
      mode: 'test-principal',
      testPrincipals: SCHEDULE_ACCOUNTS,
      sessionSecret: 't52-schedule-e2e-session-secret',
      publicOrigin: origin,
      trustedOrigins: [origin],
      tls: { cert, key },
      webDist,
      logDir: path.join(rootDir, 'logs')
    }
  });

  const app = createApp({ env, workbench: createTeachingTimeWorkbench({ env }) });
  await app.workbench.initialize();

  const server = createHttpServer({ env, app: app.app });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });

  return {
    origin,
    port,
    rootDir,
    database: env.sqlitePath,
    app,
    workbench: app.workbench,
    dataStore: app.dataStore,
    server,
    accounts: app.workbench.identity.listTestPrincipals(),
    /** Per-test isolation: clear business rows, keep the migrated schema. */
    resetData() {
      app.workbench.db.exec(`
        DELETE FROM schedule_instance_arms;
        DELETE FROM schedule_exceptions;
        DELETE FROM schedule_entries;
        DELETE FROM schedule_settings;
        DELETE FROM workbench_mutation_keys;
        DELETE FROM teaching_time_fixture_records;
        DELETE FROM teaching_time_fixture_classes;
        DELETE FROM teaching_time_fixture_lessons;
      `);
    },
    cookieFor(accountKey) {
      return app.workbench.identity.testPrincipalCookie(accountKey);
    },
    async close() {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      app.dataStore.close();
    }
  };
}
