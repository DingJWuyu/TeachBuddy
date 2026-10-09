(() => {
  const TIMEOUT_MS = 180000;
  const STABLE_MS = 2500;
  let active = null;
  const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const sessionId = (url = location.href) => new URL(url).pathname.match(/\/chat\/s\/([^/]+)/)?.[1] || null;
  const editor = () => [...document.querySelectorAll('textarea#chat-input, .ds-textarea textarea, textarea[placeholder="Message DeepSeek"], textarea[placeholder="给 DeepSeek 发送消息"], textarea[placeholder="给DeepSeek发送消息"], [role="textbox"][contenteditable]')].find((node) => !!node.getClientRects().length) || null;
  const loginRequired = () => /\/(?:sign_in|login)(?:\/|$)/.test(location.pathname) ||
    (!editor() && [...document.querySelectorAll('a, button, [role="button"]')].some((node) =>
      !!node.getClientRects().length && /^(?:log in|sign in|登录|登入)$/i.test(normalize(node.textContent))));
  const visible = (node) => !!node && !!node.getClientRects().length;
  const label = (node) => normalize([node.getAttribute('aria-label'), node.title, node.textContent].join(' ')).toLowerCase();
  function stopButton() {
    const icon = document.querySelector('.ds-icon-stop-circle, .ds-icon-stop');
    if (icon && visible(icon)) return icon.closest('button, [role="button"]');
    return [...document.querySelectorAll('button, [role="button"]')].find((button) => visible(button) &&
      (/stop (generat|respond)|停止生成|停止回答/.test(label(button)) ||
        [...button.querySelectorAll('svg path')].some((path) => /M3 3h10v10H3z|M6 6h12v12H6z|M2 4\.88/.test(path.getAttribute('d') || ''))));
  }
  function sendButton(input) {
    const candidates = [...document.querySelectorAll('button, [role="button"]')].filter((button) => visible(button) &&
      !!(input.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING));
    return candidates.find((button) => /send message|submit message|发送|^send$|^submit$/.test(label(button)) ||
      !!button.querySelector('.ds-icon-send') || [...button.querySelectorAll('svg path')].some((path) => {
        const data = path.getAttribute('d') || '';
        return /M8\.3125?|M13\.12 19\.98/.test(data) || /M1219V[56]|M1018V6/.test(data.replace(/[,\s]/g, ''));
      }));
  }
  function disabled(button) {
    return !button || button.disabled || button.getAttribute('aria-disabled') === 'true' ||
      button.hasAttribute('disabled') || [...button.classList].some((name) => name.endsWith('--disabled'));
  }
  function nodes() { return [...document.querySelectorAll('.ds-message')]; }
  function role(node) {
    const explicit = node.getAttribute('data-message-author-role');
    if (explicit) return explicit.toLowerCase();
    if (node.matches('.d29f3d7d, .fbb737a4') || node.closest('div._9663006') ||
      node.querySelector('div._9663006, .d29f3d7d, .fbb737a4')) return 'user';
    if (node.querySelector('.ds-markdown, [class*="ds-markdown"]') || node.closest('div._4f9bf79._43c05b5')) return 'assistant';
    return 'unknown';
  }
  function text(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.ds-think-content, [class*="think"], button, [role="button"], script, style').forEach((item) => item.remove());
    // Keep JSON code intact instead of flattening rendered mathematics or controls into it.
    const code = [...clone.querySelectorAll('pre code')].filter((item) => /^[\[{]/.test(item.textContent.trim()));
    if (code.length === 1) return code[0].textContent.trim();
    const barePre = [...clone.querySelectorAll('pre')].filter((item) => !item.querySelector('code') && /^[\[{]/.test(item.textContent.trim()));
    if (barePre.length === 1) return barePre[0].textContent.trim();
    const markdown = clone.querySelector('.ds-markdown, [class*="ds-markdown"]') || clone;
    markdown.querySelectorAll('.katex').forEach((item) => {
      const source = item.querySelector('annotation[encoding="application/x-tex"]');
      if (source) item.replaceWith(document.createTextNode(`$${source.textContent}$`));
    });
    return markdown.textContent.trim();
  }
  function setInput(input, value) {
    input.focus();
    if (input instanceof HTMLTextAreaElement) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, value);
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand('insertText', false, value)) input.textContent = value;
    }
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Process', bubbles: true }));
  }
  const inputText = (input) => input instanceof HTMLTextAreaElement ? input.value : input.textContent;
  function emit(message) {
    try { chrome.runtime.sendMessage(message)?.catch(() => {}); } catch { /* Extension reloaded. */ }
  }
  function finish(run, message) {
    if (active !== run) return;
    active = null;
    clearInterval(run.timer);
    clearTimeout(run.timeout);
    run.observer.disconnect();
    if (message) emit({ ...message, requestId: run.requestId, providerSessionUrl: location.href });
  }
  function fail(run, code, message, extra = {}) {
    finish(run, { type: 'ERROR', code, message, ...extra });
  }
  function hasReplyFooter(assistant) {
    // DeepSeek renders actions beside the message, within this reply's wrapper.
    // A container holding multiple messages could expose an older reply's actions.
    const candidate = assistant.closest('div._4f9bf79._43c05b5') || assistant.parentElement;
    const messages = candidate?.querySelectorAll('.ds-message');
    const container = messages?.length === 1 && messages[0] === assistant ? candidate : assistant;
    return [...container.querySelectorAll('button, [role="button"]')].some((button) =>
      !button.closest('.ds-markdown, [class*="ds-markdown"]') &&
      (/copy|regenerat|share|复制|重新生成|分享/.test(label(button)) ||
        button.matches('.ds-icon-copy, .ds-icon-regenerate, .ds-icon-share') || !!button.querySelector('svg')));
  }
  function tick(run) {
    if (active !== run) return;
    if (loginRequired()) return fail(run, 'LOGIN_REQUIRED', '请在 DeepSeek 标签页完成登录。', { loginRequired: true });
    const currentSession = sessionId();
    if (run.providerSessionId && run.providerSessionId !== currentSession) {
      return fail(run, 'SESSION_CHANGED', 'DeepSeek 页面已切换到其他会话。');
    }
    if (!run.providerSessionId && currentSession) run.providerSessionId = currentSession;
    const input = editor();
    if (!input) return;
    const all = nodes();
    if (!run.userNode) {
      run.userNode = all.find((node) => !run.before.has(node) && role(node) === 'user' &&
        normalize(node.textContent).includes(normalize(run.prompt)));
    }
    if (!run.userNode || normalize(inputText(input))) return;
    const afterUser = all.filter((node) => !run.before.has(node) && role(node) === 'assistant' &&
      !!(run.userNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
    const assistant = afterUser.at(-1);
    if (!assistant) return;
    const output = text(assistant);
    if (output !== run.text) {
      run.text = output;
      run.changedAt = Date.now();
      if (output) emit({ type: 'PROGRESS', requestId: run.requestId, text: output, providerSessionUrl: location.href });
    }
    const streaming = stopButton() || assistant.querySelector('.ds-cursor') || assistant.classList.contains('_streaming');
    const footer = hasReplyFooter(assistant);
    if (output && !streaming && footer && Date.now() - run.changedAt >= STABLE_MS) {
      finish(run, { type: 'DONE', text: output });
    }
  }
  async function start(message) {
    if (active) return { error: '当前网页会话仍在生成。', code: 'BUSY' };
    if (loginRequired()) return { error: '请先在 DeepSeek 标签页登录。', code: 'LOGIN_REQUIRED', loginRequired: true };
    if (sessionId(message.expectedSessionUrl) !== sessionId()) return { error: '网页会话发生变化，请重新连接。', code: 'SESSION_CHANGED' };
    const input = editor();
    if (!input) return { error: '未找到 DeepSeek 消息输入框，请等待页面加载后重试。', code: 'INPUT_NOT_FOUND' };
    if (stopButton()) return { error: 'DeepSeek 正在生成，请稍后重试。', code: 'BUSY' };
    if (normalize(inputText(input))) return { error: '专用标签页中有未发送草稿，请先处理草稿。', code: 'DRAFT_PRESENT' };
    const run = { requestId: message.requestId, prompt: message.prompt, providerSessionId: sessionId(),
      before: new Set(nodes()), userNode: null, text: '', sent: false, changedAt: Date.now(), timer: null, timeout: null,
      observer: new MutationObserver(() => tick(run)) };
    active = run;
    setInput(input, message.prompt);
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (active !== run) return { accepted: false };
    if (normalize(inputText(input)) !== normalize(message.prompt)) {
      fail(run, 'INPUT_FAILED', '网页输入未成功，消息尚未发送。');
      return { accepted: false };
    }
    const button = sendButton(input);
    if (disabled(button)) {
      fail(run, 'SEND_UNAVAILABLE', '发送按钮未就绪或消息过长，消息尚未发送。');
      return { accepted: false };
    }
    run.observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    run.timer = setInterval(() => tick(run), 300);
    run.timeout = setTimeout(() => fail(run, 'TIMEOUT', '未能确认完整回复，请检查 DeepSeek 标签页。为避免重复，消息未自动重发。'), TIMEOUT_MS);
    run.sent = true;
    button.click();
    tick(run);
    return { accepted: true };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (message.type === 'PROBE') {
      respond({ loginRequired: loginRequired(), ready: !!editor(), providerSessionUrl: location.href });
      return false;
    }
    if (message.type === 'SEND') {
      start(message).then(respond).catch(() => {
        if (active?.requestId === message.requestId) fail(active, 'PAGE_ERROR', '网页连接发生错误，请检查专用标签页。');
        respond({ error: '网页连接发生错误。', code: 'PAGE_ERROR' });
      });
      return true;
    }
    if (message.type === 'CANCEL' && active?.requestId === message.requestId) {
      const run = active;
      const stop = stopButton();
      finish(run, null);
      if (!run.sent && editor() && normalize(inputText(editor())) === normalize(run.prompt)) setInput(editor(), '');
      stop?.click();
      respond({ cancelled: true });
    }
    return false;
  });
  window.addEventListener('pagehide', () => {
    if (active) fail(active, 'PROVIDER_RELOADED', 'DeepSeek 页面离开或刷新，当前请求已中止。');
  });
})();
