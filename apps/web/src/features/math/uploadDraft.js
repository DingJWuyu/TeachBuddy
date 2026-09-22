// IndexedDB preserves a File and its request key across reloads without putting
// potentially large or binary originals into the JSON/localStorage draft.
export async function uploadDraft(account, action, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("teachbuddy.math.uploads", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("pending");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        "pending",
        action === "get" ? "readonly" : "readwrite",
      );
      const store = transaction.objectStore("pending");
      const request =
        action === "get"
          ? store.get(account)
          : action === "put"
            ? store.put(value, account)
            : store.delete(account);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
