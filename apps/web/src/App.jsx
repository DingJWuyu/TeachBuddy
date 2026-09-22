import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, AuthGate, useAuth } from './features/auth/index.jsx';
import WorkbenchRoot from './features/workbench/WorkbenchRoot.jsx';

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
        // Deliberately do not restore rememberedSession: this page signed out.
        if (live) onReady();
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; controller.abort(); };
  }, [attempt, request, onReady]);
  return <div className="wb-gate"><div className="wb-gate-card" aria-busy={!failed}>
    <h1>{failed ? '暂时无法准备登录' : '正在准备登录'}</h1>
    {failed && <button className="wb-button" onClick={() => setAttempt(value => value + 1)}>重试</button>}
  </div></div>;
}

function AuthenticatedWorkspace() {
  const { status } = useAuth();
  const [needsBrowserContext, setNeedsBrowserContext] = useState(false);
  useEffect(() => {
    if (status === 'active') setNeedsBrowserContext(true);
  }, [status]);
  const entryReady = useCallback(() => setNeedsBrowserContext(false), []);
  if (status === 'anonymous' && needsBrowserContext) return <PrepareLogin onReady={entryReady} />;
  return <AuthGate><WorkbenchRoot /></AuthGate>;
}

export default function App() {
  return <AuthProvider><AuthenticatedWorkspace /></AuthProvider>;
}
