export function ensureOwnedReferences(dataStore, accountId, key, ids, message) {
  const accountStore = dataStore.forAccount(accountId);
  for (const id of new Set(ids.filter(Boolean))) {
    if (!accountStore.get(key, id)) {
      const error = new Error(message);
      error.status = 404;
      throw error;
    }
  }
}
