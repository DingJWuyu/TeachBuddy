import { createAgent, migrations as agentMigrations } from '../agent/index.js';
/**
 * Workbench composition root.
 *
 * Creates one isolated database, the identity seam, the idempotent-mutation
 * and migration facilities, discovers the enabled module implementations, and
 * returns the two HTTP routers the app mounts before the legacy bearer gate.
 * `initialize()` must run before the first request: it loads module
 * implementations and applies pending migrations, and a failure there stops
 * startup instead of serving a half-prepared database.
 */
import { moduleCatalog } from '@refatos/shared';
import { moduleImplementations } from './moduleImplementations.js';
import { openWorkbenchDatabase } from './storage.js';
import { createIdentity, assertWorkbenchRuntimeConfig } from './identity.js';
import { createMutations } from './mutations.js';
import { createMigrationRunner } from './migrations.js';
import { createWorkbenchLogger } from './logger.js';
import { createModuleLoader } from './moduleLoader.js';
import { createModuleCatalogHandler, createWorkbenchRouters } from './http.js';

export function createWorkbench({ env, identity: identityOverride, logger: loggerOverride, clock } = {}) {
  if (!env) throw new Error('createWorkbench requires the resolved environment.');

  const workbenchEnv = env.workbench ?? {};
  assertWorkbenchRuntimeConfig({ nodeEnv: env.nodeEnv, workbench: workbenchEnv });

  const db = openWorkbenchDatabase({ sqlitePath: env.sqlitePath });
  const logger = loggerOverride ?? createWorkbenchLogger({ logDir: workbenchEnv.logDir, clock });
  const identity = identityOverride ?? createIdentity({
    mode: workbenchEnv.mode,
    testPrincipals: workbenchEnv.testPrincipals,
    sessionSecret: workbenchEnv.sessionSecret,
    resolvePrincipal: workbenchEnv.resolvePrincipal ?? undefined
  });
  const catalog = workbenchEnv.catalogOverride ?? moduleCatalog;
  const mutations = createMutations({ db, clock });
  const migrations = createMigrationRunner({ db, clock });
  const operations = {};
  let agent;
  const implementations = { ...moduleImplementations, ...(workbenchEnv.extraImplementations ?? {}) };
  for (const id of ['questions', 'lessons']) {
    const original = implementations[id];
    if (!original) continue;
    implementations[id] = { ...original, factory: async () => {
      const imported = await original.factory();
      const name = id === 'questions' ? 'createQuestionsModule' : 'createLessonsModule';
      return { ...imported, [name]: deps => {
        const module = imported[name](deps); Object.assign(operations, module.operations); return module;
      } };
    } };
  }
  const loader = createModuleLoader({
    catalog,
    implementations,
    dependencies: { db, mutations },
    logger
  });

  const { contextRouter, modulesRouter } = createWorkbenchRouters({
    identity,
    trustedOrigins: workbenchEnv.trustedOrigins ?? [],
    loader,
    catalog,
    logger,
    ready: () => initialize()
  });

  // The exact `GET /api/modules` catalog endpoint. B12 delivered the handler
  // without claiming the path (the legacy shell owned it); B15 mounts it at the
  // contract path and removes the legacy bearer route.
  const catalogHandler = createModuleCatalogHandler({
    identity,
    loader,
    catalog,
    logger,
    ready: () => initialize()
  });

  let initialization = null;

  function initialize() {
    initialization ??= (async () => {
      await loader.discover();
      const migrationResult = migrations.run(loader.moduleMigrations(), {
        knownModuleIds: catalog.map((entry) => entry.id)
      });
      logger.info(
        `migrations applied ${migrationResult.applied.length}, skipped ${migrationResult.skipped.length}`
      );
      await loader.instantiate();
      migrations.run([{ moduleId: 'agent', migrations: agentMigrations }], { knownModuleIds: ['agent'] });
      agent = createAgent({ db, mutations, identity, trustedOrigins: workbenchEnv.trustedOrigins ?? [], operations, config: env.agent });
      return migrationResult;
    })();
    return initialization;
  }

  return {
    db,
    get agent() { return agent; },
    identity,
    logger,
    catalog,
    mutations,
    migrations,
    loader,
    contextRouter,
    modulesRouter,
    catalogHandler,
    initialize,

    close() {
      agent?.close();
      db.close();
    }
  };
}
