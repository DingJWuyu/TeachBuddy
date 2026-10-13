/**
 * In-memory substitute for the frozen first-flow workbench API.
 *
 * It is test infrastructure for the B14 UI suite: the same OpenAPI, cases and
 * error examples drive both sides, so the browser exercises the real request
 * shape, protection headers, idempotency and conflict semantics. It also serves
 * the production web build from one origin, which is what the contract requires
 * of the real entry point.
 *
 * Test-only controls (bootstrap, faults, stats) live under /__test__/ and never
 * exist in product code. Fault modes: `drop-response-after-commit`,
 * `drop-response-on-replay`, `fail-before-commit`, `delay-ms` and `fail-read`.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ACCOUNTS = {
  A: 'fixture-teacher-a',
  B: 'fixture-teacher-b'
};

const MODULE_CATALOG = {
  version: 1,
  items: [
    { id: 'questions', name: '题库', path: '/questions', navigation: 'sidebar', auxiliaryPanel: true, requires: [] },

  ]
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
};

const BODY_LIMIT = 2 * 1024 * 1024;

function emptyStore() {
  return {
    accounts: new Map(),
    faults: [],
    stats: { writes: 0, questions: { A: 0, B: 0 } }
  };
}

function accountData(store, accountKey) {
  if (!store.accounts.has(accountKey)) {
    store.accounts.set(accountKey, { questions: new Map(), idempotency: new Map() });
  }
  return store.accounts.get(accountKey);
}

function accountLabel(accountKey) {
  return accountKey === ACCOUNTS.A ? 'A' : accountKey === ACCOUNTS.B ? 'B' : accountKey;
}

/* ------------------------------------------------------------------ errors */

function problemBody(type, extra = {}) {
  return { type: `/problems/workbench/${type}`, ...extra };
}

