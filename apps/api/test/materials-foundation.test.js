import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { startFixture } from './fixtures/materials/server.mjs';
import { validateLocation } from '../src/workbench/content/index.js';
import { validateSchema } from '../src/workbench/content/schema.js';

const root = path.resolve('test-results/r31-foundation/api');
fs.mkdirSync(root, { recursive: true });
async function harness(t) {
  const dir = fs.mkdtempSync(path.join(root, 'case-'));
  let runtime = await startFixture({ dataDir: dir, port: 0 });
  t.after(async () => runtime.close());
  const account = { accountKey: 'r31-a' };
  const cookie = (who) => runtime.workbench.identity.testPrincipalCookie(who).header.split(';')[0];
  async function request(route, { method = 'GET', body, key, who = 'r31-a', headers = {} } = {}) {
    const response = await fetch(`http://localhost:${runtime.server.address().port}${route}`, {
      method,
      body,
      headers: {
        Cookie: cookie(who),
        Origin: 'http://localhost:0',
        'X-TeachBuddy-Request': '1',
        ...(key ? { 'Idempotency-Key': key } : {}),
        ...headers
      }
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const json = response.headers.get('content-type')?.includes('json')
      ? JSON.parse(bytes.toString())
      : null;
    return { status: response.status, bytes, body: json, headers: response.headers };
  }
  const upload = (
    bytes = Buffer.from('原件内容'),
    key = randomUUID(),
    name = 'original.txt',
    who
  ) => {
    const body = new FormData();
    body.append('file', new Blob([bytes], { type: 'image/png' }), name);
    return request('/api/workbench/files', { method: 'POST', body, key, who });
  };
  return {
    dir,
    account,
    request,
    upload,
    cookie,
    get runtime() {
      return runtime;
    },
    async restart() {
      await runtime.close();
      runtime = await startFixture({ dataDir: dir, port: 0 });
    }
  };
}

test('real HTTP: upload/get/download, idempotency, isolation, restart, same public ports', async (t) => {
  const h = await harness(t),
    key = randomUUID(),
    bytes = Buffer.from('原件 𝑥 <script>unsafe()</script>');
  const saved = await h.upload(bytes, key, '../原件.html');
  assert.equal(saved.status, 201);
  validateSchema('File', saved.body);
  assert.equal(saved.body.mediaType, 'text/plain');
  const repeated = await h.upload(bytes, key, '../原件.html');
  assert.deepEqual(repeated.body, saved.body);
  assert.equal((await h.upload(Buffer.from('异体'), key, '../原件.html')).status, 409);
  const duplicate = await h.upload(bytes);
  assert.notEqual(duplicate.body.id, saved.body.id);
  assert.equal(duplicate.body.duplicateOfFileId, saved.body.id);
  const foreign = await h.upload(bytes, randomUUID(), 'b.txt', 'r31-b');
  assert.equal(foreign.body.duplicateOfFileId, null);
  const filePath = `/api/workbench/files/${saved.body.id}`;
  assert.deepEqual((await h.request(filePath)).body, saved.body);
  for (const suffix of ['', '/content'])
    assert.equal((await h.request(filePath + suffix, { who: 'r31-b' })).status, 404);
  const response = await h.request(filePath + '/content');
  assert.deepEqual(response.bytes, bytes);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-disposition'), /^attachment/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  await h.restart();
  assert.deepEqual((await h.upload(bytes, key, '../原件.html')).body, saved.body);
  assert.deepEqual((await h.request(filePath + '/content')).bytes, bytes);
  assert.deepEqual(h.runtime.workbench.files.read(h.account, saved.body.id), saved.body);
  const chunks = [];
  for await (const chunk of await h.runtime.workbench.files.open(h.account, saved.body.id))
    chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);
  const direct = await h.runtime.workbench.files.store(
    h.account,
    { name: 'direct.txt', mediaType: 'text/html', bytes },
    { key: randomUUID(), method: 'POST', path: '/api/workbench/files' }
  );
  assert.deepEqual((await h.request(`/api/workbench/files/${direct.id}`)).body, direct);
});

test('real HTTP failure recovery: staging write, rename, DB commit rollback, corruption', async (t) => {
  const h = await harness(t);
  const db = h.runtime.workbench.db;
  const count = () => db.prepare('SELECT count(*) AS n FROM materials_files').get().n;
  for (const directory of ['staging', 'blobs']) {
    const target = path.join(h.dir, 'files', directory),
      backup = `${target}-kept`,
      key = randomUUID();
    fs.renameSync(target, backup);
    fs.writeFileSync(target, 'fault');
    const failed = await h.upload(Buffer.from(directory), key);
    assert.equal(failed.status, 503);
    assert.equal(count(), directory === 'staging' ? 0 : 1);
    fs.unlinkSync(target);
    fs.renameSync(backup, target);
    assert.equal((await h.upload(Buffer.from(directory), key)).status, 201);
  }
  // Failure after metadata insert, when the shared ledger is being committed.
  db.exec(
    "CREATE TRIGGER fixture_refuse_commit BEFORE INSERT ON workbench_mutation_keys BEGIN SELECT RAISE(ABORT, 'commit refused'); END"
  );
  const before = count(),
    key = randomUUID();
  assert.equal((await h.upload(Buffer.from('DB failure'), key)).status, 503);
  assert.equal(count(), before);
  assert.equal(
    db.prepare('SELECT count(*) AS n FROM workbench_mutation_keys WHERE key=?').get(key).n,
    0
  );
  db.exec('DROP TRIGGER fixture_refuse_commit');
  const saved = await h.upload(Buffer.from('DB failure'), key);
  assert.equal(saved.status, 201);
  const blobName = db
    .prepare('SELECT blobName FROM materials_files WHERE id=?')
    .get(saved.body.id).blobName;
  const blobPath = path.join(h.dir, 'files', 'blobs', blobName),
    original = fs.readFileSync(blobPath);
  fs.writeFileSync(blobPath, 'corrupt');
  assert.equal((await h.request(`/api/workbench/files/${saved.body.id}/content`)).status, 503);
  assert.equal((await h.request(`/api/workbench/files/${saved.body.id}`)).status, 503);
  assert.deepEqual(
    JSON.parse(
      db.prepare('SELECT metadata FROM materials_files WHERE id=?').get(saved.body.id).metadata
    ),
    saved.body
  );
  assert.equal((await h.upload(Buffer.from('DB failure'), key)).status, 503);
  fs.writeFileSync(blobPath, original);
  assert.deepEqual((await h.upload(original, key)).body, saved.body);
  assert.deepEqual(fs.readdirSync(path.join(h.dir, 'files', 'staging')), []);
});

test('real socket: interrupted upload creates no record; lost response confirms original key', async (t) => {
  const h = await harness(t),
    key = randomUUID();
  const db = h.runtime.workbench.db;
  let received;
  const receivedBody = new Promise((resolve) => {
    received = resolve;
  });
  const aborted = new Promise((resolve) =>
    h.runtime.server.once('request', (req) => {
      req.once('data', received);
      req.once('aborted', resolve);
    })
  );
  const request = http.request({
    host: 'localhost',
    port: h.runtime.server.address().port,
    path: '/api/workbench/files',
    method: 'POST',
    headers: {
      Cookie: h.cookie('r31-a'),
      Origin: 'http://localhost:0',
      'X-TeachBuddy-Request': '1',
      'Idempotency-Key': key,
      'Content-Type': 'multipart/form-data; boundary=r31',
      'Content-Length': '999999'
    }
  });
  request.on('error', () => {});
  request.write(
    '--r31\r\nContent-Disposition: form-data; name="file"; filename="partial.txt"\r\n\r\npartial'
  );
  await receivedBody;
  request.destroy();
  await aborted;
  assert.equal(db.prepare('SELECT count(*) AS n FROM materials_files').get().n, 0);
  const bytes = Buffer.from('unknown response');
  const payload = Buffer.from(
    '--r31\r\nContent-Disposition: form-data; name="file"; filename="unknown.txt"\r\n\r\nunknown response\r\n--r31--\r\n'
  );
  await new Promise((resolve, reject) => {
    const outgoing = http.request(
      {
        host: 'localhost',
        port: h.runtime.server.address().port,
        path: '/api/workbench/files',
        method: 'POST',
        headers: {
          Cookie: h.cookie('r31-a'),
          Origin: 'http://localhost:0',
          'X-TeachBuddy-Request': '1',
          'Idempotency-Key': key,
          'Content-Type': 'multipart/form-data; boundary=r31',
          'Content-Length': String(payload.length)
        }
      },
      (response) => {
        response.destroy();
        resolve();
      }
    );
    outgoing.on('error', reject);
    outgoing.end(payload);
  });
  assert.equal(db.prepare('SELECT count(*) AS n FROM materials_files').get().n, 1);
  const confirmed = await h.upload(bytes, key, 'unknown.txt');
  assert.equal(confirmed.status, 201);
  assert.equal(db.prepare('SELECT count(*) AS n FROM materials_files').get().n, 1);
});

test('content schemas, known locations, controlled images and unknown versions', async (t) => {
  const h = await harness(t);
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#5588aa' } })
    .png()
    .toBuffer();
  const image = (await h.upload(png, randomUUID(), 'figure.png')).body;
  const doc = {
    version: 2,
    blocks: [
      { type: 'heading', level: 1, runs: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }] },
      { type: 'paragraph', runs: [{ type: 'math', latex: '\\frac{x}{2}' }] },
      { type: 'image', fileId: image.id, alt: '已知图', widthMm: 30 },
      {
        type: 'list',
        role: 'options',
        items: [{ label: 'A', blocks: [{ type: 'math', latex: '\\sqrt{x}' }] }]
      },
      { type: 'table', rows: [[{ blocks: [] }, { blocks: [{ type: 'paragraph', runs: [] }] }]] },
      {
        type: 'teacher-note',
        blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '教师内容' }] }]
      }
    ]
  };
  const content = h.runtime.workbench.content;
  assert.equal(content.validate(h.account, doc), doc);
  assert.equal(content.validate(h.account, { version: 1, blocks: [] }).version, 1);
  assert.throws(
    () => content.validate(h.account, { ...doc, version: 99 }),
    (e) => e.problem.reason === 'unsupported-content-version'
  );
  assert.throws(
    () => content.validate({ accountKey: 'r31-b' }, doc),
    (e) => e.status === 404
  );
  const html = (await h.upload(Buffer.from('<html><script>alert(1)</script></html>'))).body;
  assert.equal(html.mediaType, 'text/html');
  assert.throws(
    () =>
      content.validate(h.account, { version: 2, blocks: [{ ...doc.blocks[2], fileId: html.id }] }),
    (e) => e.status === 422
  );
  const badTable = {
    version: 2,
    blocks: [{ type: 'table', rows: [[{ blocks: [] }], [{ blocks: [] }, { blocks: [] }]] }]
  };
  assert.throws(
    () => content.validate(h.account, badTable),
    (e) => e.status === 422
  );
  assert.throws(
    () => content.validate(h.account, { version: 2, blocks: [{ type: 'html', html: '<script>' }] }),
    (e) => e.status === 422
  );
  const location = {
    kind: 'page',
    fileId: image.id,
    renditionFileId: image.id,
    page: 1,
    box: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }
  };
  const files = h.runtime.workbench.files;
  assert.deepEqual(
    validateLocation(files, h.account, location, { originals: [image.id] }),
    location
  );
  assert.throws(() =>
    validateLocation(files, h.account, { ...location, page: 2 }, { originals: [image.id] })
  );
  assert.throws(() =>
    validateLocation(
      files,
      h.account,
      { ...location, box: { x: 0.8, y: 0, width: 0.5, height: 1 } },
      { originals: [image.id] }
    )
  );
  assert.throws(() => validateLocation(files, h.account, location));
  assert.deepEqual(
    validateLocation(files, h.account, { kind: 'text', start: 1, end: 2 }, { text: '中𝑥文' }),
    { kind: 'text', start: 1, end: 2 }
  );
  assert.throws(() =>
    validateLocation(files, h.account, { kind: 'text', start: 1, end: 4 }, { text: '中𝑥文' })
  );
  const saved = await h.request('/fixture/document', {
    method: 'PUT',
    body: JSON.stringify(doc),
    key: randomUUID(),
    headers: { 'Content-Type': 'application/json' }
  });
  assert.equal(saved.status, 200);
  await h.restart();
  assert.deepEqual((await h.request('/fixture/document')).body, doc);
  fs.writeFileSync(path.join(h.dir, 'sample-document.json'), JSON.stringify(doc, null, 2));
});

