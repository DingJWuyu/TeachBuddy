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
import { listDeletions, readDeletion, rememberDeletion, forgetDeletion, deletionRequestId, readSelectedDeletionId, selectDeletion } from './deletion.js';
import i18n from '../../i18n/index.js';
import { listRevocations, rememberRevocation, forgetRevocation } from './revocation.js';

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
  revocation: null,
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

export default function AuthProvider({ children, timeoutMs = 10_000, onAccountDeleted }) {
  useTranslation('auth');

  const [state, setState] = useState(INITIAL_STATE);
  const deletionsRef = useRef([]);
  const revocationsRef = useRef([]);
  const deletionDeferredRef = useRef(false);
  const revocationRunningRef = useRef(false);
  const prepareLoginRef = useRef(false);
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
  const deletionRunningRef = useRef(false);
  const channelRef = useRef(null);
  const recheckRef = useRef(null);
  const restoreRef = useRef(null);
  const bootstrapRef = useRef(null);

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

  const enterDeletion = useCallback((deletion) => {
    try { selectDeletion(deletion.body.requestId); }
    catch { setState(current => ({ ...current, status: 'error', errorKind: 'boot' })); return; }
    lockedRef.current = true; setLocked(true); bumpIdentity();
    setState(current => ({ ...current, status: 'deleting', account: deletion.account,
      session: null, pending: null, recovery: null, deletion, deletionRunning: false, deletionError: null }));
  }, [bumpIdentity]);

  const setActive = useCallback((session, registrationOpen) => {
    const deletion = deletionsRef.current.find(value => value.body.sessionId === session.id);
    if (deletion) { enterDeletion(deletion); return; }
    lockedRef.current = false; setLocked(false);

    bumpIdentity();
    setState((current) => ({
      ...current,
      status: 'active',
      revocation: null,
      account: session.account,
      session,
      pending: null,
      persistenceFailed: false,
      recovery: null,
      registrationOpen: registrationOpen ?? current.registrationOpen,
      notice: null,
      errorKind: null,
    }));
  }, [bumpIdentity, enterDeletion]);

  const expireSession = useCallback((notice = () => COPY.expired) => {
    // I06 has proved this page's target invalid, including after a lost I07
    // response. Release that target here; another logout could clear a peer's
    // newly bootstrapped browser container.
    const target = stateRef.current.revocation?.sessionId;
    if (target) {
      try { forgetRevocation(target); revocationsRef.current = revocationsRef.current.filter(value => value.sessionId !== target); }
      catch { return; }
    }
    lockedRef.current = false;
    setLocked(false);
    rotatePageContext();
    prepareLoginRef.current = true;
    setState((current) => signedOut(current, {
      status: 'booting',
      revocation: null,
      notice: notice ? { get message() { return typeof notice === 'function' ? notice() : notice; }, tone: 'error' } : null,
    }));
    void bootstrapRef.current?.({ generation: generationRef.current, notice, anonymousOnly: true });
  }, [rotatePageContext]);

  const adoptStatus = useCallback((data, { generation, notice = null } = {}) => {
    if (generation !== undefined && generation !== generationRef.current) return;
    const targetId = data.session?.id ?? data.rememberedSession?.id;
    const revoked = revocationsRef.current.find(value => value.sessionId === targetId);
    if (revoked || (!targetId && revocationsRef.current.length)) {
      const record = revoked ?? revocationsRef.current[0];
      lockedRef.current = true; setLocked(true);
      setState(current => signedOut(current, { revocation: { ...record, phase: record.uncertain ? 'unknown' : 'failed' }, registrationOpen: data.registrationOpen }));
      return;
    }
    const deletion = targetId
      ? deletionsRef.current.find(value => value.body.sessionId === targetId)
      : !deletionDeferredRef.current && (deletionsRef.current.find(value => value.body.requestId === readSelectedDeletionId()) ?? deletionsRef.current[0]);
    if (deletion) { enterDeletion(deletion); return; }
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
  }, [bumpIdentity, enterDeletion, setActive]);

  const bootstrap = useCallback(async ({ generation, notice = null, anonymousOnly = false } = {}) => {
    const outcome = await client.bootstrapSession();
    if (generation !== generationRef.current) return;
    if (outcome.kind !== 'result') {
      setState((current) => ({ ...current, status: 'error', errorKind: 'boot', notice: null }));
      return;
    }
    const confirm = await client.getSession();
    if (generation !== generationRef.current) return;
    if (confirm.kind === 'result' && confirm.data.browserReady) {
      if (anonymousOnly) {
        prepareLoginRef.current = false;
        setState(current => signedOut(current, { revocation: null, registrationOpen: confirm.data.registrationOpen,
          notice: notice ? { get message() { return typeof notice === 'function' ? notice() : notice; }, tone: 'error' } : null }));
      } else adoptStatus(confirm.data, { generation, notice });
      return;
    }
    if (confirm.kind === 'result') {
      setState((current) => ({ ...current, status: 'error', errorKind: 'browser', notice: null }));
      return;
    }
    setState((current) => ({ ...current, status: 'error', errorKind: 'boot', notice: null }));
  }, [adoptStatus, client]);
  bootstrapRef.current = bootstrap;

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
    try {
      deletionsRef.current = listDeletions();
      readSelectedDeletionId();
      revocationsRef.current = listRevocations();
      setState(current => ({ ...current, pendingDeletions: deletionsRef.current.map(value => ({ requestId: value.body.requestId, nickname: value.account.nickname, email: value.account.email })) }));
    } catch {
      setState(current => ({ ...current, status: 'error', errorKind: 'boot' }));
      return;
    }
    const generation = generationRef.current;
    setState((current) => ({ ...current, status: 'booting', notice: null, errorKind: null }));
    if (prepareLoginRef.current) { await bootstrap({ generation, anonymousOnly: true }); return; }
    const outcome = await client.getSession();
    if (generation !== generationRef.current) return;
    if (outcome.kind === 'result') {
      if (!outcome.data.browserReady && !deletionsRef.current.length && !revocationsRef.current.length) {
        await bootstrap({ generation });
        return;
      }
      adoptStatus(outcome.data, { generation });
      return;
    }
    if (outcome.kind === 'problem' && outcome.type === PROBLEM.SESSION_INVALID) {
      if (deletionsRef.current.length) {
        enterDeletion(deletionsRef.current.find(value => value.body.requestId === readSelectedDeletionId()) ?? deletionsRef.current[0]);
        return;
      }
      if (revocationsRef.current.length) {
        lockedRef.current = true; setLocked(true);
        setState(current => signedOut(current, { revocation: { ...revocationsRef.current[0], phase: 'unknown', uncertain: true } }));
        return;
      }
      await bootstrap({ generation, notice: () => COPY.expired });
      return;
    }
    setState((current) => ({ ...current, status: 'error', errorKind: 'boot', notice: null }));
  }, [adoptStatus, bootstrap, client, enterDeletion]);

  const recheck = useCallback(async () => {
    const generation = generationRef.current;
    const epoch = identityEpochRef.current;
    const current = stateRef.current;
    if (current.status === 'booting' || current.status === 'recovering' || current.deletion
      || current.revocation?.phase === 'running') return;
    const outcome = await client.getSession();
    if (generation !== generationRef.current || epoch !== identityEpochRef.current) return;
    const now = stateRef.current;
    if (outcome.kind === 'result') {
      const data = outcome.data;
      if (now.revocation) {
        const target = now.revocation.sessionId;
        if (data.session?.id === target || data.rememberedSession?.id === target) return;
        if (now.status === 'active' && now.session?.id === target) expireSession(null);
        return;
      }
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
    if (stateRef.current.revocation) return { ok: false, stale: true };
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
    if (stateRef.current.revocation) return STALE;
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
    if (outcome.reason === 'offline') {
      return { ok: false, banner: { get message() { return COPY.offline; }, tone: 'error' } };
    }
    return { ok: false, banner: {
      get message() { return t("验证码发送结果暂未确认，可能收到邮件。请稍后重新发送。"); },
      tone: 'neutral',
    } };
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
    if (!current.pending || current.revocation) return STALE;
    const generation = generationRef.current;
    const operation = nextOperation();
    setState((inner) => ({ ...inner, notice: null }));
    return activate({ pending: current.pending, rememberMe, generation, operation });
  }, [activate, nextOperation]);

  const revokeTarget = useCallback(async ({ sessionId, source }) => {
    if (revocationRunningRef.current) return;
    const previous = stateRef.current.revocation;
    const record = previous?.sessionId === sessionId ? previous : { sessionId, source, uncertain: false };
    try { rememberRevocation({ ...record, uncertain: true }); }
    catch {
      setState(current => ({ ...current, revocation: { ...record, phase: 'failed' } }));
      throw logoutError('failed');
    }
    revocationsRef.current = [...revocationsRef.current.filter(value => value.sessionId !== sessionId), record];
    revocationRunningRef.current = true;
    generationRef.current += 1;
    invalidateOperation(); bumpIdentity();
    const generation = generationRef.current;
    const epoch = identityEpochRef.current;
    setState(current => source === 'logout'
      ? { ...current, revocation: { ...record, phase: 'running' } }
      : signedOut(current, { revocation: { ...record, phase: 'running' } }));
    try {
      const outcome = await client.logout({ sessionId });
      if (generation !== generationRef.current || epoch !== identityEpochRef.current) return;
      if (outcome.kind === 'no-content') {
        try { forgetRevocation(sessionId); }
        catch { throw logoutError('unconfirmed'); }
        revocationsRef.current = revocationsRef.current.filter(value => value.sessionId !== sessionId);
        lockedRef.current = false; setLocked(false);
        rotatePageContext(); notifyPeers();
        prepareLoginRef.current = true;
        setState(current => signedOut(current, { status: source === 'logout' ? 'booting' : 'anonymous',
          revocation: { ...record, phase: 'running' } }));
        await bootstrap({ generation: generationRef.current, anonymousOnly: true });
        return;
      }
      const uncertain = record.uncertain || outcome.kind !== 'problem';
      const next = { ...record, uncertain, phase: uncertain ? 'unknown' : 'failed' };
      try { rememberRevocation(next); } catch { /* The original intent still remains. */ }
      revocationsRef.current = revocationsRef.current.map(value => value.sessionId === sessionId ? next : value);
      lockedRef.current = uncertain || source !== 'logout'; setLocked(lockedRef.current);
      setState(current => ({ ...current, revocation: next }));
      throw logoutError(uncertain ? 'unconfirmed' : 'failed', outcome);
    } catch (error) {
      if (generation === generationRef.current && epoch === identityEpochRef.current && error.kind === 'logout-unconfirmed') {
        lockedRef.current = true; setLocked(true);
        setState(current => ({ ...current, revocation: { ...record, uncertain: true, phase: 'unknown' } }));
      }
      throw error;
    } finally { revocationRunningRef.current = false; }
  }, [bootstrap, bumpIdentity, client, invalidateOperation, notifyPeers, rotatePageContext]);

  const retryRevocation = useCallback(async () => {
    const target = stateRef.current.revocation;
    if (target) await revokeTarget(target).catch(() => {});
  }, [revokeTarget]);
  const abandonPending = useCallback(() => {
    const sessionId = stateRef.current.pending?.id;
    if (sessionId) void revokeTarget({ sessionId, source: 'pending' }).catch(() => {});
  }, [revokeTarget]);
  const returnFromRecovery = useCallback(() => {
    const sessionId = stateRef.current.recovery?.id;
    if (sessionId) void revokeTarget({ sessionId, source: 'recovery' }).catch(() => {});
    else { rotatePageContext(); prepareLoginRef.current = true; void boot(); }
  }, [boot, revokeTarget, rotatePageContext]);
  const retry = useCallback(() => { void boot(); }, [boot]);
  const dismissNotice = useCallback(() => {
    setState(current => current.notice ? { ...current, notice: null } : current);
  }, []);
  const logout = useCallback(async () => {
    if (stateRef.current.deletion) throw new Error('Account deletion is awaiting confirmation');
    const target = stateRef.current.revocation;
    const sessionId = target?.sessionId ?? stateRef.current.session?.id;
    if (sessionId) await revokeTarget({ sessionId, source: target?.source ?? 'logout' });
  }, [revokeTarget]);

  const deleteAccount = useCallback(async email => {
    if (deletionRunningRef.current) return;
    const current = stateRef.current;
    if (current.revocation) throw new Error('Account revocation is awaiting confirmation');
    const deletion = current.deletion ?? {
      account: current.account, locale: i18n.language,
      body: { requestId: deletionRequestId(), sessionId: current.session?.id, email: normalizeEmail(email) },
    };
    if (!deletion.account || !deletion.body.sessionId) throw new Error('deletion-identity');
    rememberDeletion(deletion);
    selectDeletion(deletion.body.requestId);
    deletionsRef.current = listDeletions();
    deletionRunningRef.current = true;
    lockedRef.current = true; setLocked(true); bumpIdentity();
    const generation = generationRef.current;
    const epoch = identityEpochRef.current;
    const currentDeletion = () => generation === generationRef.current && epoch === identityEpochRef.current;
    setState(value => ({ ...value, status: 'deleting', deletion, deletionRunning: true, deletionError: null }));
    try {
      let outcome = await client.deleteAccount(deletion.body);
      if (!currentDeletion()) return;
      let contextLost = false;
      let sessionUnavailable = false;
      if (outcome.kind === 'problem' && [PROBLEM.BROWSER_CONTEXT_REQUIRED, PROBLEM.SESSION_INVALID].includes(outcome.type)) {
        const check = await client.getSession();
        if (!currentDeletion()) return;
        contextLost = (check.kind === 'result' && !check.data.browserReady)
          || (check.kind === 'problem' && check.type === PROBLEM.SESSION_INVALID);
        if (check.kind === 'result' && check.data.browserReady) {
          const originalTarget = deletion.body.sessionId;
          if (check.data.rememberedSession?.id === originalTarget
            && !revocationsRef.current.some(value => value.sessionId === originalTarget)) {
            // The original request might never have reached I08. Restore only
            // its exact remembered target, without publishing a business identity.
            const restored = await client.restoreSession({ sessionId: originalTarget });
            if (!currentDeletion()) return;
            if (restored.kind === 'result' && restored.data.session?.state === 'active'
              && restored.data.session.id === originalTarget) {
              outcome = await client.deleteAccount(deletion.body);
              if (!currentDeletion()) return;
              sessionUnavailable = outcome.kind === 'problem' && outcome.type === PROBLEM.SESSION_INVALID;
            } else {
              sessionUnavailable = restored.kind === 'problem' && restored.type === PROBLEM.SESSION_INVALID;
            }
          } else sessionUnavailable = true;
        }
      }
      if (outcome.kind !== 'no-content') {
        const rejected = outcome.kind === 'problem' && [400, 403, 415, 422].includes(outcome.status);
        if (rejected && !current.deletion) {
          forgetDeletion(deletion.body.requestId); deletionsRef.current = listDeletions(); lockedRef.current = false; setLocked(false);
          setState(value => ({ ...value, ...current, deletion: null }));
          throw new Error('deletion-rejected');
        }
        setState(value => ({ ...value, deletionRunning: false,
          deletionError: contextLost ? 'context-lost' : sessionUnavailable ? 'session-unavailable'
            : outcome.type === PROBLEM.DELETION_INCOMPLETE ? 'incomplete' : 'unknown' }));
        return;
      }
      // A 401 or anonymous session is never a substitute for this 204 receipt.
      try { if (typeof onAccountDeleted !== 'function') throw new Error('deletion-device-cleaner-required');
        await onAccountDeleted(deletion.account.accountKey);
        // A confirmed new deletion also makes older commands for this exact
        // account redundant. Keep the current receipt until all removals succeed.
        for (const old of listDeletions()) {
          if (old.account.accountKey === deletion.account.accountKey && old.body.requestId !== deletion.body.requestId)
            forgetDeletion(old.body.requestId);
        }
        forgetDeletion(deletion.body.requestId);
        deletionsRef.current = listDeletions(); }
      catch {
        if (currentDeletion()) setState(value => ({ ...value, deletionRunning: false, deletionError: 'device' }));
        return;
      }
      if (!currentDeletion()) return;
      lockedRef.current = false; setLocked(false);
      rotatePageContext(); notifyPeers();
      setState(value => signedOut(value, { deletion: null, deletionRunning: false, deletionError: null }));
    } finally { deletionRunningRef.current = false; }
  }, [bumpIdentity, client, notifyPeers, onAccountDeleted, rotatePageContext]);

  const returnFromDeletionVerification = useCallback(async () => {
    if (deletionRunningRef.current || stateRef.current.deletionError !== 'context-lost') return;
    // Explicitly leave an unverifiable intent. Preserve account-scoped device
    // drafts: no successful deletion receipt was received by this browser.
    selectDeletion(null); deletionDeferredRef.current = true;
    lockedRef.current = false; setLocked(false);
    rotatePageContext();
    setState(current => signedOut(current, {
      status: 'booting', deletion: null, deletionRunning: false, deletionError: null,
    }));
    await bootstrap({ generation: generationRef.current, notice: () => COPY.deletionUnverifiable, anonymousOnly: true });
  }, [bootstrap, rotatePageContext]);

  const resumeDeletion = useCallback(requestId => {
    try {
      const deletion = readDeletion(requestId);
      if (deletion) { generationRef.current += 1; invalidateOperation(); enterDeletion(deletion); }
    } catch { setState(current => ({ ...current, status: 'error', errorKind: 'boot' })); }
  }, [enterDeletion, invalidateOperation]);
  const deferDeletion = useCallback(async () => {
    if (deletionRunningRef.current) return;
    selectDeletion(null); deletionDeferredRef.current = true;
    lockedRef.current = false; setLocked(false);
    rotatePageContext(); prepareLoginRef.current = true;
    setState(current => signedOut(current, { status: 'booting', deletion: null, deletionError: null }));
    await bootstrap({ generation: generationRef.current, anonymousOnly: true });
  }, [bootstrap, rotatePageContext]);
  const logoutState = state.revocation?.phase ?? 'idle';
  const pendingDeletions = deletionsRef.current.map(value => ({ requestId: value.body.requestId, nickname: value.account.nickname, email: value.account.email }));

  const publicValue = useMemo(() => ({
    status: state.status,
    account: state.status === 'active' ? state.account : null,
    request,
    logout,
    logoutState,
    deleteAccount,
    pendingDeletions,
    resumeDeletion,
  }), [state.status, state.account, request, logout, logoutState, deleteAccount, state.pendingDeletions, state.deletion, resumeDeletion]);

  const internalValue = useMemo(() => ({
    ...state,
    pendingDeletions,
    resumeDeletion,
    deferDeletion,
    retryRevocation,
    logoutState,
    deleteAccount,
    returnFromDeletionVerification,
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
    resumeDeletion,
    deferDeletion,
    retryRevocation,
    logoutState,
    deleteAccount,
    returnFromDeletionVerification,
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
