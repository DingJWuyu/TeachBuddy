import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MathWorkbench } from "../../../src/features/math/index.jsx";
import { AuthProvider, AuthGate, useAuth } from "../../../src/features/auth/index.jsx";
const nativeTest = new URLSearchParams(location.search).has('testPrincipal');
// Match App's post-sign-out preparation through the public auth seam. The
// isolated math entry does not mount App or own the authentication lifecycle.
function PrepareLogin({ onReady }) {
  const { request } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setFailed(false);
    void (async () => {
      try {
        const init = { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) };
        const created = await request('/api/auth/session', {
          ...init, method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bootstrap' })
        });
        if (!created.ok) throw new Error('Browser context unavailable');
        const checked = await request('/api/auth/session', init);
        if (!checked.ok || (await checked.json()).browserReady !== true) throw new Error('Cookie unavailable');
        // This document signed out; never restore the remembered target here.
        if (live) onReady();
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; controller.abort(); };
  }, [attempt, request, onReady]);
  return <main className="ae-page"><div className="ae-shell"><section className="ae-card" aria-busy={!failed}>
    <div className="ae-card-head"><h1>{failed ? '暂时无法准备登录' : '正在准备登录'}</h1></div>
    {failed && <div className="ae-form"><button className="ae-primary" onClick={() => setAttempt(value => value + 1)}>重试</button></div>}
  </section></div></main>;
}

function AuthenticatedMath() {
  const { status } = useAuth();
  const [needsBrowserContext, setNeedsBrowserContext] = useState(false);
  useEffect(() => {
    if (status === 'active') setNeedsBrowserContext(true);
  }, [status]);
  const entryReady = useCallback(() => setNeedsBrowserContext(false), []);
  if (status === 'anonymous' && needsBrowserContext) return <PrepareLogin onReady={entryReady} />;
  return <AuthGate><MathPage /></AuthGate>;
}

function MathPage() {
  const { logout } = useAuth();
  return <><button className="math-logout" onClick={() => logout()}>退出登录</button><MathWorkbench /></>;
}
createRoot(document.getElementById("root")).render(nativeTest
  ? <MathWorkbench transport={window.fetch.bind(window)} />
  : <AuthProvider><AuthenticatedMath /></AuthProvider>);
