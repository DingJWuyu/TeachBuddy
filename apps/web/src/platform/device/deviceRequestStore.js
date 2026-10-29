import { requestIdentity, openRequestDatabase } from './requestIdentity.js';
import { canReclaimRequest } from './requestReferences.js';
import { readLocal, removeLocal, writeLocal, isDeletedAccount } from './storage.js';
async function fileIdentity(file) {
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  return { name: file.name, size: file.size, sha256 };
}
const requestFile = value => value?.file instanceof Blob ? value.file : value?.input instanceof Blob ? value.input : null;
export async function reselectDeviceFile(request, file) {
  const original = requestFile(request);
  if (!original || !file) throw new Error('请重新选择原文件');
  const expected = request.fileIdentity ?? await fileIdentity(original);
  if (JSON.stringify(await fileIdentity(file)) !== JSON.stringify(expected))
    throw new Error(`文件名称、长度或内容不匹配，请选择原文件“${expected.name}”`);
  return { ...request, [request.file ? 'file' : 'input']: file, fileIdentity: expected, requiresReselection: false };
}

/** Binary upload bodies live in IndexedDB. A branch-local pointer prevents two
 * tabs from replacing each other's original request or file bytes. */
export async function deviceRequestStore({ identity, slot, account, action = 'get', value }) {
  const binding = requestIdentity(identity);
  const { storeName } = binding;
  if (binding.slots && (typeof slot !== 'string' || !slot)) throw new Error('Device request slot required');
  const name = binding.slots ? binding.name + slot : binding.name;
  const db = await openRequestDatabase(binding);
  const transact = (method, key, data) => new Promise((resolve, reject) => {
    if (method === 'put' && isDeletedAccount(account)) { reject(new Error('Account deleted')); return; }
    const tx = db.transaction(storeName, method === 'get' ? 'readonly' : 'readwrite');
    const store = tx.objectStore(storeName);
    const request = method === 'put' ? store.put(data, key) : store[method](key);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('设备请求存储不可用'));
  });
  async function removeIfUnreferenced(key) {
    if (!key) return;
    if (!canReclaimRequest(account, binding, key)) return;
    await transact('delete', key);
  }
  try {
    const previous = readLocal(account, name);
    if (action === 'get') {
      if (previous?.idbKey) {
        const result = await transact('get', previous.idbKey);
        if (!result) throw new Error('待确认请求的原文件无法读取，请保留设备资料并重新选择原文件');
        return { ...result, requiresReselection: Boolean(requestFile(result)) };
      }
      const legacy = await transact('get', account);
      if (!legacy) return null;
      const idbKey = `${account}:${legacy.key}`;
      await transact('put', idbKey, legacy);
      if (!writeLocal(account, name, { idbKey })) throw new Error('无法保留原请求，请检查浏览器存储权限');
      if (await transact('get', idbKey)) await transact('delete', account);
      return { ...legacy, requiresReselection: Boolean(requestFile(legacy)) };
    }
    if (action === 'delete') {
      if (!removeLocal(account, name)) throw new Error('未能清除已确认请求的设备记录');
      await removeIfUnreferenced(previous?.idbKey);
      return null;
    }
    const idbKey = `${account}:${value.key}`;
    const file = requestFile(value);
    if (file && !value.fileIdentity) value = { ...value, fileIdentity: await fileIdentity(file) };
    await transact('put', idbKey, value);
    if (!writeLocal(account, name, { idbKey })) throw new Error('无法保留原请求，请检查浏览器存储权限');
    if (previous?.idbKey !== idbKey) await removeIfUnreferenced(previous?.idbKey);
    return value;
  } finally { db.close(); }
}

/** Remove every binary record in this account partition, including archives. */
export async function clearDeviceRequestAccount({ identity, account }) {
  const binding = requestIdentity(identity);
  const { storeName } = binding;
  const db = await openRequestDatabase(binding);
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const cursor = store.openKeyCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        if (item.key === account || (typeof item.key === 'string' && item.key.startsWith(account + ':'))) store.delete(item.key);
        item.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('设备请求存储不可用'));
    });
  } finally { db.close(); }
}
