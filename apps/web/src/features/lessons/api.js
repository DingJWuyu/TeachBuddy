/** Lessons module API surface. */

import { WorkbenchError, buildQuery, workbenchGet, workbenchPost, workbenchPut } from '../workbench/apiClient.js';
import { unexpectedSuccessProblem } from '../workbench/problems.js';

function assertLesson(payload) {
  if (!payload || typeof payload.id !== 'string' || !Number.isInteger(payload.version)) {
    throw new WorkbenchError(unexpectedSuccessProblem('备课结果无法识别'));
  }
  return payload;
}

export async function listLessons({ q = '', state = 'active' } = {}) {
  const { body } = await workbenchGet(`/api/modules/lessons/items${buildQuery({ q, state })}`);
  if (!body || !Array.isArray(body.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem('备课列表无法识别'));
  }
  return body.items;
}

export async function getLesson(id) {
  const { body } = await workbenchGet(`/api/modules/lessons/items/${id}`);
  return assertLesson(body);
}

export async function createLesson({ key, payload }) {
  const { body } = await workbenchPost('/api/modules/lessons/items', payload, key);
  return assertLesson(body);
}

export async function updateLesson({ key, id, payload }) {
  const { body } = await workbenchPut(`/api/modules/lessons/items/${id}`, payload, key);
  return assertLesson(body);
}

export async function setLessonDeletion({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/lessons/items/${id}/deletion`, payload, key);
  return assertLesson(body);
}
