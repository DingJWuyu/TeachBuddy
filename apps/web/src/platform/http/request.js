/** HTTP mechanics only. Feature clients retain their errors and retry semantics. */
export function sendHttpRequest(transport, path, { signal, timeoutMs, ...options } = {}) {
  const signals = [signal, timeoutMs === undefined ? null : AbortSignal.timeout(timeoutMs)].filter(Boolean);
  return transport(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    ...(signals.length ? { signal: signals.length === 1 ? signals[0] : AbortSignal.any(signals) } : {}),
  });
}

export async function readHttpBody(response, type = 'json', signal) {
  let value;
  if (type === 'blob') value = await response.blob();
  else if (type === 'optional-json') {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('application/problem+json')) return null;
    try { value = await response.json(); } catch { return null; }
  } else value = await response.json();
  signal?.throwIfAborted();
  return value;
}

export function fileFormData(file, name = file.name) {
  const body = new FormData();
  if (name === undefined) body.append('file', file);
  else body.append('file', file, name);
  return body;
}
