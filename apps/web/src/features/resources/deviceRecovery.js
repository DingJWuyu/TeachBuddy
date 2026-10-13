// The resources module owns the binary store and its legacy/branch pointers.
// Recovery coordination only asks it to freeze or read a recovery point.
const databaseName = 'teachbuddy-resources-pending';
const storeName = 'requests';
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function freezeResourceUploads(account, recoveryId) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite'), store = tx.objectStore(storeName), request = store.get(account);
      request.onsuccess = () => {
        if (request.result !== undefined) {
          store.put(request.result, `${account}:recovery:${recoveryId}`);
          store.delete(account);
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function readResourceRecoveryUploads(account, recoveryId, records) {
  const keys = new Set([`${account}:recovery:${recoveryId}`]);
  for (const [name, raw] of Object.entries(records ?? {})) {
    if (!name.startsWith(`tb.workbench.v1:${account}:`) || !name.endsWith(':pending:resources')) continue;
    try {
      const record = JSON.parse(raw), pointer = record?.formatVersion === 2 ? record.value : record;
      if (typeof pointer?.idbKey === 'string' && pointer.idbKey.startsWith(`${account}:`)) keys.add(pointer.idbKey);
    } catch { /* The coordinator retains unrecognized text verbatim. */ }
  }
  const db = await database(), result = [];
  try {
    for (const key of keys) {
      const value = await new Promise((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (value !== undefined) result.push({ store: databaseName, value });
    }
    return result;
  } finally { db.close(); }
}
