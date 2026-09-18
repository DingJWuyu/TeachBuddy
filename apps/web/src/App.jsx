import { useEffect } from 'react';
import LoginCard from './components/LoginCard.jsx';
import WorkspaceSidebar from './components/WorkspaceSidebar.jsx';
import { frontendModules } from './features/modules/moduleRegistry.js';
import WorkspaceSettingsPanel from './features/settings/WorkspaceSettingsPanel.jsx';
import { useWorkspaceData } from './hooks/useWorkspaceData.js';
import { useAppStore } from './store/useAppStore.js';
import { localizeText } from './utils/labels.js';

export default function App() {
  const { activeModuleId, setActiveModuleId, authToken, currentUser, setSession } = useAppStore();
  const {
    workspaceLayout,
    error,
    flash,
    loading,
    loadData,
    toggleModuleVisibility,
    updateWorkspaceLayout,
    login,
    register,
    requestPasswordReset,
    confirmPasswordReset
  } = useWorkspaceData();

  const moduleById = new Map(frontendModules.map((moduleItem) => [moduleItem.id, moduleItem]));
  const layoutOrder = workspaceLayout
    ? [
        ...(workspaceLayout.groups || []).flatMap((group) => group.moduleIds),
        ...(workspaceLayout.ungroupedModuleIds || []),
        ...frontendModules.map((moduleItem) => moduleItem.id)
      ]
    : frontendModules.map((moduleItem) => moduleItem.id);
  const orderedModules = [...new Set(layoutOrder)]
    .map((moduleId) => moduleById.get(moduleId))
    .filter(Boolean);
  const hiddenModuleIds = new Set(workspaceLayout?.hiddenModuleIds || []);
  const visibleModules = orderedModules.filter((moduleItem) => !hiddenModuleIds.has(moduleItem.id));
  const activeModule = orderedModules.find((moduleItem) => moduleItem.id === activeModuleId);
  const ActivePanel = activeModule?.panel;

  useEffect(() => {
    if (
      workspaceLayout
      && activeModuleId !== 'dashboard'
      && activeModuleId !== 'settings'
      && !visibleModules.some((moduleItem) => moduleItem.id === activeModuleId)
    ) {
      setActiveModuleId('dashboard');
    }
  }, [workspaceLayout, activeModuleId, visibleModules, setActiveModuleId]);

  if (!authToken) {
    return (
      <LoginCard
        onLogin={login}
        onRegister={register}
        onRequestPasswordReset={requestPasswordReset}
        onConfirmPasswordReset={confirmPasswordReset}
        error={error}
      />
    );
  }

  return (
    <div className="app-shell">
      <WorkspaceSidebar
        modules={orderedModules}
        layout={workspaceLayout}
        activeModuleId={activeModuleId}
        onSelectModule={setActiveModuleId}
        onUpdateLayout={updateWorkspaceLayout}
      />

      <main className="main-content">
        <header className="topbar card">
          <div>
            <p className="eyebrow">教师个人工作台</p>
            <h1>个人教学事务工作空间</h1>
          </div>
          <div className="topbar-meta">
            <span className="badge">{localizeText(currentUser?.name || '教师')}</span>
            <button className="ghost-button" onClick={loadData}>刷新</button>
            <button className="ghost-button" onClick={() => setSession({ token: '', user: null })}>退出登录</button>
          </div>
        </header>

        {flash && <div className="card flash-card">{flash}</div>}
        {error && <div className="card error-card">{error}</div>}
        {loading && <div className="card muted">正在加载工作台...</div>}

        {!loading && (
          activeModuleId === 'dashboard' ? (
            <section className="workspace-home" aria-label="工作台首页" />
          ) : activeModuleId === 'settings' ? (
            <WorkspaceSettingsPanel
              modules={orderedModules}
              layout={workspaceLayout}
              onToggleVisibility={toggleModuleVisibility}
            />
          ) : (
            ActivePanel ? <ActivePanel module={activeModule} /> : null
          )
        )}
      </main>
    </div>
  );
}
