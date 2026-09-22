/**
 * T52 browser harness entry.
 *
 * It boots the real workbench identity probe and renders the schedule feature
 * inside the real shared shell pieces (`ShellContext`, `AuxiliaryPanel`,
 * `AiWorkspace`, `useScene`). Only the production page routing/catalog wiring is
 * replaced: that belongs to T53, and this harness exists so the schedule grid
 * can be driven by real pointer input against the real API before T53 lands.
 */
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SchedulePage from '../src/features/schedule/index.jsx';
import { AuxiliaryPanel } from '../src/features/workbench/AuxiliaryPanel.jsx';
import { Icon } from '../src/features/workbench/icons.jsx';
import { ShellContext } from '../src/features/workbench/shellContext.js';
import { getWorkbenchContext, setIdentityLostListener } from '../src/features/workbench/apiClient.js';
import { useScene } from '../src/features/workbench/useScene.js';
import { canPersistLocally, setStorageFailureListener } from '../src/features/workbench/storage.js';
import '../src/features/workbench/workbench.css';

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1080px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1080px)');
    const listener = (event) => setNarrow(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return narrow;
}

function Harness({ accountKey, generation }) {
  const narrow = useIsNarrow();
  const [scene, patchScene] = useScene(accountKey, 'shell', {
    panelOpen: false,
    panelMode: 'ai',
    panelWidth: 320
  });
  const [tools, setTools] = useState([]);
  const registerTools = useCallback((next) => setTools(next), []);
  const openPanel = useCallback((mode = 'ai') => patchScene({ panelOpen: true, panelMode: mode }), [patchScene]);

  const shell = useMemo(() => ({
    accountKey,
    generation,
    storageFailed: false,
    narrow,
    isPanelOpen: Boolean(scene.panelOpen),
    panelMode: scene.panelMode || 'ai',
    panelWidth: scene.panelWidth || 320,
    tools,
    registerTools,
    openPanel,
    closePanel: () => patchScene({ panelOpen: false }),
    setPanelMode: (mode) => patchScene({ panelMode: mode }),
    setPanelWidth: (width) => patchScene({ panelWidth: width }),
    notifyIdentityLost: () => setIdentityLostListener(null),
    navigate: () => {}
  }), [accountKey, generation, narrow, scene.panelMode, scene.panelOpen, scene.panelWidth, tools, registerTools, openPanel, patchScene]);

  return (
    <ShellContext.Provider value={shell}>
      <div
        className={`wb-shell${narrow ? ' is-narrow' : ''}`}
        data-region="harness-shell"
        data-route="schedule"
        data-panel={shell.isPanelOpen ? 'open' : 'closed'}
        data-panel-mode={shell.panelMode}
      >
        <header className="wb-topbar">
          <span className="wb-brand">
            <span className="wb-brand-mark" aria-hidden="true">T</span>
            TeachBuddy
          </span>
          <div className="wb-topbar-spacer" />
          <button
            type="button"
            className="wb-button wb-panel-toggle"
            data-action="toggle-panel"
            aria-pressed={shell.isPanelOpen}
            onClick={() => (shell.isPanelOpen ? shell.closePanel() : openPanel('ai'))}
          >
            <Icon name="sparkle" size={15} />
            {shell.isPanelOpen ? '关闭辅助栏' : 'AI 助理'}
          </button>
          <span className="wb-account-chip" data-region="account-chip">{accountKey}</span>
        </header>
        <div className="wb-body">
          <div className="wb-workspace">
            <main className="wb-main" data-region="main">
              <SchedulePage />
            </main>
            {shell.isPanelOpen && <AuxiliaryPanel />}
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

function Gate({ title, detail }) {
  return (
    <div className="wb-gate" data-region="identity-gate">
      <div className="wb-gate-card">
        <h1>{title}</h1>
        <p className="wb-note">{detail}</p>
      </div>
    </div>
  );
}

function Boot() {
  const [boot, setBoot] = useState({ mode: 'loading', accountKey: null, generation: 0 });

  useEffect(() => {
    canPersistLocally();
    setStorageFailureListener(() => {});
    setIdentityLostListener(() => setBoot((current) => ({ ...current, mode: 'identity' })));
    getWorkbenchContext()
      .then(({ body }) => setBoot((current) => ({
        ...current,
        mode: 'ready',
        accountKey: body.accountKey,
        generation: current.generation + 1
      })))
      .catch(() => setBoot((current) => ({ ...current, mode: 'unavailable' })));
  }, []);

  if (boot.mode === 'ready') {
    return <Harness key={boot.accountKey} accountKey={boot.accountKey} generation={boot.generation} />;
  }
  if (boot.mode === 'identity') return <Gate title="身份已失效" detail="业务内容已隐藏。" />;
  if (boot.mode === 'unavailable') return <Gate title="暂时无法连接服务" detail="日程暂不可用。" />;
  return <Gate title="正在加载日程" detail="正在核实身份…" />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Boot />
  </StrictMode>
);
