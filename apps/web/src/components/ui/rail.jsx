import { Icon as Icon2 } from '../icons.jsx';
import { cx } from './classNames.js';

/*
 * The module layout every library-style page shares with Schedule:
 *
 *   ┌──────────── main card ────────────┐ ┌── rail ──┐
 *   │ PaneTitle · search · tools · New  │ │ sections │
 *   │ content                           │ │ …        │
 *   └───────────────────────────────────┘ └──────────┘
 *
 * The rail is exactly as wide as the side panel (--tbx-aux-w). Opening the
 * assistant slides the panel over the rail (shell.css), so the main card never
 * moves - the same behaviour as the calendar's right column. Below 951px the
 * rail folds into one scrolling row above the main card (split.css).
 */

const Icon = ({ name, size = 16, stroke = 2 }) => {
  return <Icon2 name={name} size={size} strokeWidth={stroke} />;
};

/* the right column */
export function Rail({ label, children, footer, className, ...rest }) {
  return (
    <aside className={cx('tbx-rail', className)} aria-label={label} {...rest}>
      <div className="tbx-rail-scroll">{children}</div>
      {footer && <div className="tbx-rail-foot">{footer}</div>}
    </aside>
  );
}

/* a titled group, like "即将到来 (2)" on the calendar; actions are round buttons */
export function RailSection({ title, count, actions, children, className }) {
  return (
    <section className={cx('tbx-rail-section', className)}>
      {(title || actions) && (
        <header className="tbx-rail-head">
          {title && <h2>{title}{count != null && count !== '' && <span>{count}</span>}</h2>}
          {actions && <span className="tbx-rail-actions">{actions}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

/* a round 32px button in a section head; the primary one is blue (one per head) */
export function RailAction({ icon, label, onClick, primary, disabled, pressed }) {
  return (
    <button type="button" className={cx('tbx-rail-action', primary && 'is-primary', pressed && 'is-on')} aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={primary ? 17 : 16} stroke={primary ? 2.3 : 2} />
    </button>
  );
}

/* one row: an icon tile (or a coloured mark), a name, a count; optional "…" on hover */
/* `drop` names the row as a drop target (data-drop) for things dragged onto the
   rail; `toggle` adds a disclosure arrow in front of rows that hold others */
export function RailItem({ icon, mark, label, count, current, onClick, disabled, more, depth, className, title, drop, toggle }) {
  return (
    <div className={cx('tbx-rail-item', current && 'is-current', more && 'has-more', toggle && 'has-toggle', className)} style={depth ? { '--depth': depth } : undefined} data-drop={drop}>
      {toggle && (
        <button type="button" className={cx('tbx-rail-toggle', toggle.open && 'is-open')} aria-expanded={toggle.open} aria-label={toggle.label} title={toggle.label} onClick={toggle.onClick}>
          <Icon name="chevron" size={12} stroke={2.4} />
        </button>
      )}
      <button type="button" className="tbx-rail-hit" aria-current={current ? 'true' : undefined} disabled={disabled} onClick={onClick} title={title}>
        {mark || <span className="tbx-rail-icon"><Icon name={icon} size={15} /></span>}
        <span className="tbx-rail-label">{label}</span>
        {count != null && count !== '' && count !== 0 && <small>{count}</small>}
      </button>
      {more && (
        <button type="button" className="tbx-rail-more" aria-label={more.label} title={more.label} disabled={disabled} onClick={more.onClick}>
          <Icon name="more" size={15} />
        </button>
      )}
    </div>
  );
}

/* tag chips; pressed ones filter the main card */
export function RailTags({ tags, selected = [], onToggle, disabled }) {
  return (
    <div className="tbx-rail-tags">
      {tags.map((t) => (
        <button key={t.id} type="button" aria-pressed={selected.includes(t.id)} disabled={disabled} onClick={() => onToggle(t.id)}>
          <Icon name="tag" size={12} stroke={2.2} />{t.name}
        </button>
      ))}
    </div>
  );
}

/* a line about the assistant that opens it (it slides over this rail) */
export function RailHint({ children, tone, onClick }) {
  return (
    <button type="button" className={cx('tbx-rail-hint', tone && `is-${tone}`)} onClick={onClick}>
      <Icon name="sparkles" size={16} stroke={1.9} />
      <span>{children}</span>
      <Icon name="forward" size={13} stroke={2.2} />
    </button>
  );
}

/* the left card's title: module tile, what is shown, how many */
export function PaneTitle({ icon, tone, title, sub, id, children }) {
  return (
    <div className="tbx-pane-title">
      <span className={cx('tbx-mod-icon', tone && `is-${tone}`)} aria-hidden="true">{icon}</span>
      <div>
        <h1 id={id} tabIndex={-1}>{title}</h1>
        {sub != null && <span>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

/* the one blue action of a page */
export function PrimaryButton({ icon = 'plus', label, onClick, disabled, compact }) {
  return (
    <button type="button" className={cx('tbx-primary', compact && 'is-compact')} disabled={disabled} onClick={onClick} aria-label={compact ? label : undefined} title={compact ? label : undefined}>
      <Icon name={icon} size={16} stroke={2.3} />
      {!compact && <span>{label}</span>}
    </button>
  );
}

