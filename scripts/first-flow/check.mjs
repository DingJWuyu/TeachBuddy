/**
 * B12 self-verification run.
 *
 * Runs the isolated first-flow runner on its candidate code and records the
 * public responsibilities that B12 owns: empty-database start, old-database
 * upgrade, failing startup with a non-zero exit, same-origin HTTPS, two
 * independent test accounts, isolated build, restart with the database kept,
 * and the production refusal of the test identity mode.
 *
 *   node scripts/first-flow/check.mjs
 *
 * Evidence lands in `test-results/evidence/B12/v1/`; a later node that
 * re-runs these public checks on an integrated candidate sets
 * FIRST_FLOW_EVIDENCE_DIR instead, so B12's own evidence stays untouched. Raw
 * isolated state stays under test-results/first-flow/check/. Exit code 0 only
 * when every check passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { createEnv } from '../../apps/api/src/config/env.js';
import { workbenchHeaders, workbenchPaths } from '@teachbuddy/shared';
import {
  DEFAULT_PORT,
  FIRST_FLOW_ACCOUNTS,
  SPARE_PORT,
  WORKBENCH_FIXTURE_PORT,
  gitSha,
  repoRoot,
  startFirstFlowRunner
} from './lib/runner.mjs';
import { bootstrapPrincipal, readTestPrincipals } from '../../apps/web/e2e/fixtures/first-flow/identity.js';

const evidenceDir = process.env.FIRST_FLOW_EVIDENCE_DIR
  ? path.resolve(process.env.FIRST_FLOW_EVIDENCE_DIR)
  : path.join(repoRoot, 'test-results', 'evidence', 'B12', 'v1');
const runRoot = path.join(repoRoot, 'test-results', 'first-flow', 'check');
const accounts = { a: FIRST_FLOW_ACCOUNTS[0], b: FIRST_FLOW_ACCOUNTS[1] };
const PROBE_ITEMS_PATH = `${workbenchPaths.modules}/workbench-probe/items`;
const KEY_PERSIST = '5f1e0000-0000-4000-8000-000000000001';
const KEY_BROWSER_A = '5f1e0000-0000-4000-8000-000000000002';
const results = [];
const startedRunners = [];
const spawnedProcesses = [];

function record(id, status, detail, evidence = []) {
  results.push({ id, status, detail, evidence });
  console.log(`[${status}] ${id}: ${detail}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runner-bound session cookie for one account (value comes from the runner). */
function runnerCookie(runner, accountKey) {
  const token = readTestPrincipals({ dataDir: runner.dataDir }).accounts[accountKey];
  return `${workbenchHeaders.sessionCookie}=${token}`;
}

function writeLog(name, content) {
  const file = path.join(runRoot, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content ?? '', 'utf-8');
  return file;
}

function tail(text, lines = 12) {
  return String(text ?? '').split('\n').slice(-lines).join('\n');
}

/** Minimal HTTPS client that trusts the runner's isolated certificate. */
function request(runner, requestPath, options = {}) {
  const url = new URL(runner.origin);
  const body = options.body === undefined
    ? null
    : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
  const headers = {
    Origin: runner.origin,
    ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
    ...(options.headers ?? {})
  };

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      port: url.port,
      path: requestPath,
      method: options.method ?? 'GET',
      headers,
      ca: fs.readFileSync(path.join(runner.dataDir, 'certs', 'localhost-cert.pem'))
    }, (res) => {
      let raw = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = raw;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForHealth(runner, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await request(runner, '/api/health');
      if (response.status === 200) return response.body;
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw new Error(`Runner did not become healthy on ${runner.origin}: ${lastError?.message ?? 'timeout'}`);
}

async function withRunner(options, fn) {
  const runner = await startFirstFlowRunner({ ...options, quiet: true });
  startedRunners.push(runner);
  try {
    await waitForHealth(runner);
    return await fn(runner);
  } finally {
    await runner.close();
    const index = startedRunners.indexOf(runner);
    if (index >= 0) startedRunners.splice(index, 1);
  }
}

function spawnProcess(id, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  spawnedProcesses.push(child);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exit = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  return {
    id,
    child,
    exit,
    logs: () => ({ stdout, stderr }),
    async stop() {
      if (child.exitCode === null) child.kill('SIGTERM');
      await exit;
    }
  };
}

const browserEvidence = [];

/** Test-side evidence banner: shows the real API answer bound to this context. */
async function annotateIdentity(page, contextResponse) {
  await page.evaluate(({ result, contextPath }) => {
    const banner = document.createElement('pre');
    banner.id = 'b12-evidence-banner';
    banner.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
      'margin:0', 'padding:10px 14px', 'background:#111', 'color:#8ef58e',
      'font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace'
    ].join(';');
    banner.textContent = `B12 public-facility check | ${location.origin} `
      + `| GET ${contextPath} -> ${result.status} ${JSON.stringify(result.body)}`;
    document.body.appendChild(banner);
  }, { result: contextResponse, contextPath: workbenchPaths.context });
}

