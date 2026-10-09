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
  const [connection, setConnection] = useState('unknown');
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
    const lifetime = new AbortController();
    webAiRequest('STATUS', conversation.sessionId, { signal: lifetime.signal }).then(() => setConnection('available')).catch(() => { if (!lifetime.signal.aborted) setConnection('missing'); });
    return () => { lifetime.abort(); active.current?.abort(); };
  }, [accountKey, conversation.sessionId]);
  useEffect(() => { if (thread.current) thread.current.scrollTop = thread.current.scrollHeight; }, [conversation.messages.length, stage]);
  function append(message) { setConversation(value => ({ ...value, messages: [...value.messages, { id: crypto.randomUUID(), ...message }] })); }
  async function connect(signal) {
    await webAiRequest('STATUS', conversation.sessionId, { signal });
    const result = await webAiRequest('CONNECT', conversation.sessionId, { signal });
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
        const proposal = readProposal(response.text);
        if (!proposal.operations.length) { append({ role: 'assistant', text: proposal.message }); setStage(''); return; }
        setStage(t('正在修改画布'));
        try {
          const after = await captured.apply({ revision: current.revision, operations: proposal.operations, signal: lifetime.signal });
          execution = { ok: true, operations: proposal.operations, revision: after.revision, saved: false };
          append({ role: 'tool', state: 'applied', text: t('已更新画布'), operations: proposal.operations });
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
      else { setError(failure.message); setStage(''); }
    } finally { if (active.current === lifetime) { active.current = null; setRunning(false); } }
  }
  return <section className="math-web-assistant" aria-label={t('数学工坊 AI 助理')}>
    <header className="math-ai-header"><div><span className="math-ai-mark">✦</span><strong>{t('一起把想法画出来')}</strong></div>
      <button className="wb-icon-button" aria-label={t('新对话')} title={t('新对话')} disabled={running} onClick={() => { setConversation({ sessionId: crypto.randomUUID(), messages: [], input: '' }); setError(''); }}><Icon name="plus" size={17}/></button>
    </header>
    <div className="math-ai-context"><span className="math-ai-context-dot"/><span>{title || t('当前作品')}</span><small>{controller ? t('已关联画布') : t('画布加载中')}</small></div>
    <div className="math-ai-thread" ref={thread} aria-live="polite">
      {!conversation.messages.length && <div className="math-ai-welcome"><span className="math-ai-spark">✦</span><h2>{t('从一个数学想法开始')}</h2><p>{t('描述想画的图。你也可以随时动手调整，我们接着改。')}</p>
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
      <textarea aria-label={t('向数学助理提问')} placeholder={t('描述图形，或告诉我怎么改…')} rows={3} value={conversation.input}
        onChange={event => setConversation(value => ({ ...value, input: event.target.value }))}
        onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void send(); } }}/>
      <div className="math-ai-compose-actions"><button type="button" className="math-ai-provider" disabled={running}
        onClick={async () => { setError(''); try { await connect(); } catch (failure) { setError(failure.message); } }}>
        <span className={`math-ai-connection is-${connection}`}/><span>DeepSeek <small>{t('网页版')}</small></span></button>
        {running ? <button type="button" className="math-ai-send" aria-label={t('停止生成')} onClick={() => active.current?.abort()}>■</button>
          : <button type="submit" className="math-ai-send" aria-label={t('发送消息')} disabled={!controller || !conversation.input.trim()}>↑</button>}
      </div>
    </form>
    <p className="math-ai-caption">{connection === 'missing' ? t('需要工作台 AI 浏览器扩展') : connection === 'login' ? t('请先登录 DeepSeek 网页账号') : t('基于当前画布协作 · 改好后可保存作品')}</p>
  </section>;
}
