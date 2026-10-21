import { h, Fragment } from '../shim.js';
import { tb, useEffect, useLayoutEffect, useRef, useState, cx } from '../react.js';

/*
 * A floating surface anchored to a control: menus, pickers, filters.
 * It lives in a portal (so no card, list or scroll area can clip or cover it),
 * opens below its anchor and flips above when there is no room, and always
 * stays fully inside the window with a 12px margin.
 */
const MARGIN = 12;

export function shellRoot() {
  return document.querySelector('.wb-shell') || document.body;
}

export function useDismiss(open, refs, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const inside = (target) => refs.some((r) => r.current?.contains(target));
    const down = (e) => { if (!inside(e.target)) onClose(e); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(e); } };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);
}

export function Popover({ anchor, open, onClose, children, className, align = 'start', offset = 6, label, role = 'dialog' }) {
  const { createPortal } = tb();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useDismiss(open, [ref, anchor], onClose);
  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const el = ref.current;
      if (!a || !el) return;
      const w = el.offsetWidth;
      const hgt = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = align === 'end' ? a.right - w : align === 'center' ? a.left + a.width / 2 - w / 2 : a.left;
      left = Math.max(MARGIN, Math.min(left, vw - MARGIN - w));
      let top = a.bottom + offset;
      let above = false;
      if (top + hgt > vh - MARGIN) {
        if (a.top - offset - hgt >= MARGIN) { top = a.top - offset - hgt; above = true; }
        else top = Math.max(MARGIN, vh - MARGIN - hgt);
      }
      setPos({ left: Math.round(left), top: Math.round(top), above, maxHeight: vh - 2 * MARGIN });
    };
    place();
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  if (!open) return null;
  const node = (
    <div
      ref={ref}
      role={role}
      aria-label={label}
      className={cx('tbx-popover', pos?.above && 'is-above', className)}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>
  );
  return createPortal ? createPortal(node, shellRoot()) : node;
}
