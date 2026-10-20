import { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ModulePresence, useModuleDialogFocus } from '../interaction/ModuleMotion.jsx';
import { Icon } from '../icons.jsx';
import { tx, useLocale } from '../../i18n/presentation.js';

const DialogVisible = createContext(true);
export function isConfirmKey(event) {
  return event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
    && !event.isComposing && !event.nativeEvent?.isComposing && event.keyCode !== 229 && !event.repeat;
}
export function Overlay({ present, children }) {
  const opening = useRef({ present: false, key: 0 });
  // A quick reopen must not resurrect the cancelled form kept for its exit animation.
  if (present && !opening.current.present) opening.current.key += 1;
  opening.current.present = present;
  return createPortal(<DialogVisible.Provider value={present}><ModulePresence key={opening.current.key} present={present} mode="overlay" className="cal-overlay-presence tbx-portal-host">{children}</ModulePresence></DialogVisible.Provider>, document.body);
}
const dialogConfirmSelector = 'footer [data-dialog-confirm]';
function DialogFocus({ dialogRef, onEscape }) {
  useModuleDialogFocus(dialogRef, onEscape);
  useEffect(() => {
    const dialog = dialogRef.current;
    const field = dialog?.querySelector('input:not(:disabled), textarea:not(:disabled), select:not(:disabled)');
    (field ?? dialog?.querySelector(`${dialogConfirmSelector}:not(:disabled)`) ?? dialog)?.focus();
  }, [dialogRef]);
  return null;
}
export function Dialog({ title, onClose, onEscape = onClose, children }) {
  const t = tx;
  useLocale();
  const ref = useRef(null);
  const active = useContext(DialogVisible);
  return <div className="cal-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="cal-dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} onKeyDownCapture={event => {
      if (!active || event.target.closest('[inert]') || event.target.closest('[role="dialog"]') !== event.currentTarget || event.key !== 'Enter') return;
      if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return;
      // Enter confirms the dialog, including when its close/cancel control has focus.
      // Suppress native button activation for repeats and modified Enter as well.
      event.preventDefault(); event.stopPropagation();
      if (isConfirmKey(event)) ref.current?.querySelector(`${dialogConfirmSelector}:not(:disabled)`)?.click();
    }} onKeyDown={event => {
      if (event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const row = target.closest('.cal-field-pair, .cal-repeat-row, .cal-repeat-days, .cal-label-colors');
        const controls = row && [...row.querySelectorAll('input[type="number"]:not(:disabled), select:not(:disabled), button:not(:disabled)')];
        if (controls?.includes(target)) {
          event.preventDefault();
          controls[controls.indexOf(target) + (event.key === 'ArrowLeft' ? -1 : 1)]?.focus();
          return;
        }
      }
      if (target.matches('select') && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const options = [...target.options].filter(option => !option.disabled && !option.closest('optgroup:disabled'));
        const index = options.findIndex(option => option.value === target.value);
        const next = options[Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))];
        if (next && next.value !== target.value) {
          target.value = next.value;
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
    }}>
      {active && <DialogFocus dialogRef={ref} onEscape={onEscape}/>}
      <header><h2>{title}</h2>{onClose && <button type="button" className="cal-icon-button" aria-label={t("关闭")} title={t("关闭")} onClick={onClose}><Icon name="close" size={18} strokeWidth={1.75}/></button>}</header>{children}
    </section>
  </div>;
}
