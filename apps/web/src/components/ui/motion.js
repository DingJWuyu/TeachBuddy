import { useLayoutEffect, useRef } from 'react';

/*
 * Shared motion helpers. Every "things moved to new places" animation in the
 * overlay goes through useFlip, so reordering looks and feels the same in the
 * sidebar, checklists and boards.
 */
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/*
 * FLIP: elements that moved since the last committed layout glide there.
 *
 * Two ways to trigger it:
 *   - pass a signature (e.g. the order of ids); when it changes, rows glide
 *     from where they were last measured
 *   - pass null and call capture() just before you change the order; only
 *     that change animates. Use this where CSS transitions (folding, sliding)
 *     also move things, so stale measurements never make rows jump.
 */
export function useFlip(signature, { duration = 300 } = {}) {
  const els = useRef(new Map());
  const rects = useRef(new Map());
  const last = useRef(signature);
  const captured = useRef(null);
  const measure = () => {
    const out = new Map();
    els.current.forEach((el, key) => { if (el.isConnected) out.set(key, el.getBoundingClientRect()); });
    return out;
  };
  useLayoutEffect(() => {
    const manual = signature === null;
    const changed = manual ? Boolean(captured.current) : last.current !== signature;
    const before = captured.current || rects.current;
    captured.current = null;
    last.current = signature;
    const now = measure();
    if (changed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      now.forEach((r, key) => {
        const el = els.current.get(key);
        const p = before.get(key);
        if (!p || el.dataset.flip === 'off') return;
        const dy = p.top - r.top;
        if (Math.abs(dy) < 1) return;
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration, easing: EASE });
      });
    }
    if (!manual) rects.current = now;
  });
  const ref = (key) => (el) => {
    if (el) els.current.set(key, el);
    else els.current.delete(key);
  };
  ref.capture = () => { captured.current = measure(); };
  return ref;
}
