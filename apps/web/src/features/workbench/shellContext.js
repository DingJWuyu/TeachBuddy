/** Shared shell context: identity, panel, tools and scene access. */

import { createContext, useContext, useEffect, useRef } from 'react';

export const ShellContext = createContext(null);

export function useWorkbenchShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useWorkbenchShell must be used inside the workbench shell');
  return value;
}

/**
 * Register auxiliary panel tools for the current page.
 *
 * `defs` is `[{ id, label, render }]`. The render closures are read through a
 * ref so tool content stays fresh without re-registering on every render.
 */
export function useAuxiliaryTools(defs) {
  const shell = useWorkbenchShell();
  const defsRef = useRef(defs);
  defsRef.current = defs;
  const signature = defs.map((def) => `${def.id}:${def.label}`).join('|');
  const register = shell.registerTools;

  useEffect(() => {
    register(defsRef.current.map((def, index) => ({
      id: def.id,
      label: def.label,
      render: () => defsRef.current[index]?.render()
    })));
    return () => register([]);
  }, [register, signature]);
}
