/*
 * Local HTTP substitute for the account-entry contract (auth 1.0.0-rc.2) plus
 * the minimum protected workbench surface the transport needs. It is a test
 * process only: fixture control endpoints and fault injection never ship.
 *
 * It speaks the documented HTTP shapes (status, media type, no-store, delays,
 * cookie attributes) and keeps accounts, challenges, sessions and containers
 * in memory so tests can inspect real server-side effects.
 *
 * Fault keys accepted by POST /__fixture/faults:
 *   operation: login | registration-codes | register | password-reset-codes |
 *              password-reset | session-get | session-post | logout
 *     kind:    delay (ms, before handling) | problem (type, extra, headers) |
 *              unknown-problem (status, type) | malformed (status, body) |
 *              raw-status (status, contentType, body) |
 *              drop-after (handled, socket reset) | hang-after (handled, no
 *              response) | drop-before (socket reset, not handled)
 *   internal store keys, applied before the commit so failures really roll
 *   back: account-store-read | account-store-write | session-store-read |
 *           session-store-write | session-persistence | code-delivery
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHarness } from './harness-build.mjs';
import { WORKBENCH_STATUS, workbenchKey } from './workbench-operations.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const EMAIL_RE =
  /^(?=.{1,254}$)(?=.{1,64}@)[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const PAGE_RE = /^[0-9a-f]{32}$/;
const CODE_RE = /^[0-9]{6}$/;
const OPAQUE_RE = /^[A-Za-z0-9_-]{1,200}$/;
const COOKIE_NAME = '__Host-teachbuddy_session';

const PROBLEM = {
  REQUEST_NOT_ALLOWED: '/problems/auth/request-not-allowed',
  MALFORMED_JSON: '/problems/auth/malformed-json',
  UNSUPPORTED_MEDIA_TYPE: '/problems/auth/unsupported-media-type',
  INVALID_REQUEST_BODY: '/problems/auth/invalid-request-body',
  UNKNOWN_FIELD: '/problems/auth/unknown-field',
  REQUIRED_FIELD: '/problems/auth/required-field',
  INVALID_FIELD_TYPE: '/problems/auth/invalid-field-type',
  INVALID_FIELD_VALUE: '/problems/auth/invalid-field-value',
  EMAIL_EMPTY: '/problems/auth/email-empty',
  EMAIL_INVALID_FORMAT: '/problems/auth/email-invalid-format',
  NICKNAME_EMPTY: '/problems/auth/nickname-empty',
  NICKNAME_TOO_LONG: '/problems/auth/nickname-too-long',
  PASSWORD_TOO_SHORT: '/problems/auth/password-too-short',
  PASSWORD_TOO_LONG: '/problems/auth/password-too-long',
  VERIFICATION_CODE_INVALID_FORMAT: '/problems/auth/verification-code-invalid-format',
  TERMS_NOT_ACCEPTED: '/problems/auth/terms-not-accepted',
  EMAIL_ALREADY_REGISTERED: '/problems/auth/email-already-registered',
  EMAIL_NOT_REGISTERED: '/problems/auth/email-not-registered',
  CREDENTIALS_REJECTED: '/problems/auth/credentials-rejected',
  REGISTRATION_CLOSED: '/problems/auth/registration-closed',
  VERIFICATION_CODE_MISSING: '/problems/auth/verification-code-missing',
  VERIFICATION_CODE_BINDING_MISMATCH: '/problems/auth/verification-code-binding-mismatch',
  VERIFICATION_CODE_CONSUMED: '/problems/auth/verification-code-consumed',
  VERIFICATION_CODE_REPLACED: '/problems/auth/verification-code-replaced',
  VERIFICATION_CODE_EXPIRED: '/problems/auth/verification-code-expired',
  VERIFICATION_CODE_INCORRECT: '/problems/auth/verification-code-incorrect',
  VERIFICATION_CODE_EXHAUSTED: '/problems/auth/verification-code-exhausted',
  CODE_SEND_COOLDOWN: '/problems/auth/code-send-cooldown',
  CODE_DELIVERY_UNAVAILABLE: '/problems/auth/code-delivery-unavailable',
  ACCOUNT_STORE_UNAVAILABLE: '/problems/auth/account-store-unavailable',
  SESSION_PERSISTENCE_UNAVAILABLE: '/problems/auth/session-persistence-unavailable',
  SESSION_STORE_UNAVAILABLE: '/problems/auth/session-store-unavailable',
  BROWSER_CONTEXT_REQUIRED: '/problems/auth/browser-context-required',
  SESSION_INVALID: '/problems/auth/session-invalid',
  SESSION_STATE_CONFLICT: '/problems/auth/session-state-conflict',
  SERVICE_UNAVAILABLE: '/problems/auth/service-unavailable',
};

const PROBLEM_STATUS = {
  [PROBLEM.REQUEST_NOT_ALLOWED]: 403,
  [PROBLEM.MALFORMED_JSON]: 400,
  [PROBLEM.UNSUPPORTED_MEDIA_TYPE]: 415,
  [PROBLEM.INVALID_REQUEST_BODY]: 422,
  [PROBLEM.UNKNOWN_FIELD]: 422,
  [PROBLEM.REQUIRED_FIELD]: 422,
  [PROBLEM.INVALID_FIELD_TYPE]: 422,
  [PROBLEM.INVALID_FIELD_VALUE]: 422,
  [PROBLEM.EMAIL_EMPTY]: 422,
  [PROBLEM.EMAIL_INVALID_FORMAT]: 422,
  [PROBLEM.NICKNAME_EMPTY]: 422,
  [PROBLEM.NICKNAME_TOO_LONG]: 422,
  [PROBLEM.PASSWORD_TOO_SHORT]: 422,
  [PROBLEM.PASSWORD_TOO_LONG]: 422,
  [PROBLEM.VERIFICATION_CODE_INVALID_FORMAT]: 422,
  [PROBLEM.TERMS_NOT_ACCEPTED]: 422,
  [PROBLEM.EMAIL_ALREADY_REGISTERED]: 409,
  [PROBLEM.EMAIL_NOT_REGISTERED]: 422,
  [PROBLEM.CREDENTIALS_REJECTED]: 401,
  [PROBLEM.REGISTRATION_CLOSED]: 403,
  [PROBLEM.VERIFICATION_CODE_MISSING]: 422,
  [PROBLEM.VERIFICATION_CODE_BINDING_MISMATCH]: 422,
  [PROBLEM.VERIFICATION_CODE_CONSUMED]: 422,
  [PROBLEM.VERIFICATION_CODE_REPLACED]: 422,
  [PROBLEM.VERIFICATION_CODE_EXPIRED]: 422,
  [PROBLEM.VERIFICATION_CODE_INCORRECT]: 422,
  [PROBLEM.VERIFICATION_CODE_EXHAUSTED]: 422,
  [PROBLEM.CODE_SEND_COOLDOWN]: 429,
  [PROBLEM.CODE_DELIVERY_UNAVAILABLE]: 503,
  [PROBLEM.ACCOUNT_STORE_UNAVAILABLE]: 503,
  [PROBLEM.SESSION_PERSISTENCE_UNAVAILABLE]: 503,
  [PROBLEM.SESSION_STORE_UNAVAILABLE]: 503,
  [PROBLEM.BROWSER_CONTEXT_REQUIRED]: 409,
  [PROBLEM.SESSION_INVALID]: 401,
  [PROBLEM.SESSION_STATE_CONFLICT]: 409,
  [PROBLEM.SERVICE_UNAVAILABLE]: 503,
};

const FIELD_PROBLEMS = new Set([
  PROBLEM.REQUIRED_FIELD,
  PROBLEM.INVALID_FIELD_TYPE,
  PROBLEM.INVALID_FIELD_VALUE,
  PROBLEM.EMAIL_EMPTY,
  PROBLEM.EMAIL_INVALID_FORMAT,
  PROBLEM.NICKNAME_EMPTY,
  PROBLEM.NICKNAME_TOO_LONG,
  PROBLEM.PASSWORD_TOO_SHORT,
  PROBLEM.PASSWORD_TOO_LONG,
  PROBLEM.VERIFICATION_CODE_INVALID_FORMAT,
  PROBLEM.TERMS_NOT_ACCEPTED,
  PROBLEM.EMAIL_NOT_REGISTERED,
  PROBLEM.VERIFICATION_CODE_MISSING,
  PROBLEM.VERIFICATION_CODE_BINDING_MISMATCH,
  PROBLEM.VERIFICATION_CODE_CONSUMED,
  PROBLEM.VERIFICATION_CODE_REPLACED,
  PROBLEM.VERIFICATION_CODE_EXPIRED,
  PROBLEM.VERIFICATION_CODE_INCORRECT,
  PROBLEM.VERIFICATION_CODE_EXHAUSTED,
]);


// ---------------------------------------------------------------------------
// state

export function createState() {
  return {
    accounts: new Map(),
    challenges: new Map(),
    sessions: new Map(),
    containers: new Map(),
    mail: [],
    requests: [],
    faults: new Map(),
    counters: { account: 0, session: 0, challenge: 0, container: 0 },
    config: {
      origin: null,
      registrationOpen: true,
      codeTtlMs: 10 * 60 * 1000,
      resendCooldownMs: 30 * 1000,
      sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
      timeOffsetMs: 0,
    },
  };
}

const now = (state) => Date.now() + state.config.timeOffsetMs;

function seedAccount(state, { email, nickname, password }) {
  const canonical = normalizeEmail(String(email));
  state.counters.account += 1;
  const account = {
    accountKey: `acct-${state.counters.account}`,
    email: canonical,
    nickname: String(nickname),
    password: String(password),
  };
  state.accounts.set(canonical, account);
  return account;
}

// ---------------------------------------------------------------------------
// helpers

function normalizeEmail(value) {
  return String(value).trim().replace(/[A-Z]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));
}

function codePoints(value) {
  return Array.from(String(value)).length;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCookies(header) {
  const jar = new Map();
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    jar.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  return jar;
}

function sendJson(res, status, body, headers = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': body === undefined ? 'application/json' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function sendProblem(res, type, extra = {}, headers = {}) {
  const status = PROBLEM_STATUS[type] ?? 422;
  const body = { type, status, ...extra };
  if (!FIELD_PROBLEMS.has(type)) delete body.field;
  sendJson(res, status, body, { 'Content-Type': 'application/problem+json; charset=utf-8', ...headers });
}

function problemResult(type, extra = {}, headers = {}) {
  return { status: PROBLEM_STATUS[type] ?? 422, problem: type, extra, headers };
}

function okResult(status, body, headers = {}) {
  return { status, body, headers };
}

function sessionJson(session) {
  return {
    id: session.id,
    account: {
      accountKey: session.account.accountKey,
      email: session.account.email,
      nickname: session.account.nickname,
    },
    state: session.state,
    persistence: session.state === 'pending' ? 'page' : session.persistence,
    rememberRequested: session.rememberRequested,
    issuedAt: new Date(session.issuedAt).toISOString(),
    expiresAt: session.expiresAt === null ? null : new Date(session.expiresAt).toISOString(),
  };
}

function challengeJson(state, challenge) {
  return {
    challengeId: challenge.id,
    purpose: challenge.purpose,
    email: challenge.email,
    issuedAt: new Date(challenge.issuedAt).toISOString(),
    expiresAt: new Date(challenge.expiresAt).toISOString(),
    resendAt: new Date(challenge.resendAt).toISOString(),
    serverTime: new Date(now(state)).toISOString(),
    remainingAttempts: 5,
  };
}

function isExpired(state, timestamp) {
  return timestamp !== null && timestamp !== undefined && now(state) >= timestamp;
}

function sessionValid(state, session) {
  return Boolean(session) && !session.revoked && !isExpired(state, session.expiresAt);
}

function containerSession(state, container, pageId) {
  if (!container || !pageId) return null;
  const sessionId = container.pages.get(pageId);
  if (!sessionId) return null;
  const session = state.sessions.get(sessionId);
  return sessionValid(state, session) ? session : null;
}

function rememberTarget(state, container) {
  if (!container?.remembered) return null;
  const session = state.sessions.get(container.remembered);
  if (!sessionValid(state, session) || session.persistence !== 'remembered' || session.state !== 'active') {
    return null;
  }
  return session;
}

function statusJson(state, container, pageId) {
  const session = containerSession(state, container, pageId);
  const remembered = rememberTarget(state, container);
  return {
    browserReady: Boolean(container),
    registrationOpen: state.config.registrationOpen,
    session: session ? sessionJson(session) : null,
    rememberedSession: remembered
      ? { id: remembered.id, expiresAt: new Date(remembered.expiresAt).toISOString() }
      : null,
    serverTime: new Date(now(state)).toISOString(),
  };
}

function cookieAttributes(state, { clear = false, maxAgeSeconds = null } = {}) {
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'Secure', 'Path=/', 'SameSite=Lax'];
  if (clear) {
    parts[0] = `${COOKIE_NAME}=`;
    parts.push('Max-Age=0');
    return parts.join('; ');
  }
  if (maxAgeSeconds !== null) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
    parts.push(`Expires=${new Date(now(state) + maxAgeSeconds * 1000).toUTCString()}`);
  }
  return parts.join('; ');
}

function revokeSession(state, session) {
  session.revoked = true;
  for (const container of state.containers.values()) {
    for (const [pageId, sessionId] of container.pages) {
      if (sessionId === session.id) container.pages.delete(pageId);
    }
    if (container.remembered === session.id) container.remembered = null;
  }
}

function containerHasIdentity(state, container) {
  if (!container) return false;
  for (const sessionId of container.pages.values()) {
    if (sessionValid(state, state.sessions.get(sessionId))) return true;
  }
  return Boolean(rememberTarget(state, container));
}

// ---------------------------------------------------------------------------
// body validation

function requiredField(body, field) {
  if (!(field in body)) return problemResult(PROBLEM.REQUIRED_FIELD, { field });
  return null;
}

function fieldType(body, field, type) {
  if (typeof body[field] !== type) return problemResult(PROBLEM.INVALID_FIELD_TYPE, { field });
  return null;
}

function unknownField(body, allowed) {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) return problemResult(PROBLEM.UNKNOWN_FIELD, { field: key });
  }
  return null;
}

function emailResult(value) {
  const canonical = normalizeEmail(value);
  if (!canonical) return problemResult(PROBLEM.EMAIL_EMPTY, { field: 'email' });
  if (canonical.length > 254 || !EMAIL_RE.test(canonical)) {
    return problemResult(PROBLEM.EMAIL_INVALID_FORMAT, { field: 'email' });
  }
  return { canonical };
}

function passwordResult(value) {
  const length = codePoints(value);
  if (length < 8) return problemResult(PROBLEM.PASSWORD_TOO_SHORT, { field: 'password' });
  if (length > 128) return problemResult(PROBLEM.PASSWORD_TOO_LONG, { field: 'password' });
  return null;
}

function challengeIdShape(value) {
  if (typeof value !== 'string') return problemResult(PROBLEM.INVALID_FIELD_TYPE, { field: 'challengeId' });
  if (value === '') return problemResult(PROBLEM.VERIFICATION_CODE_MISSING, { field: 'verificationCode' });
  if (!OPAQUE_RE.test(value)) return problemResult(PROBLEM.INVALID_FIELD_VALUE, { field: 'challengeId' });
  return null;
}

function codeShape(value) {
  if (typeof value !== 'string') return problemResult(PROBLEM.INVALID_FIELD_TYPE, { field: 'verificationCode' });
  if (!CODE_RE.test(value)) {
    return problemResult(PROBLEM.VERIFICATION_CODE_INVALID_FORMAT, { field: 'verificationCode' });
  }
  return null;
}

function checkChallenge(state, { challengeId, purpose, email, code }) {
  const challenge = state.challenges.get(challengeId);
  if (!challenge) {
    return problemResult(PROBLEM.VERIFICATION_CODE_MISSING, { field: 'verificationCode' });
  }
  if (challenge.purpose !== purpose || challenge.email !== email) {
    return problemResult(PROBLEM.VERIFICATION_CODE_BINDING_MISMATCH, { field: 'verificationCode' });
  }
  if (challenge.consumed) {
    return problemResult(PROBLEM.VERIFICATION_CODE_CONSUMED, { field: 'verificationCode' });
  }
  if (challenge.replaced) {
    return problemResult(PROBLEM.VERIFICATION_CODE_REPLACED, { field: 'verificationCode' });
  }
  if (isExpired(state, challenge.expiresAt)) {
    return problemResult(PROBLEM.VERIFICATION_CODE_EXPIRED, { field: 'verificationCode' });
  }
  if (challenge.attemptsLeft <= 0) {
    return problemResult(PROBLEM.VERIFICATION_CODE_EXHAUSTED, {
      field: 'verificationCode',
      remainingAttempts: 0,
    });
  }
  if (challenge.code !== code) {
    challenge.attemptsLeft -= 1;
    if (challenge.attemptsLeft <= 0) {
      return problemResult(PROBLEM.VERIFICATION_CODE_EXHAUSTED, {
        field: 'verificationCode',
        remainingAttempts: 0,
      });
    }
    return problemResult(PROBLEM.VERIFICATION_CODE_INCORRECT, {
      field: 'verificationCode',
      remainingAttempts: challenge.attemptsLeft,
    });
  }
  return { challenge };
}

// ---------------------------------------------------------------------------
// operations

function handleLogin(state, ctx, body) {
  const shape = unknownField(body, ['email', 'password', 'rememberMe'])
    || requiredField(body, 'email')
    || fieldType(body, 'email', 'string')
    || requiredField(body, 'password')
    || fieldType(body, 'password', 'string')
    || requiredField(body, 'rememberMe')
    || fieldType(body, 'rememberMe', 'boolean');
  if (shape) return shape;
  const email = emailResult(body.email);
  if (email.problem) return email;
  const password = passwordResult(body.password);
  if (password) return password;
  if (!ctx.container || !ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
  const fault = takeFault(state, 'account-store-read');
  if (fault) return problemResult(PROBLEM.ACCOUNT_STORE_UNAVAILABLE);
  const account = state.accounts.get(email.canonical);
  if (!account || account.password !== body.password) {
    return problemResult(PROBLEM.CREDENTIALS_REJECTED);
  }
  state.counters.session += 1;
  const session = {
    id: `sess-${state.counters.session}`,
    account,
    state: 'pending',
    persistence: 'page',
    rememberRequested: body.rememberMe,
    issuedAt: now(state),
    expiresAt: body.rememberMe ? now(state) + state.config.sessionTtlMs : null,
    pageId: ctx.pageId,
    revoked: false,
  };
  state.sessions.set(session.id, session);
  ctx.container.pages.set(ctx.pageId, session.id);
  return okResult(200, sessionJson(session));
}

function createChallenge(state, { purpose, email }) {
  for (const challenge of state.challenges.values()) {
    if (challenge.purpose === purpose && challenge.email === email && !challenge.consumed && !challenge.replaced) {
      challenge.replaced = true;
    }
  }
  state.counters.challenge += 1;
  const challenge = {
    id: `chal-${state.counters.challenge}`,
    purpose,
    email,
    code: String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0'),
    issuedAt: now(state),
    expiresAt: now(state) + state.config.codeTtlMs,
    resendAt: now(state) + state.config.resendCooldownMs,
    attemptsLeft: 5,
    consumed: false,
    replaced: false,
  };
  state.challenges.set(challenge.id, challenge);
  state.mail.push({
    purpose,
    email,
    code: challenge.code,
    challengeId: challenge.id,
    at: new Date(now(state)).toISOString(),
  });
  return challenge;
}

function handleCodeRequest(state, ctx, body, purpose) {
  const shape = unknownField(body, ['email'])
    || requiredField(body, 'email')
    || fieldType(body, 'email', 'string');
  if (shape) return shape;
  const email = emailResult(body.email);
  if (email.problem) return email;
  if (!ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
  if (purpose === 'registration' && !state.config.registrationOpen) {
    return problemResult(PROBLEM.REGISTRATION_CLOSED);
  }
  if (takeFault(state, 'account-store-read')) {
    return problemResult(PROBLEM.ACCOUNT_STORE_UNAVAILABLE);
  }
  const account = state.accounts.get(email.canonical);
  if (purpose === 'registration' && account) {
    return problemResult(PROBLEM.EMAIL_ALREADY_REGISTERED, { field: 'email' });
  }
  if (purpose === 'password-reset' && !account) {
    return problemResult(PROBLEM.EMAIL_NOT_REGISTERED, { field: 'email' });
  }
  const active = [...state.challenges.values()].find(
    (item) => item.purpose === purpose && item.email === email.canonical && !item.consumed && !item.replaced,
  );
  if (active && !isExpired(state, active.resendAt)) {
    const retryAfter = Math.max(1, Math.ceil((active.resendAt - now(state)) / 1000));
    return {
      status: 429,
      problem: PROBLEM.CODE_SEND_COOLDOWN,
      extra: { retryAfterSeconds: retryAfter, resendAt: new Date(active.resendAt).toISOString() },
      headers: { 'Retry-After': String(retryAfter) },
    };
  }
  if (takeFault(state, 'code-delivery')) {
    return problemResult(PROBLEM.CODE_DELIVERY_UNAVAILABLE);
  }
  const challenge = createChallenge(state, { purpose, email: email.canonical });
  return okResult(200, challengeJson(state, challenge));
}

function handleRegister(state, ctx, body) {
  const shape = unknownField(
    body,
    ['email', 'nickname', 'password', 'challengeId', 'verificationCode', 'termsAccepted', 'rememberMe'],
  )
    || requiredField(body, 'email')
    || fieldType(body, 'email', 'string')
    || requiredField(body, 'nickname')
    || fieldType(body, 'nickname', 'string')
    || requiredField(body, 'password')
    || fieldType(body, 'password', 'string')
    || requiredField(body, 'challengeId')
    || fieldType(body, 'challengeId', 'string')
    || requiredField(body, 'verificationCode')
    || fieldType(body, 'verificationCode', 'string')
    || requiredField(body, 'termsAccepted')
    || fieldType(body, 'termsAccepted', 'boolean')
    || requiredField(body, 'rememberMe')
    || fieldType(body, 'rememberMe', 'boolean');
  if (shape) return shape;
  const email = emailResult(body.email);
  if (email.problem) return email;
  if (!state.config.registrationOpen) return problemResult(PROBLEM.REGISTRATION_CLOSED);
  const nickname = String(body.nickname).trim();
  if (!nickname) return problemResult(PROBLEM.NICKNAME_EMPTY, { field: 'nickname' });
  if (codePoints(nickname) > 40) return problemResult(PROBLEM.NICKNAME_TOO_LONG, { field: 'nickname' });
  const password = passwordResult(body.password);
  if (password) return password;
  const challengeId = challengeIdShape(body.challengeId);
  if (challengeId) return challengeId;
  const code = codeShape(body.verificationCode);
  if (code) return code;
  if (body.termsAccepted !== true) return problemResult(PROBLEM.TERMS_NOT_ACCEPTED, { field: 'termsAccepted' });
  if (!ctx.container || !ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
  if (takeFault(state, 'account-store-read')) {
    return problemResult(PROBLEM.ACCOUNT_STORE_UNAVAILABLE);
  }
  const checked = checkChallenge(state, {
    challengeId: body.challengeId,
    purpose: 'registration',
    email: email.canonical,
    code: body.verificationCode,
  });
  if (checked.problem) return checked;
  if (state.accounts.has(email.canonical)) {
    return problemResult(PROBLEM.EMAIL_ALREADY_REGISTERED, { field: 'email' });
  }
  if (takeFault(state, 'account-store-write')) {
    return problemResult(PROBLEM.ACCOUNT_STORE_UNAVAILABLE);
  }
  const account = seedAccount(state, { email: email.canonical, nickname, password: body.password });
  checked.challenge.consumed = true;
  state.counters.session += 1;
  const session = {
    id: `sess-${state.counters.session}`,
    account,
    state: 'pending',
    persistence: 'page',
    rememberRequested: body.rememberMe,
    issuedAt: now(state),
    expiresAt: body.rememberMe ? now(state) + state.config.sessionTtlMs : null,
    pageId: ctx.pageId,
    revoked: false,
  };
  state.sessions.set(session.id, session);
  ctx.container.pages.set(ctx.pageId, session.id);
  return okResult(201, sessionJson(session));
}

function handlePasswordReset(state, ctx, body) {
  const shape = unknownField(body, ['verificationCode', 'password', 'challengeId', 'email'])
    || requiredField(body, 'verificationCode')
    || fieldType(body, 'verificationCode', 'string')
    || requiredField(body, 'password')
    || fieldType(body, 'password', 'string')
    || requiredField(body, 'challengeId')
    || fieldType(body, 'challengeId', 'string')
    || requiredField(body, 'email')
    || fieldType(body, 'email', 'string');
  if (shape) return shape;
  const code = codeShape(body.verificationCode);
  if (code) return code;
  const password = passwordResult(body.password);
  if (password) return password;
  const challengeId = challengeIdShape(body.challengeId);
  if (challengeId) return challengeId;
  const email = emailResult(body.email);
  if (email.problem) return email;
  if (!ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
  if (takeFault(state, 'account-store-read')) {
    return problemResult(PROBLEM.ACCOUNT_STORE_UNAVAILABLE);
  }
  const checked = checkChallenge(state, {
    challengeId: body.challengeId,
    purpose: 'password-reset',
    email: email.canonical,
    code: body.verificationCode,
  });
  if (checked.problem) return checked;
  const account = state.accounts.get(email.canonical);
  if (!account) return problemResult(PROBLEM.EMAIL_NOT_REGISTERED, { field: 'email' });
  if (takeFault(state, 'account-store-write')) {
    return problemResult(PROBLEM.ACCOUNT_STORE_UNAVAILABLE);
  }
  account.password = body.password;
  checked.challenge.consumed = true;
  for (const session of state.sessions.values()) {
    if (session.account.email === account.email) revokeSession(state, session);
  }
  return okResult(204);
}

function handleSessionGet(state, ctx) {
  if (!ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
  if (takeFault(state, 'session-store-read')) {
    return problemResult(PROBLEM.SESSION_STORE_UNAVAILABLE);
  }
  if (ctx.cookieValue && !ctx.container) return problemResult(PROBLEM.SESSION_INVALID);
  return okResult(200, statusJson(state, ctx.container, ctx.pageId));
}

function handleSessionPost(state, ctx, body) {
  const allowed = ['action', 'sessionId', 'rememberMe'];
  const unknown = unknownField(body, allowed);
  if (unknown) return unknown;
  if (!('action' in body)) return problemResult(PROBLEM.REQUIRED_FIELD, { field: 'action' });
  if (typeof body.action !== 'string') return problemResult(PROBLEM.INVALID_FIELD_TYPE, { field: 'action' });
  if (!['bootstrap', 'activate', 'restore'].includes(body.action)) {
    return problemResult(PROBLEM.INVALID_FIELD_VALUE, { field: 'action' });
  }

  if (body.action === 'bootstrap') {
    const shape = unknownField(body, ['action']);
    if (shape) return shape;
    if (!ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
    let created = null;
    if (!ctx.container) {
      state.counters.container += 1;
      created = `cont-${state.counters.container}`;
      const container = { id: created, pages: new Map(), remembered: null };
      state.containers.set(created, container);
      ctx.container = container;
      ctx.cookieValue = created;
    }
    const status = statusJson(state, ctx.container, ctx.pageId);
    return okResult(200, status, created
      ? { 'Set-Cookie': `${COOKIE_NAME}=${created}; HttpOnly; Secure; Path=/; SameSite=Lax` }
      : {});
  }

  if (!ctx.container || !ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);

  if (body.action === 'activate') {
    const shape = unknownField(body, ['action', 'sessionId', 'rememberMe'])
      || requiredField(body, 'sessionId')
      || fieldType(body, 'sessionId', 'string')
      || requiredField(body, 'rememberMe')
      || fieldType(body, 'rememberMe', 'boolean');
    if (shape) return shape;
    if (!OPAQUE_RE.test(body.sessionId)) {
      return problemResult(PROBLEM.INVALID_FIELD_VALUE, { field: 'sessionId' });
    }
    if (takeFault(state, 'session-store-read')) {
      return problemResult(PROBLEM.SESSION_STORE_UNAVAILABLE);
    }
    const session = state.sessions.get(body.sessionId);
    const boundToPage = session && session.pageId === ctx.pageId;
    if (!session || !boundToPage || session.revoked) {
      return problemResult(PROBLEM.SESSION_INVALID);
    }
    if (session.state === 'active') {
      const wanted = body.rememberMe ? 'remembered' : 'page';
      if (session.persistence === wanted) {
        return okResult(200, statusJson(state, ctx.container, ctx.pageId));
      }
      return problemResult(PROBLEM.SESSION_STATE_CONFLICT);
    }
    if (isExpired(state, session.expiresAt)) {
      return problemResult(PROBLEM.SESSION_INVALID);
    }
    if (body.rememberMe && takeFault(state, 'session-persistence')) {
      return problemResult(PROBLEM.SESSION_PERSISTENCE_UNAVAILABLE);
    }
    if (body.rememberMe) {
      session.state = 'active';
      session.persistence = 'remembered';
      session.rememberRequested = true;
      session.expiresAt = session.issuedAt + state.config.sessionTtlMs;
      ctx.container.remembered = session.id;
      const remaining = Math.min((session.expiresAt - now(state)) / 1000, 604800);
      const cookie = `${COOKIE_NAME}=${ctx.cookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax`
        + `; Max-Age=${Math.max(1, Math.floor(remaining))}`
        + `; Expires=${new Date(now(state) + Math.max(1, Math.floor(remaining)) * 1000).toUTCString()}`;
      return okResult(200, statusJson(state, ctx.container, ctx.pageId), { 'Set-Cookie': cookie });
    }
    session.state = 'active';
    session.persistence = 'page';
    session.expiresAt = null;
    if (ctx.container.remembered === session.id) ctx.container.remembered = null;
    return okResult(200, statusJson(state, ctx.container, ctx.pageId));
  }

  // restore
  const shape = unknownField(body, ['action', 'sessionId'])
    || requiredField(body, 'sessionId')
    || fieldType(body, 'sessionId', 'string');
  if (shape) return shape;
  if (!OPAQUE_RE.test(body.sessionId)) {
    return problemResult(PROBLEM.INVALID_FIELD_VALUE, { field: 'sessionId' });
  }
  if (takeFault(state, 'session-store-read')) {
    return problemResult(PROBLEM.SESSION_STORE_UNAVAILABLE);
  }
  const target = state.sessions.get(body.sessionId);
  const isRememberTarget = target && ctx.container.remembered === target.id;
  if (!isRememberTarget || !sessionValid(state, target) || target.persistence !== 'remembered') {
    return problemResult(PROBLEM.SESSION_INVALID);
  }
  if (isExpired(state, target.expiresAt)) return problemResult(PROBLEM.SESSION_INVALID);
  target.pageId = ctx.pageId;
  ctx.container.pages.set(ctx.pageId, target.id);
  return okResult(200, statusJson(state, ctx.container, ctx.pageId));
}

function handleLogout(state, ctx, body) {
  const shape = unknownField(body, ['sessionId']) || requiredField(body, 'sessionId');
  if (shape) return shape;
  if (body.sessionId !== null && (typeof body.sessionId !== 'string' || !OPAQUE_RE.test(body.sessionId))) {
    return problemResult(PROBLEM.INVALID_FIELD_VALUE, { field: 'sessionId' });
  }
  if (!ctx.pageId) return problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
  if (takeFault(state, 'session-store-write')) {
    return problemResult(PROBLEM.SESSION_STORE_UNAVAILABLE);
  }
  const target = typeof body.sessionId === 'string' ? state.sessions.get(body.sessionId) : null;
  if (target) {
    const bound = ctx.container?.pages.get(ctx.pageId) === target.id;
    const remembered = ctx.container?.remembered === target.id;
    if (bound || remembered) revokeSession(state, target);
  }
  const headers = {};
  const hadCookies = ctx.cookieValue !== null && ctx.cookieValue !== undefined;
  if (hadCookies && !containerHasIdentity(state, ctx.container)) {
    headers['Set-Cookie'] = cookieAttributes(state, { clear: true });
  }
  return okResult(204, undefined, headers);
}

// ---------------------------------------------------------------------------
// request log / faults

function recordRequest(state, req, pathname, body) {
  state.requests.push({
    method: req.method,
    path: pathname,
    page: req.headers['x-teachbuddy-page'] ?? null,
    protection: req.headers['x-teachbuddy-request'] ?? null,
    origin: req.headers.origin ?? null,
    idempotencyKey: req.headers['idempotency-key'] ?? null,
    body: body ?? null,
    at: new Date(now(state)).toISOString(),
  });
}

function takeFault(state, operation) {
  const list = state.faults.get(operation);
  if (!list || list.length === 0) return null;
  const fault = list[0];
  if (fault.times > 0) {
    fault.times -= 1;
    if (fault.times === 0) list.shift();
  }
  return fault;
}

// ---------------------------------------------------------------------------
// HTTP plumbing

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

function contentTypeOf(req) {
  return String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
}

function originAllowed(state, req) {
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== 'null') {
    return origin === state.config.origin;
  }
  const referer = req.headers.referer;
  if (!referer) return false;
  return referer.startsWith(`${state.config.origin}/`) || referer === state.config.origin;
}

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(res, pathname, root) {
  if (!root) return false;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root))) {
    sendJson(res, 404, { type: '/problems/fixture/not-found' });
    return true;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return false;
  res.writeHead(200, {
    'Content-Type': STATIC_TYPES[path.extname(target)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(fs.readFileSync(target));
  return true;
}

async function handleFixture(state, req, res, pathname, url, rawBody) {
  if (pathname === '/__fixture/health') {
    sendJson(res, 200, { ok: true, origin: state.config.origin });
    return;
  }
  if (pathname === '/__fixture/state') {
    sendJson(res, 200, {
      accounts: [...state.accounts.values()].map((account) => ({ ...account })),
      challenges: [...state.challenges.values()].map((challenge) => ({
        id: challenge.id,
        purpose: challenge.purpose,
        email: challenge.email,
        consumed: challenge.consumed,
        replaced: challenge.replaced,
        attemptsLeft: challenge.attemptsLeft,
        issuedAt: challenge.issuedAt,
        expiresAt: challenge.expiresAt,
        resendAt: challenge.resendAt,
      })),
      sessions: [...state.sessions.values()].map((session) => ({
        id: session.id,
        email: session.account.email,
        state: session.state,
        persistence: session.persistence,
        rememberRequested: session.rememberRequested,
        revoked: session.revoked,
        expiresAt: session.expiresAt,
        pageId: session.pageId,
      })),
      containers: [...state.containers.values()].map((container) => ({
        id: container.id,
        pages: Object.fromEntries(container.pages),
        remembered: container.remembered,
      })),
      mail: state.mail,
      registrationOpen: state.config.registrationOpen,
    });
    return;
  }
  if (pathname === '/__fixture/requests') {
    sendJson(res, 200, { requests: state.requests });
    return;
  }
  if (pathname === '/__fixture/reset') {
    const origin = state.config.origin;
    Object.assign(state, createState());
    state.config.origin = origin;
    sendJson(res, 200, { ok: true });
    return;
  }
  if (pathname === '/__fixture/config') {
    const body = rawBody ? JSON.parse(rawBody) : {};
    Object.assign(state.config, body);
    sendJson(res, 200, { ok: true, config: state.config });
    return;
  }
  if (pathname === '/__fixture/seed') {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const account = seedAccount(state, body);
    sendJson(res, 200, { account });
    return;
  }
  if (pathname === '/__fixture/faults/clear') {
    state.faults.clear();
    sendJson(res, 200, { ok: true });
    return;
  }
  if (pathname === '/__fixture/faults') {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const operation = body.operation;
    const list = state.faults.get(operation) || [];
    list.push({ times: body.times ?? 1, ...body });
    state.faults.set(operation, list);
    sendJson(res, 200, { ok: true, operation });
    return;
  }
  if (pathname === '/__fixture/events') {
    sendJson(res, 200, { requests: state.requests, mail: state.mail });
    return;
  }
  const params = url.searchParams;
  if (pathname === '/__fixture/revoke' && params.has('session')) {
    const session = state.sessions.get(params.get('session'));
    if (session) revokeSession(state, session);
    sendJson(res, 200, { ok: Boolean(session) });
    return;
  }
  if (pathname === '/__fixture/revoke-account' && params.has('email')) {
    const email = normalizeEmail(params.get('email'));
    for (const session of state.sessions.values()) {
      if (session.account.email === email) revokeSession(state, session);
    }
    sendJson(res, 200, { ok: true });
    return;
  }
  sendJson(res, 404, { type: '/problems/fixture/unknown' });
}

async function handleAuth(state, req, res, pathname, body) {
  const operationKey = `${req.method} ${pathname}`;
  const operation = {
    'POST /api/auth/login': 'login',
    'POST /api/auth/registration-codes': 'registration-codes',
    'POST /api/auth/register': 'register',
    'POST /api/auth/password-reset-codes': 'password-reset-codes',
    'POST /api/auth/password-reset': 'password-reset',
    'GET /api/auth/session': 'session-get',
    'POST /api/auth/session': 'session-post',
    'POST /api/auth/logout': 'logout',
  }[operationKey];
  if (!operation) {
    sendProblem(res, PROBLEM.SERVICE_UNAVAILABLE);
    return;
  }

  const pageId = PAGE_RE.test(String(req.headers['x-teachbuddy-page'] || ''))
    ? String(req.headers['x-teachbuddy-page'])
    : null;
  const jar = parseCookies(req.headers.cookie);
  const cookieValue = jar.get(COOKIE_NAME) ?? null;
  const container = cookieValue ? state.containers.get(cookieValue) ?? null : null;
  const ctx = { req, pageId, cookieValue, container };

  const fault = takeFault(state, operation);
  if (fault?.kind === 'delay') {
    await sleep(fault.ms ?? 500);
  }
  if (fault?.kind === 'drop-before') {
    req.socket.destroy();
    return;
  }

  let result;
  if (req.method === 'POST') {
    if (!originAllowed(state, req) || req.headers['x-teachbuddy-request'] !== '1') {
      result = problemResult(PROBLEM.REQUEST_NOT_ALLOWED);
    } else if (contentTypeOf(req) !== 'application/json') {
      result = problemResult(PROBLEM.UNSUPPORTED_MEDIA_TYPE);
    } else {
      let parsed = null;
      let malformed = false;
      try {
        parsed = JSON.parse(body);
      } catch {
        malformed = true;
      }
      if (malformed || body.trim() === '') {
        result = problemResult(PROBLEM.MALFORMED_JSON);
      } else if (!isPlainObject(parsed)) {
        result = problemResult(PROBLEM.INVALID_REQUEST_BODY);
      } else {
        recordRequest(state, req, pathname, parsed);
        try {
          result = dispatch(state, operation, ctx, parsed);
        } catch (error) {
          result = { status: 500, body: { type: '/problems/auth/service-unavailable', detail: String(error?.message) } };
        }
      }
    }
  } else {
    if (!pageId) {
      result = problemResult(PROBLEM.BROWSER_CONTEXT_REQUIRED);
    } else {
      recordRequest(state, req, pathname, null);
      result = dispatch(state, operation, ctx, null);
    }
  }

  if (fault) {
    if (fault.kind === 'problem') {
      result = problemResult(fault.type, fault.extra || {}, fault.headers || {});
    } else if (fault.kind === 'unknown-problem') {
      result = {
        status: fault.status || 422,
        rawProblem: {
          type: fault.type || '/problems/auth/not-in-this-contract',
          status: fault.status || 422,
        },
      };
    } else if (fault.kind === 'malformed') {
      result = { status: fault.status || 200, body: fault.body ?? { unexpected: true } };
    } else if (fault.kind === 'raw-status') {
      result = {
        status: fault.status || 500,
        rawBody: fault.body ?? {},
        contentType: fault.contentType || 'application/json; charset=utf-8',
      };
    }
  }
  if (fault?.kind === 'drop-after') {
    req.socket.destroy();
    return;
  }
  if (fault?.kind === 'hang-after') {
    /*
     * The operation ran; the response is never delivered. The client can only
     * learn the outcome by timing out and re-verifying, which is the
     * "response lost" branch of the contract.
     */
    return;
  }

  if (result.problem) {
    sendProblem(res, result.problem, result.extra, result.headers);
    return;
  }
  if (result.rawProblem) {
    sendJson(res, result.status, result.rawProblem, { 'Content-Type': 'application/problem+json; charset=utf-8' });
    return;
  }
  if (result.rawBody !== undefined) {
    res.writeHead(result.status, {
      'Content-Type': result.contentType,
      'Cache-Control': 'no-store',
      ...result.headers,
    });
    res.end(typeof result.rawBody === 'string' ? result.rawBody : JSON.stringify(result.rawBody));
    return;
  }
  if (result.status === 204) {
    res.writeHead(204, { 'Cache-Control': 'no-store', ...result.headers });
    res.end();
    return;
  }
  if (result.status >= 400 && result.body === undefined) {
    res.writeHead(result.status, {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...result.headers,
    });
    res.end();
    return;
  }
  sendJson(res, result.status, result.body, result.headers);
}

