// Calls the classroom service (/api/modules/classroom) the way the app does:
// JSON bodies, an Idempotency-Key on every write, problems surfaced as errors.
import { tx } from '../react.js';

const BASE = '/api/modules/classroom';
const key = () => crypto.randomUUID();

export class ApiError extends Error {
  constructor(status, problem) {
    super(problem?.detail || (status === 409 ? tx('内容已在别处更新，请刷新后再试。') : tx('操作没有完成，请再试一次。')));
    this.status = status;
    this.problem = problem || {};
  }
}

async function call(method, path, body) {
  const init = { method, headers: {} };
  if (method !== 'GET') init.headers['Idempotency-Key'] = key();
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(BASE + path, init);
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    for (const v of Array.isArray(value) ? value : [value]) search.append(name, v);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: (path, params) => call('GET', path + qs(params)),
  post: (path, body) => call('POST', path, body ?? {}),
  put: (path, body) => call('PUT', path, body),
  remove: (collection, item, deleted = true) => call('PUT', `/${collection}/${item.id}/deletion`, { baseVersion: item.version, deleted }),
  async upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/workbench/files', { method: 'POST', body: fd, headers: { 'Idempotency-Key': key() } });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, json);
    return json;
  },
  fileUrl: (id) => `/api/workbench/files/${id}/content`,
};
