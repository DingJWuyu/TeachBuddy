import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tx as t } from '../../i18n/presentation.js';
import { workbenchGet } from '../../platform/http/apiClient.js';
import { navigate } from '../workbench/routes.js';
import { Icon } from '../../components/icons.jsx';
export const toolLabels = { get wb_propose_teaching_card() { return t("正在整理"); }, get wb_list_questions() { return t("查找题目"); }, get wb_get_question() { return t("读取题目"); }, get wb_list_derivatives() { return t("查找衍生题"); }, get wb_create_question() { return t("创建题目"); }, get wb_update_question() { return t("修改题目"); }, get wb_copy_question() { return t("复制改编"); }, get wb_set_question_deletion() { return t("删除或恢复题目"); }, };
const states = { get prepared() { return t("待执行"); }, get executing() { return t("进行中"); }, get read() { return t("已读取"); }, get confirmed() { return t("已保存"); }, get rejected() { return t("操作被拒绝"); }, get failed() { return t("读取失败"); }, get unconfirmed() { return t("结果待确认"); }, get cancelled() { return t("未执行"); }, get interrupted() { return t("读取已中断，未保存结果"); } };
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
function ObjectLink({ object, kind }) {
  const { t } = useTranslation('agent');
  const [error, setError] = useState('');
  if (!object?.id || kind !== 'questions') return null;
  return <div className="tbx-card-row"><button className="tbx-card-row-main" aria-label={t("打开题目") + ' · ' + (object.title || t("查看内容"))} onClick={async () => {
    try { await workbenchGet(`/api/modules/questions/v2/items/${object.id}`); navigate(`/${kind}/${object.id}`); }
    catch { setError(t("当前内容不可用")); }
  }}><span className="tbx-card-row-title">{object.title || t("查看内容")}</span></button>{error && <span role="status">{error}</span>}</div>;
}
export function ToolCard({ call, calls, reconcile }) {
  const { t } = useTranslation('agent');
  const kind = Object.hasOwn(toolLabels, call.name) ? 'questions' : null;
  const same = call.operationId && calls.find(c => c.operationId === call.operationId) !== call;
  return <article className="tbx-card agent-tool" data-tool-state={call.state}>
    <header className="tbx-card-head">
      <span className="tbx-card-tile is-orange"><Icon name="book" size={16} /></span>
      <span className="tbx-card-title"><strong>{toolLabels[call.name] || t("操作详情")}</strong><small>{states[call.state]}</small></span>
    </header>
    {same && <p>{t("引用同一提交")}</p>}
    {call.result?.items?.length === 0 && <p>{t("未找到")}</p>}
    {call.problem && <p role="status">{Object.hasOwn(toolProblemKeys, call.problem.type) ? t(toolProblemKeys[call.problem.type]) : call.problem.title || t("操作未完成")}</p>}
    <div className="tbx-card-rows">
      <ObjectLink object={call.result} kind={kind} />
      {call.result?.items?.map(item => <ObjectLink key={item.id} object={item} kind={kind} />)}
      {call.arguments?.id && !call.result && <ObjectLink object={{ id: call.arguments.id, title: t("当前版本") }} kind={kind} />}
    </div>
    {call.state === 'unconfirmed' && <p><button className="tbx-pill" onClick={() => reconcile(call.operationId)}>{t("确认结果")}</button></p>}
    <details><summary>{t("操作详情")}</summary><pre>{JSON.stringify({ parameters: call.arguments, result: call.result, problem: call.problem }, null, 2)}</pre></details>
  </article>;
}
