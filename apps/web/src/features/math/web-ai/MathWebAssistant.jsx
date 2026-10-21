import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { readLocal, writeLocal } from '../../../platform/device/storage.js';
import { Icon } from '../../../components/icons.jsx';
import { getInstallation, isExtensionCompatible } from './installation.js';
import { subscribeWebAiAvailability, webAiRequest } from './bridge.js';
import { mathPrompt, readProposal } from './protocol.js';
import './assistant.css';

export function MathWebAssistant({ controller, title, accountKey, onStart, takeRequest }) {
  const { t } = useTranslation('math');
  const installation = getInstallation();
  const [conversation, setConversation] = useState(() => readLocal(accountKey, 'math-web-assistant') ?? { sessionId: crypto.randomUUID(), messages: [], input: '' });
  const [connection, setConnection] = useState('checking');
  const [checking, setChecking] = useState(false);
  const isConnecting = useRef(false);
  const connectPromise = useRef(null);
  const connectionLifetime = useRef(null);
  const connectionSequence = useRef(0);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const active = useRef(null);
  const latest = useRef({ controller, title, conversation });
  latest.current = { controller, title, conversation };
  const thread = useRef(null);
  const [setupOpen, setSetupOpen] = useState(false);
  useEffect(() => {
    setStorageError(!writeLocal(accountKey, 'math-web-assistant', conversation));
  }, [accountKey, conversation]);
  useEffect(() => {
    const lifetime = new AbortController(); connectionLifetime.current = lifetime;
    setRunning(false); setStage(''); setError('');
    void checkConnection(lifetime.signal);
    const unsubscribeAvailability = subscribeWebAiAvailability(() => {
      if (!active.current) void checkConnection(lifetime.signal);
    });
    const focus = () => { if (!active.current) void checkConnection(lifetime.signal); };
    window.addEventListener('focus', focus);
    return () => {
      lifetime.abort();
      active.current?.abort();
      active.current = null;
      unsubscribeAvailability();
      window.removeEventListener('focus', focus);
    };
  }, [accountKey, conversation.sessionId, controller]);
  async function checkConnection(signal = connectionLifetime.current?.signal) {
    if (signal?.aborted || isConnecting.current) return;
    const sequence = ++connectionSequence.current; setChecking(true);
    try {
      const result = await webAiRequest('STATUS', conversation.sessionId, { signal });
      if (signal?.aborted || sequence !== connectionSequence.current) return;
      if (result.extensionVersion && !isExtensionCompatible(result.extensionVersion)) {
        setConnection('incompatible');
      } else {
        setConnection(result.connectionState ?? (result.loginRequired ? 'login' : 'available'));
      }
    } catch {
      if (!signal?.aborted && sequence === connectionSequence.current) {
        setConnection('missing');
      }
    } finally {
      if (!signal?.aborted && sequence === connectionSequence.current) setChecking(false);
    }
  }
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [conversation.messages.length, stage]);
  function append(message) { setConversation(value => ({ ...value, messages: [...value.messages, { id: crypto.randomUUID(), ...message }] })); }
  async function connect(signal) {
    if (connectPromise.current) return connectPromise.current;
    const promise = (async () => {
      isConnecting.current = true;
      const sequence = ++connectionSequence.current; setChecking(false); setConnection('connecting');
      try {
        const result = await webAiRequest('CONNECT', conversation.sessionId, { signal });
        if (signal?.aborted || sequence !== connectionSequence.current) return false;

        if (result.loginRequired) {
          setConnection('login');
          setSetupOpen(true);
          return false;
        }
        setConnection('ready');
        setSetupOpen(false);
        providerRef.current?.focus();
        return true;
      } catch (failure) {
        if (signal?.aborted || sequence !== connectionSequence.current) return false;
        setConnection('disconnected');
        if (failure.name !== 'AbortError') setError(failure.message);
        return false;
      } finally {
        isConnecting.current = false;
        connectPromise.current = null;
      }
    })();
    connectPromise.current = promise;
    return promise;
  }
  useEffect(() => {
    if (!controller || !takeRequest) return;
    const frame = requestAnimationFrame(() => { const request = takeRequest(); if (request) void send(null, request.text); });
    return () => cancelAnimationFrame(frame);
  }, [controller, takeRequest]);
  async function send(event, initialInput) {
    event?.preventDefault();
    const request = (initialInput ?? conversation.input).trim();
    if (active.current || !request) return;

    if (['incompatible', 'missing'].includes(connection)) {
      setSetupOpen(true);
      return;
    }

    const lifetime = new AbortController(); active.current = lifetime;
    setRunning(true); setError('');

    const connected = await connect(lifetime.signal);
    if (!connected || lifetime.signal.aborted) {
      if (active.current === lifetime) {
        active.current = null;
        setRunning(false);
        setSetupOpen(true);
      }
      return;
    }

    if (!controller) {
      if (!onStart) { active.current = null; setRunning(false); return; }
      try {
        lifetime.signal.throwIfAborted();
        await onStart(request);
      } catch (failure) {
        if (active.current === lifetime && failure.name !== 'AbortError') setError(failure.message);
      } finally {
        if (active.current === lifetime) { active.current = null; setRunning(false); }
      }
      return;
    }

    const captured = controller;
    setStage(t('正在连接 DeepSeek'));
    append({ role: 'user', text: request });
    setConversation(value => ({ ...value, input: '' }));
    try {
      let execution;
      for (let round = 0; round < 4; round += 1) {
        lifetime.signal.throwIfAborted();
        if (latest.current.controller !== captured) throw new Error(t('当前作品已切换，本轮已停止。'));
        const current = captured.read();
        setStage(execution ? t('正在核对画布结果') : t('正在理解当前作品'));
        const response = await webAiRequest('SEND', conversation.sessionId, {
          signal: lifetime.signal,
          prompt: mathPrompt({ title: latest.current.title, current, request, execution,
            recent: round === 0 ? conversation.messages.filter(m => m.role !== 'tool').slice(-8).map(({ role, text }) => ({ role, text })) : undefined }),
          onProgress: () => setStage(execution ? t('正在核对画布结果') : t('DeepSeek 正在思考')),
        });
        lifetime.signal.throwIfAborted();
        if (latest.current.controller !== captured) throw new Error(t('当前作品已切换，本轮已停止。'));
        const proposal = readProposal(response.text, current);
        if (!Object.keys(proposal.changes).length) { append({ role: 'assistant', text: proposal.message }); setStage(''); return; }
        setStage(t('正在修改画布'));
        try {
          const after = await captured.apply({ baseEditRevision: current.editRevision, changes: proposal.changes }, lifetime.signal);
          lifetime.signal.throwIfAborted();
          execution = { ok: true, operations: proposal.operations, editRevision: after.editRevision, saved: false };
          append({ role: 'tool', state: 'applied', text: t('已更新作品'), operations: proposal.operations });
        } catch (failure) {
          if (failure.name === 'AbortError') throw failure;
          execution = { ok: false, code: failure.code, message: failure.message };
          append({ role: 'tool', state: 'failed', text: failure.message });
          if (!['conflict', 'operation'].includes(failure.code)) throw failure;
        }
      }
      throw new Error(t('本轮已停止继续尝试。画布保留已完成的修改，可以继续提出具体要求。'));
    } catch (failure) {
      if (active.current !== lifetime) return;
      if (failure.name === 'AbortError') setStage(t('已停止'));
      else {
        const code = failure.code ? String(failure.code).toUpperCase().replace(/-/g, '_') : '';
        setStage('');
        if (code === 'EXTENSION_UPDATED') {
          setError(t('扩展已更新，请求已停止。请先查看网页。'));
          setSetupOpen(false);
        } else {
          setError(failure.message);
        }
        if (code === 'LOGIN_REQUIRED') {
          setConnection('login');
          setSetupOpen(true);
        } else if (['PROVIDER_DISCONNECTED', 'PROVIDER_CLOSED', 'CONNECTION_LOST', 'EXTENSION_DISCONNECTED'].includes(code)) {
          setConnection('disconnected');
          setSetupOpen(true);
        }
      }
    } finally {
      if (active.current === lifetime) {
        active.current = null;
        setRunning(false);
        void checkConnection(connectionLifetime.current?.signal);
      }
    }
  }

  const popoverRef = useRef(null);
  const providerRef = useRef(null);
  const prevConnection = useRef(connection);

  useLayoutEffect(() => {
    if (setupOpen && popoverRef.current) {
      const closeBtn = popoverRef.current.querySelector('.math-ai-popover-close') || popoverRef.current.querySelector('button, a, input');
      closeBtn?.focus();
    }
  }, [setupOpen]);

  useEffect(() => {
    if (prevConnection.current !== 'ready' && connection === 'ready' && setupOpen) {
      setSetupOpen(false);
      providerRef.current?.focus();
    }
    prevConnection.current = connection;
  }, [connection, setupOpen]);

  useEffect(() => {
    if (!setupOpen) return;
    function handlePointerDown(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        if (!e.target.closest('.math-ai-provider')) {
          setSetupOpen(false);
        }
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSetupOpen(false);
        providerRef.current?.focus();
      } else if (e.key === 'Tab' && popoverRef.current) {
        const focusables = popoverRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)');
        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setupOpen]);

  return <section className="math-web-assistant" aria-label={t('数学工坊 AI 助理')}>
    <div className="math-ai-thread" ref={thread} aria-live="polite">
      {(onStart || !conversation.messages.length) && <div className="math-ai-welcome"><h2>{t('想做什么数学作品？')}</h2>
        <button onClick={() => setConversation(value => ({ ...value, input: t('画出 f(x)=a*x^2，为 a 添加 -3 到 3 的滑杆，初始值为 1。') }))}>{t('画一条可调节的抛物线')}<Icon name="plus" size={16}/></button>
      </div>}
      {!onStart && conversation.messages.map(message => <article key={message.id} className={`math-ai-message is-${message.role}`} data-state={message.state}>
        {message.role === 'tool' ? <><span>{message.state === 'applied' ? '✓' : '!'}</span><div>{message.text}{message.operations && <small>{[...new Set(message.operations.map(op => op.name))].join(' · ')}</small>}</div></> : <ReactMarkdown skipHtml>{message.text}</ReactMarkdown>}
      </article>)}
      {stage && <p className="math-ai-stage" role="status">{running && <span className="math-ai-pulse"/>}{stage}</p>}
    </div>
    {error && <div className="math-ai-error" role="alert">{error}</div>}
    {storageError && <div className="math-ai-error" role="alert">{t('当前对话未能保留到此设备，请暂时不要关闭页面。')}</div>}
    <form className="math-ai-composer" onSubmit={send}>
      <textarea aria-label={t('向数学助理提问')} placeholder={t('描述你想做的内容…')} rows={3} value={conversation.input}
        onChange={event => setConversation(value => ({ ...value, input: event.target.value }))}
        onKeyDown={event => { if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) void send(); }}/>
      <div className={`math-ai-compose-actions${connection !== 'ready' ? ' math-ai-setup' : ''}`}>
        <button
          ref={providerRef}
          type="button"
          className="math-ai-provider"
          aria-expanded={setupOpen}
          aria-haspopup="dialog"
          aria-label={t('模型与连接设置')}
          disabled={running}
          onClick={() => {
            setError('');
            setSetupOpen(v => !v);
          }}
        >
          <span className={`math-ai-connection is-${connection}`}/>
          <span>DeepSeek <small>{t('网页版')}</small></span>
          <svg className={`math-ai-chevron${setupOpen ? ' is-open' : ''}`} width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 4 4 4-4"/></svg>
        </button>
        <div className="math-ai-compose-tools">
          <button type="button" className="math-ai-new" aria-label={t('新对话')} title={t('新对话')} disabled={running} onClick={() => { setConversation({ sessionId: crypto.randomUUID(), messages: [], input: '' }); setError(''); }}><Icon name="plus" size={17}/></button>
          {running && onStart ? <button type="button" className="math-ai-send is-start" disabled>{t('正在开始')}</button> : running ? <button type="button" className="math-ai-send" aria-label={t('停止生成')} onClick={() => active.current?.abort()}>■</button>
            : <button type="submit" className={`math-ai-send${onStart ? ' is-start' : ''}`} aria-label={t(onStart ? '开始制作' : '发送消息')} disabled={(!controller && !onStart) || !conversation.input.trim() || !!onStart && ['checking', 'connecting'].includes(connection)}>{onStart ? t('开始制作') : <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 16V4M5 9l5-5 5 5"/></svg>}</button>}
        </div>
        {setupOpen && (
          <div
            ref={popoverRef}
            className="math-ai-setup-popover"
            role="dialog"
            aria-label={t('连接设置')}
          >
            <div className="math-ai-setup-popover-head">
              <span className="math-ai-popover-title">
                <span className={`math-ai-connection is-${connection}`}/>
                <span>{t(
                  connection === 'incompatible' ? '更新扩展'
                  : connection === 'login' ? '登录账号'
                  : connection === 'missing' ? '安装扩展'
                  : connection === 'disconnected' ? '重新连接'
                  : connection === 'checking' ? '检查连接'
                  : connection === 'connecting' ? '正在连接'
                  : 'DeepSeek'
                )}</span>
              </span>
              <button
                type="button"
                className="math-ai-popover-close"
                aria-label={t('关闭')}
                onClick={() => {
                  setSetupOpen(false);
                  providerRef.current?.focus();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 5 15M5 5l10 10"/></svg>
              </button>
            </div>
            <div className="math-ai-setup-body">
              {connection === 'ready' ? (
                <>
                  <p>{t('已连接 DeepSeek，可直接生成数学作品。')}</p>
                  <div className="math-ai-setup-actions">
                    <a className="math-ai-action-secondary" href="https://chat.deepseek.com" target="_blank" rel="noreferrer">
                      {t('打开网页')}
                    </a>
                    <button type="button" disabled={checking || running} onClick={() => checkConnection()}>
                      {t(checking ? '检查中…' : '检查连接')}
                    </button>
                  </div>
                </>
              ) : connection === 'incompatible' ? (
                <>
                  <p>{t('扩展版本过旧，请更新后继续使用。')}</p>
                  {installation.storeUrl ? (
                    <div className="math-ai-setup-actions">
                      <a className="math-ai-install" href={installation.storeUrl} target="_blank" rel="noreferrer">
                        {t('前往商店')}
                      </a>
                      <button type="button" disabled={checking || running} onClick={() => checkConnection()}>
                        {t(checking ? '检查中…' : '检查更新')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="math-ai-setup-note">{t('扩展暂未在应用商店上架。')}</p>
                      <div className="math-ai-setup-actions">
                        <button type="button" disabled={checking || running} onClick={() => checkConnection()}>
                          {t(checking ? '检查中…' : '检查更新')}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : connection === 'missing' ? (
                <>
                  {installation.browser === 'unsupported' ? (
                    <>
                      <p>{t('仅支持 Chrome 与 Edge 桌面浏览器。')}</p>
                      <p className="math-ai-setup-note">{t('请更换支持的浏览器后访问。')}</p>
                      <div className="math-ai-setup-actions">
                        <button type="button" disabled={checking || running} onClick={() => checkConnection()}>
                          {t(checking ? '检查中…' : '检查连接')}
                        </button>
                      </div>
                    </>
                  ) : installation.storeUrl ? (
                    <>
                      <p>{t('安装浏览器扩展后，即可连接使用。')}</p>
                      <p className="math-ai-setup-note">{t('安装后切回此页，点击连接。')}</p>
                      <div className="math-ai-setup-actions">
                        <a className="math-ai-install" href={installation.storeUrl} target="_blank" rel="noreferrer">
                          {t('前往商店')}
                        </a>
                        <button type="button" disabled={checking || running} onClick={() => checkConnection()}>
                          {t(checking ? '检查中…' : '检查连接')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{t('浏览器扩展暂未在应用商店上架。')}</p>
                      <p className="math-ai-setup-note">{t('上架后可前往商店安装使用。')}</p>
                      <div className="math-ai-setup-actions">
                        <button type="button" disabled={checking || running} onClick={() => checkConnection()}>
                          {t(checking ? '检查中…' : '检查连接')}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p>{t(
                    connection === 'login' ? '请先登录 DeepSeek，返回此页自动连接。'
                    : connection === 'disconnected' ? '连接已断开，重新连接后可继续制作。'
                    : '连接助理后，即可在此直接制作数学作品。'
                  )}</p>
                  <div className="math-ai-setup-actions">
                    <button
                      type="button"
                      className="math-ai-action-primary"
                      disabled={checking || running}
                      onClick={async () => {
                        setError('');
                        await connect(connectionLifetime.current?.signal);
                      }}
                    >
                      {t(connection === 'login' ? '打开登录' : connection === 'disconnected' ? '重新连接' : '连接助理')}
                    </button>
                    <button
                      type="button"
                      disabled={checking || running}
                      onClick={() => checkConnection()}
                    >
                      {t(checking ? '检查中…' : '检查连接')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  </section>;
}
