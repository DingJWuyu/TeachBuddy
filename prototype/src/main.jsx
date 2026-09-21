import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import SidebarEditingPrototype from './SidebarEditingPrototype.jsx';
import AuthEntry from './auth/AuthEntry.jsx';
import {
  PrototypeAuth,
  SESSION_KEY,
  readStoredSession,
  request,
  setResendCooldown
} from './auth/demo-data.js';
import '@workspace-styles';
import './auth/authEntry.css';

/*
 * Shown when a session ends without the user asking for it: the stored session
 * was dropped in another tab, or its lifetime ran out.
 */
const EXPIRED_NOTICE = { message: '登录状态已过期，请重新登录。', tone: 'error' };

const bootParams = new URLSearchParams(window.location.search);

/* Check-run seam: a shortened resend cooldown for this page load. */
if (bootParams.has('dev-cooldown')) setResendCooldown(Number(bootParams.get('dev-cooldown')));

function App() {
  const authRef = useRef(null);
  const injectedCodeIndex = useRef(0);
  if (!authRef.current) authRef.current = new PrototypeAuth();
  const auth = authRef.current;

  /* A page load starts from whatever session survived it. A session the user
   * never asked to be remembered does not survive a reload. */
  const refused = useRef(false);
  const restored = useMemo(() => {
    const saved = readStoredSession();
    if (!saved) return null;
    const session = auth.restoreSession(saved);
    /* A stored session the account has retired since it was issued: the page
     * load drops it and says why. */
    if (!session) refused.current = true;
    return session;
  }, [auth]);

  const [user, setUser] = useState(() => (restored ? auth.sessionUser(restored) : null));
  const [mode, setMode] = useState('login');
  const [notice, setNotice] = useState(() => (refused.current ? EXPIRED_NOTICE : null));

  useEffect(() => {
    document.body.className = user ? 'tb-workbench' : 'ae-entry';
  }, [user]);

  /* Another tab dropping the session is an external event here: the user is
   * told why they are back on the entry card instead of being left to guess. */
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== null && event.key !== SESSION_KEY) return;
      if (readStoredSession()) return;
      setUser(null);
      setMode('login');
      setNotice(EXPIRED_NOTICE);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function signedIn({ user: nextUser, session: nextSession }) {
    setUser(nextUser);
    setNotice(null);
    auth.persistSession(nextSession);
  }

  async function signIn(values = {}) {
    return request('sign-in', async () => signedIn(await auth.signIn(values)));
  }

  async function register(values = {}) {
    return request('register', async () => signedIn(auth.register(values)));
  }

  async function sendCode({ email, purpose }) {
    const allowed = purpose === 'register' ? !auth.isRegistered(email) : auth.isRegistered(email);
    const params = new URLSearchParams(window.location.search);
    // A sequence lets the resend check prove both old-code rejection and
    // new-code acceptance. Never treat the entire comma-separated list as a code.
    const codes = (params.get('dev-code') || '').split(',').filter((code) => /^[0-9]{6}$/.test(code));
    const forced = codes[Math.min(injectedCodeIndex.current, codes.length - 1)];
    /* Checking the resend cooldown itself must not take half a minute per case,
     * so a check run can waive it. Neither parameter changes what the interface
     * shows or what the product does by default. */
    const force = params.has('dev-no-cooldown');
    return request('send-code', async () => {
      if (!allowed) throw new Error('这个地址不能接收验证码。');
      const sent = await auth.sendCode({ email, purpose, code: forced, force });
      injectedCodeIndex.current += 1;
      return sent;
    });
  }

  /* Transport failures are thrown for the entry to show as a card-level
   * message; a verdict about the code or the address comes back as a field
   * refusal. */
  async function confirmRecovery(values) {
    const verdict = await request('reset-password', async () => auth.resetPassword(values));
    if (verdict.ok) {
      /* The reset retired every session of the account, this one included. */
      setUser(null);
      setMode('login');
      return null;
    }
    if (verdict.kind === 'unknown-account') {
      return { field: 'email', message: '这个邮箱没有可重置的账户。' };
    }
    if (verdict.kind === 'exhausted') {
      return { field: 'code', message: '验证码错误次数过多，请重新发送。' };
    }
    if (verdict.kind === 'mismatch') {
      return { field: 'code', message: `验证码不正确，还可以再试 ${verdict.remaining ?? 0} 次。` };
    }
    if (verdict.kind === 'expired') return { field: 'code', message: '验证码已过期，请重新发送。' };
    if (verdict.kind === 'used') return { field: 'code', message: '验证码已经用过了，请重新发送。' };
    return { field: 'code', message: '验证码已失效，请重新发送。' };
  }

  return (
    user ? <SidebarEditingPrototype /> : (
      <AuthEntry
        auth={auth}
        mode={mode}
        onModeChange={setMode}
        notice={notice}
        onNotice={setNotice}
        onDismissNotice={() => setNotice(null)}
        onSubmit={(values) => (values.name ? register(values) : signIn(values))}
        onSendCode={sendCode}
        onConfirmRecovery={confirmRecovery}
      />
    )
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
