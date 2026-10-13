import { useLayoutEffect, useRef, useState } from 'react';

export default function ResizeDivider({ value, onChange, label }) {
  const divider = useRef(null);
  const dragOffset = useRef(0);
  const [minimum, setMinimum] = useState(0.25);
  const measure = () => {
    const parent = divider.current.parentElement;
    const bounds = parent.getBoundingClientRect();
    const style = getComputedStyle(parent);
    const padding = parseFloat(style.paddingLeft) || 0;
    const gap = parseFloat(style.getPropertyValue('--q-gap')) || 16;
    const available = bounds.width - padding - (parseFloat(style.paddingRight) || 0) - gap;
    const firstMin = parseFloat(style.getPropertyValue('--q-first-min')) || 0;
    return { left: bounds.left + padding, gap, available, minimum: available > 0 ? Math.max(0.25, firstMin / available) : 0.25 };
  };
  useLayoutEffect(() => {
    const update = () => setMinimum(measure().minimum);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(divider.current.parentElement);
    return () => observer.disconnect();
  }, [value, label]);
  const current = Math.max(minimum, value);
  const maximum = Math.max(minimum, 0.7);
  const change = (next) => onChange(Math.max(minimum, Math.min(maximum, next)));
  return (
    <div ref={divider} className="q-resize-divider" role="separator" tabIndex={0}
      aria-label={label} aria-orientation="vertical"
      aria-valuemin={Math.round(minimum * 100)} aria-valuemax={Math.round(maximum * 100)} aria-valuenow={Math.round(current * 100)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        const bounds = event.currentTarget.getBoundingClientRect();
        dragOffset.current = event.clientX - bounds.left - bounds.width / 2;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const { left, gap, available } = measure();
        if (available > 0) change((event.clientX - dragOffset.current - left - gap / 2) / available);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        change(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : current + (event.key === 'ArrowLeft' ? -0.02 : 0.02));
      }}
    />
  );
}
