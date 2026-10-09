import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { readLocal, writeLocal } from '../../workbench/storage.js';
import { Icon } from '../../workbench/icons.jsx';
import { webAiRequest } from './bridge.js';
import { mathPrompt, readProposal } from './protocol.js';
import './assistant.css';

export function MathWebAssistant({ controller, title, accountKey, onStart, takeRequest }) {
  const { t } = useTranslation('math');
  const [conversation, setConversation] = useState(() => readLocal(accountKey, 'math-web-assistant') ?? { sessionId: crypto.randomUUID(), messages: [], input: '' });
  const [connection, setConnection] = useState('checking');
  const [checking, setChecking] = useState(false);
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
  const setup = useRef(null);
  useEffect(() => {
    setStorageError(!writeLocal(accountKey, 'math-web-assistant', conversation));
  }, [accountKey, conversation]);
  useEffect(() => {
    const lifetime = new AbortController(); connectionLifetime.current = lifetime;
    void checkConnection(lifetime.signal);
    const focus = () => { if (!active.current) void checkConnection(lifetime.signal); };
    window.addEventListener('focus', focus);
    return () => { lifetime.abort(); active.current?.abort(); window.removeEventListener('focus', focus); };
  }, [accountKey, conversation.sessionId]);
  async function checkConnection(signal = connectionLifetime.current?.signal) {
    if (signal?.aborted) return;
    const sequence = ++connectionSequence.current; setChecking(true);
    try { const result = await webAiRequest('STATUS', conversation.sessionId, { signal });
      if (signal?.aborted || sequence !== connectionSequence.current) return; setConnection(result.connectionState ?? (result.loginRequired ? 'login' : 'available'));
    } catch (failure) { if (!signal?.aborted && sequence === connectionSequence.current) { setConnection('missing'); } }
    finally { if (!signal?.aborted && sequence === connectionSequence.current) setChecking(false); }
  }
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [conversation.messages.length, stage]);
  function append(message) { setConversation(value => ({ ...value, messages: [...value.messages, { id: crypto.randomUUID(), ...message }] })); }
  async function connect(signal) {
    const sequence = ++connectionSequence.current; setChecking(false); setConnection('connecting');
    const result = await webAiRequest('CONNECT', conversation.sessionId, { signal });
    if (signal?.aborted || sequence !== connectionSequence.current) return;

    if (result.loginRequired) { setConnection('login'); throw new Error(t('请在已打开的 DeepSeek 页面登录，然后返回这里连接。')); }
    setConnection('ready');
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
    if (connection === 'missing') { if (setup.current) setup.current.open = true; setError(t('先连接助理，内容已保留。')); return; }
    const lifetime = new AbortController(); active.current = lifetime;
    if (!controller) {
      if (!onStart) { active.current = null; return; }
      setRunning(true); setError('');
      try { await connect(lifetime.signal); lifetime.signal.throwIfAborted(); await onStart(request); }
      catch (failure) { if (failure.name !== 'AbortError') setError(failure.message); }
      finally { if (active.current === lifetime) { active.current = null; setRunning(false); } }
      return;
    }
    const captured = controller;
    setRunning(true); setError(''); setStage(t('正在连接 DeepSeek'));
    append({ role: 'user', text: request });
    setConversation(value => ({ ...value, input: '' }));
    try {
      await connect(lifetime.signal);
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
          execution = { ok: true, operations: proposal.operations, editRevision: after.editRevision, saved: false };
          append({ role: 'tool', state: 'applied', text: t('已更新作品'), operations: proposal.operations });
          lifetime.signal.throwIfAborted();
        } catch (failure) {
          if (failure.name === 'AbortError') throw failure;
          execution = { ok: false, code: failure.code, message: failure.message };
          append({ role: 'tool', state: 'failed', text: failure.message });
          if (!['conflict', 'operation'].includes(failure.code)) throw failure;
        }
      }
      throw new Error(t('本轮已停止继续尝试。画布保留已完成的修改，可以继续提出具体要求。'));
    } catch (failure) {
      if (failure.name === 'AbortError') setStage(t('已停止'));
      else { setError(failure.message); setStage(''); if (['login-required', 'provider-disconnected', 'connection-lost'].includes(failure.code)) setConnection(failure.code === 'login-required' ? 'login' : 'disconnected'); }
    } finally { if (active.current === lifetime) { active.current = null; setRunning(false); } }
  }
  return <section className="math-web-assistant" aria-label={t('数学工坊 AI 助理')}>
    {connection !== 'ready' && <details ref={setup} className="math-ai-setup">
      <summary><span className={`math-ai-connection is-${connection}`}/><span>{t(connection === 'missing' ? '连接助理' : connection === 'login' ? '登录助理' : connection === 'disconnected' ? '重新连接' : connection === 'checking' ? '检查连接' : connection === 'connecting' ? '正在连接' : '连接助理')}</span><Icon name="chevron" size={14}/></summary>
      {connection === 'missing' ? <><p>{t('安装扩展后，在这里直接对话。')}</p><a className="math-ai-install" href="/downloads/teachbuddy-math-web-ai.zip" download>{t('下载扩展')}</a><ol><li>{t('解压下载文件')}</li><li>{t('在扩展页开启开发者模式')}</li><li>{t('加载扩展目录，刷新工作台')}</li></ol></> : <p>{t(connection === 'login' ? '登录 DeepSeek 后，返回这里。' : connection === 'disconnected' ? '重新连接后可继续制作。' : '使用 DeepSeek 网页账号。')}</p>}
      <div>{connection !== 'missing' && <button disabled={checking || running} onClick={async () => { setError(''); try { await connect(connectionLifetime.current?.signal); } catch (failure) { if (failure.name !== 'AbortError') setError(failure.message); } }}>{t(connection === 'login' ? '打开登录' : '连接助理')}</button>}<button disabled={checking || running} onClick={() => checkConnection()}>{t(checking ? '检查中…' : '检查连接')}</button></div>
    </details>}
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
      <div className="math-ai-compose-actions">{!onStart && <button type="button" className="math-ai-provider" disabled={running}
        onClick={async () => { setError(''); if (connection === 'missing') { if (setup.current) setup.current.open = true; return; } try { await connect(connectionLifetime.current?.signal); } catch (failure) { setError(failure.message); } }}>
        <span className={`math-ai-connection is-${connection}`}/><span>DeepSeek <small>{t('网页版')}</small></span></button>}
        <button type="button" className="math-ai-new" aria-label={t('新对话')} title={t('新对话')} disabled={running} onClick={() => { setConversation({ sessionId: crypto.randomUUID(), messages: [], input: '' }); setError(''); }}><Icon name="plus" size={17}/></button>
        {running && onStart ? <button type="button" className="math-ai-send is-start" disabled>{t('正在开始')}</button> : running ? <button type="button" className="math-ai-send" aria-label={t('停止生成')} onClick={() => active.current?.abort()}>■</button>
          : <button type="submit" className={`math-ai-send${onStart ? ' is-start' : ''}`} aria-label={t(onStart ? '开始制作' : '发送消息')} disabled={(!controller && !onStart) || !conversation.input.trim() || !!onStart && ['checking', 'connecting'].includes(connection)}>{onStart ? t('开始制作') : <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 16V4M5 9l5-5 5 5"/></svg>}</button>}
      </div>
    </form>

  </section>;
}
