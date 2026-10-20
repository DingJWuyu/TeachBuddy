import { h, Fragment } from '../shim.js';
import { tb, useEffect, useRef, useState, cx, tx, useLocale } from '../react.js';

/*
 * Deleting always asks twice — and always in one of two ways, so a teacher
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
  const { Icon2 } = tb();
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
function shellRoot() {
  return document.querySelector('.wb-shell') || document.body;
}

export function ConfirmDialog({
  title, message, confirmLabel, cancelLabel, danger = true, icon, onConfirm, onCancel, children, busy, disabled,
  secondaryLabel, onSecondary,
}) {
  useLocale();
  const { createPortal } = tb();
  const ref = useRef(null);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('[data-autofocus], .tbx-confirm-actions button:last-child')?.focus();
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); prev?.focus?.(); };
  }, []);
  const run = async () => {
    setWorking(true);
    try { await onConfirm(); } finally { setWorking(false); }
  };
  const node = (
    <div className="tbx-confirm-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={cx('tbx-confirm', danger && 'is-danger')} role="alertdialog" aria-modal="true" aria-labelledby="tbx-confirm-title" ref={ref}>
        <span className="tbx-confirm-icon" aria-hidden="true"><Glyph name={icon || (danger ? 'trash' : 'info')} size={22} /></span>
        <h2 id="tbx-confirm-title">{title}</h2>
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
  return createPortal ? createPortal(node, shellRoot()) : node;
}

/* The app's own module dialog (ModuleOverlays ConfirmDialog) renders through this. */
const DESTRUCTIVE = /删除|移除|清空|解散|丢弃|放弃|delete|remove|discard/i;
export function AppConfirmDialog({ title, message, confirmLabel, secondaryLabel, onSecondary, onConfirm, onCancel }) {
  const danger = DESTRUCTIVE.test(`${confirmLabel || ''} ${title || ''}`);
  return (
    <ConfirmDialog
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
