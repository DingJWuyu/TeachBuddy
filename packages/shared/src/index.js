/**
 * The shared package owns the neutral registration contract used by the
 * teacher modules: the single static module catalog (ADR 0001), its build-time
 * checks, and the runtime vocabulary of the frozen workbench contract that both
 * Web and API consume. Explicit math subpaths also own shared pure computation,
 * serialized source validation, and browser/offline presentation. SQLite,
 * accounts, HTTP, managed files, and Node rendering workers belong to the API.
 * Math dependencies stay outside this root barrel.
 */
export {
  moduleCatalog,
  moduleCatalogVersion,
  moduleCatalogIdPattern,
  moduleCatalogPathPattern,
  moduleCatalogNavigationValues,
  modulePorts
} from './moduleCatalog.js';

export {
  validateModuleCatalog,
  assertModuleCatalog,
  projectModuleCatalog,
  assertModuleDependencies
} from './moduleCatalogValidation.js';

export {
  workbenchPaths,
  workbenchHeaders,
  workbenchMediaTypes,
  workbenchLimits,
  workbenchCacheControl,
  workbenchProblemTypes,
  workbenchProblemStatus,
  workbenchInvalidInputReasons
} from './contract.js';

export { canRenderMath, supportedDocument, questionDocuments } from './materials/content.js';

export { defaultNavigation, validNavigation, includeNewNavigationModules, navigationLayoutSchema } from './navigation.js';
