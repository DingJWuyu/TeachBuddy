import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { workbenchPaths } from '@refatos/shared';
import { createEnv, env as defaultEnv } from './config/env.js';
import { createDataStore } from './core/dataStore.js';
import { createAuthCodeSender } from './core/mail.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createWorkbench, assertFoundationRuntime } from './workbench/index.js';
import { createAuthModule } from './features/auth/index.js';
import { migrations } from './features/auth/migrations/index.js';
import { contractError, problems } from './workbench/problems.js';

export function createApp(options = {}) {
  const runtimeEnv = options.env ? createEnv(options.env) : defaultEnv;
  assertFoundationRuntime(runtimeEnv);
  // Test identities remain available only to explicitly isolated regression runners.
  const testIdentity = runtimeEnv.nodeEnv === 'test' && runtimeEnv.workbench.mode === 'test-principal';
  let authModule;
  if (!testIdentity) {
    if (!runtimeEnv.authCodeSecret) throw new Error('AUTH_CODE_SECRET is required.');
    const origin = new URL(runtimeEnv.workbench.publicOrigin);
    if (origin.protocol !== 'https:' || origin.origin !== runtimeEnv.workbench.publicOrigin) {
      throw new Error('WORKBENCH_PUBLIC_ORIGIN must be an exact HTTPS origin.');
    }
    runtimeEnv.workbench.trustedOrigins = [origin.origin];
    runtimeEnv.workbench.resolvePrincipal = async (request) => {
      if (!authModule) throw contractError(problems.temporarilyUnavailable());
      try {
        return await authModule.resolvePrincipal(request);
      } catch (error) {
        if (['/problems/auth/account-store-unavailable', '/problems/auth/session-store-unavailable'].includes(error.problem?.type)) {
          throw contractError(problems.temporarilyUnavailable());
        }
        throw error;
      }
    };
  }
  const webAssetDirectory = options.webMiddleware || !runtimeEnv.workbench.webDist
    ? fileURLToPath(new URL('../../web/public/', import.meta.url))
    : path.resolve(runtimeEnv.workbench.webDist);
  const workbench = options.workbench ?? createWorkbench({ env: runtimeEnv, logger: options.workbenchLogger,
    clock: options.workbenchClock, mathRuntimeDirectory: path.join(webAssetDirectory, 'vendor/math/geogebra') });
  let dataStore;
  try {
    // A preconstructed fixture must use the same real page/session verification
    // as the default composition. All routers retain this identity object.
    if (!testIdentity) {
      if (workbench.trustedOrigins?.length !== 1 || workbench.trustedOrigins[0] !== runtimeEnv.workbench.publicOrigin) {
        throw new Error('The preconstructed workbench must use the same single trusted HTTPS origin as createApp.');
      }
      workbench.identity.resolvePrincipal = runtimeEnv.workbench.resolvePrincipal;
      workbench.identity.isAccountActive = accountKey => authModule?.isAccountActive(accountKey) ?? false;
    }
    dataStore = options.dataStore ?? createDataStore(runtimeEnv, { db: workbench.db });
    if (!testIdentity) {
      workbench.migrations.run([{ moduleId: 'auth', migrations }], { knownModuleIds: ['auth'] });
      const gaps = workbench.db.prepare('SELECT accountId, reason FROM auth_legacy_gaps').all();
      if (gaps.length) {
        throw new Error('Resolve auth_legacy_gaps in an isolated database before startup: ' + JSON.stringify(gaps));
      }
      authModule = createAuthModule({
        db: workbench.db,
        publicOrigin: runtimeEnv.workbench.publicOrigin,
        codeSecret: runtimeEnv.authCodeSecret,
        isRegistrationOpen: () => runtimeEnv.registrationOpen,
        sendCode: options.sendCode ?? createAuthCodeSender(runtimeEnv),
        now: options.now,
        deleteAccountData: input => workbench.deleteAccountData(input),
      });
    }
  } catch (error) {
    // Composition is synchronous, before HTTP can accept work. Preserve the
    // cleanup promise for the async startup owner without hiding a failure.
    error.cleanup = workbench.close();
    error.cleanup.catch(() => {});
    throw error;
  }
  const closeStore = dataStore.close.bind(dataStore);
  let closing;
  dataStore.close = () => {
    closing ??= (async () => { await workbench.close(); await closeStore(); })();
    closing.catch(() => { closing = undefined; });
    return closing;
  };
  const app = express();
  if (authModule) app.use('/api/auth', authModule.router);
  if (workbench.agentRecoveryGuard) app.use('/api/agent', workbench.agentRecoveryGuard);
  app.use('/api/agent', (req, res, next) => {
    workbench.initialize().then(() => workbench.agent.router(req, res, next)).catch(next);
  });
  if (!testIdentity && (!workbench.filesRouter || !workbench.jobsRouter))
    throw new Error('The authenticated composition requires files and jobs.');
  app.use('/api/reliability/v1', workbench.preferencesRouter);
  if (workbench.navigationRouter) app.use('/api/workbench/navigation', workbench.navigationRouter);
  if (workbench.reliabilityRouter) app.use('/api/reliability/v1', workbench.reliabilityRouter);
  if (workbench.filesRouter) app.use('/api/workbench/files', workbench.filesRouter);
  if (workbench.jobsRouter) app.use('/api/workbench/jobs', workbench.jobsRouter);
  app.use(workbenchPaths.context, workbench.contextRouter);
  app.use(workbenchPaths.modules, workbench.modulesRouter);
  app.get(workbenchPaths.modules, ...workbench.catalogHandler);
  app.get('/api/health', (req, res) => res.json({ app: runtimeEnv.appName, status: 'ok' }));

  // Development and built assets share the API origin. Keep missing API routes
  // out of the development SPA fallback as well.
  if (options.webMiddleware) {
    app.use((req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/')) return next();
      return options.webMiddleware(req, res, next);
    });
  } else if (runtimeEnv.workbench.webDist) {
    const webDist = path.resolve(runtimeEnv.workbench.webDist);
    const indexPath = path.join(webDist, 'index.html');
    app.use(express.static(webDist, { index: ['index.html'] }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) return next();
      return res.sendFile(indexPath, { dotfiles: 'allow' });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return { app, dataStore, env: runtimeEnv, workbench, authModule };
}
