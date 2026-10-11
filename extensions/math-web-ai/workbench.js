(() => {
  globalThis.__teachbuddyWorkbenchBridge?.();
  const allowedTypes = new Set(['STATUS', 'CONNECT', 'SEND', 'CANCEL']);
  const extensionVersion = chrome.runtime.getManifest().version;
  const reply = (message) => window.postMessage({ extensionVersion, ...message, source: 'teachbuddy-web-ai' }, location.origin);
  const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200;

  const receive = async (event) => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || !message ||
      message.source !== 'teachbuddy-workbench' || !allowedTypes.has(message.type) ||
      !validId(message.requestId) || !validId(message.sessionId)) return;
    if (!chrome.runtime.id) {
      globalThis.__teachbuddyWorkbenchBridge?.();
      return;
    }
    // A replaced 0.1 bridge has an anonymous bubble listener. Suppress it too.
    event.stopImmediatePropagation();
    if (message.type === 'SEND' && (typeof message.prompt !== 'string' || !message.prompt.trim())) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: message.type, requestId: message.requestId, sessionId: message.sessionId,
        ...(message.type === 'SEND' ? { prompt: message.prompt } : {}),
      });
      if (response) reply(response);
    } catch {
      reply({ type: 'ERROR', requestId: message.requestId, sessionId: message.sessionId,
        code: 'EXTENSION_DISCONNECTED', message: '扩展正在更新或连接已断开，请稍后重新检查连接。' });
    }
  };

  const forward = (message) => {
    if (message?.source === 'teachbuddy-web-ai') reply(message);
  };
  window.addEventListener('message', receive, true);
  chrome.runtime.onMessage.addListener(forward);
  globalThis.__teachbuddyWorkbenchBridge = () => {
    window.removeEventListener('message', receive, true);
    try { chrome.runtime.onMessage.removeListener(forward); } catch { /* Replaced runtime. */ }
  };
  reply({ type: 'AVAILABILITY', extensionVersion: chrome.runtime.getManifest().version });
})();
