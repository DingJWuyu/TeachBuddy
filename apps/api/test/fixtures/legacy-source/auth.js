import crypto from 'node:crypto';

// Legacy password format used by migration fixtures.
const PASSWORD_KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}
