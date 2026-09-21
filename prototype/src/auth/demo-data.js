/*
 * In-memory prototype fixtures plus the behavior the account entry needs for its
 * failure and recovery paths.
 *
 * Everything here is session data. The happy-path fixtures keep their original
 * values so the accepted scenarios stay reproducible; what is new is that
 * credentials are now compared, codes have a lifecycle, and the session layer
 * models waiting, transient failures and expiry.
 */

/* Account that exists before any registration happens in the session. */
export const DEMO_PASSWORD = 'teachbuddy';

export const REGISTERED_EMAIL = 'example@example.com';

export const VERIFICATION_CODE = '309614';

export const RECOVERY_CODE = '841207';

export const SUPPORT_EMAIL = 'example@example.com';

/* Code lifecycle. Timings are prototype values; behavior.md separates the ones
 * measured against a real product from the ones still awaiting a decision. */
export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_RESEND_COOLDOWN_MS = 30 * 1000;
export const CODE_MAX_ATTEMPTS = 5;

/* Session lifecycle. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_KEY = 'teachbuddy-prototype-session';

/* When each account last changed its password. Kept beside the session so a
 * reset also retires sessions held on other devices, which never share this
 * instance's memory. */
export const RESET_KEY = 'teachbuddy-prototype-resets';

/*
 * Injected transport conditions. The account entry cannot reach a real network,
 * so verification scripts select a failure here; every simulated request
 * passes through the same gate. This has no visible control in the prototype.
 */
export const REQUEST_LATENCY_MS = 450;

const FAILURE_MESSAGES = {
  offline: '网络连接不可用，请检查网络后重试。',
  server: '服务暂时不可用，请稍后重试。',
  timeout: '请求超时，请重试。'
};

/* Selected by verification scripts, never read from storage. */
let failureMode = 'normal';

/* Resend cooldown for this page load. A check run can shorten it so the wait
 * does not dominate the run; the product default stands otherwise. */
let resendCooldownMs = CODE_RESEND_COOLDOWN_MS;

export function setResendCooldown(ms) {
  const value = Number(ms);
  resendCooldownMs = Number.isFinite(value) && value >= 0 ? value : CODE_RESEND_COOLDOWN_MS;
}

export function currentResendCooldown() {
  return resendCooldownMs;
}

export function setFailureMode(mode) {
  failureMode = Object.hasOwn(FAILURE_MESSAGES, mode) ? mode : 'normal';
}

/* The one gate every simulated request passes through. */
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

/* Reads the persisted session outside React, so a page load can restore before
 * the first paint. A value survives a reload only when the user asked to be
 * remembered; a closed browser or another device starts empty. */
export function readStoredSession(now = Date.now()) {
  for (const storage of [safeStorage('localStorage'), safeStorage('sessionStorage')]) {
    if (!storage) continue;
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (!raw) continue;
      const saved = JSON.parse(raw);
      if (!saved?.email || !saved?.expiresAt || saved.expiresAt <= now) {
        storage.removeItem(SESSION_KEY);
        continue;
      }
      return saved;
    } catch {
      /* unreadable payload: treat as no session */
    }
  }
  return null;
}

export function readResetTimes() {
  try {
    return JSON.parse(safeStorage('localStorage')?.getItem(RESET_KEY) || '{}');
  } catch {
    return {};
  }
}

export function writeResetTimes(times) {
  try {
    safeStorage('localStorage')?.setItem(RESET_KEY, JSON.stringify(times));
  } catch {
    /* storage unavailable: the reset covers this browser only */
  }
}

export function clearStoredSession() {
  for (const storage of [safeStorage('localStorage'), safeStorage('sessionStorage')]) {
    try {
      storage?.removeItem(SESSION_KEY);
    } catch {
      /* nothing to clear */
    }
  }
}

