import LoginCard from './components/LoginCard.jsx';
import ModuleCard from './components/ModuleCard.jsx';
import DashboardPanel from './features/dashboard/DashboardPanel.jsx';
import { frontendModules } from './features/modules/moduleRegistry.js';
import { useWorkspaceData } from './hooks/useWorkspaceData.js';
import { useAppStore } from './store/useAppStore.js';
import { localizeText } from './utils/labels.js';

export default function App() {
  const { activeModuleId, setActiveModuleId, authToken, currentUser, setSession } = useAppStore();
  const {
    serverModules,
    moduleData,
    templates,
    error,
    flash,
    loading,
    summary,
    loadData,
    login,
    createItem,
    updateItem,
    removeItem,
    createTemplate,
    removeTemplate,
    completeRecurring,
    generateWorksheetFromLesson,
    uploadResource
  } = useWorkspaceData();

  const activeModule = frontendModules.find((moduleItem) => moduleItem.id === activeModuleId);
  const ActivePanel = activeModule?.panel;

  const panelProps = activeModule ? {
    data: moduleData[activeModule.id],
    templates: templates.filter((item) => item.moduleId === activeModule.id),
    resources: moduleData['resource-vault'],
    onCreate: (payload) => createItem(activeModule.id, payload),
    onUpdate: (id, payload) => updateItem(activeModule.id, id, payload),
    onDelete: (id) => removeItem(activeModule.id, id),
    onSaveTemplate: (name, payload) => createTemplate(activeModule.id, name, payload),
    onDeleteTemplate: removeTemplate,
    onCompleteRecurring: completeRecurring,
    onGenerateWorksheet: generateWorksheetFromLesson,
    onUpload: uploadResource
  } : {};

  if (!authToken) {
    return <LoginCard onLogin={login} error={error} />;
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
        {frontendModules.map((moduleItem) => (
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
            <p className="eyebrow">v1.3 发布工作台</p>
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
                summary={summary}
                reminders={moduleData['reminder-center']}
                schedule={moduleData['schedule-organizer']}
                lessons={moduleData['lesson-planner']}
                worksheets={moduleData['worksheet-designer']}
                templates={templates}
                onOpenModule={setActiveModuleId}
              />
              <section className="module-grid">
                {frontendModules.map((moduleItem) => (
                  <ModuleCard
                    key={moduleItem.id}
                    moduleItem={moduleItem}
                    isActive={activeModuleId === moduleItem.id}
                    onOpen={() => setActiveModuleId(moduleItem.id)}
                  />
                ))}
              </section>
            </>
          ) : (
            ActivePanel ? <ActivePanel {...panelProps} /> : null
          )
        )}
      </main>
    </div>
  );
}
