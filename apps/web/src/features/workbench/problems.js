import i18n from '../../i18n/index.js';

const t = (key, options) => i18n.t(key, { ns: 'errors', ...options });

/**
 * Workbench Problem mapping.
 *
 * The contract separates an explicit rejection (known 4xx, correctable and
 * retryable with a new key) from an unconfirmed result (5xx, dropped connection,
 * timeout, unknown body shape) which must be retried with the original key.
 * Everything in between is treated as unconfirmed on purpose: a wrong guess in
 * that direction never claims a save that did not happen.
 */

const PROBLEM_TYPES = {
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
};

const REASON_KEYS = {
  required: 'invalid.required',
  'unknown-field': 'invalid.unknownField',
  'invalid-type': 'invalid.type',
  'out-of-range': 'invalid.range',
  'empty-content': 'invalid.empty',
  'duplicate-id': 'invalid.duplicateId',
  'invalid-reference': 'invalid.reference',
  'unsupported-content-version': 'invalid.contentVersion'
};

const FIELD_LABELS = [
  [/^\/title$/, 'field.title'],
  [/^\/body$/, 'field.body'],
  [/^\/solution$/, 'field.solution'],
  [/^\/note$/, 'field.note'],
  [/^\/starred$/, 'field.starred'],
  [/^\/source(\/|$)/, 'field.source'],
  [/^\/intro$/, 'field.intro'],
  [/^\/sections\/(\d+)\/title$/, 'field.sectionTitle'],
  [/^\/sections\/(\d+)\/content$/, 'field.sectionContent'],
  [/^\/sections\/(\d+)\/references\/(\d+)\/questionId$/, 'field.referenceQuestion'],
  [/^\/sections\/(\d+)\/references\/(\d+)\/questionVersion$/, 'field.referenceVersion'],
  [/^\/sections\/(\d+)\/references\/(\d+)\/note$/, 'field.lessonNote'],
  [/^\/materials\/(\d+)\/questionId$/, 'field.materialQuestion'],
  [/^\/materials\/(\d+)\/questionVersion$/, 'field.materialVersion'],
  [/^\/materials\/(\d+)\/note$/, 'field.lessonNote'],
  [/^\/baseVersion$/, 'field.version'],
  [/^\/deleted$/, 'field.deletion'],
  [/^\/query\//, 'field.query'],
  [/^\/headers\//, 'field.headers']
];

// Only known, static caller copy is mapped. Dynamic descriptions are preserved.
const CALLER_MESSAGE_KEYS = new Map([
  ["无法连接服务，暂不能确认是否保存", "caller.connection"],
  ["导航布局返回内容无法确认", "caller.navigationResult"],
  ["此设备的原导航无法读取，原布局已保留", "caller.navigationStored"],
  ["无法读取服务器内容", "caller.readServer"],
  ["无法准备草稿", "caller.prepareDraft"],
  ["保存失败", "caller.saveFailed"],
  ["上次操作的结果未确认，请重试确认", "caller.previousResult"],
  ["操作结果未确认", "caller.actionResult"],
]);

function callerMessage(message) {
  const key = CALLER_MESSAGE_KEYS.get(message);
  return key ? t(key) : message;
}

function describeField(field) {
  if (!field) return t('field.request');
  for (const [pattern, label] of FIELD_LABELS) {
    if (pattern.test(field)) return t(label);
  }
  return t('field.request');
}

function problemFor(status, body) {
  const type = body && typeof body === 'object' && typeof body.type === 'string' ? body.type : null;
  const problem = { status, type };
  // The status stays available for callers that need a deployment answer (the
  // boot probe), while the kind below still refuses to treat an unknown body as
  // a known rejection for a save.
  problem.httpStatus = status;
  if (type === '/problems/materials/reference-version-conflict' && status === 409) {
    return {...problem,kind:'conflict',currentVersion:body.currentVersion,sourceKind:body.kind,sourceId:body.id,get message() { return t('sourceUpdated', { version: body.currentVersion }); }};
  }
  if (['/problems/materials/unsupported-formula','/problems/materials/invalid-export-selection'].includes(type) && status === 422) {
    return {...problem,kind:'invalid',field:body.field,detail:body.detail,get message() { return t(type.endsWith('unsupported-formula') ? 'unsupportedFormula' : 'invalidExportSelection'); }};
  }
  if (type === PROBLEM_TYPES.versionConflict) {
    problem.kind = 'conflict';
    problem.currentVersion = body.currentVersion;
  } else if (type === PROBLEM_TYPES.referenceVersionConflict) {
    problem.kind = 'conflict';
    problem.currentVersion = body.currentVersion;
    problem.questionId = body.questionId;
  } else if (type === PROBLEM_TYPES.objectDeleted) {
    problem.kind = 'deleted';
  } else if (type === PROBLEM_TYPES.idempotencyKeyReused) {
    problem.kind = 'key-reused';
  } else if (type === PROBLEM_TYPES.unauthenticated) {
    problem.kind = 'identity';
  } else if (type === PROBLEM_TYPES.requestNotAllowed) {
    problem.kind = 'forbidden';
  } else if (type === PROBLEM_TYPES.notFound) {
    problem.kind = 'not-found';
  } else if (type === PROBLEM_TYPES.invalidInput) {
    problem.kind = 'invalid';
    problem.field = body.field;
    problem.reason = body.reason;
  } else if (type === PROBLEM_TYPES.malformedJson
    || type === PROBLEM_TYPES.payloadTooLarge
    || type === PROBLEM_TYPES.unsupportedMediaType) {
    problem.kind = 'invalid';
  } else {
    // 503 and every unknown Problem belong to the unconfirmed family.
    problem.kind = 'unconfirmed';
  }
  return { ...problem, get message() { return describeProblem(problem); } };
}

/** HTTP response -> problem. Non-JSON or oversized bodies stay unconfirmed. */
export function problemFromResponse(status, body) {
  if (body && typeof body === 'object' && typeof body.type === 'string') {
    return problemFor(status, body);
  }
  return problemFor(status, null);
}

export function unconfirmedProblem(reason) {
  const problem = { kind: 'unconfirmed', status: 0, type: null, get message() { return callerMessage(reason); } };
  return problem;
}

/**
 * A 2xx body that does not match the expected object shape is not a save:
 * the contract forbids treating an unknown success structure as confirmed.
 */
export function unexpectedSuccessProblem(detail) {
  return {
    kind: 'unconfirmed',
    status: 0,
    type: null,
    get message() { return detail ? callerMessage(detail) : t('unknownSuccess'); }
  };
}

function describeProblem(problem) {
  if (!problem) return '';
  switch (problem.kind) {
    case 'identity':
      return t('identity');
    case 'forbidden':
      return t('forbidden');
    case 'not-found':
      return t('notFound');
    case 'conflict': {
      if (problem.questionId) {
        return t('questionConflict', { version: problem.currentVersion ?? t('unknown') });
      }
      return t('versionConflict', { version: problem.currentVersion ?? t('unknown') });
    }
    case 'deleted':
      return t('deleted');
    case 'key-reused':
      return t('keyReused');
    case 'invalid': {
      if (problem.type === PROBLEM_TYPES.payloadTooLarge) return t('payloadTooLarge');
      if (problem.type === PROBLEM_TYPES.unsupportedMediaType) return t('unsupportedMediaType');
      if (problem.type === PROBLEM_TYPES.malformedJson) return t('malformedJson');
      if (!problem.reason) return t('invalidRequest');
      const key = Object.hasOwn(REASON_KEYS, problem.reason) ? REASON_KEYS[problem.reason] : 'invalid.fallback';
      return t(key, { field: describeField(problem.field) });
    }
    case 'unconfirmed':
    default:
      return problem.message ? callerMessage(problem.message) : t('unconfirmed');
  }
}
