import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'refatos-api-'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function createTestContext(options = {}) {
  const rootDir = createTempDir();
  const sqlitePath = path.join(rootDir, 'data', 'refatos.sqlite');
  const uploadDir = path.join(rootDir, 'uploads');
  const exportDir = path.join(rootDir, 'exports');
  const legacyDataFile = path.join(rootDir, 'data', 'store.json');

  if (options.legacyStore) {
    writeJson(legacyDataFile, options.legacyStore);
  }

  const context = createApp({
    env: {
      sqlitePath,
      uploadDir,
      exportDir,
      legacyDataFile
    }
  });

  return {
    ...context,
    rootDir,
    sqlitePath,
    uploadDir,
    exportDir,
    legacyDataFile,
    cleanup() {
      context.dataStore.close();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

async function login(agent, email = 'teacher@example.test', password = 'correct horse battery staple') {
  const response = await agent
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return response.body.token;
}

async function register(agent, email = 'teacher@example.test', password = 'correct horse battery staple') {
  const response = await agent
    .post('/api/auth/register')
    .send({
      name: 'Test Teacher',
      email,
      password,
      passwordConfirmation: password
    })
    .expect(201);

  return response.body.token;
}

function authAgent(app, token) {
  return {
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`)
  };
}

async function assertEmptyWorkspace(app, token) {
  const endpoints = [
    '/api/modules/schedule-organizer',
    '/api/modules/reminder-center',
    '/api/modules/lesson-planner',
    '/api/modules/worksheet-designer',
    '/api/modules/resource-vault',
    '/api/templates'
  ];
  const responses = await Promise.all(endpoints.map((endpoint) => request(app)
    .get(endpoint)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)));

  for (const response of responses) {
    assert.deepEqual(response.body.items, []);
  }
}

test('bootstrap leaves a fresh SQLite database empty', async () => {
  const context = createTestContext();

  try {
    assert.ok(fs.existsSync(context.sqlitePath));
    await Promise.all([
      request(context.app)
        .post('/api/auth/login')
        .send({ email: 'refat@local.test', password: 'refatos123' })
        .expect(401),
      request(context.app)
        .get('/api/auth/me')
        .expect(401)
    ]);
  } finally {
    context.cleanup();
  }
});

test('legacy store.json is ignored when creating a fresh SQLite database', async () => {
  const legacyStore = {
    users: [
      {
        id: 'users-legacy',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        name: 'Legacy Teacher',
        email: 'legacy@local.test',
        password: 'refatos123',
        role: 'teacher'
      }
    ],
    scheduleItems: [
      {
        id: 'schedule-legacy',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        day: 'Tuesday',
        startTime: '09:00',
        endTime: '09:45',
        subject: 'Chemistry',
        className: 'STD VIII',
        room: 'Lab 2',
        note: 'Legacy import'
      }
    ],
    reminders: [],
    lessonPlans: [],
    worksheetDrafts: [],
    resources: [],
    templates: []
  };

  const firstContext = createTestContext({ legacyStore });
  const sqlitePath = firstContext.sqlitePath;
  const uploadDir = firstContext.uploadDir;
  const exportDir = firstContext.exportDir;
  const legacyDataFile = firstContext.legacyDataFile;

  try {
    await request(firstContext.app)
      .post('/api/auth/login')
      .send({ email: 'legacy@local.test', password: 'refatos123' })
      .expect(401);
    const freshToken = await register(request(firstContext.app), 'fresh@example.test', 'fresh password');
    await assertEmptyWorkspace(firstContext.app, freshToken);
  } finally {
    firstContext.dataStore.close();
  }

  const secondContext = createApp({
    env: { sqlitePath, uploadDir, exportDir, legacyDataFile }
  });

  try {
    const freshToken = await login(request(secondContext.app), 'fresh@example.test', 'fresh password');
    await assertEmptyWorkspace(secondContext.app, freshToken);
    await request(secondContext.app)
      .post('/api/auth/login')
      .send({ email: 'legacy@local.test', password: 'refatos123' })
      .expect(401);
  } finally {
    secondContext.dataStore.close();
    fs.rmSync(path.dirname(path.dirname(sqlitePath)), { recursive: true, force: true });
  }
});

test('teacher can register from an empty database and receives an authenticated session', async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'New Teacher',
        email: 'Teacher@Example.test',
        password: 'correct horse battery staple',
        passwordConfirmation: 'correct horse battery staple'
      })
      .expect(201);

    assert.ok(response.body.token);
    assert.equal(response.body.user.name, 'New Teacher');
    assert.equal(response.body.user.email, 'teacher@example.test');
    assert.equal(response.body.user.role, 'teacher');

    await request(context.app)
      .post('/api/auth/login')
      .send({ email: 'teacher@example.test', password: 'wrong password' })
      .expect(401);

    const meResponse = await request(context.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.token}`)
      .expect(200);

    assert.equal(meResponse.body.user.sub, response.body.user.id);
    assert.equal(meResponse.body.user.name, response.body.user.name);
    assert.equal(meResponse.body.user.email, response.body.user.email);
    assert.equal(meResponse.body.user.role, response.body.user.role);

    await assertEmptyWorkspace(context.app, response.body.token);
  } finally {
    context.cleanup();
  }
});

test('registration rejects a mismatched password confirmation with a clear error', async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'Mismatch Teacher',
        email: 'mismatch@example.test',
        password: 'correct horse battery staple',
        passwordConfirmation: 'different password'
      })
      .expect(400);

    assert.equal(response.body.message, 'Passwords do not match.');
  } finally {
    context.cleanup();
  }
});

test('registration treats email addresses case-insensitively and rejects duplicates', async () => {
  const context = createTestContext();

  try {
    await register(request(context.app), 'Teacher@Example.test');

    const duplicateResponse = await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'Second Teacher',
        email: 'teacher@example.TEST',
        password: 'another password',
        passwordConfirmation: 'another password'
      })
      .expect(409);

    assert.equal(duplicateResponse.body.message, 'An account with that email already exists.');
  } finally {
    context.cleanup();
  }
});

