/**
 * Isolated T52 workbench composition.
 *
 * The production composition root (`apps/api/src/workbench/index.js`) is owned
 * by the integration writer, and the frozen shared catalog does not know the
 * `classes.readClass`, `classes.readRecord` or `lessons.readForTeachingLink`
 * ports yet. This fixture therefore wires the same real facilities - one SQLite
 * database, the identity seam, `mutations.execute`, the migration runner, the
 * workbench routers and the real schedule module factory - with explicit
 * dependencies and a fixture-only catalog. It is a test composition, never a
 * product surface, and it writes nothing back to the product catalog.
 */
import { openWorkbenchDatabase } from '../../../src/workbench/storage.js';
import { assertWorkbenchRuntimeConfig, createIdentity } from '../../../src/workbench/identity.js';
import { createMutations } from '../../../src/workbench/mutations.js';
import { createMigrationRunner } from '../../../src/workbench/migrations.js';
import { createWorkbenchLogger } from '../../../src/workbench/logger.js';
import { createModuleCatalogHandler, createWorkbenchRouters } from '../../../src/workbench/http.js';
import { createScheduleModule, migrations as scheduleMigrations } from '../../../src/modules/schedule/index.js';
import { fixtureBeforeChange, fixtureClock } from './runtime.js';
import { createClassesModule, migrations as classesMigrations } from './modules/classes/index.js';
import { createLessonsModule, migrations as lessonsMigrations } from './modules/lessons/index.js';

/** Fixture-only descriptors; the real v2 catalog (with requires) is T53's. */
export const fixtureCatalog = Object.freeze([
  Object.freeze({
    id: 'lessons',
    name: '备课',
    path: '/lessons',
    navigation: 'sidebar',
    auxiliaryPanel: true,
    requires: Object.freeze([])
  }),
  Object.freeze({
    id: 'classes',
    name: '班级',
    path: '/classes',
    navigation: 'sidebar',
    auxiliaryPanel: true,
    requires: Object.freeze([])
  }),
  Object.freeze({
    id: 'schedule',
    name: '日程',
    path: '/calendar',
    navigation: 'top',
    auxiliaryPanel: true,
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
      { moduleId: 'classes', migrations: classesMigrations },
      { moduleId: 'lessons', migrations: lessonsMigrations },
      { moduleId: 'schedule', migrations: scheduleMigrations }
    ],
    // A database migrated by the previous stage also carries questions/lessons
    // ledger rows; a caller may narrow the known module set so an upgrade check
    // does not treat them as removed definitions.
    { knownModuleIds: knownModuleIds ?? fixtureCatalog.map((entry) => entry.id) }
  );

  const classes = createClassesModule({ db, mutations });
  const lessons = createLessonsModule({ db, mutations });
  const schedule = createScheduleModule({
    db,
    mutations,
    classes: classes.port,
    lessons: lessons.port,
    beforeChange: fixtureBeforeChange,
    clock
  });

  const implementations = new Map([
    ['classes', { moduleId: 'classes', router: classes.router, port: classes.port }],
    ['lessons', { moduleId: 'lessons', router: lessons.router, port: lessons.port }],
    ['schedule', { moduleId: 'schedule', router: schedule.router, port: schedule.port }]
  ]);

  const loader = {
    enabledIds: () => [...implementations.keys()],
    get: (moduleId) => implementations.get(moduleId) ?? null,
    moduleMigrations: () => [
      { moduleId: 'classes', migrations: classesMigrations },
      { moduleId: 'lessons', migrations: lessonsMigrations },
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
    initialize,
    scheduleModule: schedule,

    close() {
      db.close();
    }
  };
}
