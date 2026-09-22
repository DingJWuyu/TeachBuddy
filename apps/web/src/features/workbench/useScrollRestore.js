/**
 * Region scroll that survives navigation and refresh.
 *
 * The value is committed on a short throttle and once more when the region
 * unmounts, so leaving a page never loses the position.
 */

import { useCallback, useEffect, useRef } from 'react';

export function useScrollRestore(initialTop = 0, commit, contentKey = '') {
  const ref = useRef(null);
  const topRef = useRef(initialTop);
  const timerRef = useRef(null);
  const restoredRef = useRef(false);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    const node = ref.current;
    if (!node || restoredRef.current || initialTop <= 0) return;
    node.scrollTop = initialTop;
    if (node.scrollTop > 0) restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, initialTop]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    commitRef.current?.(topRef.current);
  }, []);


  const onScroll = useCallback((event) => {
    topRef.current = event.currentTarget.scrollTop;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => commitRef.current?.(topRef.current), 120);
  }, []);

  return { ref, onScroll };
}
