const legacyKey = 'teachbuddy:account-deletion';
const prefix = 'teachbuddy:account-deletion:v1:';
const selectedKey = 'teachbuddy:account-deletion:selected';
function parse(raw) {
  const value = JSON.parse(raw);
  if (!value || (value.formatVersion !== undefined && value.formatVersion !== 1) ||
      typeof value.account?.accountKey !== 'string' || !value.account.accountKey ||
      !/^[0-9a-f]{64}$/.test(value.body?.requestId) ||
      typeof value.body?.sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value.body.sessionId) ||
      typeof value.body?.email !== 'string' || !value.body.email)
    throw new Error('deletion-storage');
  return value;
}
function migrateLegacy() {
  const raw = sessionStorage.getItem(legacyKey);
  if (raw === null) return;
  const value = parse(raw);
  rememberDeletion(value);
  selectDeletion(value.body.requestId);
  sessionStorage.removeItem(legacyKey);
}
export function listDeletions() {
  migrateLegacy();
  return Object.keys(localStorage).filter(key => key.startsWith(prefix)).sort().map(key => {
    const value = parse(localStorage.getItem(key));
    if (key !== prefix + value.body.requestId) throw new Error('deletion-storage');
    return value;
  });
}
export function readDeletion(requestId) {
  migrateLegacy();
  const raw = localStorage.getItem(prefix + requestId);
  if (raw === null) return null;
  const value = parse(raw);
  if (value.body.requestId !== requestId) throw new Error('deletion-storage');
  return value;
}
export function rememberDeletion(value) {
  parse(JSON.stringify(value));
  const raw = JSON.stringify({ ...value, formatVersion: 1 });
  const key = prefix + value.body.requestId;
  localStorage.setItem(key, raw);
  if (localStorage.getItem(key) !== raw) throw new Error('deletion-storage');
}
export function forgetDeletion(requestId) {
  localStorage.removeItem(prefix + requestId);
  if (localStorage.getItem(prefix + requestId) !== null) throw new Error('deletion-storage');
  if (readSelectedDeletionId() === requestId) selectDeletion(null);
}
export function readSelectedDeletionId() {
  migrateLegacy();
  const value = sessionStorage.getItem(selectedKey);
  if (value !== null && !/^[0-9a-f]{64}$/.test(value)) throw new Error('deletion-storage');
  return value;
}
export function selectDeletion(requestId) {
  if (requestId === null) sessionStorage.removeItem(selectedKey);
  else {
    if (!/^[0-9a-f]{64}$/.test(requestId)) throw new Error('deletion-storage');
    sessionStorage.setItem(selectedKey, requestId);
  }
  if (sessionStorage.getItem(selectedKey) !== requestId) throw new Error('deletion-storage');
}
export function deletionRequestId() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
}
