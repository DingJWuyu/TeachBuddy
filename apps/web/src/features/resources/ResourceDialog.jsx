import { useEffect, useRef } from "react";
import { useModuleDialogFocus } from "../workbench/ModuleMotion.jsx";

export function ResourceDialog({ label, onClose, children, className = "" }) {
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  useEffect(() => {
    ref.current
      ?.querySelector("input:not([type=file]), textarea, select")
      ?.focus();
  }, []);
  return (
    <div
      className="res-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`res-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
