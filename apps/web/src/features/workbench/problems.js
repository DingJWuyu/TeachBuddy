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

const REASON_TEXT = {
  required: '为必填项',
  'unknown-field': '包含不认识的字段',
  'invalid-type': '格式不正确',
  'out-of-range': '超出允许范围',
  'empty-content': '不能只有空白',
  'duplicate-id': '存在重复的 ID',
  'invalid-reference': '题目引用不合法',
  'unsupported-content-version': '内容版本不受支持'
};

const FIELD_LABELS = [
  [/^\/title$/, '标题'],
  [/^\/body$/, '题面'],
  [/^\/solution$/, '答案'],
  [/^\/note$/, '笔记'],
  [/^\/starred$/, '标记'],
  [/^\/source(\/|$)/, '来源'],
  [/^\/intro$/, '开头文稿'],
  [/^\/sections\/(\d+)\/title$/, '环节标题'],
  [/^\/sections\/(\d+)\/content$/, '环节文稿'],
  [/^\/sections\/(\d+)\/references\/(\d+)\/questionId$/, '引用题目'],
  [/^\/sections\/(\d+)\/references\/(\d+)\/questionVersion$/, '引用版本'],
  [/^\/sections\/(\d+)\/references\/(\d+)\/note$/, '本课备注'],
  [/^\/materials\/(\d+)\/questionId$/, '材料题目'],
  [/^\/materials\/(\d+)\/questionVersion$/, '材料版本'],
  [/^\/materials\/(\d+)\/note$/, '本课备注'],
  [/^\/baseVersion$/, '版本'],
  [/^\/deleted$/, '删除状态'],
  [/^\/query\//, '查询条件'],
  [/^\/headers\//, '请求头']
];

function describeField(field) {
  if (!field) return '请求内容';
  for (const [pattern, label] of FIELD_LABELS) {
    if (pattern.test(field)) return label;
  }
  return '请求内容';
}

function problemFor(status, body) {
  const type = body && typeof body === 'object' && typeof body.type === 'string' ? body.type : null;
  const problem = { status, type };
  // The status stays available for callers that need a deployment answer (the
  // boot probe), while the kind below still refuses to treat an unknown body as
  // a known rejection for a save.
  problem.httpStatus = status;
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
  problem.message = describeProblem(problem);
  return problem;
}

/** HTTP response -> problem. Non-JSON or oversized bodies stay unconfirmed. */
export function problemFromResponse(status, body) {
  if (body && typeof body === 'object' && typeof body.type === 'string') {
    return problemFor(status, body);
  }
  return problemFor(status, null);
}

export function unconfirmedProblem(reason) {
  const problem = { kind: 'unconfirmed', status: 0, type: null, message: reason };
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
    message: detail || '服务返回的结果无法识别，暂不能确认是否保存'
  };
}

function describeProblem(problem) {
  if (!problem) return '';
  switch (problem.kind) {
    case 'identity':
      return '登录状态已失效，请重新验证身份后继续';
    case 'forbidden':
      return '请求来源或保护头无效，保存被拒绝';
    case 'not-found':
      return '未找到内容，可能已被删除或不属于当前账户';
    case 'conflict': {
      if (problem.questionId) {
        return `引用的题目已在别处修改（当前版本 ${problem.currentVersion ?? '未知'}）`;
      }
      return `内容已在别处修改（服务器版本 ${problem.currentVersion ?? '未知'}）`;
    }
    case 'deleted':
      return '对象已被删除，恢复后才能继续编辑';
    case 'key-reused':
      return '这次提交的请求键已用于另一次操作，请作为新的提交重试';
    case 'invalid': {
      if (problem.type === PROBLEM_TYPES.payloadTooLarge) return '内容超过 2 MiB 上限';
      if (problem.type === PROBLEM_TYPES.unsupportedMediaType) return '请求类型不受支持';
      if (problem.type === PROBLEM_TYPES.malformedJson) return '请求内容不是合法 JSON';
      if (!problem.reason) return '请求内容无效';
      return `${describeField(problem.field)}${REASON_TEXT[problem.reason] || '无效'}`;
    }
    case 'unconfirmed':
    default:
      return problem.message || '暂时无法确认是否保存';
  }
}