function dispatch(state, operation, ctx, body) {
  switch (operation) {
    case 'login':
      return handleLogin(state, ctx, body);
    case 'registration-codes':
      return handleCodeRequest(state, ctx, body, 'registration');
    case 'register':
      return handleRegister(state, ctx, body);
    case 'password-reset-codes':
      return handleCodeRequest(state, ctx, body, 'password-reset');
    case 'password-reset':
      return handlePasswordReset(state, ctx, body);
    case 'session-get':
      return handleSessionGet(state, ctx);
    case 'session-post':
      return handleSessionPost(state, ctx, body);
    case 'logout':
      return handleLogout(state, ctx, body);
    default:
      return problemResult(PROBLEM.SERVICE_UNAVAILABLE);
  }
}

function handleWorkbench(state, req, res, pathname, body) {
  recordRequest(state, req, pathname, body ?? null);
  const pageId = PAGE_RE.test(String(req.headers['x-teachbuddy-page'] || ''))
    ? String(req.headers['x-teachbuddy-page'])
    : null;
  const jar = parseCookies(req.headers.cookie);
  const cookieValue = jar.get(COOKIE_NAME) ?? null;
  const container = cookieValue ? state.containers.get(cookieValue) ?? null : null;
  const session = containerSession(state, container, pageId);
  const write = req.method !== 'GET' && req.method !== 'HEAD';
  if (write && (!originAllowed(state, req) || req.headers['x-teachbuddy-request'] !== '1')) {
    sendJson(res, 403, { type: '/problems/workbench/request-not-allowed', status: 403 });
    return;
  }
  if (!session || session.state !== 'active') {
    sendJson(res, 401, { type: '/problems/workbench/unauthenticated', status: 401 });
    return;
  }
  if (write && !req.headers['idempotency-key']) {
    sendJson(res, 422, { type: '/problems/workbench/invalid-input', status: 422, field: '/idempotencyKey' });
    return;
  }
  const operation = workbenchKey(req.method, pathname);
  if (!WORKBENCH_STATUS.has(operation)) {
    sendJson(res, 404, { type: '/problems/workbench/not-found', status: 404 });
    return;
  }
  sendJson(res, WORKBENCH_STATUS.get(operation), {
    operationId: operation,
    accountKey: session.account.accountKey,
  });
}

