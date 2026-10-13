import { moduleCatalog } from '@refatos/shared';
export { navigate } from '../routes.js';
export { followAnchor as routeClick } from '../routes.js';
export const HOME_PATH = '/';
export const withSearch = path => path;
export const modulePath = id => moduleCatalog.find(module => module.webEnabled && module.id === id)?.path || HOME_PATH;
