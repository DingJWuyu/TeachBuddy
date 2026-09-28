const t = (key, options) => i18n.t(key, { ns: 'auth', ...options });
import i18n from '../../i18n/index.js';
/*
 * Frontend copy for declared problems. The mapping is by problem type (plus
 * the operation for wording), never by title or detail.
 */
import { PROBLEM } from './api.js';

export const COPY = Object.freeze({
  get emailEmpty() { return t("请填写邮箱。"); },
  get emailInvalid() { return t("邮箱格式不正确。"); },
  get nicknameEmpty() { return t("请填写昵称。"); },
  get nicknameTooLong() { return t("昵称不能超过 40 个字符。"); },
  passwordTooShort: (label) => t("{{label}}至少 8 位。", { label: label }),
  passwordTooLong: (label) => t("{{label}}不能超过 128 个字符。", { label: label }),
  get confirmationMismatch() { return t("两次输入的密码不一致。"); },
  get codeShape() { return t("请输入 6 位数字验证码（0-9）。"); },
  get codeNotSent() { return t("请先发送邮箱验证码。"); },
  get codeNotSentRecovery() { return t("请先发送验证码。"); },
  get termsRequired() { return t("需要同意服务条款才能创建账户。"); },
  get emailOccupied() { return t("这个邮箱已经注册过了，直接登录，或换一个邮箱。"); },
  get emailUnknown() { return t("这个邮箱没有可找回的账户。"); },
  get credentialsRejected() { return t("邮箱或密码不正确，请重试。"); },
  get codeMissing() { return t("验证码已失效，请重新发送。"); },
  get codeReplaced() { return t("验证码已被新发送的验证码替换，请使用新验证码。"); },
  get codeConsumed() { return t("验证码已经用过了，请重新发送。"); },
  get codeExpired() { return t("验证码已过期，请重新发送。"); },
  get codeExhausted() { return t("验证码错误次数过多，请重新发送。"); },
  codeIncorrect: (remaining) => (
    remaining > 0 ? t("验证码不正确，还可以再试 {{count}} 次。", { count: remaining }) : t("验证码不正确，请重新发送。")
  ),
  get codeDelivery() { return t("验证码发送失败，请稍后重试。"); },
  get registrationClosed() { return t("目前暂时不能创建新账户。"); },
  get storeRetry() { return t("暂时无法完成，请重试。"); },
  get serviceRetry() { return t("服务暂时不可用，请稍后重试。"); },
  get requestRejected() { return t("当前请求未被接受，请刷新页面后重试。"); },
  get bodyRejected() { return t("提交内容无法处理，请刷新页面后重试。"); },
  get fieldRequired() { return t("请填写该字段。"); },
  get fieldType() { return t("提交内容格式不正确，请检查后重试。"); },
  get fieldValue() { return t("提交内容不正确，请检查后重试。"); },
  get browserContext() { return t("页面上下文已失效，请刷新页面后重试。"); },
  get unknownRegister() { return t("注册结果暂未确认，请返回登录并尝试使用刚提交的邮箱和密码。"); },
  get unknownReset() { return t("重置结果暂未确认，请返回登录并尝试使用新密码。"); },
  get retrySend() { return t("验证码发送失败，请重试。"); },
  get offline() { return t("网络连接不可用，请检查网络后重试。"); },
  get timeout() { return t("请求超时，请重试。"); },
  get network() { return t("网络连接中断，请重试。"); },
  get malformed() { return t("服务返回的内容无法识别，请重试。"); },
  get persistRetry() { return t("仍未能保存登录状态，请重试，或继续当前会话。"); },
  get expired() { return t("登录状态已过期，请重新登录。"); },
  get restoreFailed() { return t("暂时无法恢复登录状态，请重试或返回登录。"); },
  get bootFailed() { return t("暂时无法确认登录状态，请重试。"); },
  get browserBlocked() { return t("浏览器阻止了登录状态的保存，请允许本站使用 Cookie 后重试。"); },
  get resetDone() { return t("密码已重置，请用新密码登录。"); },
});

const FIELD_ALIASES = Object.freeze({
  email: 'email',
  nickname: 'name',
  password: 'password',
  challengeId: 'code',
  verificationCode: 'code',
  termsAccepted: 'agreed',
});

const CODE_TYPES = new Set([
  PROBLEM.VERIFICATION_CODE_INVALID_FORMAT,
  PROBLEM.VERIFICATION_CODE_MISSING,
  PROBLEM.VERIFICATION_CODE_BINDING_MISMATCH,
  PROBLEM.VERIFICATION_CODE_CONSUMED,
  PROBLEM.VERIFICATION_CODE_REPLACED,
  PROBLEM.VERIFICATION_CODE_EXPIRED,
  PROBLEM.VERIFICATION_CODE_INCORRECT,
  PROBLEM.VERIFICATION_CODE_EXHAUSTED,
]);

export function passwordLabel(operation) {
  return operation === 'password-reset' ? t("新密码") : t("密码");
}

