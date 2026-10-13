/*
 * Contract harness for the account-entry feature. It mounts AuthProvider and
 * AuthGate exactly as the integrator will, and adds the minimum workbench-like
 * shell: an account row, a settings logout button and a runner for the
 * protected workbench operations. Only the transport and handoff surface are
 * exercised here; the harness is a test fixture, not product code.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthGate, AuthProvider, useAuth } from '../../../../src/features/auth/index.jsx';
import '../../../../src/styles/global.css';
import './harness.css';

import { WORKBENCH_OPERATIONS as OPERATIONS, buildInit } from '../workbench-operations.mjs';

function WorkbenchShell() {
  const auth = useAuth();
  const [results, setResults] = useState([]);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function runOperation(operation) {
    try {
      const response = await auth.request(operation.path, buildInit(operation));
      setResults((current) => [...current, `${operation.id}:${response.status}`]);
    } catch (error) {
      setResults((current) => [...current, `${operation.id}:threw:${error?.kind || error?.name}`]);
    }
  }

  async function runAll() {
    for (const operation of OPERATIONS) {
      // Sequential on purpose: the request log then has a stable order.
      // eslint-disable-next-line no-await-in-loop
      await runOperation(operation);
    }
  }

  async function runRaw(path, init) {
    try {
      const response = await auth.request(path, init);
      setResults((current) => [...current, `${path}:${response.status}`]);
      return response.status;
    } catch (error) {
      setResults((current) => [...current, `${path}:threw:${error?.kind || error?.name}`]);
      return null;
    }
  }

  async function onLogout() {
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await auth.logout();
    } catch (error) {
      setLogoutError(error?.kind === 'logout-unconfirmed' ? '退出结果暂未确认' : '退出失败，请重试');
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <div className="harness-shell">
      <header className="harness-topbar">
        <strong>契约替身工作台</strong>
        <span data-harness-nickname>{auth.account?.nickname || ''}</span>
        <span data-harness-account-key>{auth.account?.accountKey || ''}</span>
        <button type="button" data-harness-logout onClick={onLogout} disabled={logoutBusy}>
          {logoutBusy ? '退出中' : '退出登录'}
        </button>
      </header>
      {logoutError && <p data-harness-logout-error role="alert">{logoutError}</p>}
      <section className="harness-panel">
        <div className="harness-actions">
          <button type="button" data-harness-run-all onClick={runAll}>依次请求所有受保护操作</button>
          <button
            type="button"
            data-harness-business-401
            onClick={() => runRaw('/api/workbench/context', { method: 'GET' })}
          >
            业务请求（观察 401）
          </button>
          <button
            type="button"
            data-harness-external
            onClick={() => runRaw('/api/workbench/context', { method: 'GET' })}
          >
            复核身份
          </button>
        </div>
        <pre data-harness-results>{results.join('\n')}</pre>
      </section>
    </div>
  );
}

function HarnessBridge() {
  const auth = useAuth();
  useEffect(() => {
    window.__authHarness = {
      run: async (operationId, init) => {
        const operation = OPERATIONS.find((item) => item.id === operationId);
        if (!operation) throw new Error(`unknown harness operation: ${operationId}`);
        const response = await auth.request(operation.path, init || buildInit(operation));
        return { status: response.status, operationId };
      },
      request: async (path, init) => {
        const response = await auth.request(path, init);
        return { status: response.status, type: response.headers.get('content-type') };
      },
      status: () => auth.status,
      account: () => auth.account,
      logout: () => auth.logout(),
    };
  }, [auth]);
  return null;
}

function HarnessApp() {
  const params = new URLSearchParams(window.location.search);
  const timeoutMs = Number(params.get('requestTimeoutMs')) || 10_000;
  return (
    <AuthProvider timeoutMs={timeoutMs}>
      <AuthGate>
        <WorkbenchShell />
      </AuthGate>
      <HarnessBridge />
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HarnessApp />
  </StrictMode>
);
