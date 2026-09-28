import { createNavigationRouter, navigationMigrations } from './navigation.js';
import { createReliability } from './reliability/index.js';
import { migrations as reliabilityMigrations, acquireLock } from './reliability/storage.js';
import fs from 'node:fs';
import { createPreferencesRouter, preferenceMigrations } from '../reliability/preferences.js';
import { connectBusinessOperations } from '../agent/business.js';
import { createAgent, migrations as agentMigrations } from '../agent/index.js';
import { createJobs } from "./jobs/index.js";
import { jobMigrations } from "./jobs/migrations.js";
import { unconnectedHandlers } from "./jobs/fixtures.js";
import { createJobsRouter } from "./jobs/router.js";
import { createPreviews } from "./files/preview.js";
import { createRecognition } from './recognition/index.js';
import { createRecognizer } from './recognition/runtime.js';
import { recognitionMigrations } from './recognition/migrations.js';
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
import { contractError, problems } from './problems.js';
import { eraseAccountRows } from './account-deletion.js';
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

  const releaseLock = acquireLock(env.sqlitePath);
  let db;
  let releaseFiles = () => {};
  try {
    releaseFiles = acquireLock(path.join(workbenchEnv.filesDir ?? path.join(path.dirname(env.sqlitePath), "files"), ".managed-files"));
    if (fs.existsSync(path.join(path.dirname(env.sqlitePath), 'recovery-pending.json'))) throw new Error('Recovered data requires explicit activation before startup.');
    const activationPath = path.join(path.dirname(env.sqlitePath), 'recovery-activated.json');
    if (fs.existsSync(activationPath)) {
      const activation = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
      const configuredFiles = workbenchEnv.filesDir ?? path.join(path.dirname(env.sqlitePath), 'files');
      if (fs.realpathSync(env.sqlitePath) !== path.join(activation.target, 'workspace.sqlite') || fs.realpathSync(configuredFiles) !== path.join(activation.target, 'files')) throw new Error('Recovered database and files must use the activated target together.');
    }
    db = openWorkbenchDatabase({ sqlitePath: env.sqlitePath });
  } catch (error) { releaseFiles(); releaseLock(); throw error; }
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
  const mutations = createMutations({ db, clock, assertAccountActive(principal) {
    if (identity.isAccountActive && !identity.isAccountActive(principal.accountKey))
      throw contractError(problems.unauthenticated());
  } });
  const { readBytes, ...files } = createFiles({
    db,
    mutations,
    directory:
      workbenchEnv.filesDir ?? path.join(path.dirname(env.sqlitePath), "files"),
    clock,
  });
  const jobs = createJobs({ db, mutations, files, clock, logger,
    isAccountActive: accountKey => identity.isAccountActive?.(accountKey) ?? true });
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
  const recognition = createRecognition({ db, mutations, files, readBytes, jobs, content,
    recognizer: workbenchEnv.recognition?.recognizer ?? createRecognizer({ home: workbenchEnv.recognition?.home,
      workDirectory: path.join(workbenchEnv.filesDir ?? path.join(path.dirname(env.sqlitePath), 'files'), 'recognition-work') }) });
  const migrations = createMigrationRunner({ db, clock });
  const loader = createModuleLoader({
    catalog,
    implementations: {
      ...implementations,
      ...(workbenchEnv.extraImplementations ?? {}),
    },
    dependencies: { db, mutations, files, content, jobs, recognition, clock: { now: () => (clock ? clock() : new Date()).toISOString() } },
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
    recognition,
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
  const reliability = createReliability({ db, loader, mutations, identity, trustedOrigins: workbenchEnv.trustedOrigins ?? [], ready: () => initialize(), filesDirectory: workbenchEnv.filesDir ?? path.join(path.dirname(env.sqlitePath), 'files'), logger });
  const preferencesRouter = createPreferencesRouter({ db, mutations, identity,
    trustedOrigins: workbenchEnv.trustedOrigins ?? [], ready: () => initialize(), logger, clock });
  const navigationRouter = createNavigationRouter({ db, mutations, identity, catalog,
    trustedOrigins: workbenchEnv.trustedOrigins ?? [], ready: () => initialize(), logger, clock });
  let initialization = null;
  let agent;
  let closed = false;

  function initialize() {
    initialization ??= (async () => {
      await loader.discover();
      const migrationResult = migrations.run(
        [...fileMigrations, ...jobMigrations, ...recognitionMigrations, ...reliabilityMigrations, ...preferenceMigrations, ...navigationMigrations, ...loader.moduleMigrations()],
        {
          knownModuleIds: [
            "reliability",
            "materials-files",
            "materials-jobs",
            "materials-recognition",
            "reliability-preferences",
            "workbench-navigation",
            ...catalog.map((entry) => entry.id),
          ],
        },
      );
      logger.info(
        `migrations applied ${migrationResult.applied.length}, skipped ${migrationResult.skipped.length}`,
      );
      reliability.initialize();
      files.initialize();
      recognition.initialize();
      await loader.instantiate();
      const handlers = {
        ...unconnectedHandlers(),
        ...files.jobHandlers,
        ...recognition.jobHandlers,
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
    recognition,
    filesRouter,
    reliabilityRouter: reliability.router,
    agentRecoveryGuard: reliability.agentRecoveryGuard,
    preferencesRouter,
    navigationRouter,
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
    async deleteAccountData({ accountKey, files: savedFiles, rememberFiles }) {
      await initialize();
      // Account revocation precedes this method. Keep rows until every producer
      // has settled, so cancellation can finish against its original records.
      await Promise.all([
        jobs.cancelAccountAndWait(accountKey),
        agent.runtime.stopAccountAndWait(accountKey),
        reliability.cancelAccountAndWait(accountKey),
        files.cancelAccountConversionsAndWait(accountKey),
      ]);
      await recognition.cleanupAccount(accountKey);
      const manifest = savedFiles ?? { blobs: files.accountFileNames(accountKey), exports: reliability.accountExportIds(accountKey) };
      if (!savedFiles) rememberFiles(manifest);
      files.removeAccountFiles(accountKey, manifest.blobs);
      reliability.removeAccountExports(accountKey, manifest.exports);
      eraseAccountRows(db, accountKey);
    },

    close() {
      if (closed) return;
      closed = true;
      reliability.close();
      agent?.close();
      jobs.close();
      if (db.open) db.close();
      releaseFiles();
      releaseLock();
    },
  };
}
