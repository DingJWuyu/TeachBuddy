/*
 * Browser-local account fixtures and the observable authentication behavior
 * used by this prototype. The data is deliberately small, but account, code,
 * reset and session lifetimes follow the same rules as the entry experience.
 */

export const DEMO_PASSWORD = 'teachbuddy';
export const REGISTERED_EMAIL = 'example@example.com';
export const REGISTERED_NAME = '林老师';
export const VERIFICATION_CODE = '309614';
export const RECOVERY_CODE = '841207';
export const SUPPORT_EMAIL = 'example@example.com';

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_RESEND_COOLDOWN_MS = 30 * 1000;
export const CODE_MAX_ATTEMPTS = 5;

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_KEY = 'teachbuddy-prototype-session';
export const RESET_KEY = 'teachbuddy-prototype-resets';
export const ACCOUNT_KEY = 'teachbuddy-prototype-accounts';

export const REQUEST_LATENCY_MS = 450;

const FAILURE_MESSAGES = {
  offline: '网络连接不可用，请检查网络后重试。',
  server: '服务暂时不可用，请稍后重试。',
  timeout: '请求超时，请重试。'
};

let failureMode = 'normal';
let resendCooldownMs = CODE_RESEND_COOLDOWN_MS;
let sessionTtlMs = SESSION_TTL_MS;
let codeTtlMs = CODE_TTL_MS;

export function setResendCooldown(ms) {
  const value = Number(ms);
  resendCooldownMs = Number.isFinite(value) && value >= 0 ? value : CODE_RESEND_COOLDOWN_MS;
}

export function currentResendCooldown() {
  return resendCooldownMs;
}

export function setSessionTtl(ms) {
  const value = Number(ms);
  sessionTtlMs = Number.isFinite(value) && value >= 0 ? value : SESSION_TTL_MS;
}

export function setCodeTtl(ms) {
  const value = Number(ms);
  codeTtlMs = Number.isFinite(value) && value >= 0 ? value : CODE_TTL_MS;
}

export function setFailureMode(mode) {
  failureMode = Object.hasOwn(FAILURE_MESSAGES, mode) ? mode : 'normal';
}

export async function request(kind, run) {
  await wait(REQUEST_LATENCY_MS);
  if (failureMode !== 'normal') {
    const failure = new Error(FAILURE_MESSAGES[failureMode]);
    failure.kind = failureMode;
    failure.request = kind;
    throw failure;
  }
  return run();
}

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function safeStorage(name) {
  try {
    return globalThis[name] ?? null;
  } catch {
    return null;
  }
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function codePointLength(value) {
  return Array.from(String(value ?? '')).length;
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function emailLength(value) {
  return normalizeEmail(value).length;
}

export function isEmail(value) {
  const address = normalizeEmail(value);
  if (!address || address.length > 254 || /[^\x00-\x7f]/.test(address)) return false;
  if (address.split('@').length !== 2) return false;
  const [local, domain] = address.split('@');
  if (local.length < 1 || local.length > 64 || !/^[a-z0-9._%+-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => (
    label.length < 1 || label.length > 63 || !/^[a-z0-9-]+$/.test(label)
    || label.startsWith('-') || label.endsWith('-')
  ))) return false;
  return true;
}

function accountRecord(value) {
  if (!value || typeof value !== 'object') return null;
  const email = normalizeEmail(value.email);
  if (!isEmail(email) || typeof value.password !== 'string' || typeof value.name !== 'string') return null;
  if (codePointLength(value.name) < 1 || codePointLength(value.name) > 40) return null;
  if (codePointLength(value.password) < 8 || codePointLength(value.password) > 128) return null;
  return { email, password: value.password, name: value.name };
}

function defaultAccounts() {
  return [{ email: REGISTERED_EMAIL, password: DEMO_PASSWORD, name: REGISTERED_NAME }];
}

function readAccounts() {
  const storage = safeStorage('localStorage');
  let raw;
  try {
    raw = storage?.getItem(ACCOUNT_KEY);
  } catch {
    return { records: [], error: 'unavailable' };
  }
  if (raw === null || raw === undefined) return { records: defaultAccounts(), error: null };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { records: [], error: 'corrupt' };
  }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.accounts)) {
    return { records: [], error: 'corrupt' };
  }
  if (!parsed.accounts.length) return { records: [], error: 'corrupt' };
  const records = parsed.accounts.map(accountRecord);
  if (records.some((record) => !record)) return { records: [], error: 'corrupt' };
  const emails = new Set(records.map((record) => record.email));
  if (emails.size !== records.length) return { records: [], error: 'corrupt' };
  return { records, error: null };
}

