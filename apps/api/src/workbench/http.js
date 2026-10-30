/**
 * Workbench HTTP transport.
 *
 * The frozen processing order is enforced here, before any business change:
 * source/protection, identity, JSON/schema, confirmed request key, ownership,
 * version and business validation, atomic write. Every workbench response is
 * `Cache-Control: no-store`; failures are `application/problem+json`.
 *
 * Authentication is resolved through the shared identity adapter.
 */
import express from 'express';
import { validateSchema } from './content/schema.js';
import {
  projectModuleCatalog,
  workbenchCacheControl,
  workbenchHeaders,
  workbenchLimits,
  workbenchMediaTypes
} from '@teachbuddy/shared';
import {
  contractError,
  isProblem,
  mapErrorToResponse,
  problems,
  sendProblem
} from './problems.js';
import { uuidPattern, validateBody, validateIdPath } from './schema.js';
import { createRequestLogger } from './logger.js';

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isWriteMethod(method) {
  return writeMethods.has(String(method).toUpperCase());
}

export function asyncHandler(handler) {
  return function handle(req, res, next) {
    try {
      Promise.resolve(handler(req, res, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

/** Run one Express middleware inside an async flow, preserving its error. */
function runMiddleware(req, res, middleware) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (error) => (error ? reject(error) : resolve()));
  });
}

function noStore(req, res, next) {
  res.set('Cache-Control', workbenchCacheControl);
  next();
}

/**
 * Source of a write request: the Origin header when present (an empty or
 * malformed value is rejected, never silently replaced), otherwise the Referer
 * fallback. Reads carry no source requirement in the frozen contract.
 */
function requestOrigin(req) {
  const origin = req.get('origin');
  if (origin !== undefined) return origin;
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function createGuards({ identity, trustedOrigins = [] }) {
  const trusted = new Set(trustedOrigins);

  /** Write requests only: the frozen contract requires source + fixed header
   * before any business change; read operations declare neither parameter. */
  function originGuard(req, res, next) {
    const origin = requestOrigin(req);
    if (!origin || !trusted.has(origin)) {
      return next(contractError(problems.requestNotAllowed()));
    }
    return next();
  }

  function protectionGuard(req, res, next) {
    if (!isWriteMethod(req.method)) return next();
    if (req.get(workbenchHeaders.browserProtection) !== workbenchHeaders.browserProtectionValue) {
      return next(contractError(problems.requestNotAllowed()));
    }
    return next();
  }

  const identityGuard = asyncHandler(async (req, res, next) => {
    const principal = await identity.resolvePrincipal(req);
    if (!principal?.accountKey) {
      return next(contractError(problems.unauthenticated()));
    }
    req.workbenchPrincipal = principal;
    return next();
  });

  return { originGuard, protectionGuard, identityGuard };
}

function assertJsonContentType(req) {
  const contentType = req.get('content-type') ?? '';
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  if (mediaType !== workbenchMediaTypes.json) {
    throw contractError(problems.unsupportedMediaType());
  }
}

export function readIdempotencyKey(req) {
  const key = req.get(workbenchHeaders.idempotencyKey);
  if (!key) throw contractError(problems.invalidInput('/headers/Idempotency-Key', 'required'));
  if (!uuidPattern.test(key)) throw contractError(problems.invalidInput('/headers/Idempotency-Key', 'invalid-type'));
  return key;
}

/** The concrete request path without query string; part of the key binding. */
export function canonicalRequestPath(req) {
  return req.originalUrl.split('?')[0];
}

/**
 * Compose a module's body validator with the shared path-ID rule. The path and
 * the body are one request-schema stage, so a malformed path is the same 422 as
 * a malformed body, checked after the JSON content type.
 */
export function withPathId(validate, pointer = '/path/id') {
  return (body, request) => {
    validateIdPath(request.params.id, pointer);
    return validate(body);
  };
}

/**
 * Standard write route: content type, schema, confirmed request key, then the
 * module's synchronous transaction body through `mutations.execute`. The
 * request is validated before the key is read, so an invalid request is never
 * reported as an idempotency conflict. `validate(body, request)` is the
 * module-owned request validator; `bodySchema` is the shared schema-engine
 * alternative. `write({principal, body, request})` returns `{status, body}`.
 */
export function createMutationHandler({ mutations, bodySchema, validate, method, write }) {
  const validateRequest = validate ?? ((body) => validateBody(bodySchema, body));
  return asyncHandler(async (req, res) => {
    assertJsonContentType(req);
    const body = validateRequest(req.body, req);
    const key = readIdempotencyKey(req);
    const principal = req.workbenchPrincipal;
    const result = mutations.execute(
      {
        principal,
        key,
        method,
        path: canonicalRequestPath(req),
        body
      },
      () => write({ principal, body, request: req })
    );
    res.status(result.status).json(result.body);
  });
}

export function createWorkbenchErrorHandler({ logger } = {}) {
  return function workbenchErrorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    const mapped = mapErrorToResponse(error);
    if (!mapped.known) logger?.error(`unhandled ${req.method} ${req.originalUrl}`, error);
    if (isProblem(mapped.problem)) res.locals.workbenchProblemType = mapped.problem.type;
    return sendProblem(res, mapped.status, mapped.problem);
  };
}

/**
 * GET /api/modules for the workbench shell: the frozen ModuleCatalog projected
 * from the shared catalog and the modules this process actually imported. The
 * returned stack is self-contained (no-store, identity guard, problem error
 * handler), so the app mounts it at the contract path unchanged; the legacy
 * bearer route that previously owned that exact path is removed.
 */
export function createModuleCatalogHandler({ identity, loader, catalog, ready, logger }) {
  const identityGuard = createGuards({ identity }).identityGuard;
  const errorHandler = createWorkbenchErrorHandler({ logger });
  return [
    noStore,
    identityGuard,
    asyncHandler(async (req, res) => {
      await ready();
      res.json(projectModuleCatalog(loader.enabledIds(), catalog));
    }),
    errorHandler
  ];
}

/**
 * Build the two workbench routers. The context router is mounted at
 * `/api/workbench`; the modules router is mounted at `/api/modules` and owns the
 * module sub-paths, while the exact catalog path is mounted separately through
 * `createModuleCatalogHandler` and never reaches this router.
 */
export function createWorkbenchRouters({
  identity,
  trustedOrigins,
  loader,
  catalog,
  logger,
  ready
}) {
  const guards = createGuards({ identity, trustedOrigins });
  const errorHandler = createWorkbenchErrorHandler({ logger });
  const jsonParser = express.json({
    limit: workbenchLimits.requestBodyBytes,
    type: workbenchMediaTypes.json,
    strict: true
  });

  // Workbench routes are same-origin only, so a CORS preflight is never a
  // legitimate workbench request: leave OPTIONS to the app-level CORS policy
  // instead of letting this router answer it with its own Allow list.
  const passPreflight = (req, res, next) => (req.method === 'OPTIONS' ? next('router') : next());

  const contextRouter = express.Router();
  contextRouter.use(passPreflight, noStore, createRequestLogger(logger));
  contextRouter.get(
    '/',
    guards.identityGuard,
    asyncHandler(async (req, res) => {
      await ready();
      res.json({ accountKey: req.workbenchPrincipal.accountKey });
    })
  );
  contextRouter.use(errorHandler);

  const modulesRouter = express.Router();
  // The parser runs before the source and identity guards, so malformed or oversized JSON gets 400/413 ahead of 403/401 (no business change either way).
  modulesRouter.use(passPreflight, noStore, createRequestLogger(logger), jsonParser);

  // Every `/api/modules/<id>...` path is a workbench path: an ID outside the
  // catalog is a contract not-found, never a legacy error shape. The exact
  // `GET /api/modules` catalog response is mounted by the app through
  // `createModuleCatalogHandler`, before this router is entered.
  const moduleIds = new Set(catalog.map((entry) => entry.id));

  modulesRouter.use(
    '/:moduleId',
    asyncHandler(async (req, res, next) => {
      if (!moduleIds.has(req.params.moduleId)) throw contractError(problems.notFound());
      if (isWriteMethod(req.method)) {
        await runMiddleware(req, res, guards.originGuard);
        await runMiddleware(req, res, guards.protectionGuard);
      }
      await runMiddleware(req, res, guards.identityGuard);
      await ready();
      const implementation = loader.get(req.params.moduleId);
      if (!implementation) throw contractError(problems.notFound());
      return implementation.router(req, res, (error) => (
        error ? next(error) : next(contractError(problems.notFound()))
      ));
    })
  );
  modulesRouter.use(errorHandler);

  return { contextRouter, modulesRouter };
}

// Shared material transport preserves guards, body limits and problem fields.
export function materialJsonRoute(
  router,
  route,
  { guards, ready },
  schema,
  status,
  action,
) {
  router.post(
    route,
    guards.originGuard,
    guards.protectionGuard,
    guards.identityGuard,
    (req, res, next) =>
      req.is("application/json")
        ? next()
        : next(contractError(problems.unsupportedMediaType())),
    express.json({ limit: "2mb" }),
    asyncHandler(async (req, res) => {
      await ready();
      validateSchema(schema, req.body);
      res
        .status(status)
        .json(
          await action(req, {
            key: readIdempotencyKey(req),
            method: "POST",
            path: canonicalRequestPath(req),
          }),
        );
    }),
  );
}
export function materialErrors(router, logger) {
  router.use((error, req, res, next) =>
    error.problem?.type?.startsWith("/problems/materials/")
      ? sendProblem(res, error.status, error.problem)
      : next(error),
  );
  router.use(createWorkbenchErrorHandler({ logger }));
}
