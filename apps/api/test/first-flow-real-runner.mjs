/**
 * Real-service first-flow driver for the B12 isolated runner.
 *
 * Verification helper, not a unit test and not part of the product build
 * (`node --test test/*.test.js` does not pick it up). It drives the B13
 * first-flow requests against a running `scripts/first-flow/start.mjs`
 * instance over real HTTPS, with the runner's test-principal cookies read from
 * the isolated data directory. Contract fixtures are not used: the run proves
 * the product module mapping in `apps/api/src/workbench/moduleImplementations.js`.
 *
 * Usage:
 *   node scripts/first-flow/start.mjs --data-dir <dir> --port 47113 \
 *     --fixtures none --web none --reset
 *   node apps/api/test/first-flow-real-runner.mjs \
 *     --data-dir <dir> --origin https://localhost:47113 --phase first
 *   node scripts/first-flow/start.mjs --data-dir <dir> --port 47113 \
 *     --fixtures none --web none          # restart, keeps the database
 *   node apps/api/test/first-flow-real-runner.mjs \
 *     --data-dir <dir> --origin https://localhost:47113 --phase after-restart
 *
 * The `first` phase stores the created IDs, idempotency key and versions in
 * `<dir>/b13-state.json`; the `after-restart` phase reads them back so restart
 * persistence, replay and duplicate-free storage are checked on the same
 * objects. Exit code 0 only when every assertion passed.
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

function parseArgs(argv) {
  const options = { dataDir: null, origin: null, phase: 'first' };
  for (let index = 0; index < argv.length; index += 1) {
    switch (argv[index]) {
      case '--data-dir': options.dataDir = path.resolve(argv[++index]); break;
      case '--origin': options.origin = argv[++index].replace(/\/$/, ''); break;
      case '--phase': options.phase = argv[++index]; break;
      default: throw new Error(`Unknown option: ${argv[index]}`);
    }
  }
  if (!options.dataDir) throw new Error('--data-dir is required');
  if (!options.origin) throw new Error('--origin is required');
  if (!['first', 'after-restart'].includes(options.phase)) {
    throw new Error(`Unknown phase: ${options.phase}`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const ca = fs.readFileSync(path.join(options.dataDir, 'certs', 'localhost-cert.pem'));
const principals = JSON.parse(
  fs.readFileSync(path.join(options.dataDir, 'principals.json'), 'utf-8')
);
const statePath = path.join(options.dataDir, 'b13-state.json');
const origin = new URL(options.origin);
const cookieFor = (accountKey) => `${principals.cookieName}=${principals.accounts[accountKey]}`;

function call(method, urlPath, {
  body,
  key,
  cookie,
  requestOrigin = options.origin,
  protection = '1',
  headers = {}
} = {}) {
  const payload = body === undefined ? null : JSON.stringify(body);
  const requestHeaders = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(requestOrigin === null ? {} : { Origin: requestOrigin }),
    ...(protection === null ? {} : { 'X-TeachBuddy-Request': protection }),
    ...(key ? { 'Idempotency-Key': key } : {}),
    ...(payload === null
      ? {}
      : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }),
    ...headers
  };
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: origin.hostname,
      port: origin.port,
      path: urlPath,
      method,
      headers: requestHeaders,
      ca
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
        resolve({ status: res.statusCode, cacheControl: res.headers['cache-control'], body: parsed });
      });
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

const results = [];

function record(name, ok, detail, response) {
  results.push({ name, ok, detail });
  const suffix = ok || response === undefined ? '' : ` raw=${JSON.stringify(response)}`;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}${suffix}`);
}

const QUESTIONS = '/api/modules/questions/items';
const ACCOUNT_A = 'fixture-teacher-a';
const ACCOUNT_B = 'fixture-teacher-b';

const questionSample = {
  title: '二次函数最小值',
  body: {
    version: 1,
    blocks: [{
      type: 'paragraph',
      runs: [
        { type: 'text', text: '已知函数 ' },
        { type: 'math', latex: 'f(x)=x^2-2x' },
        { type: 'text', text: '，求最小值。' }
      ]
    }]
  },
  solution: { version: 1, blocks: [{ type: 'math', latex: 'f(x)=(x-1)^2-1' }] },
  note: '先让学生尝试配方。',
  starred: true,
  source: { kind: 'paste', text: '已知函数 f(x)=x^2-2x，求最小值。\n\n答案：-1。' }
};

const uuid = (n) => `b1300000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function firstPhase() {
  const cookieA = cookieFor(ACCOUNT_A);
  const keyQ = uuid(1);
  const created = await call('POST', QUESTIONS, { body: questionSample, key: keyQ, cookie: cookieA });
  record(
    'create-question-201',
    created.status === 201 && created.body.version === 1 && created.cacheControl === 'no-store',
    `status=${created.status} version=${created.body.version}`,
    created
  );

  const fetched = await call('GET', `${QUESTIONS}/${created.body.id}`, { cookie: cookieA });
  record(
    'read-back-same-payload',
    fetched.status === 200 && JSON.stringify(fetched.body) === JSON.stringify(created.body),
    `status=${fetched.status}`,
    fetched
  );

  const search = await call('GET', `${QUESTIONS}?q=${encodeURIComponent('配方')}`, { cookie: cookieA });
  record(
    'search-finds-by-note',
    search.status === 200 && search.body.items.length === 1 && search.body.items[0].id === created.body.id,
    `items=${search.body.items.length}`,
    search
  );

  const edit = await call('PUT', `${QUESTIONS}/${created.body.id}`, {
    body: {
      baseVersion: 1,
      title: '第二版',
      body: questionSample.body,
      solution: questionSample.solution,
      note: '第一次修改',
      starred: true
    },
    key: uuid(4),
    cookie: cookieA
  });
  record(
    'edit-bumps-to-version-2',
    edit.status === 200 && edit.body.version === 2 && edit.body.source.kind === 'paste',
    `status=${edit.status} version=${edit.body.version}`,
    edit
  );

  const stale = await call('PUT', `${QUESTIONS}/${created.body.id}`, {
    body: {
      baseVersion: 1,
      title: '过期写入',
      body: questionSample.body,
      solution: questionSample.solution,
      note: 'x',
      starred: false
    },
    key: uuid(7),
    cookie: cookieA
  });
  record(
    'stale-version-conflict-409',
    stale.status === 409
      && stale.body.currentVersion === 2
      && stale.body.type === '/problems/workbench/version-conflict',
    `status=${stale.status} currentVersion=${stale.body.currentVersion}`,
    stale
  );

  const unknownQuery = await call('GET', `${QUESTIONS}/${created.body.id}?state=deleted`, { cookie: cookieA });
  record(
    'single-get-unknown-query-422',
    unknownQuery.status === 422
      && unknownQuery.body.field === '/query/state'
      && unknownQuery.body.reason === 'unknown-field',
    `status=${unknownQuery.status} field=${unknownQuery.body.field}`,
    unknownQuery
  );

  const wrongType = await call('POST', QUESTIONS, {
    body: 'xxxxx',
    key: uuid(5),
    cookie: cookieA,
    headers: { 'Content-Type': 'text/plain' }
  });
  record(
    'unsupported-media-type-415',
    wrongType.status === 415 && wrongType.body.type === '/problems/workbench/unsupported-media-type',
    `status=${wrongType.status}`,
    wrongType
  );

  const missingKey = await call('POST', QUESTIONS, { body: questionSample, cookie: cookieA });
  record(
    'missing-idempotency-key-422',
    missingKey.status === 422 && missingKey.body.field === '/headers/Idempotency-Key',
    `status=${missingKey.status} field=${missingKey.body?.field}`,
    missingKey
  );

  const anonymous = await call('GET', QUESTIONS, { cookie: null });
  record(
    'anonymous-401',
    anonymous.status === 401 && anonymous.body.type === '/problems/workbench/unauthenticated',
    `status=${anonymous.status}`,
    anonymous
  );

  const crossAccount = await call('GET', `${QUESTIONS}/${created.body.id}`, { cookie: cookieFor(ACCOUNT_B) });
  record(
    'cross-account-404',
    crossAccount.status === 404 && crossAccount.body.type === '/problems/workbench/not-found',
    `status=${crossAccount.status}`,
    crossAccount
  );

  const badOrigin = await call('POST', QUESTIONS, {
    body: questionSample,
    key: uuid(6),
    cookie: cookieA,
    requestOrigin: 'https://evil.test'
  });
  record('untrusted-origin-403', badOrigin.status === 403, `status=${badOrigin.status}`, badOrigin);

  const context = await call('GET', '/api/workbench/context', { cookie: cookieA });
  record(
    'context-identity',
    context.status === 200 && context.body.accountKey === ACCOUNT_A,
    `account=${context.body.accountKey}`,
    context
  );

  fs.writeFileSync(statePath, `${JSON.stringify({
    questionId: created.body.id,
    questionKey: keyQ,
    createdAt: created.body.createdAt,
    version: created.body.version,
    currentVersion: edit.body.version
  }, null, 2)}\n`);
}

async function afterRestartPhase() {
  const cookieA = cookieFor(ACCOUNT_A);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

  const read = await call('GET', `${QUESTIONS}/${state.questionId}`, { cookie: cookieA });
  record(
    'restart-read-same-id-version',
    read.status === 200
      && read.body.id === state.questionId
      && read.body.version === state.currentVersion
      && read.body.createdAt === state.createdAt,
    `status=${read.status} version=${read.body.version}`,
    read
  );

  const replay = await call('POST', QUESTIONS, { body: questionSample, key: state.questionKey, cookie: cookieA });
  record(
    'restart-replay-same-result',
    replay.status === 201 && replay.body.id === state.questionId && replay.body.version === state.version,
    `status=${replay.status} id=${replay.body.id}`,
    replay
  );

  const list = await call('GET', QUESTIONS, { cookie: cookieA });
  record(
    'replay-added-no-duplicate',
    list.status === 200 && list.body.items.length === 1 && list.body.items[0].id === state.questionId,
    `items=${list.body.items.length}`,
    list
  );


}

if (options.phase === 'first') {
  await firstPhase();
} else {
  await afterRestartPhase();
}

const failed = results.filter((result) => !result.ok).length;
console.log(`SUMMARY ${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
