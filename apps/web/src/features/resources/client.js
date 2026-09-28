import i18n from "../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "resources", ...options });
import { deviceRequestStore } from "../workbench/deviceRequestStore.js";
// Localize known contract identities only. The original problem remains attached
// to the error for conflict handling and diagnostics.
function resourceProblemMessage(problem) {
  const keys = {
    '/problems/materials/storage-unavailable': 'problem.storageUnavailable',
    '/problems/materials/preview-required': 'problem.previewRequired',
    '/problems/materials/recognition-unavailable': 'problem.recognitionUnavailable',
    '/problems/materials/job-running': 'problem.jobRunning',
    '/problems/materials/job-not-retryable': 'problem.jobNotRetryable',
    '/problems/workbench/not-found': 'problem.notFound',
    '/problems/workbench/object-deleted': 'problem.deleted',
    '/problems/workbench/request-not-allowed': 'problem.forbidden',
    '/problems/workbench/idempotency-key-reused': 'problem.keyReused',
    '/problems/workbench/malformed-json': 'problem.malformedJson',
    '/problems/workbench/payload-too-large': 'problem.tooLarge',
    '/problems/workbench/unsupported-media-type': 'problem.unsupportedType',
    '/problems/workbench/temporarily-unavailable': 'problem.unavailable',
  };
  if (Object.hasOwn(keys, problem?.type ?? '')) return t(keys[problem.type]);
  if (problem?.type === '/problems/materials/invalid-taxonomy') {
    if (problem.field === '/folderId') return t('problem.folderMissing');
    if (problem.field === '/tagIds') return t('problem.tagsInvalid');
    if (/^\/folders(?:\/\d+\/parentId)?$/.test(problem.field ?? '')) return t('problem.folderHierarchy');
    return t('problem.categoryNames');
  }
  if (problem?.type === '/problems/workbench/invalid-input') {
    const reasons = {
      required: 'problem.required', 'unknown-field': 'problem.unknownField',
      'invalid-type': 'problem.invalidType', 'out-of-range': 'problem.outOfRange',
      'empty-content': 'problem.empty', 'duplicate-id': 'problem.duplicate',
      'invalid-reference': 'problem.invalidReference',
      'unsupported-content-version': 'problem.contentVersion',
    };
    return t(Object.hasOwn(reasons, problem.reason ?? '') ? reasons[problem.reason] : 'problem.invalidInput');
  }
  return null;
}

// transport is the authenticated page transport supplied by the shell. No raw
// fetch fallback: uploads and bytes must have the same identity as JSON writes.
export function createResourcesClient(transport, getSignal, onIdentityLost) {
  if (typeof transport !== "function")
    throw new Error("Resources requires the page-bound transport");
  async function request(
    path,
    { method = "GET", input, key, blob = false } = {},
  ) {
    // Capture this request's lifecycle even if React later restarts the effect.
    const signal = getSignal();
    const headers = {};
    let body;
    if (method !== "GET") {
      const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
      const allowed =
        method === "PUT"
          ? new RegExp(
              `^/api/modules/(?:resources/(?:taxonomy|items/${id}(?:/(?:file|supplement-preview))?)|lessons/v3/${id})$`,
            )
          : method === "POST"
            ? new RegExp(
                `^/api/(?:workbench/(?:files(?:/${id}/(?:preview|recognition))?|jobs/${id}/(?:retry|cancel))|modules/resources/(?:search/retry|items(?:/organize|/${id}/(?:deletion|purge|restore-file))?))$`,
              )
            : null;
      if (
        !allowed?.test(path) ||
        typeof key !== "string" ||
        !input ||
        typeof input !== "object"
      )
        throw Object.assign(
          new Error(t("原请求格式暂不支持，已保留设备资料，请核对后处理")),
          { unknown: true },
        );
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
          signal.aborted ? t("身份已变更") : t("结果未确认，请用原请求重试确认"),
        ),
        { unknown: true },
      );
    }
    if (signal.aborted)
      throw Object.assign(new Error(t("身份已变更")), { unknown: true });
    if (response.status === 401) {
      onIdentityLost?.();
      throw Object.assign(new Error(t("登录已失效，请重新登录后确认原请求")), {
        status: 401,
        unknown: true,
      });
    }
    if (!response.ok)
      throw Object.assign(
        new Error(
          resourceProblemMessage(value) ?? (response.status === 409
            ? t("版本已变化，请对照当前内容")
            : response.status === 401
              ? t("登录已失效，请重新登录")
              : value.detail || t("操作未完成，请检查内容后重试")),
        ),
        {
          status: response.status,
          problem: value,
          unknown: response.status >= 500,
        },
      );
    if (!blob && (!value || typeof value !== "object"))
      throw Object.assign(new Error(t("结果未确认")), { unknown: true });
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
  return deviceRequestStore({
    database: "teachbuddy-resources-pending",
    storeName: "requests",
    account: accountKey,
    name: "pending:resources",
    action: value === undefined ? "get" : value === null ? "delete" : "put",
    value,
  });
}