test('teacher can log in again after leaving the authenticated session', async () => {
  const context = createTestContext();

  try {
    await register(request(context.app), 'Returning@Example.test', 'returning password');

    const loginResponse = await request(context.app)
      .post('/api/auth/login')
      .send({ email: 'returning@example.TEST', password: 'returning password' })
      .expect(200);

    assert.ok(loginResponse.body.token);
    assert.equal(loginResponse.body.user.email, 'returning@example.test');
  } finally {
    context.cleanup();
  }
});

test('auth login and /api/auth/me still work with SQLite persistence', async () => {
  const context = createTestContext();

  try {
    await register(request(context.app));
    const token = await login(request(context.app), 'teacher@example.test', 'correct horse battery staple');
    const meResponse = await request(context.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(meResponse.body.user.email, 'teacher@example.test');
  } finally {
    context.cleanup();
  }
});

test('module catalog exposes complete stable registration metadata and route bases', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app));
    const api = authAgent(context.app, token);
    const response = await api.get('/api/modules').expect(200);
    const modules = response.body.items;

    assert.deepEqual(modules.map((item) => item.id), [
      'schedule-organizer',
      'reminder-center',
      'lesson-planner',
      'worksheet-designer',
      'resource-vault'
    ]);

    for (const moduleItem of modules) {
      assert.equal(typeof moduleItem.name, 'string');
      assert.equal(typeof moduleItem.title, 'string');
      assert.equal(typeof moduleItem.description, 'string');
      assert.equal(typeof moduleItem.icon, 'string');
      assert.equal(typeof moduleItem.category, 'string');
      assert.equal(moduleItem.routesBasePath, `/api/modules/${moduleItem.id}`);
      assert.deepEqual(moduleItem.capabilities, ['create', 'read', 'update', 'delete']);
      await api.get(moduleItem.routesBasePath).expect(200);
    }

    const schedule = modules.find((item) => item.id === 'schedule-organizer');
    assert.equal(schedule.title, '排课管理');
    assert.equal(schedule.icon, '日历');
  } finally {
    context.cleanup();
  }
});

test('workspace layout defaults per account and keeps visibility isolated', async () => {
  const context = createTestContext();

  try {
    const firstRegistration = await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'First Teacher',
        email: 'first-layout@example.test',
        password: 'first layout password',
        passwordConfirmation: 'first layout password'
      })
      .expect(201);
    const secondRegistration = await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'Second Teacher',
        email: 'second-layout@example.test',
        password: 'second layout password',
        passwordConfirmation: 'second layout password'
      })
      .expect(201);

    const firstApi = authAgent(context.app, firstRegistration.body.token);
    const secondApi = authAgent(context.app, secondRegistration.body.token);
    const firstLayout = await firstApi.get('/api/workspace/layout').expect(200);
    const secondLayout = await secondApi.get('/api/workspace/layout').expect(200);

    assert.deepEqual(firstLayout.body, {
      hiddenModuleIds: [],
      groups: [],
      ungroupedModuleIds: [
        'schedule-organizer',
        'reminder-center',
        'lesson-planner',
        'worksheet-designer',
        'resource-vault'
      ]
    });
    assert.deepEqual(secondLayout.body, firstLayout.body);

    await firstApi.put('/api/workspace/layout').send({
      hiddenModuleIds: ['lesson-planner'],
      groups: [],
      ungroupedModuleIds: [
        'schedule-organizer',
        'reminder-center',
        'lesson-planner',
        'worksheet-designer',
        'resource-vault'
      ]
    }).expect(200);

    const secondLayoutAfterFirstUpdate = await secondApi.get('/api/workspace/layout').expect(200);
    assert.deepEqual(secondLayoutAfterFirstUpdate.body, secondLayout.body);
  } finally {
    context.cleanup();
  }
});

test('workspace layout preserves hidden module placement across writes and restarts', async () => {
  const context = createTestContext();
  const layoutPayload = {
    hiddenModuleIds: ['lesson-planner'],
    groups: [{ id: 'planning', name: '规划', moduleIds: ['lesson-planner', 'schedule-organizer'] }],
    ungroupedModuleIds: ['reminder-center', 'worksheet-designer', 'resource-vault']
  };

  try {
    const registration = await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'Persistent Layout Teacher',
        email: 'persistent-layout@example.test',
        password: 'persistent layout password',
        passwordConfirmation: 'persistent layout password'
      })
      .expect(201);
    const api = authAgent(context.app, registration.body.token);

    const saved = await api.put('/api/workspace/layout').send(layoutPayload).expect(200);
    assert.deepEqual(saved.body, layoutPayload);

    const lessonResponse = await api.post('/api/modules/lesson-planner').send({
      topic: 'Stored lesson',
      className: 'STD V',
      objective: 'Keep data while the module is hidden.',
      duration: '30 min',
      materials: '',
      starter: '',
      mainActivity: '',
      assessment: '',
      resourceIds: []
    }).expect(201);

    const hiddenRead = await api.get('/api/workspace/layout').expect(200);
    assert.deepEqual(hiddenRead.body, layoutPayload);
    await api.get('/api/modules/lesson-planner').expect(200).then((response) => {
      assert.ok(response.body.items.some((item) => item.id === lessonResponse.body.id));
    });
    await api.get('/api/modules/reminder-center').expect(200).then((response) => {
      assert.ok(response.body.items.some((item) => item.linkedTo === lessonResponse.body.id));
    });
  } finally {
    context.dataStore.close();
  }

  const restarted = createApp({
    env: {
      sqlitePath: context.sqlitePath,
      uploadDir: context.uploadDir,
      exportDir: context.exportDir,
      legacyDataFile: context.legacyDataFile
    }
  });

  try {
    const token = await login(request(restarted.app), 'persistent-layout@example.test', 'persistent layout password');
    const persisted = await authAgent(restarted.app, token).get('/api/workspace/layout').expect(200);
    assert.deepEqual(persisted.body, layoutPayload);
  } finally {
    restarted.dataStore.close();
    fs.rmSync(context.rootDir, { recursive: true, force: true });
  }
});

