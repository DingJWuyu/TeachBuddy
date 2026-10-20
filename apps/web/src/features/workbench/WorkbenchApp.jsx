import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
import Home from './chrome/Home.jsx';
import Sidebar, { useLayoutModel } from './chrome/Sidebar.jsx';
import Topbar from './chrome/Topbar.jsx';
import './chrome/chrome.css';
import { hasRecoveredDrafts } from '../../platform/device/storage.js';
import { usePreferences } from './usePreferences.js';
import { SupportHelp, SupportReleases } from './SupportPages.jsx';
import { AgentProvider, useAgent } from '../agent/AgentProvider.jsx';
import { ReferenceAction } from '../agent/ReferenceAction.jsx';
/**
 * Workbench shell: stable sidebar and topbar, module routes from the static
 * catalog, and the shared auxiliary panel. Business content lives in the module
 * pages; everything the teacher sees here is either identity, navigation or the
 * account view scene.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AuxiliaryPanel } from './AuxiliaryPanel.jsx';
import { Icon } from '../../components/icons.jsx';
import { ShellContext, useWorkbenchShell } from './shellContext.js';
import { useScene } from '../../platform/device/useScene.js';
import { followAnchor, navigate, useRoute } from './routes.js';
import { WorkbenchSettings } from './WorkbenchSettings.jsx';
import { workbenchModules, moduleDisplayName } from '../modules/moduleRegistry.js';
import { useScheduleSettings } from '../schedule/useScheduleSettings.js';
import { useAuth } from '../auth/index.jsx';
import './workbench.css';
import './appearance.css';

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
  const { t } = useTranslation("workbench");
  const destination = workbenchModules.find(module => module.navigation === 'sidebar');
  const path = destination?.path || '/';
  return (
    <div className="wb-page wb-not-found" data-region="not-found">
      <p>{t("未找到内容")}</p>
      <a className="wb-button" href={path} onClick={(event) => followAnchor(event, path)}>{t("返回")}{moduleDisplayName(destination) || t("首页")}</a>
    </div>
  );
}

export default function WorkbenchApp({ boot }) {
  useTranslation("workbench");
  return <AgentProvider key={boot.accountKey} accountKey={boot.accountKey}><WorkbenchContent boot={boot} /></AgentProvider>;
}

function WorkbenchContent({ boot }) {
  const { t } = useTranslation("workbench");
  const { logoutState } = useAuth();
  const logoutBlocked = logoutState === 'unknown' || logoutState === 'running';
  const agent = useAgent();
  const { logout, accountKey, nickname, generation, storageFailed, reportIdentityLost, transport } = boot;
  const route = useRoute();
  const layoutModel = useLayoutModel(accountKey, generation);
  const [surface, setSurface] = useState(null);
  const preferences = usePreferences(accountKey, generation);
  const [localAppearance] = useScene(accountKey, 'custom-appearance', {
    customBackground: false, backgroundImage: ''
  });
  const appearance = useMemo(() => ({
    theme: 'light', background: 'grid', avatar: '', ...preferences.input,
    backgroundImage: preferences.input?.backgroundImage || localAppearance.backgroundImage || ''
  }), [preferences.input, localAppearance.backgroundImage]);
  const setAppearance = useCallback(patch => {
    preferences.setInput(values => ({ ...values, ...patch,
      ...(patch.background === 'custom' && !patch.backgroundImage && !values.backgroundImage
        ? { backgroundImage: localAppearance.backgroundImage || '' } : {})
    }));
  }, [preferences.setInput, localAppearance.backgroundImage]);
  useEffect(() => {
    // Only an untouched account can adopt the old device choice automatically.
    // Otherwise retain the device image for explicit selection without replacing
    // a newer server preference or an unresolved preference draft.
    if (preferences.status === 'clean' && preferences.baseline?.updatedAt === null && localAppearance.customBackground && localAppearance.backgroundImage) {
      preferences.setInput(values => ({ ...values, background: 'custom', backgroundImage: localAppearance.backgroundImage }));
    }
  }, [preferences.status, preferences.baseline, preferences.setInput, localAppearance]);
  const locale = preferences.input?.locale || 'zh-CN';
  const setLocale = useCallback(locale => preferences.setInput(values => ({ ...values, locale })), [preferences.setInput]);
  useLayoutEffect(() => { void i18n.changeLanguage(locale); }, [locale]);
  useEffect(() => {
    if (preferences.status === 'dirty' && preferences.baseline) void preferences.save();
  }, [preferences.status, preferences.input, preferences.baseline, preferences.save]);
  useLayoutEffect(() => {
    document.documentElement.dataset.workbenchTheme = appearance.theme;
    return () => { delete document.documentElement.dataset.workbenchTheme; };
  }, [appearance.theme]);
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
  const [tools, setTools] = useState([]);
  const [assistant, setAssistant] = useState(null);
  const { timeZone, setTimeZone, timeZoneError, reloadTimeZone } = useScheduleSettings(route.path, generation);
  const activeModule = workbenchModules.find(module => module.id === route.moduleId);

  const registerAssistant = useCallback(render => setAssistant(() => render), []);
  const registerTools = useCallback((next) => setTools(next), []);
  const openPanel = useCallback((mode = 'ai') => {
    patchScene({ panelOpen: true, panelMode: mode });
  }, [patchScene]);

  const shell = useMemo(() => ({
    logout,
    preferences,
    locale, setLocale,
    appearance, setAppearance,
    resetDeviceScene: boot.resetDeviceScene, deviceClearNotice: boot.deviceClearNotice,
    accountKey,
    nickname,
    generation: `${generation}:${agent.businessRevision}`,
    storageFailed,
    narrow,
    timeZone, setTimeZone, timeZoneError, reloadTimeZone,
    isPanelOpen: Boolean(scene.panelOpen),
    panelMode: scene.panelMode || 'ai',
    panelWidth: scene.panelWidth || 300,
    tools,
    registerTools,
    assistant, registerAssistant,
    openPanel,
    closePanel: () => patchScene({ panelOpen: false }),
    setPanelMode: (mode) => patchScene({ panelMode: mode }),
    setPanelWidth: (width) => patchScene({ panelWidth: width }),
    notifyIdentityLost: reportIdentityLost,
    navigate,
  }), [logout, accountKey, nickname, generation, agent.businessRevision, storageFailed, narrow, scene.panelMode, scene.panelOpen, scene.panelWidth,
    tools, registerTools, assistant, registerAssistant, openPanel, patchScene, reportIdentityLost, timeZone, timeZoneError, preferences, appearance, setAppearance, locale, setLocale]);

  const collapsed = narrow ? !scene.drawerOpen : Boolean(scene.sidebarCollapsed);
  const hasPanel = Boolean(activeModule?.auxiliaryPanel);
  const panelOpen = hasPanel && Boolean(scene.panelOpen);

  function toggleSidebar() {
    if (narrow) patchScene({ drawerOpen: !scene.drawerOpen });
    else patchScene({ sidebarCollapsed: !scene.sidebarCollapsed });
  }

  let page = null;
  if (route.name === 'home') page = <Home returnPath={workbenchModules.some(module => scene.lastWorkPath?.split(/[/?]/)[1] === module.path.slice(1)) ? scene.lastWorkPath : null} />;
  else if (activeModule) {
    const Page = activeModule.Page;
    page = <Page route={route} transport={transport} />;
  }
  else if (route.name === 'settings') page = <WorkbenchSettings />;
  else if (route.name === 'help') page = <SupportHelp />;
  else if (route.name === 'releases') page = <SupportReleases />;
  else page = <NotFound />;

  const activeModuleId = activeModule?.id;

  useEffect(() => {
    if (!activeModuleId) return;
    if (scene.lastWorkPath !== window.location.pathname + window.location.search) patchScene({lastWorkPath: window.location.pathname + window.location.search});
    if (activeModule.navigation !== 'sidebar') return;
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
        data-theme={appearance.theme}
        data-background={appearance.background === 'custom' && !appearance.backgroundImage ? 'grid' : appearance.background}
        style={appearance.background === 'custom' && appearance.backgroundImage ? { '--tbx-bg-image': `url("${appearance.backgroundImage}")` } : undefined}
        data-reading-size={preferences.baseline?.values.readingSize || 'standard'}
        data-motion={preferences.baseline?.values.motion || 'system'}
      >
        <Topbar route={route} collapsed={collapsed} toggleSidebar={toggleSidebar} surface={surface} setSurface={setSurface}
          assistantOpen={panelOpen}
          onToggleAssistant={hasPanel ? () => (panelOpen ? shell.closePanel() : openPanel('ai')) : undefined}>
          <ReferenceAction route={route} onAdded={() => openPanel('ai')} />
        </Topbar>

        <div className="wb-body">
          <Sidebar modulePaths={scene.modulePaths} model={layoutModel} routePath={activeModule?.path || route.path} accountName={nickname}
            mobileOpen={Boolean(scene.drawerOpen)} isNarrow={narrow} railCollapsed={!narrow && collapsed}
            onExpand={() => patchScene({ sidebarCollapsed: false })}
            onNavigate={() => patchScene({ drawerOpen: false })} onCloseMobile={() => patchScene({ drawerOpen: false })}
            openSurface={surface} onToggleSurface={value => setSurface(surface === value ? null : value)}
            onOpenSurface={setSurface} onCloseSurface={() => setSurface(null)} />
          <div className="wb-workspace">
            {logoutBlocked && route.name !== 'settings' && <div className="wb-gate" data-region="logout-confirmation"
              style={{ position: 'relative', inset: 'auto', flex: 1, minWidth: 0 }}>
              <div className="wb-gate-card" style={{ width: 'min(420px, 100%)' }}>
                <h1>{t("退出登录")}</h1>
                <p role={logoutState === 'running' ? 'status' : 'alert'}>{logoutState === 'running'
                  ? t("正在退出…") : t("退出结果暂未确认，业务操作已锁定。请重试确认。")}</p>
                <p>{t("本设备的草稿仍然保留。")}</p>
                <button className="wb-button" disabled={logoutState === 'running'} onClick={() => { void logout().catch(() => {}); }}>
                  {logoutState === 'running' ? t("正在退出…") : t("重试确认退出")}
                </button>
                <a className="wb-button" href="/settings" onClick={event => followAnchor(event, '/settings')}>{t("设置")}</a>
              </div>
            </div>}
            <main className="wb-main" data-region="main" style={logoutBlocked && route.name !== 'settings' ? { display: 'none' } : undefined}>
              {boot.recoveryChanged && <div className="wb-storage-warning" role="status">{t("工作台已从备份恢复。")}</div>}
              {recoveryNotice && <div className="wb-recovery-notice" role="status">
                <span>{t("已恢复本设备的未保存输入，请检查后继续。")}</span>
                <button className="wb-icon-button" aria-label={t("关闭恢复提示")} onClick={() => setRecoveryNotice(false)}><Icon name="close" size={14} /></button>
              </div>}
              {storageFailed && (
                <div className="wb-storage-warning" role="alert" data-region="storage-warning"> {t("草稿无法保留，请先保存")} </div>
              )}
              {page}
            </main>

            {(hasPanel || assistant) && <AuxiliaryPanel hidden={!panelOpen || logoutBlocked} available={hasPanel} />}
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

export { useWorkbenchShell };