export function createSubstituteServer({ state = createState(), port = 47182, host = '127.0.0.1', foreign = null, buildDir } = {}) {
  state.config.origin = state.config.origin || `http://${host}:${port}`;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    const pathname = url.pathname;

    if (foreign) {
      if (pathname === '/' || pathname === '/index.html') {
        const page = `<!doctype html><html><head><meta charset="utf-8"><title>foreign origin</title></head>
<body data-foreign-origin="${foreign}">
<pre id="out">pending</pre>
<script>
const out = document.getElementById('out');
fetch(${JSON.stringify(`${foreign}/api/auth/login`)}, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-TeachBuddy-Request': '1',
    'X-TeachBuddy-Page': '0123456789abcdef0123456789abcdef'
  },
  body: JSON.stringify({ email: 'teacher@example.com', password: ' TeAcH😀9', rememberMe: true })
}).then(async (response) => {
  document.body.dataset.status = String(response.status);
  const text = await response.text();
  document.body.dataset.body = text;
  out.textContent = String(response.status) + ' ' + text;
}).catch((error) => {
  document.body.dataset.status = 'network-error';
  document.body.dataset.body = String(error);
  out.textContent = 'network-error ' + String(error);
});
</script></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(page);
        return;
      }
      if (pathname.startsWith('/__fixture/')) {
        const rawBody = await readBody(req);
        await handleFixture(state, req, res, pathname, url, rawBody);
        return;
      }
      sendJson(res, 404, { type: '/problems/fixture/not-found' });
      return;
    }

    if (pathname.startsWith('/__fixture/')) {
      const rawBody = await readBody(req);
      await handleFixture(state, req, res, pathname, url, rawBody);
      return;
    }
    if (pathname.startsWith('/api/auth/')) {
      const rawBody = await readBody(req);
      await handleAuth(state, req, res, pathname, rawBody);
      return;
    }
    if (pathname.startsWith('/api/workbench/') || pathname.startsWith('/api/modules')) {
      const rawBody = await readBody(req);
      let parsed = null;
      if (rawBody) {
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          parsed = rawBody;
        }
      }
      handleWorkbench(state, req, res, pathname, parsed);
      return;
    }
    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { type: '/problems/fixture/not-found' });
      return;
    }
    if (!serveStatic(res, pathname, buildDir)) {
      sendJson(res, 404, { type: '/problems/fixture/not-found' });
    }
  });

  return {
    state,
    server,
    port,
    listen: () => new Promise((resolve) => server.listen(port, host, resolve)),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = process.argv.slice(2);
  const readArg = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : args[index + 1];
  };
  const port = Number(readArg('--port', '47182'));
  const host = readArg('--host', '127.0.0.1');
  const foreign = readArg('--foreign', null);
  const buildDir = foreign ? undefined : await buildHarness();
  if (args.includes('--build-only')) {
    process.stdout.write(`harness build: ${buildDir}\n`);
    process.exit(0);
  }
  const instance = createSubstituteServer({ port, host, foreign, buildDir });
  await instance.listen();
  process.stdout.write(`auth-contract substitute listening on http://${host}:${port}\n`);
  const shutdown = async () => {
    await instance.close();
    if (buildDir) fs.rmSync(buildDir, { recursive: true, force: true });
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { PROBLEM, now, cookieAttributes, COOKIE_NAME };
