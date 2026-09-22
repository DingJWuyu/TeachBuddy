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

export const sourcePath = (kind) =>
  kind === "resource"
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
