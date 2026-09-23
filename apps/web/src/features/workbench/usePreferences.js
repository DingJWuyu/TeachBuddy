import { useEffect, useRef } from 'react';
import { workbenchGet, workbenchPut } from './apiClient.js';
import { useSavableDocument } from './useSavableDocument.js';
const path = '/api/reliability/v1/preferences';
const object = value => ({ ...value, id: 'preferences' });
export function usePreferences(accountKey, generation) {
  const preferences = useSavableDocument({ accountKey, generation, kind: 'preferences', draftId: 'account',
    load: async () => object((await workbenchGet(path)).body),
    update: async ({ key, payload }) => object((await workbenchPut(path, payload, key)).body),
    inputFromObject: value => value.values,
    buildUpdate: (values, baseline) => ({ baseVersion: baseline.version, values })
  });
  const current = useRef(preferences);
  current.current = preferences;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') current.current.refreshServer();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return preferences;
}
