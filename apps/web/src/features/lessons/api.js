/** Lessons module API surface. */

import {
  WorkbenchError,
  buildQuery,
  workbenchGet,
  workbenchPost,
  workbenchPut,
} from "../workbench/apiClient.js";
import { unexpectedSuccessProblem } from "../workbench/problems.js";

function assertLesson(payload) {
  if (
    !payload ||
    typeof payload.id !== "string" ||
    !Number.isInteger(payload.version)
  ) {
    throw new WorkbenchError(unexpectedSuccessProblem("备课结果无法识别"));
  }
  return payload;
}

export async function listLessons({ q = "", state = "active" } = {}) {
  const { body } = await workbenchGet(
    `/api/modules/lessons/v3${buildQuery({ q, state })}`,
  );
  if (!body || !Array.isArray(body.items)) {
    throw new WorkbenchError(unexpectedSuccessProblem("备课列表无法识别"));
  }
  return body.items;
}

export async function getLesson(id) {
  const { body } = await workbenchGet(`/api/modules/lessons/v3/${id}`);
  return assertLesson(body);
}

export async function createLesson({ key, payload, version = 3 }) {
  const { body } = await workbenchPost(
    version === 2 ? "/api/modules/lessons/v2/items" : "/api/modules/lessons/v3",
    payload,
    key,
  );
  return assertLesson(body);
}

export async function updateLesson({ key, id, payload, version = 3 }) {
  const { body } = await workbenchPut(
    `${version === 2 ? "/api/modules/lessons/v2/items" : "/api/modules/lessons/v3"}/${id}`,
    payload,
    key,
  );
  return assertLesson(body);
}

export async function setLessonDeletion({ key, id, payload, version = 3 }) {
  const { body } = await workbenchPost(
    `${version === 3 ? "/api/modules/lessons/v3" : "/api/modules/lessons/v2/items"}/${id}/deletion`,
    payload,
    key,
  );
  return assertLesson(body);
}

export async function purgeLesson({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/lessons/v3/${id}/purge`, payload, key);
  if (body?.id !== id || body.permanentlyDeleted !== true)
    throw new WorkbenchError(unexpectedSuccessProblem("删除结果无法确认"));
  return body;
}

export const sourcePath = (kind) =>
  kind === "math" ? "/api/modules/math/v1/works" : kind === "resource"
    ? "/api/modules/resources/items"
    : "/api/modules/questions/v2/items";
export async function readSource(kind, id) {
  return (await workbenchGet(kind === "math" ? `/api/modules/math/v1/works/${id}/reference` : `${sourcePath(kind)}/${id}/for-reference`)).body;
}
export async function listSources(kind, q = "") {
  return (
    await workbenchGet(
      `${sourcePath(kind)}${buildQuery({ q, state: "active" })}`,
    )
  ).body.items;
}

// Public serializer for consumers adding references to a complete lesson draft.
export { referenceInputFrom } from "./model.js";

export async function copyLesson({ key, id, payload }) {
  const { body } = await workbenchPost(`/api/modules/lessons/v3/${id}/copy`, payload, key);
  return assertLesson(body);
}

export async function getLessonHistory(id) {
  return (await workbenchGet(`/api/modules/lessons/v3/${id}/history`)).body;
}
export async function getLessonVersion(id, version) {
  return assertLesson((await workbenchGet(`/api/modules/lessons/v3/${id}/history/${version}`)).body);
}
export async function applyLessonContent({ key, id, payload }) {
  const path = payload.action === "history" ? "history/restore" : "sections/copy";
  return assertLesson((await workbenchPost(`/api/modules/lessons/v3/${id}/${path}`, payload.body, key)).body);
}

export async function readRecognizedPage({ fileId, renditionFileId, page }) {
  return (await workbenchGet(`/api/workbench/files/${fileId}/recognition/pages/${page}${buildQuery({ renditionFileId })}`)).body;
}
export async function readRecognitionStatus({ fileId, renditionFileId }) {
  return (await workbenchGet(`/api/workbench/files/${fileId}/recognition${buildQuery({ renditionFileId })}`)).body;
}
export async function requestPageRecognition({ key, payload }) {
  if (payload.jobId) return (await workbenchPost(`/api/workbench/jobs/${payload.jobId}/retry`, {
    unitIds: [`page:${payload.page}`],
  }, key)).body;
  return (await workbenchPost(`/api/workbench/files/${payload.fileId}/recognition`, {
    renditionFileId: payload.renditionFileId, pages: [payload.page],
  }, key)).body;
}
export async function adoptLessonPage({ key, id, payload }) {
  return assertLesson((await workbenchPost(`/api/modules/lessons/v3/${id}/sections/adopt-page`, payload, key)).body);
}