test('workspace layout reconciles a saved layout with the current public module catalog', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app), 'layout-validation@example.test', 'layout validation password');
    const api = authAgent(context.app, token);

    const catalog = await api.get('/api/modules').expect(200);
    assert.deepEqual(catalog.body.items.map((moduleItem) => moduleItem.id), [
      'schedule-organizer',
      'reminder-center',
      'lesson-planner',
      'worksheet-designer',
      'resource-vault'
    ]);

    await api.put('/api/workspace/layout').send({
      hiddenModuleIds: [],
      groups: [{ id: 'planning', name: '规划', moduleIds: ['lesson-planner'] }],
      ungroupedModuleIds: ['lesson-planner']
    }).expect(400);

    const reconciled = await api.put('/api/workspace/layout').send({
      hiddenModuleIds: [],
      groups: [],
      ungroupedModuleIds: ['resource-vault']
    }).expect(200);
    assert.deepEqual(reconciled.body.ungroupedModuleIds, [
      'resource-vault',
      'schedule-organizer',
      'reminder-center',
      'lesson-planner',
      'worksheet-designer'
    ]);

    const resolved = await api.get('/api/workspace/layout').expect(200);
    assert.deepEqual(resolved.body, reconciled.body);
  } finally {
    context.cleanup();
  }
});

test('workspace layout supports ordered group edits without leaking across teacher accounts', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'group-owner@example.test', 'group owner password');
    const secondToken = await register(request(context.app), 'group-observer@example.test', 'group observer password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);

    const initialLayout = {
      hiddenModuleIds: [],
      groups: [
        { id: 'planning', name: '教学计划', moduleIds: ['lesson-planner', 'schedule-organizer'] },
        { id: 'delivery', name: '课堂交付', moduleIds: ['worksheet-designer'] }
      ],
      ungroupedModuleIds: ['reminder-center', 'resource-vault']
    };
    await firstApi.put('/api/workspace/layout').send(initialLayout).expect(200);

    const editedLayout = {
      hiddenModuleIds: [],
      groups: [
        { id: 'delivery', name: '内容交付', moduleIds: ['worksheet-designer'] },
        { id: 'planning', name: '备课与排课', moduleIds: ['schedule-organizer', 'lesson-planner'] }
      ],
      ungroupedModuleIds: ['resource-vault', 'reminder-center']
    };
    const edited = await firstApi.put('/api/workspace/layout').send(editedLayout).expect(200);
    assert.deepEqual(edited.body, editedLayout);

    const persisted = await firstApi.get('/api/workspace/layout').expect(200);
    assert.deepEqual(persisted.body, editedLayout);

    const otherTeacherLayout = await secondApi.get('/api/workspace/layout').expect(200);
    assert.deepEqual(otherTeacherLayout.body, {
      hiddenModuleIds: [],
      groups: [],
      ungroupedModuleIds: [
        'schedule-organizer',
        'reminder-center',
        'lesson-planner',
        'worksheet-designer',
        'resource-vault'
      ]
    });
  } finally {
    context.cleanup();
  }
});

test('workspace layout rejects duplicate group identifiers', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app), 'duplicate-group@example.test', 'duplicate group password');
    await authAgent(context.app, token)
      .put('/api/workspace/layout')
      .send({
        hiddenModuleIds: [],
        groups: [
          { id: 'planning', name: '第一组', moduleIds: ['lesson-planner'] },
          { id: 'planning', name: '第二组', moduleIds: ['schedule-organizer'] }
        ],
        ungroupedModuleIds: ['reminder-center', 'worksheet-designer', 'resource-vault']
      })
      .expect(400);
  } finally {
    context.cleanup();
  }
});

test('deleting a workspace group appends its modules to ungrouped in their previous order', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app), 'delete-group@example.test', 'delete group password');
    const api = authAgent(context.app, token);
    await api.put('/api/workspace/layout').send({
      hiddenModuleIds: [],
      groups: [{ id: 'planning', name: '教学计划', moduleIds: ['lesson-planner', 'schedule-organizer'] }],
      ungroupedModuleIds: ['reminder-center', 'worksheet-designer', 'resource-vault']
    }).expect(200);

    const deleted = await api.put('/api/workspace/layout').send({
      hiddenModuleIds: [],
      groups: [],
      ungroupedModuleIds: ['reminder-center', 'worksheet-designer', 'resource-vault']
    }).expect(200);

    assert.deepEqual(deleted.body, {
      hiddenModuleIds: [],
      groups: [],
      ungroupedModuleIds: [
        'reminder-center',
        'worksheet-designer',
        'resource-vault',
        'lesson-planner',
        'schedule-organizer'
      ]
    });
  } finally {
    context.cleanup();
  }
});

test('schedule organizer supports CRUD and rejects clashes', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app));
    const api = authAgent(context.app, token);

    const createResponse = await api.post('/api/modules/schedule-organizer').send({
      day: 'Wednesday',
      startTime: '11:00',
      endTime: '11:45',
      subject: 'Biology',
      className: 'STD VII',
      room: 'Room 5',
      note: 'Microscope work'
    }).expect(201);

    const createdId = createResponse.body.id;
    assert.equal(createResponse.body.subject, 'Biology');

    await api.post('/api/modules/schedule-organizer').send({
      day: 'Wednesday',
      startTime: '11:15',
      endTime: '11:50',
      subject: 'Physics',
      className: 'STD VII',
      room: 'Room 6',
      note: ''
    }).expect(409);

    const updateResponse = await api.put(`/api/modules/schedule-organizer/${createdId}`).send({
      day: 'Wednesday',
      startTime: '12:00',
      endTime: '12:45',
      subject: 'Advanced Biology',
      className: 'STD VII',
      room: 'Room 5',
      note: 'Updated slot'
    }).expect(200);

    assert.equal(updateResponse.body.subject, 'Advanced Biology');

    await api.put('/api/modules/schedule-organizer/missing-id').send({
      day: 'Thursday',
      startTime: '08:00',
      endTime: '08:45',
      subject: 'English',
      className: 'STD VII',
      room: 'Room 1',
      note: ''
    }).expect(404);

    await api.post('/api/modules/schedule-organizer').send({
      day: 'Thursday',
      startTime: '13:00',
      endTime: '12:00',
      subject: 'Bad slot',
      className: 'STD VII',
      room: 'Room 1',
      note: ''
    }).expect(400);

    await api.delete(`/api/modules/schedule-organizer/${createdId}`).expect(200);
  } finally {
    context.cleanup();
  }
});

