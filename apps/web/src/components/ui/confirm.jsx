import { createPortal } from 'react-dom';
import { shellRoot } from './popover.jsx';
import { Icon as Icon2 } from '../icons.jsx';
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { ModulePresence } from '../interaction/ModuleMotion.jsx';
import { cx } from './classNames.js';
import { tx, useLocale } from '../../i18n/presentation.js';

/*
 * Deleting always asks twice - and always in one of two ways, so a teacher
 * learns it once:
 *
 *   1. In place (preferred). The delete control itself slides open into a red
 *      "Delete" pill; a second press deletes. It closes again on its own after
 *      a few seconds, on Escape, or when you click elsewhere.
 *        <ConfirmButton>   an icon button (trash) → red pill
 *        <ConfirmMenuItem> a menu row → the same red pill, in the menu
 *
 *   2. A dialog, when the consequence needs a sentence (a repeating series, an
 *      account) or there is no control to grow from.
 *        <ConfirmDialog> / confirmDialog({...}) → Promise<boolean>
 *
 * Copy can differ; the template, colours and motion never do.
 */

const ARM_MS = 3200;

function Glyph({ name, size = 16, stroke = 1.9 }) {
  return <Icon2 name={name} size={size} strokeWidth={stroke} />;
}

/* armed state that falls back on its own, on Escape and on outside clicks */
export function useArmed(ref) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), ARM_MS);
    const away = (e) => { if (!ref.current?.contains(e.target)) setArmed(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setArmed(false); } };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [armed]);
  return [armed, setArmed];
}

/*
 * Icon button that opens into a red "Delete" pill. `text` shows a label next to
 * the icon even when not armed (for toolbars that use labelled buttons).
 */
export function ConfirmButton({
  label, confirmLabel, onConfirm, icon = 'trash', text, size = 'md', disabled, className, quiet,
}) {
  useLocale();
  const ref = useRef(null);
  const [armed, setArmed] = useArmed(ref);
  const confirmText = confirmLabel || tx('确认删除');
  return (
    <button
      type="button"
      ref={ref}
      className={cx('tbx-confirm-btn', `is-${size}`, armed && 'is-armed', text && 'has-text', quiet && 'is-quiet', className)}
      disabled={disabled}
      aria-label={armed ? confirmText : label}
      title={armed ? undefined : label}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) { setArmed(false); onConfirm(); } else setArmed(true);
      }}
    >
      <Glyph name={icon} size={size === 'sm' ? 14 : 16} />
      {text && <span className="tbx-confirm-idle">{text}</span>}
      <span className="tbx-confirm-text" aria-hidden={!armed}>{confirmText}</span>
    </button>
  );
}

/* A menu row with the same behaviour. The menu stays open after the first press. */
export function ConfirmMenuItem({ icon, label, confirmLabel, onConfirm, className, disabled }) {
  useLocale();
  const ref = useRef(null);
  const [armed, setArmed] = useArmed(ref);
  return (
    <button
      type="button"
      role="menuitem"
      ref={ref}
      disabled={disabled}
      className={cx('tbx-confirm-mi', 'is-danger', armed && 'is-armed', className)}
      onClick={(e) => {
        e.stopPropagation();
        if (armed) { setArmed(false); onConfirm(); } else setArmed(true);
      }}
    >
      {icon || <Glyph name="trash" />}
      <span>{armed ? (confirmLabel || tx('确认删除')) : label}</span>
    </button>
  );
}

/* ---------- the dialog ---------- */

const ConfirmVisible = createContext(true);

export function ConfirmDialog({ present, ...props }) {
  const opening = useRef({ present: false, key: 0 });
  // A retained exit belongs inside the portal so its inert boundary contains the dialog.
  if (present === undefined) return createPortal(<ConfirmContent {...props} />, shellRoot());
  if (present && !opening.current.present) opening.current.key += 1;
  opening.current.present = Boolean(present);
  return createPortal(
    <ConfirmVisible.Provider value={Boolean(present)}>
      <ModulePresence key={opening.current.key} present={present} mode="overlay" className="tbx-confirm-presence">
        {present && <ConfirmContent {...props} />}
      </ModulePresence>
    </ConfirmVisible.Provider>,
    shellRoot(),
  );
}

