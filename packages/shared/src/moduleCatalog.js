/**
 * Authoritative static module catalog for the workbench (ADR 0001).
 *
 * This is pure data: Web and API each project it into their own local code
 * mapping. Entries are enabled at runtime only after the matching module
 * implementation is imported, so a catalog entry never stands in for a module
 * that does not exist yet. The exact format and this batch's two entries are
 * fixed by docs/contracts/workbench/first-flow.openapi.yaml (ModuleCatalog and
 * the same-named example); do not add fields or entries without a new frozen
 * contract revision.
 */

export const moduleCatalogVersion = 1;

export const moduleCatalog = Object.freeze([
  Object.freeze({
    id: 'questions',
    name: '题库',
    path: '/questions',
    navigation: 'sidebar',
    auxiliaryPanel: true,
    requires: Object.freeze([])
  }),
  Object.freeze({
    id: 'lessons',
    name: '备课',
    path: '/lessons',
    navigation: 'sidebar',
    auxiliaryPanel: true,
    requires: Object.freeze(['questions.readForReference'])
  })
]);

/**
 * Public ports a module may depend on. The catalog's `requires` enum is closed:
 * a dependency names exactly one port, and the port names the module that
 * provides it. `lessons` requires the questions reference-read port.
 */
export const modulePorts = Object.freeze({
  'questions.readForReference': Object.freeze({ provider: 'questions', port: 'readForReference' })
});

export const moduleCatalogIdPattern = /^[a-z][a-z0-9-]*$/;
export const moduleCatalogPathPattern = /^\/[a-z][a-z0-9-]*$/;
export const moduleCatalogNavigationValues = Object.freeze(['sidebar', 'top']);