const STATUS_BY_TYPE = {
  'malformed-json': 400,
  unauthenticated: 401,
  'request-not-allowed': 403,
  'not-found': 404,
  'version-conflict': 409,
  'reference-version-conflict': 409,
  'idempotency-key-reused': 409,
  'object-deleted': 409,
  'payload-too-large': 413,
  'unsupported-media-type': 415,
  'invalid-input': 422,
  'temporarily-unavailable': 503
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function sendProblem(res, type, extra = {}) {
  const status = STATUS_BY_TYPE[type] || 500;
  const payload = JSON.stringify(problemBody(type, extra));
  res.writeHead(status, {
    'content-type': 'application/problem+json',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function invalid(res, field, reason) {
  sendProblem(res, 'invalid-input', { field, reason });
}

/* -------------------------------------------------------------- validation */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapePointer(segment) {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Returns null when valid, otherwise {field, reason}. */
function checkObject(value, pointer, allowedKeys) {
  if (!isPlainObject(value)) return { field: pointer, reason: 'invalid-type' };
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key)).sort();
  if (unknown.length > 0) {
    return { field: `${pointer}/${escapePointer(unknown[0])}`, reason: 'unknown-field' };
  }
  return null;
}

function checkString(value, pointer, { minLength = 0, maxLength = Infinity, required = true } = {}) {
  if (value === undefined || value === null) {
    return required ? { field: pointer, reason: 'required' } : null;
  }
  if (typeof value !== 'string') return { field: pointer, reason: 'invalid-type' };
  if (value.length < minLength || value.length > maxLength) return { field: pointer, reason: 'out-of-range' };
  return null;
}

function checkUuid(value, pointer) {
  if (value === undefined || value === null) return { field: pointer, reason: 'required' };
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return { field: pointer, reason: 'invalid-type' };
  return null;
}

function checkVersion(value, pointer) {
  if (value === undefined || value === null) return { field: pointer, reason: 'required' };
  if (!Number.isInteger(value) || value < 1) return { field: pointer, reason: 'invalid-type' };
  return null;
}

function firstNonNull(...results) {
  return results.find((result) => result) || null;
}

function validateRun(run, pointer) {
  if (!isPlainObject(run)) return { field: pointer, reason: 'invalid-type' };
  if (run.type === 'text') {
    const unknown = checkObject(run, pointer, ['type', 'text']);
    if (unknown) return unknown;
    return checkString(run.text, `${pointer}/text`, { maxLength: 20000 });
  }
  if (run.type === 'math') {
    const unknown = checkObject(run, pointer, ['type', 'latex']);
    if (unknown) return unknown;
    return checkString(run.latex, `${pointer}/latex`, { minLength: 1, maxLength: 10000 });
  }
  return { field: `${pointer}/type`, reason: 'invalid-type' };
}

function validateDocument(document, pointer) {
  const shape = checkObject(document, pointer, ['version', 'blocks']);
  if (shape) return shape;
  if (document.version !== 1) return { field: `${pointer}/version`, reason: 'unsupported-content-version' };
  if (!Array.isArray(document.blocks)) return { field: `${pointer}/blocks`, reason: 'invalid-type' };
  if (document.blocks.length > 1000) return { field: `${pointer}/blocks`, reason: 'out-of-range' };
  for (let index = 0; index < document.blocks.length; index += 1) {
    const block = document.blocks[index];
    const blockPointer = `${pointer}/blocks/${index}`;
    const blockShape = checkObject(block, blockPointer, ['type', 'runs', 'latex']);
    if (blockShape) return blockShape;
    if (block.type === 'paragraph') {
      const unknown = checkObject(block, blockPointer, ['type', 'runs']);
      if (unknown) return unknown;
      if (!Array.isArray(block.runs)) return { field: `${blockPointer}/runs`, reason: 'invalid-type' };
      if (block.runs.length > 1000) return { field: `${blockPointer}/runs`, reason: 'out-of-range' };
      for (let runIndex = 0; runIndex < block.runs.length; runIndex += 1) {
        const runError = validateRun(block.runs[runIndex], `${blockPointer}/runs/${runIndex}`);
        if (runError) return runError;
      }
    } else if (block.type === 'math') {
      const unknown = checkObject(block, blockPointer, ['type', 'latex']);
      if (unknown) return unknown;
      const latexError = checkString(block.latex, `${blockPointer}/latex`, { minLength: 1, maxLength: 10000 });
      if (latexError) return latexError;
    } else {
      return { field: `${blockPointer}/type`, reason: 'invalid-type' };
    }
  }
  return null;
}

function documentHasContent(document) {
  return (document.blocks || []).some((block) => {
    if (block.type === 'math') return Boolean((block.latex || '').trim());
    return (block.runs || []).some((run) => (
      run.type === 'math' ? Boolean((run.latex || '').trim()) : Boolean((run.text || '').trim())
    ));
  });
}

function validateQuestionInput(body, { creating }) {
  const allowed = creating
    ? ['title', 'body', 'solution', 'note', 'starred', 'source']
    : ['baseVersion', 'title', 'body', 'solution', 'note', 'starred'];
  const shape = checkObject(body, '', allowed);
  if (shape) return shape;

  if (!creating) {
    const baseError = checkVersion(body.baseVersion, '/baseVersion');
    if (baseError) return baseError;
  }
  const titleError = checkString(body.title, '/title', { maxLength: 200 });
  if (titleError) return titleError;
  const bodyError = validateDocument(body.body, '/body');
  if (bodyError) return bodyError;
  if (!documentHasContent(body.body)) return { field: '/body', reason: 'empty-content' };
  const solutionError = validateDocument(body.solution, '/solution');
  if (solutionError) return solutionError;
  const noteError = checkString(body.note, '/note', { maxLength: 20000 });
  if (noteError) return noteError;
  if (typeof body.starred !== 'boolean') return { field: '/starred', reason: 'invalid-type' };

  if (creating) {
    if (!isPlainObject(body.source)) return { field: '/source', reason: 'invalid-type' };
    if (body.source.kind === 'manual') {
      return checkObject(body.source, '/source', ['kind']);
    }
    if (body.source.kind === 'paste') {
      const pasteShape = checkObject(body.source, '/source', ['kind', 'text']);
      if (pasteShape) return pasteShape;
      return checkString(body.source.text, '/source/text', { minLength: 1, maxLength: 100000 });
    }
    return { field: '/source/kind', reason: 'invalid-type' };
  }
  return null;
}

function validateDeletion(body) {
  const shape = checkObject(body, '', ['baseVersion', 'deleted']);
  if (shape) return shape;
  const baseError = checkVersion(body.baseVersion, '/baseVersion');
  if (baseError) return baseError;
  if (typeof body.deleted !== 'boolean') return { field: '/deleted', reason: 'invalid-type' };
  return null;
}

function validateCopy(body) {
  const shape = checkObject(body, '', ['baseVersion', 'title', 'body', 'solution', 'note', 'starred']);
  if (shape) return shape;
  const baseError = checkVersion(body.baseVersion, '/baseVersion');
  if (baseError) return baseError;
  const titleError = checkString(body.title, '/title', { maxLength: 200 });
  if (titleError) return titleError;
  const bodyError = validateDocument(body.body, '/body');
  if (bodyError) return bodyError;
  if (!documentHasContent(body.body)) return { field: '/body', reason: 'empty-content' };
  const solutionError = validateDocument(body.solution, '/solution');
  if (solutionError) return solutionError;
  const noteError = checkString(body.note, '/note', { maxLength: 20000 });
  if (noteError) return noteError;
  if (typeof body.starred !== 'boolean') return { field: '/starred', reason: 'invalid-type' };
  return null;
}

/* ------------------------------------------------------------- serializers */

function snapshotOf(question) {
  return {
    title: question.title,
    body: question.body,
    solution: question.solution
  };
}

function serializeQuestion(question) {
  return {
    id: question.id,
    version: question.version,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    deletedAt: question.deletedAt,
    title: question.title,
    body: question.body,
    solution: question.solution,
    note: question.note,
    starred: question.starred,
    source: question.source
  };
}

function questionSummary(question) {
  return {
    id: question.id,
    version: question.version,
    updatedAt: question.updatedAt,
    deletedAt: question.deletedAt,
    title: question.title,
    body: question.body,
    starred: question.starred
  };
}

/* --------------------------------------------------------------- searching */

function documentSearchText(document) {
  if (!document) return '';
  return (document.blocks || []).map((block) => {
    if (block.type === 'math') return block.latex || '';
    return (block.runs || []).map((run) => (run.type === 'math' ? run.latex : run.text) || '').join('');
  }).join(' ');
}

function matches(text, query) {
  if (!query) return true;
  return String(text).toLowerCase().includes(query.trim().toLowerCase());
}

function questionMatches(question, query) {
  if (!query.trim()) return true;
  return matches(question.title, query)
    || matches(documentSearchText(question.body), query)
    || matches(question.note, query);
}

function sortSummaries(items) {
  return items.sort((left, right) => {
    if (left.updatedAt === right.updatedAt) return left.id < right.id ? -1 : 1;
    return left.updatedAt > right.updatedAt ? -1 : 1;
  });
}

/* -------------------------------------------------------------- read model */

function readQuery(res, url, allowed) {
  for (const name of url.searchParams.keys()) {
    if (!allowed.includes(name)) {
      invalid(res, `/query/${name}`, 'unknown-field');
      return null;
    }
  }
  const state = url.searchParams.get('state') ?? 'active';
  if (state !== 'active' && state !== 'deleted') {
    invalid(res, '/query/state', 'out-of-range');
    return null;
  }
  const q = url.searchParams.get('q') ?? '';
  if (q.length > 200) {
    invalid(res, '/query/q', 'out-of-range');
    return null;
  }
  let starred;
  const starredRaw = url.searchParams.get('starred');
  if (starredRaw !== null) {
    if (starredRaw !== 'true' && starredRaw !== 'false') {
      invalid(res, '/query/starred', 'invalid-type');
      return null;
    }
    starred = starredRaw === 'true';
  }
  return { state, q, starred };
}

function filterQuestions(data, { state, q, starred }) {
  return sortSummaries([...data.questions.values()]
    .filter((question) => (state === 'deleted' ? Boolean(question.deletedAt) : !question.deletedAt))
    .filter((question) => (starred === undefined ? true : question.starred === starred))
    .filter((question) => questionMatches(question, q))
    .map(questionSummary));
}

/* ------------------------------------------------------------ write pipeline */

function fingerprint(method, path, body) {
  const canonical = JSON.stringify(body, (key, value) => {
    if (!isPlainObject(value)) return value;
    return Object.keys(value).sort().reduce((accumulator, name) => {
      accumulator[name] = value[name];
      return accumulator;
    }, {});
  });
  return `${method} ${path} ${canonical}`;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let overflow = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        overflow = true;
        chunks.length = 0;
        return;
      }
      if (!overflow) chunks.push(chunk);
    });
    req.on('end', () => resolve({ overflow, text: overflow ? '' : Buffer.concat(chunks).toString('utf-8') }));
    req.on('error', reject);
  });
}

