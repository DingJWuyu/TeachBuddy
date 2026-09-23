import RestoredHome from './chrome/Home.jsx';
import RestoredSidebar, { useLayoutModel } from './chrome/Sidebar.jsx';
import RestoredTopbar from './chrome/Topbar.jsx';
import './chrome/chrome.css';
import { hasRecoveredDrafts } from './storage.js';
import { usePreferences } from './usePreferences.js';
import { SupportHelp, SupportReleases } from './SupportPages.jsx';
import { AgentProvider, useAgent } from '../agent/AgentProvider.jsx';
import { ReferenceAction } from '../agent/ReferenceAction.jsx';
/**
 * Workbench shell: stable sidebar and topbar, module routes from the static
 * catalog, and the shared auxiliary panel. Business content lives in the module
 * pages; everything the teacher sees here is either identity, navigation or the
 * restored view scene.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuxiliaryPanel, AiWorkspace } from './AuxiliaryPanel.jsx';
import { Icon } from './icons.jsx';
import { ShellContext, useWorkbenchShell } from './shellContext.js';
import { useScene } from './useScene.js';
import { followAnchor, navigate, useRoute } from './routes.js';
import { WorkbenchSettings } from './WorkbenchSettings.jsx';
import { resolveWorkbenchModules } from '../modules/moduleRegistry.js';
import ResourceRoute from './ResourceRoute.jsx';
import QuestionsPage from '../questions/index.jsx';
import LessonsPage from '../lessons/index.jsx';
import ClassesPage from '../classes/index.jsx';
import SchedulePage from '../schedule/index.jsx';
import Notifications from '../schedule/notifications/Notifications.jsx';
import { MathWorkbench } from '../math/index.jsx';
import { workbenchGet } from './apiClient.js';
import './workbench.css';

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1080px)').matches : false
  ));
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1080px)');
    const listener = (event) => setNarrow(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return narrow;
}

function NotFound() {
  return (
    <div className="wb-page wb-not-found" data-region="not-found">
      <p>未找到内容</p>
      <a className="wb-button" href="/questions" onClick={(event) => followAnchor(event, '/questions')}>返回题库</a>
    </div>
  );
}

function NavigationRow({ href, active, icon, label, collapsed, onNavigate }) {
  return (
    <a
      className={`wb-nav-row${active ? ' is-active' : ''}`}
      href={href}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      onClick={(event) => followAnchor(event, href, { onNavigate })}
    >
      <Icon name={icon} />
      <span className="wb-nav-label">{label}</span>
    </a>
  );
}

export default function WorkbenchApp({ boot }) {
  return <AgentProvider key={boot.accountKey} accountKey={boot.accountKey}><WorkbenchContent boot={boot} /></AgentProvider>;
}

function WorkbenchContent({ boot }) {
  const agent = useAgent();
  const { logout, accountKey, nickname, generation, storageFailed, reportIdentityLost, transport } = boot;
  const route = useRoute();
  const layoutModel = useLayoutModel(accountKey);
  const [surface, setSurface] = useState(null);
  const preferences = usePreferences(accountKey, generation);
  const [recoveryNotice, setRecoveryNotice] = useState(() => hasRecoveredDrafts(accountKey));
  useEffect(() => {
    const restored = event => { if (event.detail.account === accountKey) setRecoveryNotice(true); };
    window.addEventListener('tb:draft-restored', restored);
    return () => window.removeEventListener('tb:draft-restored', restored);
  }, [accountKey]);
  const narrow = useIsNarrow();
  const [scene, patchScene] = useScene(accountKey, 'shell', {
    sidebarCollapsed: false,
    drawerOpen: false,
    panelOpen: false,
    panelMode: 'ai',
    panelWidth: 300
  });
  const [materialNavigation, setMaterialNavigation] = useScene(accountKey, 'material-navigation', {});
  const [tools, setTools] = useState([]);
  const [timeZone, setTimeZone] = useState(null);
  const [timeZoneError, setTimeZoneError] = useState(null);
  const [timeZoneReload, setTimeZoneReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setTimeZoneError(null);
    workbenchGet('/api/modules/schedule/settings').then(({ body }) => {
      if (!cancelled) setTimeZone(body.timeZone);
    }).catch(error => { if (!cancelled) setTimeZoneError(error.message); });
    return () => { cancelled = true; };
  }, [route.path, generation, timeZoneReload]);
  const modules = useMemo(() => resolveWorkbenchModules(), []);

  const registerTools = useCallback((next) => setTools(next), []);
  const openPanel = useCallback((mode = 'ai') => {
    patchScene({ panelOpen: true, panelMode: mode });
  }, [patchScene]);

  const shell = useMemo(() => ({
    logout,
    preferences,
    resetDeviceScene: boot.resetDeviceScene, deviceClearNotice: boot.deviceClearNotice,
    accountKey,
    nickname,
    generation: `${generation}:${agent.businessRevision}`,
    storageFailed,
    narrow,
    timeZone, setTimeZone,
    isPanelOpen: Boolean(scene.panelOpen),
    panelMode: scene.panelMode || 'ai',
    panelWidth: scene.panelWidth || 300,
    tools,
    registerTools,
    openPanel,
    closePanel: () => patchScene({ panelOpen: false }),
    setPanelMode: (mode) => patchScene({ panelMode: mode }),
    setPanelWidth: (width) => patchScene({ panelWidth: width }),
    notifyIdentityLost: reportIdentityLost,
    navigate,
    questionUsage: materialNavigation.questionUsage,
    openQuestionUsage: (lessonId, referenceId, sourcePath) => {
      const lessonPath = `/lessons/${lessonId}`;
      setMaterialNavigation({ questionUsage: { lessonPath, sourcePath, referenceId } });
      navigate(lessonPath);
    },
    openMaterialSource: (path, lessonPath) => { setMaterialNavigation({ sourcePath: path, lessonPath }); navigate(path); }
  }), [logout, accountKey, nickname, generation, agent.businessRevision, storageFailed, narrow, scene.panelMode, scene.panelOpen, scene.panelWidth,
    tools, registerTools, openPanel, patchScene, reportIdentityLost, setMaterialNavigation, materialNavigation.questionUsage, timeZone, preferences]);

  const collapsed = narrow ? !scene.drawerOpen : Boolean(scene.sidebarCollapsed);
  const hasPanel = route.name === 'questions' || route.name === 'question'
    || route.name === 'lessons' || route.name === 'lesson' || route.name === 'resources' || route.name === 'resource' || ['math', 'classes', 'class', 'class-record', 'schedule'].includes(route.name);
  const panelOpen = hasPanel && Boolean(scene.panelOpen);

  function toggleSidebar() {
    if (narrow) patchScene({ drawerOpen: !scene.drawerOpen });
    else patchScene({ sidebarCollapsed: !scene.sidebarCollapsed });
  }

  let page = null;
  if (route.name === 'home') page = <RestoredHome returnPath={scene.lastWorkPath} />;
  else if (route.name === 'questions' || route.name === 'question') page = <QuestionsPage route={route} />;
  else if (route.name === 'lessons' || route.name === 'lesson') page = <LessonsPage route={route} />;
  else if (route.name === 'resources' || route.name === 'resource') page = <ResourceRoute key={route.path} route={route} transport={transport} />;
  else if (['classes', 'class', 'class-record'].includes(route.name)) page = timeZoneError ? <div className="wb-inline-error" role="alert">
    <p>时区读取失败：{timeZoneError}</p><button className="wb-button" onClick={() => setTimeZoneReload(value => value + 1)}>重试读取时区</button>
  </div> : timeZone ? <ClassesPage route={route} timeZone={timeZone} /> : <p className="wb-muted">正在读取账户时区…</p>;
  else if (route.name === 'schedule') page = <SchedulePage route={route} />;
  else if (route.name === 'math') page = <MathWorkbench route={route} />;
  else if (route.name === 'settings') page = <WorkbenchSettings />;
  else if (route.name === 'help') page = <SupportHelp />;
  else if (route.name === 'releases') page = <SupportReleases />;
  else page = <NotFound />;

  const activeModuleId = route.name === 'questions' || route.name === 'question'
    ? 'questions'
    : route.name === 'lessons' || route.name === 'lesson' ? 'lessons' : route.name === 'resources' || route.name === 'resource' ? 'resources' : route.name === 'math' ? 'math' : route.name.startsWith('class') ? 'classes' : null;

  useEffect(() => {
    if (!activeModuleId && route.name !== 'schedule') return;
    if (scene.lastWorkPath !== window.location.pathname + window.location.search) patchScene({lastWorkPath: window.location.pathname + window.location.search});
    if (!activeModuleId) return;
    const current = window.location.pathname + window.location.search;
    if (scene.modulePaths?.[activeModuleId] !== current)
      patchScene({ modulePaths: { ...scene.modulePaths, [activeModuleId]: current } });
  }, [activeModuleId, route.path, route.workId, route.search]);

  return (
    <ShellContext.Provider value={shell}>
      <div
        className={`wb-shell tb-prototype${scene.sidebarCollapsed ? ' is-sidebar-collapsed' : ''}${panelOpen ? ' has-panel' : ''}${narrow ? ' is-narrow' : ''}`}
        data-sidebar={collapsed ? 'rail' : 'expanded'}
        data-route={route.name}
        data-reading-size={preferences.baseline?.values.readingSize || 'standard'}
        data-motion={preferences.baseline?.values.motion || 'system'}
      >
        <RestoredTopbar route={route} collapsed={collapsed} toggleSidebar={toggleSidebar} surface={surface} setSurface={setSurface}>
          <ReferenceAction route={route} onAdded={() => openPanel('ai')} />
          {hasPanel && (
            <button
              type="button"
              className="wb-button wb-panel-toggle"
              aria-pressed={panelOpen}
              onClick={() => (panelOpen ? shell.closePanel() : openPanel('ai'))}
            >
              <Icon name="sparkle" size={15} />
              {panelOpen ? '关闭辅助栏' : 'AI 助理'}
            </button>
          )}
        </RestoredTopbar>

        <div className="wb-body">
          <RestoredSidebar modulePaths={scene.modulePaths} model={layoutModel} routePath={activeModuleId ? `/${activeModuleId}` : route.path} accountName={nickname}
            mobileOpen={Boolean(scene.drawerOpen)} isNarrow={narrow} railCollapsed={!narrow && collapsed}
            onNavigate={() => patchScene({ drawerOpen: false })} onCloseMobile={() => patchScene({ drawerOpen: false })}
            openSurface={surface} onToggleSurface={value => setSurface(surface === value ? null : value)}
            onOpenSurface={setSurface} onCloseSurface={() => setSurface(null)} />
          <div className="wb-workspace">
            <main className="wb-main" data-region="main">
              {boot.recoveryChanged && <div className="wb-storage-warning" role="status">工作台已从备份恢复。<a href="/settings" onClick={event=>followAnchor(event,'/settings')}>查看恢复前的本设备草稿</a></div>}
              {recoveryNotice && <div className="wb-recovery-notice" role="status">
                <span>已恢复本设备的未保存输入，请检查后继续。</span>
                <a href="/settings" onClick={event => followAnchor(event, '/settings')}>查看设备草稿</a>
                <button className="wb-icon-button" aria-label="关闭恢复提示" onClick={() => setRecoveryNotice(false)}><Icon name="close" size={14} /></button>
              </div>}
              {storageFailed && (
                <div className="wb-storage-warning" role="alert" data-region="storage-warning">
                  草稿无法保留，请先保存
                </div>
              )}
              {materialNavigation.sourcePath === route.path + window.location.search && materialNavigation.lessonPath && (
                <div className="wb-material-return"><button className="wb-button" onClick={() => navigate(materialNavigation.lessonPath)}>返回备课现场</button></div>
              )}
              {materialNavigation.questionUsage?.lessonPath === route.path && (
                <div className="wb-material-return"><button className="wb-button" onClick={() => navigate(materialNavigation.questionUsage.sourcePath)}>返回题库现场</button></div>
              )}
              {page}
            </main>

            {panelOpen && <AuxiliaryPanel />}
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

export { useWorkbenchShell };
