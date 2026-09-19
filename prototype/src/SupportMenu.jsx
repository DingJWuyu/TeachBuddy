/*
 * Top-bar support menu.
 *
 * Account-level destinations live in the support menu rather than at the bottom
 * of the sidebar. Geometry is taken from the reference menu:
 * 167px wide, 12px radius, 4px inset, 30px rows with 14px labels, and every row
 * carries a 16px line icon at a 12px inset with the label 10px after it.
 *
 * The reference opens this menu on hover rather than on click, so pointer entry
 * opens it and pointer exit closes it. Clicking only ever opens: a hover-opened
 * menu that closed on click would collapse under the pointer that opened it.
 * Touch has no hover, so pointer leave is ignored unless the pointer is a mouse.
 *
 * Items the reference also shows are deliberately omitted: "订阅" is a paid-plan
 * entry point, which this project excludes, and "反馈" has its own top-bar entry.
 *
 * Open state is owned by the shell so that every top-bar surface is mutually
 * exclusive through a single value.
 */
import { Icon } from './icons.jsx';

// Exported so the narrow-screen drawer renders the same list as the menu.
export const SUPPORT_MENU_ITEMS = [
  { label: '设置', icon: 'settings' },
  { label: '帮助', icon: 'circleHelp' },
  { label: '更新日志', icon: 'newspaper' }
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
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(item.label);
                onClose();
              }}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
