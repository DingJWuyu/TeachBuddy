// transport is the authenticated page transport supplied by the shell. No raw
// fetch fallback: uploads and bytes must have the same identity as JSON writes.
export function createResourcesClient(transport, signal, onIdentityLost) {
  if (typeof transport !== "function")
    throw new Error("Resources requires the page-bound transport");
  async function request(
    path,
    { method = "GET", input, key, blob = false } = {},
  ) {
    const headers = {};
    let body;
    if (method !== "GET") {
      headers["X-TeachBuddy-Request"] = "1";
      headers["Idempotency-Key"] = key;
      if (input instanceof Blob) {
        body = new FormData();
        body.append("file", input, input.name || "upload");
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(input);
      }
    }
    let response, value;
    try {
      response = await transport(path, {
        method,
        headers,
        body,
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
      });
      value =
        blob && response.ok ? await response.blob() : await response.json();
    } catch (error) {
      throw Object.assign(
        new Error(
          signal.aborted ? "身份已变更" : "结果未确认，请用原请求重试确认",
        ),
        { unknown: true },
      );
    }
    if (signal.aborted)
      throw Object.assign(new Error("身份已变更"), { unknown: true });
    if (response.status === 401) {
      onIdentityLost?.();
      throw Object.assign(new Error("登录已失效，请重新登录后确认原请求"), {
        status: 401,
        unknown: true,
      });
    }
    if (!response.ok)
      throw Object.assign(
        new Error(
          response.status === 409
            ? "版本已变化，请对照当前内容"
            : response.status === 401
              ? "登录已失效，请重新登录"
              : value.detail || "操作未完成，请检查内容后重试",
        ),
        {
          status: response.status,
          problem: value,
          unknown: response.status >= 500,
        },
      );
    if (!blob && (!value || typeof value !== "object"))
      throw Object.assign(new Error("结果未确认"), { unknown: true });
    return value;
  }
  return {
    request,
    async download(id, name) {
      const blob = await request(`/api/workbench/files/${id}/content`, {
        blob: true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}

// One unresolved logical mutation per account. IndexedDB also retains upload
// bytes, so closing the browser cannot force a different idempotency request.
export async function pendingStore(accountKey, value) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("teachbuddy-resources-pending", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("requests");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "requests",
        value === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("requests");
      const req =
        value === undefined
          ? store.get(accountKey)
          : value === null
            ? store.delete(accountKey)
            : store.put(value, accountKey);
      let result;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
