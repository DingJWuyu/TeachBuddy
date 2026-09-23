/** Device records stay account-scoped. Each document owns an independent branch;
 * sessionStorage remembers which snapshot this tab should continue after reload.
 * The legacy key is a latest-snapshot entry point for a newly opened tab only.
 */
import { newRequestKey } from './uuid.js';
const PREFIX = 'tb.workbench.v1';
const PROBE_KEY = `${PREFIX}:probe`;
const branchId = newRequestKey();
const selected = new Map();
const blocked = new Set();
let storageFailureListener = null;
export function setStorageFailureListener(listener) { storageFailureListener = listener; }
function report(error) { storageFailureListener?.(error); }
const scope = (account, name) => `${PREFIX}:${account}:${name}`;
const branchName = name => `branch:${branchId}:${name}`;
const pointer = (account, name) => `${PREFIX}:continue:${account}:${name}`;
function storage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch (error) { report(error); return null; }
}
export function canPersistLocally() {
  const store = storage(); if (!store) return false;
  try { store.setItem(PROBE_KEY, '1'); store.removeItem(PROBE_KEY); return true; }
  catch (error) { report(error); return false; }
}
function decode(raw) {
  const value = JSON.parse(raw);
  if (value && typeof value === 'object' && value.formatVersion > 2) throw new Error('设备资料版本暂不支持');
  return value;
}
function remember(account, name, source) {
  selected.set(scope(account, name), source);
  // A denied sessionStorage cannot degrade into silently sharing another tab.
  window.sessionStorage.setItem(pointer(account, name), source ?? '');
}
function saveBranch(store, account, name, value) {
  const key = scope(account, branchName(name));
  const envelope = { formatVersion: 2, editorBranchId: branchId, accountKey: account,
    name, updatedAt: new Date().toISOString(), value };
  const raw = JSON.stringify(envelope);
  store.setItem(key, raw);
  if (store.getItem(key) !== raw) throw new Error('设备草稿写入未确认');
  return key;
}
export function readLocal(account, name) {
  const store = storage(); if (!store || !account) return null;
  const key = scope(account, name);
  try {
    if (blocked.has(key)) return null;
    if (selected.has(key)) {
      const source = selected.get(key);
      if (!source) return null;
      const raw = store.getItem(source);
      return raw === null ? null : decode(raw).value;
    }
    const previous = window.sessionStorage.getItem(pointer(account, name));
    if (previous === '') { selected.set(key, null); return null; }
    let value;
    if (previous && store.getItem(previous) !== null) {
      const envelope = decode(store.getItem(previous));
      if (envelope.accountKey !== account || envelope.name !== name || envelope.formatVersion !== 2) throw new Error('设备草稿分区不匹配');
      value = envelope.value;
    } else {
      const raw = store.getItem(key);
      if (raw === null) { selected.set(key, null); return null; }
      value = decode(raw);
    }
    const own = saveBranch(store, account, name, value);
    remember(account, name, own);
    const headKey = scope(account, `head:${name}`);
    const head = store.getItem(headKey);
    if ((previous && head && JSON.parse(head) === previous) || (!head && store.getItem(key) === JSON.stringify(value)))
      store.setItem(headKey, JSON.stringify(own));
    // An earlier document in this same tab is now represented by a verified
    // copy. Never remove a source selected from another tab's latest entry.
    if (previous && previous !== own && !window.opener) store.removeItem(previous);
    return value;
  } catch (error) { blocked.add(key); report(error); return null; }
}
export function writeLocal(account, name, value) {
  const store = storage(); if (!store || !account) return false;
  const key = scope(account, name);
  try {
    // Preserve damaged/future legacy data even if its editor never read it.
    const existing = store.getItem(key);
    if (existing !== null) decode(existing);
    if (blocked.has(key)) throw new Error('原设备资料无法读取，已保留原文');
    const own = saveBranch(store, account, name, value);
    remember(account, name, own);
    store.setItem(key, JSON.stringify(value));
    store.setItem(scope(account, `head:${name}`), JSON.stringify(own));
    return true;
  } catch (error) { report(error); return false; }
}
export function removeLocal(account, name) {
  const store = storage(); if (!store || !account) return false;
  const key = scope(account, name);
  try {
    if (blocked.has(key)) return false;
    const own = scope(account, branchName(name));
    const headKey = scope(account, `head:${name}`);
    const head = store.getItem(headKey);
    const raw = store.getItem(key);
    const branch = store.getItem(own);
    // A save/discard in this tab may only remove its own latest entry.
    if ((head && JSON.parse(head) === own) || (!head && branch && raw === JSON.stringify(decode(branch).value))) {
      store.removeItem(key); store.removeItem(headKey);
    }
    store.removeItem(own);
    remember(account, name, null);
    return true;
  } catch (error) { report(error); return false; }
}
export function listLocalNames(account) {
  const store = storage(); if (!store || !account) return [];
  const prefix = `${PREFIX}:${account}:`;
  try {
    return Object.keys(store).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
  } catch (error) { report(error); return []; }
}
/** Explicit cleanup is handled by deviceData after pending-operation inspection. */
export function resetLocalReaders(account) {
  for (const key of selected.keys()) if (key.startsWith(`${PREFIX}:${account}:`)) selected.delete(key);
  for (const key of blocked) if (key.startsWith(`${PREFIX}:${account}:`)) blocked.delete(key);
  for (const key of Object.keys(window.sessionStorage)) if (key.startsWith(`${PREFIX}:continue:${account}:`)) window.sessionStorage.removeItem(key);
}
export function clearLocalPartition(account) {
  // Legacy callers receive an honest failure instead of erasing pending input.
  const store = storage(); if (!store || !account) return false;
  try {
    const names = listLocalNames(account);
    if (names.some(name => /pending/.test(name))) return false;
    for (const name of names) {
      const value = decode(store.getItem(scope(account, name)));
      if (JSON.stringify(value).includes('"pending":{') || JSON.stringify(value).includes('"pendingRequest":{')) return false;
    }
    for (const name of names) store.removeItem(scope(account, name));
    resetLocalReaders(account); return true;
  } catch (error) { report(error); return false; }
}

/** Migrate one legacy module record only after a verified branch copy exists. */
export function migrateLegacyLocal(account, name, legacyKey) {
  const current = readLocal(account, name);
  if (current !== null) return current;
  const store = storage(); if (!store) return null;
  try {
    const raw = store.getItem(legacyKey); if (raw === null) return null;
    const value = decode(raw);
    if (writeLocal(account, name, value) && JSON.stringify(readLocal(account, name)) === JSON.stringify(value)) store.removeItem(legacyKey);
    return value;
  } catch (error) { blocked.add(scope(account, name)); report(error); return null; }
}
