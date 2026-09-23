import { useLayoutEffect, useRef, useState } from 'react';
import './presence.css';

/** Keep an outgoing surface alive until its reversible browser animation ends. */
export function Presence({ show, children, duration = 180 }) {
  const [present, setPresent] = useState(Boolean(show));
  const host = useRef(null);
  const lastChildren = useRef(children);
  const animations = useRef([]);
  const revision = useRef(0);
  if (show) lastChildren.current = children;

  useLayoutEffect(() => {
    if (show && !present) { setPresent(true); return; }
    const element = host.current?.firstElementChild;
    if (!element) return;
    const current = ++revision.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      || element.closest('[data-motion="reduce"]');
    element.inert = !show;
    element.dataset.presence = show ? 'entered' : 'exiting';
    if (reduced) {
      animations.current.forEach(animation => animation.cancel());
      animations.current = [];
      if (!show) setPresent(false);
      return;
    }
    if (!animations.current.length) {
      const isLayer = /layer|dialog-host|backdrop|scrim/.test(element.className);
      const targets = isLayer
        ? [element, ...element.querySelectorAll('[role="dialog"], .tb-search-panel')]
        : [element];
      animations.current = targets.map(target => target.animate(
        target === element && isLayer
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, scale: '.96', translate: '0 4px' }, { opacity: 1, scale: '1', translate: '0 0' }],
        { duration, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }
      ));
    }
    for (const animation of animations.current) {
      animation.playbackRate = show ? 1 : -1;
      animation.play();
    }
    Promise.all(animations.current.map(animation => animation.finished.catch(() => {}))).then(() => {
      if (current !== revision.current) return;
      if (!show) {
        animations.current.forEach(animation => animation.cancel());
        animations.current = [];
        setPresent(false);
      }
    });
  }, [show, present, duration]);

  useLayoutEffect(() => () => {
    revision.current += 1;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
  }, []);

  return present || show ? <div className="tb-presence" ref={host}>{show ? children : lastChildren.current}</div> : null;
}
