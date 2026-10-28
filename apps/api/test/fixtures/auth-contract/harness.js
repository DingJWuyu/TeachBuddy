// Shared harness for auth contract verification.
//
// Everything runs over a real Express HTTP server on an ephemeral loopback
// port with an isolated SQLite file, a deterministic clock and a controllable
// fake mail adapter. No production identity, fixed verification code or
// in-process fault hook exists in the module itself: storage faults are
// injected here as real SQLite triggers and dropped again afterwards.

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import express from 'express';
import { createAuthModule } from '../../../src/features/auth/index.js';
import { migrations } from '../../../src/features/auth/migrations/index.js';

export const PAGE_1 = '0123456789abcdef0123456789abcdef';
export const PAGE_2 = 'fedcba9876543210fedcba9876543210';

export function applyMigrations(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id));
  const record = db.prepare('INSERT INTO schema_migrations (id, appliedAt) VALUES (?, ?)');
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      migration.up(db);
      record.run(migration.id, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // keep the original failure
      }
      throw error;
    }
  }
}

export function createClock(startIso = '2026-01-05T09:00:00.000Z') {
  let current = Date.parse(startIso);
  return {
    now: () => current,
    advance(milliseconds) {
      current += milliseconds;
      return current;
    },
    set(iso) {
      current = Date.parse(iso);
      return current;
    },
    iso: () => new Date(current).toISOString()
  };
}

export function createMailer() {
  const messages = [];
  let failures = 0;
  let gate = null;
  let releaseGate = null;
  return {
    messages,
    sendCode: async ({ purpose, email, verificationCode }) => {
      if (gate) {
        const waiting = gate;
        gate = null;
        await waiting;
      }
      if (failures > 0) {
        failures -= 1;
        const error = new Error('fake mail provider rejected delivery');
        error.code = 'FAKE_DELIVERY_REJECTED';
        throw error;
      }
      messages.push({ purpose, email, verificationCode });
    },
    failNext(count = 1) {
      failures += count;
    },
    pauseNext() {
      gate = new Promise((resolve) => {
        releaseGate = resolve;
      });
    },
    release() {
      if (releaseGate) releaseGate();
      releaseGate = null;
    },
    lastCode(purpose, email) {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].purpose === purpose && messages[index].email === email) return messages[index].verificationCode;
      }
      return null;
    },
    deliveredCount(purpose, email) {
      return messages.filter((message) => message.purpose === purpose && message.email === email).length;
    }
  };
}

export function createCookieJar() {
  const cookies = new Map();
  return {
    apply(setCookies = []) {
      for (const raw of setCookies) {
        const pair = raw.split(';')[0];
        const separator = pair.indexOf('=');
        if (separator === -1) continue;
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        const maxAge = /max-age=(-?\d+)/i.exec(raw);
        if (maxAge && Number(maxAge[1]) <= 0) cookies.delete(name);
        else if (value !== '') cookies.set(name, value);
      }
    },
    header() {
      return [...cookies.entries()].map(([name, value]) => name + '=' + value).join('; ');
    },
    get(name) {
      return cookies.get(name) ?? null;
    },
    set(name, value) {
      cookies.set(name, value);
    },
    size() {
      return cookies.size;
    }
  };
}