test('HTTP rejects malformed multipart, extra fields/files, absent identity and invalid content without committing', async (t) => {
  const h = await harness(t);
  const cases = [
    new FormData(),
    (() => {
      const f = new FormData();
      f.append('other', 'extra');
      return f;
    })(),
    (() => {
      const f = new FormData();
      f.append('file', new Blob(['one']), 'one.txt');
      f.append('file', new Blob(['two']), 'two.txt');
      return f;
    })(),
    (() => {
      const f = new FormData();
      f.append('file', new Blob(['one']), 'one.txt');
      f.append('other', 'extra');
      return f;
    })()
  ];
  for (const body of cases)
    assert.equal(
      (await h.request('/api/workbench/files', { method: 'POST', body, key: randomUUID() })).status,
      422
    );
  assert.equal(
    (
      await h.request('/api/workbench/files', {
        method: 'POST',
        body: 'not multipart',
        key: randomUUID()
      })
    ).status,
    415
  );
  const noIdentity = await h.request('/api/workbench/files', {
    method: 'POST',
    headers: { Cookie: '' }
  });
  assert.equal(noIdentity.status, 401);
  const wrongOrigin = await h.request('/api/workbench/files', {
    method: 'POST',
    headers: { Origin: 'http://evil.invalid' }
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await h.upload(Buffer.alloc(0))).status, 422);
  assert.equal((await h.upload(Buffer.alloc(100 * 1024 * 1024 + 1))).status, 413);
  assert.equal(
    h.runtime.workbench.db.prepare('SELECT count(*) AS n FROM materials_files').get().n,
    0
  );
  assert.deepEqual(fs.readdirSync(path.join(h.dir, 'files', 'staging')), []);
});

test('HTTP accepts exactly the schema maximum of 100 MiB', async (t) => {
  const h = await harness(t);
  const result = await h.upload(Buffer.alloc(100 * 1024 * 1024));
  assert.equal(result.status, 201);
  assert.equal(result.body.byteLength, 104857600);
});

test('persistent fixture preserves v1 and rejects an unknown version without overwriting', async (t) => {
  const h = await harness(t);
  const original = {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        runs: [
          { type: 'text', text: '旧稿' },
          { type: 'math', latex: '\\frac{1}{2}' }
        ]
      }
    ]
  };
  const save = (value) =>
    h.request('/fixture/document', {
      method: 'PUT',
      body: JSON.stringify(value),
      key: randomUUID(),
      headers: { 'Content-Type': 'application/json' }
    });
  assert.equal((await save(original)).status, 200);
  assert.equal((await save({ version: 99, blocks: [] })).status, 422);
  await h.restart();
  assert.deepEqual((await h.request('/fixture/document')).body, original);
  assert.throws(
    () => validateSchema('Document', { version: 2, blocks: [{ type: 'math', latex: '' }] }),
    (error) => error.problem.field === '/blocks/0/latex' && error.problem.reason === 'empty-content'
  );
});