test('schedule organizer isolates records and clash checks between teacher accounts', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'first.teacher@example.test', 'first password');
    const secondToken = await register(request(context.app), 'second.teacher@example.test', 'second password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);
    const firstSchedule = {
      day: 'Wednesday',
      startTime: '09:00',
      endTime: '10:00',
      subject: 'Biology',
      className: 'STD VII',
      room: 'Room 5',
      note: 'First teacher schedule'
    };

    const firstCreateResponse = await firstApi
      .post('/api/modules/schedule-organizer')
      .send(firstSchedule)
      .expect(201);

    const secondCreateResponse = await secondApi
      .post('/api/modules/schedule-organizer')
      .send({ ...firstSchedule, subject: 'Physics', note: 'Second teacher schedule' })
      .expect(201);

    assert.notEqual(firstCreateResponse.body.id, secondCreateResponse.body.id);
    assert.deepEqual((await firstApi.get('/api/modules/schedule-organizer').expect(200)).body.items.map((item) => item.subject), ['Biology']);
    assert.deepEqual((await secondApi.get('/api/modules/schedule-organizer').expect(200)).body.items.map((item) => item.subject), ['Physics']);

    await firstApi
      .post('/api/modules/schedule-organizer')
      .send({ ...firstSchedule, startTime: '09:30', endTime: '10:30', subject: 'Chemistry' })
      .expect(409);
    await secondApi
      .post('/api/modules/schedule-organizer')
      .send({ ...firstSchedule, startTime: '09:30', endTime: '10:30', subject: 'Chemistry' })
      .expect(409);

    const otherTeacherId = firstCreateResponse.body.id;
    await secondApi.get(`/api/modules/schedule-organizer/${otherTeacherId}`).expect(404);
    await secondApi
      .put(`/api/modules/schedule-organizer/${otherTeacherId}`)
      .send({ ...firstSchedule, subject: 'Unauthorized update' })
      .expect(404);
    await secondApi.delete(`/api/modules/schedule-organizer/${otherTeacherId}`).expect(404);

    const updateResponse = await firstApi
      .put(`/api/modules/schedule-organizer/${otherTeacherId}`)
      .send({ ...firstSchedule, startTime: '11:00', endTime: '12:00', subject: 'Advanced Biology' })
      .expect(200);
    assert.equal(updateResponse.body.subject, 'Advanced Biology');

    await firstApi.delete(`/api/modules/schedule-organizer/${otherTeacherId}`).expect(200);
    assert.deepEqual((await firstApi.get('/api/modules/schedule-organizer').expect(200)).body.items, []);
    assert.equal((await secondApi.get('/api/modules/schedule-organizer').expect(200)).body.items[0].subject, 'Physics');
  } finally {
    context.cleanup();
  }
});

test('reminder completion creates the next recurring occurrence', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app));
    const api = authAgent(context.app, token);

    const createResponse = await api.post('/api/modules/reminder-center').send({
      title: 'Weekly planning',
      dueAt: '2026-05-01T10:00:00.000Z',
      priority: 'medium',
      status: 'pending',
      recurrence: 'weekly',
      recurrenceInterval: 1
    }).expect(201);

    const completeResponse = await api.post(`/api/modules/reminder-center/${createResponse.body.id}/complete`).send({}).expect(200);

    assert.equal(completeResponse.body.item.status, 'done');
    assert.equal(completeResponse.body.nextOccurrence.parentReminderId, createResponse.body.id);
  } finally {
    context.cleanup();
  }
});

test('reminder associations require an existing record owned by the current teacher', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app), 'reminder-association@example.test', 'association password');
    const api = authAgent(context.app, token);

    await api
      .post('/api/modules/reminder-center')
      .send({
        title: 'Invalid association',
        dueAt: '2026-05-01T10:00:00.000Z',
        priority: 'medium',
        status: 'pending',
        recurrence: 'none',
        recurrenceInterval: 1,
        linkedTo: 'missing-record-id'
      })
      .expect(404);
  } finally {
    context.cleanup();
  }
});