const DEMO_CODES = new Map([
  [`register:${REGISTERED_EMAIL}`, VERIFICATION_CODE],
  [`recovery:${REGISTERED_EMAIL}`, RECOVERY_CODE],
  [`register:new@example.com`, VERIFICATION_CODE]
]);

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class PrototypeAuth {

  #passwords = new Map([[REGISTERED_EMAIL, DEMO_PASSWORD]]);

  #names = new Map();

  #codes = new Map();

  #sessions = new Map();

  /* When each account last changed its password. A session issued before this
   * moment no longer restores, whichever device holds it. */
  #resetAt = new Map();

  #address(email) {
    return String(email).trim().toLowerCase();
  }

  isRegistered(email) {
    return this.#passwords.has(this.#address(email));
  }

  nameFor(email) {
    const address = this.#address(email);
    /* A registered nickname wins; the email-derived name is only the fallback
     * for an account that was never given one in this session. */
    if (this.#names.has(address)) return this.#names.get(address);
    const local = address.split('@')[0] || '老师';
    return `${local}老师`;
  }

  /*
   * Sends a verification code. The value is fixed for the demo accounts so the
   * happy path stays reproducible and random elsewhere; the lifecycle around it
   * (cooldown, expiry, attempts, single use) is the same for both.
   */
  async sendCode({ email, purpose, force = false, code }) {
    const address = this.#address(email);
    const key = `${purpose}:${address}`;
    const record = this.#codes.get(key);
    const now = Date.now();

    if (!force && record && now - record.sentAt < CODE_RESEND_COOLDOWN_MS) {
      const failure = new Error('请稍后再重新发送。');
      failure.kind = 'cooldown';
      failure.retryAfter = Math.ceil((CODE_RESEND_COOLDOWN_MS - (now - record.sentAt)) / 1000);
      throw failure;
    }

    /* The documented demo codes stay valid for the demo addresses, so the
     * accepted scenarios keep working; every other address gets a generated
     * code the way a real service would. */
    const demoCode = DEMO_CODES.get(`${purpose}:${address}`);
    const value = code || demoCode || makeCode();

    this.#codes.set(key, {
      value,
      purpose,
      email: address,
      sentAt: now,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      used: false
    });
    return {
      email: address,
      expiresAt: now + CODE_TTL_MS,
      resendAt: now + resendCooldownMs,
      cooldownMs: resendCooldownMs
    };
  }

  /* Lifecycle state of one address' current code, without changing it. */
  codeState({ email, purpose }) {
    const record = this.#codes.get(`${purpose}:${this.#address(email)}`);
    if (!record) return { state: 'missing' };
    if (record.used) return { state: 'used', record };
    if (Date.now() >= record.expiresAt) return { state: 'expired', record };
    return { state: 'active', record };
  }

  /*
   * Verifies a code and consumes it on success. A wrong entry burns one of the
   * limited attempts; running out retires the code, so the address needs a new
   * one. Returns a kind instead of a message so the entry owns every wording.
   */
  verifyCode({ email, purpose, code, consume = true }) {
    const record = this.#codes.get(`${purpose}:${this.#address(email)}`);
    if (!record) return { ok: false, kind: 'missing' };
    if (record.used) return { ok: false, kind: 'used' };
    if (Date.now() >= record.expiresAt) return { ok: false, kind: 'expired' };

    if (String(code) !== record.value) {
      record.attempts += 1;
      if (record.attempts >= CODE_MAX_ATTEMPTS) {
        record.used = true;
        return { ok: false, kind: 'exhausted' };
      }
      return { ok: false, kind: 'mismatch', remaining: CODE_MAX_ATTEMPTS - record.attempts };
    }

    if (consume) record.used = true;
    return { ok: true, record };
  }

  register({ name, email, password, remember = true }) {
    const address = this.#address(email);
    if (this.isRegistered(address)) {
      throw new Error('这个邮箱已经注册过了，直接登录，或换一个邮箱。');
    }
    this.#passwords.set(address, password);
    this.#names.set(address, name);
    /* Registering signs the account in, so it returns the same shape a sign-in
     * does: the identity plus the session the session layer should keep. */
    return {
      user: { name, email: address },
      session: this.#issueSession(address, remember)
    };
  }

  async signIn({ email, password, remember }) {
    const address = this.#address(email);
    if (!this.#passwords.has(address) || this.#passwords.get(address) !== password) {
      /* One reply for a wrong password and for an address with no account;
       * saying which half was wrong would reveal whether an address is in use. */
      const failure = new Error('邮箱或密码不正确，请重试。');
      failure.kind = 'invalid-credentials';
      throw failure;
    }
    return {
      user: { name: this.nameFor(address), email: address },
      session: this.#issueSession(address, remember)
    };
  }

  #issueSession(email, remember) {
    const session = {
      id: `session-${this.#sessions.size + 1}`,
      email,
      remember: !!remember,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (remember ? SESSION_TTL_MS : 0)
    };
    this.#sessions.set(session.id, session);
    return session;
  }

  /* Identity handed to the workbench after a sign-in or a restore. */
  sessionUser(session) {
    if (!session) return null;
    return {
      name: this.nameFor(session.email),
      email: session.email,
      sessionId: session.id,
      remember: session.remember
    };
  }

  persistSession(session) {
    const storage = safeStorage(session.remember ? 'localStorage' : 'sessionStorage');
    try {
      storage?.setItem(SESSION_KEY, JSON.stringify({
        email: session.email,
        sessionId: session.id,
        remember: session.remember,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt
      }));
    } catch {
      /* storage unavailable: the session stays in memory only */
    }
  }

  /* Drops the session the user signed out of. Other sessions of the same account
   * are left alone: signing out is not a global action. */
  endSession(session) {
    if (session?.id) this.#sessions.delete(session.id);
    clearStoredSession();
  }

  /* Every session an account had open; used when its password changes. */
  endSessionsFor(email) {
    const address = this.#address(email);
    for (const [id, session] of this.#sessions) {
      if (session.email === address) this.#sessions.delete(id);
    }
    clearStoredSession();
  }

  /*
   * Called when a page load finds a saved session. A session issued before the
   * account last reset its password is refused, so a reset ends the account's
   * sessions everywhere and not only in the browser that performed it.
   */
  restoreSession(saved) {
    if (!saved?.email || !this.#passwords.has(this.#address(saved.email))) return null;
    const address = this.#address(saved.email);
    const resetAt = this.#resetAt.get(address) ?? readResetTimes()[address];
    if (resetAt && (saved.issuedAt ?? 0) < resetAt) return null;
    const session = {
      id: saved.sessionId || `restored-${Date.now()}`,
      email: address,
      remember: !!saved.remember,
      issuedAt: saved.issuedAt || Date.now(),
      expiresAt: saved.expiresAt || 0
    };
    this.#sessions.set(session.id, session);
    return session;
  }

  /*
   * Resets the password behind an account. The reset signs the account out
   * everywhere: the old password stops working on any device, and every session
   * it was holding is retired.
   */
  async resetPassword({ email, code, password }) {
    const address = this.#address(email);
    if (!this.#passwords.has(address)) {
      return { ok: false, kind: 'unknown-account' };
    }
    const verdict = this.verifyCode({ email: address, purpose: 'recovery', code });
    if (!verdict.ok) return verdict;
    this.#passwords.set(address, password);
    const resetAt = Date.now();
    this.#resetAt.set(address, resetAt);
    writeResetTimes({ ...readResetTimes(), [address]: resetAt });
    this.endSessionsFor(address);
    return { ok: true };
  }
}
