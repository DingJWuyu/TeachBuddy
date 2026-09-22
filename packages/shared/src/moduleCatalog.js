/** Frozen M40 v3 catalog, projected only into real implementations. */
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
    "id": "lessons",
    "name": "备课",
    "path": "/lessons",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "requires": [
      "questions.readForReferenceV2",
      "resources.readForReferenceV2",
      "math.readForReferenceV1"
    ]
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
    "id": "classes",
    "name": "班级教学",
    "path": "/classes",
    "navigation": "sidebar",
    "auxiliaryPanel": true,
    "requires": [
      "questions.readForReferenceV2",
      "lessons.readForTeachingLink",
      "math.readForTeachingLinkV1"
    ]
  },
  {
    "id": "schedule",
    "name": "日程",
    "path": "/calendar",
    "navigation": "top",
    "auxiliaryPanel": true,
    "requires": [
      "classes.readClass",
      "classes.readRecord",
      "lessons.readForTeachingLink"
    ]
  }
].map(entry => Object.freeze({...entry, requires: Object.freeze(entry.requires)})));
export const modulePorts = Object.freeze({
  "questions.readForReferenceV2": {
    "provider": "questions",
    "port": "readForReferenceV2"
  },
  "resources.readForReferenceV2": {
    "provider": "resources",
    "port": "readForReferenceV2"
  },
  "math.readForReferenceV1": {
    "provider": "math",
    "port": "readForReferenceV1"
  },
  "questions.readForReference": {
    "provider": "questions",
    "port": "readForReference"
  },
  "lessons.readForTeachingLink": {
    "provider": "lessons",
    "port": "readForTeachingLink"
  },
  "math.readForTeachingLinkV1": {
    "provider": "math",
    "port": "readForTeachingLinkV1"
  },
  "classes.readClass": {
    "provider": "classes",
    "port": "readClass"
  },
  "classes.readRecord": {
    "provider": "classes",
    "port": "readRecord"
  }
});
export const moduleCatalogIdPattern = /^[a-z][a-z0-9-]*$/;
export const moduleCatalogPathPattern = /^\/[a-z][a-z0-9-]*$/;
export const moduleCatalogNavigationValues = Object.freeze(['sidebar', 'top']);
export const mathSupportCatalog = moduleCatalog;