async function runBrowserChecks(runner) {
  const browser = await chromium.launch();
  const principals = readTestPrincipals({ dataDir: runner.dataDir });
  const origin = runner.origin;
  const checks = {};

  async function newPrincipalPage(accountKey) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: origin });
    await context.tracing.start({ screenshots: true, snapshots: true });
    await bootstrapPrincipal(context, accountKey, { origin, dataDir: runner.dataDir });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Since B14/B15 the built shell is the workbench shell: a bound identity
    // boots into it instead of the retired Bearer login form.
    await page.locator('.wb-nav-row').first().waitFor({ timeout: 15_000 });
    return { context, page };
  }

  try {
    const pageA = await newPrincipalPage(accounts.a);
    const pageB = await newPrincipalPage(accounts.b);

    checks.sameOrigin = await pageA.page.evaluate(() => ({
      protocol: location.protocol,
      origin: location.origin,
      hasWorkbenchShell: Boolean(document.querySelector('.wb-nav-row'))
    }));
    checks.builtWebServed = checks.sameOrigin.hasWorkbenchShell;

    const contextPath = workbenchPaths.context;
    const contextA = await pageA.page.evaluate(async (path) => {
      const response = await fetch(path, { credentials: 'same-origin' });
      return { status: response.status, body: await response.json() };
    }, contextPath);
    const contextB = await pageB.page.evaluate(async (path) => {
      const response = await fetch(path, { credentials: 'same-origin' });
      return { status: response.status, body: await response.json() };
    }, contextPath);
    checks.contextA = contextA;
    checks.contextB = contextB;
    checks.cookieAttributes = (await pageA.context.cookies(origin)).map((cookie) => ({
      name: cookie.name,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite
    }));
    checks.independentAccounts = contextA.body.accountKey === accounts.a && contextB.body.accountKey === accounts.b;

    // The page cannot choose a principal: query parameter, identity header and
    // body field are all ignored in favour of the server-side session.
    checks.forgedSelection = await pageB.page.evaluate(async ({ forgedAccount, contextPath }) => {
      const response = await fetch(`${contextPath}?accountKey=${forgedAccount}`, {
        credentials: 'same-origin',
        headers: { 'X-Workbench-Account': forgedAccount }
      });
      return { status: response.status, body: await response.json() };
    }, { forgedAccount: accounts.a, contextPath });

    const browserCreate = await pageA.page.evaluate(async ({ key, itemsPath, protection }) => {
      const response = await fetch(itemsPath, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          [protection.name]: protection.value,
          'Idempotency-Key': key
        },
        body: JSON.stringify({ value: 'created from browser A' })
      });
      return { status: response.status, body: await response.json() };
    }, {
      key: KEY_BROWSER_A,
      itemsPath: PROBE_ITEMS_PATH,
      protection: { name: workbenchHeaders.browserProtection, value: workbenchHeaders.browserProtectionValue }
    });
    checks.browserCreate = browserCreate;

    checks.crossAccount = await pageB.page.evaluate(async ({ id, itemsPath }) => {
      const read = await fetch(`${itemsPath}/${id}`, { credentials: 'same-origin' });
      const list = await fetch(itemsPath, { credentials: 'same-origin' });
      return {
        readStatus: read.status,
        readBody: await read.json(),
        listStatus: list.status,
        listBody: await list.json()
      };
    }, { id: browserCreate.body.id, itemsPath: PROBE_ITEMS_PATH });

    // The built shell has no workbench-specific surface yet (B14 owns it), so
    // each screenshot carries a test-side banner with the real same-origin API
    // answer for that browser context. The banner is an evidence annotation,
    // not product UI.
    const screenshotA = path.join(evidenceDir, 'browser-context-a.png');
    const screenshotB = path.join(evidenceDir, 'browser-context-b.png');
    await annotateIdentity(pageA.page, contextA);
    await annotateIdentity(pageB.page, contextB);
    await pageA.page.screenshot({ path: screenshotA, fullPage: false });
    await pageB.page.screenshot({ path: screenshotB, fullPage: false });
    browserEvidence.push(screenshotA, screenshotB);

    if (!browserChecksVerdict(checks, accounts).ok) {
      await pageA.context.tracing.stop({ path: path.join(evidenceDir, 'browser-context-a-trace.zip') });
      await pageB.context.tracing.stop({ path: path.join(evidenceDir, 'browser-context-b-trace.zip') });
      browserEvidence.push('browser-context-a-trace.zip', 'browser-context-b-trace.zip');
    } else {
      await pageA.context.tracing.stop();
      await pageB.context.tracing.stop();
    }

    await pageA.context.close();
    await pageB.context.close();
  } finally {
    await browser.close();
  }

  const verdict = browserChecksVerdict(checks, accounts);
  return { ok: verdict.ok, reasons: verdict.reasons, checks, principalsBound: Object.keys(principals.accounts).length };
}

