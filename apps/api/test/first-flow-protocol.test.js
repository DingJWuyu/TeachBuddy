// B13 protocol and durability coverage over the frozen seam: idempotent
// replay, request protection, transport-level problems, injected write
// failures and a real HTTP listener across an API restart. Maps to WB-012,
// WB-014, WB-016 and WB-018.
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
  assertProblem,
  createFirstFlowHarness,
  pastedQuestionSample,
  TRUSTED_ORIGIN
} from './first-flow-harness.js';

const QUESTIONS = '/api/modules/questions/items';
const PREFERRED_PORT = 47113;

async function withHarness(run) {
  const harness = await createFirstFlowHarness();
  try {
    return await run(harness);
  } finally {
    await harness.close();
  }
}

function listen(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1');
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

async function listenPreferred(app, preferredPort) {
  try {
    return await listen(app, preferredPort);
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    return listen(app, 0);
  }
}

// Close the listener for the restart below; the client side opens one
// connection per request (see httpJson), so no pooled socket outlives it.
function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeIdleConnections();
  });
}

// One connection per request: a pooled keep-alive socket can outlive the
// restart below and make the next request fail non-deterministically.
function httpJson(baseUrl, method, urlPath, options = {}) {
  const { cookie, body, key, origin = TRUSTED_ORIGIN, protection = '1', headers = {} } = options;
  const url = new URL(`${baseUrl}${urlPath}`);
  const payload = body === undefined ? null : JSON.stringify(body);
  const requestHeaders = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(origin === null ? {} : { Origin: origin }),
    ...(protection === null ? {} : { 'X-TeachBuddy-Request': protection }),
    ...(key ? { 'Idempotency-Key': key } : {}),
    ...(payload === null ? {} : { 'Content-Type': 'application/json' }),
    ...(payload === null ? {} : { 'Content-Length': Buffer.byteLength(payload) }),
    connection: 'close',
    ...headers
  };

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: requestHeaders,
      agent: false
    }, (res) => {
      let text = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'],
        cacheControl: res.headers['cache-control'],
        body: text.length > 0 ? JSON.parse(text) : null
      }));
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

test('WB-012: committed writes survive restart and replay without duplicating objects', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const sample = pastedQuestionSample();
    const questionKey = harness.nextUuid();
    const created = (await api.post(QUESTIONS, sample, { key: questionKey }).expect(201)).body;

    await harness.restart();

    const afterRestart = await api.get(`${QUESTIONS}/${created.id}`).expect(200);
    assert.deepEqual(afterRestart.body, created);
    const replay = await api.post(QUESTIONS, sample, { key: questionKey }).expect(201);
    assert.equal(replay.headers['cache-control'], 'no-store');
    assert.deepEqual(replay.body, created);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 1);

    assert.equal(harness.count('SELECT COUNT(*) AS count FROM workbench_mutation_keys'), 1);

    const updated = (await api.put(
      `${QUESTIONS}/${created.id}`,
      {
        baseVersion: 1,
        title: created.title,
        body: created.body,
        solution: created.solution,
        note: '重启后的新写入',
        starred: created.starred
      },
      { key: harness.nextUuid() }
    ).expect(200)).body;
    assert.equal(updated.version, 2);

    const oldReplay = await api.post(QUESTIONS, sample, { key: questionKey }).expect(201);
    assert.equal(oldReplay.body.version, 1, 'replay returns the original committed result');
    const current = await api.get(`${QUESTIONS}/${created.id}`).expect(200);
    assert.equal(current.body.version, 2, 'the client can read the newer current version afterwards');
  });
});

