/*
 * Contract client for the account-entry HTTP surface. It owns request shaping
 * (page header, protection header, JSON media type), response validation and
 * the classification of every failure into a result the interface can map:
 *
 *   { kind: 'result', status, data }        validated success payload
 *   { kind: 'no-content', status }          204 success without body
 *   { kind: 'problem', ... }                declared /problems/auth/* problem
 *   { kind: 'unknown-problem', status }     undeclared problem or status mismatch
 *   { kind: 'transport', reason }           offline | timeout | network | malformed
 *
 * `reason: 'offline'` is the only provable "the request never left the
 * browser" case; timeouts, dropped responses and invalid bodies cannot prove
 * that a submitted business operation did not run.
 */

export const PROBLEM = Object.freeze({
  DELETION_CONFIRMATION_MISMATCH: '/problems/auth/deletion-confirmation-mismatch',
  DELETION_IN_PROGRESS: '/problems/auth/deletion-in-progress',
  DELETION_INCOMPLETE: '/problems/auth/deletion-incomplete',
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
});

const KNOWN_PROBLEM_TYPES = new Set(Object.values(PROBLEM));

const AUTH_PATHS = Object.freeze({
  login: '/api/auth/login',
  registrationCodes: '/api/auth/registration-codes',
  register: '/api/auth/register',
  passwordResetCodes: '/api/auth/password-reset-codes',
  passwordReset: '/api/auth/password-reset',
  session: '/api/auth/session',
  logout: '/api/auth/logout',
});

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilledString(value, maxLength = 200) {
  return typeof value === 'string' && value.length >= 1 && value.length <= maxLength;
}

function readAccount(value) {
  if (!isPlainObject(value)) return null;
  if (!isFilledString(value.accountKey)) return null;
  if (!isFilledString(value.email, 254)) return null;
  if (typeof value.nickname !== 'string' || value.nickname.length < 1 || Array.from(value.nickname).length > 40) {
    return null;
  }
  return { accountKey: value.accountKey, email: value.email, nickname: value.nickname };
}

export function readSession(value) {
  if (!isPlainObject(value)) return null;
  const account = readAccount(value.account);
  if (!account) return null;
  if (!isFilledString(value.id)) return null;
  if (value.state !== 'pending' && value.state !== 'active') return null;
  if (value.persistence !== 'page' && value.persistence !== 'remembered') return null;
  if (typeof value.rememberRequested !== 'boolean') return null;
  if (typeof value.issuedAt !== 'string') return null;
  if (!(value.expiresAt === null || typeof value.expiresAt === 'string')) return null;
  return {
    id: value.id,
    account,
    state: value.state,
    persistence: value.persistence,
    rememberRequested: value.rememberRequested,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  };
}

export function readSessionStatus(value) {
  if (!isPlainObject(value)) return null;
  if (typeof value.browserReady !== 'boolean') return null;
  if (typeof value.registrationOpen !== 'boolean') return null;
  if (typeof value.serverTime !== 'string' || Number.isNaN(Date.parse(value.serverTime))) return null;
  const session = value.session === null ? null : readSession(value.session);
  if (value.session !== null && !session) return null;
  let rememberedSession = null;
  if (value.rememberedSession !== null) {
    const remembered = value.rememberedSession;
    if (!isPlainObject(remembered)) return null;
    if (!isFilledString(remembered.id)) return null;
    if (typeof remembered.expiresAt !== 'string') return null;
    rememberedSession = { id: remembered.id, expiresAt: remembered.expiresAt };
  }
  return {
    browserReady: value.browserReady,
    registrationOpen: value.registrationOpen,
    session,
    rememberedSession,
    serverTime: value.serverTime,
  };
}

/* I01/I03 answer with a pending session, never with an active one. */
export function readPendingSession(value) {
  const session = readSession(value);
  return session?.state === 'pending' ? session : null;
}

/* activate/restore answer with the confirmed active identity. */
export function readActiveStatus(value) {
  const status = readSessionStatus(value);
  return status?.session?.state === 'active' ? status : null;
}

export function readChallenge(value, expectedPurpose) {
  if (!isPlainObject(value)) return null;
  if (!isFilledString(value.challengeId)) return null;
  if (value.purpose !== expectedPurpose) return null;
  if (typeof value.email !== 'string' || !value.email) return null;
  if (typeof value.issuedAt !== 'string' || Number.isNaN(Date.parse(value.issuedAt))) return null;
  if (typeof value.expiresAt !== 'string' || Number.isNaN(Date.parse(value.expiresAt))) return null;
  if (typeof value.resendAt !== 'string' || Number.isNaN(Date.parse(value.resendAt))) return null;
  if (typeof value.serverTime !== 'string' || Number.isNaN(Date.parse(value.serverTime))) return null;
  if (value.remainingAttempts !== 5) return null;
  return {
    challengeId: value.challengeId,
    purpose: value.purpose,
    email: value.email,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    resendAt: value.resendAt,
    serverTime: value.serverTime,
    remainingAttempts: value.remainingAttempts,
  };
}

function readProblem(body, status) {
  if (!isPlainObject(body) || typeof body.type !== 'string') return null;
  if (body.status !== undefined && body.status !== status) return null;
  const field = typeof body.field === 'string' ? body.field : null;
  const remainingAttempts = Number.isInteger(body.remainingAttempts) ? body.remainingAttempts : null;
  const retryAfterSeconds = Number.isInteger(body.retryAfterSeconds) ? body.retryAfterSeconds : null;
  return { type: body.type, field, remainingAttempts, retryAfterSeconds };
}

function lockedError() {
  const error = new Error('auth transport is locked until the logout result is confirmed');
  error.kind = 'auth-locked';
  return error;
}

