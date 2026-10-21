import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tx, useLocale } from '../../../i18n/presentation.js';
import { Icon } from '../../../components/icons.jsx';
import { useScene } from '../../../platform/device/useScene.js';
import { useWorkbenchShell } from '../shellContext.js';
import { followAnchor } from '../routes.js';
import { workbenchModules, moduleDisplayName } from '../../modules/moduleRegistry.js';
import { SearchModal, FeedbackPanel, TutorialPanel, PrivacyPanel, CoachMark } from './TopbarSurfaces.jsx';
import Notifications from './Notifications.jsx';
import SupportMenu from './SupportMenu.jsx';
import { Mark } from './BrandMark.jsx';
import { Celebration } from './Celebration.jsx';
const tw = tx;

/* A segmented control whose highlight slides to the current item. */
function useSlidingThumb(navRef, deps) {
  const [thumb, setThumb] = useState(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const measure = () => {
      const current = nav.querySelector('.is-current');
      if (!current) { setThumb((v) => (v ? { ...v, hidden: true } : null)); return; }
      setThumb({ left: current.offsetLeft, width: current.offsetWidth, hidden: false });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, deps);
  return thumb;
}

export default function Topbar({ route, collapsed, toggleSidebar, surface, setSurface, assistantOpen, onToggleAssistant, children }) {
  useLocale();
  const modules = workbenchModules.filter((m) => m.navigation === 'sidebar');
  const topModules = workbenchModules.filter((m) => m.navigation === 'top');
  const ref = useRef(null);
  const navRef = useRef(null);
  const { accountKey } = useWorkbenchShell();
  const [scene, patch] = useScene(accountKey, 'topbar', { completed: [], coachDismissed: false });
  const [announcement, announce] = useState('');
  const [celebrating, celebrate] = useState(false);
  const dismissCoach = () => patch({ coachDismissed: true });
  const thumb = useSlidingThumb(navRef, [route.name, route.moduleId, surface === 'support']);

  useEffect(() => {
    const close = (e) => {
      if (e.type === 'keydown' && e.key === 'Escape') {
        celebrate(false);
        if (!scene.coachDismissed) dismissCoach();
      }
      if (e.type === 'keydown' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSurface('search');
        return;
      }
      if (!['support', 'search', 'feedback', 'tutorial', 'privacy', 'notifications'].includes(surface)) return;
      if (e.type === 'keydown' ? e.key === 'Escape'
        : surface === 'notifications' ? !e.target.closest('[data-topbar-surface=notifications]')
        : !ref.current?.contains(e.target)) setSurface(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [surface, setSurface, scene.coachDismissed]);

  const toggle = (value) => setSurface(surface === value ? null : value);
  const entry = (name, icon, label, content, badge) => (
    <span data-topbar-entry={name} className={`tb-entry-wrap${name === 'tutorial' && !scene.coachDismissed ? ' is-coached' : ''}`}>
      <button className="tb-entry" aria-label={label} aria-haspopup="dialog" aria-expanded={surface === name} onClick={() => toggle(name)}>
        <Icon name={icon} size={20} strokeWidth={1.8} />
        {badge > 0 && <span className="tb-badge is-amber">{badge}</span>}
      </button>
      {name === 'tutorial' && !scene.coachDismissed && <CoachMark onDismiss={dismissCoach} />}
      {surface !== name && (name !== 'tutorial' || scene.coachDismissed) && <span className="tb-tooltip" aria-hidden="true">{label}</span>}
      {surface === name && content}
    </span>
  );
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  return (
    <header className="tb-topbar tbx-topbar" ref={ref}>
      <div className="tb-brand-slot tbx-brand-slot">
        <button className="tb-mobile-menu" onClick={toggleSidebar} aria-label={tw('打开工作台导航')}>
          <Icon name="menu" />
        </button>
        <a className="tb-brand tbx-brand" href="/" onClick={(e) => followAnchor(e, '/')} aria-label="TeachBuddy">
          <Mark size={30} />
          <span className="tbx-wordmark">TeachBuddy</span>
        </a>
      </div>

      <div className="tbx-bar">
        <button
          className="tb-sidebar-toggle tbx-sidebar-toggle"
          aria-label={collapsed ? tw('展开侧栏') : tw('收起侧栏')}
          title={collapsed ? tw('展开侧栏') : tw('收起侧栏')}
          onClick={toggleSidebar}
        >
          <Icon name="sidebarLeft" size={20} strokeWidth={1.75} />
        </button>

        <nav className="tb-global-nav tbx-segmented" aria-label={tw('全局导航')} ref={navRef}>
          {thumb && (
            <span
              className={`tbx-segmented-thumb${thumb.hidden ? ' is-hidden' : ''}`}
              style={{ transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` }}
              aria-hidden="true"
            />
          )}
          <a className={`tb-nav-item${route.name === 'home' ? ' is-current' : ''}`} href="/" onClick={(e) => followAnchor(e, '/')}>
            {tw('首页')}
          </a>
          {topModules.map((m) => (
            <a key={m.id} className={`tb-nav-item${route.moduleId === m.id ? ' is-current' : ''}`} href={m.path} onClick={(e) => followAnchor(e, m.path)}>
              {moduleDisplayName(m)}
            </a>
          ))}
          <SupportMenu open={surface === 'support'} onOpen={() => setSurface('support')} onClose={() => setSurface(null)} onSelect={() => {}} />
        </nav>

        <div className="tb-top-actions tbx-actions">
          <button className="tbx-search-pill" onClick={() => setSurface('search')} aria-label={tw('全局搜索')}>
            <Icon name="search" size={16} strokeWidth={2} />
            <span className="tbx-search-label">{tx('搜索功能模块')}</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <Notifications open={surface === 'notifications'} onToggle={() => toggle('notifications')} onClose={() => setSurface(null)} onAnnounce={announce} />
          {entry('feedback', 'feedback', tw('发送反馈'), <FeedbackPanel onAnnounce={announce} onClose={() => setSurface(null)} />)}
          {entry('tutorial', 'tutorial', tw('使用教程'), (
            <TutorialPanel
              modules={modules}
              completed={scene.completed}
              onAnnounce={announce}
              onComplete={(id) => {
                const completed = scene.completed.includes(id) ? scene.completed.filter((x) => x !== id) : [...scene.completed, id];
                patch({ completed });
                if (completed.length === modules.length) celebrate(true);
              }}
            />
          ), modules.length - scene.completed.length)}
          {entry('privacy', 'shield', tw('隐私与数据保护'), <PrivacyPanel />)}
          {children}
          {onToggleAssistant ? (
            <span className="tb-entry-wrap tbx-panel-wrap">
              <button
                type="button"
                className={`tb-entry tbx-panel-toggle${assistantOpen ? ' is-on' : ''}`}
                aria-label={assistantOpen ? tw('收起 AI 助理') : tw('打开 AI 助理')}
                aria-expanded={assistantOpen}
                onClick={onToggleAssistant}
              >
                <Icon name="sparkles" size={20} strokeWidth={1.75} />
              </button>
              <span className="tb-tooltip" aria-hidden="true">{assistantOpen ? tw('收起 AI 助理') : tw('打开 AI 助理')}</span>
            </span>
          ) : null}
        </div>
      </div>

      {surface === 'search' && <SearchModal onClose={() => setSurface(null)} onAnnounce={announce} />}
      {!scene.coachDismissed && <span className="tb-coach-scrim" onPointerDown={dismissCoach} />}
      {celebrating && <Celebration onClose={() => celebrate(false)} />}
      <span className="sr-only" role="status">{announcement}</span>
    </header>
  );
}
