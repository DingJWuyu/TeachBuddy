import { useEffect, useState } from 'react';
import { getSettings } from './api.js';

/** The shell observes schedule settings without owning their HTTP lifecycle. */
export function useScheduleSettings(path, generation) {
  const [timeZone, setTimeZone] = useState(null);
  const [timeZoneError, setTimeZoneError] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setTimeZoneError(null);
    getSettings().then(settings => {
      if (!cancelled) setTimeZone(settings.timeZone);
    }).catch(error => { if (!cancelled) setTimeZoneError(error.message); });
    return () => { cancelled = true; };
  }, [path, generation, reload]);
  return { timeZone, setTimeZone, timeZoneError, reloadTimeZone: () => setReload(value => value + 1) };
}
