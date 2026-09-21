import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import SidebarEditingPrototype from './SidebarEditingPrototype.jsx';
import AuthEntry from './auth/AuthEntry.jsx';
import {
  PrototypeAuth,
  REQUEST_LATENCY_MS,
  RESET_KEY,
  SESSION_KEY,
  clearStoredSessionFor,
  normalizeEmail,
  readStoredSessionStatus,
  request,
  setCodeTtl,
  setResendCooldown,
  setSessionTtl
} from './auth/demo-data.js';
import '@workspace-styles';
import './auth/authEntry.css';

const EXPIRED_NOTICE = { message: '登录状态已过期，请重新登录。', tone: 'error' };
const RESTORE_FAILURE_NOTICE = { message: '暂时无法恢复登录状态，请重试或返回登录。', tone: 'error' };
const bootParams = new URLSearchParams(window.location.search);

if (bootParams.has('dev-cooldown')) setResendCooldown(Number(bootParams.get('dev-cooldown')));
if (bootParams.has('dev-session-ttl')) setSessionTtl(Number(bootParams.get('dev-session-ttl')));
if (bootParams.has('dev-code-ttl')) setCodeTtl(Number(bootParams.get('dev-code-ttl')));

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function RestoreCard({ checking, onRetry, onReturn }) {
  return (
    <div className="ae-page">
      <div className="ae-shell">
        <header className="ae-brand">
          <span className="ae-restore-brand"><span className="ae-restore-mark">T</span><span>TeachBuddy</span></span>
        </header>
        <div className="ae-card ae-restore-card">
          <div className="ae-card-head">
            <h1>{checking ? '恢复登录状态' : '恢复失败'}</h1>
          </div>
          {checking ? (
            <p className="ae-restore-message" role="status">正在恢复登录状态，请稍候…</p>
          ) : (
            <>
              <p className="ae-restore-message" role="alert">{RESTORE_FAILURE_NOTICE.message}</p>
              <div className="ae-restore-actions">
                <button className="ae-primary" type="button" onClick={onRetry}>重试</button>
                <button className="ae-send is-block" type="button" onClick={onReturn}>返回登录</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const authRef = useRef(null);
  const forcedCodeIndexes = useRef(new Map());
  const lostResponseKinds = useRef(new Set());
  const restoreAttempt = useRef(0);
  const restoreStarted = useRef(false);
  if (!authRef.current) authRef.current = new PrototypeAuth();
  const auth = authRef.current;

  const [initialStatus] = useState(() => readStoredSessionStatus());
  const [restoreSaved, setRestoreSaved] = useState(() => initialStatus.session);
  const [restoreState, setRestoreState] = useState(() => (
    initialStatus.session ? 'checking' : initialStatus.reason === 'invalid' ? 'failed' : 'idle'
  ));
  const [restoreReason, setRestoreReason] = useState(() => initialStatus.reason);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [pendingSession, setPendingSession] = useState(null);
  const [mode, setMode] = useState('login');
  const [notice, setNotice] = useState(() => {
    if (initialStatus.reason === 'expired') return EXPIRED_NOTICE;
    if (initialStatus.reason === 'invalid') return RESTORE_FAILURE_NOTICE;
    return null;
  });
  const initialRegistrationOpen = bootParams.get('registration') !== 'closed' && !bootParams.has('dev-register-closed');
  const [registrationOpen, setRegistrationOpen] = useState(initialRegistrationOpen);

  useEffect(() => {
    document.body.className = user ? 'tb-workbench' : 'ae-entry';
  }, [user]);

  useEffect(() => {
    auth.setRegistrationOpen(initialRegistrationOpen);
    const rawDelay = bootParams.get('dev-register-closes-after');
    const delay = Number(rawDelay);
    if (rawDelay === null || !Number.isFinite(delay) || delay < 0) return undefined;
    const timer = setTimeout(() => {
      auth.setRegistrationOpen(false);
      setRegistrationOpen(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [auth, initialRegistrationOpen]);

  function expireCurrentSession(message = EXPIRED_NOTICE) {
    auth.endSession(session);
    setSession(null);
    setUser(null);
    setMode('login');
    setNotice(message);
    setPendingSession(null);
  }

  function expirePendingSession(message = EXPIRED_NOTICE) {
    if (pendingSession?.session) auth.endSession(pendingSession.session);
    setPendingSession(null);
    setMode('login');
    setNotice(message);
  }

  async function restoreSavedSession(saved = restoreSaved) {
    if (!saved) {
      setRestoreState('idle');
      setNotice(RESTORE_FAILURE_NOTICE);
      return;
    }
    const attempt = restoreAttempt.current + 1;
    restoreAttempt.current = attempt;
    setRestoreState('checking');
    setNotice(null);
    try {
      const restoreMode = bootParams.get('dev-restore');
      if (restoreMode === 'fail' && attempt === 1) {
        const failure = new Error('restore failed');
        failure.kind = 'restore-failed';
        throw failure;
      }
      if (restoreMode === 'slow' || restoreMode === 'slow-fail') await wait(1200);
      if (restoreMode === 'slow-fail') {
        const failure = new Error('restore failed');
        failure.kind = 'restore-failed';
        throw failure;
      }
      const restored = await request('restore-session', async () => auth.restoreSession(saved));
      if (attempt !== restoreAttempt.current) return;
      const currentStatus = readStoredSessionStatus();
      const currentSaved = currentStatus.session;
      const sameSavedSession = currentSaved
        && currentSaved.sessionId === saved.sessionId
        && normalizeEmail(currentSaved.email) === normalizeEmail(saved.email);
      if (!sameSavedSession) {
        if (!currentSaved) {
          setRestoreSaved(null);
          setRestoreReason(currentStatus.reason === 'expired' ? 'expired' : 'removed');
          setRestoreState('idle');
          setMode('login');
          setNotice(EXPIRED_NOTICE);
        } else {
          setRestoreReason('replaced');
          setRestoreState('failed');
          setNotice(RESTORE_FAILURE_NOTICE);
        }
        return;
      }
      if (!restored) {
        if (!auth.isAccountStoreAvailable()) {
          setRestoreReason('storage');
          setRestoreState('failed');
          setNotice(null);
          return;
        }
        setRestoreReason('revoked');
        setRestoreSaved(null);
        setRestoreState('idle');
        setMode('login');
        setNotice(EXPIRED_NOTICE);
        return;
      }
      if (!auth.isSessionValid(restored)) {
        setRestoreReason('revoked');
        setRestoreSaved(null);
        setRestoreState('idle');
        setMode('login');
        setNotice(EXPIRED_NOTICE);
        return;
      }
      setRestoreReason('found');
      setSession(restored);
      setUser(auth.sessionUser(restored));
      setRestoreState('idle');
      setNotice(null);
    } catch {
      if (attempt !== restoreAttempt.current) return;
      setRestoreReason('failed');
      setRestoreState('failed');
    }
  }

  useEffect(() => {
    if (restoreState !== 'checking' || !restoreSaved || restoreStarted.current) return undefined;
    restoreStarted.current = true;
    restoreSavedSession(restoreSaved);
    return undefined;
  }, []);

  useEffect(() => {
    if (!session?.remember || !user) return undefined;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      expireCurrentSession();
      return undefined;
    }
    const timer = setTimeout(() => expireCurrentSession(), remaining + 1);
    return () => clearTimeout(timer);
  }, [session, user]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== null && event.key !== SESSION_KEY && event.key !== RESET_KEY) return;
      if (!session) {
        if (pendingSession && event.key === RESET_KEY && !auth.isSessionValid(pendingSession.session)) {
          expirePendingSession();
          return;
        }
        if (restoreState === 'checking' && (event.key === SESSION_KEY || event.key === null)) {
          const currentSaved = readStoredSessionStatus().session;
          if (!currentSaved) {
            restoreAttempt.current += 1;
            setRestoreSaved(null);
            setRestoreReason('removed');
            setRestoreState('idle');
            setMode('login');
            setNotice(EXPIRED_NOTICE);
          }
        }
        return;
      }
      if (event.key === SESSION_KEY && session.remember) {
        const currentSaved = readStoredSessionStatus().session;
        if (!currentSaved || currentSaved.sessionId !== session.id) expireCurrentSession();
        return;
      }
      if (event.key === null && session.remember && !readStoredSessionStatus().session) {
        expireCurrentSession();
        return;
      }
      if (event.key === RESET_KEY && !auth.isSessionValid(session)) expireCurrentSession();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [auth, pendingSession, restoreSaved, restoreState, session]);

  async function signedIn({ user: nextUser, session: nextSession }) {
    const persisted = auth.persistSession(nextSession);
    if (nextSession?.remember && !persisted) {
      setPendingSession({ user: nextUser, session: nextSession });
      return { persisted: false };
    }
    setSession(nextSession);
    setUser(nextUser);
    setNotice(null);
    return { persisted: true };
  }

  function continuePendingSession() {
    if (!pendingSession) return;
    if (!auth.isSessionValid(pendingSession.session)) {
      expirePendingSession();
      return;
    }
    const temporarySession = { ...pendingSession.session, remember: false, expiresAt: 0 };
    setSession(temporarySession);
    setUser({ ...pendingSession.user, remember: false });
    setPendingSession(null);
    setNotice(null);
  }

  function retryPendingSession() {
    if (!pendingSession) return { persisted: false };
    if (!auth.isSessionValid(pendingSession.session)) {
      expirePendingSession();
      return { persisted: false, invalid: true };
    }
    const persisted = auth.persistSession(pendingSession.session);
    if (!persisted) return { persisted: false };
    if (!auth.isSessionValid(pendingSession.session)) {
      auth.endSession(pendingSession.session);
      expirePendingSession();
      return { persisted: false, invalid: true };
    }
    setSession(pendingSession.session);
    setUser(pendingSession.user);
    setPendingSession(null);
    setNotice(null);
    return { persisted: true };
  }

  function abandonPendingSession() {
    if (!pendingSession) return;
    auth.endSession(pendingSession.session);
    setPendingSession(null);
  }

  function shouldLoseResponse(kind, result) {
    const setting = bootParams.get('dev-result');
    if (!result?.ok || !setting) return false;
    const wanted = new Set(setting.split(',').map((value) => value.trim()).filter(Boolean));
    if (!wanted.has(kind) || lostResponseKinds.current.has(kind)) return false;
    lostResponseKinds.current.add(kind);
    return true;
  }

  async function callBusiness(kind, run) {
    const result = await request(kind, run);
    if (shouldLoseResponse(kind === 'reset-password' ? 'reset' : kind, result)) {
      const failure = new Error(kind === 'register'
        ? '注册结果暂未确认，请返回登录并尝试使用刚提交的信息。'
        : '重置结果暂未确认，请返回登录并尝试使用新密码。');
      failure.kind = 'unknown-result';
      throw failure;
    }
    return result;
  }

  async function signIn(values = {}) {
    return callBusiness('sign-in', async () => auth.signIn(values));
  }

  async function register(values = {}) {
    return callBusiness('register', async () => auth.register(values));
  }

  async function sendCode({ email, purpose }) {
    const params = new URLSearchParams(window.location.search);
    const codes = (params.get('dev-code') || '').split(',').filter((code) => /^[0-9]{6}$/.test(code));
    const key = `${purpose}:${email}`;
    const index = forcedCodeIndexes.current.get(key) || 0;
    const forced = codes.length ? codes[Math.min(index, codes.length - 1)] : undefined;
    const force = params.has('dev-no-cooldown');
    const sent = await request('send-code', async () => auth.sendCode({ email, purpose, code: forced, force }));
    forcedCodeIndexes.current.set(key, index + 1);
    return sent;
  }

  async function confirmRecovery(values) {
    return callBusiness('reset-password', async () => auth.resetPassword(values));
  }

  function returnToLoginFromRestore() {
    if (restoreSaved?.email) clearStoredSessionFor(restoreSaved.email, restoreSaved.sessionId);
    setRestoreSaved(null);
    setRestoreReason('returned');
    setRestoreState('idle');
    setMode('login');
    setNotice(null);
  }

  if (restoreState === 'checking') {
    return <RestoreCard checking onRetry={() => restoreSavedSession()} onReturn={returnToLoginFromRestore} />;
  }
  if (restoreState === 'failed') {
    return <RestoreCard onRetry={() => restoreSavedSession()} onReturn={returnToLoginFromRestore} />;
  }

  return user ? (
    <SidebarEditingPrototype accountName={user.name} />
  ) : (
    <AuthEntry
      auth={auth}
      mode={mode}
      onModeChange={setMode}
      registrationOpen={registrationOpen}
      notice={notice}
      onNotice={setNotice}
      onDismissNotice={() => setNotice(null)}
      onSubmit={(values) => (values.name ? register(values) : signIn(values))}
      onSignedIn={signedIn}
      onContinueSession={continuePendingSession}
      onRetrySession={retryPendingSession}
      onAbandonSession={abandonPendingSession}
      pendingSessionAvailable={Boolean(pendingSession)}
      onSendCode={sendCode}
      onConfirmRecovery={confirmRecovery}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
