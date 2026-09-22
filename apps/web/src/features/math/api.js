// The caller owns the A11 transport and its account lifetime. Math preserves
// the original Problem fields instead of interpreting titles as error codes.
export function createMathClient(transport, getSignal) {
  async function response(path, { method = 'GET', input, key } = {}, signal) {
    const result = await transport(path, {
      method, credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
      headers: input ? { 'Content-Type': 'application/json', 'X-TeachBuddy-Request': '1', 'Idempotency-Key': key } : {},
      ...(input ? { body: JSON.stringify(input) } : {})
    });
    if (!result.ok) {
      const problem = await result.json();
      throw Object.assign(new Error('请求失败，请检查后重试'), { status: result.status, problem });
    }
    return result;
  }
  return {
    async json(path, options) {
      const signal = getSignal();
      const body = await (await response(path, options, signal)).json();
      if (!body || typeof body !== "object") throw new Error("响应无法确认，请重试原请求");
      signal.throwIfAborted();
      return body;
    },
    async blob(path) {
      const signal = getSignal();
      const body = await (await response(path, undefined, signal)).blob();
      signal.throwIfAborted();
      return body;
    }
  };
}
