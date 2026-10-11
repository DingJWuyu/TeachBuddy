(() => {
  const allowedTypes = new Set(['STATUS', 'CONNECT', 'SEND', 'CANCEL']);
  const reply = (message) => window.postMessage({ ...message, source: 'teachbuddy-web-ai' }, location.origin);
  const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200;

  window.addEventListener('message', async (event) => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || !message ||
      message.source !== 'teachbuddy-workbench' || !allowedTypes.has(message.type) ||
      !validId(message.requestId) || !validId(message.sessionId)) return;
    if (message.type === 'SEND' && (typeof message.prompt !== 'string' || !message.prompt.trim())) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: message.type, requestId: message.requestId, sessionId: message.sessionId,
        ...(message.type === 'SEND' ? { prompt: message.prompt } : {}),
      });
      if (response) reply(response);
    } catch {
      reply({ type: 'ERROR', requestId: message.requestId, sessionId: message.sessionId,
        code: 'EXTENSION_DISCONNECTED', message: '扩展连接已断开，请刷新工作台后重新连接。' });
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.source === 'teachbuddy-web-ai') reply(message);
  });
})();
