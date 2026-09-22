/**
 * Shared contract constants for the first-flow workbench.
 *
 * Both sides consume the same frozen OpenAPI document
 * (docs/contracts/workbench/first-flow.openapi.yaml); these constants are the
 * small runtime vocabulary that would otherwise be re-typed differently on
 * each side. Values must stay byte-identical to the frozen document: paths,
 * header names, problem type URIs, invalid-input reasons and the JSON body
 * limit. Adding a value here without a new frozen contract revision is a
 * contract change.
 */

export const workbenchPaths = Object.freeze({
  context: '/api/workbench/context',
  modules: '/api/modules'
});

export const workbenchHeaders = Object.freeze({
  sessionCookie: '__Host-teachbuddy_session',
  browserProtection: 'X-TeachBuddy-Request',
  browserProtectionValue: '1',
  idempotencyKey: 'Idempotency-Key'
});

export const workbenchMediaTypes = Object.freeze({
  json: 'application/json',
  problem: 'application/problem+json'
});

export const workbenchLimits = Object.freeze({
  requestBodyBytes: 2 * 1024 * 1024,
  titleLength: 200,
  noteLength: 20000,
  textRunLength: 20000,
  latexLength: 10000,
  pasteSourceLength: 100000,
  documentBlocks: 1000,
  paragraphRuns: 1000
});

export const workbenchCacheControl = 'no-store';

export const workbenchProblemTypes = Object.freeze({
  invalidTimeZone: '/problems/workbench/invalid-time-zone',
  reminderNotFuture: '/problems/workbench/reminder-not-future',
  referenceDeleted: '/problems/workbench/reference-deleted',
  classMismatch: '/problems/workbench/class-mismatch',
  immutableSeries: '/problems/workbench/immutable-series',
  invalidMove: '/problems/workbench/invalid-move',
  malformedJson: '/problems/workbench/malformed-json',
  unauthenticated: '/problems/workbench/unauthenticated',
  requestNotAllowed: '/problems/workbench/request-not-allowed',
  notFound: '/problems/workbench/not-found',
  versionConflict: '/problems/workbench/version-conflict',
  referenceVersionConflict: '/problems/workbench/reference-version-conflict',
  idempotencyKeyReused: '/problems/workbench/idempotency-key-reused',
  objectDeleted: '/problems/workbench/object-deleted',
  payloadTooLarge: '/problems/workbench/payload-too-large',
  unsupportedMediaType: '/problems/workbench/unsupported-media-type',
  invalidInput: '/problems/workbench/invalid-input',
  temporarilyUnavailable: '/problems/workbench/temporarily-unavailable'
});

export const workbenchInvalidInputReasons = Object.freeze([
  'required',
  'unknown-field',
  'invalid-type',
  'out-of-range',
  'empty-content',
  'duplicate-id',
  'invalid-reference',
  'unsupported-content-version'
]);

/** HTTP status fixed by the frozen responses for each problem type. */
export const workbenchProblemStatus = Object.freeze({
  [workbenchProblemTypes.invalidTimeZone]: 422,
  [workbenchProblemTypes.reminderNotFuture]: 422,
  [workbenchProblemTypes.referenceDeleted]: 409,
  [workbenchProblemTypes.classMismatch]: 409,
  [workbenchProblemTypes.immutableSeries]: 409,
  [workbenchProblemTypes.invalidMove]: 409,
  [workbenchProblemTypes.malformedJson]: 400,
  [workbenchProblemTypes.unauthenticated]: 401,
  [workbenchProblemTypes.requestNotAllowed]: 403,
  [workbenchProblemTypes.notFound]: 404,
  [workbenchProblemTypes.versionConflict]: 409,
  [workbenchProblemTypes.referenceVersionConflict]: 409,
  [workbenchProblemTypes.idempotencyKeyReused]: 409,
  [workbenchProblemTypes.objectDeleted]: 409,
  [workbenchProblemTypes.payloadTooLarge]: 413,
  [workbenchProblemTypes.unsupportedMediaType]: 415,
  [workbenchProblemTypes.invalidInput]: 422,
  [workbenchProblemTypes.temporarilyUnavailable]: 503
});
