/**
 * Minimal history router for the workbench shell.
 *
 * Module paths come from the static catalog, so the parser is a closed list of
 * the paths this batch actually registers; unknown paths are reported as such
 * instead of silently rendering a module.
 */

import { useEffect, useState } from 'react';
import { moduleCatalog } from '@refatos/shared';

const NAVIGATION_EVENT = 'tb:navigate';

function parseRoute(pathname) {
  const path = pathname || '/';
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return { name: 'home', path: '/' };
  const descriptor = moduleCatalog.find(module => module.path === `/${segments[0]}`);
  if (descriptor) {
    const modulePath = ['questions', 'resources'].includes(descriptor.id)
      ? descriptor.path + (segments[1] ? `/${segments[1]}` : '') : path;
    const base = { moduleId: descriptor.id, path: modulePath };
    if (segments.length === 1) {
      if (descriptor.id === 'math') return { ...base, name: 'math', workId: new URLSearchParams(window.location.search).get('workId') };
      if (descriptor.id === 'schedule') return { ...base, name: 'schedule', search: window.location.search };
      return { ...base, name: descriptor.id };
    }
    // Subroutes retain the module's existing route shape. Malformed URL IDs
    // belong to the unknown-route page rather than crashing the whole shell.
    try {
      if (segments.length === 2) {
        const id = decodeURIComponent(segments[1]);
        if (descriptor.id === 'resources') return { ...base, name: 'resource', id };
        if (descriptor.id === 'questions') return { ...base, name: 'question', id };
      }
    } catch (error) {
      if (!(error instanceof URIError)) throw error;
    }
  }
  if (segments.length === 1 && ['help', 'releases', 'settings'].includes(segments[0])) return { name: segments[0], path: segments[0] === 'settings' ? '/settings' : path };
  if (segments[0] === 'help' && (segments.length === 2 || segments.length === 3)) {
    return { name: 'help', path, topicId: segments[1], articleId: segments[2] };
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

export function navigate(path, { replace = false, fromPath } = {}) {
  if (typeof window === 'undefined') return;
  if ((window.location.pathname + window.location.search) === path && !replace) return;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState({ fromPath: fromPath ?? window.location.pathname + window.location.search }, '', path);
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
