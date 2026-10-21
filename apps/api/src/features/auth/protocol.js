// Protocol plane: request origin/protection guard, JSON body reading and
// cookie/page-context helpers. GET requests never pass the write guard.

import crypto from 'node:crypto';
import express from 'express';
import { authProblem } from './problems.js';
import { PAGE_CONTEXT_PATTERN } from './validation.js';

const SESSION_COOKIE_NAME = '__Host-teachbuddy_session';
export const REMEMBERED_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REMEMBERED_COOKIE_AGE_SECONDS = REMEMBERED_SESSION_MS / 1000;

// The database stores only a digest of the browser token, so a database leak
// does not hand out replayable Cookies. The raw value lives in the Cookie
// header (and the response that issued it) and nowhere else.
export function hashSessionToken(token) {
  return 'ctr_' + crypto.createHash('sha256').update(token).digest('base64url');
}

function parseOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol + '//' + url.host;
  } catch {
    return null;
  }
}

export function normalizePublicOrigin(value) {
  const normalized = parseOrigin(value);
  if (!normalized) throw new Error('publicOrigin must be an absolute origin such as https://example.com');
  return normalized;
}

// A failed request guard must not reach any business or JSON handling.
export function createRequestGuard(publicOrigin) {
  const expectedOrigin = normalizePublicOrigin(publicOrigin);

  return function ensureRequestAllowed(request) {
    if (request.headers['x-teachbuddy-request'] !== '1') throw authProblem('requestNotAllowed');

    const origin = request.headers.origin;
    if (origin !== undefined) {
      if (parseOrigin(origin) !== expectedOrigin) throw authProblem('requestNotAllowed');
      return;
    }

    // Referer is only a fallback when Origin is completely absent.
    const referer = request.headers.referer;
    if (typeof referer !== 'string' || parseOrigin(referer) !== expectedOrigin) {
      throw authProblem('requestNotAllowed');
    }
  };
}

export function createBodyReader() {
  const readText = express.text({ type: () => true, limit: '256kb' });

  return function bodyReader(request, response, next) {
    readText(request, response, (error) => {
      if (!error) {
        next();
        return;
      }
      if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
        next(authProblem('unsupportedMediaType'));
        return;
      }
      next(authProblem('malformedJson'));
    });
  };
}

function ensureJsonMediaType(request) {
  const header = request.headers['content-type'];
  if (typeof header !== 'string' || header.length === 0) throw authProblem('unsupportedMediaType');
  const parts = header.split(';').map((part) => part.trim());
  if ((parts.shift() ?? '').toLowerCase() !== 'application/json') throw authProblem('unsupportedMediaType');
  for (const parameter of parts) {
    const separator = parameter.indexOf('=');
    if (separator === -1) continue;
    if (parameter.slice(0, separator).trim().toLowerCase() !== 'charset') continue;
    const charset = parameter
      .slice(separator + 1)
      .trim()
      .replace(/^"|"$/g, '')
      .toLowerCase();
    if (charset !== 'utf-8' && charset !== 'utf8') throw authProblem('unsupportedMediaType');
  }
}

export function readJsonBody(request) {
  ensureJsonMediaType(request);

  let text;
  if (typeof request.body === 'string') {
    text = request.body;
  } else if (Buffer.isBuffer(request.body)) {
    text = request.body.toString('utf8');
  } else {
    // No body, or an outer parser consumed it: correct mounting keeps the auth
    // router in front of app-level JSON parsers.
    text = undefined;
  }

  if (typeof text !== 'string' || text.trim().length === 0) throw authProblem('malformedJson');
  try {
    return JSON.parse(text);
  } catch {
    throw authProblem('malformedJson');
  }
}

export function readPageContext(request) {
  const value = request.headers['x-teachbuddy-page'];
  if (typeof value !== 'string' || !PAGE_CONTEXT_PATTERN.test(value)) {
    throw authProblem('browserContextRequired');
  }
  return value;
}

export function readSessionCookie(request) {
  const header = request.headers.cookie;
  if (typeof header !== 'string' || header.length === 0) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function sessionCookie(value) {
  return SESSION_COOKIE_NAME + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Secure';
}

export function persistentSessionCookie(value, maxAgeSeconds) {
  const bounded = Math.max(1, Math.min(MAX_REMEMBERED_COOKIE_AGE_SECONDS, Math.floor(maxAgeSeconds)));
  return sessionCookie(value) + '; Max-Age=' + bounded;
}

export function clearedSessionCookie() {
  return SESSION_COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
}
