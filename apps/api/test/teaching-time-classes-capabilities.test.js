import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { ContractError } from '../src/workbench/problems.js';
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';
import { C, R, http, record } from './teaching-time-classes-materials-fixture.js';

async function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classes-capabilities-api-'));
  let passed = false;
  const data = path.join(directory, 'data'); fs.mkdirSync(data);
  const world = await createIntegration({ directory: data });
  t.after(async () => { await world.close(); if (passed) fs.rmSync(directory, { recursive: true }); });
  const { client } = await registerMath(world, 'classes-capabilities-api@example.test');
  const { client: foreign } = await registerMath(world, 'classes-capabilities-other@example.test');
  return { world, directory, client, call: http(client), other: http(foreign), done: () => { passed = true; } };
}

test('record purge is owned, versioned, atomic and replayable; existing schedule references and backup remain readable', async t => {
  const { world, directory, call, other, done } = await setup(t);
  const classroom = await call('POST', C, { name: '一班' }, 201);
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '关联备课', intro: { version: 1, blocks: [] }, sections: [], materials: [] }, 201);
  const saved = await call('POST', R, record(classroom.id, [{ kind: 'lesson', id: lesson.id }], '要移除的原文'), 201);
  const kept = await call('POST', R, record(classroom.id, [], '保留的原文'), 201);
  const body = { title: '既有日程', items: [], time: { date: '2026-09-25', startTime: '09:00', durationMinutes: 60, timeZone: 'Asia/Shanghai' },
    repeat: null, course: { classId: classroom.id, lessonId: lesson.id, recordIds: [saved.id] }, reminder: null };
  const entry = await call('POST', '/api/modules/schedule/entries', body, 201);
  const endpoint = `${R}/${saved.id}/purge`;
  await other('POST', endpoint, { expectedVersion: 1 }, 404);
  await call('POST', endpoint, { expectedVersion: 1 }, 422);
  await call('POST', endpoint, { expectedVersion: 1, extra: true }, 422);
  const deleted = await call('POST', `${R}/${saved.id}/deletion`, { expectedVersion: 1, deleted: true });
  await call('POST', endpoint, { expectedVersion: 1 }, 409);
  const db = world.workbench.db, key = randomUUID();
  db.exec("CREATE TRIGGER stop_record_purge BEFORE DELETE ON classes_records BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  await call('POST', endpoint, { expectedVersion: deleted.version }, 503, key);
  assert.equal(db.prepare('SELECT count(*) n FROM classes_removed_objects WHERE id=?').get(saved.id).n, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM classes_record_sources WHERE recordId=?').get(saved.id).n, 1);
  db.exec('DROP TRIGGER stop_record_purge');
  const removed = await call('POST', endpoint, { expectedVersion: deleted.version }, 200, key);
  assert.deepEqual(await call('POST', endpoint, { expectedVersion: deleted.version }, 200, key), removed);
  await call('GET', `${R}/${saved.id}`, undefined, 404);
  await call('POST', `${R}/${saved.id}/deletion`, { expectedVersion: deleted.version, deleted: false }, 404);
  assert.equal((await call('GET', `${R}/${kept.id}`)).note, kept.note);
  assert.equal((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).title, lesson.title);
  assert.equal(db.prepare('SELECT count(*) n FROM classes_record_sources WHERE recordId=?').get(saved.id).n, 0);
  const linked = await call('GET', `/api/modules/schedule/entries/${entry.id}`);
  assert.equal(linked.courseState.classroom.deleted, false);
  assert.equal(linked.courseState.records[0].deleted, true);
  await call('PUT', `/api/modules/schedule/entries/${entry.id}`, { ...body, expectedVersion: entry.version, title: '日程仍可编辑' });
  const archived = await call('POST', `${C}/${classroom.id}/deletion`, { expectedVersion: 1, deleted: true });
  await call('POST', `${C}/${classroom.id}/purge`, { expectedVersion: archived.version });
  await world.close();
  const snapshot = path.join(directory, 'snapshot');
  await backup({ database: path.join(directory, 'data/workspace.sqlite'), files: path.join(directory, 'data/files'), target: snapshot, stopped: true });
  restore({ source: snapshot, target: path.join(directory, 'restored'), stopped: true });
  done();
});

