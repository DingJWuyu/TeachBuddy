import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'auth', ...options });

/*
 * Account-entry state machine. It owns the page context, the HTTP client, the
 * activation/restore handoff and the session re-check triggers; the surface
 * only renders the states it publishes.
 *
 * The public seam is `useAuth()` -> { status, account, request, logout }.
 * Everything else is internal to the feature.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PROBLEM, createAuthClient, createTransport } from './api.js';
import { createPageContext } from './pageContext.js';
import { normalizeEmail, trimmed } from './rules.js';
import { COPY, bannerProblem, fieldProblem } from './presentation.js';
import { readDeletion, rememberDeletion, forgetDeletion, deletionRequestId, clearDeletedAccountDeviceData } from './deletion.js';
import i18n from '../../i18n/index.js';

export const INTERNAL_AUTH = createContext(null);
export const PUBLIC_AUTH = createContext(null);

const INITIAL_STATE = Object.freeze({
  status: 'booting',
  account: null,
  session: null,
  pending: null,
  persistenceFailed: false,
  recovery: null,
  registrationOpen: true,
  notice: null,
  errorKind: null,
});

const VISIBILITY_RECHECK_MS = 30_000;
const BROADCAST_CHANNEL = 'teachbuddy-auth';
const OK = Object.freeze({ ok: true });
const STALE = Object.freeze({ ok: false, stale: true });

export function useInternalAuth() {
  const value = useContext(INTERNAL_AUTH);
  if (!value) throw new Error('useInternalAuth must be used inside <AuthProvider>');
  return value;
}

/* Every signed-out transition clears the same identity fields. */
function signedOut(current, patch = {}) {
  return {
    ...current,
    status: 'anonymous',
    account: null,
    session: null,
    pending: null,
    persistenceFailed: false,
    recovery: null,
    errorKind: null,
    ...patch,
  };
}

export function logoutError(kind, outcome) {
  const error = new Error(kind === 'unconfirmed' ? t("退出结果暂未确认") : t("退出失败，请重试"));
  error.kind = kind === 'unconfirmed' ? 'logout-unconfirmed' : 'logout-failed';
  error.problemType = outcome?.type ?? outcome?.reason ?? null;
  return error;
}

