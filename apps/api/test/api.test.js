import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-workspace-api-'));
}

function createTestContext(options = {}) {
  const rootDir = createTempDir();
  const sqlitePath = path.join(rootDir, 'data', 'workspace.sqlite');
  const context = createApp({
    env: {
      nodeEnv: 'test',
      sqlitePath,
      authSecret: 'teacher-workspace-api-secret'
    },
    ...(options.appOptions || {})
  });

  return {
    ...context,
    rootDir,
    sqlitePath,
    cleanup() {
      context.dataStore.close();
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

async function register(agent, {
  name = 'Test Teacher',
  email = 'teacher@example.test',
  password = 'correct horse battery staple'
} = {}) {
  const response = await agent
    .post('/api/auth/register')
    .send({ name, email, password, passwordConfirmation: password })
    .expect(201);
  return response.body;
}

async function login(agent, email = 'teacher@example.test', password = 'correct horse battery staple') {
  const response = await agent
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
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

function createMailCapture() {
  const deliveries = [];
  return {
    deliveries,
    sender: {
      async send(message) {
        deliveries.push(message);
      }
    }
  };
}

function latestRecoveryCode(deliveries) {
  const code = deliveries.at(-1)?.text?.match(/\b\d{6}\b/)?.[0] || '';
  assert.match(code, /^\d{6}$/);
  return code;
}

test('a fresh application exposes an empty module directory', async () => {
  const context = createTestContext();

  try {
    const health = await request(context.app).get('/api/health').expect(200);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.body.modulesLoaded, 0);

    const registration = await register(request(context.app));
    const api = authAgent(context.app, registration.token);
    const modules = await api.get('/api/modules').expect(200);
    assert.deepEqual(modules.body, { items: [] });

    await api.get('/api/modules/example').expect(404);
    await api.post('/api/removed-capability').send({}).expect(404);
  } finally {
    context.cleanup();
  }
});

test('the application does not require a legacy database or seed account', async () => {
  const context = createTestContext();

  try {
    await request(context.app)
      .post('/api/auth/login')
      .send({ email: 'seed@example.test', password: 'seed password' })
      .expect(401);

    const registration = await register(request(context.app), {
      email: 'fresh@example.test',
      password: 'fresh password'
    });
    assert.equal(registration.user.email, 'fresh@example.test');
  } finally {
    context.cleanup();
  }
});

test('teacher registration, login, and account identity remain available', async () => {
  const context = createTestContext();

  try {
    const registration = await register(request(context.app), {
      name: 'New Teacher',
      email: 'Teacher@Example.test'
    });
    assert.ok(registration.token);
    assert.equal(registration.user.name, 'New Teacher');
    assert.equal(registration.user.email, 'teacher@example.test');
    assert.equal(registration.user.role, 'teacher');

    const token = await login(request(context.app), 'TEACHER@example.TEST');
    const me = await request(context.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(me.body.user.email, 'teacher@example.test');

    await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate Teacher',
        email: 'teacher@example.test',
        password: 'another password',
        passwordConfirmation: 'another password'
      })
      .expect(409);
  } finally {
    context.cleanup();
  }
});

test('registration rejects a mismatched password confirmation', async () => {
  const context = createTestContext();

  try {
    const response = await request(context.app)
      .post('/api/auth/register')
      .send({
        name: 'Mismatch Teacher',
        email: 'mismatch@example.test',
        password: 'one password',
        passwordConfirmation: 'another password'
      })
      .expect(400);
    assert.equal(response.body.message, 'Passwords do not match.');
  } finally {
    context.cleanup();
  }
});

test('password recovery keeps the public flow and one-time expiry', async () => {
  const mail = createMailCapture();
  let currentTime = Date.parse('2026-09-18T10:00:00.000Z');
  const context = createTestContext({
    appOptions: {
      now: () => new Date(currentTime),
      mailSender: mail.sender
    }
  });

  try {
    const email = 'recovery@example.test';
    const oldPassword = 'old recovery password';
    const newPassword = 'new recovery password';
    await register(request(context.app), { email, password: oldPassword });

    const unknownResponse = await request(context.app)
      .post('/api/auth/password-reset/request')
      .send({ email: 'unknown@example.test' })
      .expect(202);
    const knownResponse = await request(context.app)
      .post('/api/auth/password-reset/request')
      .send({ email })
      .expect(202);
    assert.deepEqual(unknownResponse.body, knownResponse.body);
    assert.equal(knownResponse.body.code, undefined);
    assert.equal(mail.deliveries.length, 1);

    const code = latestRecoveryCode(mail.deliveries);
    await request(context.app)
      .post('/api/auth/password-reset/confirm')
      .send({ email, code, password: newPassword, passwordConfirmation: newPassword })
      .expect(200);
    await request(context.app)
      .post('/api/auth/password-reset/confirm')
      .send({ email, code, password: oldPassword, passwordConfirmation: oldPassword })
      .expect(400);
    await request(context.app)
      .post('/api/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);
    await request(context.app)
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(200);

    await request(context.app)
      .post('/api/auth/password-reset/request')
      .send({ email })
      .expect(202);
    const expiredCode = latestRecoveryCode(mail.deliveries);
    currentTime += 10 * 60 * 1000;
    await request(context.app)
      .post('/api/auth/password-reset/confirm')
      .send({ email, code: expiredCode, password: oldPassword, passwordConfirmation: oldPassword })
      .expect(400);
  } finally {
    context.cleanup();
  }
});

test('workspace layout defaults to empty and safely persists per teacher', async () => {
  const context = createTestContext();

  try {
    const first = await register(request(context.app), {
      name: 'First Teacher',
      email: 'first-layout@example.test',
      password: 'first layout password'
    });
    const second = await register(request(context.app), {
      name: 'Second Teacher',
      email: 'second-layout@example.test',
      password: 'second layout password'
    });
    const firstApi = authAgent(context.app, first.token);
    const secondApi = authAgent(context.app, second.token);
    const emptyLayout = {
      hiddenModuleIds: [],
      groups: [],
      ungroupedModuleIds: []
    };

    assert.deepEqual((await firstApi.get('/api/workspace/layout').expect(200)).body, emptyLayout);
    assert.deepEqual((await secondApi.get('/api/workspace/layout').expect(200)).body, emptyLayout);

    const layout = {
      hiddenModuleIds: [],
      groups: [{ id: 'planning', name: '个人安排', moduleIds: [] }],
      ungroupedModuleIds: []
    };
    assert.deepEqual((await firstApi.put('/api/workspace/layout').send(layout).expect(200)).body, layout);
    assert.deepEqual((await firstApi.get('/api/workspace/layout').expect(200)).body, layout);
    assert.deepEqual((await secondApi.get('/api/workspace/layout').expect(200)).body, emptyLayout);

    await firstApi.put('/api/workspace/layout').send({
      hiddenModuleIds: [],
      groups: [{ id: 'planning', name: '个人安排', moduleIds: ['unknown-module'] }],
      ungroupedModuleIds: []
    }).expect(400);
  } finally {
    context.cleanup();
  }
});

test('workspace layout remains available after an application restart', async () => {
  const context = createTestContext();
  const layout = {
    hiddenModuleIds: [],
    groups: [{ id: 'focus', name: '专注', moduleIds: [] }],
    ungroupedModuleIds: []
  };

  try {
    const registration = await register(request(context.app));
    const api = authAgent(context.app, registration.token);
    await api.put('/api/workspace/layout').send(layout).expect(200);
  } finally {
    context.dataStore.close();
  }

  const restarted = createApp({
    env: {
      nodeEnv: 'test',
      sqlitePath: context.sqlitePath,
      authSecret: 'teacher-workspace-api-secret'
    }
  });
  try {
    const token = await login(request(restarted.app));
    assert.deepEqual((await authAgent(restarted.app, token).get('/api/workspace/layout').expect(200)).body, layout);
  } finally {
    restarted.dataStore.close();
    fs.rmSync(context.rootDir, { recursive: true, force: true });
  }
});

test('protected workspace endpoints reject anonymous access', async () => {
  const context = createTestContext();

  try {
    await request(context.app).get('/api/modules').expect(401);
    await request(context.app).get('/api/workspace/layout').expect(401);
  } finally {
    context.cleanup();
  }
});
