/**
 * Classes API surface: the only endpoints this feature may call.
 *
 * Two teaching-time 409 problems are new vocabulary that the shared web
 * problem map does not know yet (T53 adds them with the real integration);
 * they are explicit rejections here, never an unconfirmed save, so the teacher
 * corrects the selection instead of retrying the same request.
 */
import { WorkbenchError, buildQuery, workbenchGet, workbenchPost, workbenchPut } from '../workbench/apiClient.js';
import { unexpectedSuccessProblem } from '../workbench/problems.js';

const EXPLICIT_PROBLEMS = {
  '/problems/workbench/reference-deleted': '来源已删除，不能再新增这条关联',
  '/problems/workbench/class-mismatch': '记录不能更换班级'
};

async function call(run) {
  try {
    return await run();
  } catch (error) {
    const problem = error?.problem;
    const message = problem?.reason === 'unsupported-content-version'
      ? '请刷新页面后继续编辑' : problem ? EXPLICIT_PROBLEMS[problem.type] : null;
    if (message) {
      throw new WorkbenchError({ ...problem, kind: 'invalid', message });
    }
    throw error;
  }
}

function assertItem(payload, label) {
  if (!payload || typeof payload.id !== 'string' || !Number.isInteger(payload.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem(`${label}结果无法识别`));
  }
  return payload;
}

function assertList(payload, label) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem(`${label}列表无法识别`));
  }
  return payload.items;
}

export function listClasses({ state = 'active' } = {}) {
  return call(async () => {
    const { body } = await workbenchGet(`/api/modules/classes/items${buildQuery({ state })}`);
    return assertList(body, '班级');
  });
}

export function listTeachingQuestions({ q = '' } = {}) {
  return call(async () => {
    const { body } = await workbenchGet(`/api/modules/questions/v2/items${buildQuery({ q, state: 'active' })}`);
    return assertList(body, '题目');
  });
}

export function createClass({ key, payload }) {
  return call(async () => {
    const { body } = await workbenchPost('/api/modules/classes/items', payload, key);
    return assertItem(body, '班级');
  });
}

export function updateClass({ key, id, payload }) {
  return call(async () => {
    const { body } = await workbenchPut(`/api/modules/classes/items/${id}`, payload, key);
    return assertItem(body, '班级');
  });
}

export function setClassDeletion({ key, id, payload }) {
  return call(async () => {
    const { body } = await workbenchPost(`/api/modules/classes/items/${id}/deletion`, payload, key);
    return assertItem(body, '班级');
  });
}

export function purgeClass({ key, id, payload }) {
  return call(async () => {
    const { body } = await workbenchPost(`/api/modules/classes/items/${id}/purge`, payload, key);
    if (body?.id !== id || body.permanentlyDeleted !== true) {
      throw new WorkbenchError(unexpectedSuccessProblem('删除结果无法识别'));
    }
    return body;
  });
}

export function listRecords({ classId, state = 'active' } = {}) {
  return call(async () => {
    const { body } = await workbenchGet(`/api/modules/classes/v2/records${buildQuery({ classId, state })}`);
    return assertList(body, '记录');
  });
}

export function getRecord(id) {
  return call(async () => {
    const { body } = await workbenchGet(`/api/modules/classes/v2/records/${id}`);
    return assertItem(body, '记录');
  });
}

export function createRecord({ key, payload, version = 2 }) {
  return call(async () => {
    const { body } = await workbenchPost(recordBase(version), payload, key);
    return assertItem(body, '记录');
  });
}

export function updateRecord({ key, id, payload, version = 2 }) {
  return call(async () => {
    const { body } = await workbenchPut(`${recordBase(version)}/${id}`, payload, key);
    return assertItem(body, '记录');
  });
}

export function setRecordDeletion({ key, id, payload, version = 2 }) {
  return call(async () => {
    const { body } = await workbenchPost(`${recordBase(version)}/${id}/deletion`, payload, key);
    return assertItem(body, '记录');
  });
}

export function listSourceRecords(kind, id) {
  return call(async () => {
    const { body } = await workbenchGet(`/api/modules/classes/v2/source-records/${kind}/${id}`);
    return assertList(body, '反馈');
  });
}

function recordBase(version) {
  return version === 1 ? '/api/modules/classes/records' : '/api/modules/classes/v2/records';
}

// Pending requests from the old client have a raw body. New pending requests
// carry their API version locally; this envelope is never sent over HTTP.
export function recordRequest(body) { return { recordApiVersion: 2, body }; }
export function decodeRecordRequest(payload) {
  return payload?.recordApiVersion === 2 ? { version: 2, payload: payload.body } : { version: 1, payload };
}

export function listTeachingWorks({ q = '', kind = '' } = {}) {
  return call(async () => {
    const { body } = await workbenchGet(`/api/modules/math/v1/works${buildQuery({ q, kind: kind || undefined, state: 'active' })}`);
    return assertList(body, '作品');
  });
}

export async function listClassOverview() {
  return call(async () => assertList((await workbenchGet('/api/modules/classes/overview')).body, '班级进度'));
}

export async function purgeRecord({ key, id, payload }) {
  return call(async () => {
    const { body } = await workbenchPost(`/api/modules/classes/v2/records/${id}/purge`, payload, key);
    if (body?.id !== id || body.permanentlyDeleted !== true) throw new WorkbenchError(unexpectedSuccessProblem('删除结果无法识别'));
    return body;
  });
}
export async function setNextNoteVisibility({ key, id, payload }) {
  return call(async () => assertItem((await workbenchPost(`/api/modules/classes/v2/records/${id}/next-note-visibility`, payload, key)).body, '教学想法'));
}
