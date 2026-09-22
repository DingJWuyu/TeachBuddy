/**
 * API projection of the static module catalog (ADR 0001).
 *
 * This is the compile-time mapping from catalog entry to runtime module: a
 * module is enabled exactly when it has an entry here, and each entry names the
 * factory and migration modules explicitly. There is no runtime directory
 * discovery and no environment knob that can point the API at arbitrary code,
 * so the map, the catalog and the module directories can only drift in ways the
 * build check (`packages/shared/scripts/verify-catalog.mjs`) rejects.
 *
 * The catalog entry stays in `@refatos/shared`; this file only projects it.
 * `lessons` declares `questions.readForReference`, so the loader instantiates
 * questions first and injects its public port.
 */
export const moduleImplementations = Object.freeze({
  questions: Object.freeze({
    factory: () => import('../modules/questions/index.js'),
    migrations: () => import('../modules/questions/migrations/index.js')
  }),
  lessons: Object.freeze({
    factory: () => import('../modules/lessons/index.js'),
    migrations: () => import('../modules/lessons/migrations/index.js')
  })
});
