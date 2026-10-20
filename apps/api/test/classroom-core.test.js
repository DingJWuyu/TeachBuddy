import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { C, createClassroomWorld, teacher, studentBody } from './classroom-http-fixture.js';
test('classroom real identity: roster, records, seats, account isolation and optimistic atomic writes', async () => {
  const world = await createClassroomWorld();
  let passed = false;
  try {
    const a = await teacher(world),
      b = await teacher(world, 'classroom-b@example.test');
    const key = randomUUID(),
      cls = await a.call('POST', C + '/classes', {
        name: '高一一班'
      }, 201, key);
    assert.deepEqual(await a.call('POST', C + '/classes', {
      name: '高一一班'
    }, 201, key), cls);
    await b.call('GET', C + '/classes/' + cls.id, undefined, 404);
    await a.call('GET', C + '/classes/' + cls.id, undefined, 401, randomUUID(), {
      page: null
    });
    await a.call('POST', C + '/classes', {
      name: '拒绝'
    }, 403, randomUUID(), {
      origin: 'https://evil.invalid'
    });
    const s1 = await a.call('POST', C + '/students', studentBody(cls.id, '同名', '001'), 201),
      s2 = await a.call('POST', C + '/students', studentBody(cls.id, '同名', '002'), 201);
    await a.call('POST', C + '/students', studentBody(cls.id, '重复号', '001'), 409);
    const record = await a.call('POST', C + '/records', {
      scope: 'student',
      subjectId: s1.id,
      occurredOn: '2026-01-02',
      text: '约定下周交流'
    }, 201);
    const seated = await a.call('PUT', C + '/classes/' + cls.id + '/seating', {
      baseVersion: cls.version,
      seating: {
        rows: 6,
        columns: 8,
        seats: [{
          row: 1,
          column: 1,
          studentId: s1.id
        }, {
          row: 1,
          column: 2,
          studentId: s2.id
        }]
      }
    });
    await a.call('PUT', C + '/classes/' + cls.id + '/seating', {
      baseVersion: cls.version,
      seating: {
        rows: 6,
        columns: 8,
        seats: []
      }
    }, 409);
    await a.call('PUT', C + '/classes/' + cls.id + '/seating', {
      baseVersion: seated.version,
      seating: {
        rows: 6,
        columns: 8,
        seats: [{
          row: 1,
          column: 1,
          studentId: s1.id
        }, {
          row: 1,
          column: 1,
          studentId: s2.id
        }]
      }
    }, 422);
    const target = await a.call('POST', C + '/classes', {
      name: '高一二班'
    }, 201);
    const moved = await a.call('PUT', C + '/students/' + s1.id, {
      ...studentBody(target.id, '新名', '001'),
      baseVersion: s1.version
    });
    assert.equal(moved.id, s1.id);
    assert.equal((await a.call('GET', C + '/classes/' + cls.id)).seating.seats.length, 1);
    assert.equal((await a.call('GET', C + '/records/' + record.id)).subjectId, s1.id);
    const deleted = await a.call('PUT', C + '/students/' + s2.id + '/deletion', {
      baseVersion: s2.version,
      deleted: true
    });
    await a.call('PUT', C + '/students/' + s2.id + '/deletion', {
      baseVersion: deleted.version,
      deleted: false
    });
    assert.equal((await a.call('GET', C + '/classes/' + cls.id)).seating.seats.length, 0);
    await a.call('PUT', C + '/classes/' + cls.id + '/deletion', {
      baseVersion: (await a.call('GET', C + '/classes/' + cls.id)).version,
      deleted: true
    });
    await a.call('GET', C + '/students?classId=' + cls.id, undefined, 409);
    assert.equal((await a.call('GET', C + '/students/' + s2.id)).deletedAt, null);
    await a.call('GET', C + '/classes?unexpected=1', undefined, 422);
    const before = world.workbench.db.prepare('SELECT COUNT(*) n FROM classroom_classes').get().n;
    world.workbench.db.exec("CREATE TRIGGER classroom_fail_insert BEFORE INSERT ON classroom_classes BEGIN SELECT RAISE(ABORT,'fail'); END");
    const failedKey = randomUUID();
    await a.call('POST', C + '/classes', {
      name: '回滚'
    }, 503, failedKey);
    assert.equal(world.workbench.db.prepare('SELECT COUNT(*) n FROM classroom_classes').get().n, before);
    world.workbench.db.exec('DROP TRIGGER classroom_fail_insert');
    await a.call('POST', C + '/classes', {
      name: '回滚'
    }, 201, failedKey);
    passed = true;
  } finally {
    await world.close(passed);
  }
});
test('classroom SQLite restart preserves IDs, versions and confirmed request receipts', async () => {
  const {
    createIntegration
  } = await import('./fixtures/auth-integration/harness.js');
  const {
    call
  } = await import('./classroom-http-fixture.js');
  const fs = await import('node:fs');
  let world = await createIntegration();
  const directory = world.directory;
  let passed = false;
  try {
    const a = await teacher(world, 'restart-classroom@example.test');
    const key = randomUUID();
    const body = {
      name: '重启保留'
    };
    const cls = await a.call('POST', C + '/classes', body, 201, key);
    await world.close();
    world = await createIntegration({
      directory
    });
    const client = world.client();
    await client.request('POST', '/api/auth/session', {
      body: {
        action: 'bootstrap'
      }
    });
    const login = await client.request('POST', '/api/auth/login', {
      body: {
        email: 'restart-classroom@example.test',
        password: 'password-classroom',
        rememberMe: true
      }
    });
    assert.equal(login.status, 200, login.text);
    const activation = await client.request('POST', '/api/auth/session', {
      body: {
        action: 'activate',
        sessionId: login.json.id,
        rememberMe: true
      }
    });
    assert.equal(activation.status, 200, activation.text);
    const request = call(client);
    assert.deepEqual(await request('GET', C + '/classes/' + cls.id), cls);
    assert.deepEqual(await request('POST', C + '/classes', body, 201, key), cls);
    passed = true;
  } finally {
    await world.close(passed);
    if (passed) {
      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    } else {
      console.error('Classroom restart failure evidence retained at ' + directory);
    }
  }
});

