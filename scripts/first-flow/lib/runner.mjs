/**
 * Isolated first-flow runner.
 *
 * One command starts the real Web/API of this worktree on a single HTTPS
 * origin, with its own SQLite file, file directories, logs and two bound test
 * identities. Every run is isolated: nothing here may touch a developer's user
 * database, and the test-principal identity mode is refused in production.
 *
 * Commands for the isolated first-flow runner:
 *   node scripts/first-flow/start.mjs --reset                 # fresh isolated start
 *   node scripts/first-flow/start.mjs                         # restart, keeps the database
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { moduleCatalog, workbenchHeaders } from '@refatos/shared';
import { createEnv } from '../../../apps/api/src/config/env.js';
import { createWorkbenchLogger } from '../../../apps/api/src/workbench/logger.js';
import { startServer } from '../../../apps/api/src/server.js';
import { resolveFixtureSets } from '../../../apps/api/test/fixtures/first-flow/catalog.js';
import { TEST_ACCOUNT_KEYS } from '../../../apps/api/test/fixtures/first-flow/accounts.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, '..', '..', '..');

export const FIRST_FLOW_ACCOUNTS = TEST_ACCOUNT_KEYS;
export const DEFAULT_PORT = 47112;
export const WORKBENCH_FIXTURE_PORT = 48112;
export const SPARE_PORT = 49112;

export function parseArgs(argv) {
  const options = {
    dataDir: path.join(repoRoot, 'test-results', 'first-flow', 'data'),
    port: DEFAULT_PORT,
    mode: 'test-principal',
    fixtures: ['workbench-probe'],
    web: 'auto',
    reset: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };
    switch (arg) {
      case '--data-dir': options.dataDir = path.resolve(next()); break;
      case '--port': options.port = Number(next()); break;
      case '--mode': options.mode = next(); break;
      case '--fixtures': {
        const value = next();
        options.fixtures = value === 'none'
          ? []
          : value.split(',').map((item) => item.trim()).filter(Boolean);
        break;
      }
      case '--web': options.web = next(); break;
      case '--reset': options.reset = true; break;
      case '--help':
      case '-h': options.help = true; break;
      default: throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export function usage() {
  return [
    'Usage: node scripts/first-flow/start.mjs [options]',
    '',
    '  --data-dir <path>  isolated data directory (default test-results/first-flow/data)',
    `  --port <n>         HTTPS port (default ${DEFAULT_PORT}; task ports ${DEFAULT_PORT}/${WORKBENCH_FIXTURE_PORT}/${SPARE_PORT})`,
    '  --mode <mode>      test-principal | none (default test-principal)',
    '  --fixtures <list>  test fixture sets, comma separated, or "none" (default workbench-probe)',
    '  --web <dist|none>  web build served from the same origin (default apps/web/dist when built)',
    '  --reset            clear the isolated database, logs and identities before starting',
    '',
    'Restart with the same database: run the same command without --reset.'
  ].join('\n');
}

export function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf-8' }).trim();
  } catch {
    return 'unavailable';
  }
}

export function resetIsolatedData(dataDir) {
  for (const target of ['data', 'logs', 'principals.json', 'runner.json']) {
    fs.rmSync(path.join(dataDir, target), { recursive: true, force: true });
  }
}

/**
 * Creates a self-signed certificate for localhost in the isolated data
 * directory. The test browser trusts it through the runner's explicit
 * configuration; the private key never leaves the isolated directory.
 */
export function ensureCertificates(dataDir) {
  const certDir = path.join(dataDir, 'certs');
  const cert = path.join(certDir, 'localhost-cert.pem');
  const key = path.join(certDir, 'localhost-key.pem');
  if (fs.existsSync(cert) && fs.existsSync(key)) return { cert, key };

  fs.mkdirSync(certDir, { recursive: true });
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', key,
      '-out', cert,
      '-days', '30',
      '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'
    ], { stdio: 'pipe' });
  } catch (error) {
    throw new Error(
      `Could not create the isolated HTTPS certificate with openssl: ${error.message}. `
      + 'Install openssl or provide certificates explicitly.'
    );
  }
  return { cert, key };
}

function writeJson(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf-8', mode });
}

export function pathFor(dataDir, ...rest) {
  return path.join(dataDir, ...rest);
}

/**
 * Start one isolated runner instance. Returns the server context plus the
 * origin, data directory and a close() that shuts the HTTP server and database
 * down cleanly (so a restart reads the same persistent state).
 */