test('WB-012: one key is bound to one logical request per account', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const teacherB = harness.createAccount('teacher-b');
    const apiA = harness.agent(teacherA);
    const apiB = harness.agent(teacherB);
    const sample = pastedQuestionSample();
    const key = harness.nextUuid();

    const created = (await apiA.post(QUESTIONS, sample, { key }).expect(201)).body;

    const reorderedKeys = {
      source: sample.source,
      starred: sample.starred,
      note: sample.note,
      solution: sample.solution,
      body: sample.body,
      title: sample.title
    };
    const keyOrderReplay = await apiA.post(QUESTIONS, reorderedKeys, { key }).expect(201);
    assert.deepEqual(keyOrderReplay.body, created, 'object key order does not change the fingerprint');

    const arrayKey = harness.nextUuid();
    const twoBlocks = {
      ...sample,
      body: {
        version: 1,
        blocks: [
          { type: 'math', latex: 'a=1' },
          { type: 'math', latex: 'b=2' }
        ]
      }
    };
    await apiA.post(QUESTIONS, twoBlocks, { key: arrayKey }).expect(201);
    const reversedBlocks = {
      ...twoBlocks,
      body: { version: 1, blocks: [...twoBlocks.body.blocks].reverse() }
    };
    const arrayOrderConflict = await apiA.post(QUESTIONS, reversedBlocks, { key: arrayKey }).expect(409);
    assertProblem(arrayOrderConflict, 409, '/problems/workbench/idempotency-key-reused');

    const differentBody = await apiA
      .post(QUESTIONS, { ...sample, title: '换了标题' }, { key })
      .expect(409);
    assertProblem(differentBody, 409, '/problems/workbench/idempotency-key-reused');

    const differentPath = await apiA
      .post(`${QUESTIONS}/${created.id}/deletion`, { baseVersion: 1, deleted: true }, { key })
      .expect(409);
    assertProblem(differentPath, 409, '/problems/workbench/idempotency-key-reused');

    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 2);
    const unchanged = await apiA.get(`${QUESTIONS}/${created.id}`).expect(200);
    assert.deepEqual(unchanged.body, created);

    const otherAccount = await apiB.post(QUESTIONS, sample, { key }).expect(201);
    assert.equal(otherAccount.body.id !== created.id, true);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 3);
  });
});

test('WB-018: a failing write rolls back fully and the key stays reusable', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const question = (await api.post(QUESTIONS, pastedQuestionSample(), { key: harness.nextUuid() }).expect(201)).body;
    const questionKey = harness.nextUuid();
    harness.failWritesTo('question_items');
    const questionFailed = await api
      .post(QUESTIONS, pastedQuestionSample({ title: '注入失败的新题' }), { key: questionKey })
      .expect(503);
    assertProblem(questionFailed, 503, '/problems/workbench/temporarily-unavailable');
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 1);
    assert.deepEqual((await api.get(`${QUESTIONS}/${question.id}`).expect(200)).body, question);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM workbench_mutation_keys WHERE key = ?', questionKey), 0);
    harness.clearFaults();
    await api.post(QUESTIONS, pastedQuestionSample({ title: '注入失败的新题' }), { key: questionKey }).expect(201);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 2);
  });
});

test('WB-012: concurrent requests with one key still commit once', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const sample = pastedQuestionSample();
    const key = harness.nextUuid();

    const [first, second] = await Promise.all([
      api.post(QUESTIONS, sample, { key }),
      api.post(QUESTIONS, sample, { key })
    ]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.deepEqual(first.body, second.body);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 1);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM workbench_mutation_keys'), 1);
  });
});

test('WB-016/018: write protection matches the trusted origin exactly', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);
    const sample = pastedQuestionSample();

    const cases = [
      { name: 'missing protection header', options: { protection: null } },
      { name: 'wrong protection header', options: { protection: '0' } },
      { name: 'untrusted origin', options: { origin: 'https://evil.test' } },
      { name: 'null origin', options: { origin: 'null' } },
      { name: 'origin scheme mismatch', options: { origin: 'http://workbench.first-flow.test' } },
      { name: 'origin port mismatch', options: { origin: 'https://workbench.first-flow.test:8443' } },
      { name: 'no origin and no referer', options: { origin: null } }
    ];
    for (const scenario of cases) {
      const response = await api.post(QUESTIONS, sample, { key: harness.nextUuid(), ...scenario.options });
      assertProblem(response, 403, '/problems/workbench/request-not-allowed');
    }

    const refererFallback = await api.post(QUESTIONS, sample, {
      key: harness.nextUuid(),
      origin: null,
      headers: { Referer: `${TRUSTED_ORIGIN}/questions/new` }
    });
    assert.equal(refererFallback.status, 201);

    const originWins = await api.post(QUESTIONS, sample, {
      key: harness.nextUuid(),
      headers: { Referer: 'https://evil.test/steal' }
    });
    assert.equal(originWins.status, 201, 'a valid Origin is not overridden by Referer');

    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 2);

    const read = await api.get(QUESTIONS).expect(200);
    assert.equal(read.body.items.length, 2);
  });
});

