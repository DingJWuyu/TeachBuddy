import { sendHttpRequest, readHttpBody } from './request.js';
/**
 * Same-origin workbench HTTP client.
 *
 * Every write carries the browser protection header and an idempotency key. The
 * client never decides that something is saved: it returns the parsed response
 * and lets the save lifecycle apply the contract's confirmation rule.
 */

import { problemFromResponse, unconfirmedProblem } from './problems.js';
import i18n from '../../i18n/index.js';

const WRITE_TIMEOUT_MS = 20_000;
const READ_TIMEOUT_MS = 15_000;

let identityLostListener = null;
let binding = null;

/** One active account generation; cleanup aborts reads and discards late writes. */
export function bindWorkbenchTransport(transport) {
  const current = { transport, controller: new AbortController() };
  binding?.controller.abort();
  binding = current;
  return () => {
    current.controller.abort();
    if (binding === current) binding = null;
  };
}


/** The shell hides business content as soon as any call reports 401. */
export function setIdentityLostListener(listener) {
  identityLostListener = listener;
}

export class WorkbenchError extends Error {
  constructor(problem) {
    super(problem.message);
    this.name = 'WorkbenchError';
    this.problem = problem;
  }
}

const readBody = response => readHttpBody(response, 'optional-json');

async function request(method, path, { body, idempotencyKey, write = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (write) {
    headers['Content-Type'] = 'application/json';
    headers['X-TeachBuddy-Request'] = '1';
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const current = binding;
  if (!current) throw new WorkbenchError({ kind: 'identity', message: '请重新登录' });
  let response;
  try {
    response = await sendHttpRequest(current.transport, path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: current.controller.signal, timeoutMs: write ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS
    });
  } catch (error) {
    if (binding !== current || current.controller.signal.aborted) throw new WorkbenchError({ kind: 'identity', message: '身份已变更' });
    if (error.kind === 'auth-locked') throw new WorkbenchError({ kind: 'identity', cause: 'auth-locked',
      get message() { return i18n.t('退出结果暂未确认，业务操作已锁定。请重试确认。', { ns: 'workbench' }); } });
    throw new WorkbenchError(unconfirmedProblem('无法连接服务，暂不能确认是否保存'));
  }

  const payload = await readBody(response);
  if (binding !== current || current.controller.signal.aborted) {
    throw new WorkbenchError({ kind: 'identity', message: '身份已变更' });
  }

  if (response.ok) {
    if (payload === null || typeof payload !== 'object') {
      // A non-JSON success is not a save; the boot path also uses this marker to
      // recognise a deployment that does not serve the workbench API at all.
      throw new WorkbenchError({ ...problemFromResponse(response.status, null), nonJson: true });
    }
    return { status: response.status, body: payload };
  }

  const parsed = problemFromResponse(response.status, payload);
  if (parsed.kind === 'identity' && identityLostListener) identityLostListener();
  throw new WorkbenchError(parsed);
}

export function workbenchGet(path) {
  return request('GET', path);
}

/** File bytes use the same page binding and account-generation cancellation. */
export async function workbenchBlob(path, { signal, timeoutMs = READ_TIMEOUT_MS } = {}) {
  const current = binding;
  if (!current) throw new WorkbenchError({ kind: 'identity', message: '请重新登录' });
  const signals = [current.controller.signal];
  if (signal) signals.push(signal);
  const response = await sendHttpRequest(current.transport, path, {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any(signals), timeoutMs
  });
  if (!response.ok) {
    const problem = problemFromResponse(response.status, await readBody(response));
    if (binding === current && problem.kind === 'identity') identityLostListener?.();
    throw new WorkbenchError(problem);
  }
  const blob = await readHttpBody(response, 'blob');
  if (binding !== current || current.controller.signal.aborted) {
    throw new WorkbenchError({ kind: 'identity', message: '身份已变更' });
  }
  return blob;
}

export function workbenchPost(path, body, idempotencyKey) {
  return request('POST', path, { body, idempotencyKey, write: true });
}

export function workbenchPut(path, body, idempotencyKey) {
  return request('PUT', path, { body, idempotencyKey, write: true });
}

export function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([name, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(name, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}
/** Fetch SSE through the same page-bound, generation-scoped auth transport. */
export async function workbenchEvents(path, signal, onEvent) {
  const current = binding;
  if (!current) throw new Error('身份未确认');
  const response = await sendHttpRequest(current.transport, path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/event-stream' },
    signal: AbortSignal.any([signal, current.controller.signal]) });
  if (response.status === 401) identityLostListener?.();
  if (!response.ok) throw new Error('无法读取对话');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      if (binding !== current || current.controller.signal.aborted) break;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = frame.split('\n').find(line => line.startsWith('data: '));
        if (data) onEvent(JSON.parse(data.slice(6)));
      }
    }
  } finally { await reader.cancel().catch(() => {}); }
}
