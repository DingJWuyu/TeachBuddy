/**
 * Trusted identity seam.
 *
 * `resolvePrincipal(request)` returns `{accountKey}` for an already verified
 * identity or `null`. The workbench never accepts an accountId from the body,
 * a query parameter or a client-set identity header; the only client input is
 * the session cookie, and only the server-side session table maps it to an
 * account.
 *
 * Two modes exist in this batch:
 * - `none`: no real adapter is configured, so every business entry resolves to
 *   null and the transport answers 401. This is the production default until
 *   A11 supplies the real authentication adapter.
 * - `test-principal`: the isolated test runner binds a fixed set of account
 *   keys. Tokens are derived from a runner secret so an independent browser
 *   context keeps its identity across an API restart; the production guard in
 *   `assertWorkbenchRuntimeConfig` refuses to start a production process in
 *   this mode.
 */
import crypto from 'node:crypto';
import { workbenchHeaders } from '@refatos/shared';

export const TEST_PRINCIPAL_MODE = 'test-principal';
export const NO_IDENTITY_MODE = 'none';

export function deriveTestPrincipalToken(accountKey, sessionSecret) {
  return crypto
    .createHmac('sha256', sessionSecret)
    .update(`workbench-test-principal:${accountKey}`)
    .digest('base64url');
}

export function readCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string' || !cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

export function sessionCookieHeader(name, token) {
  // Frozen attributes: HttpOnly, Secure, Path=/, SameSite=Lax, no Domain.
  // Expiry is a G03 open item, so no Max-Age/Expires is invented here.
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function assertWorkbenchRuntimeConfig({ nodeEnv, workbench }) {
  const mode = workbench?.mode ?? NO_IDENTITY_MODE;
  if (![NO_IDENTITY_MODE, TEST_PRINCIPAL_MODE].includes(mode)) {
    throw new Error(`Unknown workbench identity mode: ${mode}`);
  }

  if (nodeEnv !== 'production') return;

  if (mode === TEST_PRINCIPAL_MODE || workbench?.testPrincipals?.length) {
    throw new Error('Refusing to start: the test-principal identity mode is not allowed in production.');
  }
  if (workbench?.catalogOverride || workbench?.extraImplementations) {
    throw new Error('Refusing to start: test fixture modules are not allowed in production.');
  }
}

export function createIdentity(options = {}) {
  const {
    mode = NO_IDENTITY_MODE,
    testPrincipals = [],
    sessionSecret = 'teacher-workspace-test-session-secret',
    cookieName = workbenchHeaders.sessionCookie,
    resolvePrincipal: adapter
  } = options;

  const sessions = new Map();
  if (mode === TEST_PRINCIPAL_MODE) {
    const accountKeys = new Set();
    for (const accountKey of testPrincipals) {
      if (typeof accountKey !== 'string' || !accountKey.trim()) {
        throw new Error('Test principals must be non-empty account keys.');
      }
      if (accountKeys.has(accountKey)) {
        throw new Error(`Test principal ${accountKey} is listed twice.`);
      }
      accountKeys.add(accountKey);
      sessions.set(deriveTestPrincipalToken(accountKey, sessionSecret), { accountKey });
    }
    if (!sessions.size) {
      throw new Error('The test-principal mode requires at least one test principal.');
    }
  }

  return {
    mode,
    cookieName,

    /** Contract boundary: Promise or value, `{accountKey}` or null. */
    resolvePrincipal(request) {
      if (adapter) return adapter(request);
      const token = readCookie(request?.headers?.cookie, cookieName);
      if (!token) return null;
      const session = sessions.get(token);
      return session ? { accountKey: session.accountKey } : null;
    },

    /** Runner-only helper: seeds an independent cookie jar for a test browser. */
    testPrincipalCookie(accountKey) {
      const token = deriveTestPrincipalToken(accountKey, sessionSecret);
      if (!sessions.has(token)) throw new Error(`Unknown test principal: ${accountKey}`);
      return {
        name: cookieName,
        value: token,
        header: sessionCookieHeader(cookieName, token)
      };
    },

    listTestPrincipals() {
      return [...new Set([...sessions.values()].map((session) => session.accountKey))];
    }
  };
}
