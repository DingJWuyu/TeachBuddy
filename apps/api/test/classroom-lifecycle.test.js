import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import sharp from 'sharp';
import JSZip from 'jszip';
import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';
import { manualQuestionSample } from './first-flow-harness.js';

const kinds = ['classes', 'students', 'records', 'exams', 'results', 'imports', 'tags'];
const base = '/api/modules/classroom';
const password = 'Classroom-lifecycle-123';
async function register(world, email) {
  const client = world.client();
  await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
  const code = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
  assert.equal(code.status, 200, code.text);
  const result = await client.request('POST', '/api/auth/register', { body: {
    email, nickname: '班级资料教师', password, termsAccepted: true, rememberMe: true,
    challengeId: code.json.challengeId, verificationCode: world.mailer.lastCode('registration', email),
  } });
  assert.equal(result.status, 201, result.text);
  assert.equal((await client.request('POST', '/api/auth/session', { body: {
    action: 'activate', sessionId: result.json.id, rememberMe: true,
  } })).status, 200);
  return { client, session: result.json, principal: { accountKey: result.json.account.accountKey } };
}
async function write(client, method, route, body, status = method === 'POST' ? 201 : 200, key = randomUUID()) {
  const response = await client.request(method, route, { body, headers: { 'Idempotency-Key': key } });
  assert.equal(response.status, status, response.text);
  return response.json;
}
async function seed(world, owner) {
  const { client, principal } = owner;
  const cls = await write(client, 'POST', `${base}/classes`, { name: '生命周期班级' });
  const student = await write(client, 'POST', `${base}/students`, {
    classId: cls.id, name: '测试学生', studentNumber: '001', birthday: null, interests: '数学', description: '<script>保留原文</script>',
  });
  const record = await write(client, 'POST', `${base}/records`, { scope: 'student', subjectId: student.id, occurredOn: '2026-09-01', text: '独立教学记录' });
  const tag = await write(client, 'POST', `${base}/tags`, { name: '函数' });
  const source = await world.workbench.files.store(principal, {
    name: '原卷.png', bytes: await sharp({ create: { width: 80, height: 80, channels: 3, background: '#ffffff' } }).png().toBuffer(),
  }, { key: randomUUID(), method: 'POST', path: '/api/workbench/files' });
  const preview = await world.workbench.files.ensurePreview(principal, source.id);
  assert.equal(preview.state, 'ready');
  const exam = await write(client, 'POST', `${base}/exams`, {
    name: '九月考试', subject: '数学', occurredOn: '2026-09-01', totalMax: 10,
    source: [{ fileId: source.id, renditionFileId: preview.renditionFileId }],
    questions: [{ label: '1', groupLabel: null, maxScore: 5, tagIds: [tag.id], locations: [{
      fileId: source.id, renditionFileId: preview.renditionFileId, page: 1, box: { x: 0, y: 0, width: 1, height: 1 },
    }] }, { label: '2', groupLabel: null, maxScore: 5, tagIds: [tag.id], locations: [] }],
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['学号', '姓名', '总分', '1', '2'], ['001', '测试学生', 0, 0, null]]), '成绩');
  const spreadsheet = await world.workbench.files.store(principal, {
    name: '成绩.xlsx', bytes: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }),
  }, { key: randomUUID(), method: 'POST', path: '/api/workbench/files' });
  const imp = await write(client, 'POST', `${base}/imports`, { examId: exam.id, classId: cls.id, sourceFileId: spreadsheet.id });
  const reviewed = await write(client, 'PUT', `${base}/imports/${imp.id}`, {
    baseVersion: imp.version, mapping: { sheetIndex: 0, headerRow: 1, firstDataRow: 2, lastDataRow: 2,
      nameColumn: 2, studentNumberColumn: 1, totalColumn: 3, attendanceColumn: null,
      questionColumns: [{ column: 4, questionId: exam.questions[0].id }, { column: 5, questionId: exam.questions[1].id }], ignoredRows: [] }, rows: null,
  });
  const confirmed = await write(client, 'POST', `${base}/imports/${imp.id}/confirmation`, { baseVersion: reviewed.version }, 200);
  const deletedRecord = await write(client, 'PUT', `${base}/records/${record.id}/deletion`, { baseVersion: record.version, deleted: true });
  return { cls, student, record: deletedRecord, tag, source, preview, spreadsheet, exam, result: confirmed.result, import: confirmed.import };
}
function state(db, accountKey) {
  return Object.fromEntries(kinds.map(kind => [kind, db.prepare(`SELECT * FROM classroom_${kind} WHERE accountKey=? ORDER BY id`).all(accountKey)]));
}
async function exportZip(world, client) {
  const accepted = await write(client, 'POST', '/api/reliability/v1/exports', {}, 202);
  let record;
  for (let count = 0; count < 200; count++) {
    const response = await client.request('GET', `/api/reliability/v1/exports/${accepted.id}`);
    assert.equal(response.status, 200, response.text);
    record = response.json;
    if (!['queued', 'running'].includes(record.state)) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(record.state, 'ready', JSON.stringify(record));
  assert.equal((await client.request('GET', record.downloadPath)).status, 200);
  return JSZip.loadAsync(fs.readFileSync(path.join(world.directory, 'personal-exports', `${record.id}.zip`)));
}

test('real classroom personal files, backup restore and account deletion preserve all owned facts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'classroom-lifecycle-'));
  const directory = path.join(root, 'source');
  fs.mkdirSync(directory);
  let world = await createIntegration({ directory });
  let passed = false;
  try {
    const a = await register(world, 'classroom-a@example.test'), b = await register(world, 'classroom-b@example.test');
    const facts = await seed(world, a), other = await seed(world, b);
    const oldQuestion = await write(b.client, 'POST', '/api/modules/questions/items', manualQuestionSample());
    const catalog = await a.client.request('GET', '/api/modules');
    assert.equal(catalog.json.version, 4);
    assert.equal(catalog.json.items.find(item => item.id === 'classroom').webEnabled, true);
    assert.equal((await b.client.request('GET', `${base}/exams/${facts.exam.id}`)).status, 404);
    const zip = await exportZip(world, a.client);
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    if (process.env.CLASSROOM_LIFECYCLE_EVIDENCE) {
      fs.mkdirSync(process.env.CLASSROOM_LIFECYCLE_EVIDENCE, { recursive: true });
      fs.writeFileSync(path.join(process.env.CLASSROOM_LIFECYCLE_EVIDENCE, 'personal.zip'), await zip.generateAsync({ type: 'nodebuffer' }));
    }
    const classroomObjects = manifest.objects.filter(object => object.key.kind.startsWith('classroom-'));
    assert.equal(classroomObjects.length, 7);
    assert.deepEqual(classroomObjects.map(object => object.key.kind).sort(), ['classroom-class', 'classroom-student', 'classroom-record', 'classroom-exam', 'classroom-result', 'classroom-import', 'classroom-tag'].sort());
    assert.equal(classroomObjects.find(object => object.key.kind === 'classroom-record').state, 'deleted');
    for (const object of classroomObjects) {
      const data = await zip.file(object.dataPath).async('string');
      assert(!data.includes(a.principal.accountKey));
      assert(!data.includes(b.principal.accountKey));
      const html = await zip.file(object.readablePath).async('string');
      assert(html.includes('<!doctype html>'));
      const visible = html.split('<details>')[0];
      if (object.key.kind === 'classroom-student') {
        assert(visible.includes('测试学生')); assert(visible.includes('生日')); assert(visible.includes('数学'));
        assert(visible.includes('&lt;script&gt;保留原文&lt;/script&gt;'));
      }
      if (object.key.kind === 'classroom-record') assert(visible.includes('独立教学记录'));
      if (object.key.kind === 'classroom-exam') { assert(visible.includes('九月考试')); assert(visible.includes('满分')); }
      if (object.key.kind === 'classroom-result') {
        assert(visible.includes('测试学生')); assert(visible.includes('<td>0</td>')); assert(visible.includes('<td>缺分</td>'));
        assert(visible.includes('1（满分 5）')); assert(visible.includes('2（满分 5）'));
      }
    }
    for (const relation of ['class-student', 'record-subject', 'exam-source', 'exam-tag', 'result-exam', 'result-class', 'result-student', 'import-file', 'import-exam', 'import-class', 'import-result'])
      assert(manifest.relations.some(item => item.relation === relation), relation);
    assert(manifest.relations.some(item => item.from.id === facts.preview.renditionFileId && item.to.id === facts.preview.pages[0].imageFileId));
    const spreadsheetEntry = manifest.files.find(item => item.path.startsWith(`files/${facts.spreadsheet.id}/`));
    assert.equal(createHash('sha256').update(await zip.file(spreadsheetEntry.path).async('nodebuffer')).digest('hex'), facts.spreadsheet.sha256);
    const before = state(world.workbench.db, a.principal.accountKey);
    const foreign = state(world.workbench.db, b.principal.accountKey);
    const originalJar = a.client.jar;
    await world.close(); world = null;
    const target = path.join(root, 'backup'), restored = path.join(root, 'restored');
    await backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target, stopped: true });
    // Corrupt independently owned relations in the stopped source. The verified
    // backup remains intact, and none of these sources may produce a backup.
    const corrupt = new Database(path.join(directory, 'workspace.sqlite'));
    try {
      const original = JSON.stringify(facts.exam);
      for (const [label, value] of [
        ['foreign-file', { ...facts.exam, source: [{ fileId: other.source.id, renditionFileId: null }], questions: facts.exam.questions.map(q => ({ ...q, locations: [] })) }],
        ['foreign-tag', { ...facts.exam, questions: facts.exam.questions.map(q => ({ ...q, tagIds: [other.tag.id] })) }],
        ['foreign-rendition', { ...facts.exam, source: [{ fileId: facts.source.id, renditionFileId: other.preview.renditionFileId }], questions: facts.exam.questions.map(q => ({ ...q, locations: [] })) }],
      ]) {
        corrupt.prepare('UPDATE classroom_exams SET value=? WHERE accountKey=? AND id=?').run(JSON.stringify(value), a.principal.accountKey, facts.exam.id);
        await assert.rejects(backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target: path.join(root, label), stopped: true }), /classroom|file|rendition/);
        assert.equal(fs.existsSync(path.join(root, label)), false);
      }
      corrupt.prepare('UPDATE classroom_exams SET value=? WHERE accountKey=? AND id=?').run(original, a.principal.accountKey, facts.exam.id);
    } finally { corrupt.close(); }
    restore({ source: target, target: restored, stopped: true });
    activate({ target: restored, stopped: true });
    world = await createIntegration({ directory: restored });
    assert.deepEqual(state(world.workbench.db, a.principal.accountKey), before);
    assert.deepEqual(state(world.workbench.db, b.principal.accountKey), foreign);
    const stale = world.client(); stale.jar = originalJar;
    assert.equal((await stale.request('GET', `${base}/classes/${facts.cls.id}`)).status, 401);
    const client = world.client();
    await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    const login = await client.request('POST', '/api/auth/login', { body: { email: a.session.account.email, password, rememberMe: true } });
    assert.equal(login.status, 200, login.text);
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: login.json.id, rememberMe: true } })).status, 200);
    assert.deepEqual((await client.request('GET', `${base}/results/${facts.result.id}`)).json, facts.result);
    assert.equal((await client.request('GET', `/api/workbench/files/${facts.spreadsheet.id}/content`)).status, 200);
    const deleted = await client.request('POST', '/api/auth/account-deletion', { body: {
      requestId: randomBytes(32).toString('hex'), sessionId: login.json.id, email: a.session.account.email,
    } });
    assert.equal(deleted.status, 204, deleted.text);
    assert(kinds.every(kind => state(world.workbench.db, a.principal.accountKey)[kind].length === 0));
    assert.equal(world.workbench.db.prepare('SELECT count(*) n FROM materials_files WHERE accountKey=?').get(a.principal.accountKey).n, 0);
    assert.deepEqual(state(world.workbench.db, b.principal.accountKey), foreign);
    assert(world.workbench.db.prepare('SELECT id FROM question_items WHERE id=?').get(oldQuestion.id));
    assert.equal(world.workbench.files.read(b.principal, other.source.id).id, other.source.id);
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(root, { recursive: true, force: true });
    else console.error(`Classroom lifecycle evidence retained at ${root}`);
  }
});

