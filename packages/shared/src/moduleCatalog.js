/**
 * Authoritative static module catalog for the workbench (ADR 0001).
 *
 * This is pure data: Web and API each project it into their own local code
 * mapping. Entries are enabled at runtime only after the matching module
 * implementation is imported, so a catalog entry never stands in for a module
 * that does not exist yet. The exact format and material entries are
 * fixed by docs/contracts/workbench/materials.openapi.yaml (ModuleCatalog and
 * the same-named example); do not add fields or entries without a new frozen
 * contract revision.
 */

export const moduleCatalogVersion = 2;

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
    id: 'resources', name: '资源库', path: '/resources',
    navigation: 'sidebar', auxiliaryPanel: true, requires: Object.freeze([])
  }),
  Object.freeze({
    id: 'lessons',
    name: '备课',
    path: '/lessons',
    navigation: 'sidebar',
    auxiliaryPanel: true,
    requires: Object.freeze(['questions.readForReferenceV2', 'resources.readForReferenceV2'])
  })
]);

/**
 * Public ports a module may depend on. The catalog's `requires` enum is closed:
 * a dependency names exactly one port, and the port names the module that
 * provides it. `lessons` requires the questions reference-read port.
 */
export const modulePorts = Object.freeze({
  'questions.readForReferenceV2': Object.freeze({ provider: 'questions', port: 'readForReferenceV2' }),
  'resources.readForReferenceV2': Object.freeze({ provider: 'resources', port: 'readForReferenceV2' }),
  'questions.readForReference': Object.freeze({ provider: 'questions', port: 'readForReference' })
});

export const moduleCatalogIdPattern = /^[a-z][a-z0-9-]*$/;
export const moduleCatalogPathPattern = /^\/[a-z][a-z0-9-]*$/;
export const moduleCatalogNavigationValues = Object.freeze(['sidebar', 'top']);

/**
 * Isolated M41 composition authorized by math-foundation-dependency.md.
 * The default first-flow catalog stays unchanged until M43 integrates v3.
 * This descriptor maps the real native module, not a replacement renderer.
 */
export const mathSupportCatalog = Object.freeze([
  ...moduleCatalog,
  Object.freeze({
    id: 'math',
    name: '数学工坊',
    path: '/math',
    navigation: 'sidebar',
    auxiliaryPanel: true,
    requires: Object.freeze([])
  })
]);
