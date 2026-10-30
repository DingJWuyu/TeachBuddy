// Operation layer for the account-entry, session and logout routes and the
// workbench principal seam.
//
// Every mutation that the contract marks atomic runs inside one SQLite
// transaction (better-sqlite3 `db.transaction`). Reads and in-memory work
// happen before the transaction so a committed result is never reported with a
// rolled-back failure. Domain problems raised inside a transaction roll it back
// and travel unchanged; driver failures are mapped per operation.

import { authProblem, isAuthProblem } from './problems.js';
import {
  dummyPasswordHash,
  generateVerificationCode,
  hashPassword,
  hashVerificationCode,
  randomOpaqueId,
  verifyPassword,
  verifyVerificationCode
} from './passwords.js';
import {
  OPAQUE_ID_PATTERN,
  PAGE_CONTEXT_PATTERN,
  readChallengeIdField,
  readClosedObject,
  readEmailField,
  readLogoutSessionId,
  readNicknameField,
  readPasswordField,
  readSessionCommand,
  readVerificationCodeField,
  REQUEST_SCHEMAS
} from './validation.js';
import {
  REMEMBERED_SESSION_MS,
  clearedSessionCookie,
  hashSessionToken,
  persistentSessionCookie,
  readPageContext,
  readSessionCookie,
  sessionCookie
} from './protocol.js';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

