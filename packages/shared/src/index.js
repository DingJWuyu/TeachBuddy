/**
 * The shared package owns the neutral registration contract used by the
 * teacher modules: the single static module catalog (ADR 0001), its build-time
 * checks, and the runtime vocabulary of the frozen workbench contract that both
 * Web and API consume.
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

export function getModuleMetadata(moduleId) {
  const moduleItem = moduleCatalog.find((item) => item.id === moduleId);
  if (!moduleItem) {
    throw new Error(`Unknown teacher module: ${moduleId}`);
  }
  return moduleItem;
}
