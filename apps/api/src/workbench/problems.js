/**
 * Contract problems for the workbench HTTP layer.
 *
 * Known failures carry `status` and `problem` on the Error (the frozen
 * architecture rule for public ports and write callbacks), so a module may
 * throw its own Error with those fields and the transport layer maps it
 * unchanged. Problem bodies come from the frozen OpenAPI; the transport is the
 * only place that turns them into `application/problem+json` responses.
 */
import {
  workbenchInvalidInputReasons,
  workbenchMediaTypes,
  workbenchProblemStatus,
  workbenchProblemTypes
} from '@teachbuddy/shared';

export class ContractError extends Error {
  constructor(status, problem, message) {
    super(message ?? `Workbench contract error ${status} ${problem.type}`);
    this.name = 'ContractError';
    this.status = status;
    this.problem = problem;
  }
}

function problem(type, extra) {
  return { type, ...extra };
}

export const problems = {
  malformedJson: () => problem(workbenchProblemTypes.malformedJson),
  unauthenticated: () => problem(workbenchProblemTypes.unauthenticated),
  requestNotAllowed: () => problem(workbenchProblemTypes.requestNotAllowed),
  notFound: () => problem(workbenchProblemTypes.notFound),
  versionConflict: (currentVersion) => problem(workbenchProblemTypes.versionConflict, { currentVersion }),
  referenceVersionConflict: (questionId, currentVersion) => problem(
    workbenchProblemTypes.referenceVersionConflict,
    { questionId, currentVersion }
  ),
  idempotencyKeyReused: () => problem(workbenchProblemTypes.idempotencyKeyReused),
  objectDeleted: () => problem(workbenchProblemTypes.objectDeleted),
  payloadTooLarge: () => problem(workbenchProblemTypes.payloadTooLarge),
  unsupportedMediaType: () => problem(workbenchProblemTypes.unsupportedMediaType),
  invalidInput: (field, reason) => {
    if (!workbenchInvalidInputReasons.includes(reason)) {
      throw new Error(`Unknown invalid-input reason: ${reason}`);
    }
    return problem(workbenchProblemTypes.invalidInput, { field, reason });
  },
  temporarilyUnavailable: () => problem(workbenchProblemTypes.temporarilyUnavailable)
};

export function isProblem(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.type === 'string'
    && value.type.startsWith('/problems/workbench/');
}

/**
 * Status for a problem. Only statuses fixed by the frozen responses are
 * accepted, so a typo cannot invent a new status/type pairing.
 */
export function problemStatus(problemValue) {
  const status = workbenchProblemStatus[problemValue?.type];
  if (!status) {
    throw new Error(`Unknown workbench problem type: ${String(problemValue?.type)}`);
  }
  return status;
}

export function contractError(problemValue, message) {
  return new ContractError(problemStatus(problemValue), problemValue, message);
}

export function invalidInput(field, reason) {
  return contractError(problems.invalidInput(field, reason));
}

export function sendProblem(res, status, problemValue) {
  res.status(status);
  res.set('Content-Type', workbenchMediaTypes.problem);
  return res.send(JSON.stringify(problemValue));
}

/**
 * Reduce any thrown value to a contract response. Errors already carrying a
 * contract status/problem pass through unchanged; body-parser failures map to
 * their fixed statuses; everything else is unknown storage/runtime failure and
 * becomes 503 without leaking database details.
 */
export function mapErrorToResponse(error) {
  if (error && typeof error.status === 'number' && isProblem(error.problem)) {
    return { status: error.status, problem: error.problem, known: true };
  }

  switch (error?.type) {
    case 'entity.too.large':
      return { status: problemStatus(problems.payloadTooLarge()), problem: problems.payloadTooLarge() };
    case 'entity.parse.failed':
      return { status: problemStatus(problems.malformedJson()), problem: problems.malformedJson() };
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return { status: problemStatus(problems.unsupportedMediaType()), problem: problems.unsupportedMediaType() };
    default:
      return {
        status: problemStatus(problems.temporarilyUnavailable()),
        problem: problems.temporarilyUnavailable()
      };
  }
}

export function materialsError(type, status = 422, field = "", detail = "") {
  return Object.assign(new Error(type), {
    status,
    problem: { type: `/problems/materials/${type}`, field, detail },
  });
}
