/** Static catalog using registration contract v3, projected into real implementations. */
export const moduleCatalogVersion = 3;
export const moduleCatalog = Object.freeze([
  {
    "id": "questions",
    "name": "题库",
    "path": "/questions",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "requires": []
  },
  {
    "id": "math",
    "name": "数学工坊",
    "path": "/math",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "requires": []
  },
  {
    "id": "resources",
    "name": "资源库",
    "path": "/resources",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "requires": []
  },
  {
    "id": "schedule",
    "name": "日程",
    "path": "/calendar",
    "navigation": "top",
    "auxiliaryPanel": true,
    "requires": []
  }
].map(entry => Object.freeze({...entry, requires: Object.freeze(entry.requires)})));
export const modulePorts = Object.freeze({});
export const moduleCatalogIdPattern = /^[a-z][a-z0-9-]*$/;
export const moduleCatalogPathPattern = /^\/[a-z][a-z0-9-]*$/;
export const moduleCatalogNavigationValues = Object.freeze(['sidebar', 'top']);