test('reminders isolate CRUD, completion, recurrence, and cross-account access', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'reminder.first@example.test', 'first password');
    const secondToken = await register(request(context.app), 'reminder.second@example.test', 'second password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);
    const firstReminderPayload = {
      title: 'First teacher planning',
      dueAt: '2026-05-01T10:00:00.000Z',
      priority: 'high',
      status: 'pending',
      recurrence: 'weekly',
      recurrenceInterval: 1
    };

    const firstCreateResponse = await firstApi
      .post('/api/modules/reminder-center')
      .send(firstReminderPayload)
      .expect(201);
    const secondCreateResponse = await secondApi
      .post('/api/modules/reminder-center')
      .send({ ...firstReminderPayload, title: 'Second teacher planning' })
      .expect(201);

    assert.equal(firstCreateResponse.body.ownerId, undefined);
    assert.equal(secondCreateResponse.body.ownerId, undefined);
    assert.deepEqual(
      (await firstApi.get('/api/modules/reminder-center').expect(200)).body.items.map((item) => item.title),
      ['First teacher planning']
    );
    assert.deepEqual(
      (await secondApi.get('/api/modules/reminder-center').expect(200)).body.items.map((item) => item.title),
      ['Second teacher planning']
    );

    const firstReminderId = firstCreateResponse.body.id;
    assert.equal((await firstApi.get(`/api/modules/reminder-center/${firstReminderId}`).expect(200)).body.title, 'First teacher planning');
    await secondApi.get(`/api/modules/reminder-center/${firstReminderId}`).expect(404);
    await secondApi
      .put(`/api/modules/reminder-center/${firstReminderId}`)
      .send({ ...firstReminderPayload, title: 'Unauthorized update' })
      .expect(404);
    await secondApi.post(`/api/modules/reminder-center/${firstReminderId}/complete`).send({}).expect(404);
    await secondApi.delete(`/api/modules/reminder-center/${firstReminderId}`).expect(404);

    const updateResponse = await firstApi
      .put(`/api/modules/reminder-center/${firstReminderId}`)
      .send({ ...firstReminderPayload, title: 'First teacher planning revised' })
      .expect(200);
    assert.equal(updateResponse.body.title, 'First teacher planning revised');

    const completeResponse = await firstApi
      .post(`/api/modules/reminder-center/${firstReminderId}/complete`)
      .send({})
      .expect(200);
    assert.equal(completeResponse.body.item.status, 'done');
    assert.equal(completeResponse.body.nextOccurrence.parentReminderId, firstReminderId);
    assert.equal(completeResponse.body.nextOccurrence.ownerId, undefined);

    await firstApi.delete(`/api/modules/reminder-center/${completeResponse.body.nextOccurrence.id}`).expect(200);
    assert.deepEqual(
      (await secondApi.get('/api/modules/reminder-center').expect(200)).body.items.map((item) => item.title),
      ['Second teacher planning']
    );
  } finally {
    context.cleanup();
  }
});

test('lesson planner creation triggers automation and worksheet generation remains stable', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app));
    const api = authAgent(context.app, token);

    const lessonResponse = await api.post('/api/modules/lesson-planner').send({
      topic: 'Light Reflection',
      className: 'STD VI',
      objective: 'Explain reflection using simple examples.',
      duration: '35 min',
      materials: 'Mirror, torch',
      starter: 'Ask what mirrors do.',
      mainActivity: 'Torch-and-mirror demo.',
      assessment: 'Draw a ray diagram.',
      resourceIds: []
    }).expect(201);

    const reminders = await api.get('/api/modules/reminder-center').expect(200);
    assert.ok(reminders.body.items.some((item) => item.linkedTo === lessonResponse.body.id));

    const worksheetResponse = await api.post(`/api/modules/lesson-planner/${lessonResponse.body.id}/generate-worksheet-draft`).send({}).expect(201);
    assert.equal(worksheetResponse.body.generatedFromLessonId, lessonResponse.body.id);

    const exportSpecResponse = await api.get(`/api/modules/worksheet-designer/${worksheetResponse.body.id}/export/spec`).expect(200);
    assert.equal(exportSpecResponse.body.document.topic, 'Light Reflection');
    assert.ok(Array.isArray(exportSpecResponse.body.placeholders));
  } finally {
    context.cleanup();
  }
});

test('lesson plans isolate CRUD, automation, and cross-account associations', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'lesson.first@example.test', 'first password');
    const secondToken = await register(request(context.app), 'lesson.second@example.test', 'second password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);
    const firstLessonPayload = {
      topic: 'First teacher lesson',
      className: 'STD VI',
      objective: 'Explain the first lesson objective.',
      duration: '35 min',
      materials: 'Mirror',
      starter: 'Ask a question.',
      mainActivity: 'Run the demonstration.',
      assessment: 'Draw a diagram.',
      resourceIds: []
    };

    const firstCreateResponse = await firstApi
      .post('/api/modules/lesson-planner')
      .send(firstLessonPayload)
      .expect(201);
    const secondCreateResponse = await secondApi
      .post('/api/modules/lesson-planner')
      .send({ ...firstLessonPayload, topic: 'Second teacher lesson' })
      .expect(201);

    assert.equal(firstCreateResponse.body.ownerId, undefined);
    assert.equal(secondCreateResponse.body.ownerId, undefined);
    const firstLessonId = firstCreateResponse.body.id;
    assert.deepEqual(
      (await firstApi.get('/api/modules/lesson-planner').expect(200)).body.items.map((item) => item.topic),
      ['First teacher lesson']
    );
    assert.deepEqual(
      (await secondApi.get('/api/modules/lesson-planner').expect(200)).body.items.map((item) => item.topic),
      ['Second teacher lesson']
    );

    const firstReminders = await firstApi.get('/api/modules/reminder-center').expect(200);
    const secondReminders = await secondApi.get('/api/modules/reminder-center').expect(200);
    assert.deepEqual(firstReminders.body.items.map((item) => item.linkedTo), [firstLessonId]);
    assert.deepEqual(secondReminders.body.items.map((item) => item.linkedTo), [secondCreateResponse.body.id]);

    assert.equal((await firstApi.get(`/api/modules/lesson-planner/${firstLessonId}`).expect(200)).body.topic, 'First teacher lesson');
    await secondApi.get(`/api/modules/lesson-planner/${firstLessonId}`).expect(404);
    await secondApi
      .put(`/api/modules/lesson-planner/${firstLessonId}`)
      .send({ ...firstLessonPayload, topic: 'Unauthorized lesson update' })
      .expect(404);
    await secondApi.delete(`/api/modules/lesson-planner/${firstLessonId}`).expect(404);
    await secondApi.post(`/api/modules/lesson-planner/${firstLessonId}/generate-worksheet-draft`).send({}).expect(404);
    await secondApi
      .post('/api/modules/reminder-center')
      .send({
        title: 'Cross-account association',
        dueAt: '2026-05-01T10:00:00.000Z',
        priority: 'medium',
        status: 'pending',
        recurrence: 'none',
        recurrenceInterval: 1,
        linkedTo: firstLessonId
      })
      .expect(404);
    await secondApi
      .put(`/api/modules/reminder-center/${secondReminders.body.items[0].id}`)
      .send({
        title: 'Cross-account association update',
        dueAt: '2026-05-01T10:00:00.000Z',
        priority: 'medium',
        status: 'pending',
        recurrence: 'none',
        recurrenceInterval: 1,
        linkedTo: firstLessonId
      })
      .expect(404);

    const updateResponse = await firstApi
      .put(`/api/modules/lesson-planner/${firstLessonId}`)
      .send({ ...firstLessonPayload, topic: 'First teacher lesson revised' })
      .expect(200);
    assert.equal(updateResponse.body.topic, 'First teacher lesson revised');

    await firstApi.delete(`/api/modules/lesson-planner/${firstLessonId}`).expect(200);
    assert.deepEqual((await firstApi.get('/api/modules/lesson-planner').expect(200)).body.items, []);
    assert.deepEqual(
      (await secondApi.get('/api/modules/lesson-planner').expect(200)).body.items.map((item) => item.topic),
      ['Second teacher lesson']
    );
  } finally {
    context.cleanup();
  }
});

