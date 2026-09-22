// Auth backend module seam.
//
// createAuthModule({ db, publicOrigin, sendCode, now, isRegistrationOpen,
//                    codeSecret }) -> { router, resolvePrincipal }
//
// `router` serves /api/auth (mount it before app-level JSON/CORS middleware so
// body parsing, media-type rejection and no-store stay under this contract).
// `resolvePrincipal` is the workbench identity seam; it never trusts page
// headers, sessionIds or accountKeys on their own.
//
// `codeSecret` (or the AUTH_CODE_SECRET environment variable) is required: the
// verification-code HMAC key must not live in the same database as the digests.
// The auth tables must exist before this factory runs; `migrations` lives in
// ./migrations/index.js and is applied by the shared migration runner.

import express from 'express';
import { authProblem, isAuthProblem } from './problems.js';
import { createAuthStore } from './store.js';
import { createAuthOperations } from './operations.js';
import { createBodyReader, createRequestGuard, normalizePublicOrigin, readJsonBody } from './protocol.js';

function resolveCodeSecret(explicit) {
  const provided = typeof explicit === 'string' && explicit.length > 0 ? explicit : process.env.AUTH_CODE_SECRET;
  if (typeof provided !== 'string' || provided.length === 0) {
    throw new Error(
      'createAuthModule requires codeSecret or AUTH_CODE_SECRET so verification-code digests survive a database leak'
    );
  }
  return Buffer.from(provided, 'utf8');
}

function sendResult(response, result) {
  response.status(result.status);
  response.set('Cache-Control', 'no-store');
  for (const cookie of result.cookies ?? []) response.append('Set-Cookie', cookie);
  if (result.body === undefined) {
    response.end();
    return;
  }
  response.type('application/json');
  response.send(JSON.stringify(result.body));
}

export function createAuthModule(options = {}) {
  const { db, publicOrigin, sendCode } = options;
  const now = options.now ?? (() => Date.now());
  const isRegistrationOpen = options.isRegistrationOpen ?? (() => true);

  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('createAuthModule requires a synchronous better-sqlite3 database');
  }
  if (typeof sendCode !== 'function') {
    throw new TypeError('createAuthModule requires sendCode({ purpose, email, verificationCode })');
  }
  if (typeof now !== 'function') throw new TypeError('createAuthModule requires now() returning epoch milliseconds');
  if (typeof isRegistrationOpen !== 'function') {
    throw new TypeError('createAuthModule requires isRegistrationOpen() returning a boolean');
  }
  normalizePublicOrigin(publicOrigin);

  const store = createAuthStore(db);
  const codeSecret = resolveCodeSecret(options.codeSecret);
  const operations = createAuthOperations({ db, store, now, sendCode, isRegistrationOpen, codeSecret });
  const ensureRequestAllowed = createRequestGuard(publicOrigin);
  const bodyReader = createBodyReader();
  const router = express.Router();

  router.use(bodyReader);

  // GET keeps the no-store header but has no write guard or JSON body.
  function handle(handler, { write = true } = {}) {
    return async (request, response, next) => {
      try {
        response.set('Cache-Control', 'no-store');
        if (!write) {
          sendResult(response, await handler(request));
          return;
        }
        ensureRequestAllowed(request);
        const body = readJsonBody(request);
        sendResult(response, await handler(request, body));
      } catch (error) {
        next(error);
      }
    };
  }

  router.post('/login', handle((request, body) => operations.login(request, body)));
  router.post('/registration-codes', handle((request, body) => operations.requestRegistrationCode(request, body)));
  router.post('/register', handle((request, body) => operations.register(request, body)));
  router.post(
    '/password-reset-codes',
    handle((request, body) => operations.requestPasswordResetCode(request, body))
  );
  router.post('/password-reset', handle((request, body) => operations.resetPassword(request, body)));
  router.get('/session', handle((request) => operations.getSessionStatus(request), { write: false }));
  router.post('/session', handle((request, body) => operations.changeSession(request, body)));
  router.post('/logout', handle((request, body) => operations.logout(request, body)));

  router.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const problem = isAuthProblem(error) ? error : authProblem('serviceUnavailable');
    response.status(problem.status);
    response.set('Cache-Control', 'no-store');
    if (problem.extra && problem.extra.retryAfterSeconds !== undefined) {
      response.set('Retry-After', String(problem.extra.retryAfterSeconds));
    }
    response.type('application/problem+json');
    response.send(JSON.stringify(problem.toBody()));
  });

  return { router, resolvePrincipal: operations.resolvePrincipal };
}
