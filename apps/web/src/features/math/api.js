import { sendHttpRequest, readHttpBody, fileFormData } from '../../platform/http/request.js';
import i18n from '../../i18n/index.js';
const t = (key, options) => i18n.t(key, { ns: 'math', ...options });
// The caller owns the A11 transport and its account lifetime. Math preserves
// the original Problem fields instead of interpreting titles as error codes.
export function createMathClient(transport, getSignal) {
  async function response(path, { method = "GET", input, key } = {}, signal) {
    if (method !== 'GET') {
      const id = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
      const allowed = method === 'PUT' ? new RegExp(`^/api/modules/math/v1/works/${id}$`)
        : method === 'POST' ? new RegExp(`^/api/modules/math/v1/works(?:/${id}/(?:copy|exports|deletion|purge))?$`) : null;
      if (!allowed?.test(path) || typeof key !== 'string' || !input || typeof input !== 'object')
        throw new Error(t("原请求格式暂不支持，已保留设备资料，请核对后处理"));
    }
    const result = await sendHttpRequest(transport, path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal, timeoutMs: 35000,
      headers: input
        ? {
            "Content-Type": "application/json",
            "X-TeachBuddy-Request": "1",
            "Idempotency-Key": key,
          }
        : {},
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
    if (!result.ok) {
      const problem = await readHttpBody(result, 'json', signal);
      throw Object.assign(new Error(t("请求失败，请检查后重试")), {
        status: result.status,
        problem,
      });
    }
    return result;
  }
  return {
    async upload(file, key) {
      const signal = getSignal();
      const body = fileFormData(file);
      const result = await sendHttpRequest(transport, "/api/workbench/files", {
        method: "POST",
        body,
        signal,
        headers: { "X-TeachBuddy-Request": "1", "Idempotency-Key": key },
      });
      if (!result.ok)
        throw Object.assign(new Error(t("文件上传失败，请重试")), {
          status: result.status,
          problem: await readHttpBody(result, 'json', signal),
        });
      const value = await readHttpBody(result, 'json', signal);
      signal.throwIfAborted();
      return value;
    },
    async json(path, options) {
      const signal = getSignal();
      const body = await readHttpBody(await response(path, options, signal), 'json', signal);
      if (!body || typeof body !== "object")
        throw new Error(t("响应无法确认，请重试原请求"));
      signal.throwIfAborted();
      return body;
    },
    async blob(path) {
      const signal = getSignal();
      const body = await readHttpBody(await response(path, undefined, signal), 'blob', signal);
      signal.throwIfAborted();
      return body;
    },
  };
}
