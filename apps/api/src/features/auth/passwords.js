// Password hashing, verification-code digests and opaque identifiers.
//
// Password storage uses Node's mature scrypt implementation with explicit
// parameters and a versioned format. Legacy `salt:hexKey` scrypt hashes from
// the fixed baseline remain verifiable so old accounts can sign in and are
// upgraded to the versioned format on the next successful login.

import crypto from 'node:crypto';

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAX_MEMORY = 96 * 1024 * 1024;

const LEGACY_SCRYPT_N = 16384;
const LEGACY_SCRYPT_R = 8;
const LEGACY_SCRYPT_P = 1;
const LEGACY_KEY_LENGTH = 64;

const CODE_CONTEXT = 'teachbuddy-auth-code-v1';

function scrypt(password, salt, keyLength, parameters) {
  return crypto.scryptSync(password, salt, keyLength, { ...parameters, maxmem: SCRYPT_MAX_MEMORY });
}

function timingSafeEqualStrings(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derivedKey.toString('base64url')
  ].join('$');
}

// Returns { ok, legacy } so successful legacy logins can upgrade the hash.
export function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || storedHash.length === 0) return { ok: false, legacy: false };

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 6) return { ok: false, legacy: false };
    const [, n, r, p, salt, expected] = parts;
    try {
      const derivedKey = scrypt(password, Buffer.from(salt, 'base64url'), Buffer.from(expected, 'base64url').length, {
        N: Number(n),
        r: Number(r),
        p: Number(p)
      });
      return { ok: timingSafeEqualStrings(derivedKey.toString('base64url'), expected), legacy: false };
    } catch {
      return { ok: false, legacy: false };
    }
  }

  // Baseline format: <saltHex>:<derivedKeyHex>
  if (!storedHash.includes(':')) return { ok: false, legacy: false };
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return { ok: false, legacy: false };
  try {
    const derivedKey = scrypt(password, salt, LEGACY_KEY_LENGTH, {
      N: LEGACY_SCRYPT_N,
      r: LEGACY_SCRYPT_R,
      p: LEGACY_SCRYPT_P
    });
    return { ok: timingSafeEqualStrings(derivedKey.toString('hex'), expected.toLowerCase()), legacy: true };
  } catch {
    return { ok: false, legacy: false };
  }
}

export function generateVerificationCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

export function hashVerificationCode(code, secret) {
  return crypto.createHmac('sha256', secret).update(CODE_CONTEXT + ':' + code).digest('base64url');
}

export function verifyVerificationCode(code, digest, secret) {
  if (typeof digest !== 'string' || digest.length === 0) return false;
  return timingSafeEqualStrings(hashVerificationCode(code, secret), digest);
}

export function randomOpaqueId(prefix) {
  return prefix + '_' + crypto.randomBytes(24).toString('base64url');
}

// One deterministic dummy hash keeps credential-rejection timing uniform for
// unknown emails and known emails with a wrong password.
let dummyHash = null;
export function dummyPasswordHash() {
  if (!dummyHash) dummyHash = hashPassword(crypto.randomBytes(18).toString('base64url'));
  return dummyHash;
}
