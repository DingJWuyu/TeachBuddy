
import { useState } from 'react';
import { Icon } from './icons.jsx';
import SupportMenu from './SupportMenu.jsx';
import { CALENDAR_PATH, HOME_PATH, routeClick, withSearch } from './routes.js';
import {
  CoachMark,
  FeedbackPanel,
  NOTIFICATIONS,
  NotificationPanel,
  PrivacyPanel,
  SearchModal,
  TutorialPanel
} from './TopbarSurfaces.jsx';

function Entry({ surface, icon, label, hint, badge, openSurface, onToggle, coached, overlay, children }) {
  const open = openSurface === surface;
  return (
    <span className={`tb-entry-wrap${coached ? ' is-coached' : ''}`}>
      <button
        type="button"
        className="tb-entry"
        data-surface={surface}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onToggle(surface)}
      >
        <Icon name={icon} size={22} />
        {badge && <span className={`tb-badge is-${badge.tone}`} aria-hidden="true">{badge.value}</span>}
      </button>
      {!open && !coached && <span className="tb-tooltip" aria-hidden="true">{hint}</span>}
      {overlay}
      {open && children}
    </span>
  );
}

export default function Topbar({
  route,
  openSurface,
  onToggleSurface,
  onOpenSurface,
  onCloseSurface,
  onOpenMobileSidebar,
  sidebarCollapsed,
  onToggleSidebar,
  modules,
  completedTutorials,
  onCompleteTutorial,
  coachVisible,
  onDismissCoach,
  onAnnounce
}) {
  const remaining = Math.max(0, modules.length - completedTutorials.length);
  /* The active item is derived from the address, never stored: a top-bar item
   * that highlighted itself on click would go stale the moment the browser's
   * back button moved the shell. */
  const activePath = route.pathname;
  /*
   * The unread count lives here rather than in the panel because the trigger's
   * badge is its only other reader, and the panel unmounts whenever another
   * surface opens. Notifications are read as a set, so the count is owned by the
   * shell and handed to the panel.
   */
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const unreadNotifications = notifications.filter((item) => !item.read).length;

  return (
    <header className="tb-topbar">
      <div className="tb-brand-slot">
        <button className="tb-mobile-menu" onClick={onOpenMobileSidebar} aria-label="打开工作台导航">
          <Icon name="menu" />
        </button>
        <a
          className="tb-brand"
          href={withSearch(HOME_PATH)}
          aria-label="TeachBuddy 首页"
          onClick={(event) => routeClick(event, HOME_PATH)}
        >
          <span className="tb-brand-mark" aria-hidden="true">T</span>
          <span className="tb-brand-wordmark">TeachBuddy</span>
        </a>
      </div>

      <nav className="tb-global-nav" aria-label="全局导航">
        <a
          className={`tb-nav-item${activePath === HOME_PATH ? ' is-current' : ''}`}
          href={withSearch(HOME_PATH)}
          aria-current={activePath === HOME_PATH ? 'page' : undefined}
          onClick={(event) => routeClick(event, HOME_PATH)}
        >
          首页
        </a>
        <a
          className={`tb-nav-item${activePath === CALENDAR_PATH ? ' is-current' : ''}`}
          href={withSearch(CALENDAR_PATH)}
          aria-current={activePath === CALENDAR_PATH ? 'page' : undefined}
          onClick={(event) => routeClick(event, CALENDAR_PATH)}
        >
          日历
        </a>
        <SupportMenu
          open={openSurface === 'support'}
          onOpen={() => onOpenSurface('support')}
          onClose={onCloseSurface}
          onSelect={onAnnounce}
        />
      </nav>

      <div className="tb-top-actions">
        <Entry
          surface="search"
          icon="search"
          label="全局搜索"
          hint="搜索 (Ctrl+K)"
          openSurface={openSurface}
          onToggle={onToggleSurface}
        />
        <Entry
          surface="notifications"
          icon="bell"
          label={unreadNotifications > 0 ? `通知，${unreadNotifications} 条未读` : '通知'}
          hint="通知"
          /* The red badge marks unread work. With nothing unread it is gone. */
          badge={unreadNotifications > 0 ? { tone: 'red', value: '!' } : null}
          openSurface={openSurface}
          onToggle={onToggleSurface}
        >
          <NotificationPanel
            items={notifications}
            onChange={setNotifications}
            onAnnounce={onAnnounce}
          />
        </Entry>
        <Entry
          surface="feedback"
          icon="feedback"
          label="发送反馈"
          hint="发送反馈"
          openSurface={openSurface}
          onToggle={onToggleSurface}
        >
          <FeedbackPanel onAnnounce={onAnnounce} onClose={onCloseSurface} />
        </Entry>
        <Entry
          surface="tutorial"
          icon="tutorial"
          label={`教程进度：已完成 ${completedTutorials.length} / ${modules.length}`}
          hint="Getting Started"
          badge={remaining > 0 ? { tone: 'amber', value: remaining } : null}
          openSurface={openSurface}
          onToggle={onToggleSurface}
          coached={coachVisible}
          overlay={coachVisible ? <CoachMark onDismiss={onDismissCoach} /> : null}
        >
          <TutorialPanel
            modules={modules}
            completed={completedTutorials}
            onComplete={onCompleteTutorial}
            onAnnounce={onAnnounce}
          />
        </Entry>
        <Entry
          surface="privacy"
          icon="shield"
          label="Privacy & Security"
          hint="Privacy & Security"
          openSurface={openSurface}
          onToggle={onToggleSurface}
        >
          <PrivacyPanel />
        </Entry>
      </div>

      {/*
        First-run spotlight. It must sit outside .tb-entry-wrap: that wrapper takes
        a z-index while coached, which would otherwise make it the scrim's stacking
        context and paint the scrim on top of the very entry it should reveal.
      */}
      {coachVisible && <span className="tb-coach-scrim" onPointerDown={onDismissCoach} />}

      <button
        type="button"
        className="tb-sidebar-toggle"
        aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        aria-pressed={sidebarCollapsed}
        onClick={onToggleSidebar}
      >
        <Icon name={sidebarCollapsed ? 'panelOpen' : 'panelClose'} size={16} />
      </button>

      {openSurface === 'search' && (
        <SearchModal onClose={onCloseSurface} onAnnounce={onAnnounce} />
      )}
    </header>
  );
}