/** Single source for the browser verdict: the trace decision uses it too. */
function browserChecksVerdict(checks, accountKeys) {
  const reasons = [];
  if (checks.sameOrigin.protocol !== 'https:') reasons.push(`protocol=${checks.sameOrigin.protocol}`);
  if (!checks.builtWebServed) reasons.push('web build not served');
  if (!checks.independentAccounts) {
    reasons.push(`accounts=${checks.contextA.body.accountKey}/${checks.contextB.body.accountKey}`);
  }
  if (checks.forgedSelection.body.accountKey !== accountKeys.b) {
    reasons.push(`forged selection resolved ${checks.forgedSelection.body.accountKey}`);
  }
  if (checks.browserCreate.status !== 201) reasons.push(`browser create=${checks.browserCreate.status}`);
  if (checks.crossAccount.readStatus !== 404) reasons.push(`cross-account read=${checks.crossAccount.readStatus}`);
  if (checks.crossAccount.listBody.items.length !== 0) {
    reasons.push(`cross-account list=${checks.crossAccount.listBody.items.length}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Poll a plain-HTTP production process until it answers (no fixed sleep). */
async function waitForProductionAnswer(port, requestPath, headers, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await new Promise((resolve, reject) => {
        const req = http.request({ hostname: 'localhost', port, path: requestPath, headers }, (res) => {
          let raw = '';
          res.setEncoding('utf-8');
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => resolve({ status: res.statusCode, body: raw }));
        });
        req.on('error', reject);
        req.end();
      });
    } catch (error) {
      lastError = error;
      await sleep(200);
    }
  }
  throw new Error(`Production process did not answer on port ${port}: ${lastError?.message ?? 'timeout'}`);
}

/** Fresh browser context after the restart: same ID, read from the restarted API. */
async function readAfterRestartInNewContext(runner, accountKey, itemId) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: runner.origin });
  try {
    await bootstrapPrincipal(context, accountKey, { origin: runner.origin, dataDir: runner.dataDir });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('.wb-nav-row').first().waitFor({ timeout: 15_000 });
    const result = await page.evaluate(async ({ id, contextPath, itemsPath }) => {
      const response = await fetch(`${itemsPath}/${id}`, { credentials: 'same-origin' });
      const contextResponse = await fetch(contextPath, { credentials: 'same-origin' });
      return { status: response.status, body: await response.json(), account: (await contextResponse.json()).accountKey };
    }, { id: itemId, contextPath: workbenchPaths.context, itemsPath: PROBE_ITEMS_PATH });
    await annotateIdentity(page, { status: result.status, body: result.body, account: result.account });
    await page.screenshot({ path: path.join(evidenceDir, 'browser-after-restart.png'), fullPage: false });
    return result;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.rmSync(runRoot, { recursive: true, force: true });
  fs.mkdirSync(runRoot, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const sha = gitSha();
  const summary = {
    task: 'B12@1 public-facility check',
    sha,
    startedAt: new Date().toISOString(),
    ports: { primary: DEFAULT_PORT, fixture: WORKBENCH_FIXTURE_PORT, spare: SPARE_PORT },
    results,
    evidence: {},
    artifacts: {}
  };

  // 1. Isolated build: npm run build must not touch the user database.
  const userDb = createEnv().sqlitePath;
  const userDbBefore = fs.existsSync(userDb) ? fs.statSync(userDb).mtimeMs : null;
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: repoRoot,
    encoding: 'utf-8',
  });
  const userDbAfter = fs.existsSync(userDb) ? fs.statSync(userDb).mtimeMs : null;
  writeLog('logs/build.log', `$ npm run build\n${build.stdout}\n${build.stderr}\nexit=${build.status}\n`);
  const buildIsolated = userDbBefore === userDbAfter;
  record(
    'build',
    build.status === 0 && buildIsolated ? 'PASS' : 'FAIL',
    `npm run build exit=${build.status}; user database untouched=${buildIsolated}`,
    ['build.log']
  );

  // 2. Fresh isolated start + browser evidence on one HTTPS origin.
  const primaryData = path.join(runRoot, 'primary');
  const browserResult = await withRunner(
    { dataDir: primaryData, port: DEFAULT_PORT, fixtures: ['workbench-probe'], reset: true },
    async (runner) => {
      const freshCreate = await request(runner, PROBE_ITEMS_PATH, {
        method: 'POST',
        headers: {
          [workbenchHeaders.browserProtection]: workbenchHeaders.browserProtectionValue,
          'Idempotency-Key': KEY_PERSIST,
          Cookie: runnerCookie(runner, accounts.a)
        },
        body: { value: 'created before restart' }
      });
      const browser = await runBrowserChecks(runner);
      return { freshCreate, browser, runner };
    }
  );
  record(
    'same-origin-https-and-accounts',
    browserResult.browser.ok ? 'PASS' : 'FAIL',
    `HTTPS=${browserResult.browser.checks.sameOrigin.protocol} web=${browserResult.browser.checks.builtWebServed} `
    + `accounts=${browserResult.browser.checks.contextA.body.accountKey}/${browserResult.browser.checks.contextB.body.accountKey} `
    + `crossAccount404=${browserResult.browser.checks.crossAccount.readStatus}`
    + (browserResult.browser.reasons.length ? ` reasons=${browserResult.browser.reasons.join('; ')}` : ''),
    ['browser-context-a.png', 'browser-context-b.png']
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'browser-checks.json'),
    `${JSON.stringify(browserResult.browser.checks, null, 2)}\n`,
    'utf-8'
  );
  summary.artifacts.browserChecks = 'browser-checks.json';

  // 3. Restart on the same database: identity, object and idempotency replay.
  const restartResult = await withRunner(
    { dataDir: primaryData, port: DEFAULT_PORT, fixtures: ['workbench-probe'], reset: false },
    async (runner) => {
      const cookie = runnerCookie(runner, accounts.a);
      const replay = await request(runner, PROBE_ITEMS_PATH, {
        method: 'POST',
        headers: {
          [workbenchHeaders.browserProtection]: workbenchHeaders.browserProtectionValue,
          'Idempotency-Key': KEY_PERSIST,
          Cookie: cookie
        },
        body: { value: 'created before restart' }
      });
      const list = await request(runner, PROBE_ITEMS_PATH, { headers: { Cookie: cookie } });
      const read = await request(runner, `${PROBE_ITEMS_PATH}/${replay.body.id}`, {
        headers: { Cookie: cookie }
      });
      const browserRead = await readAfterRestartInNewContext(runner, accounts.a, replay.body.id);
      return { replay, list, read, browserRead, runner };
    }
  );
  const restartOk = restartResult.browserRead.status === 200
    && restartResult.browserRead.body.id === restartResult.replay.body.id
    && restartResult.browserRead.account === accounts.a
    && restartResult.replay.status === 201
    && restartResult.replay.body.id === browserResult.freshCreate.body.id
    && restartResult.replay.body.version === browserResult.freshCreate.body.version
    && restartResult.list.body.items.length === 2
    && restartResult.list.body.items.filter((item) => item.id === restartResult.replay.body.id).length === 1
    && restartResult.read.status === 200;
  record(
    'restart-keeps-data-and-replays',
    restartOk ? 'PASS' : 'FAIL',
    `replay=${restartResult.replay.status} sameId=${restartResult.replay.body.id === browserResult.freshCreate.body.id} `
    + `items=${restartResult.list.body.items.length} (no duplicate from replay) `
    + `newBrowserContextRead=${restartResult.browserRead.status}/${restartResult.browserRead.account}`,
    ['primary-requests.jsonl', 'browser-after-restart.png']
  );
  summary.checks = {
    freshCreate: browserResult.freshCreate,
    restart: {
      replayStatus: restartResult.replay.status,
      replayId: restartResult.replay.body.id,
      originalId: browserResult.freshCreate.body.id,
      listCount: restartResult.list.body.items.length,
      newBrowserContextRead: restartResult.browserRead
    }
  };

  // 4. Old database (account + layout) upgrade keeps its data.
  const legacyData = path.join(runRoot, 'legacy');
  const legacyLayout = {
    hiddenModuleIds: [],
    groups: [{ id: 'focus', name: '专注', moduleIds: [] }],
    ungroupedModuleIds: []
  };
  await withRunner(
    { dataDir: legacyData, port: WORKBENCH_FIXTURE_PORT, fixtures: [], mode: 'none', reset: true },
    async (runner) => {
      const registration = await request(runner, '/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Old Teacher',
          email: 'old-teacher@example.test',
          password: 'old teacher password',
          passwordConfirmation: 'old teacher password'
        }
      });
      const layout = await request(runner, '/api/workspace/layout', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${registration.body.token}` },
        body: legacyLayout
      });
      if (registration.status !== 201 || layout.status !== 200) {
        throw new Error(`Could not prepare the old database: register=${registration.status} layout=${layout.status}`);
      }
    }
  );

  const upgradeResult = await withRunner(
    { dataDir: legacyData, port: WORKBENCH_FIXTURE_PORT, fixtures: ['workbench-probe'], reset: false },
    async (runner) => {
      const login = await request(runner, '/api/auth/login', {
        method: 'POST',
        body: { email: 'old-teacher@example.test', password: 'old teacher password' }
      });
      const layout = await request(runner, '/api/workspace/layout', {
        headers: { Authorization: `Bearer ${login.body.token}` }
      });
      const cookie = runnerCookie(runner, accounts.a);
      const probe = await request(runner, PROBE_ITEMS_PATH, { headers: { Cookie: cookie } });
      return { login, layout, probe, runner };
    }
  );
  const upgradeOk = upgradeResult.login.status === 200
    && JSON.stringify(upgradeResult.layout.body) === JSON.stringify(legacyLayout)
    && upgradeResult.probe.status === 200;
  record(
    'old-database-upgrade',
    upgradeOk ? 'PASS' : 'FAIL',
    `login=${upgradeResult.login.status} layoutPreserved=${JSON.stringify(upgradeResult.layout.body) === JSON.stringify(legacyLayout)} `
    + `migratedModule=${upgradeResult.probe.status}`,
    ['legacy-requests.jsonl']
  );

  // 5. Production refuses the test identity mode and exits non-zero.
  const productionData = path.join(runRoot, 'production');
  const productionRefusal = spawnProcess('production-refusal', process.execPath, ['apps/api/src/server.js'], {
    env: {
      NODE_ENV: 'production',
      PORT: String(SPARE_PORT),
      SQLITE_PATH: path.join(productionData, 'workspace.sqlite'),
      WORKBENCH_IDENTITY_MODE: 'test-principal',
      WORKBENCH_TEST_PRINCIPALS: accounts.a,
      WORKBENCH_TRUSTED_ORIGINS: `https://localhost:${SPARE_PORT}`
    }
  });
  const refusalExit = await productionRefusal.exit;
  const refusalLogs = productionRefusal.logs();
  writeLog('logs/production-refusal.log', `${refusalLogs.stdout}\n${refusalLogs.stderr}`);
  record(
    'production-refuses-test-identity',
    refusalExit.code !== 0 && /Refusing to start/.test(refusalLogs.stderr) ? 'PASS' : 'FAIL',
    `exit=${refusalExit.code} reason=${/Refusing to start/.test(refusalLogs.stderr)}`,
    ['production-refusal.log']
  );

  // 6. A production process without a real adapter answers 401 on business entry.
  const noAdapter = spawnProcess('production-no-adapter', process.execPath, ['apps/api/src/server.js'], {
    env: {
      NODE_ENV: 'production',
      PORT: String(SPARE_PORT),
      SQLITE_PATH: path.join(productionData, 'no-adapter.sqlite'),
      WORKBENCH_TRUSTED_ORIGINS: `https://localhost:${SPARE_PORT}`
    }
  });
  try {
    const response = await waitForProductionAnswer(SPARE_PORT, workbenchPaths.context, {
      Origin: `https://localhost:${SPARE_PORT}`,
      Cookie: `${workbenchHeaders.sessionCookie}=forged`
    });
    record(
      'production-without-adapter-401',
      response.status === 401 && response.body.includes('unauthenticated') ? 'PASS' : 'FAIL',
      `status=${response.status} body=${response.body}`,
      []
    );
  } catch (error) {
    record('production-without-adapter-401', 'FAIL', `request failed: ${error.message}`);
  } finally {
    await noAdapter.stop();
  }

  // 7. A failing migration stops startup with a non-zero exit.
  const broken = spawnProcess('broken-migration', process.execPath, [
    'scripts/first-flow/start.mjs',
    '--data-dir', path.join(runRoot, 'broken'),
    '--port', String(SPARE_PORT),
    '--fixtures', 'workbench-broken',
    '--web', 'none'
  ]);
  const brokenExit = await broken.exit;
  const brokenLogs = broken.logs();
  writeLog('logs/broken-migration.log', `${brokenLogs.stdout}\n${brokenLogs.stderr}`);
  record(
    'failing-migration-nonzero-exit',
    brokenExit.code !== 0 && /fixture migration failed on purpose/.test(brokenLogs.stderr) ? 'PASS' : 'FAIL',
    `exit=${brokenExit.code} reason=${/fixture migration failed on purpose/.test(brokenLogs.stderr)}`,
    ['broken-migration.log']
  );

  // Evidence: copy the runner logs and index the artifacts.
  const rawLogDir = path.join(runRoot, 'logs');
  if (fs.existsSync(rawLogDir)) {
    for (const name of fs.readdirSync(rawLogDir)) {
      fs.copyFileSync(path.join(rawLogDir, name), path.join(evidenceDir, name));
    }
  }
  summary.artifacts.checkLogs = fs.existsSync(rawLogDir) ? fs.readdirSync(rawLogDir).sort() : [];

  const primaryLogs = path.join(primaryData, 'logs', 'requests.jsonl');
  if (fs.existsSync(primaryLogs)) {
    fs.copyFileSync(primaryLogs, path.join(evidenceDir, 'primary-requests.jsonl'));
    summary.artifacts.primaryRequestLog = 'primary-requests.jsonl';
  }
  const legacyLogs = path.join(legacyData, 'logs', 'requests.jsonl');
  if (fs.existsSync(legacyLogs)) {
    fs.copyFileSync(legacyLogs, path.join(evidenceDir, 'legacy-requests.jsonl'));
    summary.artifacts.legacyRequestLog = 'legacy-requests.jsonl';
  }

  summary.finishedAt = new Date().toISOString();
  summary.passed = results.filter((result) => result.status === 'PASS').length;
  summary.failed = results.filter((result) => result.status !== 'PASS').length;
  summary.isolatedPaths = {
    runRoot,
    primary: primaryData,
    legacy: legacyData,
    production: productionData
  };
  fs.writeFileSync(path.join(evidenceDir, 'runner-check.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');

  console.log('');
  console.log(`B12 public-facility check on ${sha}: ${summary.passed} passed, ${summary.failed} failed`);
  console.log(`evidence: ${path.relative(repoRoot, path.join(evidenceDir, 'runner-check.json'))}`);
  return summary.failed === 0 ? 0 : 1;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (error) {
  console.error(`[first-flow check] FAILED: ${error.stack}`);
  exitCode = 1;
} finally {
  for (const runner of startedRunners) {
    try {
      await runner.close();
    } catch {
      // best effort cleanup
    }
  }
  for (const child of spawnedProcesses) {
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

process.exit(exitCode);
