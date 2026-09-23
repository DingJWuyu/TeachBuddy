import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { ModulePresence, useModuleDialogFocus } from './ModuleMotion.jsx';
export { MenuItem } from './overlays.jsx';

/** Module menus are separate from chrome so their interaction does not alter the shell. */
export function Popover({ label, icon = 'more', children, align = 'end', className = '', buttonClassName = 'wb-icon-button' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function keydown(event) {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
      const items = [...(panelRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled), button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)') || [])];
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && items.length) {
        event.preventDefault();
        const current = items.indexOf(document.activeElement);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[index].focus();
      }
      if (event.key === 'Tab') close(false);
    }
    function pointerdown(event) {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(false);
    }
    const resized = () => close(false);
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', pointerdown);
    window.addEventListener('resize', resized);
    panelRef.current?.querySelector('button:not(:disabled), a, input')?.focus();
    return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', pointerdown); window.removeEventListener('resize', resized); };
  }, [open]);
  return <div className={`wb-popover-host wb-module-popover ${className}`}>
    <button ref={triggerRef} type="button" className={buttonClassName} aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(value => !value)}>
      {icon ? <Icon name={icon} /> : label}
    </button>
    <ModulePresence present={open}>
      <div ref={panelRef} className={`wb-popover is-${align}`} role="menu" aria-label={label} data-overlay="popover">
        {typeof children === 'function' ? children({ close }) : children}
      </div>
    </ModulePresence>
  </div>;
}

export function ConfirmDialog({ title, message, confirmLabel = '确认', secondaryLabel = null, onSecondary, onConfirm, onCancel }) {
  const ref = useRef(null);
  useModuleDialogFocus(ref, onCancel);
  return <div className="wb-dialog-host wb-module-dialog" data-overlay="dialog">
    <div className="wb-dialog-scrim" onClick={onCancel} role="presentation" />
    <div ref={ref} className="wb-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <h2>{title}</h2><p>{message}</p>
      <div className="wb-dialog-actions">
        <button type="button" className="wb-button" onClick={onCancel}>取消</button>
        {secondaryLabel && <button type="button" className="wb-button is-danger" name="dialog-secondary" onClick={onSecondary}>{secondaryLabel}</button>}
        <button type="button" className="wb-button is-primary" name="dialog-confirm" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>;
}
