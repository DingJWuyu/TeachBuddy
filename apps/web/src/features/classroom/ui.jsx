import React, { Fragment } from 'react';
import { Icon2 } from '../../components/icons.jsx';
import { Popover } from '../../components/ui/popover.jsx';
import { ConfirmDialog } from '../../components/ui/confirm.jsx';
import { useEffect, useRef, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { initials, hueOf } from './util.js';

/* Small building blocks the classroom screens share. */

export const Icon = ({ name, size = 17, stroke = 1.9 }) => {
  return <Icon2 name={name} size={size} strokeWidth={stroke} />;
};

export function Avatar({ name, id, size = 'md', className }) {
  return <span className={cx('cr-avatar', `is-${size}`, `is-${hueOf(id || name)}`, className)} aria-hidden="true">{size === 'sm' ? (/[一-鿿]/.test(name || '') ? initials(name).slice(-1) : initials(name).slice(0, 1)) : initials(name)}</span>;
}

export function Seg({ value, options, onChange, label, className }) {
  return (
    <div className={cx('cr-seg', className)} role="tablist" aria-label={label}>
      {options.map(([key, text, icon]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} className={cx(value === key && 'is-on')} onClick={() => onChange(key)}>
          {icon && <Icon name={icon} size={15} stroke={2} />}
          <span>{text}</span>
        </button>
      ))}
    </div>
  );
}

export function Menu({ label, icon = 'more', items, align = 'end', className, trigger }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  return (
    <span className={cx('cr-menuwrap', className)} ref={ref}>
      {trigger ? trigger({ open, toggle: () => setOpen(!open) }) : (
        <button type="button" className={cx('cr-icon-btn', open && 'is-on')} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name={icon} size={17} />
        </button>
      )}
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} align={align} className={cx('cr-menu', `is-${align}`)} role="menu" label={label}>
          {items.filter(Boolean).map((item, i) => (item === '-' ? <div key={i} className="cr-menu-sep" /> : (
            <button key={i} type="button" role="menuitem" className={cx(item.danger && 'is-danger')} disabled={item.disabled} onClick={() => { if (!item.keep) setOpen(false); item.onClick(); }}>
              {item.icon && <Icon name={item.icon} size={15} stroke={2} />}
              <span>{item.label}</span>
              {item.check && <Icon name="check" size={14} stroke={2.4} />}
            </button>
          )))}
      </Popover>
    </span>
  );
}

export function Dialog({ title, subtitle, onClose, children, footer, wide, className, busy = false }) {
  const ref = useRef(null);
  const closing = useRef({ busy, onClose });
  closing.current = { busy, onClose };
  const dismiss = () => { if (!closing.current.busy) closing.current.onClose(); };
  useEffect(() => {
    const previous = document.activeElement;
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); dismiss(); }
      if (e.key === 'Tab') {
        const nodes = [...(ref.current?.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled),a[href]') || [])].filter(el => el.getClientRects().length);
        if (!nodes.length) { e.preventDefault(); ref.current?.focus(); return; }
        const first = nodes[0], last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    const first = ref.current?.querySelector('input:not([type=hidden]), textarea, select');
    first?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (busy) ref.current?.focus({ preventScroll: true }); }, [busy]);
  return (
    <div className="cr-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <section ref={ref} className={cx('cr-dialog', wide && 'is-wide', className)} role="dialog" tabIndex={-1} aria-modal="true" aria-label={title}>
        <header className="cr-dialog-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="cr-icon-btn is-filled" aria-label={tx('关闭')} disabled={busy} onClick={dismiss}><Icon name="close" size={13} stroke={2.4} /></button>
        </header>
        <div className="cr-dialog-body">{children}</div>
        {footer && <footer className="cr-dialog-foot">{footer}</footer>}
      </section>
    </div>
  );
}

/* Confirmations use the shared dialog template (kit/confirm.jsx). */
export function Confirm({ title, message, confirmLabel, danger, icon, onConfirm, onClose, onError }) {
  return (
    <ConfirmDialog
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      danger={Boolean(danger)}
      icon={icon || 'trash'}
      onConfirm={async () => {
        try { await onConfirm(); onClose(); }
        catch (error) { await onError(error); }
      }}
      onCancel={onClose}
    />
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('cr-field', className)}>
      <span className="cr-field-label">{label}{hint && <em>{hint}</em>}</span>
      {children}
    </label>
  );
}

export function Empty({ art, icon, title, text, children, compact }) {
  return (
    <div className={cx('cr-empty', compact && 'is-compact')}>
      {art || (icon && <span className="cr-empty-icon"><Icon name={icon} size={22} stroke={1.9} /></span>)}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="cr-empty-actions">{children}</div>}
    </div>
  );
}

export function Search({ value, onChange, placeholder, label }) {
  return (
    <label className="cr-search">
      <Icon name="search" size={16} stroke={2} />
      <input aria-label={label || placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" className="cr-search-clear" aria-label={tx('清除搜索')} onClick={() => onChange('')}><Icon name="close" size={11} stroke={2.8} /></button>}
    </label>
  );
}

export const Spinner = ({ small }) => <span className={cx('tbx-spinner', small && 'is-small')} aria-hidden="true" />;

/* A transient message at the bottom of the module. */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (text, kind = 'ok') => {
    clearTimeout(timer.current);
    setToast({ text, kind, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), kind === 'error' ? 5200 : 2600);
  };
  const node = toast && (
    <div key={toast.key} className={cx('cr-toast', `is-${toast.kind}`)} role="status">
      <Icon name={toast.kind === 'error' ? 'info' : 'check'} size={15} stroke={2.2} />
      <span>{toast.text}</span>
    </div>
  );
  return [node, show];
}
