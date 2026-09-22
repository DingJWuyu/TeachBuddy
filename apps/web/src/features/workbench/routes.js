/**
 * Minimal history router for the workbench shell.
 *
 * Module paths come from the static catalog, so the parser is a closed list of
 * the paths this batch actually registers; unknown paths are reported as such
 * instead of silently rendering a module.
 */

import { useEffect, useState } from 'react';

const NAVIGATION_EVENT = 'tb:navigate';

function parseRoute(pathname) {
  const path = pathname || '/';
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return { name: 'home', path: '/' };
  if (segments.length === 1) {
    if (segments[0] === 'questions') return { name: 'questions', path: '/questions' };
    if (segments[0] === 'lessons') return { name: 'lessons', path: '/lessons' };
    if (segments[0] === 'settings') return { name: 'settings', path: '/settings' };
  }
  if (segments.length === 2) {
    const id = decodeURIComponent(segments[1]);
    if (segments[0] === 'questions') return { name: 'question', id, path: `/questions/${segments[1]}` };
    if (segments[0] === 'lessons') return { name: 'lesson', id, path: `/lessons/${segments[1]}` };
  }
  return { name: 'unknown', path };
}

function currentRoute() {
  if (typeof window === 'undefined') return { name: 'home', path: '/' };
  return parseRoute(window.location.pathname);
}

export function useRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    function sync() {
      setRoute(currentRoute());
    }
    window.addEventListener('popstate', sync);
    window.addEventListener(NAVIGATION_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAVIGATION_EVENT, sync);
    };
  }, []);

  return route;
}

export function navigate(path, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path && !replace) return;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

/**
 * Real anchor behaviour: a plain left click is routed, every other activation
 * (middle click, new tab, copy link, back/forward) stays with the browser.
 */
export function followAnchor(event, path, { onNavigate } = {}) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
    || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(path);
  if (onNavigate) onNavigate();
}
