import { Router } from "express";
import { asyncHandler, readIdempotencyKey, materialErrors } from "../../workbench/http.js";
import { validateIdPath, validateNoQuery } from "../../workbench/schema.js";
import { contractError, problems } from "../../workbench/problems.js";
import { createResourcesService } from "./service.js";
export { migrations } from "./migrations/index.js";

export function createResourcesModule(dependencies) {
  const { definitions, validateInput, ...port } = createResourcesService(dependencies);
  const { operations } = port;
  const router = Router();
  for (const [name, definition] of Object.entries(definitions)) {
    router[definition.method.toLowerCase()](
      definition.route,
      asyncHandler(async (req, res) => {
        if (definition.schema && !req.is("application/json"))
          throw contractError(problems.unsupportedMediaType());
        // Schema errors precede key validation, just as public operations do.
        if (definition.route.includes(":id")) validateIdPath(req.params.id);
        if (definition.schema) validateInput(definition.schema, req.body);
        if (name !== "listResources") validateNoQuery(req.query);
        const result = await operations[name]({
          principal: req.workbenchPrincipal,
          id: req.params.id,
          input: req.body,
          query: req.query,
          key: definition.schema ? readIdempotencyKey(req) : undefined,
        });
        res.status(result.status).json(result.body);
      }),
    );
  }
  materialErrors(router);
  return { router, port };
}

// Account lifecycle owned by this module; the composition root owns the transaction.
export function deleteAccountData(db, accountKey) {
  for (const table of ['resource_file_history', 'resource_text_cache', 'resource_taxonomy', 'resource_items'])
    db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