export async function startFirstFlowRunner(options = {}) {
  const {
    dataDir = path.join(repoRoot, 'test-results', 'first-flow', 'data'),
    port = DEFAULT_PORT,
    mode = 'test-principal',
    fixtures = ['workbench-probe'],
    web = 'auto',
    reset = false,
    sessionSecret = 'teacher-workspace-first-flow-runner',
    quiet = false
  } = options;

  if (reset) resetIsolatedData(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });

  const origin = `https://localhost:${port}`;
  const tls = ensureCertificates(dataDir);
  const { implementations, entries } = resolveFixtureSets(fixtures);

  const webDist = web === 'none'
    ? null
    : (web === 'auto' ? path.join(repoRoot, 'apps', 'web', 'dist') : path.resolve(web));
  if (webDist && !fs.existsSync(path.join(webDist, 'index.html'))) {
    throw new Error(`Web build not found at ${webDist}. Run "npm run build:web" with VITE_API_BASE_URL=/api first.`);
  }

  const runtimeEnv = createEnv({
    appName: 'TeachBuddy first-flow runner',
    nodeEnv: 'test',
    port,
    authSecret: 'teacher-workspace-first-flow-runner-secret',
    corsOrigins: [origin],
    sqlitePath: pathFor(dataDir, 'data', 'workspace.sqlite'),
    workbench: {
      mode,
      testPrincipals: FIRST_FLOW_ACCOUNTS,
      sessionSecret,
      publicOrigin: origin,
      trustedOrigins: [origin],
      tls,
      webDist,
      logDir: pathFor(dataDir, 'logs'),
      extraImplementations: fixtures.length ? implementations : null,
      catalogOverride: fixtures.length ? [...moduleCatalog, ...entries] : null
    }
  });

  // A quiet run still writes the isolated JSONL logs; it only silences console
  // output, so the failure evidence keeps its request/error index.
  const logger = createWorkbenchLogger({
    logDir: pathFor(dataDir, 'logs'),
    consoleOutput: !quiet
  });

  // Worker port groups sit inside the OS ephemeral range, so a parallel
  // session's outbound connection can transiently occupy our port. The product
  // server still fails fast on EADDRINUSE; the isolated runner retries briefly
  // instead of reporting a false startup failure.
  let context;
  for (let attempt = 1; ; attempt += 1) {
    try {
      context = await startServer({ env: runtimeEnv, workbenchLogger: logger });
      break;
    } catch (error) {
      if (error?.code !== 'EADDRINUSE' || attempt >= 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }

  const sha = gitSha();
  const startedAt = new Date().toISOString();

  writeJson(pathFor(dataDir, 'principals.json'), {
    origin,
    cookieName: workbenchHeaders.sessionCookie,
    note: 'Runner-side test identities. Browsers cannot choose a principal; nothing here is a production credential.',
    accounts: Object.fromEntries(
      context.workbench.identity.listTestPrincipals().map((accountKey) => [
        accountKey,
        context.workbench.identity.testPrincipalCookie(accountKey).value
      ])
    )
  }, 0o600);

  writeJson(pathFor(dataDir, 'runner.json'), {
    origin,
    port,
    sha,
    startedAt,
    mode,
    fixtures,
    webDist,
    dataDir,
    database: runtimeEnv.sqlitePath,
    logs: pathFor(dataDir, 'logs'),
    pid: process.pid
  }, 0o644);

  return {
    ...context,
    origin,
    port,
    dataDir,
    sha,
    startedAt,
    webDist,
    close() {
      return new Promise((resolve) => {
        // A browser keeps its keep-alive sockets open, so `close()` alone would
        // wait for the client to go away first. A real stop must not depend on
        // that: drop the remaining connections, then close the store.
        const closed = context.server.close(() => {
          context.dataStore.close();
          resolve();
        });
        context.server.closeAllConnections();
        return closed;
      });
    }
  };
}

export function runnerSummary(runner, dataDir) {
  return [
    `first-flow runner listening on ${runner.origin}`,
    `  tested SHA:     ${runner.sha}`,
    `  isolated data:  ${dataDir}`,
    `  database:       ${pathFor(dataDir, 'data', 'workspace.sqlite')}`,
    `  logs:           ${pathFor(dataDir, 'logs')}`,
    `  test accounts:  ${FIRST_FLOW_ACCOUNTS.join(', ')}`,
    `  cookie bootstrap (runner-only, no secrets logged): ${pathFor(dataDir, 'principals.json')}`,
    '',
    'Restart keeping data:  node scripts/first-flow/start.mjs --data-dir ' + dataDir,
    'Reset and start fresh: node scripts/first-flow/start.mjs --data-dir ' + dataDir + ' --reset'
  ].join('\n');
}