function ConfirmContent({
  title, message, confirmLabel, cancelLabel, danger = true, icon, onConfirm, onCancel, children, busy, disabled,
  secondaryLabel, onSecondary, enterConfirms = false,
}) {
  useLocale();
  const active = useContext(ConfirmVisible);
  const ref = useRef(null);
  const [working, setWorking] = useState(false);
  const titleId = useId();
  const running = useRef(false);
  const actions = useRef(null);
  actions.current = { onConfirm, onCancel, busy, disabled, active, enterConfirms };
  useEffect(() => {
    if (!active) return undefined;
    const prev = document.activeElement;
    ref.current?.querySelector('[data-autofocus], .tbx-confirm-actions button:last-child')?.focus();
    const key = (e) => {
      const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter((node) => node.getClientRects().length && !node.closest('[inert]'));
      if (dialogs.at(-1) !== ref.current || ref.current?.closest('[inert]')) return;
      if (document.querySelector('.tbx-popover[role=menu]')) return;
      if (e.key === 'Escape') { e.stopPropagation(); actions.current.onCancel(); }
      if (e.key === 'Enter') {
        if (e.target.closest?.('textarea, [contenteditable="true"]')) return;
        if ((e.isComposing || e.keyCode === 229) && e.target.closest?.('input')) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.isComposing || e.keyCode === 229 || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        const focusedButton = e.target.closest?.('button');
        if (!actions.current.enterConfirms && focusedButton && ref.current?.contains(focusedButton)) {
          if (!focusedButton.disabled) focusedButton.click();
        } else {
          ref.current?.querySelector('.tbx-confirm-ok:not(:disabled)')?.click();
        }
      }
      if (e.key !== 'Tab') return;
      const controls = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter((el) => el.getClientRects().length);
      if (!controls.length) { e.preventDefault(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      const current = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
        .filter(node => node !== ref.current && node.getClientRects().length && !node.closest('[inert]')).at(-1);
      if (current && !current.contains(prev)) return;
      if (prev?.isConnected && !prev.closest('[inert]')) prev.focus();
    };
  }, [active]);
  const run = async () => {
    if (!actions.current.active || running.current || actions.current.busy || actions.current.disabled) return;
    running.current = true;
    setWorking(true);
    try { await actions.current.onConfirm(); } finally { running.current = false; setWorking(false); }
  };
  return (
    <div className="tbx-confirm-scrim" onPointerDown={(e) => { if (active && e.target === e.currentTarget) onCancel(); }}>
      <div className={cx('tbx-confirm', danger && 'is-danger')} role="alertdialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <span className="tbx-confirm-icon" aria-hidden="true"><Glyph name={icon || (danger ? 'trash' : 'info')} size={22} /></span>
        <h2 id={titleId}>{title}</h2>
        {message && <p>{message}</p>}
        {children}
        <div className="tbx-confirm-actions">
          <button type="button" className="tbx-confirm-cancel" onClick={onCancel}>{cancelLabel || tx('取消')}</button>
          {secondaryLabel && <button type="button" className="tbx-confirm-secondary" onClick={onSecondary}>{secondaryLabel}</button>}
          <button type="button" className="tbx-confirm-ok" disabled={busy || working || disabled} onClick={run}>{confirmLabel || tx('删除')}</button>
        </div>
      </div>
    </div>
  );
}

/* The app's own module dialog (ModuleOverlays ConfirmDialog) renders through this. */
const DESTRUCTIVE = /删除|移除|清空|解散|丢弃|放弃|delete|remove|discard/i;
export function AppConfirmDialog({ title, message, confirmLabel, secondaryLabel, onSecondary, onConfirm, onCancel, ...props }) {
  const danger = DESTRUCTIVE.test(`${confirmLabel || ''} ${title || ''}`);
  return (
    <ConfirmDialog
      {...props}
      title={title}
      message={message}
      confirmLabel={confirmLabel || tx('确认')}
      danger={danger}
      secondaryLabel={secondaryLabel}
      onSecondary={onSecondary}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

/* Imperative form, for code that isn't a component (and for the app's own screens). */
let pending = null;
const listeners = new Set();
export function confirmDialog(options) {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { ...options, resolve };
    listeners.forEach((fn) => fn(pending));
  });
}
export function ConfirmHost() {
  const [req, setReq] = useState(pending);
  useEffect(() => {
    listeners.add(setReq);
    return () => listeners.delete(setReq);
  }, []);
  if (!req) return null;
  const done = (ok) => { req.resolve(ok); if (pending === req) pending = null; setReq(null); };
  return <ConfirmDialog {...req} onConfirm={() => done(true)} onCancel={() => done(false)} />;
}