test('next-note visibility preserves text, protects versions and ownership, persists across requests, and resets only when that thought changes', async t => {
  const { world, call, other, done } = await setup(t);
  const classroom = await call('POST', C, { name: '一班' }, 201);
  const input = { ...record(classroom.id), nextNote: '先复习定义', position: '例题3' };
  let saved = await call('POST', R, input, 201);
  const endpoint = `${R}/${saved.id}/next-note-visibility`;
  await other('POST', endpoint, { expectedVersion: saved.version, hidden: true }, 404);
  await call('POST', endpoint, { expectedVersion: saved.version, hidden: 'true' }, 422);
  saved = await call('POST', endpoint, { expectedVersion: saved.version, hidden: true });
  assert.equal(saved.nextNoteHidden, true); assert.equal(saved.nextNote, input.nextNote);
  await call('POST', endpoint, { expectedVersion: 1, hidden: false }, 409);
  saved = await call('PUT', `${R}/${saved.id}`, { ...input, expectedVersion: saved.version, note: '只改课堂文字' });
  assert.equal(saved.nextNoteHidden, true);
  saved = await call('PUT', `${R}/${saved.id}`, { ...input, expectedVersion: saved.version, nextNote: '先讲反例' });
  assert.equal(saved.nextNoteHidden, false);
  assert.equal((await call('GET', `${R}/${saved.id}`)).nextNote, '先讲反例');
  const overview = await call('GET', '/api/modules/classes/overview');
  assert.deepEqual(overview.items[0].position, { recordedOn: input.recordedOn, text: '例题3' });
  assert.deepEqual((await other('GET', '/api/modules/classes/overview')).items, []);
  const port = world.workbench.loader.get('lessons').port;
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '故障资料', intro: { version: 1, blocks: [] }, sections: [], materials: [] }, 201);
  const linked = await call('POST', R, record(classroom.id, [{ kind: 'lesson', id: lesson.id }]), 201);
  const original = port.readForTeachingLink;
  for (const status of [404, 503]) {
    port.readForTeachingLink = () => { throw Object.assign(new Error('isolated fault'), { status }); };
    const read = await call('GET', `${R}/${linked.id}`);
    assert.equal(read.sources[0].deleted, null);
    assert.equal(read.sources[0].currentLabel, '故障资料');
    assert.equal((await call('GET', '/api/modules/classes/overview')).items[0].count, 2);
  }
  port.readForTeachingLink = () => { throw new ContractError(401, { type: '/problems/workbench/unauthenticated' }); };
  await call('GET', `${R}/${linked.id}`, undefined, 401);
  port.readForTeachingLink = original;
  done();
});

async function imageFile(client) {
  const boundary = 'class-image-' + randomUUID();
  const bytes = fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/figure.png', import.meta.url));
  const response = await client.request('POST', '/api/workbench/files', {
    headers: { 'Idempotency-Key': randomUUID() }, contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="class.png"\r\nContent-Type: image/png\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)])
  });
  assert.equal(response.status, 201); return response.json;
}

test('structured class content reuses owned files, preserves old fields and receipts, and survives backup with image bytes', async t => {
  const { world, directory, client, call, other, done } = await setup(t);
  const c = await call('POST', C, { name: '图片与公式' }, 201);
  const file = await imageFile(client);
  const content = { version: 2, blocks: [{ type: 'math', latex: '\\frac{1}{2}' }, { type: 'image', fileId: file.id, alt: '课堂板书', widthMm: 100 }] };
  const body = { ...record(c.id, [], ''), content };
  let r = await call('POST', R, body, 201);
  assert.deepEqual(r.content, content);
  assert.equal((await call('GET', '/api/modules/classes/overview')).items[0].latest.text, '\\frac{1}{2}\n课堂板书');
  // Older v2 callers omitting content retain it; v1 cannot silently drop it.
  r = await call('PUT', `${R}/${r.id}`, { ...record(c.id, [], '文字仍按原样 $5 保存'), expectedVersion: r.version });
  assert.deepEqual(r.content, content);
  await call('GET', `/api/modules/classes/records/${r.id}`, undefined, 422);
  await call('POST', R, { ...body, content: { version: 99, blocks: [] } }, 422);
  await call('POST', R, { ...body, content: { ...content, extra: true } }, 422);
  const foreignClass = await other('POST', C, { name: '另一账户' }, 201);
  await other('POST', R, { ...body, classId: foreignClass.id }, 404);
  const badFile = { ...body, content: { version: 2, blocks: [{ type: 'image', fileId: randomUUID(), alt: '', widthMm: 100 }] } };
  await call('POST', R, badFile, 404);
  const imageOnly = await call('POST', R, { ...body, content: { version: 2, blocks: [content.blocks[1]] } }, 201);
  assert.equal(imageOnly.note, '');
  const key = randomUUID();
  const legacy = await call('POST', '/api/modules/classes/records', record(c.id), 201, key);
  await call('PUT', `${R}/${legacy.id}`, { ...body, expectedVersion: 1 });
  assert.deepEqual(await call('POST', '/api/modules/classes/records', record(c.id), 201, key), legacy);
  await world.close();
  const snapshot = path.join(directory, 'snapshot');
  await backup({ database: path.join(directory, 'data/workspace.sqlite'), files: path.join(directory, 'data/files'), target: snapshot, stopped: true });
  restore({ source: snapshot, target: path.join(directory, 'restored'), stopped: true });
  activate({ target: path.join(directory, 'restored'), stopped: true });
  const restored = await createIntegration({ directory: path.join(directory, 'restored') });
  try {
    assert.deepEqual(JSON.parse(restored.workbench.db.prepare('SELECT content FROM classes_records WHERE id=?').get(r.id).content), content);
    assert.equal(restored.workbench.db.prepare('SELECT count(*) n FROM materials_files').get().n, 1);
  } finally { await restored.close(); }
  done();
});