function writeAccounts(accounts) {
  try {
    const storage = safeStorage('localStorage');
    if (!storage) return false;
    storage.setItem(ACCOUNT_KEY, JSON.stringify({
      version: 1,
      accounts: [...accounts.values()]
    }));
    return true;
  } catch {
    /* Account persistence is best effort when storage is unavailable. */
    return false;
  }
}

export function readResetTimes() {
  const parsed = readJson(safeStorage('localStorage'), RESET_KEY, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export function writeResetTimes(times) {
  try {
    safeStorage('localStorage')?.setItem(RESET_KEY, JSON.stringify(times));
  } catch {
    /* A reset still covers this page when storage is unavailable. */
  }
}

function removeSession(storage) {
  try {
    storage?.removeItem(SESSION_KEY);
  } catch {
    /* Storage can be unavailable or read-only. */
  }
}

export function clearStoredSession() {
  removeSession(safeStorage('localStorage'));
  removeSession(safeStorage('sessionStorage'));
}

export function clearStoredSessionFor(email, sessionId) {
  const address = normalizeEmail(email);
  for (const storage of [safeStorage('localStorage'), safeStorage('sessionStorage')]) {
    if (!storage) continue;
    try {
      const raw = storage.getItem(SESSION_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && normalizeEmail(saved.email) === address && (!sessionId || saved.sessionId === sessionId)) {
        storage.removeItem(SESSION_KEY);
      }
    } catch {
      /* Invalid storage is removed only by an explicit global cleanup. */
    }
  }
}

function readSessionFrom(storage, now) {
  if (!storage) return { session: null, reason: 'none' };
  let saved;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return { session: null, reason: 'none' };
    saved = JSON.parse(raw);
  } catch {
    removeSession(storage);
    return { session: null, reason: 'invalid' };
  }
  if (!saved || typeof saved.email !== 'string' || !saved.email.trim()
    || typeof saved.issuedAt !== 'number' || typeof saved.expiresAt !== 'number'
    || saved.remember !== true || saved.expiresAt <= now) {
    removeSession(storage);
    return { session: null, reason: saved?.expiresAt <= now ? 'expired' : 'invalid' };
  }
  return { session: saved, reason: 'found' };
}

export function readStoredSessionStatus(now = Date.now()) {
  const local = readSessionFrom(safeStorage('localStorage'), now);
  if (local.session || local.reason !== 'none') return local;
  const session = readSessionFrom(safeStorage('sessionStorage'), now);
  if (session.session || session.reason !== 'none') return session;
  return { session: null, reason: 'none' };
}

export function readStoredSession(now = Date.now()) {
  return readStoredSessionStatus(now).session;
}

const DEMO_CODES = new Map([
  [`register:${REGISTERED_EMAIL}`, VERIFICATION_CODE],
  [`recovery:${REGISTERED_EMAIL}`, RECOVERY_CODE],
  [`register:new@example.com`, VERIFICATION_CODE]
]);

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codeKey(purpose, email) {
  return `${purpose}:${normalizeEmail(email)}`;
}

export class PrototypeAuth {
  #accounts = new Map();

  #accountStoreError = null;

  #codes = new Map();

  #sessions = new Map();

  #resetAt = new Map(Object.entries(readResetTimes()));

  #registrationOpen = true;

  constructor() {
    this.#refreshAccounts();
  }

  #refreshAccounts() {
    const state = readAccounts();
    this.#accountStoreError = state.error;
    this.#accounts = state.error
      ? new Map()
      : new Map(state.records.map((record) => [record.email, record]));
    return !state.error;
  }

  isAccountStoreAvailable() {
    return this.#refreshAccounts();
  }

  setRegistrationOpen(open) {
    this.#registrationOpen = Boolean(open);
  }

  isRegistrationOpen() {
    return this.#registrationOpen;
  }

  #account(email) {
    return this.#accounts.get(normalizeEmail(email));
  }

  isRegistered(email) {
    this.#refreshAccounts();
    return Boolean(this.#account(email));
  }

  nameFor(email) {
    this.#refreshAccounts();
    return this.#account(email)?.name || REGISTERED_NAME;
  }

  async sendCode({ email, purpose, force = false, code }) {
    if (!this.#refreshAccounts()) {
      const failure = new Error('暂时无法完成，请重试。');
      failure.kind = 'storage-unavailable';
      throw failure;
    }
    const address = normalizeEmail(email);
    const key = codeKey(purpose, address);
    if (purpose === 'register' && !this.#registrationOpen) {
      const failure = new Error('注册暂时关闭，请返回登录。');
      failure.kind = 'registration-closed';
      throw failure;
    }
    if (purpose === 'register' && this.isRegistered(address)) {
      const failure = new Error('这个邮箱已经注册过了，直接登录，或换一个邮箱。');
      failure.kind = 'occupied';
      throw failure;
    }
    if (purpose === 'recovery' && !this.isRegistered(address)) {
      const failure = new Error('这个邮箱没有可找回的账户。');
      failure.kind = 'unknown-account';
      throw failure;
    }

    const record = this.#codes.get(key);
    const now = Date.now();
    const cooldown = currentResendCooldown();
    if (!force && record && now - record.sentAt < cooldown) {
      const failure = new Error('请稍后再重新发送。');
      failure.kind = 'cooldown';
      failure.retryAfter = Math.ceil((cooldown - (now - record.sentAt)) / 1000);
      throw failure;
    }

    const demoCode = DEMO_CODES.get(key);
    const value = String(code || demoCode || makeCode());
    const challenge = {
      id: `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      value,
      purpose,
      email: address,
      sentAt: now,
      expiresAt: now + codeTtlMs,
      attempts: 0,
      used: false,
      exhausted: false
    };
    this.#codes.set(key, challenge);
    return {
      challengeId: challenge.id,
      email: address,
      expiresAt: challenge.expiresAt,
      resendAt: now + cooldown,
      cooldownMs: cooldown
    };
  }

  codeState({ email, purpose, challengeId }) {
    const record = this.#codes.get(codeKey(purpose, email));
    if (!record || (challengeId && challengeId !== record.id)) return { state: 'missing' };
    if (record.exhausted) return { state: 'exhausted', record };
    if (record.used) return { state: 'used', record };
    if (Date.now() >= record.expiresAt) return { state: 'expired', record };
    return { state: 'active', record };
  }

  verifyCode({ email, purpose, code, challengeId, consume = true }) {
    const record = this.#codes.get(codeKey(purpose, email));
    if (!record || (challengeId && challengeId !== record.id)) return { ok: false, kind: 'missing' };
    if (record.exhausted) return { ok: false, kind: 'exhausted' };
    if (record.used) return { ok: false, kind: 'used' };
    if (Date.now() >= record.expiresAt) return { ok: false, kind: 'expired' };
    if (!/^[0-9]{6}$/.test(String(code)) || String(code) !== record.value) {
      record.attempts += 1;
      if (record.attempts >= CODE_MAX_ATTEMPTS) {
        record.exhausted = true;
        return { ok: false, kind: 'exhausted' };
      }
      return { ok: false, kind: 'mismatch', remaining: CODE_MAX_ATTEMPTS - record.attempts };
    }
    if (consume) record.used = true;
    return { ok: true, record };
  }

  register({ name, email, password, code, challengeId, remember = true }) {
    if (!this.#refreshAccounts()) return { ok: false, kind: 'storage-unavailable' };
    if (!this.#registrationOpen) return { ok: false, kind: 'registration-closed' };
    const address = normalizeEmail(email);
    if (this.isRegistered(address)) return { ok: false, kind: 'occupied' };
    const verdict = this.verifyCode({ email: address, purpose: 'register', code, challengeId, consume: false });
    if (!verdict.ok) return verdict;
    const record = { email: address, password, name };
    const nextAccounts = new Map(this.#accounts).set(address, record);
    if (!writeAccounts(nextAccounts)) return { ok: false, kind: 'storage-unavailable' };
    this.#accounts = nextAccounts;
    const consumed = this.verifyCode({ email: address, purpose: 'register', code, challengeId, consume: true });
    if (!consumed.ok) return consumed;
    return {
      ok: true,
      user: { name: record.name, email: record.email },
      session: this.#issueSession(address, remember)
    };
  }

  async signIn({ email, password, remember }) {
    if (!this.#refreshAccounts()) {
      const failure = new Error('暂时无法完成，请重试。');
      failure.kind = 'storage-unavailable';
      throw failure;
    }
    const address = normalizeEmail(email);
    const account = this.#account(address);
    if (!account || account.password !== password) {
      const failure = new Error('邮箱或密码不正确，请重试。');
      failure.kind = 'invalid-credentials';
      throw failure;
    }
    return {
      ok: true,
      user: { name: account.name, email: address },
      session: this.#issueSession(address, remember)
    };
  }

  #issueSession(email, remember) {
    const now = Date.now();
    const session = {
      id: `session-${now}-${this.#sessions.size + 1}`,
      email: normalizeEmail(email),
      remember: Boolean(remember),
      issuedAt: now,
      expiresAt: remember ? now + sessionTtlMs : 0
    };
    this.#sessions.set(session.id, session);
    return session;
  }

  sessionUser(session) {
    if (!session) return null;
    return {
      name: this.nameFor(session.email),
      email: normalizeEmail(session.email),
      sessionId: session.id,
      remember: Boolean(session.remember)
    };
  }

  persistSession(session) {
    if (!session?.remember) {
      clearStoredSessionFor(session?.email);
      return true;
    }
    try {
      const storage = safeStorage('localStorage');
      if (!storage) return false;
      const payload = JSON.stringify({
        email: normalizeEmail(session.email),
        sessionId: session.id,
        remember: true,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt
      });
      storage.setItem(SESSION_KEY, payload);
      if (storage.getItem(SESSION_KEY) !== payload) return false;
      removeSession(safeStorage('sessionStorage'));
      return true;
    } catch {
      /* The session remains in memory when local storage is unavailable. */
      return false;
    }
  }

  isSessionValid(session, now = Date.now()) {
    if (!this.#refreshAccounts()) return false;
    if (!session?.email || !this.isRegistered(session.email)) return false;
    if (session.remember && (!session.expiresAt || session.expiresAt <= now)) return false;
    const address = normalizeEmail(session.email);
    const resetAt = Math.max(
      Number(this.#resetAt.get(address)) || 0,
      Number(readResetTimes()[address]) || 0
    );
    return !(resetAt && (session.issuedAt ?? 0) < resetAt);
  }

  restoreSession(saved) {
    this.#refreshAccounts();
    if (!this.isSessionValid(saved)) return null;
    const session = {
      id: saved.sessionId || `restored-${Date.now()}`,
      email: normalizeEmail(saved.email),
      remember: true,
      issuedAt: saved.issuedAt,
      expiresAt: saved.expiresAt
    };
    this.#sessions.set(session.id, session);
    return session;
  }

  endSession(session) {
    if (session?.id) this.#sessions.delete(session.id);
    clearStoredSessionFor(session?.email, session?.id);
  }

  endSessionsFor(email) {
    const address = normalizeEmail(email);
    for (const [id, session] of this.#sessions) {
      if (session.email === address) this.#sessions.delete(id);
    }
    clearStoredSessionFor(address);
  }

  async resetPassword({ email, code, challengeId, password }) {
    if (!this.#refreshAccounts()) return { ok: false, kind: 'storage-unavailable' };
    const address = normalizeEmail(email);
    if (!this.isRegistered(address)) return { ok: false, kind: 'unknown-account' };
    const verdict = this.verifyCode({ email: address, purpose: 'recovery', code, challengeId, consume: false });
    if (!verdict.ok) return verdict;
    const account = this.#account(address);
    const resetAt = Date.now();
    const nextAccounts = new Map(this.#accounts).set(address, { ...account, password });
    const storage = safeStorage('localStorage');
    const previousAccounts = storage?.getItem(ACCOUNT_KEY) ?? null;
    const previousResets = storage?.getItem(RESET_KEY) ?? null;
    try {
      if (!storage) return { ok: false, kind: 'storage-unavailable' };
      storage.setItem(ACCOUNT_KEY, JSON.stringify({ version: 1, accounts: [...nextAccounts.values()] }));
      storage.setItem(RESET_KEY, JSON.stringify({ ...readResetTimes(), [address]: resetAt }));
      if (storage.getItem(ACCOUNT_KEY) === null || storage.getItem(RESET_KEY) === null) {
        throw new Error('storage write failed');
      }
    } catch {
      try {
        if (previousAccounts === null) storage?.removeItem(ACCOUNT_KEY);
        else storage?.setItem(ACCOUNT_KEY, previousAccounts);
        if (previousResets === null) storage?.removeItem(RESET_KEY);
        else storage?.setItem(RESET_KEY, previousResets);
      } catch {
        /* The original values are best effort when storage is unavailable. */
      }
      return { ok: false, kind: 'storage-unavailable' };
    }
    this.#accounts = nextAccounts;
    this.#resetAt.set(address, resetAt);
    const consumed = this.verifyCode({ email: address, purpose: 'recovery', code, challengeId, consume: true });
    if (!consumed.ok) return consumed;
    this.endSessionsFor(address);
    return { ok: true };
  }
}
