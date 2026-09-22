import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useEffect, useRef, useState } from 'react';
import { useAgent } from './AgentProvider.jsx';
import { Popover } from '../workbench/overlays.jsx';
import { navigate } from '../workbench/routes.js';
import { workbenchGet } from '../workbench/apiClient.js';
import './agent.css';
const labels = { wb_list_questions: '查找题目', wb_get_question: '读取题目', wb_list_derivatives: '查找衍生题', wb_create_question: '创建题目', wb_update_question: '修改题目', wb_copy_question: '复制改编', wb_set_question_deletion: '删除或恢复题目', wb_list_lessons: '查找备课', wb_get_lesson: '读取备课', wb_create_lesson: '创建备课', wb_update_lesson: '保存备课', wb_set_lesson_deletion: '删除或恢复备课', wb_list_question_usages: '查找引用' };
const states = { prepared: '待执行', executing: '进行中', read: '已读取', confirmed: '已保存', rejected: '操作被拒绝', failed: '读取失败', unconfirmed: '结果待确认', cancelled: '未执行', interrupted: '读取已中断，未保存结果' };
const reasons = { 'server-restart': '上次生成已中断', 'user-stop': '已停止', 'provider-error': '模型连接失败', 'provider-quota': '模型调用被拒绝', 'provider-authorization': '模型调用被拒绝', 'model-unavailable': 'AI 暂不可用', 'context-limit': '这段对话过长，请新建对话并重新选择引用', 'run-limit': '本轮已达到运行上限', 'auth-invalid': '身份已失效', 'tool-rejected': '操作未完成，请查看结果', 'tool-unconfirmed': '请确认写入结果', 'tool-failed': '读取未完成', 'store-unavailable': '保存失败，请重试' };
function markdown(text) {
  return text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$${math}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`);
}
function ObjectLink({ object, kind }) {
  const [error, setError] = useState('');
  if (!object?.id) return null;
  return <><button className="wb-button" onClick={async () => {
    try { await workbenchGet(`/api/modules/${kind === 'questions' ? 'questions/v2/items' : 'lessons/v3'}/${object.id}`); navigate(`/${kind}/${object.id}`); }
    catch { setError('当前内容不可用'); }
  }}>打开{kind === 'questions' ? '题目' : '备课'} · {object.title || '查看内容'}</button>{error && <span role="status">{error}</span>}</>;
}
function ToolCard({ call, calls, reconcile }) {
  const kind = call.name.includes('lesson') ? 'lessons' : 'questions';
  const same = call.operationId && calls.find(c => c.operationId === call.operationId) !== call;
  return <article className="agent-tool" data-tool-state={call.state}>
    <header><strong>{labels[call.name]}</strong><span>{states[call.state]}</span></header>
    {same && <p>引用同一提交</p>}
    {call.result?.items?.length === 0 && <p>未找到</p>}
    {call.problem && <p role="status">{call.problem.type.includes('conflict') ? '内容已被修改，请对照当前版本' : call.problem.type.includes('not-found') ? '未找到内容' : call.problem.title || '操作未完成'}</p>}
    <ObjectLink object={call.result} kind={kind} />
    {call.result?.items?.map(item => <ObjectLink key={item.id} object={item} kind={kind} />)}
    {call.arguments?.id && !call.result && <ObjectLink object={{ id: call.arguments.id, title: '当前版本' }} kind={kind} />}
    {call.state === 'unconfirmed' && <button className="wb-button" onClick={() => reconcile(call.operationId)}>确认结果</button>}
    <details><summary>操作详情</summary><pre>{JSON.stringify({ parameters: call.arguments, result: call.result, problem: call.problem }, null, 2)}</pre></details>
  </article>;
}
export function AgentWorkspace({ variant = 'panel' }) {
  const agent = useAgent(); const thread = useRef(null); const nearBottom = useRef(true); const [newMessages, setNewMessages] = useState(false);
  const { snapshot, draft } = agent;
  useEffect(() => {
    const area = thread.current;
    if (!area) return;
    try { area.scrollTop = Number(localStorage.getItem(agent.prefix + agent.id + ':scroll') ?? area.scrollHeight); } catch {}
    nearBottom.current = area.scrollHeight - area.clientHeight - area.scrollTop < 50;
  }, [agent.id, Boolean(snapshot)]);
  useEffect(() => {
    if (nearBottom.current && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
    else setNewMessages(true);
  }, [snapshot?.messages.length, snapshot?.lastEventSeq]);
  const running = snapshot?.turns.find(t => t.state === 'running');
  const ready = agent.configuration?.models.find(m => m.id === agent.model)?.state === 'ready';
  return <section className="wb-ai agent-workspace" data-region="ai-workspace" data-variant={variant}>
    <header className="agent-head"><strong>{snapshot?.conversation.title ?? '一起准备下一堂课'}</strong>
      <Popover label="对话历史" icon="more">{({ close }) => <>{agent.list.length === 0 && <span>暂无对话</span>}{agent.list.map(item => <button key={item.id} className="wb-menu-item" onClick={() => { agent.select(item.id); close(); }}>{item.title}</button>)}</>}</Popover>
      <button className="wb-button" onClick={agent.create} disabled={agent.busy}>新对话</button>
    </header>
    <div className="wb-ai-thread agent-thread" ref={thread} aria-label="AI 对话" onScroll={() => {
      const area = thread.current; nearBottom.current = area.scrollHeight - area.clientHeight - area.scrollTop < 50;
      if (nearBottom.current) setNewMessages(false);
      try { localStorage.setItem(agent.prefix + agent.id + ':scroll', String(area.scrollTop)); } catch {}
    }}>
      {!snapshot && <div className="agent-empty"><h1>从一个教学想法开始</h1><p>找题、改编题目，或整理备课。</p></div>}
      {snapshot?.turns.map(turn => <section className="agent-turn" key={turn.id}>
        {snapshot.messages.filter(m => m.turnId === turn.id && m.role === 'user').map(m => <article className="agent-message is-user" key={m.id}><p>{m.text}</p>{m.references.map((r,i) => <details key={i}><summary>{r.title} · v{r.input.version}</summary><pre>{JSON.stringify(r.snapshot, null, 2)}</pre><ObjectLink object={r.snapshot} kind={r.input.kind === 'question' ? 'questions' : 'lessons'} /></details>)}</article>)}
        {snapshot.toolCalls.filter(c => c.turnId === turn.id).sort((a,b) => a.ordinal - b.ordinal).map(c => <ToolCard key={c.toolCallId} call={c} calls={snapshot.toolCalls} reconcile={agent.reconcile} />)}
        {snapshot.messages.filter(m => m.turnId === turn.id && m.role === 'assistant').map(m => <article className="agent-message" key={m.id}><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]} skipHtml>{markdown(m.text)}</ReactMarkdown>{m.state === 'partial' && <small>部分回答</small>}</article>)}
        <div className="agent-turn-status"><span>{turn.state === 'running' ? '生成中' : turn.state === 'completed' ? '已完成' : reasons[turn.reason]}</span>
          <details><summary>用量</summary><p>{turn.usage.totalTokens ?? '未知'} tokens · {turn.usage.requestsReported}/{turn.usage.requestsStarted} 次已报告</p><p>{turn.usage.complete ? '用量已报告' : '用量不完整'} · 实际费用未知</p></details>
        </div>
      </section>)}
    </div>
    {newMessages && <button className="wb-button agent-new" onClick={() => { thread.current.scrollTop = thread.current.scrollHeight; nearBottom.current = true; setNewMessages(false); }}>有新消息 ↓</button>}
    {agent.sendPending && <div className="agent-notice">发送结果待确认<button className="wb-button" onClick={agent.send} disabled={agent.busy}>确认发送结果</button></div>}
    {agent.error && <div className="agent-notice" role="alert">{agent.error}<button className="wb-button" onClick={() => draft?.dirty ? agent.save() : agent.retry()}>重试</button></div>}
    {agent.conflict && <div className="agent-conflict"><strong>草稿已在其他设备修改</strong><div><p>本机：{draft.text}</p><p>已保存：{agent.conflict.text}</p></div><button className="wb-button" onClick={() => agent.chooseDraft(true)}>保留本机内容</button><button className="wb-button" onClick={() => agent.chooseDraft(false)}>采用已保存内容</button></div>}
    {draft && <form className="wb-ai-composer" onSubmit={event => { event.preventDefault(); void agent.send(); }}>
      <div className="agent-references">{draft.references.map((r,i) => <span key={`${r.kind}:${r.id}:${r.sectionId}`}><button type="button" onClick={() => navigate(`/${r.kind === 'question' ? 'questions' : 'lessons'}/${r.id}`)}>{r.kind === 'question' ? '题目' : '备课'} v{r.version}</button><button type="button" aria-label="移除引用" onClick={() => agent.edit({ references: draft.references.filter((_,index) => i !== index) })}>×</button></span>)}</div>
      <textarea className="wb-input wb-ai-input" aria-label="AI 输入" placeholder="向 AI 描述你要做的工作" value={draft.text} rows={variant === 'home' ? 3 : 2} onChange={e => agent.edit({ text: e.target.value })} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!running && ready) void agent.send(); } }} />
      <div className="wb-ai-actions"><span role="status">{agent.status}</span><select aria-label="选择模型" value={agent.model} onChange={e => agent.setModel(e.target.value)}><option value="deepseek/deepseek-v4.1-flash">DeepSeek</option><option value="z-ai/glm-5.3-flash">GLM</option></select>
        {running ? <button type="button" className="wb-button" onClick={() => agent.stop(running)}>停止</button> : <button type="submit" className="wb-button is-primary" disabled={!ready || agent.busy || Boolean(agent.conflict) || !draft.text.trim()}>发送</button>}
      </div>{!ready && <div className="agent-unavailable">AI 暂不可用</div>}
      {agent.configuration?.activeTurn && agent.configuration.activeTurn.conversationId !== agent.id && <button className="wb-button" type="button" onClick={() => agent.select(agent.configuration.activeTurn.conversationId)}>查看正在生成的对话</button>}
    </form>}
  </section>;
}