test('WB-014/018: transport and query failures use the contract problem types', async () => {
  await withHarness(async (harness) => {
    const teacherA = harness.createAccount('teacher-a');
    const api = harness.agent(teacherA);

    const malformed = await harness
      .raw()
      .post(QUESTIONS)
      .set('Cookie', teacherA.cookie)
      .set('Origin', TRUSTED_ORIGIN)
      .set('X-TeachBuddy-Request', '1')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', harness.nextUuid())
      .send('{"title": ');
    assertProblem(malformed, 400, '/problems/workbench/malformed-json');

    const wrongMedia = await harness
      .raw()
      .post(QUESTIONS)
      .set('Cookie', teacherA.cookie)
      .set('Origin', TRUSTED_ORIGIN)
      .set('X-TeachBuddy-Request', '1')
      .set('Content-Type', 'text/plain')
      .set('Idempotency-Key', harness.nextUuid())
      .send('title=x');
    assertProblem(wrongMedia, 415, '/problems/workbench/unsupported-media-type');

    const oversized = await harness
      .raw()
      .post(QUESTIONS)
      .set('Cookie', teacherA.cookie)
      .set('Origin', TRUSTED_ORIGIN)
      .set('X-TeachBuddy-Request', '1')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', harness.nextUuid())
      .send(JSON.stringify({ title: 'x'.repeat(2 * 1024 * 1024 + 8) }));
    assertProblem(oversized, 413, '/problems/workbench/payload-too-large');

    const unknownQuery = await api.get(QUESTIONS).query({ limit: '10' }).expect(422);
    assertProblem(unknownQuery, 422, '/problems/workbench/invalid-input');
    assert.deepEqual(
      { field: unknownQuery.body.field, reason: unknownQuery.body.reason },
      { field: '/query/limit', reason: 'unknown-field' }
    );

    const question = (
      await api.post(QUESTIONS, pastedQuestionSample(), { key: harness.nextUuid() }).expect(201)
    ).body;
    const unknownItemQuery = await api.get(`${QUESTIONS}/${question.id}`).query({ state: 'deleted' }).expect(422);
    assertProblem(unknownItemQuery, 422, '/problems/workbench/invalid-input');
    assert.deepEqual(
      { field: unknownItemQuery.body.field, reason: unknownItemQuery.body.reason },
      { field: '/query/state', reason: 'unknown-field' },
      'the single-question GET accepts no query parameters'
    );

    const badStarred = await api.get(QUESTIONS).query({ starred: '1' }).expect(422);
    assert.deepEqual(
      { field: badStarred.body.field, reason: badStarred.body.reason },
      { field: '/query/starred', reason: 'invalid-type' }
    );

    const badId = await api.get(`${QUESTIONS}/not-a-uuid`).expect(422);
    assert.equal(badId.body.type, '/problems/workbench/invalid-input');

    // Within the schema stage the JSON content type is checked first, so a
    // malformed path with a non-JSON body is a media-type rejection.
    const badPathWrongMedia = await harness
      .raw()
      .put(`${QUESTIONS}/not-a-uuid`)
      .set('Cookie', teacherA.cookie)
      .set('Origin', TRUSTED_ORIGIN)
      .set('X-TeachBuddy-Request', '1')
      .set('Content-Type', 'text/plain')
      .set('Idempotency-Key', harness.nextUuid())
      .send('nope');
    assertProblem(badPathWrongMedia, 415, '/problems/workbench/unsupported-media-type');

    // The path is schema too, so it is rejected before the request key.
    const badPathNoKey = await api.put(`${QUESTIONS}/not-a-uuid`, { baseVersion: 1 }, { key: null });
    assertProblem(badPathNoKey, 422, '/problems/workbench/invalid-input');
    assert.deepEqual(
      { field: badPathNoKey.body.field, reason: badPathNoKey.body.reason },
      { field: '/path/id', reason: 'invalid-type' }
    );

    const missingKey = await api.post(QUESTIONS, pastedQuestionSample());
    assertProblem(missingKey, 422, '/problems/workbench/invalid-input');
    assert.deepEqual(
      { field: missingKey.body.field, reason: missingKey.body.reason },
      { field: '/headers/Idempotency-Key', reason: 'required' }
    );

    const badKey = await api.post(QUESTIONS, pastedQuestionSample(), { key: 'not-a-uuid' });
    assertProblem(badKey, 422, '/problems/workbench/invalid-input');
    assert.deepEqual(
      { field: badKey.body.field, reason: badKey.body.reason },
      { field: '/headers/Idempotency-Key', reason: 'invalid-type' }
    );

    // Frozen processing order: JSON/basic schema comes before the confirmed
    // request key, so this body error wins over the absent key.
    const invalidBeforeKey = await harness
      .raw()
      .post(QUESTIONS)
      .set('Cookie', teacherA.cookie)
      .set('Origin', TRUSTED_ORIGIN)
      .set('X-TeachBuddy-Request', '1')
      .send({ title: '缺少正文' });
    assertProblem(invalidBeforeKey, 422, '/problems/workbench/invalid-input');
    assert.deepEqual(
      { field: invalidBeforeKey.body.field, reason: invalidBeforeKey.body.reason },
      { field: '/body', reason: 'required' }
    );

    assertProblem(await api.get('/api/modules/unknown'), 404, '/problems/workbench/not-found');
    assertProblem(await api.post(`${QUESTIONS}/${harness.nextUuid()}/nope`, {}), 404, '/problems/workbench/not-found');
  });
});