test('classroom archive: account lists include deleted children of deleted subjects', async () => {
  const world = await createClassroomWorld();
  let passed = false;
  try {
    const a = await teacher(world), b = await teacher(world, 'archive-other@example.test');
    const cls = await a.call('POST', C + '/classes', { name: '归档父班级' }, 201);
    const student = await a.call('POST', C + '/students', studentBody(cls.id), 201);
    const activeStudent = await a.call('POST', C + '/students', studentBody(cls.id, '活动学生'), 201);
    const records = [];
    for (const [scope, subjectId] of [['class', cls.id], ['student', student.id], ['student', activeStudent.id]]) {
      const record = await a.call('POST', C + '/records', { scope, subjectId, occurredOn: '2026-01-02', text: scope + '归档记录' }, 201);
      records.push(await a.call('PUT', C + '/records/' + record.id + '/deletion', { baseVersion: record.version, deleted: true }));
    }
    const deletedStudent = await a.call('PUT', C + '/students/' + student.id + '/deletion', { baseVersion: student.version, deleted: true });
    const currentClass = await a.call('GET', C + '/classes/' + cls.id);
    const deletedClass = await a.call('PUT', C + '/classes/' + cls.id + '/deletion', { baseVersion: currentClass.version, deleted: true });
    assert.deepEqual((await a.call('GET', C + '/students?deleted=deleted')).items.map(s => s.id), [student.id]);
    assert.deepEqual(new Set((await a.call('GET', C + '/records?deleted=deleted')).items.map(r => r.id)), new Set(records.map(r => r.id)));
    assert.equal((await a.call('GET', C + '/students?deleted=deleted&classId=' + cls.id)).items[0].id, student.id);
    assert.equal((await a.call('GET', C + '/records?deleted=deleted&scope=student&subjectId=' + student.id)).items[0].id, records[1].id);
    assert.deepEqual((await b.call('GET', C + '/students?deleted=deleted')).items, []);
    assert.deepEqual((await b.call('GET', C + '/records?deleted=deleted')).items, []);
    await b.call('GET', C + '/students?deleted=deleted&classId=' + cls.id, undefined, 404);
    await b.call('GET', C + '/records?deleted=deleted&scope=student&subjectId=' + student.id, undefined, 404);
    await a.call('GET', C + '/records?deleted=deleted&scope=student', undefined, 422);
    for (const [kind, item] of [['students', deletedStudent], ...records.map(record => ['records', record])]) {
      const rejection = await a.call('PUT', C + '/' + kind + '/' + item.id + '/deletion', { baseVersion: item.version, deleted: false }, 409);
      assert.equal(rejection.type, '/problems/workbench/classroom-restore-class-required');
      assert.ok((await a.call('GET', C + '/' + kind + '/' + item.id)).deletedAt);
    }
    await a.call('PUT', C + '/classes/' + cls.id + '/deletion', { baseVersion: deletedClass.version, deleted: false });
    assert.ok((await a.call('GET', C + '/students/' + student.id)).deletedAt);
    const blockedRecord = await a.call('PUT', C + '/records/' + records[1].id + '/deletion', { baseVersion: records[1].version, deleted: false }, 409);
    assert.equal(blockedRecord.type, '/problems/workbench/classroom-restore-student-required');
    await a.call('PUT', C + '/students/' + student.id + '/deletion', { baseVersion: deletedStudent.version, deleted: false });
    for (const record of records) {
      assert.ok((await a.call('GET', C + '/records/' + record.id)).deletedAt);
      const restored = await a.call('PUT', C + '/records/' + record.id + '/deletion', { baseVersion: record.version, deleted: false });
      assert.equal(restored.deletedAt, null);
    }
    await a.call('GET', C + '/students', undefined, 422);
    await a.call('GET', C + '/records', undefined, 422);
    passed = true;
  } finally { await world.close(passed); }
});
