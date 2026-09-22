/**
 * Overlay primitives (menu, confirmation).
 *
 * Progressive appearance is part of the agreed shell behaviour: opacity, scale
 * from 0.96 and a 4px offset over 180ms with the focus returning to the trigger.
 * Closing is instant; reduced motion lands directly on the final state.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

export function Popover({ label, icon = 'more', children, align = 'end', className = '', buttonClassName = 'wb-icon-button' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event) {
      if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    const first = panelRef.current?.querySelector('button, a, input, textarea, select');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className={`wb-popover-host ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((current) => !current)}
      >
        {icon ? <Icon name={icon} /> : label}
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`wb-popover is-${align}`}
          role="menu"
          aria-label={label}
          data-overlay="popover"
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, danger = false, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`wb-menu-item${danger ? ' is-danger' : ''}`}
      {...props}
    >
      {icon && <Icon name={icon} size={15} />}
      <span>{children}</span>
    </button>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = '确认', secondaryLabel = null, onSecondary, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    confirmRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="wb-dialog-host" data-overlay="dialog">
      <div className="wb-dialog-scrim" onClick={onCancel} role="presentation" />
      <div className="wb-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="wb-dialog-actions">
          <button type="button" className="wb-button" onClick={onCancel}>取消</button>
          {secondaryLabel && (
            <button type="button" className="wb-button is-danger" name="dialog-secondary" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
          <button ref={confirmRef} type="button" className="wb-button is-primary" name="dialog-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