export function createAuthOperations({ db, store, now, sendCode, isRegistrationOpen, codeSecret }) {
  const sendLocks = new Map();
  const inTransaction = db.transaction((task) => task());

  function clock() {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new Error('Auth clock returned an invalid time');
    return value;
  }

  function iso(milliseconds) {
    return new Date(milliseconds).toISOString();
  }

  // Maps driver/storage failures onto the operation-specific problem while
  // letting domain problems pass through untouched. The fallback problem is
  // resolved first so a bad problem name fails loudly instead of masking the
  // original storage failure.
  function storage(problemName, task) {
    const fallback = authProblem(problemName);
    try {
      return task();
    } catch (error) {
      if (isAuthProblem(error)) throw error;
      throw fallback;
    }
  }

  function commit(task) {
    return inTransaction(task);
  }

  function registrationOpen() {
    try {
      return isRegistrationOpen() === true;
    } catch {
      throw authProblem('serviceUnavailable');
    }
  }

  function assertAccountDataComplete(account) {
    if (typeof account.nickname !== 'string' || account.nickname.length === 0) {
      // A migrated nickname gap is a real data defect: report storage trouble
      // instead of rendering an invalid Account or deriving one from the email.
      throw authProblem('accountStoreUnavailable');
    }
  }

  function accountView(account) {
    assertAccountDataComplete(account);
    return { accountKey: account.accountKey, email: account.email, nickname: account.nickname };
  }

  function sessionView(session, account) {
    return {
      id: session.id,
      account: accountView(account),
      state: session.state,
      persistence: session.persistence,
      rememberRequested: Boolean(session.rememberRequested),
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt ?? null
    };
  }

  function isExpired(session, atMs) {
    return session.expiresAt !== null && session.expiresAt !== undefined && atMs >= Date.parse(session.expiresAt);
  }

  // Single source of truth for what a session may authorize. Callers map the
  // outcome to their own response shape (503 / 401 / anonymous).
  function sessionAuthorization(session, account, atMs) {
    if (!account) return 'missing-account';
    if (store.isAccountDeleting(account.id)) return 'invalid';
    if (session.revokedAt || isExpired(session, atMs)) return 'invalid';
    if (account.passwordVersion !== session.passwordVersion) return 'stale';
    return 'live';
  }

  function resolveContainer(request) {
    const token = readSessionCookie(request);
    if (token === undefined) return { state: 'absent' };
    if (!OPAQUE_ID_PATTERN.test(token)) return { state: 'invalid' };
    const container = store.getContainer(hashSessionToken(token));
    if (!container) return { state: 'invalid' };
    return { state: 'valid', container, token };
  }

  function requireBrowserContainer(request, problemName) {
    const state = storage(problemName, () => resolveContainer(request));
    if (state.state !== 'valid') throw authProblem('browserContextRequired');
    return state.container;
  }

  function createPendingSession(container, pageId, account, rememberMe, atMs) {
    const timestamp = iso(atMs);
    const session = store.insertSession({
      id: randomOpaqueId('ses'),
      containerId: container.id,
      accountId: account.id,
      state: 'pending',
      persistence: 'page',
      rememberRequested: rememberMe ? 1 : 0,
      passwordVersion: account.passwordVersion,
      issuedAt: timestamp,
      expiresAt: rememberMe ? iso(atMs + REMEMBERED_SESSION_MS) : null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    // The page that submitted the credential owns the pending session, so a
    // later GET can report it (save-failure card) and logout can revoke the same target.
    store.upsertPageBinding(container.id, pageId, session.id, timestamp);
    return session;
  }

  function withKeyLock(key, task) {
    const previous = sendLocks.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    const settled = run.then(
      () => undefined,
      () => undefined
    );
    sendLocks.set(key, settled);
    settled.then(() => {
      if (sendLocks.get(key) === settled) sendLocks.delete(key);
    });
    return run;
  }

  function cooldownProblem(challenge, atMs) {
    const remainingMs = Math.max(1, Date.parse(challenge.resendAt) - atMs);
    const retryAfterSeconds = Math.max(1, Math.min(30, Math.ceil(remainingMs / 1000)));
    return authProblem('codeSendCooldown', {
      extra: { retryAfterSeconds, resendAt: challenge.resendAt }
    });
  }

  function challengeView(challenge, atMs) {
    return {
      challengeId: challenge.id,
      purpose: challenge.purpose,
      email: challenge.email,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      resendAt: challenge.resendAt,
      serverTime: iso(atMs),
      remainingAttempts: challenge.remainingAttempts
    };
  }

  function exhaustedProblem() {
    return authProblem('verificationCodeExhausted', {
      field: 'verificationCode',
      extra: { remainingAttempts: 0 }
    });
  }

  // Binding/lifecycle/value order is fixed by the contract. A wrong value
  // persists its budget decrement; a write failure never claims the decrement.
  function verifyChallenge({ challengeId, purpose, email, code, problemName }) {
    const challenge = storage(problemName, () => store.getChallenge(challengeId));
    if (!challenge) throw authProblem('verificationCodeMissing', { field: 'verificationCode' });
    if (challenge.purpose !== purpose || challenge.email !== email) {
      throw authProblem('verificationCodeBindingMismatch', { field: 'verificationCode' });
    }
    if (challenge.consumedAt) throw authProblem('verificationCodeConsumed', { field: 'verificationCode' });
    if (challenge.replacedAt) throw authProblem('verificationCodeReplaced', { field: 'verificationCode' });

    const atMs = clock();
    if (atMs >= Date.parse(challenge.expiresAt)) {
      throw authProblem('verificationCodeExpired', { field: 'verificationCode' });
    }
    if (challenge.remainingAttempts <= 0) throw exhaustedProblem();

    if (!verifyVerificationCode(code, challenge.codeDigest, codeSecret)) {
      const updated = storage(problemName, () => commit(() => store.decrementChallengeAttempt(challengeId, iso(clock()))));
      if (!updated) throw authProblem('verificationCodeMissing', { field: 'verificationCode' });
      if (updated.remainingAttempts <= 0) throw exhaustedProblem();
      throw authProblem('verificationCodeIncorrect', {
        field: 'verificationCode',
        extra: { remainingAttempts: updated.remainingAttempts }
      });
    }
    return challenge;
  }

  async function issueChallenge(purpose, email, requireOpen, accountId = null) {
    return withKeyLock(purpose + ':' + email, async () => {
      const requestedAtMs = clock();
      const latest = storage('accountStoreUnavailable', () => store.getLatestChallenge(purpose, email));
      if (latest && requestedAtMs < Date.parse(latest.resendAt)) throw cooldownProblem(latest, requestedAtMs);
      if (requireOpen && !registrationOpen()) throw authProblem('registrationClosed');

      const code = generateVerificationCode();
      // Delivery stays outside SQLite: a failure only promises the old challenge is untouched, not that no mail arrived.
      try {
        await sendCode({ purpose, email, verificationCode: code });
      } catch {
        throw authProblem('codeDeliveryUnavailable');
      }

      // Registration may close while the provider is sending; the challenge is
      // only activated when the transaction-time decision still allows it.
      if (requireOpen && !registrationOpen()) throw authProblem('registrationClosed');

      const issuedAtMs = clock();
      const timestamp = iso(issuedAtMs);
      const challenge = storage('codeDeliveryUnavailable', () =>
        commit(() => {
          if (accountId && (!store.getAccountById(accountId) || store.isAccountDeleting(accountId)))
            throw authProblem('emailNotRegistered', { field: 'email' });
          store.replaceActiveChallenges(purpose, email, timestamp);
          return store.insertChallenge({
            id: randomOpaqueId('chl'),
            purpose,
            email,
            codeDigest: hashVerificationCode(code, codeSecret),
            issuedAt: timestamp,
            expiresAt: iso(issuedAtMs + CHALLENGE_TTL_MS),
            resendAt: iso(issuedAtMs + RESEND_COOLDOWN_MS),
            remainingAttempts: 5,
            createdAt: timestamp,
            updatedAt: timestamp
          });
        })
      );
      return challengeView(challenge, issuedAtMs);
    });
  }

  function login(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.login);
    const pageId = readPageContext(request);
    const email = readEmailField(input.email);
    const password = readPasswordField(input.password);
    const container = requireBrowserContainer(request, 'sessionStoreUnavailable');
    const account = storage('accountStoreUnavailable', () => store.getAccountByEmail(email));

    let verification = { ok: false, legacy: false };
    if (account) verification = verifyPassword(password, account.passwordHash);
    else verifyPassword(password, dummyPasswordHash());
    if (!verification.ok || store.isAccountDeleting(account.id)) throw authProblem('credentialsRejected');
    accountView(account);

    const atMs = clock();
    const session = storage('sessionStoreUnavailable', () =>
      commit(() => {
        if (verification.legacy) {
          const upgraded = store.updateAccountPassword(
            account.id,
            hashPassword(password),
            account.passwordVersion,
            iso(atMs)
          );
          if (!upgraded) throw new Error('Legacy password hash upgrade affected no account row');
        }
        return createPendingSession(container, pageId, account, input.rememberMe, atMs);
      })
    );
    return { status: 200, body: sessionView(session, account) };
  }

  async function requestRegistrationCode(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.emailCode);
    readPageContext(request);
    const email = readEmailField(input.email);
    if (!registrationOpen()) throw authProblem('registrationClosed');
    const account = storage('accountStoreUnavailable', () => store.getAccountByEmail(email));
    if (account) throw authProblem('emailAlreadyRegistered', { field: 'email' });
    const challenge = await issueChallenge('registration', email, true);
    return { status: 200, body: challenge };
  }

  function register(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.register);
    const pageId = readPageContext(request);
    const email = readEmailField(input.email);
    if (!registrationOpen()) throw authProblem('registrationClosed');
    const nickname = readNicknameField(input.nickname);
    const password = readPasswordField(input.password);
    const challengeId = readChallengeIdField(input.challengeId);
    const code = readVerificationCodeField(input.verificationCode);
    if (input.termsAccepted !== true) throw authProblem('termsNotAccepted', { field: 'termsAccepted' });

    const container = requireBrowserContainer(request, 'accountStoreUnavailable');
    const existing = storage('accountStoreUnavailable', () => store.getAccountByEmail(email));
    verifyChallenge({ challengeId, purpose: 'registration', email, code, problemName: 'accountStoreUnavailable' });
    if (existing) throw authProblem('emailAlreadyRegistered', { field: 'email' });

    const passwordHash = hashPassword(password);
    const atMs = clock();
    const created = storage('accountStoreUnavailable', () =>
      commit(() => {
        if (!registrationOpen()) throw authProblem('registrationClosed');
        const fresh = store.getChallenge(challengeId);
        if (!fresh || fresh.consumedAt) throw authProblem('verificationCodeConsumed', { field: 'verificationCode' });
        if (fresh.replacedAt) throw authProblem('verificationCodeReplaced', { field: 'verificationCode' });
        if (store.getAccountByEmail(email)) throw authProblem('emailAlreadyRegistered', { field: 'email' });

        const timestamp = iso(atMs);
        const account = {
          id: randomOpaqueId('acc'),
          accountKey: randomOpaqueId('usr'),
          email,
          nickname,
          passwordHash,
          passwordVersion: 1,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        store.insertAccount(account);
        if (!store.consumeChallenge(challengeId, timestamp)) {
          throw authProblem('verificationCodeConsumed', { field: 'verificationCode' });
        }
        const session = createPendingSession(container, pageId, account, input.rememberMe, atMs);
        return { account, session };
      })
    );
    return { status: 201, body: sessionView(created.session, created.account) };
  }

  async function requestPasswordResetCode(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.emailCode);
    readPageContext(request);
    const email = readEmailField(input.email);
    const account = storage('accountStoreUnavailable', () => store.getAccountByEmail(email));
    if (!account || store.isAccountDeleting(account.id)) throw authProblem('emailNotRegistered', { field: 'email' });
    const challenge = await issueChallenge('password-reset', email, false, account.id);
    return { status: 200, body: challenge };
  }

  function resetPassword(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.passwordReset);
    readPageContext(request);
    const code = readVerificationCodeField(input.verificationCode);
    const password = readPasswordField(input.password);
    const challengeId = readChallengeIdField(input.challengeId);
    const email = readEmailField(input.email);

    const account = storage('accountStoreUnavailable', () => store.getAccountByEmail(email));
    verifyChallenge({ challengeId, purpose: 'password-reset', email, code, problemName: 'accountStoreUnavailable' });
    if (!account || store.isAccountDeleting(account.id)) throw authProblem('accountStoreUnavailable');

    const passwordHash = hashPassword(password);
    const atMs = clock();
    storage('accountStoreUnavailable', () =>
      commit(() => {
        const fresh = store.getChallenge(challengeId);
        if (!fresh || fresh.consumedAt) throw authProblem('verificationCodeConsumed', { field: 'verificationCode' });
        if (fresh.replacedAt) throw authProblem('verificationCodeReplaced', { field: 'verificationCode' });

        const timestamp = iso(atMs);
        const freshAccount = store.getAccountByEmail(email);
        if (!freshAccount) throw authProblem('accountStoreUnavailable');
        const changed = store.updateAccountPassword(
          freshAccount.id,
          passwordHash,
          freshAccount.passwordVersion + 1,
          timestamp
        );
        if (!changed) throw new Error('Password reset affected no account row');
        store.revokeAccountSessions(freshAccount.id, timestamp);
        store.deleteBindingsForAccountSessions(freshAccount.id);
        store.clearRememberedPointersForAccount(freshAccount.id, timestamp);
        if (!store.consumeChallenge(challengeId, timestamp)) {
          throw authProblem('verificationCodeConsumed', { field: 'verificationCode' });
        }
      })
    );
    return { status: 204 };
  }

  function composeStatus({ open, session, rememberedSession, atMs }) {
    return {
      browserReady: true,
      registrationOpen: open,
      session: session ?? null,
      rememberedSession: rememberedSession ?? null,
      serverTime: iso(atMs)
    };
  }

  function buildStatus(container, pageId) {
    const atMs = clock();
    const binding = storage('sessionStoreUnavailable', () => store.getPageBinding(container.id, pageId));
    let sessionPayload = null;
    if (binding) {
      const session = storage('sessionStoreUnavailable', () => store.getSession(binding.sessionId));
      if (session && session.containerId === container.id) {
        const account = storage('accountStoreUnavailable', () => store.getAccountById(session.accountId));
        const authorization = sessionAuthorization(session, account, atMs);
        // A missing account row for a live session is storage corruption, not
        // an anonymous browser; a stale password version is just not authorized.
        if (authorization === 'missing-account') throw authProblem('accountStoreUnavailable');
        if (authorization === 'live') sessionPayload = sessionView(session, account);
      }
    }

    let rememberedPayload = null;
    const pointer = container.rememberedSessionId;
    if (pointer) {
      const target = storage('sessionStoreUnavailable', () => store.getSession(pointer));
      if (
        target &&
        target.containerId === container.id &&
        target.state === 'active' &&
        target.persistence === 'remembered'
      ) {
        const account = storage('accountStoreUnavailable', () => store.getAccountById(target.accountId));
        const authorization = sessionAuthorization(target, account, atMs);
        if (authorization === 'missing-account') throw authProblem('accountStoreUnavailable');
        if (authorization === 'live') {
          rememberedPayload = { id: target.id, expiresAt: target.expiresAt };
        }
      }
    }

    return composeStatus({
      open: registrationOpen(),
      session: sessionPayload,
      rememberedSession: rememberedPayload,
      atMs
    });
  }

  function getSessionStatus(request) {
    const pageId = readPageContext(request);
    const state = storage('sessionStoreUnavailable', () => resolveContainer(request));
    if (state.state === 'absent') {
      return {
        status: 200,
        body: {
          browserReady: false,
          registrationOpen: registrationOpen(),
          session: null,
          rememberedSession: null,
          serverTime: iso(clock())
        }
      };
    }
    if (state.state === 'invalid') throw authProblem('sessionInvalid');
    return { status: 200, body: buildStatus(state.container, pageId) };
  }

  function rememberedCookie(token, session, atMs) {
    // Whole remaining seconds, never beyond the absolute session deadline and
    // never a deleting Max-Age=0 for a still-valid session.
    const remainingSeconds = Math.floor(Math.max(0, Date.parse(session.expiresAt) - atMs) / 1000);
    return persistentSessionCookie(token, remainingSeconds);
  }

  function bootstrap(pageId, state) {
    if (state.state === 'valid') return { status: 200, body: buildStatus(state.container, pageId) };

    const atMs = clock();
    const open = registrationOpen();
    const token = randomOpaqueId('ctr');
    storage('sessionStoreUnavailable', () => commit(() => store.insertContainer(hashSessionToken(token), iso(atMs))));
    return {
      status: 200,
      body: composeStatus({ open, session: null, rememberedSession: null, atMs }),
      cookies: [sessionCookie(token)]
    };
  }

  function activate(container, token, pageId, command) {
    const atMs = clock();
    const session = storage('sessionStoreUnavailable', () => store.getSession(command.sessionId));
    if (!session || session.containerId !== container.id) throw authProblem('sessionInvalid');

    const account = storage('accountStoreUnavailable', () => store.getAccountById(session.accountId));
    const authorization = sessionAuthorization(session, account, atMs);
    if (authorization === 'missing-account') throw authProblem('accountStoreUnavailable');
    if (authorization !== 'live') throw authProblem('sessionInvalid');
    accountView(account);

    const persistence = command.rememberMe ? 'remembered' : 'page';
    const open = registrationOpen();

    if (session.state === 'active') {
      if (session.persistence !== persistence) throw authProblem('sessionStateConflict');
      storage('sessionStoreUnavailable', () =>
        commit(() => store.upsertPageBinding(container.id, pageId, session.id, iso(atMs)))
      );
      return {
        status: 200,
        body: composeStatus({
          open,
          session: sessionView(session, account),
          rememberedSession: persistence === 'remembered' ? { id: session.id, expiresAt: session.expiresAt } : null,
          atMs
        }),
        cookies: persistence === 'remembered' ? [rememberedCookie(token, session, atMs)] : []
      };
    }

    if (session.state !== 'pending') throw authProblem('sessionInvalid');
    if (command.rememberMe && !session.rememberRequested) throw authProblem('sessionStateConflict');

    const expiresAt = persistence === 'remembered' ? session.expiresAt : null;
    const activatedAt = iso(atMs);
    const problemName = persistence === 'remembered' ? 'sessionPersistenceUnavailable' : 'sessionStoreUnavailable';
    storage(problemName, () =>
      commit(() => {
        if (!store.activateSession(session.id, persistence, expiresAt, activatedAt)) {
          throw authProblem('sessionInvalid');
        }
        store.upsertPageBinding(container.id, pageId, session.id, activatedAt);
        store.setRememberedPointer(container.id, persistence === 'remembered' ? session.id : null, activatedAt);
      })
    );

    const activated = { ...session, state: 'active', persistence, expiresAt };
    return {
      status: 200,
      body: composeStatus({
        open,
        session: sessionView(activated, account),
        rememberedSession: persistence === 'remembered' ? { id: session.id, expiresAt } : null,
        atMs
      }),
      cookies: persistence === 'remembered' ? [rememberedCookie(token, activated, atMs)] : []
    };
  }

  function restore(container, pageId, command) {
    const atMs = clock();
    if (!container.rememberedSessionId || container.rememberedSessionId !== command.sessionId) {
      throw authProblem('sessionInvalid');
    }
    const session = storage('sessionStoreUnavailable', () => store.getSession(command.sessionId));
    if (
      !session ||
      session.containerId !== container.id ||
      session.state !== 'active' ||
      session.persistence !== 'remembered'
    ) {
      throw authProblem('sessionInvalid');
    }

    const account = storage('accountStoreUnavailable', () => store.getAccountById(session.accountId));
    const authorization = sessionAuthorization(session, account, atMs);
    if (authorization === 'missing-account') throw authProblem('accountStoreUnavailable');
    if (authorization !== 'live') throw authProblem('sessionInvalid');
    accountView(account);

    const open = registrationOpen();
    storage('sessionStoreUnavailable', () =>
      commit(() => store.upsertPageBinding(container.id, pageId, session.id, iso(atMs)))
    );
    return {
      status: 200,
      body: composeStatus({
        open,
        session: sessionView(session, account),
        rememberedSession: { id: session.id, expiresAt: session.expiresAt },
        atMs
      })
    };
  }

  function changeSession(request, body) {
    const command = readSessionCommand(body);
    const pageId = readPageContext(request);
    const state = storage('sessionStoreUnavailable', () => resolveContainer(request));

    if (command.action === 'bootstrap') return bootstrap(pageId, state);
    if (state.state === 'absent') throw authProblem('browserContextRequired');
    if (state.state === 'invalid') throw authProblem('sessionInvalid');
    if (command.action === 'activate') return activate(state.container, state.token, pageId, command);
    return restore(state.container, pageId, command);
  }

  function logout(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.logout);
    const sessionId = readLogoutSessionId(input);
    const pageId = readPageContext(request);

    const state = storage('sessionStoreUnavailable', () => resolveContainer(request));
    if (state.state !== 'valid') return { status: 204, cookies: [clearedSessionCookie()] };

    const container = state.container;
    const atMs = clock();
    const outcome = storage('sessionStoreUnavailable', () =>
      commit(() => {
        if (typeof sessionId === 'string') {
          const session = store.getSession(sessionId);
          if (session && session.containerId === container.id && !session.revokedAt) {
            const binding = store.getPageBinding(container.id, pageId);
            const boundToPage = Boolean(binding && binding.sessionId === session.id);
            const isRestoreTarget = container.rememberedSessionId === session.id;
            if (boundToPage || isRestoreTarget) {
              const timestamp = iso(atMs);
              store.revokeSession(session.id, timestamp);
              store.deleteBindingsForSession(session.id);
              if (isRestoreTarget) store.setRememberedPointer(container.id, null, timestamp);
            }
          }
        }

        // The anonymous carrier is still needed to verify pending or completed
        // deletion requests after a lost response in another tab.
        if (store.countLiveSessions(container.id, iso(atMs)) === 0 && !store.hasAccountDeletionReceipt(container.id)) {
          store.deleteBindingsForContainer(container.id);
          store.deleteContainer(container.id);
          return { clearCookie: true };
        }
        return { clearCookie: false };
      })
    );

    return { status: 204, cookies: outcome.clearCookie ? [clearedSessionCookie()] : [] };
  }

  function updateProfile(request, body) {
    const input = readClosedObject(body, REQUEST_SCHEMAS.profile);
    const nickname = readNicknameField(input.nickname);
    const pageId = readPageContext(request);
    const account = storage('accountStoreUnavailable', () => commit(() => {
      const container = requireBrowserContainer(request, 'sessionStoreUnavailable');
      const session = storage('sessionStoreUnavailable', () => {
        const binding = store.getPageBinding(container.id, pageId);
        return binding ? store.getSession(binding.sessionId) : null;
      });
      if (!session || session.containerId !== container.id || session.state !== 'active') throw authProblem('sessionInvalid');
      const current = store.getAccountById(session.accountId);
      const authorization = sessionAuthorization(session, current, clock());
      if (authorization === 'missing-account') throw authProblem('accountStoreUnavailable');
      if (authorization !== 'live') throw authProblem('sessionInvalid');
      return accountView(store.updateNickname(current.id, nickname, iso(clock())));
    }));
    return { status: 200, body: account };
  }

  async function resolvePrincipal(request) {
    const headers = request?.headers ?? {};
    const token = readSessionCookie(request ?? { headers: {} });
    if (token === undefined || !OPAQUE_ID_PATTERN.test(token)) return null;
    const pageId = headers['x-teachbuddy-page'];
    if (typeof pageId !== 'string' || !PAGE_CONTEXT_PATTERN.test(pageId)) return null;

    let container;
    let binding;
    let session;
    try {
      container = store.getContainer(hashSessionToken(token));
      if (!container) return null;
      binding = store.getPageBinding(container.id, pageId);
      if (!binding) return null;
      session = store.getSession(binding.sessionId);
    } catch {
      throw principalStoreError('session-store-unavailable');
    }
    if (!session || session.containerId !== container.id || session.state !== 'active') return null;

    let account;
    try {
      account = store.getAccountById(session.accountId);
    } catch {
      throw principalStoreError('account-store-unavailable');
    }

    const authorization = sessionAuthorization(session, account, clock());
    // A session whose account row vanished is corrupt storage, not anonymity.
    if (authorization === 'missing-account') throw principalStoreError('account-store-unavailable');
    if (authorization !== 'live') return null;
    return { accountKey: account.accountKey };
  }

  function principalStoreError(type) {
    const error = new Error('Authentication store unavailable');
    error.status = 503;
    error.problem = { type: '/problems/auth/' + type };
    return error;
  }

  return {
    authorizeAccountDeletion(request, sessionId) {
      const pageId = readPageContext(request);
      const container = requireBrowserContainer(request, 'sessionStoreUnavailable');
      const binding = store.getPageBinding(container.id, pageId);
      const session = store.getSession(sessionId);
      if (!session || session.containerId !== container.id || binding?.sessionId !== sessionId || session.state !== 'active')
        throw authProblem('sessionInvalid');
      const account = store.getAccountById(session.accountId);
      if (sessionAuthorization(session, account, clock()) !== 'live') throw authProblem('sessionInvalid');
      return account;
    },
    login,
    requestRegistrationCode,
    register,
    requestPasswordResetCode,
    resetPassword,
    getSessionStatus,
    changeSession,
    logout,
    updateProfile,
    resolvePrincipal
  };
}
