/*
 * Route table for the workbench shell prototype.
 *
 * The shell navigates for real: the brand, the top-bar nav, every sidebar module
 * row, the support menu and the search results all resolve to a path. Only the
 * home page has a designed body, so every other destination renders the shared
 * empty page rather than dead-ending or falling back to the sign-in screen.
 *
 * Navigation is client-side. Every anchor keeps a real href, but a plain press is
 * routed through the history API so the top bar and the sidebar stay mounted and
 * only the page body changes.
 *
 * PROTOTYPE: navigation and page bodies are real, no route owns data of its own.
 */
import { useEffect, useState } from 'react';

export const HOME_PATH = '/';
export const CALENDAR_PATH = '/calendar';

/** Keeps existing query options consistent between links and client-side navigation. */
export function withSearch(path) {
  return `${path}${path.includes('?') ? '' : window.location.search}`;
}

/*
 * The nine module destinations are the same ids the sidebar layout model uses,
 * so a row's route is derived from its module id rather than stored twice.
 */
export function modulePath(moduleId) {
  return `/modules/${moduleId}`;
}

export const SHELL_PAGES = {
  [HOME_PATH]: { title: '首页', icon: 'home' },
  [CALENDAR_PATH]: { title: '日历', icon: 'calendar' },
  '/settings': { title: '设置', icon: 'settings' },
  '/help': { title: '帮助', icon: 'circleHelp' },
  '/changelog': { title: '更新日志', icon: 'newspaper' }
};

const MODULE_PAGE_COPY = {
  classes: { title: '我的班级', icon: 'classes' },
  timetable: { title: '课程表', icon: 'calendar' },
  planner: { title: '规划器', icon: 'planner' },
  lessons: { title: '课程', icon: 'lessons' },
  students: { title: '学生', icon: 'students' },
  classwork: { title: '课堂作业', icon: 'classwork' },
  grades: { title: '成绩', icon: 'grades' },
  attendance: { title: '出勤', icon: 'attendance' },
  standards: { title: '课程标准', icon: 'standards' }
};

/**
 * Describes any path the shell can show. Unknown paths resolve to a page that
 * says so, which keeps a stale link from rendering a blank shell.
 */
export function describePath(pathname) {
  if (SHELL_PAGES[pathname]) {
    return { kind: 'shell', path: pathname, ...SHELL_PAGES[pathname] };
  }
  const moduleMatch = pathname.match(/^\/modules\/([^/]+)$/);
  if (moduleMatch && MODULE_PAGE_COPY[moduleMatch[1]]) {
    const copy = MODULE_PAGE_COPY[moduleMatch[1]];
    return {
      kind: 'module',
      path: pathname,
      moduleId: moduleMatch[1],
      title: copy.title,
      icon: copy.icon
    };
  }
  return { kind: 'unknown', path: pathname, title: '页面不存在', icon: 'inbox' };
}

function currentLocation() {
  return { pathname: window.location.pathname, search: window.location.search, key: window.history.state?.key ?? null };
}

/*
 * Every navigation carries a key, which is what lets the shell tell one visit to
 * a page from another. Pushing the same path twice with pushState would not
 * change the location object at all, so the body would never re-render.
 */
function nextKey() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Reads the address bar and re-reads it after any history navigation, so the
 * browser's own back and forward buttons move the shell instead of leaving it
 * showing the previous page's body.
 */
export function useRoute() {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    function sync() {
      setLocation(currentLocation());
    }
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return location;
}

/**
 * Programmatic navigation. It keeps the query string, so the prototype flag
 * survives a move between pages.
 */
export function navigate(to) {
  const target = to.startsWith('/') ? to : `/${to}`;
  const { pathname, search } = window.location;
  const destination = withSearch(target);
  if (`${pathname}${search}` === destination) return;
  window.history.pushState({ key: nextKey() }, '', destination);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Routes an anchor press through the history API instead of letting the browser
 * load a new document.
 *
 * A real load throws away the whole shell, so the top bar and the sidebar blink
 * white and are rebuilt, the page body arrives with a flash, and anything the
 * session held in memory goes with it. Intercepting the press keeps the shell
 * mounted and swaps only the body. The href stays on the element, so middle
 * click, ctrl-click and copy-link still open a real address.
 */
export function routeClick(event, to) {
  if (event.defaultPrevented) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(to);
}
