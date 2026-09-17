import { useEffect } from 'react';
import LoginCard from './components/LoginCard.jsx';
import ModuleCard from './components/ModuleCard.jsx';
import DashboardPanel from './features/dashboard/DashboardPanel.jsx';
import { frontendModules } from './features/modules/moduleRegistry.js';
import WorkspaceSettingsPanel from './features/settings/WorkspaceSettingsPanel.jsx';
import { useWorkspaceData } from './hooks/useWorkspaceData.js';
import { useAppStore } from './store/useAppStore.js';
import { localizeText } from './utils/labels.js';

export default function App() {
  const { activeModuleId, setActiveModuleId, authToken, currentUser, setSession } = useAppStore();
  const {
    serverModules,
    workspaceLayout,
    moduleData,
    templates,
    error,
    flash,
    loading,
    loadData,
    login,
    register,
    requestPasswordReset,
    confirmPasswordReset,
    toggleModuleVisibility,
    updateWorkspaceLayout,
    createItem,
    updateItem,
    removeItem,
    createTemplate,
    removeTemplate,
    openResource,
    openExport,
    runModuleAction
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
    if (workspaceLayout && activeModuleId !== 'dashboard' && activeModuleId !== 'settings' && !visibleModules.some((moduleItem) => moduleItem.id === activeModuleId)) {
      setActiveModuleId('dashboard');
    }
  }, [workspaceLayout, activeModuleId, visibleModules, setActiveModuleId]);

  const panelProps = activeModule ? {
    title: activeModule.title,
    data: moduleData[activeModule.id],
    templates: templates.filter((item) => item.moduleId === activeModule.id),
    resources: activeModule.data.resourceSourceModuleId
      ? moduleData[activeModule.data.resourceSourceModuleId] || []
      : [],
    onCreate: (payload) => createItem(activeModule.id, payload),
    onUpdate: (id, payload) => updateItem(activeModule.id, id, payload),
    onDelete: (id) => removeItem(activeModule.id, id),
    onSaveTemplate: (name, payload) => createTemplate(activeModule.id, name, payload),
    onDeleteTemplate: removeTemplate,
    onOpenResource: activeModule.id === 'resource-vault' ? openResource : undefined,
    onOpenExport: activeModule.id === 'worksheet-designer' ? openExport : undefined,
    onCompleteRecurring: (id) => runModuleAction(activeModule.id, 'completeRecurring', { id }),
    onGenerateWorksheet: (id) => runModuleAction(activeModule.id, 'generateWorksheet', { id }),
    onUpload: (formData) => runModuleAction(activeModule.id, 'uploadResource', { formData })
  } : {};

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
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">教师工作台</p>
          <h2>RefatOS</h2>
          <p className="muted">一个让教学保持从容、随时容纳新功能的模块化教师工作台。</p>
        </div>
        <button className={`nav-button ${activeModuleId === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveModuleId('dashboard')}>
          工作台首页
        </button>
        <button className={`nav-button ${activeModuleId === 'settings' ? 'active' : ''}`} onClick={() => setActiveModuleId('settings')}>
          设置
        </button>
        {visibleModules.map((moduleItem) => (
          <button
            key={moduleItem.id}
            className={`nav-button ${activeModuleId === moduleItem.id ? 'active' : ''}`}
            onClick={() => setActiveModuleId(moduleItem.id)}
          >
            {moduleItem.icon} {moduleItem.title}
          </button>
        ))}
      </aside>

      <main className="main-content">
        <header className="topbar card">
          <div>
            <p className="eyebrow">教师个人工作台</p>
            <h1>安全、可导出、支持附件。</h1>
          </div>
          <div className="topbar-meta">
            <span className="badge">{localizeText(currentUser?.name || 'Teacher')}</span>
            <span className="badge">前端模块：{frontendModules.length}</span>
            <span className="badge">后端模块：{serverModules.length}</span>
            <span className="badge">模板：{templates.length}</span>
            <button className="ghost-button" onClick={loadData}>刷新</button>
            <button className="ghost-button" onClick={() => setSession({ token: '', user: null })}>退出登录</button>
          </div>
        </header>

        {flash && <div className="card flash-card">{flash}</div>}
        {error && <div className="card error-card">{error}</div>}
        {loading && <div className="card muted">正在加载工作台...</div>}

        {!loading && (
          activeModuleId === 'dashboard' ? (
            <>
              <DashboardPanel
                modules={visibleModules}
                moduleData={moduleData}
                templates={templates}
                onOpenModule={setActiveModuleId}
              />
              <section className="module-grid">
                {visibleModules.map((moduleItem) => (
                  <ModuleCard
                    key={moduleItem.id}
                    moduleItem={moduleItem}
                    isActive={activeModuleId === moduleItem.id}
                    onOpen={() => setActiveModuleId(moduleItem.id)}
                  />
                ))}
              </section>
            </>
          ) : activeModuleId === 'settings' ? (
            <WorkspaceSettingsPanel
              modules={orderedModules}
              layout={workspaceLayout}
              onToggleVisibility={toggleModuleVisibility}
              onUpdateLayout={updateWorkspaceLayout}
            />
          ) : (
            ActivePanel ? <ActivePanel {...panelProps} /> : null
          )
        )}
      </main>
    </div>
  );
}
