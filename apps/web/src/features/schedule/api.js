/** Schedule module API surface: the only endpoints this feature may call. */

import { WorkbenchError, buildQuery, workbenchGet, workbenchPost, workbenchPut } from '../workbench/apiClient.js';
import { listRecords } from '../classes/api.js';
export { listLessons } from '../lessons/api.js';
import { unexpectedSuccessProblem } from '../workbench/problems.js';

function assertObject(payload, label) {
  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string' || !Number.isInteger(payload.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem(`${label}结果无法识别`));
  }
  return payload;
}

function assertList(payload, label) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem(`${label}列表无法识别`));
  }
  return payload;
}

export async function getSettings() {
  const { body } = await workbenchGet('/api/modules/schedule/settings');
  if (!body || typeof body.timeZone !== 'string' || !Number.isInteger(body.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem('日程设置无法识别'));
  }
  return body;
}

export async function updateSettings({ key, payload }) {
  const { body } = await workbenchPut('/api/modules/schedule/settings', payload, key);
  if (!body || typeof body.timeZone !== 'string' || !Number.isInteger(body.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem('日程设置无法识别'));
  }
  return body;
}

export async function listEntries({ state = 'active', placement = 'all' } = {}) {
  const query = buildQuery({ state, placement });
  const { body } = await workbenchGet(`/api/modules/schedule/entries${query}`);
  return assertList(body, '安排').items;
}

export async function getEntry(id) {
  const { body } = await workbenchGet(`/api/modules/schedule/entries/${id}`);
  return assertObject(body, '安排');
}

export async function createEntry({ key, payload }) {
  const { body } = await workbenchPost('/api/modules/schedule/entries', payload, key);
  return assertObject(body, '安排');
}

export async function updateEntry({ key, id, payload }) {
  const { body } = await workbenchPut(`/api/modules/schedule/entries/${id}`, payload, key);
  return assertObject(body, '安排');
}

export async function setEntryDeletion({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/schedule/entries/${id}/deletion`, payload, key);
  return assertObject(body, '安排');
}

export async function listExceptions(id) {
  const { body } = await workbenchGet(`/api/modules/schedule/entries/${id}/exceptions`);
  if (!body || !Array.isArray(body.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem('单次调整列表无法识别'));
  }
  return body;
}

export async function setException({ key, id, originDate, payload }) {
  const { body } = await workbenchPut(
    `/api/modules/schedule/entries/${id}/exceptions/${originDate}`,
    payload,
    key
  );
  if (!body || !body.key) throw new WorkbenchError(unexpectedSuccessProblem('单次安排无法识别'));
  return body;
}

export async function getOccurrence(id, originDate) {
  const query = buildQuery({ originDate });
  const { body } = await workbenchGet(`/api/modules/schedule/entries/${id}/occurrence${query}`);
  if (!body || !body.key) throw new WorkbenchError(unexpectedSuccessProblem('这次安排无法识别'));
  return body;
}

export async function listOccurrences({ from, to }) {
  const query = buildQuery({ from, to });
  const { body } = await workbenchGet(`/api/modules/schedule/occurrences${query}`);
  if (!body || !body.timeZone || !Array.isArray(body.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem('日期范围结果无法识别'));
  }
  return body;
}

export async function moveItem({ key, payload }) {
  const { body } = await workbenchPost('/api/modules/schedule/item-moves', payload, key);
  if (!body || !body.from || !body.to) throw new WorkbenchError(unexpectedSuccessProblem('移动结果无法识别'));
  return body;
}

export async function listClasses() {
  const { body } = await workbenchGet('/api/modules/classes/items');
  return assertList(body, '班级').items;
}

export function listClassRecords(classId) {
  return listRecords({ classId });
}