export function codeMessage(type, remainingAttempts) {
  switch (type) {
    case PROBLEM.VERIFICATION_CODE_INVALID_FORMAT:
      return COPY.codeShape;
    case PROBLEM.VERIFICATION_CODE_REPLACED:
      return COPY.codeReplaced;
    case PROBLEM.VERIFICATION_CODE_CONSUMED:
      return COPY.codeConsumed;
    case PROBLEM.VERIFICATION_CODE_EXPIRED:
      return COPY.codeExpired;
    case PROBLEM.VERIFICATION_CODE_EXHAUSTED:
      return COPY.codeExhausted;
    case PROBLEM.VERIFICATION_CODE_INCORRECT:
      return COPY.codeIncorrect(remainingAttempts ?? 0);
    case PROBLEM.VERIFICATION_CODE_BINDING_MISMATCH:
      return COPY.codeMissing;
    default:
      return COPY.codeMissing;
  }
}

/*
 * Declared field problems become a field message; everything else belongs to
 * the request-level banner.
 */
export function fieldProblem(problem, operation) {
  const label = passwordLabel(operation);
  switch (problem.type) {
    case PROBLEM.EMAIL_EMPTY:
      return { field: 'email', message: COPY.emailEmpty };
    case PROBLEM.EMAIL_INVALID_FORMAT:
      return { field: 'email', message: COPY.emailInvalid };
    case PROBLEM.EMAIL_ALREADY_REGISTERED:
      return { field: 'email', message: COPY.emailOccupied };
    case PROBLEM.EMAIL_NOT_REGISTERED:
      return { field: 'email', message: COPY.emailUnknown };
    case PROBLEM.NICKNAME_EMPTY:
      return { field: 'name', message: COPY.nicknameEmpty };
    case PROBLEM.NICKNAME_TOO_LONG:
      return { field: 'name', message: COPY.nicknameTooLong };
    case PROBLEM.PASSWORD_TOO_SHORT:
      return { field: 'password', message: COPY.passwordTooShort(label) };
    case PROBLEM.PASSWORD_TOO_LONG:
      return { field: 'password', message: COPY.passwordTooLong(label) };
    case PROBLEM.TERMS_NOT_ACCEPTED:
      return { field: 'agreed', message: COPY.termsRequired };
    default:
      break;
  }
  if (CODE_TYPES.has(problem.type)) {
    return { field: 'code', message: codeMessage(problem.type, problem.remainingAttempts) };
  }
  if (
    problem.type === PROBLEM.REQUIRED_FIELD
    || problem.type === PROBLEM.INVALID_FIELD_TYPE
    || problem.type === PROBLEM.INVALID_FIELD_VALUE
  ) {
    const field = FIELD_ALIASES[problem.field];
    if (field) {
      if (field === 'code') return { field, message: COPY.codeMissing };
      const message = problem.type === PROBLEM.REQUIRED_FIELD
        ? COPY.fieldRequired
        : problem.type === PROBLEM.INVALID_FIELD_TYPE
          ? COPY.fieldType
          : COPY.fieldValue;
      return { field, message };
    }
  }
  return null;
}

export function bannerProblem(problem, operation) {
  switch (problem.type) {
    case PROBLEM.CREDENTIALS_REJECTED:
      return { message: COPY.credentialsRejected, tone: 'error', clearPassword: true };
    case PROBLEM.CODE_SEND_COOLDOWN:
      return { message: t("请 {{count}} 秒后再重新发送。", { count: problem.retryAfterSeconds ?? 1 }), tone: 'error' };
    case PROBLEM.CODE_DELIVERY_UNAVAILABLE:
      return { message: COPY.codeDelivery, tone: 'error' };
    case PROBLEM.REGISTRATION_CLOSED:
      return { message: COPY.registrationClosed, tone: 'error', closed: true };
    case PROBLEM.ACCOUNT_STORE_UNAVAILABLE:
    case PROBLEM.SESSION_STORE_UNAVAILABLE:
      return { message: COPY.storeRetry, tone: 'error' };
    case PROBLEM.SERVICE_UNAVAILABLE:
      return { message: COPY.serviceRetry, tone: 'error' };
    case PROBLEM.REQUEST_NOT_ALLOWED:
      return { message: COPY.requestRejected, tone: 'error' };
    case PROBLEM.MALFORMED_JSON:
    case PROBLEM.UNSUPPORTED_MEDIA_TYPE:
    case PROBLEM.INVALID_REQUEST_BODY:
    case PROBLEM.UNKNOWN_FIELD:
      return { message: COPY.bodyRejected, tone: 'error' };
    case PROBLEM.BROWSER_CONTEXT_REQUIRED:
      return { message: COPY.browserContext, tone: 'error' };
    case PROBLEM.SESSION_PERSISTENCE_UNAVAILABLE:
      return null;
    default:
      return { message: COPY.serviceRetry, tone: 'error' };
  }
}

export function unknownResultMessage(operation) {
  return operation === 'password-reset' ? COPY.unknownReset : COPY.unknownRegister;
}
