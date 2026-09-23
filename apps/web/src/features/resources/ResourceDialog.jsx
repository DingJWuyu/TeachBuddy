import { useRef } from 'react';
import { useModuleDialogFocus } from '../workbench/ModuleMotion.jsx';

export function ResourceDialog({ label, onClose, children }) {
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  return <div className="res-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className="res-dialog" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
  </div>;
}
