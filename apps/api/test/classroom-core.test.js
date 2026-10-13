import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { C, createClassroomWorld, teacher, studentBody } from './classroom-http-fixture.js';
test('classroom real identity: roster, records, seats, account isolation and optimistic atomic writes', async () => {
  const world = await createClassroomWorld();
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
  } finally {
    await world.close();
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
  } finally {
    await world.close();
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  }
});
