
import { Icon } from './icons.jsx';
import { routeClick, withSearch } from './routes.js';

// Exported so the narrow-screen drawer renders the same list as the menu.
export const SUPPORT_MENU_ITEMS = [
  { label: '设置', icon: 'settings', route: '/settings' },
  { label: '帮助', icon: 'circleHelp', route: '/help' },
  { label: '更新日志', icon: 'newspaper', route: '/releases' }
];

export default function SupportMenu({ open, onOpen, onClose, onSelect }) {
  return (
    <span
      className="tb-support-wrap"
      onPointerEnter={onOpen}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') onClose();
      }}
    >
      <button
        type="button"
        className={`tb-nav-item${open ? ' is-open' : ''}`}
        data-surface="support"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onOpen}
      >
        支持
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="tb-support-menu" role="menu">
          {SUPPORT_MENU_ITEMS.map((item) => (
            <a
              key={item.label}
              href={withSearch(item.route)}
              role="menuitem"
              onClick={(event) => {
                routeClick(event, item.route);
                if (event.defaultPrevented) {
                  onSelect(item.label);
                  onClose();
                }
              }}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      )}
    </span>
  );
}
