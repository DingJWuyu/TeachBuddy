import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { readLocal, writeLocal } from '../../workbench/storage.js';
import { Icon } from '../../workbench/icons.jsx';
import { webAiRequest } from './bridge.js';
import { mathPrompt, readProposal } from './protocol.js';
import './assistant.css';

export function MathWebAssistant({ controller, title, accountKey }) {
  const { t } = useTranslation('math');
  const [conversation, setConversation] = useState(() => readLocal(accountKey, 'math-web-assistant') ?? { sessionId: crypto.randomUUID(), messages: [], input: '' });
  const [connection, setConnection] = useState('checking');
  const [connectionDetails, setConnectionDetails] = useState({});
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
      if (signal?.aborted || sequence !== connectionSequence.current) return; setConnectionDetails(result); setConnection(result.connectionState ?? (result.loginRequired ? 'login' : 'available'));
    } catch (failure) { if (!signal?.aborted && sequence === connectionSequence.current) { setConnection('missing'); setConnectionDetails({ reason: failure.message }); } }
    finally { if (!signal?.aborted && sequence === connectionSequence.current) setChecking(false); }
  }
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [conversation.messages.length, stage]);
  function append(message) { setConversation(value => ({ ...value, messages: [...value.messages, { id: crypto.randomUUID(), ...message }] })); }
  async function connect(signal) {
    const sequence = ++connectionSequence.current; setChecking(false); setConnection('connecting');
    const result = await webAiRequest('CONNECT', conversation.sessionId, { signal });
    if (signal?.aborted || sequence !== connectionSequence.current) return;
    setConnectionDetails(result);
    if (result.loginRequired) { setConnection('login'); throw new Error(t('请在已打开的 DeepSeek 页面登录，然后返回这里连接。')); }
    setConnection('ready');
  }
  async function send(event) {
    event?.preventDefault();
    if (active.current || !controller || !conversation.input.trim()) return;
    const lifetime = new AbortController(); active.current = lifetime;
    const captured = controller; const request = conversation.input.trim();
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
    <header className="math-ai-header"><div><span className="math-ai-mark"><ConversationIcon/></span><strong>{t('一起制作数学作品')}</strong></div>
      <button className="wb-icon-button" aria-label={t('新对话')} title={t('新对话')} disabled={running} onClick={() => { setConversation({ sessionId: crypto.randomUUID(), messages: [], input: '' }); setError(''); }}><Icon name="plus" size={17}/></button>
    </header>
    <div className="math-ai-context"><span className="math-ai-context-dot"/><span>{title || t('当前作品')}</span><small>{controller ? t('已关联作品') : t('作品准备中')}</small></div>
    {connection !== 'ready' && <div className="math-ai-setup">
      <strong>{t(connection === 'missing' ? '连接你的 DeepSeek' : connection === 'login' ? '登录后继续当前任务' : connection === 'disconnected' ? 'DeepSeek 已断开' : connection === 'connecting' ? '正在连接' : '连接 DeepSeek 网页版')}</strong>
      {connection === 'missing' ? <><a className="math-ai-install" href="/downloads/teachbuddy-math-web-ai.zip" download>{t('下载连接扩展')}</a><ol><li>{t('解压下载的 ZIP 文件')}</li><li>{t('打开浏览器扩展页，启用开发者模式')}</li><li>{t('加载已解压的扩展目录，再刷新工作台')}</li></ol><p>{t('只需安装一次，之后直接在这里对话。')}</p></> : <p>{t(connection === 'login' ? '在已打开的 DeepSeek 页面登录，然后回到这里。' : connection === 'disconnected' ? '重新连接会继续这份作品和对话。' : '使用你的免费网页账号，无需 API Key。')}</p>}
      <div>{connection !== 'missing' && <button disabled={checking || running} onClick={async () => { setError(''); try { await connect(connectionLifetime.current?.signal); } catch (failure) { if (failure.name !== 'AbortError') setError(failure.message); } }}>{t(connection === 'login' ? '打开登录页面' : '连接 DeepSeek')}</button>}<button disabled={checking || running} onClick={() => checkConnection()}>{t(checking ? '检查中…' : '重新检查连接')}</button></div>
    </div>}
    <div className="math-ai-thread" ref={thread} aria-live="polite">
      {!conversation.messages.length && connection === 'ready' && <div className="math-ai-welcome"><span className="math-ai-spark"><ConversationIcon/></span><h2>{t('从一个数学想法开始')}</h2><p>{t('描述想讲的数学内容。你可以随时手动调整，我们接着改。')}</p>
        <button onClick={() => setConversation(value => ({ ...value, input: t('画出 f(x)=a*x^2，为 a 添加 -3 到 3 的滑杆，初始值为 1。') }))}>{t('画一条可以调节的抛物线')} <span>↗</span></button>
      </div>}
      {conversation.messages.map(message => <article key={message.id} className={`math-ai-message is-${message.role}`} data-state={message.state}>
        {message.role === 'tool' ? <><span>{message.state === 'applied' ? '✓' : '!'}</span><div>{message.text}{message.operations && <small>{[...new Set(message.operations.map(op => op.name))].join(' · ')}</small>}</div></> : <ReactMarkdown skipHtml>{message.text}</ReactMarkdown>}
      </article>)}
      {stage && <p className="math-ai-stage" role="status">{running && <span className="math-ai-pulse"/>}{stage}</p>}
    </div>
    {error && <div className="math-ai-error" role="alert">{error}</div>}
    {storageError && <div className="math-ai-error" role="alert">{t('当前对话未能保留到此设备，请暂时不要关闭页面。')}</div>}
    <form className="math-ai-composer" onSubmit={send}>
      <textarea aria-label={t('向数学助理提问')} placeholder={t('描述公式、图形或讲解步骤…')} rows={3} value={conversation.input}
        onChange={event => setConversation(value => ({ ...value, input: event.target.value }))}
        onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void send(); } }}/>
      <div className="math-ai-compose-actions"><button type="button" className="math-ai-provider" disabled={running}
        onClick={async () => { setError(''); try { await connect(connectionLifetime.current?.signal); } catch (failure) { setError(failure.message); } }}>
        <span className={`math-ai-connection is-${connection}`}/><span>DeepSeek <small>{t('网页版')}</small></span></button>
        {running ? <button type="button" className="math-ai-send" aria-label={t('停止生成')} onClick={() => active.current?.abort()}>■</button>
          : <button type="submit" className="math-ai-send" aria-label={t('发送消息')} disabled={!controller || !conversation.input.trim()}>↑</button>}
      </div>
    </form>

  </section>;
}

function ConversationIcon() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 1-2Z" stroke="currentColor" strokeWidth="1.6"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>; }
