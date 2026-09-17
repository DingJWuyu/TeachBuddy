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
      resourceIds: ['resources-1'],
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
      resourceIds: ['resources-1'],
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
