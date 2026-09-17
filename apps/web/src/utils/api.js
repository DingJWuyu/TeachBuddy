const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const API_ORIGIN = API_BASE.replace(/\/api$/, '');

function getToken() {
  return typeof window !== 'undefined' ? window.localStorage.getItem('refatos-token') || '' : '';
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload?.message || `Request failed for ${path}`);
  return payload;
}

export const fetchJson = (path) => request(path);
export const postJson = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const putJson = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
export const deleteJson = (path) => request(path, { method: 'DELETE' });
export const postForm = (path, formData) => request(path, { method: 'POST', body: formData });
export const getApiUrl = (path) => `${API_BASE}${path}`;
export const getUploadUrl = (path) => `${API_ORIGIN}${path}`;