test('worksheet designer CRUD keeps nested JSON fields stable', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app));
    const api = authAgent(context.app, token);

    const createResponse = await api.post('/api/modules/worksheet-designer').send({
      title: 'Forces Worksheet',
      className: 'STD VIII',
      topic: 'Forces',
      format: 'Mixed worksheet',
      marks: 20,
      duration: '40 min',
      questionCount: 2,
      instructions: 'Answer clearly.',
      resourceIds: [],
      questionItems: [
        { number: 1, type: 'short', prompt: 'Define force.', marks: 5, lines: 3, diagramSpace: false },
        { number: 2, type: 'diagram', prompt: 'Draw force arrows.', marks: 15, lines: 0, diagramSpace: true }
      ]
    }).expect(201);

    assert.equal(createResponse.body.questionItems.length, 2);

    const updateResponse = await api.put(`/api/modules/worksheet-designer/${createResponse.body.id}`).send({
      title: 'Forces Worksheet Revised',
      className: 'STD VIII',
      topic: 'Forces',
      format: 'Mixed worksheet',
      marks: 25,
      duration: '45 min',
      questionCount: 2,
      instructions: 'Answer clearly and label diagrams.',
      resourceIds: [],
      questionItems: [
        { number: 1, type: 'short', prompt: 'Define force and give one example.', marks: 10, lines: 4, diagramSpace: false },
        { number: 2, type: 'diagram', prompt: 'Draw balanced forces.', marks: 15, lines: 0, diagramSpace: true }
      ]
    }).expect(200);

    assert.equal(updateResponse.body.title, 'Forces Worksheet Revised');
    assert.equal(updateResponse.body.questionItems[0].marks, 10);

    await api.delete(`/api/modules/worksheet-designer/${createResponse.body.id}`).expect(200);
  } finally {
    context.cleanup();
  }
});

