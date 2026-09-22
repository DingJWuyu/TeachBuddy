import { createIntegration } from '../../apps/api/test/fixtures/auth-integration/harness.js';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { startFirstFlowRunner } from '../first-flow/lib/runner.mjs';
import { pastedQuestionSample } from '../../apps/api/test/first-flow-harness.js';
const fixed = '612f0a9868743a1d5eea7e6f236d3ff903752439';
const source = process.env.B16_SOURCE ?? '/home/liam_t/项目/TeacherWorkspace-b16-candidate2';
assert.equal(
  execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  fixed,
  'B16 source must match fixed SHA'
);
const { startFirstFlowRunner: startOld } = await import(
  pathToFileURL(path.join(source, 'scripts/first-flow/lib/runner.mjs'))
);
const dataDir = path.resolve('test-results/r31-complete/b16-upgrade');
const options = {
  dataDir,
  port: 48334,
  fixtures: [],
  mode: 'test-principal',
  web: 'none',
  quiet: true
};
let runner;
const snapshot = (db) =>
  Object.fromEntries(
    ['users', 'workspaceLayouts', 'question_items', 'lesson_items', 'workbench_mutation_keys'].map(
      (table) => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]
    )
  );
function request(route, { method = 'GET', body, key, headers = {} } = {}) {
  const data = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      `${runner.origin}${route}`,
      {
        method,
        rejectUnauthorized: false,
        agent: false,
        headers: {
          Origin: runner.origin,
          'X-TeachBuddy-Request': '1',
          ...(key ? { 'Idempotency-Key': key } : {}),
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          ...headers
        }
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
      }
    );
    req.on('error', reject);
    req.end(data);
  });
}
try {
  runner = await startOld({ ...options, reset: true });
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'R31旧账户',
      email: 'r31-old@example.test',
      password: 'r31 old password',
      passwordConfirmation: 'r31 old password'
    }
  });
  assert.equal(registered.status, 201);
  const authorization = { Authorization: `Bearer ${registered.body.token}` };
  const layout = {
    hiddenModuleIds: [],
    groups: [{ id: 'focus', name: '原有布局', moduleIds: [] }],
    ungroupedModuleIds: []
  };
  assert.equal(
    (
      await request('/api/workspace/layout', {
        method: 'PUT',
        body: layout,
        headers: authorization
      })
    ).status,
    200
  );
  const principal = runner.workbench.identity.listTestPrincipals()[0];
  const headers = {
    Cookie: runner.workbench.identity.testPrincipalCookie(principal).header.split(';')[0]
  };
  const input = pastedQuestionSample(),
    key = randomUUID();
  const created = await request('/api/modules/questions/items', {
    method: 'POST',
    body: input,
    key,
    headers
  });
  assert.equal(created.status, 201);
  const before = snapshot(runner.workbench.db);
  await runner.close();
  runner = null;
  for (let pass = 1; pass <= 2; pass += 1) {
    runner = await startFirstFlowRunner({ ...options, reset: false });
    assert.deepEqual(snapshot(runner.workbench.db), before);
    assert.deepEqual(
      (await request('/api/modules/questions/items', { method: 'POST', body: input, key, headers }))
        .body,
      created.body
    );
    assert.equal(
      runner.workbench.db
        .prepare("SELECT count(*) AS n FROM workbench_migrations WHERE id IN ('materials_files_001','materials_jobs_001')")
        .get().n,
      2
    );
    await runner.close();
    runner = null;
  }
  const world = await createIntegration({ directory: path.join(dataDir, 'data') });
  try {
    const client = world.client();
    await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    const login = await client.request('POST', '/api/auth/login', { body: { email: 'r31-old@example.test', password: 'r31 old password', rememberMe: true } });
    assert.equal(login.status, 200, login.text);
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: login.json.id, rememberMe: true } })).status, 200);
    assert.equal((await client.request('GET','/api/workbench/context')).status,200);
    assert.deepEqual(snapshot(world.workbench.db), before);
  } finally { await world.close(); }
  fs.writeFileSync(
    'docs/acceptance/evidence/R31/v1/migration.json',
    JSON.stringify(
      {
        status: 'PASS',
        sourceRevision: fixed,
        dataDir,
        retainedTables: Object.keys(before),
        checks: [
          'B16真实HTTP旧账户/布局/题目/幂等创建',
          '迁移后全部旧行逐值保持',
          '原键重放响应不变',
          '连续两次保留库启动只迁移一次',
          'A11迁移后旧账户真实登录/激活，旧数据保持'
        ]
      },
      null,
      2
    )
  );
  console.log('PASS: fixed B16 old database migration, old HTTP response replay, repeated startup');
} finally {
  await runner?.close();
}
