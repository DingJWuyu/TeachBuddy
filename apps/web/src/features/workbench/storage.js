/**
 * Per-account browser storage for drafts, unconfirmed requests and view scenes.
 *
 * The workbench contract only lets the server confirm a save, so everything kept
 * here is a local convenience that must never be reported as saved. Writes are
 * guarded: when the browser refuses to store, the failure is surfaced to the
 * shell instead of being silently swallowed.
 */

const PREFIX = 'tb.workbench.v1';
const PROBE_KEY = `${PREFIX}:probe`;

let storageFailureListener = null;

export function setStorageFailureListener(listener) {
  storageFailureListener = listener;
}

function reportStorageFailure(error) {
  if (storageFailureListener) storageFailureListener(error);
}

function storageScope(accountKey, name) {
  return `${PREFIX}:${accountKey}:${name}`;
}

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    reportStorageFailure(error);
    return null;
  }
}

/** True when this browser can actually keep a local draft. */
export function canPersistLocally() {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(PROBE_KEY, '1');
    store.removeItem(PROBE_KEY);
    return true;
  } catch (error) {
    reportStorageFailure(error);
    return false;
  }
}

export function readLocal(accountKey, name) {
  const store = storage();
  if (!store || !accountKey) return null;
  try {
    const raw = store.getItem(storageScope(accountKey, name));
    return raw == null ? null : JSON.parse(raw);
  } catch (error) {
    // A corrupted or unreadable record is treated as absent; the teacher keeps
    // working against the server version instead of seeing broken state.
    return null;
  }
}

export function writeLocal(accountKey, name, value) {
  const store = storage();
  if (!store || !accountKey) return false;
  try {
    store.setItem(storageScope(accountKey, name), JSON.stringify(value));
    return true;
  } catch (error) {
    reportStorageFailure(error);
    return false;
  }
}

export function removeLocal(accountKey, name) {
  const store = storage();
  if (!store || !accountKey) return false;
  try {
    store.removeItem(storageScope(accountKey, name));
    return true;
  } catch (error) {
    reportStorageFailure(error);
    return false;
  }
}

/** Keys of one account partition, used by the settings page to report drafts. */
export function listLocalNames(accountKey) {
  const store = storage();
  if (!store || !accountKey) return [];
  const scope = `${PREFIX}:${accountKey}:`;
  const names = [];
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && key.startsWith(scope)) names.push(key.slice(scope.length));
    }
  } catch (error) {
    reportStorageFailure(error);
  }
  return names;
}

export function clearLocalPartition(accountKey) {
  const store = storage();
  if (!store || !accountKey) return false;
  const scope = `${PREFIX}:${accountKey}:`;
  const doomed = [];
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && key.startsWith(scope)) doomed.push(key);
    }
    doomed.forEach((key) => store.removeItem(key));
    return true;
  } catch (error) {
    reportStorageFailure(error);
    return false;
  }
}