test('worksheet drafts isolate CRUD and exports between teacher accounts', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'worksheet.first@example.test', 'first password');
    const secondToken = await register(request(context.app), 'worksheet.second@example.test', 'second password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);
    const worksheetPayload = {
      title: 'First teacher worksheet',
      className: 'STD VIII',
      topic: 'Forces',
      format: 'Mixed worksheet',
      marks: 20,
      duration: '40 min',
      questionCount: 2,
      instructions: 'Answer clearly.',
      resourceIds: [],
      questionItems: [
        { number: 1, type: 'short', prompt: 'Define force.', marks: 5, lines: 3, diagramSpace: false },
        { number: 2, type: 'diagram', prompt: 'Draw force arrows.', marks: 15, lines: 0, diagramSpace: true }
      ]
    };

    const firstCreateResponse = await firstApi
      .post('/api/modules/worksheet-designer')
      .send(worksheetPayload)
      .expect(201);
    const secondCreateResponse = await secondApi
      .post('/api/modules/worksheet-designer')
      .send({ ...worksheetPayload, title: 'Second teacher worksheet' })
      .expect(201);

    assert.equal(firstCreateResponse.body.ownerId, undefined);
    assert.equal(secondCreateResponse.body.ownerId, undefined);
    const firstWorksheetId = firstCreateResponse.body.id;
    assert.deepEqual(
      (await firstApi.get('/api/modules/worksheet-designer').expect(200)).body.items.map((item) => item.title),
      ['First teacher worksheet']
    );
    assert.deepEqual(
      (await secondApi.get('/api/modules/worksheet-designer').expect(200)).body.items.map((item) => item.title),
      ['Second teacher worksheet']
    );

    await secondApi
      .put(`/api/modules/worksheet-designer/${firstWorksheetId}`)
      .send({ ...worksheetPayload, title: 'Unauthorized worksheet update' })
      .expect(404);
    await secondApi.delete(`/api/modules/worksheet-designer/${firstWorksheetId}`).expect(404);
    await secondApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/spec`).expect(404);
    await secondApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/preview`).expect(404);
    await secondApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/docx`).expect(404);
    await secondApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/pdf`).expect(404);

    const updateResponse = await firstApi
      .put(`/api/modules/worksheet-designer/${firstWorksheetId}`)
      .send({ ...worksheetPayload, title: 'First teacher worksheet revised' })
      .expect(200);
    assert.equal(updateResponse.body.title, 'First teacher worksheet revised');
    assert.equal((await firstApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/spec`).expect(200)).body.document.title, 'First teacher worksheet revised');
    await firstApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/preview`).expect(200);
    await firstApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/docx`).expect(200);
    await firstApi.get(`/api/modules/worksheet-designer/${firstWorksheetId}/export/pdf`).expect(200);

    await firstApi.delete(`/api/modules/worksheet-designer/${firstWorksheetId}`).expect(200);
    assert.deepEqual((await firstApi.get('/api/modules/worksheet-designer').expect(200)).body.items, []);
    assert.deepEqual(
      (await secondApi.get('/api/modules/worksheet-designer').expect(200)).body.items.map((item) => item.title),
      ['Second teacher worksheet']
    );
  } finally {
    context.cleanup();
  }
});

test('template CRUD remains compatible', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app));

    const createResponse = await request(context.app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        moduleId: 'lesson-planner',
        name: 'Quick starter',
        payload: { duration: '25 min', starter: 'Flash review' }
      })
      .expect(201);

    const templateId = createResponse.body.id;
    assert.equal(createResponse.body.payload.duration, '25 min');

    const updateResponse = await request(context.app)
      .put(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Quick starter revised',
        payload: { duration: '30 min', starter: 'Flash review', assessment: 'Exit slip' }
      })
      .expect(200);

    assert.equal(updateResponse.body.name, 'Quick starter revised');

    await request(context.app)
      .delete(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  } finally {
    context.cleanup();
  }
});

test('templates isolate CRUD and filtered lists between teacher accounts', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'template.first@example.test', 'first password');
    const secondToken = await register(request(context.app), 'template.second@example.test', 'second password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);
    const templatePayload = {
      moduleId: 'lesson-planner',
      name: 'First teacher template',
      payload: { duration: '25 min', starter: 'Flash review' }
    };

    const firstCreateResponse = await firstApi.post('/api/templates').send(templatePayload).expect(201);
    const secondCreateResponse = await secondApi
      .post('/api/templates')
      .send({ ...templatePayload, name: 'Second teacher template' })
      .expect(201);

    assert.equal(firstCreateResponse.body.ownerId, undefined);
    assert.equal(secondCreateResponse.body.ownerId, undefined);
    const firstTemplateId = firstCreateResponse.body.id;
    assert.deepEqual(
      (await firstApi.get('/api/templates').expect(200)).body.items.map((item) => item.name),
      ['First teacher template']
    );
    assert.deepEqual(
      (await secondApi.get('/api/templates?moduleId=lesson-planner').expect(200)).body.items.map((item) => item.name),
      ['Second teacher template']
    );

    await secondApi
      .put(`/api/templates/${firstTemplateId}`)
      .send({ name: 'Unauthorized template update', payload: { duration: '99 min' } })
      .expect(404);
    await secondApi.delete(`/api/templates/${firstTemplateId}`).expect(404);

    const updateResponse = await firstApi
      .put(`/api/templates/${firstTemplateId}`)
      .send({ name: 'First teacher template revised', payload: { duration: '30 min' } })
      .expect(200);
    assert.equal(updateResponse.body.name, 'First teacher template revised');

    await firstApi.delete(`/api/templates/${firstTemplateId}`).expect(200);
    assert.deepEqual((await firstApi.get('/api/templates').expect(200)).body.items, []);
    assert.deepEqual(
      (await secondApi.get('/api/templates').expect(200)).body.items.map((item) => item.name),
      ['Second teacher template']
    );
  } finally {
    context.cleanup();
  }
});

test('resource vault upload, metadata update, and delete clean up both metadata and file', async () => {
  const context = createTestContext();

  try {
    const token = await register(request(context.app));
    const sampleFile = path.join(context.rootDir, 'sample.txt');
    fs.writeFileSync(sampleFile, 'sample upload', 'utf-8');

    const uploadResponse = await request(context.app)
      .post('/api/modules/resource-vault/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Uploaded Note')
      .field('tags', 'science, notes')
      .field('moduleLinks', 'lesson-planner')
      .attach('file', sampleFile)
      .expect(201);

    const resourceId = uploadResponse.body.id;
    const uploadedFilePath = path.join(context.uploadDir, path.basename(uploadResponse.body.path));
    assert.ok(fs.existsSync(uploadedFilePath));

    const updateResponse = await request(context.app)
      .put(`/api/modules/resource-vault/${resourceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Uploaded Note Revised',
        tags: 'science, revised',
        moduleLinks: 'worksheet-designer'
      })
      .expect(200);

    assert.deepEqual(updateResponse.body.tags, ['science', 'revised']);

    await request(context.app)
      .delete(`/api/modules/resource-vault/${resourceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.equal(fs.existsSync(uploadedFilePath), false);
  } finally {
    context.cleanup();
  }
});

test('resources isolate metadata, authenticated file reads, and physical cleanup between teacher accounts', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'resource.first@example.test', 'first password');
    const secondToken = await register(request(context.app), 'resource.second@example.test', 'second password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);
    const firstSampleFile = path.join(context.rootDir, 'first-sample.txt');
    const secondSampleFile = path.join(context.rootDir, 'second-sample.txt');
    fs.writeFileSync(firstSampleFile, 'first teacher file', 'utf-8');
    fs.writeFileSync(secondSampleFile, 'second teacher file', 'utf-8');

    const firstUploadResponse = await firstApi
      .post('/api/modules/resource-vault/upload')
      .field('title', 'First teacher resource')
      .field('tags', 'science, first')
      .field('moduleLinks', 'lesson-planner')
      .attach('file', firstSampleFile)
      .expect(201);
    const secondUploadResponse = await secondApi
      .post('/api/modules/resource-vault/upload')
      .field('title', 'Second teacher resource')
      .field('tags', 'science, second')
      .field('moduleLinks', 'lesson-planner')
      .attach('file', secondSampleFile)
      .expect(201);

    const firstResourceId = firstUploadResponse.body.id;
    const secondResourceId = secondUploadResponse.body.id;
    const firstUploadedFilePath = path.join(context.uploadDir, path.basename(firstUploadResponse.body.path));
    const secondUploadedFilePath = path.join(context.uploadDir, path.basename(secondUploadResponse.body.path));
    assert.ok(fs.existsSync(firstUploadedFilePath));
    assert.ok(fs.existsSync(secondUploadedFilePath));
    assert.deepEqual(
      (await firstApi.get('/api/modules/resource-vault').expect(200)).body.items.map((item) => item.title),
      ['First teacher resource']
    );
    assert.deepEqual(
      (await secondApi.get('/api/modules/resource-vault').expect(200)).body.items.map((item) => item.title),
      ['Second teacher resource']
    );

    await request(context.app).get(firstUploadResponse.body.path).expect(404);
    await request(context.app).get(`/api/modules/resource-vault/${firstResourceId}/file`).expect(401);
    const firstFileResponse = await firstApi.get(`/api/modules/resource-vault/${firstResourceId}/file`).expect(200);
    assert.equal(firstFileResponse.text, 'first teacher file');
    await secondApi.get(`/api/modules/resource-vault/${firstResourceId}/file`).expect(404);

    await secondApi
      .put(`/api/modules/resource-vault/${firstResourceId}`)
      .send({ title: 'Unauthorized resource update', tags: [], moduleLinks: [] })
      .expect(404);
    await secondApi.delete(`/api/modules/resource-vault/${firstResourceId}`).expect(404);

    const updateResponse = await firstApi
      .put(`/api/modules/resource-vault/${firstResourceId}`)
      .send({ title: 'First teacher resource revised', tags: ['science', 'revised'], moduleLinks: ['worksheet-designer'] })
      .expect(200);
    assert.equal(updateResponse.body.title, 'First teacher resource revised');

    await firstApi.delete(`/api/modules/resource-vault/${firstResourceId}`).expect(200);
    assert.equal(fs.existsSync(firstUploadedFilePath), false);
    assert.equal(fs.existsSync(secondUploadedFilePath), true);
    assert.deepEqual((await firstApi.get('/api/modules/resource-vault').expect(200)).body.items, []);
    assert.equal((await secondApi.get(`/api/modules/resource-vault/${secondResourceId}/file`).expect(200)).text, 'second teacher file');
  } finally {
    context.cleanup();
  }
});

test('lesson plans and worksheets only reference same-account resources and generated plans', async () => {
  const context = createTestContext();

  try {
    const firstToken = await register(request(context.app), 'reference.first@example.test', 'first password');
    const secondToken = await register(request(context.app), 'reference.second@example.test', 'second password');
    const firstApi = authAgent(context.app, firstToken);
    const secondApi = authAgent(context.app, secondToken);
    const firstSampleFile = path.join(context.rootDir, 'reference-first.txt');
    const secondSampleFile = path.join(context.rootDir, 'reference-second.txt');
    fs.writeFileSync(firstSampleFile, 'first resource', 'utf-8');
    fs.writeFileSync(secondSampleFile, 'second resource', 'utf-8');

    const firstResourceResponse = await firstApi
      .post('/api/modules/resource-vault/upload')
      .field('title', 'First resource')
      .field('tags', 'science')
      .field('moduleLinks', 'lesson-planner')
      .attach('file', firstSampleFile)
      .expect(201);
    const secondResourceResponse = await secondApi
      .post('/api/modules/resource-vault/upload')
      .field('title', 'Second resource')
      .field('tags', 'science')
      .field('moduleLinks', 'lesson-planner')
      .attach('file', secondSampleFile)
      .expect(201);

    const lessonPayload = {
      topic: 'Account-scoped lesson',
      className: 'STD VI',
      objective: 'Explain the account-scoped lesson objective.',
      duration: '35 min',
      materials: 'Notebook',
      starter: 'Ask a question.',
      mainActivity: 'Run the demonstration.',
      assessment: 'Draw a diagram.',
      resourceIds: [firstResourceResponse.body.id]
    };
    const firstLessonResponse = await firstApi.post('/api/modules/lesson-planner').send(lessonPayload).expect(201);
    const secondLessonResponse = await secondApi
      .post('/api/modules/lesson-planner')
      .send({ ...lessonPayload, topic: 'Second account lesson', resourceIds: [secondResourceResponse.body.id] })
      .expect(201);

    await secondApi
      .post('/api/modules/lesson-planner')
      .send({ ...lessonPayload, topic: 'Cross-account lesson', resourceIds: [firstResourceResponse.body.id] })
      .expect(404);
    await secondApi
      .put(`/api/modules/lesson-planner/${secondLessonResponse.body.id}`)
      .send({ ...lessonPayload, topic: 'Cross-account lesson update', resourceIds: [firstResourceResponse.body.id] })
      .expect(404);

    const worksheetPayload = {
      title: 'Resource-linked worksheet',
      className: 'STD VI',
      topic: 'Account-scoped lesson',
      format: 'Mixed worksheet',
      marks: 20,
      duration: '40 min',
      questionCount: 2,
      instructions: 'Answer clearly.',
      resourceIds: [firstResourceResponse.body.id],
      questionItems: []
    };
    await firstApi.post('/api/modules/worksheet-designer').send(worksheetPayload).expect(201);
    await secondApi
      .post('/api/modules/worksheet-designer')
      .send({ ...worksheetPayload, title: 'Cross-account worksheet' })
      .expect(404);
    await secondApi
      .post('/api/modules/worksheet-designer')
      .send({ ...worksheetPayload, title: 'Second worksheet', resourceIds: [secondResourceResponse.body.id] })
      .expect(201);

    const generatedWorksheetResponse = await firstApi
      .post(`/api/modules/lesson-planner/${firstLessonResponse.body.id}/generate-worksheet-draft`)
      .send({})
      .expect(201);
    assert.equal(generatedWorksheetResponse.body.generatedFromLessonId, firstLessonResponse.body.id);
    assert.deepEqual(generatedWorksheetResponse.body.resourceIds, [firstResourceResponse.body.id]);
    await secondApi
      .post(`/api/modules/lesson-planner/${firstLessonResponse.body.id}/generate-worksheet-draft`)
      .send({})
      .expect(404);
    await secondApi
      .post('/api/modules/worksheet-designer')
      .send({ ...worksheetPayload, title: 'Cross-account generated worksheet', generatedFromLessonId: firstLessonResponse.body.id, resourceIds: [secondResourceResponse.body.id] })
      .expect(404);
  } finally {
    context.cleanup();
  }
});
