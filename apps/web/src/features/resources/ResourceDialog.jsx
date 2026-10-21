import { createContext, useContext, useEffect, useRef } from "react";
import { ModulePresence, useModuleDialogFocus } from "../../components/interaction/ModuleMotion.jsx";

const ResourceDialogVisible = createContext(true);

export function ResourceDialogPresence({ present, children }) {
  const opening = useRef({ present: false, key: 0 });
  if (present && !opening.current.present) opening.current.key += 1;
  opening.current.present = Boolean(present);
  return (
    <ResourceDialogVisible.Provider value={Boolean(present)}>
      <ModulePresence key={opening.current.key} present={present}>{children}</ModulePresence>
    </ResourceDialogVisible.Provider>
  );
}

function ResourceDialogFocus({ dialogRef, onClose }) {
  useModuleDialogFocus(dialogRef, onClose);
  useEffect(() => {
    dialogRef.current
      ?.querySelector("input:not([type=file]), textarea, select")
      ?.focus();
  }, [dialogRef]);
  return null;
}

export function ResourceDialog({ label, onClose, children }) {
  const ref = useRef(null);
  const active = useContext(ResourceDialogVisible);
  return (
    <div
      className="res-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="res-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {active && <ResourceDialogFocus dialogRef={ref} onClose={onClose} />}
        {children}
      </div>
    </div>
  );
}
