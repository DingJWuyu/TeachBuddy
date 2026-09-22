import express from "express";
import {
  createGuards,
  asyncHandler,
  readIdempotencyKey,
  canonicalRequestPath,
  createWorkbenchErrorHandler,
} from "../http.js";
import { validateSchema } from "../content/schema.js";
import {
  contractError,
  problems,
  sendProblem,
  invalidInput,
} from "../problems.js";
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
export function createJobsRouter({
  identity,
  trustedOrigins,
  jobs,
  ready,
  logger,
}) {
  const router = express.Router();
  const guards = createGuards({ identity, trustedOrigins });
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/",
    guards.identityGuard,
    asyncHandler(async (req, res) => {
      await ready();
      if (Object.keys(req.query).some((k) => k !== "kind"))
        throw invalidInput("/query", "unknown-field");
      res.json(jobs.list(req.workbenchPrincipal, req.query.kind));
    }),
  );
  router.get(
    "/:id",
    guards.identityGuard,
    asyncHandler(async (req, res) => {
      await ready();
      res.json(jobs.get(req.workbenchPrincipal, req.params.id));
    }),
  );
  materialJsonRoute(
    router,
    "/:id/cancel",
    { guards, ready },
    "Empty",
    200,
    (req, m) => jobs.cancel(req.workbenchPrincipal, req.params.id, m),
  );
  materialJsonRoute(
    router,
    "/:id/retry",
    { guards, ready },
    "RetryJob",
    202,
    (req, m) => jobs.retry(req.workbenchPrincipal, req.params.id, req.body, m),
  );
  materialErrors(router, logger);
  return router;
}