function requestOver(transport, baseUrl, method, requestPath, { headers, body }) {
  return new Promise((resolve, reject) => {
    const url = new URL(requestPath, baseUrl);
    const request = transport.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
        rejectUnauthorized: false
      },
      (response) => {
        const encrypted = Boolean(response.socket && response.socket.encrypted);
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const bytes = Buffer.concat(chunks);
          const text = bytes.toString('utf8');
          let json = null;
          if (text.length > 0 && (response.headers['content-type'] ?? '').includes('json')) {
            try {
              json = JSON.parse(text);
            } catch {
              json = null;
            }
          }
          resolve({
            status: response.statusCode,
            headers: response.headers,
            setCookies: response.headers['set-cookie'] ?? [],
            bytes,
            text,
            json,
            encrypted
          });
        });
      }
    );
    request.on('error', reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

export function createClient(baseUrl, options = {}) {
  const transport = options.transport ?? http;
  const client = {
    baseUrl,
    pageId: options.pageId ?? PAGE_1,
    jar: options.jar ?? createCookieJar(),

    async request(method, requestPath, options_ = {}) {
      const {
        body,
        rawBody,
        page = client.pageId,
        headers: extraHeaders = {},
        cookie = 'jar',
        contentType = body !== undefined || rawBody !== undefined ? 'application/json' : undefined,
        protect = true,
        origin = baseUrl
      } = options_;
      const headers = { ...extraHeaders };
      const lower = new Set(Object.keys(headers).map((key) => key.toLowerCase()));

      if (protect && method !== 'GET' && !lower.has('x-teachbuddy-request')) headers['X-TeachBuddy-Request'] = '1';
      if (method !== 'GET' && origin !== null && !lower.has('origin')) headers.Origin = origin;
      if (page !== null && !lower.has('x-teachbuddy-page')) headers['X-TeachBuddy-Page'] = page;
      if (contentType !== undefined && !lower.has('content-type')) headers['Content-Type'] = contentType;
      if (cookie === 'jar' && client.jar.size() > 0 && !lower.has('cookie')) headers.Cookie = client.jar.header();
      if (cookie !== 'jar' && cookie !== null && cookie !== undefined && !lower.has('cookie')) headers.Cookie = cookie;

      let payload;
      if (rawBody !== undefined) payload = rawBody;
      else if (body !== undefined) payload = JSON.stringify(body);
      if (payload !== undefined) headers['Content-Length'] = Buffer.byteLength(payload);

      const response = await requestOver(transport, baseUrl, method, requestPath, { headers, body: payload });
      client.jar.apply(response.setCookies);
      return response;
    }
  };
  return client;
}

function startExpressApp(app, options = {}) {
  return new Promise((resolve) => {
    const server = options.https ? https.createServer(options.https) : http.createServer();
    server.listen(options.port ?? 0, '127.0.0.1', () => {
      const { port } = server.address();
      server.on('request', app);
      resolve({ server, port });
    });
  });
}

export async function createWorld(options = {}) {
  const workDir = options.workDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'auth-contract-'));
  const dbPath = options.dbPath ?? path.join(workDir, 'auth.sqlite');
  const clock = options.clock ?? createClock(options.startIso);
  const mailer = options.mailer ?? createMailer();
  const tls = options.tls ?? null;
  const world = {
    workDir,
    dbPath,
    clock,
    mailer,
    tls,
    db: null,
    server: null,
    module: null,
    baseUrl: null,
    registrationOpen: options.registrationOpen ?? true,
    sendCount: 0
  };

  world.start = async () => {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    applyMigrations(db);
    world.db = db;
    const app = express();
    const { server, port } = await startExpressApp(app, tls ? { https: tls, port: options.port } : { port: options.port });
    app.get('/__auth-test-page', (request, response) => {
      response.type('html').send('<!doctype html><html><head><title>auth contract</title></head><body></body></html>');
    });
    world.baseUrl = (tls ? 'https://' : 'http://') + '127.0.0.1:' + port;
    const authModule = createAuthModule({
      db,
      publicOrigin: world.baseUrl,
      now: clock.now,
      sendCode: async (payload) => {
        world.sendCount += 1;
        return mailer.sendCode(payload);
      },
      isRegistrationOpen: () => world.registrationOpen,
      codeSecret: options.codeSecret ?? 'contract-test-code-secret'
    });
    world.module = authModule;
    app.use('/api/auth', authModule.router);
    app.use((request, response) => {
      response.status(404).json({ type: '/problems/auth/not-found' });
    });
    world.server = server;
  };

  world.stop = async () => {
    if (world.server) {
      await new Promise((resolve) => world.server.close(resolve));
      world.server = null;
    }
    if (world.db) {
      world.db.close();
      world.db = null;
    }
  };

  world.restart = async () => {
    await world.stop();
    await world.start();
  };

  world.client = (clientOptions = {}) => createClient(world.baseUrl, clientOptions);

  world.bootstrap = async (client) => {
    const response = await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    if (response.status !== 200) throw new Error('bootstrap failed: ' + response.status + ' ' + response.text);
    return response;
  };

  world.createAccount = async ({ email, nickname = '林老师', password = 'secret-9', rememberMe = true, pageId } = {}) => {
    const canonicalEmail = email.trim().toLowerCase();
    const client = world.client({ pageId });
    await world.bootstrap(client);
    const codeResponse = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
    if (codeResponse.status !== 200) throw new Error('registration code failed: ' + codeResponse.status + ' ' + codeResponse.text);
    const verificationCode = mailer.lastCode('registration', canonicalEmail);
    const registerResponse = await client.request('POST', '/api/auth/register', {
      body: {
        email,
        nickname,
        password,
        challengeId: codeResponse.json.challengeId,
        verificationCode,
        termsAccepted: true,
        rememberMe
      }
    });
    if (registerResponse.status !== 201) throw new Error('register failed: ' + registerResponse.status + ' ' + registerResponse.text);
    const sessionId = registerResponse.json.id;
    const activateResponse = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId, rememberMe }
    });
    if (activateResponse.status !== 200) throw new Error('activate failed: ' + activateResponse.status + ' ' + activateResponse.text);
    return {
      client,
      sessionId,
      password,
      email: registerResponse.json.account.email,
      nickname: registerResponse.json.account.nickname,
      accountKey: registerResponse.json.account.accountKey
    };
  };

  world.login = async (client, { email, password, rememberMe = false }) => {
    if (client.jar.size() === 0) await world.bootstrap(client);
    const response = await client.request('POST', '/api/auth/login', { body: { email, password, rememberMe } });
    if (response.status !== 200) throw new Error('login failed: ' + response.status + ' ' + response.text);
    const sessionId = response.json.id;
    const activated = await client.request('POST', '/api/auth/session', {
      body: { action: 'activate', sessionId, rememberMe }
    });
    if (activated.status !== 200) throw new Error('activate failed: ' + activated.status + ' ' + activated.text);
    return activated.json;
  };

  await world.start();
  return world;
}

