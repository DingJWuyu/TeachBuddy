const outgoing = 'teachbuddy-workbench';
const incoming = 'teachbuddy-web-ai';
let extensionVersion = null;
let versionedBridgeAvailable = false;

/** A single browser request. Provider credentials never enter the workbench. */
export function webAiRequest(type, sessionId, { prompt, signal, onProgress } = {}) {
  const requestId = crypto.randomUUID();
  const requestVersion = extensionVersion;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => finish(new Error(type === 'STATUS'
      ? '尚未连接浏览器扩展。安装工作台 AI 连接扩展后，重新检查连接。'
      : '连接超时，已停止等待。请检查 DeepSeek 页面后再试。')), type === 'STATUS' ? 1800 : type === 'SEND' ? 240000 : 30000);
    function post(action) { window.postMessage({ source: outgoing, type: action, requestId, sessionId, ...(action === 'SEND' ? { prompt } : {}) }, location.origin); }
    function finish(error, value) {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      window.removeEventListener('message', receive); signal?.removeEventListener('abort', abort);
      if (error && type === 'SEND') post('CANCEL');
      if (error) reject(error); else resolve(value);
    }
    function abort() { finish(new DOMException('已停止', 'AbortError')); }
    function receive(event) {
      const data = event.data;
      if (event.source !== window || event.origin !== location.origin || data?.source !== incoming) return;
      if (data.type === 'AVAILABILITY') {
        versionedBridgeAvailable = true;
        extensionVersion = data.extensionVersion;
        if (type === 'SEND' && data.extensionVersion !== requestVersion) finish(Object.assign(
          new Error('扩展已更新，当前请求已中止。请检查网页回复后再决定是否重新发送。'), { code: 'EXTENSION_UPDATED' }));
        return;
      }
      // Invalidated 0.1 listeners can still emit unversioned errors after an update.
      if (versionedBridgeAvailable && data.type === 'ERROR' && data.code === 'EXTENSION_DISCONNECTED' && !data.extensionVersion) return;
      if (data.requestId !== requestId || data.sessionId !== sessionId) return;
      if (typeof data.extensionVersion === 'string') extensionVersion = data.extensionVersion;
      if (data.type === 'PROGRESS') { onProgress?.(data.text ?? ''); return; }
      if (data.type === 'ERROR') { finish(Object.assign(new Error(data.message || '网页版 AI 连接失败。'), { code: data.code })); return; }
      if (data.type === (type === 'SEND' ? 'DONE' : type === 'CONNECT' ? 'CONNECTED' : 'STATUS')) finish(null, data);
    }
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort(); else post(type);
  });
}

/** Availability is only a hint: subscribers must request STATUS to learn readiness. */
export function subscribeWebAiAvailability(callback) {
  const receive = (event) => {
    if (event.source === window && event.origin === location.origin &&
      event.data?.source === incoming && event.data.type === 'AVAILABILITY') {
      versionedBridgeAvailable = true;
      extensionVersion = event.data.extensionVersion;
      callback();
    }
  };
  window.addEventListener('message', receive);
  return () => window.removeEventListener('message', receive);
}
