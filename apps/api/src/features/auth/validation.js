// Input normalization and schema-shape validation.
//
// Protocol first-error order is owned by the contract: unknown fields before
// required fields before JSON types; semantic field checks follow the
// per-operation order in the operations layer.

import { authProblem } from './problems.js';

// Patterns mirror the authoritative schemas (OpaqueId keeps its verbatim
// lookahead). JavaScript's `$` without the `m` flag already anchors at the end
// of input, so a trailing newline cannot pass; tests pin those cases.
export const PAGE_CONTEXT_PATTERN = /^[0-9a-f]{32}$/;
export const OPAQUE_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$(?![\s\S])/;
const VERIFICATION_CODE_PATTERN = /^[0-9]{6}$/;

// Exact CanonicalEmail pattern from auth.openapi.yaml, anchored to the whole
// string so a trailing newline cannot slip through `$`.
const CANONICAL_EMAIL_PATTERN = new RegExp(
  '^(?=.{1,254}$)(?=.{1,64}@)[a-z0-9_%+\\-]+(?:\\.[a-z0-9_%+\\-]+)*@[a-z0-9](?:[a-z0-9\\-]{0,61}[a-z0-9])?' +
    '(?:\\.[a-z0-9](?:[a-z0-9\\-]{0,61}[a-z0-9])?)+$(?![\\s\\S])'
);

// ECMAScript trim then ASCII lowercase; the raw input string is never mutated
// for the caller (submission copies are normalized server-side as well).
export function canonicalizeEmail(value) {
  return value.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function isCanonicalEmail(value) {
  return CANONICAL_EMAIL_PATTERN.test(value);
}

export function readEmailField(value) {
  const email = canonicalizeEmail(value);
  if (email.length === 0) throw authProblem('emailEmpty', { field: 'email' });
  if (!isCanonicalEmail(email)) throw authProblem('emailInvalidFormat', { field: 'email' });
  return email;
}

export function readNicknameField(value) {
  const nickname = value.trim();
  const length = [...nickname].length;
  if (length === 0) throw authProblem('nicknameEmpty', { field: 'nickname' });
  if (length > 40) throw authProblem('nicknameTooLong', { field: 'nickname' });
  return nickname;
}

// Passwords are never trimmed, lowercased or Unicode-normalized.
export function readPasswordField(value) {
  const length = [...value].length;
  if (length < 8) throw authProblem('passwordTooShort', { field: 'password' });
  if (length > 128) throw authProblem('passwordTooLong', { field: 'password' });
  return value;
}

export function readVerificationCodeField(value) {
  if (!VERIFICATION_CODE_PATTERN.test(value)) {
    throw authProblem('verificationCodeInvalidFormat', { field: 'verificationCode' });
  }
  return value;
}

export function readChallengeIdField(value) {
  if (value === '') throw authProblem('verificationCodeMissing', { field: 'verificationCode' });
  if (!OPAQUE_ID_PATTERN.test(value)) throw authProblem('invalidFieldValue', { field: 'challengeId' });
  return value;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesType(value, type) {
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'string|null') return value === null || typeof value === 'string';
  throw new Error('Unsupported schema type: ' + type);
}

// Shared closed-request shape checker: unknown field, required field in schema
// order, then JSON type in properties order.
function ensureClosedShape(body, schema) {
  for (const key of Object.keys(body)) {
    if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
      throw authProblem('unknownField');
    }
  }
  for (const key of schema.required) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) {
      throw authProblem('requiredField', { field: key });
    }
  }
  for (const [key, type] of Object.entries(schema.properties)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (type.startsWith('const:')) continue;
    if (!matchesType(body[key], type)) throw authProblem('invalidFieldType', { field: key });
  }
}

export function readClosedObject(body, schema) {
  if (!isPlainObject(body)) throw authProblem('invalidRequestBody');
  ensureClosedShape(body, schema);
  return body;
}

export const REQUEST_SCHEMAS = {
  profile: { properties: { nickname: 'string' }, required: ['nickname'] },
  accountDeletion: {
    properties: { requestId: 'string', sessionId: 'string', email: 'string' },
    required: ['requestId', 'sessionId', 'email']
  },
  login: {
    properties: { email: 'string', password: 'string', rememberMe: 'boolean' },
    required: ['email', 'password', 'rememberMe']
  },
  emailCode: {
    properties: { email: 'string' },
    required: ['email']
  },
  register: {
    properties: {
      email: 'string',
      nickname: 'string',
      password: 'string',
      challengeId: 'string',
      verificationCode: 'string',
      termsAccepted: 'boolean',
      rememberMe: 'boolean'
    },
    required: ['email', 'nickname', 'password', 'challengeId', 'verificationCode', 'termsAccepted', 'rememberMe']
  },
  passwordReset: {
    properties: { verificationCode: 'string', password: 'string', challengeId: 'string', email: 'string' },
    required: ['verificationCode', 'password', 'challengeId', 'email']
  },
  logout: {
    properties: { sessionId: 'string|null' },
    required: ['sessionId']
  }
};

const SESSION_COMMANDS = {
  bootstrap: {
    properties: { action: 'const:bootstrap' },
    required: ['action']
  },
  activate: {
    properties: { action: 'const:activate', sessionId: 'string', rememberMe: 'boolean' },
    required: ['action', 'sessionId', 'rememberMe']
  },
  restore: {
    properties: { action: 'const:restore', sessionId: 'string' },
    required: ['action', 'sessionId']
  }
};

const SESSION_COMMAND_PROPERTIES = new Set(['action', 'sessionId', 'rememberMe']);

// Session command root: reject properties outside the command union first, then
// resolve action, then apply the selected branch shape.
export function readSessionCommand(body) {
  if (!isPlainObject(body)) throw authProblem('invalidRequestBody');
  for (const key of Object.keys(body)) {
    if (!SESSION_COMMAND_PROPERTIES.has(key)) throw authProblem('unknownField');
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'action')) {
    throw authProblem('requiredField', { field: 'action' });
  }
  if (typeof body.action !== 'string') throw authProblem('invalidFieldType', { field: 'action' });
  const branch = SESSION_COMMANDS[body.action];
  if (!branch) throw authProblem('invalidFieldValue', { field: 'action' });

  ensureClosedShape(body, branch);
  if (Object.prototype.hasOwnProperty.call(body, 'sessionId') && !OPAQUE_ID_PATTERN.test(body.sessionId)) {
    throw authProblem('invalidFieldValue', { field: 'sessionId' });
  }

  return {
    action: body.action,
    sessionId: Object.prototype.hasOwnProperty.call(body, 'sessionId') ? body.sessionId : null,
    rememberMe: body.rememberMe === true
  };
}

export function readLogoutSessionId(body) {
  if (typeof body.sessionId === 'string' && !OPAQUE_ID_PATTERN.test(body.sessionId)) {
    throw authProblem('invalidFieldValue', { field: 'sessionId' });
  }
  return body.sessionId;
}
