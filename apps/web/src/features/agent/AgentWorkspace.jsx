const t = (key, options) => i18n.t(key, { ns: 'agent', ...options });
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/index.js';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useEffect, useRef, useState } from 'react';
import { useAgent } from './AgentProvider.jsx';
import { isDeletedAccount } from '../../platform/device/storage.js';
import { Popover } from '../../components/interaction/overlays.jsx';
import { navigate } from '../workbench/routes.js';
import { workbenchGet } from '../../platform/http/apiClient.js';
import './agent.css';
const labels = { get wb_list_questions() { return t("查找题目"); }, get wb_get_question() { return t("读取题目"); }, get wb_list_derivatives() { return t("查找衍生题"); }, get wb_create_question() { return t("创建题目"); }, get wb_update_question() { return t("修改题目"); }, get wb_copy_question() { return t("复制改编"); }, get wb_set_question_deletion() { return t("删除或恢复题目"); }, };
const states = { get prepared() { return t("待执行"); }, get executing() { return t("进行中"); }, get read() { return t("已读取"); }, get confirmed() { return t("已保存"); }, get rejected() { return t("操作被拒绝"); }, get failed() { return t("读取失败"); }, get unconfirmed() { return t("结果待确认"); }, get cancelled() { return t("未执行"); }, get interrupted() { return t("读取已中断，未保存结果"); } };
const reasons = { get 'server-restart'() { return t("上次生成已中断"); }, get 'user-stop'() { return t("已停止"); }, get 'provider-error'() { return t("模型连接失败"); }, get 'provider-quota'() { return t("模型调用被拒绝"); }, get 'provider-authorization'() { return t("模型调用被拒绝"); }, get 'model-unavailable'() { return t("AI 暂不可用"); }, get 'context-limit'() { return t("这段对话过长，请新建对话并重新选择引用"); }, get 'run-limit'() { return t("本轮已达到运行上限"); }, get 'auth-invalid'() { return t("身份已失效"); }, get 'tool-rejected'() { return t("操作未完成，请查看结果"); }, get 'tool-unconfirmed'() { return t("请确认写入结果"); }, get 'tool-failed'() { return t("读取未完成"); }, get 'store-unavailable'() { return t("保存失败，请重试"); } };
const toolProblemKeys = {
  '/problems/agent/tool-failed': 'problem.readFailed',
  '/problems/agent/operation-unconfirmed': 'problem.writeUnconfirmed',
  '/problems/agent/draft-conflict': '草稿已在其他设备修改',
  '/problems/agent/reference-conflict': 'problem.referenceConflict',
  '/problems/agent/model-unavailable': 'AI 暂不可用',
  '/problems/agent/model-not-allowed': 'problem.modelNotAllowed',
  '/problems/agent/turn-active': '另一段对话正在生成',
  '/problems/agent/pending-operation': '请先确认待核实的写入结果',
  '/problems/agent/cursor-ahead': 'problem.cursorAhead',
  '/problems/workbench/version-conflict': '内容已被修改，请对照当前版本',
  '/problems/workbench/reference-version-conflict': 'problem.referenceConflict',
  '/problems/materials/reference-version-conflict': 'problem.referenceConflict',
  '/problems/math/reference-version-conflict': 'problem.referenceConflict',
  '/problems/workbench/not-found': '未找到内容',
  '/problems/workbench/invalid-input': 'problem.invalidInput',
  '/problems/workbench/object-deleted': 'problem.deleted',
  '/problems/workbench/unauthenticated': '身份已失效',
  '/problems/workbench/request-not-allowed': 'problem.forbidden',
  '/problems/workbench/idempotency-key-reused': 'problem.keyReused',
  '/problems/workbench/temporarily-unavailable': 'problem.unavailable',
};
function markdown(text) {
  return text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$${math}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math}$`);
}
function ObjectLink({ object, kind }) {
  const { t } = useTranslation('agent');
  const [error, setError] = useState('');
  if (!object?.id || kind !== 'questions') return null;
  return <><button className="wb-button" onClick={async () => {
    try { await workbenchGet(`/api/modules/questions/v2/items/${object.id}`); navigate(`/${kind}/${object.id}`); }
    catch { setError(t("当前内容不可用")); }
  }}>{t("打开")}{t("题目")} · {object.title || t("查看内容")}</button>{error && <span role="status">{error}</span>}</>;
}
function ToolCard({ call, calls, reconcile }) {
  const { t } = useTranslation('agent');
  const kind = Object.hasOwn(labels, call.name) ? 'questions' : null;
  const same = call.operationId && calls.find(c => c.operationId === call.operationId) !== call;
  return <article className="agent-tool" data-tool-state={call.state}>
    <header><strong>{labels[call.name]}</strong><span>{states[call.state]}</span></header>
    {same && <p>{t("引用同一提交")}</p>}
    {call.result?.items?.length === 0 && <p>{t("未找到")}</p>}
    {call.problem && <p role="status">{Object.hasOwn(toolProblemKeys, call.problem.type) ? t(toolProblemKeys[call.problem.type]) : call.problem.title || t("操作未完成")}</p>}
    <ObjectLink object={call.result} kind={kind} />
    {call.result?.items?.map(item => <ObjectLink key={item.id} object={item} kind={kind} />)}
    {call.arguments?.id && !call.result && <ObjectLink object={{ id: call.arguments.id, title: t("当前版本") }} kind={kind} />}
    {call.state === 'unconfirmed' && <button className="wb-button" onClick={() => reconcile(call.operationId)}>{t("确认结果")}</button>}
    <details><summary>{t("操作详情")}</summary><pre>{JSON.stringify({ parameters: call.arguments, result: call.result, problem: call.problem }, null, 2)}</pre></details>
  </article>;
}
export function AgentWorkspace({ variant = 'panel' }) {
  const { t, i18n } = useTranslation('agent');
  const number = new Intl.NumberFormat(i18n.resolvedLanguage);
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
    <header className="agent-head"><strong>{snapshot?.conversation.title ?? t("一起准备下一堂课")}</strong>
      <Popover label={t("对话历史")} icon="more">{({ close }) => <>{agent.list.length === 0 && <span>{t("暂无对话")}</span>}{agent.list.map(item => <button key={item.id} className="wb-menu-item" onClick={() => { agent.select(item.id); close(); }}>{item.title}</button>)}</>}</Popover>
      <button className="wb-button" onClick={agent.create} disabled={agent.busy}>{t("新对话")}</button>
    </header>
    <div className="wb-ai-thread agent-thread" ref={thread} aria-label={t("AI 对话")} onScroll={() => {
      const area = thread.current; nearBottom.current = area.scrollHeight - area.clientHeight - area.scrollTop < 50;
      if (nearBottom.current) setNewMessages(false);
      try { if (!isDeletedAccount(agent.accountKey)) localStorage.setItem(agent.prefix + agent.id + ':scroll', String(area.scrollTop)); } catch {}
    }}>
      {!snapshot && <div className="agent-empty"><h1>{t("从一个教学想法开始")}</h1><p>{t("查找题目，或改编教学材料。")}</p></div>}
      {snapshot?.turns.map(turn => <section className="agent-turn" key={turn.id}>
        {snapshot.messages.filter(m => m.turnId === turn.id && m.role === 'user').map(m => <article className="agent-message is-user" key={m.id}><p>{m.text}</p>{m.references.map((r,i) => <details key={i}><summary>{r.title} · v{r.input.version}</summary><pre>{JSON.stringify(r.snapshot, null, 2)}</pre><ObjectLink object={r.snapshot} kind={r.input.kind === 'question' ? 'questions' : null} /></details>)}</article>)}
        {snapshot.toolCalls.filter(c => c.turnId === turn.id).sort((a,b) => a.ordinal - b.ordinal).map(c => <ToolCard key={c.toolCallId} call={c} calls={snapshot.toolCalls} reconcile={agent.reconcile} />)}
        {snapshot.messages.filter(m => m.turnId === turn.id && m.role === 'assistant').map(m => <article className="agent-message" key={m.id}><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]} skipHtml>{markdown(m.text)}</ReactMarkdown>{m.state === 'partial' && <small>{t("部分回答")}</small>}</article>)}
        <div className="agent-turn-status"><span>{turn.state === 'running' ? t("生成中") : turn.state === 'completed' ? t("已完成") : reasons[turn.reason]}</span>
          <details><summary>{t("用量")}</summary><p>{turn.usage.totalTokens == null ? t("未知") : number.format(turn.usage.totalTokens)} tokens · {number.format(turn.usage.requestsReported)}/{number.format(turn.usage.requestsStarted)} {t("次已报告")}</p><p>{turn.usage.complete ? t("用量已报告") : t("用量不完整")} {t("· 实际费用未知")}</p></details>
        </div>
      </section>)}
    </div>
    {newMessages && <button className="wb-button agent-new" onClick={() => { thread.current.scrollTop = thread.current.scrollHeight; nearBottom.current = true; setNewMessages(false); }}>{t("有新消息 ↓")}</button>}
    {agent.sendPending && <div className="agent-notice">{t("发送结果待确认")}<button className="wb-button" onClick={agent.send} disabled={agent.busy}>{t("确认发送结果")}</button></div>}
    {agent.error && <div className="agent-notice" role="alert">{agent.error}<button className="wb-button" onClick={() => draft?.dirty ? agent.save() : agent.retry()}>{t("重试")}</button></div>}
    {agent.conflict && <div className="agent-conflict"><strong>{t("草稿已在其他设备修改")}</strong><div><p>{t("本机：")}{draft.text}</p><p>{t("已保存：")}{agent.conflict.text}</p></div><button className="wb-button" onClick={() => agent.chooseDraft(true)}>{t("保留本机内容")}</button><button className="wb-button" onClick={() => agent.chooseDraft(false)}>{t("采用已保存内容")}</button></div>}
    {draft && <form className="wb-ai-composer" onSubmit={event => { event.preventDefault(); void agent.send(); }}>
      <div className="agent-references">{draft.references.map((r,i) => <span key={`${r.kind}:${r.id}:${r.sectionId}`}>{r.kind === 'question' ? <button type="button" onClick={() => navigate(`/questions/${r.id}`)}>{t("题目")} v{r.version}</button> : <span>{t("当前内容不可用")}</span>}<button type="button" aria-label={t("移除引用")} onClick={() => agent.edit({ references: draft.references.filter((_,index) => i !== index) })}>×</button></span>)}</div>
      <textarea className="wb-input wb-ai-input" aria-label={t("AI 输入")} placeholder={t("向 AI 描述你要做的工作")} value={draft.text} rows={variant === 'home' ? 3 : 2} onChange={e => agent.edit({ text: e.target.value })} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!running && ready) void agent.send(); } }} />
      <div className="wb-ai-actions"><span role="status">{agent.status}</span><select aria-label={t("选择模型")} value={agent.model} onChange={e => agent.setModel(e.target.value)}><option value="deepseek/deepseek-v4.1-flash">DeepSeek</option><option value="z-ai/glm-5.3-flash">GLM</option></select>
        {running ? <button type="button" className="wb-button" onClick={() => agent.stop(running)}>{t("停止")}</button> : <button type="submit" className="wb-button is-primary" disabled={!ready || agent.busy || Boolean(agent.conflict) || !draft.text.trim()}>{t("发送")}</button>}
      </div>{!ready && <div className="agent-unavailable">{t("AI 暂不可用")}</div>}
      {agent.configuration?.activeTurn && agent.configuration.activeTurn.conversationId !== agent.id && <button className="wb-button" type="button" onClick={() => agent.select(agent.configuration.activeTurn.conversationId)}>{t("查看正在生成的对话")}</button>}
    </form>}
  </section>;
}