// Fault injection uses real SQLite triggers, so rollback behaviour is exercised
// against the real transaction, not a mocked store.
export function injectFault(db, name, sql) {
  db.exec('CREATE TRIGGER ' + name + ' ' + sql);
}

export function clearFault(db, name) {
  db.exec('DROP TRIGGER IF EXISTS ' + name);
}

// Minimal lossy proxy: forwards the request to the real server, reads the real
// response, then destroys the client connection without forwarding it. Models a
// committed request whose response never reaches the browser.
export async function startLossyProxy(targetBaseUrl) {
  const target = new URL(targetBaseUrl);
  const proxy = http.createServer((request, response) => {
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: request.url ?? '/',
        method: request.method,
        headers: { ...request.headers, host: target.host, connection: 'close' }
      },
      (upstreamResponse) => {
        upstreamResponse.resume();
        upstreamResponse.on('end', () => {
          // The upstream exchange completed; the browser never sees it.
          response.destroy();
        });
      }
    );
    upstream.on('error', () => response.destroy());
    request.pipe(upstream);
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const { port } = proxy.address();
  return {
    baseUrl: 'http://127.0.0.1:' + port,
    close: () => new Promise((resolve) => proxy.close(resolve))
  };
}

export function generateSelfSignedCertificate(workDir) {
  const keyPath = path.join(workDir, 'tls-key.pem');
  const certPath = path.join(workDir, 'tls-cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '2',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1'
    ],
    { stdio: 'ignore' }
  );
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

export function expectProblem(response, { status, type, field, extra = {} } = {}) {
  const failures = [];
  if (response.status !== status) failures.push('status ' + response.status + ' !== ' + status);
  const contentType = response.headers['content-type'] ?? '';
  if (!contentType.startsWith('application/problem+json')) {
    failures.push('content-type ' + contentType + ' is not application/problem+json');
  }
  if ((response.headers['cache-control'] ?? '') !== 'no-store') {
    failures.push('cache-control ' + response.headers['cache-control'] + ' !== no-store');
  }
  const body = response.json ?? {};
  if (body.type !== '/problems/auth/' + type) failures.push('type ' + body.type + ' !== /problems/auth/' + type);
  if (body.status !== undefined && body.status !== response.status) failures.push('body status mismatch');
  if (field !== undefined && body.field !== field) failures.push('field ' + body.field + ' !== ' + field);
  for (const [key, value] of Object.entries(extra)) {
    if (body[key] !== value) failures.push(key + ' ' + body[key] + ' !== ' + value);
  }
  return failures;
}

export function assertProblem(response, expected) {
  const failures = expectProblem(response, expected);
  assert.deepEqual(
    failures,
    [],
    'problem mismatch for status ' + response.status + ': ' + response.text + ' -> ' + failures.join('; ')
  );
}

export function assertOk(response, status = 200) {
  assert.equal(response.status, status, 'unexpected status ' + response.status + ': ' + response.text);
  assert.equal(response.headers['cache-control'], 'no-store');
}

export function count(world, table) {
  return world.db.prepare('SELECT COUNT(*) AS total FROM ' + table).get().total;
}

export function nextTick() {
  return new Promise((resolve) => setImmediate(resolve));
}
