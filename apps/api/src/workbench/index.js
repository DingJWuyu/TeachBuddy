import { connectBusinessOperations } from '../agent/business.js';
import { createAgent, migrations as agentMigrations } from '../agent/index.js';
import { createJobs } from "./jobs/index.js";
import { jobMigrations } from "./jobs/migrations.js";
import { unconnectedHandlers } from "./jobs/fixtures.js";
import { createJobsRouter } from "./jobs/router.js";
import { createPreviews } from "./files/preview.js";
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
import path from "node:path";
import { createFiles } from "./files/index.js";
import { fileMigrations } from "./files/migrations.js";
import { createFilesRouter } from "./files/router.js";
import { createContent } from "./content/index.js";
import { moduleCatalog } from "@refatos/shared";
import { moduleImplementations } from "./moduleImplementations.js";
import { openWorkbenchDatabase } from "./storage.js";
import { createIdentity, assertWorkbenchRuntimeConfig } from "./identity.js";
import { createMutations } from "./mutations.js";
import { createMigrationRunner } from "./migrations.js";
import { createWorkbenchLogger } from "./logger.js";
import { createModuleLoader } from "./moduleLoader.js";
import { createModuleCatalogHandler, createWorkbenchRouters } from "./http.js";

export function assertFoundationRuntime(env) {
  assertWorkbenchRuntimeConfig({
    nodeEnv: env.nodeEnv,
    workbench: env.workbench ?? {},
  });
  if (env.nodeEnv === "production" && Object.values(env.workbench?.jobHandlers ?? {}).some(handler => handler?.fixture))
    throw new Error("Materials production startup requires preview, extraction, export and question-asset handlers; fixture handlers are forbidden.");
}

export function createWorkbench({
  env,
  identity: identityOverride,
  logger: loggerOverride,
  clock,
  implementations = moduleImplementations,
} = {}) {
  if (!env)
    throw new Error("createWorkbench requires the resolved environment.");
  assertFoundationRuntime(env);
  const workbenchEnv = env.workbench ?? {};

  const db = openWorkbenchDatabase({ sqlitePath: env.sqlitePath });
  const logger =
    loggerOverride ??
    createWorkbenchLogger({ logDir: workbenchEnv.logDir, clock });
  const identity =
    identityOverride ??
    createIdentity({
      mode: workbenchEnv.mode,
      testPrincipals: workbenchEnv.testPrincipals,
      sessionSecret: workbenchEnv.sessionSecret,
      resolvePrincipal: workbenchEnv.resolvePrincipal ?? undefined,
    });
  const catalog = workbenchEnv.catalogOverride ?? moduleCatalog;
  const mutations = createMutations({ db, clock });
  const { readBytes, ...files } = createFiles({
    db,
    mutations,
    directory:
      workbenchEnv.filesDir ?? path.join(path.dirname(env.sqlitePath), "files"),
    clock,
  });
  const jobs = createJobs({ db, mutations, files, clock, logger });
  Object.assign(
    files,
    createPreviews({
      db,
      mutations,
      files,
      jobs,
      readBytes,
      directory: path.join(
        workbenchEnv.filesDir ??
          path.join(path.dirname(env.sqlitePath), "files"),
        "conversions",
      ),
      conversion: workbenchEnv.conversion,
    }),
  );
  const content = createContent({ files });
  const migrations = createMigrationRunner({ db, clock });
  const loader = createModuleLoader({
    catalog,
    implementations: {
      ...implementations,
      ...(workbenchEnv.extraImplementations ?? {}),
    },
    dependencies: { db, mutations, files, content, jobs, clock: { now: () => (clock ? clock() : new Date()).toISOString() } },
    logger,
  });

  const { contextRouter, modulesRouter } = createWorkbenchRouters({
    identity,
    trustedOrigins: workbenchEnv.trustedOrigins ?? [],
    loader,
    catalog,
    logger,
    ready: () => initialize(),
  });

  // The exact `GET /api/modules` catalog endpoint. B12 delivered the handler
  // without claiming the path (the legacy shell owned it); B15 mounts it at the
  // contract path and removes the legacy bearer route.
  const catalogHandler = createModuleCatalogHandler({
    identity,
    loader,
    catalog,
    logger,
    ready: () => initialize(),
  });

  const filesRouter = createFilesRouter({
    identity,
    trustedOrigins: workbenchEnv.trustedOrigins ?? [],
    files,
    ready: () => initialize(),
    logger,
  });

  const jobsRouter = createJobsRouter({
    identity,
    trustedOrigins: workbenchEnv.trustedOrigins ?? [],
    jobs,
    ready: () => initialize(),
    logger,
  });
  let initialization = null;
  let agent;

  function initialize() {
    initialization ??= (async () => {
      await loader.discover();
      const migrationResult = migrations.run(
        [...fileMigrations, ...jobMigrations, ...loader.moduleMigrations()],
        {
          knownModuleIds: [
            "materials-files",
            "materials-jobs",
            ...catalog.map((entry) => entry.id),
          ],
        },
      );
      logger.info(
        `migrations applied ${migrationResult.applied.length}, skipped ${migrationResult.skipped.length}`,
      );
      files.initialize();
      await loader.instantiate();
      const handlers = {
        ...unconnectedHandlers(),
        ...files.jobHandlers,
        ...loader.get("questions")?.jobHandlers,
        ...loader.get("lessons")?.jobHandlers,
        ...workbenchEnv.jobHandlers,
      };
      if (env.nodeEnv === "production") {
        for (const kind of ["preview", "extraction", "export", "question-asset"]) {
          if (typeof handlers[kind]?.run !== "function" || handlers[kind].fixture)
            throw new Error(`Materials production startup requires ${kind} handler.`);
        }
      }
      migrations.run([{ moduleId: 'agent', migrations: agentMigrations }], { knownModuleIds: ['agent'] });
      const operations = connectBusinessOperations(loader);
      agent = createAgent({ db, mutations, identity, trustedOrigins: workbenchEnv.trustedOrigins ?? [], operations, config: env.agent });
      jobs.start(handlers);
      return migrationResult;
    })();
    return initialization;
  }

  return {
    get agent() { return agent; },
    db,
    files,
    content,
    filesRouter,
    jobs,
    jobsRouter,
    identity,
    trustedOrigins: [...(workbenchEnv.trustedOrigins ?? [])],
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
      jobs.close();
      db.close();
    },
  };
}
