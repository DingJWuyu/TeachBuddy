import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';

const DURATION = 180;

/** Keep the outgoing content alive while a reversible CSS transition finishes. */
export function ModulePresence({ present, children, className = '', mode = 'surface' }) {
  const [mounted, setMounted] = useState(Boolean(present));
  const [visible, setVisible] = useState(false);
  const lastChildren = useRef(children);
  const wasPresent = useRef(false);
  if (present) lastChildren.current = children;

  useLayoutEffect(() => {
    let frame;
    let nextFrame;
    let timer;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (present) {
      setMounted(true);
      if (wasPresent.current || reduced) setVisible(true);
      else frame = requestAnimationFrame(() => {
        nextFrame = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      timer = window.setTimeout(() => setMounted(false), reduced ? 0 : DURATION);
    }
    wasPresent.current = Boolean(present);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(nextFrame);
      clearTimeout(timer);
    };
  }, [present]);

  if (!mounted && !present) return null;
  return (
    <div
      className={`wb-module-presence is-${mode} ${className}`.trim()}
      data-state={present && visible ? 'open' : 'closed'}
      inert={!present ? true : undefined}
      aria-hidden={!present ? true : undefined}
    >
      {mode === 'collapse' ? <div className="wb-module-collapse-inner">{lastChildren.current}</div> : lastChildren.current}
    </div>
  );
}

/** Content stays mounted so an optional field never loses its draft on collapse. */
export function ModuleDisclosure({ title, children, defaultOpen = false, open, onOpenChange, className = '' }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const active = open ?? expanded;
  const id = useId();
  return (
    <section className={`wb-module-disclosure ${className}`}>
      {title && <button type="button" className="wb-module-disclosure-trigger" aria-expanded={active} aria-controls={id}
        onClick={() => { setExpanded(!active); onOpenChange?.(!active); }}>
        <Icon name="chevron" size={14} /><span>{title}</span>
      </button>}
      <div id={id} className="wb-module-disclosure-grid" data-state={active ? 'open' : 'closed'} inert={!active ? true : undefined} aria-hidden={!active ? true : undefined}>
        <div className="wb-module-collapse-inner">{children}</div>
      </div>
    </section>
  );
}

export function useModuleDialogFocus(ref, onCancel) {
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]';
    const focusableElements = () => [...(node?.querySelectorAll(focusableSelector) || [])]
      .filter(element => element.getClientRects().length && !element.closest('[inert]'));
    focusableElements()[0]?.focus();
    function keydown(event) {
      if (node?.closest('[inert]')) return;
      const dialogs = [...document.querySelectorAll('[role="dialog"]')]
        .filter(element => !element.closest('[inert]') && element.getClientRects().length);
      const top = dialogs.at(-1);
      const ownDialog = node?.matches('[role="dialog"]') ? node : node?.querySelector('[role="dialog"]');
      if (top && top !== ownDialog) return;
      if ([...(node?.querySelectorAll('[role="menu"]') || [])].some(menu => !menu.closest('[inert]') && menu.contains(document.activeElement))) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [ref]);
}
