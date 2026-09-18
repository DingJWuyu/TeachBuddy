/*
 * Top-bar support menu.
 *
 * The reference keeps account-level destinations in the support menu rather than
 * at the bottom of the sidebar, so the prototype's sidebar footer is gone and
 * settings lives here instead. Geometry is taken from the reference menu:
 * 167px wide, 12px radius, 4px inset, 1px #e3e3e3 border, and 30px rows with
 * 14px labels.
 *
 * Items the reference also shows are deliberately omitted: "订阅" is a paid-plan
 * entry point, which this project excludes, and "反馈" needs a backend that is out
 * of scope under Issue #16.
 */
import { useEffect, useRef, useState } from 'react';

const MENU_ITEMS = ['设置', '帮助', '更新日志'];

export default function SupportMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <span className="tb-support-wrap" ref={wrapRef}>
      <button
        type="button"
        className={open ? 'is-current' : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        支持
      </button>
      {open && (
        <div className="tb-support-menu" role="menu">
          {MENU_ITEMS.map((item) => (
            <button key={item} type="button" role="menuitem" onClick={() => setOpen(false)}>{item}</button>
          ))}
        </div>
      )}
    </span>
  );
}