test('fixed historical deployment backup restores retained modules and adds empty classroom storage', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'classroom-old-backup-'));
  let passed = false;
  try {
    const fixture = new URL('./fixtures/retirement/', import.meta.url);
    const bytes = fs.readFileSync(new URL('pre-retirement-backup.zip', fixture));
    const metadata = JSON.parse(fs.readFileSync(new URL('metadata.json', fixture)));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.backupSha256);
    const source = path.join(root, 'backup');
    const zip = await JSZip.loadAsync(bytes);
    for (const [name, item] of Object.entries(zip.files)) if (!item.dir) {
      const target = path.join(source, name); fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await item.async('nodebuffer'));
    }
    const old = new Database(path.join(source, 'workspace.sqlite'), { readonly: true });
    const accounts = old.prepare('SELECT * FROM auth_accounts ORDER BY id').all();
    const questions = old.prepare('SELECT * FROM question_items ORDER BY id').all();
    old.close();
    const target = path.join(root, 'restored');
    restore({ source, target, stopped: true });
    const db = new Database(path.join(target, 'workspace.sqlite'), { readonly: true });
    try {
      assert.deepEqual(db.prepare('SELECT * FROM auth_accounts ORDER BY id').all(), accounts);
      assert.deepEqual(db.prepare('SELECT * FROM question_items ORDER BY id').all(), questions);
      for (const kind of kinds) assert.equal(db.prepare(`SELECT count(*) n FROM classroom_${kind}`).get().n, 0);
      assert(db.prepare("SELECT id FROM workbench_migrations WHERE moduleId='classroom'").get());
      assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name GLOB 'classes_*'").all().length, 0);
    } finally { db.close(); }
    passed = true;
  } finally {
    if (passed) fs.rmSync(root, { recursive: true, force: true });
    else console.error(`Historical backup evidence retained at ${root}`);
  }
});