export default function AuthProvider({ children, timeoutMs = 10_000 }) {
  useTranslation('auth');

  const [state, setState] = useState(() => {
    const deletion = readDeletion();
    return deletion ? { ...INITIAL_STATE, status: 'deleting', deletion, account: deletion.account } : INITIAL_STATE;
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  useLayoutEffect(() => {
    if (state.status !== 'active') void i18n.changeLanguage(state.deletion?.locale || 'zh-CN');
  }, [state.status, state.deletion?.locale]);

  const pageContextRef = useRef(null);
  if (pageContextRef.current === null) pageContextRef.current = createPageContext();
  const generationRef = useRef(0);
  const operationRef = useRef(0);
  const identityEpochRef = useRef(0);
  const bootStartedRef = useRef(false);
  const lockedRef = useRef(false);
  const logoutTargetRef = useRef(undefined);
  const deletionRunningRef = useRef(false);
  const channelRef = useRef(null);
  const recheckRef = useRef(null);
  const restoreRef = useRef(null);

  const [locked, setLocked] = useState(false);

  const clientRef = useRef(null);
  if (clientRef.current === null) {
    clientRef.current = createAuthClient({
      getPageContext: () => pageContextRef.current,
      timeoutMs,
    });
  }
  const client = clientRef.current;

  const transportRef = useRef(null);
  if (transportRef.current === null) {
    transportRef.current = createTransport({
      getPageContext: () => pageContextRef.current,
      onUnauthorized: () => {
        void recheckRef.current?.();
      },
      isLocked: () => lockedRef.current,
    });
  }
  const request = transportRef.current;

  const live = useCallback((generation, operation) => (
    generationRef.current === generation && operationRef.current === operation
  ), []);

  const nextOperation = useCallback(() => {
    operationRef.current += 1;
    return operationRef.current;
  }, []);

  /*
   * Surface edits and card switches invalidate the operation that is in
   * flight: a late business result must not install a challenge, activate a
   * pending session or change the form the teacher is now editing.
   */
  const invalidateOperation = useCallback(() => {
    operationRef.current += 1;
  }, []);

  const bumpIdentity = useCallback(() => {
    identityEpochRef.current += 1;
  }, []);

  const rotatePageContext = useCallback(() => {
    pageContextRef.current = createPageContext();
    generationRef.current += 1;
    operationRef.current += 1;
    bumpIdentity();
  }, [bumpIdentity]);

  const notifyPeers = useCallback(() => {
    try {
      channelRef.current?.postMessage({ kind: 'auth-changed' });
    } catch {
      /* a missing or closed channel only means no other page hears about it */
    }
  }, []);

  const setActive = useCallback((session, registrationOpen) => {
    bumpIdentity();
    logoutTargetRef.current = undefined;
    setState((current) => ({
      ...current,
      status: 'active',
      account: session.account,
      session,
      pending: null,
      persistenceFailed: false,
      recovery: null,
      registrationOpen: registrationOpen ?? current.registrationOpen,
      notice: null,
      errorKind: null,
    }));
  }, [bumpIdentity]);

  const expireSession = useCallback((notice = () => COPY.expired) => {
    // I06 has proved this page's target invalid, including after a lost I07
    // response. Release that target here; another logout could clear a peer's
    // newly bootstrapped browser container.
    logoutTargetRef.current = undefined;
    lockedRef.current = false;
    setLocked(false);
    rotatePageContext();
    setState((current) => signedOut(current, {
      notice: notice ? { get message() { return typeof notice === 'function' ? notice() : notice; }, tone: 'error' } : null,
    }));
  }, [rotatePageContext]);

  const adoptStatus = useCallback((data, { generation, notice = null } = {}) => {
    if (generation !== undefined && generation !== generationRef.current) return;
    if (data.session?.state === 'active') {
      setActive(data.session, data.registrationOpen);
      return;
    }
    if (data.session?.state === 'pending') {
      bumpIdentity();
      setState((current) => ({
        ...current,
        status: 'pending',
        account: null,
        session: null,
        pending: {
          id: data.session.id,
          account: data.session.account,
          rememberRequested: data.session.rememberRequested,
          origin: current.pending?.origin ?? null,
        },
        persistenceFailed: true,
        recovery: null,
        registrationOpen: data.registrationOpen,
        notice: null,
        errorKind: null,
      }));
      return;
    }
    if (data.rememberedSession) {
      bumpIdentity();
      setState((current) => ({
        ...current,
        status: 'recovering',
        account: null,
        session: null,
        pending: null,
        persistenceFailed: false,
        recovery: { id: data.rememberedSession.id, expiresAt: data.rememberedSession.expiresAt },
        registrationOpen: data.registrationOpen,
        notice: null,
        errorKind: null,
      }));
      void restoreRef.current?.(data.rememberedSession.id, generationRef.current);
      return;
    }
    bumpIdentity();
    setState((current) => signedOut(current, {
      registrationOpen: data.registrationOpen,
      notice: notice ? { get message() { return typeof notice === 'function' ? notice() : notice; }, tone: 'error' } : null,
    }));
  }, [bumpIdentity, setActive]);

  const bootstrap = useCallback(async ({ generation, notice = null } = {}) => {
    const outcome = await client.bootstrapSession();
    if (generation !== generationRef.current) return;
    if (outcome.kind !== 'result') {
      setState((current) => ({ ...current, status: 'error', errorKind: 'boot', notice: null }));
      return;
    }
    const confirm = await client.getSession();
    if (generation !== generationRef.current) return;
    if (confirm.kind === 'result' && confirm.data.browserReady) {
      adoptStatus(confirm.data, { generation, notice });
      return;
    }
    if (confirm.kind === 'result') {
      setState((current) => ({ ...current, status: 'error', errorKind: 'browser', notice: null }));
      return;
    }
    setState((current) => ({ ...current, status: 'error', errorKind: 'boot', notice: null }));
  }, [adoptStatus, client]);

  const restore = useCallback(async (sessionId, generation) => {
    setState((current) => ({ ...current, status: 'recovering', errorKind: null, notice: null }));
    const outcome = await client.restoreSession({ sessionId });
    if (generation !== generationRef.current) return;
    if (outcome.kind === 'result' && outcome.data.session?.state === 'active') {
      setActive(outcome.data.session, outcome.data.registrationOpen);
      notifyPeers();
      return;
    }
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.SESSION_INVALID) {
      bumpIdentity();
      setState((current) => signedOut(current, {
        notice: { get message() { return COPY.expired; }, tone: 'error' },
      }));
      return;
    }
    setState((current) => ({ ...current, status: 'error', errorKind: 'restore', notice: null }));
  }, [bumpIdentity, client, notifyPeers, setActive]);

  restoreRef.current = restore;

  const boot = useCallback(async () => {
    if (stateRef.current.deletion) return;
    const generation = generationRef.current;
    setState((current) => ({ ...current, status: 'booting', notice: null, errorKind: null }));
    const outcome = await client.getSession();
    if (generation !== generationRef.current) return;
    if (outcome.kind === 'result') {
      if (!outcome.data.browserReady) {
        await bootstrap({ generation });
        return;
      }
      adoptStatus(outcome.data, { generation });
      return;
    }
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.SESSION_INVALID) {
      await bootstrap({ generation, notice: () => COPY.expired });
      return;
    }
    setState((current) => ({ ...current, status: 'error', errorKind: 'boot', notice: null }));
  }, [adoptStatus, bootstrap, client]);

  const recheck = useCallback(async () => {
    const generation = generationRef.current;
    const epoch = identityEpochRef.current;
    const current = stateRef.current;
    if (current.status === 'booting' || current.status === 'recovering' || current.deletion) return;
    const outcome = await client.getSession();
    if (generation !== generationRef.current || epoch !== identityEpochRef.current) return;
    const now = stateRef.current;
    if (outcome.kind === 'result') {
      const data = outcome.data;
      if (data.session?.state === 'active') {
        if (now.status !== 'active' || now.session?.id !== data.session.id) {
          setActive(data.session, data.registrationOpen);
        }
        return;
      }
      if (data.session?.state === 'pending') {
        /*
         * A pending session is not an identity: keep the save-failure card
         * instead of claiming an expiry the teacher never saw.
         */
        bumpIdentity();
        setState((inner) => ({
          ...inner,
          status: 'pending',
          account: null,
          session: null,
          pending: {
            id: data.session.id,
            account: data.session.account,
            rememberRequested: data.session.rememberRequested,
            origin: inner.pending?.origin ?? null,
          },
          persistenceFailed: true,
          registrationOpen: data.registrationOpen,
        }));
        return;
      }
      if (now.status === 'active' || now.status === 'pending') {
        expireSession();
        return;
      }
      setState((inner) => ({ ...inner, registrationOpen: data.registrationOpen }));
      return;
    }
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.SESSION_INVALID) {
      if (now.status === 'active' || now.status === 'pending') expireSession();
    }
    /*
     * Store/transport failures keep the current identity: the server still
     * owns authorization and a read failure is not proof of revocation.
     */
  }, [client, expireSession, setActive]);
  recheckRef.current = recheck;

  useEffect(() => {
    if (bootStartedRef.current) return undefined;
    bootStartedRef.current = true;
    void boot();
    return undefined;
  }, [boot]);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return undefined;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = () => {
      void recheckRef.current?.();
    };
    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    /*
     * A back/forward cache restore reuses the document but must not reuse the
     * page-level identity: take a new page context and read the session again.
     */
    const onPageShow = (event) => {
      if (!event.persisted) return;
      rotatePageContext();
      void boot();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [boot, rotatePageContext]);

  useEffect(() => {
    if (state.status !== 'active') return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void recheckRef.current?.();
    }, VISIBILITY_RECHECK_MS);
    const onFocus = () => {
      void recheckRef.current?.();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void recheckRef.current?.();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state.status]);

  const presentFailure = useCallback((outcome, operation, mutating) => {
    if (outcome.kind === 'problem') {
      if (mutating && outcome.type === PROBLEM.SESSION_STORE_UNAVAILABLE) {
        return { ok: false, unknown: true };
      }
      const field = fieldProblem(outcome, operation);
      if (field) return { ok: false, ...field };
      const banner = bannerProblem(outcome, operation);
      if (banner?.closed) return { ok: false, closed: true };
      if (banner) {
        return {
          ok: false,
          banner: { message: banner.message, tone: banner.tone, clearPassword: banner.clearPassword === true },
        };
      }
      return { ok: false, banner: { get message() { return COPY.storeRetry; }, tone: 'error' } };
    }
    if (outcome.kind === 'unknown-problem') {
      if (mutating) return { ok: false, unknown: true };
      return { ok: false, banner: { get message() { return COPY.serviceRetry; }, tone: 'error' } };
    }
    if (outcome.reason === 'offline') {
      return { ok: false, banner: { get message() { return COPY.offline; }, tone: 'error' } };
    }
    if (mutating) return { ok: false, unknown: true };
    const message = outcome.reason === 'timeout'
      ? COPY.timeout
      : outcome.reason === 'malformed'
        ? COPY.malformed
        : COPY.network;
    return { ok: false, banner: { message, tone: 'error' } };
  }, []);

  /*
   * Activate a pending session and only report success after the active
   * identity is confirmed. Every failure other than a proven invalid target is
   * re-verified with a read before the interface claims anything.
   */
  const activate = useCallback(async ({ pending, rememberMe, generation, operation }) => {
    const outcome = await client.activateSession({ sessionId: pending.id, rememberMe });
    if (!live(generation, operation)) {
      if (outcome.kind === 'result') {
        void client.logout({ sessionId: pending.id }).catch(() => {});
      }
      return STALE;
    }
    if (outcome.kind === 'result' && outcome.data.session?.state === 'active') {
      setActive(outcome.data.session, outcome.data.registrationOpen);
      notifyPeers();
      return OK;
    }
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.SESSION_INVALID) {
      expireSession();
      return { ok: false, expired: true };
    }
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.SESSION_PERSISTENCE_UNAVAILABLE) {
      setState((current) => ({
        ...current,
        status: 'pending',
        pending: current.pending ?? pending,
        persistenceFailed: true,
      }));
      return { ok: false, persistenceFailed: true };
    }
    const check = await client.getSession();
    if (!live(generation, operation)) return STALE;
    if (check.kind === 'result') {
      if (check.data.session?.state === 'active') {
        setActive(check.data.session, check.data.registrationOpen);
        notifyPeers();
        return OK;
      }
      if (check.data.session?.state === 'pending') {
        setState((current) => ({
          ...current,
          status: 'pending',
          pending: current.pending ?? pending,
          persistenceFailed: true,
        }));
        return { ok: false, persistenceFailed: true };
      }
      expireSession();
      return { ok: false, expired: true };
    }
    if (check.kind === 'problem' && check.status === 401) {
      expireSession();
      return { ok: false, expired: true };
    }
    setState((current) => ({ ...current, status: 'error', errorKind: 'verify', notice: null }));
    return { ok: false, verifyFailed: true };
  }, [client, expireSession, live, notifyPeers, setActive]);

  const login = useCallback(async ({ email, password, rememberMe }) => {
    const generation = generationRef.current;
    const operation = nextOperation();
    setState((current) => ({ ...current, notice: null }));
    const outcome = await client.login({ email: normalizeEmail(email), password, rememberMe });
    if (!live(generation, operation)) {
      /*
       * The form moved on: a late pending session is never activated, and the
       * known pending target is given up with the directed revoke.
       */
      if (outcome.kind === 'result') {
        void client.logout({ sessionId: outcome.data.id }).catch(() => {});
      }
      return STALE;
    }
    if (outcome.kind === 'result') {
      const pending = {
        id: outcome.data.id,
        account: outcome.data.account,
        rememberRequested: outcome.data.rememberRequested,
        origin: 'login',
      };
      setState((current) => ({
        ...current,
        status: 'pending',
        pending,
        persistenceFailed: false,
        account: null,
        session: null,
      }));
      return activate({ pending, rememberMe, generation, operation });
    }
    return presentFailure(outcome, 'login', false);
  }, [activate, client, live, nextOperation, presentFailure]);

  const register = useCallback(async ({ email, nickname, password, challengeId, verificationCode }) => {
    const generation = generationRef.current;
    const operation = nextOperation();
    setState((current) => ({ ...current, notice: null }));
    const outcome = await client.register({
      email: normalizeEmail(email),
      nickname: trimmed(nickname),
      password,
      challengeId,
      verificationCode,
    });
    if (!live(generation, operation)) {
      if (outcome.kind === 'result') {
        void client.logout({ sessionId: outcome.data.id }).catch(() => {});
      }
      return STALE;
    }
    if (outcome.kind === 'result') {
      const pending = {
        id: outcome.data.id,
        account: outcome.data.account,
        rememberRequested: outcome.data.rememberRequested,
        origin: 'register',
      };
      setState((current) => ({
        ...current,
        status: 'pending',
        pending,
        persistenceFailed: false,
        account: null,
        session: null,
      }));
      return activate({ pending, rememberMe: true, generation, operation });
    }
    return presentFailure(outcome, 'register', true);
  }, [activate, client, live, nextOperation, presentFailure]);

  const sendCode = useCallback(async ({ purpose, email }) => {
    const generation = generationRef.current;
    const operation = nextOperation();
    setState((current) => ({ ...current, notice: null }));
    const normalized = normalizeEmail(email);
    const outcome = purpose === 'registration'
      ? await client.requestRegistrationCode({ email: normalized })
      : await client.requestPasswordResetCode({ email: normalized });
    if (!live(generation, operation)) return STALE;
    if (outcome.kind === 'result') return { ok: true, challenge: outcome.data };
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.CODE_SEND_COOLDOWN) {
      return { ok: false, cooldown: { retryAfterSeconds: outcome.retryAfterSeconds ?? 1 } };
    }
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.REGISTRATION_CLOSED) {
      return { ok: false, closed: true };
    }
    if (outcome.kind === 'problem') {
      const field = fieldProblem(outcome, purpose === 'registration' ? 'register' : 'password-reset');
      if (field) return { ok: false, ...field };
      const banner = bannerProblem(outcome, purpose === 'registration' ? 'register' : 'password-reset');
      if (banner) return { ok: false, banner: { message: banner.message, tone: banner.tone } };
    }
    return { ok: false, banner: { get message() { return COPY.retrySend; }, tone: 'error' } };
  }, [client, live, nextOperation]);

  const resetPassword = useCallback(async ({ email, challengeId, verificationCode, password }) => {
    const generation = generationRef.current;
    const operation = nextOperation();
    setState((current) => ({ ...current, notice: null }));
    const outcome = await client.resetPassword({
      email: normalizeEmail(email),
      challengeId,
      verificationCode,
      password,
    });
    if (!live(generation, operation)) return STALE;
    if (outcome.kind === 'no-content') {
      notifyPeers();
      return OK;
    }
    return presentFailure(outcome, 'password-reset', true);
  }, [client, live, nextOperation, notifyPeers, presentFailure]);

  const refreshRegistrationOpen = useCallback(async () => {
    const generation = generationRef.current;
    const outcome = await client.getSession();
    if (generation !== generationRef.current) return null;
    if (outcome.kind === 'result') {
      setState((current) => ({ ...current, registrationOpen: outcome.data.registrationOpen }));
      return outcome.data.registrationOpen;
    }
    return null;
  }, [client]);

  /*
   * Continue or retry only the session command. The account business is not
   * repeated, and the current validity is verified server-side again.
   */
  const completePending = useCallback(async (rememberMe) => {
    const current = stateRef.current;
    if (!current.pending) return STALE;
    const generation = generationRef.current;
    const operation = nextOperation();
    setState((inner) => ({ ...inner, notice: null }));
    return activate({ pending: current.pending, rememberMe, generation, operation });
  }, [activate, nextOperation]);

  const abandonPending = useCallback(() => {
    const pendingId = stateRef.current.pending?.id ?? null;
    if (pendingId) void client.logout({ sessionId: pendingId }).catch(() => {});
    rotatePageContext();
    setState((current) => signedOut(current));
  }, [client, rotatePageContext]);

  const retry = useCallback(() => {
    void boot();
  }, [boot]);

  const returnFromRecovery = useCallback(() => {
    const target = stateRef.current.recovery?.id ?? null;
    if (target) void client.logout({ sessionId: target }).catch(() => {});
    rotatePageContext();
    setState((current) => signedOut(current));
  }, [client, rotatePageContext]);

  const dismissNotice = useCallback(() => {
    setState((current) => (current.notice ? { ...current, notice: null } : current));
  }, []);

  const logout = useCallback(async () => {
    if (stateRef.current.deletion) throw new Error('Account deletion is awaiting confirmation');
    const target = logoutTargetRef.current !== undefined
      ? logoutTargetRef.current
      : (stateRef.current.session?.id ?? null);
    logoutTargetRef.current = target;
    const outcome = await client.logout({ sessionId: target });
    if (outcome.kind === 'no-content') {
      logoutTargetRef.current = undefined;
      lockedRef.current = false;
      setLocked(false);
      rotatePageContext();
      notifyPeers();
      setState((current) => signedOut(current));
      return;
    }
    if (outcome.kind === 'problem') {
      lockedRef.current = false;
      setLocked(false);
      throw logoutError('failed', outcome);
    }
    /*
     * A lost or unreadable response cannot prove the revocation happened.
     * Stop business interaction and keep the same target for the retry.
     */
    lockedRef.current = true;
    setLocked(true);
    throw logoutError('unconfirmed', outcome);
  }, [client, notifyPeers, rotatePageContext]);

  const deleteAccount = useCallback(async email => {
    if (deletionRunningRef.current) return;
    const current = stateRef.current;
    const deletion = current.deletion ?? {
      account: current.account, locale: i18n.language,
      body: { requestId: deletionRequestId(), sessionId: current.session?.id, email: normalizeEmail(email) },
    };
    if (!deletion.account || !deletion.body.sessionId) throw new Error('deletion-identity');
    rememberDeletion(deletion);
    deletionRunningRef.current = true;
    lockedRef.current = true; setLocked(true); bumpIdentity();
    setState(value => ({ ...value, status: 'deleting', deletion, deletionRunning: true, deletionError: null }));
    try {
      const outcome = await client.deleteAccount(deletion.body);
      if (outcome.kind !== 'no-content') {
        const rejected = outcome.kind === 'problem' && [400, 403, 415, 422].includes(outcome.status);
        if (rejected && !current.deletion) {
          forgetDeletion(); lockedRef.current = false; setLocked(false);
          setState(value => ({ ...value, ...current, deletion: null }));
          throw new Error('deletion-rejected');
        }
        setState(value => ({ ...value, deletionRunning: false,
          deletionError: outcome.type === PROBLEM.DELETION_INCOMPLETE ? 'incomplete' : 'unknown' }));
        return;
      }
      // A 401 or anonymous session is never a substitute for this 204 receipt.
      try { await clearDeletedAccountDeviceData(deletion.account.accountKey); forgetDeletion(); }
      catch {
        setState(value => ({ ...value, deletionRunning: false, deletionError: 'device' }));
        return;
      }
      lockedRef.current = false; setLocked(false);
      rotatePageContext(); notifyPeers();
      setState(value => signedOut(value, { deletion: null, deletionRunning: false, deletionError: null }));
    } finally { deletionRunningRef.current = false; }
  }, [bumpIdentity, client, notifyPeers, rotatePageContext]);

  const publicValue = useMemo(() => ({
    status: state.status,
    account: state.status === 'active' ? state.account : null,
    request,
    logout,
    deleteAccount,
  }), [state.status, state.account, request, logout, deleteAccount]);

  const internalValue = useMemo(() => ({
    ...state,
    deleteAccount,
    locked,
    registrationOpen: state.registrationOpen,
    login,
    register,
    sendCode,
    resetPassword,
    refreshRegistrationOpen,
    invalidateOperation,
    continuePending: () => completePending(false),
    retryPersist: () => completePending(true),
    abandonPending,
    retry,
    returnFromRecovery,
    dismissNotice,
    logout,
    request,
  }), [
    state,
    deleteAccount,
    locked,
    login,
    register,
    sendCode,
    resetPassword,
    refreshRegistrationOpen,
    invalidateOperation,
    completePending,
    abandonPending,
    retry,
    returnFromRecovery,
    dismissNotice,
    logout,
    request,
    i18n.resolvedLanguage,
  ]);

  return (
    <INTERNAL_AUTH.Provider value={internalValue}>
      <PUBLIC_AUTH.Provider value={publicValue}>{children}</PUBLIC_AUTH.Provider>
    </INTERNAL_AUTH.Provider>
  );
}
