const connections = new Map();
const connecting = new Map();
let ready = chrome.storage.local.get('connections').then(({ connections: saved = [] }) => {
  for (const entry of saved) connections.set(entry.key, entry);
});
const save = () => chrome.storage.local.set({ connections: [...connections.values()] });
const keyOf = (tabId, sessionId) => `${tabId}:${sessionId}`;
const providerOrigin = 'https://chat.deepseek.com';
const sessionFrom = (url) => {
  try { return new URL(url).pathname.match(/\/chat\/s\/([^/]+)/)?.[1] || null; } catch { return null; }
};
const isWorkbench = (sender) => {
  try {
    const url = new URL(sender.url);
    return sender.tab && sender.frameId === 0 && ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch { return false; }
};
const error = (message, code, text, extra = {}) => ({ type: 'ERROR', requestId: message.requestId,
  sessionId: message.sessionId, code, message: text, ...extra });
async function notify(connection, message) {
  try { await chrome.tabs.sendMessage(connection.workbenchTabId, { ...message, source: 'teachbuddy-web-ai' }); } catch { /* Closed or navigated workbench. */ }
}
async function failPending(connection, code, text, extra = {}) {
  if (!connection.pending) return;
  const pending = connection.pending;
  connection.pending = null;
  await save();
  await notify(connection, error({ ...pending, sessionId: connection.sessionId }, code, text, extra));
}
async function providerMessage(tabId, message) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { return await chrome.tabs.sendMessage(tabId, message); } catch (err) {
      if (attempt === 49) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
async function connect(message, workbenchTabId) {
  const key = keyOf(workbenchTabId, message.sessionId);
  let connection = connections.get(key);
  if (connection?.invalid) { connections.delete(key); connection = null; }
  if (connection) {
    try { await chrome.tabs.get(connection.providerTabId); } catch { connections.delete(key); connection = null; }
  }
  if (!connection) {
    const tab = await chrome.tabs.create({ url: `${providerOrigin}/`, active: false });
    connection = { key, workbenchTabId, sessionId: message.sessionId, providerTabId: tab.id,
      providerSessionUrl: `${providerOrigin}/`, pending: null };
    connections.set(key, connection);
    await save();
  }
  let state = await providerMessage(connection.providerTabId, { type: 'PROBE' });
  for (let attempt = 0; !state.ready && !state.loginRequired && attempt < 50; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    state = await chrome.tabs.sendMessage(connection.providerTabId, { type: 'PROBE' });
  }
  if (!state.ready && !state.loginRequired) return error(message, 'INPUT_NOT_FOUND', '未找到 DeepSeek 消息输入框，请确认页面加载完成。');
  connection.providerSessionUrl = state.providerSessionUrl || connection.providerSessionUrl;
  await save();
  if (state.loginRequired) await chrome.tabs.update(connection.providerTabId, { active: true });
  return { type: 'CONNECTED', requestId: message.requestId, sessionId: message.sessionId,
    providerSessionUrl: connection.providerSessionUrl, loginRequired: !!state.loginRequired };
}
async function handleWorkbench(message, sender) {
  if (message.type === 'STATUS') {
    const connection = connections.get(keyOf(sender.tab.id, message.sessionId));
    const status = { type: 'STATUS', requestId: message.requestId, sessionId: message.sessionId,
      extensionVersion: chrome.runtime.getManifest().version, connectionState: 'available' };
    if (connecting.has(keyOf(sender.tab.id, message.sessionId))) return { ...status, connectionState: 'connecting' };
    if (!connection) return status;
    if (connection.invalid) return { ...status, connectionState: 'disconnected', reason: connection.reason };
    try {
      const state = await chrome.tabs.sendMessage(connection.providerTabId, { type: 'PROBE' });
      return { ...status, connectionState: state.loginRequired ? 'login' : state.ready ? 'ready' : 'disconnected',
        loginRequired: !!state.loginRequired, providerSessionUrl: state.providerSessionUrl,
        ...(!state.ready && !state.loginRequired ? { reason: 'INPUT_NOT_FOUND' } : {}) };
    } catch { return { ...status, connectionState: 'disconnected', reason: 'PROVIDER_DISCONNECTED' }; }
  }
  const key = keyOf(sender.tab.id, message.sessionId);
  if (message.type === 'CONNECT') {
    if (!connecting.has(key)) connecting.set(key, connect(message, sender.tab.id).finally(() => connecting.delete(key)));
    const result = await connecting.get(key);
    return { ...result, requestId: message.requestId };
  }
  const connection = connections.get(key);
  if (!connection) return error(message, 'NOT_CONNECTED', '请先连接 DeepSeek 网页会话。');
  if (message.type === 'CANCEL') {
    if (connection.pending?.requestId !== message.requestId) return null;
    await failPending(connection, 'CANCELLED', '已取消当前请求。');
    try { await chrome.tabs.sendMessage(connection.providerTabId, { type: 'CANCEL', requestId: message.requestId }); } catch { /* Tab already closed. */ }
    return null;
  }
  if (message.type !== 'SEND') return null;
  if (connection.pending) return error(message, 'BUSY', '当前会话仍在生成，请等待或取消。');
  if (typeof message.prompt !== 'string' || !message.prompt.trim() || message.prompt.length > 100000) {
    return error(message, 'INVALID_PROMPT', '消息为空或过长，请缩小作品上下文。');
  }
  connection.pending = { requestId: message.requestId };
  await save();
  try {
    const response = await chrome.tabs.sendMessage(connection.providerTabId, { type: 'SEND',
      requestId: message.requestId, sessionId: message.sessionId, prompt: message.prompt,
      expectedSessionUrl: connection.providerSessionUrl });
    if (response?.error) await failPending(connection, response.code || 'PROVIDER_ERROR', response.error, { loginRequired: response.loginRequired });
  } catch { await failPending(connection, 'PROVIDER_DISCONNECTED', 'DeepSeek 标签页未就绪，请重新连接。'); }
  return null;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message || typeof message.type !== 'string') return false;
  if (isWorkbench(sender) && ['STATUS', 'CONNECT', 'SEND', 'CANCEL'].includes(message.type)) {
    if (typeof message.requestId !== 'string' || typeof message.sessionId !== 'string') return false;
    ready.then(() => handleWorkbench(message, sender)).then(respond).catch(() => respond(error(message,
      'CONNECTION_FAILED', '无法连接 DeepSeek 标签页，请确认网络并重新连接。')));
    return true;
  }
  ready.then(async () => {
    const connection = [...connections.values()].find((entry) => entry.providerTabId === sender.tab?.id);
    if (!connection || sender.frameId !== 0 || !sender.url?.startsWith(`${providerOrigin}/`) ||
      connection.pending?.requestId !== message.requestId) return;
    if (!['PROGRESS', 'DONE', 'ERROR'].includes(message.type)) return;
    const response = { type: message.type, requestId: message.requestId, sessionId: connection.sessionId };
    if (typeof message.text === 'string') response.text = message.text;
    if (typeof message.providerSessionUrl === 'string') response.providerSessionUrl = message.providerSessionUrl;
    if (message.type === 'ERROR') {
      response.code = message.code;
      response.message = message.message;
      response.loginRequired = !!message.loginRequired;
    }
    if (message.type !== 'PROGRESS') connection.pending = null;
    if (message.providerSessionUrl) connection.providerSessionUrl = message.providerSessionUrl;
    await save();
    await notify(connection, response);
  }).catch(() => {});
  return false;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  ready.then(async () => {
    for (const [key, connection] of connections) {
      if (connection.providerTabId === tabId) {
        await failPending(connection, 'PROVIDER_CLOSED', 'DeepSeek 标签页已关闭，请重新连接。');
        connection.invalid = true;
        connection.reason = 'PROVIDER_CLOSED';
      } else if (connection.workbenchTabId === tabId) {
        if (connection.pending) {
          try { await chrome.tabs.sendMessage(connection.providerTabId, { type: 'CANCEL', requestId: connection.pending.requestId }); } catch { /* Closed provider. */ }
        }
        connections.delete(key);
      }
    }
    await save();
  });
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url && change.status !== 'loading') return;
  ready.then(async () => {
    for (const connection of connections.values()) {
      if (connection.providerTabId !== tabId) continue;
      if (change.url) {
        const oldSession = sessionFrom(connection.providerSessionUrl);
        const newSession = sessionFrom(change.url);
        if (!change.url.startsWith(`${providerOrigin}/`) || (oldSession && oldSession !== newSession)) {
          await failPending(connection, 'SESSION_CHANGED', 'DeepSeek 页面切换了会话，请重新连接。');
          connection.invalid = true;
          connection.reason = 'SESSION_CHANGED';
          await save();
        } else if (newSession) {
          connection.providerSessionUrl = change.url;
          await save();
        }
      } else if (change.status === 'loading') {
        await failPending(connection, 'PROVIDER_RELOADED', 'DeepSeek 页面已刷新，当前请求已中止。');
      }
    }
  });
});

// Store installation/update must attach to pages that were already open.
chrome.runtime.onInstalled.addListener(() => {
  ready.then(async () => {
    const tabs = await chrome.tabs.query({ url: [
      'http://localhost/*', 'https://localhost/*', 'http://127.0.0.1/*', 'https://127.0.0.1/*',
      `${providerOrigin}/*`,
    ] });
    await Promise.all(tabs.map(async (tab) => {
      const file = tab.url?.startsWith(`${providerOrigin}/`) ? 'deepseek.js' : 'workbench.js';
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [file] }); }
      catch { /* A tab may close or navigate while the extension is installing. */ }
    }));
    for (const connection of connections.values()) {
      await failPending(connection, 'EXTENSION_UPDATED', '扩展已更新，当前请求已中止。请检查网页回复后再决定是否重新发送。');
    }
  }).catch(() => {});
});

// Tab IDs are only meaningful within the current browser run.
chrome.runtime.onStartup.addListener(() => {
  ready = ready.then(async () => { connections.clear(); await save(); });
  ready.catch(() => {});
});
