/** Keyboard shortcut shared by the editors: Ctrl/Cmd+S saves instead of the browser. */

import { useEffect } from 'react';

export function useSaveShortcut(onSave, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, onSave]);
}
