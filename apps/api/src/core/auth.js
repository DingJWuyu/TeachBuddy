import crypto from 'node:crypto';
import { createEnv } from '../config/env.js';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_RECOVERY_CODE_LENGTH = 6;

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function sign(payload) {
  const data = JSON.stringify(payload);
  return crypto.createHmac('sha256', createEnv().authSecret).update(data).digest('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, passwordHash) {
  if (!passwordHash || typeof passwordHash !== 'string' || !passwordHash.includes(':')) {
    return false;
  }

  const [salt, storedKey] = passwordHash.split(':');
  const derivedKey = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const storedBuffer = Buffer.from(storedKey, 'hex');

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

export function generatePasswordRecoveryCode() {
  return crypto.randomInt(0, 10 ** PASSWORD_RECOVERY_CODE_LENGTH)
    .toString()
    .padStart(PASSWORD_RECOVERY_CODE_LENGTH, '0');
}

export function hashPasswordRecoveryCode(code, salt, secret) {
  return crypto.createHmac('sha256', secret).update(`${salt}:${code}`).digest('hex');
}

export function verifyPasswordRecoveryCode(code, codeHash, salt, secret) {
  const expected = hashPasswordRecoveryCode(code, salt, secret);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(codeHash || '');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function createToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + TOKEN_TTL_MS
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(payload);
  return `${encoded}.${signature}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  try {
    const [encoded, signature] = token.split('.');
    const payload = JSON.parse(fromBase64Url(encoded));
    const expectedSignature = sign(payload);
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(signature || '');

    if (expectedBuffer.length !== providedBuffer.length) return null;
    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
