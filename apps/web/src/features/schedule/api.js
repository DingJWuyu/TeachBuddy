import i18n from "../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "schedule", ...options });
/** Schedule module API surface: the only endpoints this feature may call. */

import { WorkbenchError, buildQuery, workbenchGet, workbenchPost, workbenchPut } from '../workbench/apiClient.js';
import { unexpectedSuccessProblem } from '../workbench/problems.js';

// This schedule-specific 422 is a confirmed rejection, so the teacher can
// correct the reminder and submit a new request. Unknown responses retain the
// shared client's conservative, original-key retry behaviour.
async function scheduleWrite(request) {
  try {
    return await request;
  } catch (error) {
    const problem = error.problem;
    if (problem?.httpStatus === 422 && problem.type === '/problems/workbench/reminder-not-future') {
      throw new WorkbenchError({ ...problem, kind: 'invalid', field: '/reminder', message: t("提醒时间已过去，请调整时间或关闭提醒") });
    }
    throw error;
  }
}

function assertObject(payload, label) {
  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string' || !Number.isInteger(payload.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("{{label}}结果无法识别", { label: label })));
  }
  return payload;
}

function assertList(payload, label) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("{{label}}列表无法识别", { label: label })));
  }
  return payload;
}

export async function getSettings() {
  const { body } = await workbenchGet('/api/modules/schedule/settings');
  if (!body || typeof body.timeZone !== 'string' || !Number.isInteger(body.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("日程设置无法识别")));
  }
  return body;
}

export async function updateSettings({ key, payload }) {
  const { body } = await workbenchPut('/api/modules/schedule/settings', payload, key);
  if (!body || typeof body.timeZone !== 'string' || !Number.isInteger(body.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("日程设置无法识别")));
  }
  return body;
}

export async function listEntries({ state = 'active', placement = 'all' } = {}) {
  const query = buildQuery({ state, placement });
  const { body } = await workbenchGet(`/api/modules/schedule/entries${query}`);
  return assertList(body, t("安排")).items;
}

export async function getEntry(id) {
  const { body } = await workbenchGet(`/api/modules/schedule/entries/${id}`);
  return assertObject(body, t("安排"));
}

export async function createEntry({ key, payload }) {
  const { body } = await scheduleWrite(workbenchPost('/api/modules/schedule/entries', payload, key));
  return assertObject(body, t("安排"));
}

export async function updateEntry({ key, id, payload }) {
  const { body } = await scheduleWrite(workbenchPut(`/api/modules/schedule/entries/${id}`, payload, key));
  return assertObject(body, t("安排"));
}

export async function deleteEntry({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/schedule/entries/${id}/delete`, payload, key);
  return assertObject(body, t("安排"));
}

export async function setEntryDeletion({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/schedule/entries/${id}/deletion`, payload, key);
  return assertObject(body, t("安排"));
}

export async function listExceptions(id) {
  const { body } = await workbenchGet(`/api/modules/schedule/entries/${id}/exceptions`);
  if (!body || !Array.isArray(body.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("单次调整列表无法识别")));
  }
  return body;
}

export async function setException({ key, id, originDate, payload }) {
  const { body } = await scheduleWrite(workbenchPut(
    `/api/modules/schedule/entries/${id}/exceptions/${originDate}`,
    payload,
    key
  ));
  if (!body || !body.key) throw new WorkbenchError(unexpectedSuccessProblem(t("单次安排无法识别")));
  return body;
}

export async function getOccurrence(id, originDate) {
  const query = buildQuery({ originDate });
  const { body } = await workbenchGet(`/api/modules/schedule/entries/${id}/occurrence${query}`);
  if (!body || !body.key) throw new WorkbenchError(unexpectedSuccessProblem(t("这次安排无法识别")));
  return body;
}

export async function listOccurrences({ from, to }) {
  const query = buildQuery({ from, to });
  const { body } = await workbenchGet(`/api/modules/schedule/occurrences${query}`);
  if (!body || !body.timeZone || !Array.isArray(body.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem(t("日期范围结果无法识别")));
  }
  return body;
}

export async function moveItem({ key, payload }) {
  const { body } = await workbenchPost('/api/modules/schedule/item-moves', payload, key);
  if (!body || !body.from || !body.to) throw new WorkbenchError(unexpectedSuccessProblem(t("移动结果无法识别")));
  return body;
}

export async function listLabels() {
  const { body } = await workbenchGet('/api/modules/schedule/labels');
  return assertList(body, t("标签")).items;
}
export async function createLabel({ key, payload }) {
  const { body } = await workbenchPost('/api/modules/schedule/labels', payload, key);
  return assertObject(body, t("标签"));
}
export async function updateLabel({ key, id, payload }) {
  const { body } = await workbenchPut(`/api/modules/schedule/labels/${id}`, payload, key);
  return assertObject(body, t("标签"));
}

export async function detachOccurrence({ key, id, originDate, payload }) {
  const { body } = await scheduleWrite(workbenchPost(`/api/modules/schedule/entries/${id}/occurrences/${originDate}/detach`, payload, key));
  return assertObject(body, t("安排"));
}
