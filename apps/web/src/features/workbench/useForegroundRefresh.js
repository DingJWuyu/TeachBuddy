import { useEffect, useRef } from 'react';

/** Re-read when the teacher returns to this page. Each caller decides whether
 * fresh content may replace the view or must remain a comparison candidate. */
export function useForegroundRefresh(refresh) {
  const current = useRef(refresh);
  current.current = refresh;
  useEffect(() => {
    let running = false;
    const onReturn = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try { await current.current(); } catch { /* Keep the existing view on a failed background read. */ }
      finally { running = false; }
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, []);
}
