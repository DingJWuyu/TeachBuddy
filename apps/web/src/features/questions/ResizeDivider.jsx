export default function ResizeDivider({ value, onChange, label }) {
  const change = (next) => onChange(Math.min(0.7, Math.max(0.25, next)));
  return (
    <div className="q-resize-divider" role="separator" tabIndex={0}
      aria-label={label} aria-orientation="vertical"
      aria-valuemin={25} aria-valuemax={70} aria-valuenow={Math.round(value * 100)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const parent = event.currentTarget.parentElement;
        const bounds = parent.getBoundingClientRect();
        const style = getComputedStyle(parent);
        const padding = parseFloat(style.paddingLeft) || 0;
        const gap = parseFloat(style.columnGap) || 0;
        const available = bounds.width - padding - (parseFloat(style.paddingRight) || 0) - gap;
        if (available > 0) change((event.clientX - bounds.left - padding - gap / 2) / available);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        change(event.key === 'Home' ? 0.25 : event.key === 'End' ? 0.7 : value + (event.key === 'ArrowLeft' ? -0.02 : 0.02));
      }}
    />
  );
}
