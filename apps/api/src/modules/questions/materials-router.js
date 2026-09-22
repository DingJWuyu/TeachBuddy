import {
  sendProblem,
  contractError,
  problems,
} from "../../workbench/problems.js";
import fs from "node:fs";
import YAML from "yaml";
import { Router } from "express";
import { validateSchema } from "../../workbench/content/schema.js";
import { invalidInput, unauthenticated } from "./contract.js";
const contract = YAML.parse(
  fs.readFileSync(
    new URL(
      "../../../../../docs/contracts/workbench/materials.openapi.yaml",
      import.meta.url,
    ),
    "utf8",
  ),
);
export function createMaterialsRouter({ service, mutations }) {
  const router = Router(),
    operations = {};
  for (const [path, methods] of Object.entries(contract.paths)) {
    if (!path.startsWith("/api/modules/questions/v2/")) continue;
    for (const [method, operation] of Object.entries(methods)) {
      const write = method !== "get",
        schema = operation.requestBody?.content["application/json"].schema.$ref
          .split("/")
          .at(-1);
      const status = Number(
        Object.keys(operation.responses).find((x) => /^2/.test(x)),
      );
      operations[operation.operationId] = ({
        principal,
        key,
        input,
        id,
        query = {},
      }) => {
        if (!principal?.accountKey) throw unauthenticated();
        if (path.includes("{id}")) validateSchema("Id", id, "/path/id");
        const allowed = operation.parameters
          .filter((x) => x.in === "query")
          .map((x) => x.name);
        for (const k of Object.keys(query))
          if (!allowed.includes(k))
            throw invalidInput("/query/" + k, "unknown-field");
        if (
          query.state !== undefined &&
          !["active", "deleted"].includes(query.state)
        )
          throw invalidInput("/query/state", "out-of-range");
        if (
          query.q !== undefined &&
          (typeof query.q !== "string" || query.q.length > 200)
        )
          throw invalidInput("/query/q", "out-of-range");
        if (query.typeId !== undefined)
          validateSchema("Id", query.typeId, "/query/typeId");
        if (
          query.starred !== undefined &&
          ![true, false, "true", "false"].includes(query.starred)
        )
          throw invalidInput("/query/starred", "invalid-type");
        if (query.tagIds !== undefined) {
          query = {
            ...query,
            tagIds: Array.isArray(query.tagIds) ? query.tagIds : [query.tagIds],
          };
          if (
            query.tagIds.length > 100 ||
            new Set(query.tagIds).size !== query.tagIds.length
          )
            throw invalidInput("/query/tagIds", "out-of-range");
          query.tagIds.forEach((x) => validateSchema("Id", x, "/query/tagIds"));
        }
        if (schema) validateSchema(schema, input);
        const execute = () => ({
          status,
          body: service[operation.operationId]({
            principal,
            input: structuredClone(input),
            id,
            query,
          }),
        });
        if (!write) return execute();
        validateSchema("Id", key, "/headers/Idempotency-Key");
        return mutations.execute(
          {
            principal,
            key,
            method: method.toUpperCase(),
            path: path.replace("{id}", id),
            body: input,
          },
          execute,
        );
      };
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
  return { router, operations };
}
