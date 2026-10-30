/*
 * Local input rules for the account entry. The same rules gate the
 * submit buttons so an input the browser can judge never becomes a business
 * request; the server still validates independently.
 */

const CANONICAL_EMAIL =
  /^(?=.{1,254}$)(?=.{1,64}@)[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const VERIFICATION_CODE_SHAPE = /^[0-9]{6}$/;

function codePointLength(value) {
  return Array.from(String(value)).length;
}

export function trimmed(value) {
  return String(value).trim();
}

function asciiLower(value) {
  return value.replace(/[A-Z]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));
}

export function normalizeEmail(value) {
  return asciiLower(trimmed(value));
}

function isCanonicalEmail(value) {
  return CANONICAL_EMAIL.test(value);
}

export function isVerificationCodeShape(value) {
  return VERIFICATION_CODE_SHAPE.test(value);
}

export function emailIssue(value) {
  const normalized = normalizeEmail(value);
  if (!normalized) return 'empty';
  if (normalized.length > 254 || !isCanonicalEmail(normalized)) return 'invalid-format';
  return null;
}

export function nicknameIssue(value) {
  const normalized = trimmed(value);
  if (!normalized) return 'empty';
  if (codePointLength(normalized) > 40) return 'too-long';
  return null;
}

export function passwordIssue(value) {
  const length = codePointLength(value);
  if (length < 8) return 'too-short';
  if (length > 128) return 'too-long';
  return null;
}
