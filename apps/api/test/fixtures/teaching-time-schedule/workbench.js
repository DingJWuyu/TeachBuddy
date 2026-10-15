// Isolated schedule composition with real storage.
import { openWorkbenchDatabase } from '../../../src/workbench/storage.js';
import { assertWorkbenchRuntimeConfig, createIdentity } from '../../../src/workbench/identity.js';
import { createMutations } from '../../../src/workbench/mutations.js';
import { createMigrationRunner } from '../../../src/workbench/migrations.js';
import { createWorkbenchLogger } from '../../../src/workbench/logger.js';
import { createModuleCatalogHandler, createWorkbenchRouters } from '../../../src/workbench/http.js';
import { createScheduleModule, migrations as scheduleMigrations } from '../../../src/modules/schedule/index.js';
import { fixtureBeforeChange, fixtureClock } from './runtime.js';
import { createPreferencesRouter, preferenceMigrations } from '../../../src/workbench/preferences.js';

/** Fixture-only descriptors; the real v2 catalog (with requires) is T53's. */
export const fixtureCatalog = Object.freeze([
  Object.freeze({
    id: 'schedule',
    name: '日程',
    path: '/calendar',
    navigation: 'top',
    auxiliaryPanel: true,
    webEnabled: true,
    requires: Object.freeze([])
  })
]);

export function createTeachingTimeWorkbench({
  env,
  logger: loggerOverride,
  clock = fixtureClock,
  knownModuleIds = null
} = {}) {
  if (!env) throw new Error('createTeachingTimeWorkbench requires the resolved environment.');

  const workbenchEnv = env.workbench ?? {};
  assertWorkbenchRuntimeConfig({ nodeEnv: env.nodeEnv, workbench: workbenchEnv });

  const db = openWorkbenchDatabase({ sqlitePath: env.sqlitePath });
  const logger = loggerOverride ?? createWorkbenchLogger({ logDir: workbenchEnv.logDir, consoleOutput: false });
  const identity = createIdentity({
    mode: workbenchEnv.mode,
    testPrincipals: workbenchEnv.testPrincipals,
    sessionSecret: workbenchEnv.sessionSecret
  });
  const mutations = createMutations({ db, clock: () => new Date(clock.now()) });
  const migrations = createMigrationRunner({ db, clock: () => new Date(clock.now()) });

  // Migrate before any factory prepares a statement, mirroring the production
  // discover -> migrate -> instantiate order.
  const migrationResult = migrations.run(
    [
      { moduleId: 'schedule', migrations: scheduleMigrations },
      ...preferenceMigrations
    ],
    // A database migrated by the previous stage also carries questions
    // ledger rows; a caller may narrow the known module set so an upgrade check
    // does not treat them as removed definitions.
    { knownModuleIds: knownModuleIds ?? fixtureCatalog.map((entry) => entry.id) }
  );

  const schedule = createScheduleModule({
    db,
    mutations,
    beforeChange: fixtureBeforeChange,
    clock
  });

  const implementations = new Map([
    ['schedule', { moduleId: 'schedule', router: schedule.router, port: schedule.port }]
  ]);

  const loader = {
    enabledIds: () => [...implementations.keys()],
    get: (moduleId) => implementations.get(moduleId) ?? null,
    moduleMigrations: () => [
      { moduleId: 'schedule', migrations: scheduleMigrations }
    ]
  };

  const { contextRouter, modulesRouter } = createWorkbenchRouters({
    identity,
    trustedOrigins: workbenchEnv.trustedOrigins ?? [],
    loader,
    catalog: fixtureCatalog,
    logger,
    ready: () => initialize()
  });

  const catalogHandler = createModuleCatalogHandler({
    identity,
    loader,
    catalog: fixtureCatalog,
    logger,
    ready: () => initialize()
  });

  let initialization = null;

  function initialize() {
    initialization ??= (async () => {
      logger.info('T52 fixture composition initialized');
      return migrationResult;
    })();
    return initialization;
  }

  return {
    db,
    identity,
    logger,
    catalog: fixtureCatalog,
    mutations,
    migrations,
    loader,
    contextRouter,
    modulesRouter,
    catalogHandler,
    preferencesRouter: createPreferencesRouter({ db, mutations, identity,
      trustedOrigins: workbenchEnv.trustedOrigins ?? [], ready: initialize, logger }),
    initialize,
    scheduleModule: schedule,

    close() {
      db.close();
    }
  };
}