function checkProtection(req, origin) {
  if (req.headers['x-teachbuddy-request'] !== '1') return problemBody('request-not-allowed');
  const requestOrigin = req.headers.origin;
  if (requestOrigin !== undefined) {
    if (requestOrigin !== origin) return problemBody('request-not-allowed');
    return null;
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.startsWith(`${origin}/`)) return null;
  return problemBody('request-not-allowed');
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function resolveAccount(req) {
  const value = readCookie(req, 'wb_session');
  if (!value) return null;
  return Object.values(ACCOUNTS).includes(value) ? value : null;
}

async function handleWrite(req, res, context, { method, path: requestPath, validate, commit }) {
  const trace = process.env.B14_TRACE ? (...args) => console.log('[sub]', ...args) : () => {};
  trace('write', method, requestPath, req.headers['idempotency-key']);
  const accountKey = resolveAccount(req);
  if (!accountKey) {
    sendProblem(res, 'unauthenticated');
    return;
  }
  const protection = checkProtection(req, context.origin);
  if (protection) {
    sendProblem(res, 'request-not-allowed');
    return;
  }
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim();
  if (contentType !== 'application/json') {
    sendProblem(res, 'unsupported-media-type');
    return;
  }
  const raw = await readRawBody(req);
  if (raw.overflow) {
    sendProblem(res, 'payload-too-large');
    return;
  }
  let body;
  try {
    body = JSON.parse(raw.text);
  } catch (error) {
    sendProblem(res, 'malformed-json');
    return;
  }
  const key = req.headers['idempotency-key'];
  if (key === undefined) {
    invalid(res, '/headers/Idempotency-Key', 'required');
    return;
  }
  if (typeof key !== 'string' || !UUID_PATTERN.test(key)) {
    invalid(res, '/headers/Idempotency-Key', 'invalid-type');
    return;
  }
  const shapeError = validate ? validate(body) : null;
  if (shapeError) {
    invalid(res, shapeError.field, shapeError.reason);
    return;
  }

  const data = accountData(context.store, accountKey);
  const record = data.idempotency.get(key);
  const print = fingerprint(method, requestPath, body);
  if (record) {
    if (record.fingerprint !== print) {
      sendProblem(res, 'idempotency-key-reused');
      return;
    }
    // A browser may resend a write whose response was lost; the replay is the
    // contract's answer. `drop-response-on-replay` exists so a test can keep the
    // result unknown even after that retry.
    const replayFault = takeFault(context.store, method, requestPath);
    trace('replay', requestPath, 'fault=', replayFault?.mode || 'none');
    if (replayFault?.mode === 'drop-response-on-replay') {
      req.socket.destroy();
      return;
    }
    sendJson(res, record.status, record.body);
    return;
  }

  const fault = takeFault(context.store, method, requestPath);
  if (fault?.mode === 'delay-ms') {
    await new Promise((resolve) => { setTimeout(resolve, fault.ms || 0); });
  }
  if (fault?.mode === 'fail-before-commit') {
    sendProblem(res, 'temporarily-unavailable');
    return;
  }

  context.store.stats.writes += 1;
  const result = commit(body, { accountKey, data });
  if (result.error) {
    const { type, extra } = result.error;
    sendProblem(res, type, extra);
    return;
  }
  data.idempotency.set(key, { fingerprint: print, status: result.status, body: result.body });

  if (fault?.mode === 'drop-response-after-commit') {
    trace('drop-after-commit', requestPath);
    req.socket.destroy();
    return;
  }
  trace('commit', requestPath, result.status);
  sendJson(res, result.status, result.body);
}

function takeFault(store, method, requestPath) {
  const index = store.faults.findIndex((fault) => {
    if (!fault.match) return true;
    if (fault.match.method && fault.match.method !== method) return false;
    if (fault.match.pathIncludes && !requestPath.includes(fault.match.pathIncludes)) return false;
    return true;
  });
  if (index < 0) return null;
  const fault = store.faults[index];
  if (fault.mode !== 'delay-ms') {
    fault.times -= 1;
    if (fault.times <= 0) store.faults.splice(index, 1);
  }
  return fault;
}

/* ------------------------------------------------------------------ routes */

function nowIso() {
  return new Date().toISOString();
}

function newObject(input) {
  const timestamp = nowIso();
  return {
    ...input,
    id: crypto.randomUUID(),
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null
  };
}

function conflict(res, currentVersion) {
  sendProblem(res, 'version-conflict', { currentVersion });
}

async function handleRequest(req, res, context) {
  const url = new URL(req.url, context.origin);
  const requestPath = url.pathname;
  const method = req.method || 'GET';

  if (requestPath.startsWith('/__test__/')) {
    await handleTestControl(req, res, context, requestPath, method);
    return true;
  }

  if (requestPath.startsWith('/api/')) {
    await handleApi(req, res, context, { url, requestPath, method });
    return true;
  }

  if (context.staticDir && (method === 'GET' || method === 'HEAD')) {
    serveStatic(res, context, requestPath);
    return true;
  }
  return false;
}

async function handleApi(req, res, context, { url, requestPath, method }) {
  if (method === 'GET') {
    // Read-side fault used to prove that a failed refresh keeps the content the
    // teacher already has instead of emptying the region.
    if (takeFault(context.store, method, requestPath)?.mode === 'fail-read') {
      sendProblem(res, 'temporarily-unavailable');
      return;
    }
  }

  if (requestPath === '/api/workbench/context' && method === 'GET') {
    const accountKey = resolveAccount(req);
    if (!accountKey) {
      sendProblem(res, 'unauthenticated');
      return;
    }
    sendJson(res, 200, { accountKey });
    return;
  }

  if (requestPath === '/api/modules' && method === 'GET') {
    const accountKey = resolveAccount(req);
    if (!accountKey) {
      sendProblem(res, 'unauthenticated');
      return;
    }
    sendJson(res, 200, MODULE_CATALOG);
    return;
  }

  const questionItem = requestPath.match(/^\/api\/modules\/questions\/items\/([^/]+)$/);
  const questionCopies = requestPath.match(/^\/api\/modules\/questions\/items\/([^/]+)\/copies$/);
  const questionDeletion = requestPath.match(/^\/api\/modules\/questions\/items\/([^/]+)\/deletion$/);

  if (requestPath === '/api/modules/questions/items' && method === 'GET') {
    const accountKey = resolveAccount(req);
    if (!accountKey) return sendProblem(res, 'unauthenticated');
    const query = readQuery(res, url, ['q', 'state', 'starred']);
    if (!query) return;
    const data = accountData(context.store, accountKey);
    sendJson(res, 200, { items: filterQuestions(data, query) });
    return;
  }

  if (requestPath === '/api/modules/questions/items' && method === 'POST') {
    await handleWrite(req, res, context, {
      method,
      path: requestPath,
      validate: (body) => validateQuestionInput(body, { creating: true }),
      commit: (body, { accountKey, data }) => {
        const question = newObject({
          title: body.title,
          body: body.body,
          solution: body.solution,
          note: body.note,
          starred: body.starred,
          source: body.source
        });
        data.questions.set(question.id, question);
        context.store.stats.questions[accountLabel(accountKey)] += 1;
        return { status: 201, body: serializeQuestion(question) };
      }
    });
    return;
  }

  if (questionItem && method === 'GET') {
    const accountKey = resolveAccount(req);
    if (!accountKey) return sendProblem(res, 'unauthenticated');
    const data = accountData(context.store, accountKey);
    const question = data.questions.get(questionItem[1]);
    if (!question) return sendProblem(res, 'not-found');
    sendJson(res, 200, serializeQuestion(question));
    return;
  }

  if (questionItem && method === 'PUT') {
    await handleWrite(req, res, context, {
      method,
      path: requestPath,
      validate: (body) => validateQuestionInput(body, { creating: false }),
      commit: (body, { accountKey, data }) => {
        const question = data.questions.get(questionItem[1]);
        if (!question) return { error: { type: 'not-found' } };
        if (question.deletedAt) return { error: { type: 'object-deleted' } };
        if (question.version !== body.baseVersion) {
          return { error: { type: 'version-conflict', extra: { currentVersion: question.version } } };
        }
        const updated = {
          ...question,
          version: question.version + 1,
          updatedAt: nowIso(),
          title: body.title,
          body: body.body,
          solution: body.solution,
          note: body.note,
          starred: body.starred
        };
        data.questions.set(updated.id, updated);
        return { status: 200, body: serializeQuestion(updated) };
      }
    });
    return;
  }

  if (questionCopies && method === 'GET') {
    const accountKey = resolveAccount(req);
    if (!accountKey) return sendProblem(res, 'unauthenticated');
    const query = readQuery(res, url, ['state']);
    if (!query) return;
    const data = accountData(context.store, accountKey);
    if (!data.questions.get(questionCopies[1])) return sendProblem(res, 'not-found');
    const items = sortSummaries([...data.questions.values()]
      .filter((question) => question.source?.kind === 'copy' && question.source.questionId === questionCopies[1])
      .filter((question) => (query.state === 'deleted' ? Boolean(question.deletedAt) : !question.deletedAt))
      .map(questionSummary));
    sendJson(res, 200, { items });
    return;
  }

  if (questionCopies && method === 'POST') {
    await handleWrite(req, res, context, {
      method,
      path: requestPath,
      validate: validateCopy,
      commit: (body, { accountKey, data }) => {
        const source = data.questions.get(questionCopies[1]);
        if (!source) return { error: { type: 'not-found' } };
        if (source.deletedAt) return { error: { type: 'object-deleted' } };
        if (source.version !== body.baseVersion) {
          return { error: { type: 'version-conflict', extra: { currentVersion: source.version } } };
        }
        const copy = newObject({
          title: body.title,
          body: body.body,
          solution: body.solution,
          note: body.note,
          starred: body.starred,
          source: {
            kind: 'copy',
            questionId: source.id,
            questionVersion: source.version,
            snapshot: snapshotOf(source)
          }
        });
        data.questions.set(copy.id, copy);
        context.store.stats.questions[accountLabel(accountKey)] += 1;
        return { status: 201, body: serializeQuestion(copy) };
      }
    });
    return;
  }

  if (questionDeletion && method === 'POST') {
    await handleWrite(req, res, context, {
      method,
      path: requestPath,
      validate: validateDeletion,
      commit: (body, { data }) => {
        const question = data.questions.get(questionDeletion[1]);
        if (!question) return { error: { type: 'not-found' } };
        if (question.version !== body.baseVersion) {
          return { error: { type: 'version-conflict', extra: { currentVersion: question.version } } };
        }
        const updated = {
          ...question,
          version: question.version + 1,
          updatedAt: nowIso(),
          deletedAt: body.deleted ? nowIso() : null
        };
        data.questions.set(updated.id, updated);
        return { status: 200, body: serializeQuestion(updated) };
      }
    });
    return;
  }

  if (requestPath.startsWith('/api/')) {
    sendProblem(res, 'not-found');
    return;
  }
}

/* ------------------------------------------------------------ test control */

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf-8')) : {});
      } catch (error) {
        resolve({});
      }
    });
  });
}

