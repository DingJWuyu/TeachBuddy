import { sendProblem, contractError, problems } from "../../workbench/problems.js";
import { Router } from "express";
import { materialsContract } from "./materials-operations.js";

export function createMaterialsRouter({ operations }) {
  const router = Router();
  for (const [path, methods] of Object.entries(materialsContract.paths)) {
    if (!path.startsWith("/api/modules/questions/v2/")) continue;
    for (const [method, operation] of Object.entries(methods)) {
      const write = method !== "get";
      router[method](
        path.replace("/api/modules/questions", "").replace("{id}", ":id"),
        async (req, res, next) => {
          try {
            if (write && !req.is("application/json"))
              throw contractError(problems.unsupportedMediaType());
            const result = await operations[operation.operationId]({
              principal: req.workbenchPrincipal,
              key: req.get("Idempotency-Key"),
              input: req.body,
              id: req.params.id,
              query: req.query,
            });
            res.status(result.status).json(result.body);
          } catch (e) {
            next(e);
          }
        },
      );
    }
  }
  router.use((error, req, res, next) =>
    error.problem?.type?.startsWith("/problems/materials/")
      ? sendProblem(res, error.status, error.problem)
      : next(error),
  );
  return router;
}
