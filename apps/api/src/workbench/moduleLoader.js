/**
 * Module composition from the compile-time implementation map (ADR 0001).
 *
 * `moduleImplementations` maps a catalog ID to the module's factory and
 * migration modules. Nothing is discovered from the filesystem at runtime and
 * no environment value can redirect the loader, so the API can only run code
 * that is mapped in source and checked by the build.
 *
 * Loading has three phases, in this fixed order:
 * 1. discover: load each mapped module (in catalog dependency order), validate
 *    the catalog mapping and dependencies, and collect its migrations.
 * 2. migrate: the composition applies pending migrations.
 * 3. instantiate: call the factories, which may prepare statements against the
 *    migrated schema, and wire required public ports.
 */
import {
  assertModuleCatalog,
  assertModuleDependencies,
  moduleCatalog,
  modulePorts,
  projectModuleCatalog
} from '@teachbuddy/shared';

function factoryNameFor(moduleId) {
  const pascal = moduleId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `create${pascal}Module`;
}

function loadOrderFor(catalog, enabledIds) {
  const enabled = new Set(enabledIds);
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(moduleId) {
    if (visited.has(moduleId) || !enabled.has(moduleId)) return;
    if (visiting.has(moduleId)) throw new Error(`Module dependency cycle at ${moduleId}`);
    visiting.add(moduleId);
    for (const requiredPort of byId.get(moduleId).requires) {
      const provider = modulePorts[requiredPort]?.provider;
      if (provider) visit(provider);
    }
    visiting.delete(moduleId);
    visited.add(moduleId);
    order.push(moduleId);
  }

  for (const entry of catalog) visit(entry.id);
  return order;
}

function assertImplementation(moduleId, implementation) {
  if (!implementation || typeof implementation.factory !== 'function') {
    throw new Error(`Module ${moduleId} implementation must provide a factory thunk (see moduleImplementations.js).`);
  }
  if (implementation.migrations !== undefined && typeof implementation.migrations !== 'function') {
    throw new Error(`Module ${moduleId} migrations must be a thunk returning {migrations}.`);
  }
}

export function createModuleLoader({
  catalog = moduleCatalog,
  implementations = {},
  dependencies = {},
  logger
} = {}) {
  assertModuleCatalog(catalog);
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const discovered = new Map();
  const implementationsById = new Map();
  const migrationsByModule = new Map();
  const maintenanceByModule = new Map();
  let orderedIds = [];
  let discoverOnce = null;
  let instantiateOnce = null;

  async function discover() {
    const enabledIds = catalog.map(entry => entry.id);
    for (const moduleId of enabledIds) assertImplementation(moduleId, implementations[moduleId]);
    const storedIds = dependencies.db.prepare('SELECT DISTINCT moduleId FROM workbench_migrations').all().map(row => row.moduleId);
    // Storage outlives availability. The same static map supplies its owner even
    // when its runtime is absent from this product composition.
    for (const [moduleId, implementation] of Object.entries(implementations)) {
      if (typeof implementation.maintenance !== 'function') throw new Error(`Module ${moduleId} must provide storage maintenance.`);
      const maintenance = await implementation.maintenance();
      for (const operation of ['hasStorage', 'snapshot', 'validateStorage', 'deleteAccountData'])
        if (typeof maintenance[operation] !== 'function') throw new Error(`Module ${moduleId} maintenance must provide ${operation}.`);
      const hasStorage = maintenance.hasStorage(dependencies.db);
      const recorded = storedIds.includes(moduleId);
      if (hasStorage !== recorded) throw new Error(`Module ${moduleId} storage and migration ledger disagree.`);
      if (!enabledIds.includes(moduleId) && !recorded) continue;
      maintenanceByModule.set(moduleId, maintenance);
      if (implementation.migrations) {
        const imported = await implementation.migrations();
        if (!Array.isArray(imported.migrations)) throw new Error(`Module ${moduleId} migrations must export a migrations array.`);
        migrationsByModule.set(moduleId, imported.migrations);
      }
    }
    orderedIds = loadOrderFor(catalog, enabledIds);

    for (const moduleId of orderedIds) {
      const implementation = implementations[moduleId];
      const imported = await implementation.factory();
      const factoryName = factoryNameFor(moduleId);
      const factory = imported[factoryName];
      if (typeof factory !== 'function') {
        throw new Error(`Module ${moduleId} must export ${factoryName}({db, mutations}).`);
      }
      discovered.set(moduleId, { moduleId, factory });
    }

    assertModuleDependencies(orderedIds, catalog);
    projectModuleCatalog(orderedIds, catalog);
    logger?.info(`modules discovered: ${orderedIds.join(', ') || 'none'}`);
    return orderedIds;
  }

  async function instantiate() {
    await (discoverOnce ??= discover());

    for (const moduleId of orderedIds) {
      const factoryDependencies = { ...dependencies };
      for (const requiredPort of catalogById.get(moduleId).requires) {
        const provider = modulePorts[requiredPort]?.provider;
        if (!provider) throw new Error(`Module ${moduleId} requires unknown port ${requiredPort}.`);
        const providerImplementation = implementationsById.get(provider);
        if (!providerImplementation) {
          throw new Error(`Module ${moduleId} requires ${requiredPort} but ${provider} is not enabled.`);
        }
        factoryDependencies[provider] = providerImplementation.port;
      }

      const implementation = discovered.get(moduleId).factory(factoryDependencies);
      if (!implementation || typeof implementation.router !== 'function') {
        throw new Error(`Module ${moduleId} factory must return {router, port}.`);
      }
      implementationsById.set(moduleId, {
        moduleId,
        router: implementation.router,
        port: implementation.port ?? null,
        operations: implementation.operations ?? {},
        jobHandlers: implementation.jobHandlers ?? {}
      });
    }

    logger?.info(`modules enabled: ${enabledIds().join(', ') || 'none'}`);
    return implementationsById;
  }

  function enabledIds() {
    return [...orderedIds];
  }

  return {
    discover() {
      discoverOnce ??= discover();
      return discoverOnce;
    },

    instantiate() {
      instantiateOnce ??= instantiate();
      return instantiateOnce;
    },

    get(moduleId) {
      return implementationsById.get(moduleId) ?? null;
    },

    enabledIds,

    maintenance() { return [...maintenanceByModule.values()]; },
    moduleMigrations() {
      return [...migrationsByModule].map(([moduleId, migrations]) => ({ moduleId, migrations }));
    }
  };
}
