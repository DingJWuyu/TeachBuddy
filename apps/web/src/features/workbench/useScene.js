/**
 * Per-account view scene: search, filters, selection, scroll, panel state and
 * other "现场" values survive module switches and refresh, and never leak
 * between accounts.
 *
 * Writes are synchronous: a refresh right after a change (opening the panel,
 * typing in the AI box) must not lose it, and the records are tiny. There is no
 * debounce left to flush on unload.
 */

import { useCallback, useRef, useState } from 'react';
import { readLocal, writeLocal } from './storage.js';

export function useScene(accountKey, scope, initial = {}) {
  const [scene, setScene] = useState(() => ({
    ...initial,
    ...(readLocal(accountKey, `scene:${scope}`) || {})
  }));
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const accountRef = useRef(accountKey);
  accountRef.current = accountKey;

  const patchScene = useCallback((patch) => {
    const current = sceneRef.current;
    const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
    sceneRef.current = next;
    writeLocal(accountRef.current, `scene:${scope}`, next);
    setScene(next);
  }, [scope]);

  return [scene, patchScene];
}
