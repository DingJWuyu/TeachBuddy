/**
 * T51 fixture wiring for the isolated runner and the API test harness.
 *
 * The product catalog and implementation map are T53-owned and do not carry
 * classes yet, so this fixture composes the real B16 base plus the real classes
 * module with an explicit catalog override. Its `requires` lists only the
 * questions port because `lessons.readForTeachingLink` is not in the shared
 * `modulePorts` vocabulary until T53 adds it; the fixture module supplies that
 * provider from the same lessons service.
 */
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
