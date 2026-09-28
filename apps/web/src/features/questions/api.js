import i18n from "../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "questions", ...options });
/** Questions module API surface: the only endpoints this feature may call. */

import { buildQuery, workbenchGet, workbenchPost, workbenchPut } from '../workbench/apiClient.js';
import { unexpectedSuccessProblem } from '../workbench/problems.js';
import { WorkbenchError } from '../workbench/apiClient.js';

function assertQuestion(payload) {
  if (!payload || typeof payload.id !== 'string' || !Number.isInteger(payload.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("题目结果无法识别")));
  }
  return payload;
}

function assertList(payload) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("列表结果无法识别")));
  }
  return payload.items;
}

export async function listQuestions({ q = '', state = 'active', starred } = {}) {
  const query = buildQuery({ q, state, starred: starred === undefined ? '' : String(starred) });
  const { body } = await workbenchGet(`/api/modules/questions/items${query}`);
  return assertList(body);
}

export async function getQuestion(id) {
  const { body } = await workbenchGet(`/api/modules/questions/items/${id}`);
  return assertQuestion(body);
}

export async function createQuestion({ key, payload }) {
  const { body } = await workbenchPost('/api/modules/questions/items', payload, key);
  return assertQuestion(body);
}

export async function updateQuestion({ key, id, payload }) {
  const { body } = await workbenchPut(`/api/modules/questions/items/${id}`, payload, key);
  return assertQuestion(body);
}

export async function copyQuestion({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/questions/items/${id}/copies`, payload, key);
  return assertQuestion(body);
}

export async function setQuestionDeletion({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/questions/items/${id}/deletion`, payload, key);
  return assertQuestion(body);
}

export async function listDerivatives(id, { state = 'active' } = {}) {
  const { body } = await workbenchGet(`/api/modules/questions/items/${id}/copies${buildQuery({ state })}`);
  return assertList(body);
}

export async function listQuestionUsages(id) {
  const { body } = await workbenchGet(`/api/modules/lessons/question-usages/${id}`);
  if (!body || !Array.isArray(body.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("使用位置结果无法识别")));
  }
  return body.items;
}
