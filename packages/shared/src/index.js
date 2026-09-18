/**
 * The shared package defines the neutral registration contract used by future
 * teacher modules. The current product deliberately ships with no modules.
 */
export const moduleCatalog = Object.freeze([]);

// Kept as an empty alias for consumers that use the catalog as a seed list.
export const starterModules = moduleCatalog;

export function getModuleMetadata(moduleId) {
  const moduleItem = moduleCatalog.find((item) => item.id === moduleId);
  if (!moduleItem) {
    throw new Error(`Unknown teacher module: ${moduleId}`);
  }
  return moduleItem;
}

/**
 * Build a module manifest without prescribing how a module contributes to the
 * home page. A module may describe its identity, sidebar entry, own panel and
 * backend capabilities through its own neutral fields.
 */
export function buildManifest(moduleConfig = {}) {
  if (!moduleConfig || typeof moduleConfig !== 'object' || Array.isArray(moduleConfig)) {
    throw new TypeError('Module configuration must be an object.');
  }
  if (typeof moduleConfig.id !== 'string' || !moduleConfig.id.trim()) {
    throw new TypeError('A module ID is required.');
  }

  return {
    version: '0.3.0',
    enabled: true,
    capabilities: [],
    ...moduleConfig,
    id: moduleConfig.id.trim()
  };
}
