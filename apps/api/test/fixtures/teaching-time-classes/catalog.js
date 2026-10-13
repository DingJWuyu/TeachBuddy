// Explicit catalog override for the classes fixed-clock fixture.
export const classesCatalogEntry = Object.freeze({
  id: 'classes',
  name: '班级',
  path: '/classes',
  navigation: 'sidebar',
  auxiliaryPanel: true,
  requires: Object.freeze(['questions.readForReferenceV2'])
});

export const classesImplementation = Object.freeze({
  factory: () => import('./modules/classes/index.js'),
  migrations: () => import('../../../src/modules/classes/migrations/index.js')
});
