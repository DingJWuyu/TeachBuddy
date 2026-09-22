/*
 * The page context is a per-document selector inside the browser cookie
 * container. It is created on every document load and every time the entry
 * gives up an authentication context; it is never persisted.
 */
export function createPageContext() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
