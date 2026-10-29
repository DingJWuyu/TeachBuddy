import { Router } from "express";
import { asyncHandler } from "../../workbench/http.js";
import {
  contractError,
  problems,
  sendProblem,
} from "../../workbench/problems.js";
import { operationDefinitions, createMathService } from "./service.js";
import { migrations } from "./migrations.js";
export function createMathModule({ db, mutations, files, content, mathRuntimeDirectory }) {
  const port = createMathService({ db, mutations, files, content, mathRuntimeDirectory });
  const router = Router();
  for (const definition of operationDefinitions)
    router[definition.method.toLowerCase()](
      definition.path
        .replace("/api/modules/math", "")
        .replace("{id}", ":id")
        .replace("{version}", ":version"),
      asyncHandler(async (req, res) => {
        if (
          definition.schema &&
          (req.get("content-type") ?? "").split(";")[0] !== "application/json"
        )
          throw contractError(problems.unsupportedMediaType());
        const query = { ...req.query };
        if (req.params.version !== undefined) {
          if (!/^[1-9]\d*$/.test(req.params.version))
            throw contractError(problems.notFound());
          query.version = Number(req.params.version);
        }
        const result = await port.operations[definition.name]({
          principal: req.workbenchPrincipal,
          key: definition.schema ? req.get("Idempotency-Key") : undefined,
          input: req.body,
          id: req.params.id,
          query,
        });
        res.status(result.status).json(result.body);
      }),
    );
  router.use((error, req, res, next) =>
    error.problem?.type?.startsWith("/problems/math/") ||
    error.problem?.type === "/problems/materials/storage-unavailable"
      ? sendProblem(res, error.status, error.problem)
      : next(error),
  );
  return { router, port, migrations };
}
export { migrations };