test('cross-class transfer is atomic, owned and replayable, preserving original schedule history and retained links', async t => {
  const { world, call, other, done } = await setup(t);
  const source = await call('POST', C, { name: '原班级' }, 201);
  const target = await call('POST', C, { name: '目标班级' }, 201);
  const foreign = await other('POST', C, { name: '外账户班级' }, 201);
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '原资料标题', intro: { version: 1, blocks: [] }, sections: [], materials: [] }, 201);
  const input = { ...record(source.id, [{ kind: 'lesson', id: lesson.id }]), content: { version: 2, blocks: [{ type: 'math', latex: 'x^2' }] }, nextNote: '留在历史中的想法' };
  let r = await call('POST', R, input, 201);
  r = await call('POST', `${R}/${r.id}/next-note-visibility`, { expectedVersion: r.version, hidden: true });
  const schedule = { title: '原班级的课堂', items: [], time: { date: '2026-09-25', startTime: '09:00', durationMinutes: 60, timeZone: 'Asia/Shanghai' }, repeat: null,
    course: { classId: source.id, lessonId: lesson.id, recordIds: [r.id] }, reminder: null };
  const entry = await call('POST', '/api/modules/schedule/entries', schedule, 201);
  const endpoint = `${R}/${r.id}/move`, body = { expectedVersion: r.version, targetClassId: target.id };
  await other('POST', endpoint, body, 404);
  await call('POST', endpoint, { ...body, targetClassId: foreign.id }, 404);
  await call('POST', endpoint, { ...body, targetClassId: source.id }, 422);
  await call('POST', endpoint, { ...body, expectedVersion: 1 }, 409);
  const archived = await call('POST', `${C}/${target.id}/deletion`, { expectedVersion: target.version, deleted: true });
  await call('POST', endpoint, body, 409);
  await call('POST', `${C}/${target.id}/deletion`, { expectedVersion: archived.version, deleted: false });
  const db = world.workbench.db, key = randomUUID();
  db.exec("CREATE TRIGGER stop_transfer BEFORE UPDATE ON classes_records BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  await call('POST', endpoint, body, 503, key);
  assert.equal((await call('GET', `${R}?classId=${target.id}`)).items.length, 0);
  assert.equal((await call('GET', `${R}/${r.id}`)).deletedAt, null);
  db.exec('DROP TRIGGER stop_transfer');
  const moved = await call('POST', endpoint, body, 200, key);
  assert.deepEqual(await call('POST', endpoint, body, 200, key), moved);
  assert.notEqual(moved.record.id, r.id);
  assert.equal(moved.record.classId, target.id);
  assert.equal(moved.record.recordedOn, r.recordedOn);
  assert.equal(moved.record.nextNoteHidden, true);
  assert.deepEqual(moved.record.content, r.content);
  assert.equal(moved.record.sources[0].labelAtLink, '原资料标题');
  assert.equal((await call('GET', `${R}?classId=${source.id}`)).items.length, 0);
  const original = await call('GET', `${R}/${r.id}`);
  assert.equal(original.classId, source.id); assert.ok(original.deletedAt);
  const linked = await call('GET', `/api/modules/schedule/entries/${entry.id}`);
  assert.equal(linked.courseState.records[0].deleted, true);
  assert.equal(linked.course.classId, source.id);
  await call('PUT', `/api/modules/schedule/entries/${entry.id}`, { ...schedule, expectedVersion: entry.version, title: '原日程仍可编辑' });
  await call('POST', `${R}/${r.id}/deletion`, { expectedVersion: original.version, deleted: false });
  assert.equal((await call('GET', `${R}?classId=${source.id}`)).items.length, 1);
  assert.equal((await call('GET', `${R}?classId=${target.id}`)).items.length, 1);
  done();
});
