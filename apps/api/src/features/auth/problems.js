// Auth problem catalogue. One primary `type` per failure; `field` only for
// field-scoped problems. Titles are human hints, never UI copy.

const PROBLEM_DEFINITIONS = {
  requestNotAllowed: { status: 403, type: 'request-not-allowed', title: 'Request not allowed' },
  malformedJson: { status: 400, type: 'malformed-json', title: 'Malformed JSON body' },
  unsupportedMediaType: { status: 415, type: 'unsupported-media-type', title: 'Unsupported media type' },
  invalidRequestBody: { status: 422, type: 'invalid-request-body', title: 'Request body must be a JSON object' },
  unknownField: { status: 422, type: 'unknown-field', title: 'Request contains an undeclared field' },
  requiredField: { status: 422, type: 'required-field', title: 'A required field is missing' },
  invalidFieldType: { status: 422, type: 'invalid-field-type', title: 'A field has the wrong JSON type' },
  invalidFieldValue: { status: 422, type: 'invalid-field-value', title: 'A field value has the wrong shape' },
  emailEmpty: { status: 422, type: 'email-empty', title: 'Email is empty after normalization' },
  emailInvalidFormat: { status: 422, type: 'email-invalid-format', title: 'Email is not a canonical address' },
  nicknameEmpty: { status: 422, type: 'nickname-empty', title: 'Nickname is empty after trim' },
  nicknameTooLong: { status: 422, type: 'nickname-too-long', title: 'Nickname exceeds 40 code points' },
  passwordTooShort: { status: 422, type: 'password-too-short', title: 'Password is shorter than 8 code points' },
  passwordTooLong: { status: 422, type: 'password-too-long', title: 'Password exceeds 128 code points' },
  verificationCodeInvalidFormat: {
    status: 422,
    type: 'verification-code-invalid-format',
    title: 'Verification code must be six ASCII digits'
  },
  termsNotAccepted: { status: 422, type: 'terms-not-accepted', title: 'Terms must be accepted' },
  emailAlreadyRegistered: { status: 409, type: 'email-already-registered', title: 'Email is already registered' },
  emailNotRegistered: { status: 422, type: 'email-not-registered', title: 'Email is not registered' },
  credentialsRejected: { status: 401, type: 'credentials-rejected', title: 'Credentials rejected' },
  registrationClosed: { status: 403, type: 'registration-closed', title: 'Registration is closed' },
  verificationCodeMissing: {
    status: 422,
    type: 'verification-code-missing',
    title: 'Verification code challenge is missing or unknown'
  },
  verificationCodeBindingMismatch: {
    status: 422,
    type: 'verification-code-binding-mismatch',
    title: 'Verification code challenge is bound to another email or purpose'
  },
  verificationCodeConsumed: {
    status: 422,
    type: 'verification-code-consumed',
    title: 'Verification code challenge was already consumed'
  },
  verificationCodeReplaced: {
    status: 422,
    type: 'verification-code-replaced',
    title: 'Verification code challenge was replaced by a newer send'
  },
  verificationCodeExpired: { status: 422, type: 'verification-code-expired', title: 'Verification code expired' },
  verificationCodeIncorrect: {
    status: 422,
    type: 'verification-code-incorrect',
    title: 'Verification code is incorrect'
  },
  verificationCodeExhausted: {
    status: 422,
    type: 'verification-code-exhausted',
    title: 'Verification code attempts are exhausted'
  },
  codeSendCooldown: { status: 429, type: 'code-send-cooldown', title: 'Code send is cooling down' },
  codeDeliveryUnavailable: {
    status: 503,
    type: 'code-delivery-unavailable',
    title: 'Code delivery is unavailable'
  },
  accountStoreUnavailable: {
    status: 503,
    type: 'account-store-unavailable',
    title: 'Account store is unavailable'
  },
  sessionPersistenceUnavailable: {
    status: 503,
    type: 'session-persistence-unavailable',
    title: 'Remembered session could not be persisted'
  },
  sessionStoreUnavailable: {
    status: 503,
    type: 'session-store-unavailable',
    title: 'Session store is unavailable'
  },
  browserContextRequired: {
    status: 409,
    type: 'browser-context-required',
    title: 'Browser context is required'
  },
  sessionInvalid: { status: 401, type: 'session-invalid', title: 'Session is invalid' },
  sessionStateConflict: { status: 409, type: 'session-state-conflict', title: 'Session state conflicts' },
  serviceUnavailable: { status: 503, type: 'service-unavailable', title: 'Service is unavailable' }
};

export class AuthProblem extends Error {
  constructor(definition, options = {}) {
    super(definition.type);
    this.name = 'AuthProblem';
    this.status = definition.status;
    this.type = '/problems/auth/' + definition.type;
    this.title = definition.title;
    this.field = options.field;
    this.extra = options.extra;
  }

  toBody() {
    const body = { type: this.type, title: this.title, status: this.status };
    if (this.extra) {
      for (const [key, value] of Object.entries(this.extra)) {
        if (value !== undefined) body[key] = value;
      }
    }
    if (this.field !== undefined) body.field = this.field;
    return body;
  }
}

export function authProblem(name, options = {}) {
  const definition = PROBLEM_DEFINITIONS[name];
  if (!definition) throw new Error('Unknown auth problem: ' + name);
  return new AuthProblem(definition, options);
}

export function isAuthProblem(error) {
  return error instanceof AuthProblem;
}