test('WB-012: a real HTTP listener keeps the same persisted result across restart', async () => {
  const harness = await createFirstFlowHarness();
  let server = null;
  try {
    const teacherA = harness.createAccount('teacher-a');
    server = await listenPreferred(harness.app(), PREFERRED_PORT);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const sample = pastedQuestionSample();
    const key = harness.nextUuid();
    const created = await httpJson(baseUrl, 'POST', QUESTIONS, {
      cookie: teacherA.cookie,
      body: sample,
      key
    });
    assert.equal(created.status, 201);
    assert.equal(created.cacheControl, 'no-store');
    assert.match(String(created.contentType), /^application\/json/);
    assert.equal(created.body.version, 1);

    await closeServer(server);
    server = null;
    await harness.restart();
    server = await listenPreferred(harness.app(), PREFERRED_PORT);
    const restartedUrl = `http://127.0.0.1:${server.address().port}`;

    const fetched = await httpJson(restartedUrl, 'GET', `${QUESTIONS}/${created.body.id}`, {
      cookie: teacherA.cookie
    });
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.body, created.body);

    const replayed = await httpJson(restartedUrl, 'POST', QUESTIONS, {
      cookie: teacherA.cookie,
      body: sample,
      key
    });
    assert.equal(replayed.status, 201);
    assert.deepEqual(replayed.body, created.body);
    assert.equal(harness.count('SELECT COUNT(*) AS count FROM question_items'), 1);

    const noIdentity = await httpJson(restartedUrl, 'GET', QUESTIONS, {});
    assert.equal(noIdentity.status, 401);
    assert.equal(noIdentity.body.type, '/problems/workbench/unauthenticated');
  } finally {
    if (server) await closeServer(server);
    await harness.close();
  }
});