async function handleTestControl(req, res, context, requestPath, method) {
  if (requestPath === '/__test__/bootstrap' && method === 'POST') {
    const body = await readJsonBody(req);
    const accountKey = ACCOUNTS[body.account];
    if (!accountKey) {
      sendJson(res, 400, { error: 'unknown account' });
      return;
    }
    res.setHeader('set-cookie', `wb_session=${accountKey}; Path=/; HttpOnly; SameSite=Lax`);
    sendJson(res, 200, { accountKey });
    return;
  }
  if (requestPath === '/__test__/signout' && method === 'POST') {
    res.setHeader('set-cookie', 'wb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    sendJson(res, 200, { ok: true });
    return;
  }
  if (requestPath === '/__test__/reset' && method === 'POST') {
    context.store.accounts = new Map();
    context.store.faults = [];
    context.store.stats = { writes: 0, questions: { A: 0, B: 0 } };
    sendJson(res, 200, { ok: true });
    return;
  }
  if (requestPath === '/__test__/fault' && method === 'POST') {
    const body = await readJsonBody(req);
    if (!['drop-response-after-commit', 'drop-response-on-replay', 'fail-before-commit', 'delay-ms', 'fail-read'].includes(body.mode)) {
      sendJson(res, 400, { error: 'unknown fault mode' });
      return;
    }
    context.store.faults.push({
      mode: body.mode,
      match: body.match || null,
      times: body.mode === 'delay-ms' ? Number.MAX_SAFE_INTEGER : (body.times || 1),
      ms: body.ms || 0
    });
    sendJson(res, 200, { ok: true });
    return;
  }
  if (requestPath === '/__test__/clear-faults' && method === 'POST') {
    context.store.faults = [];
    sendJson(res, 200, { ok: true });
    return;
  }
  if (requestPath === '/__test__/stats' && method === 'GET') {
    const { accounts, ...rest } = context.store;
    sendJson(res, 200, {
      ...rest,
      objects: {
        A: {
          questions: accountData(context.store, ACCOUNTS.A).questions.size,
        },
        B: {
          questions: accountData(context.store, ACCOUNTS.B).questions.size,
        }
      }
    });
    return;
  }
  sendJson(res, 404, { error: 'unknown test control' });
}

/* ------------------------------------------------------------------ static */

function serveStatic(res, context, requestPath) {
  const root = context.staticDir;
  const relative = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath).replace(/^\/+/, '');
  const candidate = path.join(root, relative);
  const resolved = path.resolve(candidate);
  const file = resolved.startsWith(path.resolve(root)) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()
    ? resolved
    : path.join(root, 'index.html');
  try {
    const content = fs.readFileSync(file);
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': content.length
    });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
}