export function createAuthClient({ getPageContext, timeoutMs = 10_000 }) {
  const fetcher = (...args) => fetch(...args);

  async function call({ path, method = 'POST', body, validate, allowNoContent = false }) {
    const headers = {
      Accept: 'application/json',
      'X-TeachBuddy-Page': getPageContext(),
    };
    const init = {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (method !== 'GET' && method !== 'HEAD') {
      headers['X-TeachBuddy-Request'] = '1';
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    let timer = null;
    if (controller && timeoutMs > 0) {
      init.signal = controller.signal;
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }

    // Keep the deadline active until the entire response is read and validated.
    try {
      let response;
      try {
        response = await fetcher(path, init);
      } catch (error) {
        if (timedOut) return { kind: 'transport', reason: 'timeout' };
        if (error?.name === 'AbortError') return { kind: 'transport', reason: 'timeout' };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          return { kind: 'transport', reason: 'offline' };
        }
        return { kind: 'transport', reason: 'network' };
      }

      const status = response.status;
      if (allowNoContent && status === 204) return { kind: 'no-content', status };

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('json')) {
        return { kind: 'transport', reason: 'malformed', status };
      }

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (timedOut || error?.name === 'AbortError') {
          return { kind: 'transport', reason: 'timeout', status };
        }
        return { kind: 'transport', reason: 'malformed', status };
      }

      if (status >= 200 && status < 300) {
        const data = validate ? validate(payload) : payload;
        if (data === null || data === undefined) return { kind: 'transport', reason: 'malformed', status };
        return { kind: 'result', status, data };
      }

      const problem = readProblem(payload, status);
      if (!problem) return { kind: 'unknown-problem', status, payload };
      if (!KNOWN_PROBLEM_TYPES.has(problem.type)) {
        return { kind: 'unknown-problem', status, problem, payload };
      }
      const retryAfterHeader = Number.parseInt(response.headers.get('retry-after') || '', 10);
      const retryAfterSeconds = Number.isInteger(retryAfterHeader)
        ? retryAfterHeader
        : problem.retryAfterSeconds;
      return {
        kind: 'problem',
        status,
        type: problem.type,
        field: problem.field,
        remainingAttempts: problem.remainingAttempts,
        retryAfterSeconds,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    deleteAccount(body) {
      return call({ path: '/api/auth/account-deletion', body, allowNoContent: true });
    },
    login({ email, password, rememberMe }) {
      return call({
        path: AUTH_PATHS.login,
        body: { email, password, rememberMe },
        validate: readPendingSession,
      });
    },

    requestRegistrationCode({ email }) {
      return call({
        path: AUTH_PATHS.registrationCodes,
        body: { email },
        validate: (value) => readChallenge(value, 'registration'),
      });
    },

    register({ email, nickname, password, challengeId, verificationCode }) {
      return call({
        path: AUTH_PATHS.register,
        body: {
          email,
          nickname,
          password,
          challengeId,
          verificationCode,
          termsAccepted: true,
          rememberMe: true,
        },
        validate: readPendingSession,
      });
    },

    requestPasswordResetCode({ email }) {
      return call({
        path: AUTH_PATHS.passwordResetCodes,
        body: { email },
        validate: (value) => readChallenge(value, 'password-reset'),
      });
    },

    resetPassword({ email, challengeId, verificationCode, password }) {
      return call({
        path: AUTH_PATHS.passwordReset,
        body: { email, challengeId, verificationCode, password },
        allowNoContent: true,
      });
    },

    getSession() {
      return call({ path: AUTH_PATHS.session, method: 'GET', validate: readSessionStatus });
    },

    bootstrapSession() {
      return call({
        path: AUTH_PATHS.session,
        body: { action: 'bootstrap' },
        validate: readSessionStatus,
      });
    },

    activateSession({ sessionId, rememberMe }) {
      return call({
        path: AUTH_PATHS.session,
        body: { action: 'activate', sessionId, rememberMe },
        validate: readActiveStatus,
      });
    },

    restoreSession({ sessionId }) {
      return call({
        path: AUTH_PATHS.session,
        body: { action: 'restore', sessionId },
        validate: readActiveStatus,
      });
    },

    logout({ sessionId }) {
      return call({
        path: AUTH_PATHS.logout,
        body: { sessionId },
        allowNoContent: true,
      });
    },
  };
}

function sameOriginApiPath(input) {
  if (typeof input === 'string') {
    if (input.startsWith('/api/')) return input;
    try {
      const url = new URL(input, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
        return `${url.pathname}${url.search}`;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof URL !== 'undefined' && input instanceof URL) return sameOriginApiPath(input.href);
  if (typeof Request !== 'undefined' && input instanceof Request) return sameOriginApiPath(input.url);
  return null;
}

/*
 * Workbench transport. It only shapes transport concerns: same-origin /api,
 * the current page header, the fixed protection header on writes, and a
 * session re-check when a protected request reports 401. Bodies, keys and
 * workbench responses pass through untouched.
 */
export function createTransport({ getPageContext, onUnauthorized, isLocked }) {
  const fetcher = (...args) => fetch(...args);
  return async function request(input, init = {}) {
    if (isLocked?.()) throw lockedError();
    const path = sameOriginApiPath(input);
    if (!path) throw new TypeError('useAuth.request only accepts same-origin /api requests');
    const headers = new Headers(init.headers || undefined);
    if (!headers.has('X-TeachBuddy-Page')) headers.set('X-TeachBuddy-Page', getPageContext());
    const method = String(init.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && !headers.has('X-TeachBuddy-Request')) {
      headers.set('X-TeachBuddy-Request', '1');
    }
    const response = await fetcher(path, { ...init, headers, credentials: 'same-origin' });
    if (response.status === 401) onUnauthorized?.();
    return response;
  };
}
