import { h, Fragment } from '../shim.js';
import { tb, useRef, useState, cx, tx } from '../react.js';
import { Popover } from './popover.jsx';

/*
 * Narrow a list by one or more categories. The template is the task board's
 * label filter: the shared popover, an "all" row, then one checkable row per
 * category; picking does not close the menu, so several can be picked in a row.
 *
 * The button never changes size: it shows its name until something is picked,
 * then the number picked, in the same blue as any active filter. Both labels
 * sit in the same grid cell, so the wider one sets the width once.
 */
const Check = () => {
  const { Icon2 } = tb();
  return <span className="tbx-pop-check"><Icon2 name="check" size={14} strokeWidth={2.4} /></span>;
};

/* `button` may draw the trigger itself (it gets ref, open, toggle, active, count) and
   `check` the tick, so a place that already had its own look keeps it exactly. */
export function FilterMenu({ label, allLabel, options, value, onChange, icon, className, menuClassName, button, check, menuLabel }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const active = value.length > 0;
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const tick = check || <Check />;
  return (
    <>
      {button ? button({ ref, open, toggle: () => setOpen((o) => !o), active, count: value.length }) : (
      <button
        ref={ref}
        type="button"
        className={cx('tbx-filter-btn', active && 'is-active', open && 'is-open', className)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={active ? tx('{{label}}：已选 {{n}} 项', { label, n: value.length }) : label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        <span className="tbx-filter-btn-text">
          <span aria-hidden={active}>{label}</span>
          <span aria-hidden={!active}>{value.length || ''}</span>
        </span>
      </button>
      )}
      <Popover anchor={ref} open={open} onClose={(event) => { if (event?.type === 'keydown') ref.current?.focus(); setOpen(false); }} align="end" role="menu" label={menuLabel || label} className={menuClassName || 'tbx-filter-menu'}>
        <button type="button" role="menuitemradio" aria-checked={!active} onClick={() => onChange([])}>
          {allLabel}{!active && tick}
        </button>
        <div className="tbx-popover-sep" />
        {options.map((o) => (
          <button key={o.id} type="button" role="menuitemcheckbox" aria-checked={value.includes(o.id)} onClick={() => toggle(o.id)}>
            {o.mark}{o.name}{value.includes(o.id) && tick}
          </button>
        ))}
      </Popover>
    </>
  );
}
