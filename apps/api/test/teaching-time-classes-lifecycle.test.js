import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { createIntegration } from './fixtures/auth-integration/harness.js';
import { registerMath } from '../../web/e2e/fixtures/math-static/real.mjs';
import { backup, restore } from '../src/workbench/reliability/backup.js';
import { C, R, Q, question, http, record } from './teaching-time-classes-materials-fixture.js';

test('class purge enforces ownership, archive and version; removes records atomically and preserves existing links and backups', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classes-lifecycle-'));
  const data = path.join(directory, 'data');
  fs.mkdirSync(data);
  let world = await createIntegration({ directory: data });
  let passed = false;
  try {
    const { client } = await registerMath(world, 'class-purge@example.test');
    const { client: foreign } = await registerMath(world, 'other-purge@example.test');
    const call = http(client), other = http(foreign);
    const classroom = await call('POST', C, { name: '待归档班级' }, 201);
    const kept = await call('POST', C, { name: '仍在使用的班级' }, 201);
    const questionItem = await call('POST', Q, question('保留题目'), 201);
    const saved = await call('POST', R, record(classroom.id, [{ kind: 'question', id: questionItem.id }], '需要彻底删除的课堂原文'), 201);
    const removed = await call('POST', R, record(classroom.id, [], '已删除记录也要清理'), 201);
    await call('POST', `${R}/${removed.id}/deletion`, { expectedVersion: removed.version, deleted: true });
    const keptRecord = await call('POST', R, record(kept.id, [], '其他班级保留'), 201);
    const entryBody = { title: '已有课程', items: [], time: { date: '2026-09-25', startTime: '09:00', durationMinutes: 60, timeZone: 'Asia/Shanghai' },
      repeat: null, course: { classId: classroom.id, recordIds: [saved.id] }, reminder: null };
    const entry = await call('POST', '/api/modules/schedule/entries', entryBody, 201);
    const endpoint = `${C}/${classroom.id}/purge`;
    await other('POST', endpoint, { expectedVersion: classroom.version }, 404);
    const rejected = await call('POST', endpoint, { expectedVersion: classroom.version }, 422);
    assert.equal(rejected.reason, 'invalid-reference');
    const archived = await call('POST', `${C}/${classroom.id}/deletion`, { expectedVersion: classroom.version, deleted: true });
    await call('POST', endpoint, { expectedVersion: classroom.version }, 409);
    await call('POST', endpoint, { expectedVersion: archived.version, extra: true }, 422);
    const db = world.workbench.db;
    // A storage error after child removal must roll back children and markers.
    db.exec(`CREATE TRIGGER reject_class_purge BEFORE DELETE ON classes_items BEGIN SELECT RAISE(ABORT, 'purge-test'); END`);
    const key = randomUUID();
    await call('POST', endpoint, { expectedVersion: archived.version }, 503, key);
    assert.ok(db.prepare('SELECT 1 FROM classes_records WHERE id=?').get(saved.id));
    assert.ok(db.prepare('SELECT 1 FROM classes_record_sources WHERE recordId=?').get(saved.id));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM classes_removed_objects').get().n, 0);
    db.exec('DROP TRIGGER reject_class_purge');
    const result = await call('POST', endpoint, { expectedVersion: archived.version }, 200, key);
    assert.deepEqual(result, { id: classroom.id, permanentlyDeleted: true });
    assert.deepEqual(await call('POST', endpoint, { expectedVersion: archived.version }, 200, key), result);
    for (const url of [`${C}/${classroom.id}`, `${R}/${saved.id}`, `${R}/${removed.id}`]) await call('GET', url, undefined, 404);
    await call('POST', `${C}/${classroom.id}/deletion`, { expectedVersion: archived.version, deleted: false }, 404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM classes_records WHERE classId=?').get(classroom.id).n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM classes_record_sources WHERE recordId=?').get(saved.id).n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM classes_items WHERE id=?').get(classroom.id).n, 0);
    assert.equal((await call('GET', `${C}/${kept.id}`)).name, kept.name);
    assert.equal((await call('GET', `${R}/${keptRecord.id}`)).note, keptRecord.note);
    assert.equal((await call('GET', `${Q}/${questionItem.id}`)).title, questionItem.title);
    assert.equal((await call('GET', `/api/modules/classes/v2/source-records/question/${questionItem.id}`)).items.length, 0);
    const linked = await call('GET', `/api/modules/schedule/entries/${entry.id}`);
    assert.equal(linked.title, entry.title);
    assert.equal(linked.courseState.classroom.deleted, true);
    assert.equal(linked.courseState.records[0].deleted, true);
    await call('PUT', `/api/modules/schedule/entries/${entry.id}`, { ...entryBody, title: '日程仍可编辑', expectedVersion: entry.version });
    await world.close(); world = null;
    const snapshot = path.join(directory, 'backup');
    await backup({ database: path.join(data, 'workspace.sqlite'), files: path.join(data, 'files'), target: snapshot, stopped: true });
    restore({ source: snapshot, target: path.join(directory, 'restored'), stopped: true });
    world = await createIntegration({ directory: data });
    // Restart must preserve the purge, independently of any browser cache.
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) AS n FROM classes_items WHERE id=?').get(classroom.id).n, 0);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) AS n FROM classes_removed_objects').get().n, 3);
    passed = true;
  } finally {
    await world?.close();
    if (passed) fs.rmSync(directory, { recursive: true });
  }
});
