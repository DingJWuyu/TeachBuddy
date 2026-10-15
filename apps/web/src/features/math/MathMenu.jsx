import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons.jsx';
import { ModulePresence } from '../../components/interaction/ModuleMotion.jsx';
export { MenuItem } from '../../components/interaction/overlays.jsx';

export function MathMenu({ label, className = '', children }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const panel = useRef(null);
  const close = (restore = true) => { setOpen(false); if (restore) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    let secondFrame;
    const items = () => [...(panel.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') ?? [])];
    // Presence reveals the panel on the next frame; focus only after it is visible.
    const frame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => (items()[0] ?? panel.current)?.focus()); });
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') close(false);
      const available = items();
      if (!available.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = available.indexOf(document.activeElement);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : current < 0 ? (event.key === 'ArrowUp' ? available.length - 1 : 0) : (current + (event.key === 'ArrowUp' ? -1 : 1) + available.length) % available.length;
      available[index].focus();
    };
    const outside = event => { if (!panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close(false); };
    const resize = () => close(false);
    document.addEventListener('keydown', keydown);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(secondFrame); document.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [open]);
  return <div className={`wb-popover-host wb-module-popover ${className}`}>
    <button ref={trigger} type="button" className="mw-icon" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><Icon name="more"/></button>
    <ModulePresence present={open}><div ref={panel} className="wb-popover is-end" role="menu" aria-label={label} data-overlay="popover" tabIndex={-1}>{children({ close })}</div></ModulePresence>
  </div>;
}
