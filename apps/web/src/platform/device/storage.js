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
const recovered = new Set();
export function hasRecoveredDrafts(account) { return recovered.has(account); }
export function isDeletedAccount(account) {
  try { return storage()?.getItem(`tb.account.deleted:${account}`) === '1'; }
  catch (error) { report(error); return true; }
}
function notifyRecovery(account, name, value) {
  if (/draft|pending|collection/.test(name) || Object.keys(value?.drafts ?? {}).length || value?.editor?.pending || (value?.editor && JSON.stringify(value.editor.drafts) !== JSON.stringify(value.editor.baseline))) {
    recovered.add(account);
    queueMicrotask(() => window.dispatchEvent(new CustomEvent('tb:draft-restored', { detail: { account } })));
  }
}
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
/** Internal device seam: interpret a raw snapshot without selecting a branch
 * or rewriting legacy/damaged bytes. Archive and active readers use this alike. */
export function inspectLocalRecord(account, key, raw) {
  const prefix = `${PREFIX}:${account}:`;
  if (!key.startsWith(prefix)) return null;
  const name = key.slice(prefix.length);
  const value = decode(raw);
  if (name.startsWith('head:')) return null;
  if (!name.startsWith('branch:')) return { name, value };
  if (value?.formatVersion !== 2 || value.accountKey !== account ||
      typeof value.name !== 'string' || !name.endsWith(`:${value.name}`))
    throw new Error('设备草稿分区不匹配');
  return { name: value.name, value: value.value };
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
    // Earlier documents remain explicit recovery candidates until the teacher
    // clears device data. A later successful save only removes its own branch.
    notifyRecovery(account, name, value);
    return value;
  } catch (error) { blocked.add(key); report(error); return null; }
}
export function writeLocal(account, name, value) {
  if (isDeletedAccount(account)) return false;
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
/** Select existing snapshots for this tab's next document, without modifying
 * another tab or replacing any saved snapshot. The caller performs a reload.
 * @public Preserved recovery selection port; the management UI is not mounted. */
export function selectLocalSnapshots(account, names, snapshots) {
  const store = storage();
  if (!store) throw new Error('浏览器存储不可用');
  for (const snapshot of snapshots) {
    if (store.getItem(snapshot.key) !== snapshot.raw) throw new Error('这份现场已变化，请重新检查后选择');
    const value = decode(snapshot.raw);
    if (value.accountKey !== account || value.formatVersion !== 2 || value.name !== snapshot.logicalName)
      throw new Error('这份现场无法自动恢复，原资料已保留');
  }
  const next = new Map(names.map(name => [pointer(account, name), '']));
  for (const snapshot of snapshots) next.set(pointer(account, snapshot.logicalName), snapshot.key);
  const previous = new Map([...next.keys()].map(key => [key, window.sessionStorage.getItem(key)]));
  try { for (const [key, value] of next) window.sessionStorage.setItem(key, value); }
  catch (error) {
    for (const [key, value] of previous) value === null ? window.sessionStorage.removeItem(key) : window.sessionStorage.setItem(key, value);
    throw error;
  }
}
export function resetLocalReaders(account) {
  const store = storage();
  for (const [key, source] of selected) if (key.startsWith(`${PREFIX}:${account}:`) && (!source || store?.getItem(source) === null)) selected.delete(key);
  for (const key of blocked) if (key.startsWith(`${PREFIX}:${account}:`) && store?.getItem(key) === null) blocked.delete(key);
  for (const key of Object.keys(window.sessionStorage)) if (key.startsWith(`${PREFIX}:continue:${account}:`)) {
    const source = window.sessionStorage.getItem(key);
    if (!source || store?.getItem(source) === null) window.sessionStorage.removeItem(key);
  }
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

export function markAccountDeleted(account) {
  const key = `tb.account.deleted:${account}`;
  window.localStorage.setItem(key, '1');
  if (window.localStorage.getItem(key) !== '1') throw new Error('Account deletion marker unavailable');
}
export function clearAccountDeviceData(account) {
  const store = window.localStorage;
  for (const key of Object.keys(store))
    if (key.startsWith(`${PREFIX}:${account}:`) || key === `tb.device.clear:${account}`) store.removeItem(key);
  for (const key of Object.keys(window.sessionStorage))
    if (key.startsWith(`${PREFIX}:continue:${account}:`)) window.sessionStorage.removeItem(key);
  resetLocalReaders(account);
  recovered.delete(account);
}
