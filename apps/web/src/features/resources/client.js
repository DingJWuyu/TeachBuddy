import { deviceRequestStore } from '../workbench/deviceRequestStore.js';
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
      const id = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
      const allowed = method === 'PUT'
        ? new RegExp(`^/api/modules/(?:resources/(?:taxonomy|items/${id}(?:/(?:file|supplement-preview))?)|lessons/v3/${id})$`)
        : method === 'POST' ? new RegExp(`^/api/(?:workbench/files(?:/${id}/preview)?|modules/resources/items(?:/${id}/deletion)?)$`) : null;
      if (!allowed?.test(path) || typeof key !== 'string' || !input || typeof input !== 'object')
        throw Object.assign(new Error('原请求格式暂不支持，已保留设备资料，请核对后处理'), { unknown: true });
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

export function pendingStore(accountKey, value) {
  return deviceRequestStore({ database: 'teachbuddy-resources-pending', storeName: 'requests',
    account: accountKey, name: 'pending:resources',
    action: value === undefined ? 'get' : value === null ? 'delete' : 'put', value });
}
