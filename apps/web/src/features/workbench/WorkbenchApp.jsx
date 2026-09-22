import { ReferenceAction } from '../agent/ReferenceAction.jsx';
import { AgentProvider, useAgent } from '../agent/AgentProvider.jsx';
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
import QuestionsPage from '../questions/index.jsx';
import LessonsPage from '../lessons/index.jsx';
import './workbench.css';

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const resize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return width;
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
  const { logout, accountKey, nickname, generation, storageFailed, reportIdentityLost } = boot;
  const route = useRoute();
  const viewportWidth = useViewportWidth();
  const narrow = viewportWidth <= 1080;
  const [scene, patchScene] = useScene(accountKey, 'shell', {
    sidebarCollapsed: false,
    drawerOpen: false,
    panelOpen: false,
    panelMode: 'ai',
    panelWidth: 360
  });
  const [tools, setTools] = useState([]);
  const modules = useMemo(() => resolveWorkbenchModules(), []);

  const registerTools = useCallback((next) => setTools(next), []);
  const openPanel = useCallback((mode = 'ai') => {
    patchScene({ panelOpen: true, panelMode: mode });
  }, [patchScene]);

  const shell = useMemo(() => ({
    logout,
    accountKey,
    nickname,
    generation: `${generation}:${agent.businessRevision}`,
    storageFailed,
    narrow,
    isPanelOpen: Boolean(scene.panelOpen),
    panelMode: scene.panelMode || 'ai',
    panelWidth: scene.panelWidth || 360,
    tools,
    registerTools,
    openPanel,
    closePanel: () => patchScene({ panelOpen: false }),
    setPanelMode: (mode) => patchScene({ panelMode: mode }),
    setPanelWidth: (width) => patchScene({ panelWidth: width }),
    notifyIdentityLost: reportIdentityLost,
    navigate
  }), [logout, accountKey, nickname, generation, agent.businessRevision, storageFailed, narrow, scene.panelMode, scene.panelOpen, scene.panelWidth,
    tools, registerTools, openPanel, patchScene, reportIdentityLost]);

  const collapsed = narrow ? !scene.drawerOpen : Boolean(scene.sidebarCollapsed);
  const hasPanel = route.name === 'questions' || route.name === 'question'
    || route.name === 'lessons' || route.name === 'lesson';
  const panelOpen = hasPanel && Boolean(scene.panelOpen);
  const panelOverlay = narrow || viewportWidth - (collapsed ? 72 : 256) - (scene.panelWidth || 360) - 24 < 480;

  function toggleSidebar() {
    if (narrow) patchScene({ drawerOpen: !scene.drawerOpen });
    else patchScene({ sidebarCollapsed: !scene.sidebarCollapsed });
  }

  let page = null;
  if (route.name === 'home') page = <AiWorkspace variant="home" />;
  else if (route.name === 'questions' || route.name === 'question') page = <QuestionsPage route={route} />;
  else if (route.name === 'lessons' || route.name === 'lesson') page = <LessonsPage route={route} />;
  else if (route.name === 'settings') page = <WorkbenchSettings />;
  else page = <NotFound />;

  const activeModuleId = route.name === 'questions' || route.name === 'question'
    ? 'questions'
    : route.name === 'lessons' || route.name === 'lesson' ? 'lessons' : null;

  return (
    <ShellContext.Provider value={shell}>
      <div
        className={`wb-shell${panelOpen ? ' has-panel' : ''}${narrow ? ' is-narrow' : ''}${panelOverlay ? ' is-panel-overlay' : ''}`}
        data-sidebar={collapsed ? 'rail' : 'expanded'}
        data-route={route.name}
      >
        <header className="wb-topbar">
          <button
            type="button"
            className="wb-icon-button"
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            aria-expanded={!collapsed}
            onClick={toggleSidebar}
          >
            <Icon name="menu" />
          </button>
          <a className="wb-brand" href="/" onClick={(event) => followAnchor(event, '/')}>
            <span className="wb-brand-mark" aria-hidden="true">T</span>
            TeachBuddy
          </a>
          <div className="wb-topbar-spacer" />
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
          <span className="wb-account-chip" title={nickname} aria-label={nickname}>
            <span className="wb-avatar" aria-hidden="true">师</span>
            <span className="wb-account-name">{nickname}</span>
          </span>
        </header>

        <div className="wb-body">
          <aside
            className={`wb-sidebar${collapsed ? ' is-collapsed' : ''}`}
            aria-label="模块导航"
            data-region="sidebar"
          >
            <div className="wb-sidebar-account">
              <span className="wb-avatar" aria-hidden="true">师</span>
              <span className="wb-account-name" title={nickname}>{nickname}</span>
            </div>
            <nav className="wb-nav">
              <NavigationRow
                href="/"
                icon="home"
                label="工作台首页"
                active={route.name === 'home'}
                collapsed={collapsed}
                onNavigate={() => patchScene({ drawerOpen: false })}
              />
              {modules.map((moduleItem) => (
                <NavigationRow
                  key={moduleItem.id}
                  href={moduleItem.path}
                  icon={moduleItem.icon}
                  label={moduleItem.name}
                  active={activeModuleId === moduleItem.id}
                  collapsed={collapsed}
                  onNavigate={() => patchScene({ drawerOpen: false })}
                />
              ))}
            </nav>
            <div className="wb-sidebar-foot">
              <NavigationRow
                href="/settings"
                icon="settings"
                label="设置"
                active={route.name === 'settings'}
                collapsed={collapsed}
                onNavigate={() => patchScene({ drawerOpen: false })}
              />
              {(
                <button
                  type="button"
                  className="wb-ai-entry"
                  onClick={() => { if (route.name === 'home') document.querySelector('[aria-label="AI 输入"]')?.focus(); else if (hasPanel) openPanel('ai'); else navigate('/'); }}
                  title={collapsed ? 'AI 助理' : undefined}
                >
                  <Icon name="sparkle" />
                  <span>AI 助理</span>
                </button>
              )}
            </div>
          </aside>
          {narrow && scene.drawerOpen && (
            <div className="wb-drawer-scrim" onClick={() => patchScene({ drawerOpen: false })} role="presentation" />
          )}

          <div className="wb-workspace">
            <main className="wb-main" data-region="main">
              {storageFailed && (
                <div className="wb-storage-warning" role="alert" data-region="storage-warning">
                  草稿无法保留，请先保存
                </div>
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
