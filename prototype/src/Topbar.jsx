/*
 * Top bar for the workbench prototype.
 *
 * Measured reference values live in
 * docs/reference/emstudio-topbar-measured-spec.md. Two deliberate departures
 * from the reference are encoded here and should stay visible:
 *
 *  1. Five right-hand entries instead of four. The reference folds feedback and
 *     notifications into one red-badged button and has no notification entry at
 *     all; TeachBuddy gives notifications its own bell and keeps feedback
 *     separate, extending the row leftwards rather than tightening the gaps.
 *  2. Every entry carries a tooltip and an accessible name. The reference leaves
 *     its privacy entry with neither, and lets its feedback button's accessible
 *     name degrade to the badge text "!".
 */
import { Icon } from './icons.jsx';
import SupportMenu from './SupportMenu.jsx';
import {
  CoachMark,
  FeedbackPanel,
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

  return (
    <header className="tb-topbar">
      <div className="tb-brand-slot">
        <button className="tb-mobile-menu" onClick={onOpenMobileSidebar} aria-label="打开工作台导航">
          <Icon name="menu" />
        </button>
        <a className="tb-brand" href="/" aria-label="TeachBuddy 首页">
          <span className="tb-brand-mark" aria-hidden="true">T</span>
          <span className="tb-brand-wordmark">TeachBuddy</span>
        </a>
      </div>

      <nav className="tb-global-nav" aria-label="全局导航">
        <a className="tb-nav-item is-current" href="/" aria-current="page">首页</a>
        <a className="tb-nav-item" href="/calendar">日历</a>
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
          label="通知"
          hint="通知"
          badge={{ tone: 'red', value: '!' }}
          openSurface={openSurface}
          onToggle={onToggleSurface}
        >
          <NotificationPanel onAnnounce={onAnnounce} />
        </Entry>
        <Entry
          surface="feedback"
          icon="feedback"
          label="发送反馈"
          hint="发送反馈"
          openSurface={openSurface}
          onToggle={onToggleSurface}
        >
          <FeedbackPanel onAnnounce={onAnnounce} />
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
