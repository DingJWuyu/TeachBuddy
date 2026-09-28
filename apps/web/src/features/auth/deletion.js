import { resetLocalReaders } from '../workbench/storage.js';

const pendingKey = 'teachbuddy:account-deletion';
export function readDeletion() {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey));
    return value?.account?.accountKey && /^[0-9a-f]{64}$/.test(value.body?.requestId) ? value : null;
  } catch { return null; }
}
export function rememberDeletion(value) {
  const raw = JSON.stringify(value);
  sessionStorage.setItem(pendingKey, raw);
  if (sessionStorage.getItem(pendingKey) !== raw) throw new Error('deletion-storage');
}
export function forgetDeletion() { sessionStorage.removeItem(pendingKey); }
export function deletionRequestId() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function deleteUploads(database, storeName, account) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const cursor = tx.objectStore(storeName).openKeyCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        if (item.key === account || (typeof item.key === 'string' && item.key.startsWith(account + ':')))
          tx.objectStore(storeName).delete(item.key);
        item.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

// Called only after an authenticated deletion receipt. A small tombstone stops
// late editors in another tab from recreating deleted account device records.
export async function clearDeletedAccountDeviceData(account) {
  localStorage.setItem(`tb.account.deleted:${account}`, '1');
  const prefixes = [`tb.workbench.v1:${account}:`, `teachbuddy:agent:${account}:`, `teachbuddy:data-recovery-archive:${account}:`];
  const exact = [`teachbuddy.math.${account}`, `teachbuddy:data-recovery:${account}`, `tb.device.clear:${account}`];
  for (const key of Object.keys(localStorage))
    if (prefixes.some(prefix => key.startsWith(prefix)) || exact.includes(key)) localStorage.removeItem(key);
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith(`tb.workbench.v1:continue:${account}:`)) sessionStorage.removeItem(key);
  await deleteUploads('teachbuddy.math.uploads', 'pending', account);
  await deleteUploads('teachbuddy-resources-pending', 'requests', account);
  resetLocalReaders(account);
}
