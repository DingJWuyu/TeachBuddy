import { useEffect, useId, useRef, useState } from 'react';
import { Presence } from '../workbench/chrome/Presence.jsx';

export function SettingsDisclosure({ title, children, className = '' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className={`settings-disclosure ${className}`} data-open={open}>
    <button type="button" className="settings-disclosure-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>{title}</span><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div className="settings-disclosure-grid" id={id} inert={!open} aria-hidden={!open}><div className="settings-disclosure-inner"><div className="settings-disclosure-content">{children}</div></div></div>
  </div>;
}

function SettingsDialogBody({ title, children, confirmLabel, onConfirm, onClose, danger, confirmDisabled, closeLabel, className = '' }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={dialog} className={`settings-confirm ${className}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    } }}>
    <div className="settings-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="settings-dialog-close" onClick={onClose} aria-label="关闭">×</button></div>
    <div className="settings-confirm-copy">{children}</div>
    <div className="settings-confirm-actions"><button type="button" className="wb-button" onClick={onClose} autoFocus>{closeLabel || (confirmLabel ? '取消' : '关闭')}</button>
      {confirmLabel && <button type="button" className={`wb-button ${danger ? 'settings-danger-button' : 'settings-primary'}`} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</button>}</div>
  </dialog>;
}
export function SettingsConfirm({ show, ...props }) {
  return <Presence show={show}><SettingsDialogBody {...props} /></Presence>;
}