/* -------------------------------------------------------------------- boot */

export async function startWorkbenchSubstitute({ port = 0, host = '127.0.0.1', staticDir = null } = {}) {
  const store = emptyStore();
  const context = { store, origin: '', staticDir };

  const server = http.createServer((req, res) => {
    handleRequest(req, res, context).catch(() => {
      if (!res.headersSent) sendProblem(res, 'temporarily-unavailable');
      else res.destroy();
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  context.origin = `http://${host}:${address.port}`;

  return {
    origin: context.origin,
    port: address.port,
    accounts: { ...ACCOUNTS },
    store,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
    control: {
      reset() {
        store.accounts = new Map();
        store.faults = [];
        store.stats = { writes: 0, questions: { A: 0, B: 0 } };
      },
      setFault({ mode, match = null, times = 1, ms = 0 }) {
        store.faults.push({ mode, match, times: mode === 'delay-ms' ? Number.MAX_SAFE_INTEGER : times, ms });
      },
      clearFaults() {
        store.faults = [];
      },
      stats() {
        return {
          ...store.stats,
          objects: {
            A: {
              questions: accountData(store, ACCOUNTS.A).questions.size,
            },
            B: {
              questions: accountData(store, ACCOUNTS.B).questions.size,
            }
          }
        };
      },
      seedQuestion({ account = 'A', title = '', bodyText = '示例题面', note = '', starred = false } = {}) {
        const data = accountData(store, ACCOUNTS[account]);
        const question = newObject({
          title,
          body: {
            version: 1,
            blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: bodyText }] }]
          },
          solution: { version: 1, blocks: [] },
          note,
          starred,
          source: { kind: 'manual' }
        });
        data.questions.set(question.id, question);
        store.stats.questions[account] += 1;
        return question;
      }
    }
  };
}