test('foreign fixed page images reject real exam writes, stopped backup and checksum-valid damaged restore', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'classroom-fixed-page-'));
  const directory = path.join(root, 'source');
  fs.mkdirSync(directory);
  let world = await createIntegration({ directory });
  let passed = false;
  try {
    const a = await register(world, 'fixed-page-a@example.test'), b = await register(world, 'fixed-page-b@example.test');
    const facts = await seed(world, a), other = await seed(world, b);
    const key = [facts.source.id, facts.preview.renditionFileId, a.principal.accountKey];
    const select = 'SELECT value FROM materials_renditions WHERE fileId=? AND renditionId=? AND accountKey=?';
    const update = 'UPDATE materials_renditions SET value=? WHERE fileId=? AND renditionId=? AND accountKey=?';
    const original = world.workbench.db.prepare(select).get(...key).value;
    const damaged = JSON.parse(original);
    damaged.pages[0].imageFileId = other.preview.pages[0].imageFileId;
    const foreignValue = JSON.stringify(damaged);
    const countBefore = world.workbench.db.prepare('SELECT count(*) n FROM classroom_exams WHERE accountKey=?').get(a.principal.accountKey).n;
    const examBefore = world.workbench.db.prepare('SELECT value FROM classroom_exams WHERE accountKey=? AND id=?').get(a.principal.accountKey, facts.exam.id).value;
    const input = Object.fromEntries(['name', 'subject', 'occurredOn', 'totalMax', 'source', 'questions'].map(field => [field, facts.exam[field]]));
    world.workbench.db.prepare(update).run(foreignValue, ...key);
    const createKey = randomUUID(), updateKey = randomUUID();
    const created = await a.client.request('POST', `${base}/exams`, { body: {
      ...input, questions: input.questions.map(({ id, ...question }) => question),
    }, headers: { 'Idempotency-Key': createKey } });
    const edited = await a.client.request('PUT', `${base}/exams/${facts.exam.id}`, { body: {
      ...input, baseVersion: facts.exam.version, name: '不得保存的修改',
    }, headers: { 'Idempotency-Key': updateKey } });
    const countAfter = world.workbench.db.prepare('SELECT count(*) n FROM classroom_exams WHERE accountKey=?').get(a.principal.accountKey).n;
    const examAfter = world.workbench.db.prepare('SELECT value FROM classroom_exams WHERE accountKey=? AND id=?').get(a.principal.accountKey, facts.exam.id).value;
    world.workbench.db.prepare(update).run(original, ...key);
    await world.close(); world = null;
    const database = path.join(directory, 'workspace.sqlite'), files = path.join(directory, 'files');
    const cleanBackup = path.join(root, 'clean-backup');
    await backup({ database, files, target: cleanBackup, stopped: true });
    const sourceDb = new Database(database);
    sourceDb.prepare(update).run(foreignValue, ...key);
    sourceDb.close();
    let backupError;
    try { await backup({ database, files, target: path.join(root, 'rejected-backup'), stopped: true }); }
    catch (error) { backupError = error.message; }
    // Modify the already-created archive and recompute its database checksum.
    // This exercises restore's semantic validation rather than a checksum error.
    const archiveDbPath = path.join(cleanBackup, 'workspace.sqlite');
    const archiveDb = new Database(archiveDbPath);
    archiveDb.prepare(update).run(foreignValue, ...key);
    archiveDb.pragma('wal_checkpoint(TRUNCATE)');
    archiveDb.close();
    const manifestPath = path.join(cleanBackup, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    const bytes = fs.readFileSync(archiveDbPath);
    manifest.database.bytes = bytes.length;
    manifest.database.sha256 = createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    let restoreError;
    const destination = path.join(root, 'rejected-restored');
    try { restore({ source: cleanBackup, target: destination, stopped: true }); }
    catch (error) { restoreError = error.message; }
    const evidence = { createStatus: created.status, updateStatus: edited.status, backupError: backupError ?? null, restoreError: restoreError ?? null };
    console.log('Fixed page ownership result:', JSON.stringify(evidence));
    assert.equal(created.status, 404, created.text);
    assert.deepEqual(created.json, { type: '/problems/workbench/not-found' });
    assert.equal(edited.status, 404, edited.text);
    assert.deepEqual(edited.json, { type: '/problems/workbench/not-found' });
    assert.equal(countAfter, countBefore);
    assert.equal(examAfter, examBefore);
    assert.match(backupError ?? '', /Missing or foreign.*file/i);
    assert.equal(fs.existsSync(path.join(root, 'rejected-backup')), false);
    assert.match(restoreError ?? '', /Missing or foreign.*file/i);
    assert.equal(fs.existsSync(path.join(destination, 'recovery-prepared.json')), false);
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(root, { recursive: true, force: true });
    else console.error(`Fixed page ownership evidence retained at ${root}`);
  }
});
