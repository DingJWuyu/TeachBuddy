import { isDeletedAccount } from './storage.js';
import { requestIdentities, openRequestDatabase } from './requestIdentity.js';
import { archivePrefix as prefix, readArchive, archivedRequestKeys } from './requestReferences.js';
// Move existing device state out of the active namespaces before mounting any
// editor after a time-point restore. Values remain byte-for-byte inspectable.
const tracker = (account) => `teachbuddy:data-recovery:${account}`;
async function moveUploads(account, recoveryId) {
  for (const binding of Object.values(requestIdentities)) {
    const { storeName } = binding;
    const db = await openRequestDatabase(binding);
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite"),
          store = tx.objectStore(storeName),
          request = store.get(account);
        request.onsuccess = () => {
          if (request.result !== undefined) {
            store.put(request.result, `${account}:recovery:${recoveryId}`);
            store.delete(account);
          }
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}
async function prepare(account, context) {
  if (isDeletedAccount(account)) return false;
  let previous;
  try {
    previous = localStorage.getItem(tracker(account));
  } catch (error) {
    if (context.recoveredFrom) throw error;
    return false;
  }
  const changed =
    previous !== context.recoveryId &&
    (previous !== null || context.recoveredFrom);
  if (changed) {
    const key = prefix(account) + context.recoveryId;
    const raw = localStorage.getItem(key);
    const archive = raw === null ? {
      from: previous,
      to: context.recoveryId,
      createdAt: new Date().toISOString(),
      records: {},
    } : readArchive(raw);
    const names = Object.keys(localStorage).filter(
      (name) =>
        name.startsWith(`tb.workbench.v1:${account}:`) ||
        name === `teachbuddy.math.${account}` ||
        name.startsWith(`teachbuddy:agent:${account}:`),
    );
    for (const name of names)
      archive.records[name] = localStorage.getItem(name);
    const bytes = JSON.stringify(archive);
    localStorage.setItem(key, bytes);
    if (localStorage.getItem(key) !== bytes)
      throw new Error("恢复前草稿未能完整保留");
    await moveUploads(account, context.recoveryId);
    if (isDeletedAccount(account)) return false;
    for (const name of names)
      if (localStorage.getItem(name) === archive.records[name])
        localStorage.removeItem(name);
  }
  try {
    localStorage.setItem(tracker(account), context.recoveryId);
  } catch (error) {
    if (changed) throw error;
  }
  return Boolean(changed);
}
/** @public Preserved recovery archive reader; the management UI is not mounted. */
export function recoveryArchives(account) {
  try {
    return Object.keys(localStorage)
      .filter((name) => name.startsWith(prefix(account)))
      .map((name) => {
        const raw = localStorage.getItem(name);
        try {
          const archive = readArchive(raw);
          return archive;
        } catch {
          return { to: name, createdAt: null, records: { unrecognized: raw } };
        }
      });
  } catch {
    return [];
  }
}
/** @public Preserved access to binary records in recovery archives. */
export async function archivedUploads(account, recoveryId) {
  const result = [];
  const archive = recoveryArchives(account).find(item => item.to === recoveryId);
  for (const binding of Object.values(requestIdentities)) {
    const keys = new Set([`${account}:recovery:${recoveryId}`, ...archivedRequestKeys(account, archive, binding)]);
    const { storeName } = binding;
    const db = await openRequestDatabase(binding);
    try {
      for (const key of keys) {
        const value = await new Promise((resolve, reject) => {
          const request = db.transaction(storeName).objectStore(storeName).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (value !== undefined) result.push({ store: binding.database, value });
      }
    } finally {
      db.close();
    }
  }
  return result;
}

export function prepareDeviceRecovery(account, context) {
  return navigator.locks
    ? navigator.locks.request(`teachbuddy-recovery:${account}`, () =>
        prepare(account, context),
      )
    : prepare(account, context);
}

export function clearRecoveryDeviceData(account) {
  localStorage.removeItem(tracker(account));
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix(account))) localStorage.removeItem(key);
}
