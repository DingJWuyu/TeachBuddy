import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { ContractError } from '../src/workbench/problems.js';
import { backup, restore } from '../src/workbench/reliability/backup.js';
import { C, R, http, record } from './teaching-time-classes-materials-fixture.js';

async function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classes-capabilities-api-'));
  let passed = false;
  const data = path.join(directory, 'data'); fs.mkdirSync(data);
  const world = await createIntegration({ directory: data });
  t.after(async () => { await world.close(); if (passed) fs.rmSync(directory, { recursive: true }); });
  const { client } = await registerMath(world, 'classes-capabilities-api@example.test');
  const { client: foreign } = await registerMath(world, 'classes-capabilities-other@example.test');
  return { world, directory, call: http(client), other: http(foreign), done: () => { passed = true; } };
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
