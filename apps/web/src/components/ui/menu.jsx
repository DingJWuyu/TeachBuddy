import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../icons.jsx';
import { cx } from './classNames.js';
import { Popover } from './popover.jsx';

const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled), [role="menuitemradio"]:not(:disabled), button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)';

/** A labelled trigger and the shared anchored menu surface. */
export function Menu({ label, icon = 'more', children, align = 'end', className, menuClassName, buttonClassName = 'wb-icon-button', disabled }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const panel = useRef(null);
  const initial = useRef('first');
  const id = useId();
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) anchor.current?.focus();
  };
  const items = () => [...(panel.current?.querySelectorAll(ITEM_SELECTOR) || [])].filter((node) => !node.closest('[inert]') && node.getClientRects().length);
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      const available = items();
      (initial.current === 'last' ? available.at(-1) : available[0])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const keydown = (event) => {
    // Continue native tab order from the trigger, not the portalled panel.
    if (event.key === 'Tab') { close(); return; }
    // Native editing keys belong to embedded text fields.
    if (event.target.matches('input, textarea, select')) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const available = items();
    if (!available.length) return;
    event.preventDefault();
    event.stopPropagation();
    const current = available.indexOf(document.activeElement);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1
      : current < 0 ? (event.key === 'ArrowUp' ? available.length - 1 : 0)
        : (current + (event.key === 'ArrowUp' ? -1 : 1) + available.length) % available.length;
    available[index].focus();
  };
  return <div className={cx('tbx-menu-trigger', className)}>
    <button ref={anchor} type="button" className={buttonClassName} disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={label} title={label}
      onClick={() => { initial.current = 'first'; setOpen((value) => !value); }}
      onKeyDown={(event) => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); initial.current = event.key === 'ArrowUp' ? 'last' : 'first'; setOpen(true); } }}>
      {typeof icon === 'string' ? <Icon name={icon} /> : icon || label}
    </button>
    <Popover anchor={anchor} surfaceRef={panel} id={id} open={open} onClose={(event) => close(event?.type === 'keydown')} align={align} role="menu" label={label} className={cx('tbx-kit-menu', menuClassName)} onKeyDown={keydown}>
      {typeof children === 'function' ? children({ close }) : children}
    </Popover>
  </div>;
}

export function MenuItem({ icon, children, danger = false, className, ...props }) {
  return <button type="button" role="menuitem" {...props} className={cx('tbx-menu-item', danger && 'is-danger', className)}>
    {typeof icon === 'string' ? <Icon name={icon} size={15} /> : icon}
    <span>{children}</span>
  </button>;
}
