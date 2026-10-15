import { useCallback, useEffect, useRef } from 'react';

/** Scroll snapshots are small; commit in the scroll event so an immediate reload
 * cannot outrun a timer. Wait for content before restoring a nonzero position. */
export function useScrollRestore(initialTop = 0, commit, contentKey = '') {
  const ref = useRef(null);
  const topRef = useRef(initialTop);
  const restoredRef = useRef(false);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    const node = ref.current;
    if (!node || restoredRef.current || initialTop <= 0) return;
    node.scrollTop = initialTop;
    if (node.scrollTop > 0) { restoredRef.current = true; topRef.current = node.scrollTop; }
  }, [contentKey, initialTop]);
  useEffect(() => {
    const flush = () => commitRef.current?.(topRef.current);
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); };
  }, []);
  const onScroll = useCallback(event => {
    topRef.current = event.currentTarget.scrollTop;
    commitRef.current?.(topRef.current);
  }, []);
  return { ref, onScroll };
}
