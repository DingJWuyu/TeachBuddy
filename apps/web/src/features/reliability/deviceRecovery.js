import { isDeletedAccount } from '../../platform/device/storage.js';
// Move existing device state out of the active namespaces before mounting any
// editor after a time-point restore. Values remain byte-for-byte inspectable.
const tracker = (account) => `teachbuddy:data-recovery:${account}`;
const prefix = (account) => `teachbuddy:data-recovery-archive:${account}:`;
const stores = [
  ["teachbuddy-resources-pending", "requests", "pending:resources"],
  ["teachbuddy.math.uploads", "pending", "pending:math-upload"],
  ["teachbuddy.questions.uploads", "pending", "pending:questions-upload"],
  ["teachbuddy-classroom-pending", "requests", "pending:classroom-upload"],
  ["teachbuddy-sample-week", "requests", "pending:sample-week:"],
];
function database(name, store) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function moveUploads(account, recoveryId) {
  for (const [name, storeName] of stores) {
    const db = await database(name, storeName);
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
    const archive = JSON.parse(localStorage.getItem(key) || "null") ?? {
      from: previous,
      to: context.recoveryId,
      createdAt: new Date().toISOString(),
      records: {},
    };
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
          const archive = JSON.parse(raw);
          if (
            !archive ||
            typeof archive.to !== "string" ||
            !archive.records ||
            typeof archive.records !== "object"
          )
            throw new Error("Unknown archive");
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
  for (const [name, storeName, logicalName] of stores) {
    const keys = new Set([`${account}:recovery:${recoveryId}`]);
    // New requests keep immutable binary records behind legacy or branch pointers.
    // Read the archived pointers, including restores completed before this reader existed.
    for (const [recordName, raw] of Object.entries(archive?.records ?? {})) {
      if (!recordName.startsWith(`tb.workbench.v1:${account}:`)) continue;
      const ownsPointer = logicalName.endsWith(":")
        ? recordName.includes(`:${logicalName}`)
        : recordName.endsWith(`:${logicalName}`);
      if (!ownsPointer) continue;
      try {
        const record = JSON.parse(raw);
        const pointer = record?.formatVersion === 2 ? record.value : record;
        if (typeof pointer?.idbKey === "string" && pointer.idbKey.startsWith(`${account}:`))
          keys.add(pointer.idbKey);
      } catch {
        // Unrecognized draft text remains available through the original archive.
      }
    }
    const db = await database(name, storeName);
    try {
      for (const key of keys) {
        const value = await new Promise((resolve, reject) => {
          const request = db.transaction(storeName).objectStore(storeName).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (value !== undefined) result.push({ store: name, value });
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
