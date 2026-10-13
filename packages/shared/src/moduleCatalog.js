/** Static catalog using registration contract v4, projected into real implementations. */
export const moduleCatalogVersion = 4;
export const moduleCatalog = Object.freeze([
  {
    "id": "questions",
    "name": "题库",
    "path": "/questions",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "webEnabled": true,
    "requires": []
  },
  {
    "id": "math",
    "name": "数学工坊",
    "path": "/math",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "webEnabled": true,
    "requires": []
  },
  {
    "id": "resources",
    "name": "资源库",
    "path": "/resources",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "webEnabled": true,
    "requires": []
  },
  {
    "id": "schedule",
    "name": "日程",
    "path": "/calendar",
    "navigation": "top",
    "auxiliaryPanel": true,
    "webEnabled": true,
    "requires": []
  },
  {
    "id": "classroom",
    "name": "班级",
    "path": "/classroom",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "webEnabled": false,
    "requires": []
  }
].map(entry => Object.freeze({...entry, requires: Object.freeze(entry.requires)})));
export const modulePorts = Object.freeze({});
export const moduleCatalogIdPattern = /^[a-z][a-z0-9-]*$/;
export const moduleCatalogPathPattern = /^\/[a-z][a-z0-9-]*$/;
export const moduleCatalogNavigationValues = Object.freeze(['sidebar', 'top']);
