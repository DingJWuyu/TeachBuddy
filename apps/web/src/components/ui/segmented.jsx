import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from './classNames.js';

/*
 * Side-by-side choices with a highlight that slides to the current one: the
 * same motion as the top bar's 首页 / 日程 and the calendar's 日历 / 任务.
 * Any "pick one of a few, shown in a row" control uses this.
 */
export function useSlidingThumb(ref, selector, deps) {
  const [thumb, setThumb] = useState(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    const measure = () => {
      const el = box.querySelector(selector);
      setThumb(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, deps);
  return thumb;
}

export function Segmented({ value, options, onChange, label, className, iconOnly }) {
  const ref = useRef(null);
  const thumb = useSlidingThumb(ref, '[aria-pressed="true"]', [value, options.length]);
  return (
    <div className={cx('tbx-seg', iconOnly && 'is-icons', className)} ref={ref} role="group" aria-label={label}>
      {thumb && <span className="tbx-seg-thumb" style={{ transform: `translateX(${thumb.left}px)`, width: `${thumb.width}px` }} aria-hidden="true" />}
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} aria-label={iconOnly ? o.label : undefined} title={iconOnly ? o.label : undefined} onClick={() => o.value !== value && onChange(o.value)}>
          {o.icon}
          {!iconOnly && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
