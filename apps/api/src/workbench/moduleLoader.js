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
} from '@refatos/shared';

export function factoryNameFor(moduleId) {
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
  let orderedIds = [];
  let discoverOnce = null;
  let instantiateOnce = null;

  async function discover() {
    const enabledIds = Object.keys(implementations);
    for (const moduleId of enabledIds) {
      if (!catalogById.has(moduleId)) {
        throw new Error(`Module implementation ${moduleId} has no catalog mapping.`);
      }
      assertImplementation(moduleId, implementations[moduleId]);
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

      if (implementation.migrations) {
        const migrationsModule = await implementation.migrations();
        if (!Array.isArray(migrationsModule.migrations)) {
          throw new Error(`Module ${moduleId} migrations must export a migrations array.`);
        }
        migrationsByModule.set(moduleId, migrationsModule.migrations);
      }
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

    moduleMigrations() {
      return enabledIds()
        .filter((moduleId) => migrationsByModule.has(moduleId))
        .map((moduleId) => ({ moduleId, migrations: migrationsByModule.get(moduleId) }));
    }
  };
}
