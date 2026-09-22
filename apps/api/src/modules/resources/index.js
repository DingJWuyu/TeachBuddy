import { createTaxonomy } from "./taxonomy.js";
import { fold } from "./casefold.js";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { validateSchema } from "../../workbench/content/schema.js";
import {
  validateIdPath,
  validateNoQuery,
  uuidPattern,
} from "../../workbench/schema.js";
import { asyncHandler, readIdempotencyKey } from "../../workbench/http.js";
import { materialErrors } from "../../workbench/jobs/router.js";
import {
  contractError,
  problems,
  invalidInput,
} from "../../workbench/problems.js";
export { migrations } from "./migrations/index.js";

export function createResourcesModule({
  db,
  mutations,
  files,
  now = () => new Date().toISOString(),
}) {
  const getRow = db.prepare(
    "SELECT value FROM resource_items WHERE accountKey=? AND id=?",
  );
  const rows = db.prepare(
    "SELECT value FROM resource_items WHERE accountKey=?",
  );
  const saveRow = db.prepare(
    "INSERT INTO resource_items VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
  );
  function read(principal, id) {
    const row = getRow.get(principal.accountKey, id);
    if (!row) throw contractError(problems.notFound());
    return JSON.parse(row.value);
  }
  function save(principal, value) {
    saveRow.run(value.id, principal.accountKey, JSON.stringify(value));
    return value;
  }
  const all = (principal) =>
    rows.all(principal.accountKey).map((row) => JSON.parse(row.value));
  const taxonomy = createTaxonomy({ db, all, save, now });
  function list(principal, query) {
    const folders = taxonomy.read(principal).folders;
    const inFolder = (id) => {
      while (id) {
        if (id === query.folderId) return true;
        id = folders.find((f) => f.id === id)?.parentId;
      }
      return false;
    };
    return {
      items: all(principal)
        .filter(
          (item) =>
            (query.state === "deleted"
              ? item.deletedAt !== null
              : item.deletedAt === null) &&
            (!query.folderId || inFolder(item.folderId)) &&
            (!query.tagIds ||
              query.tagIds.every((id) => item.tagIds.includes(id))) &&
            (!query.mediaType ||
              files.read(principal, item.fileId).mediaType ===
                query.mediaType) &&
            (!query.q ||
              fold(
                [
                  item.title,
                  item.note,
                  files.read(principal, item.fileId).name,
                ].join("\n"),
              ).includes(fold(query.q))),
        )
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
        ),
    };
  }
  function current(principal, id, input, allowDeleted = false) {
    const item = read(principal, id);
    if (item.version !== input.baseVersion)
      throw contractError(problems.versionConflict(item.version));
    if (item.deletedAt && !allowDeleted)
      throw contractError(problems.objectDeleted());
    return item;
  }
  const changed = (principal, item, patch) =>
    save(principal, {
      ...item,
      ...patch,
      version: item.version + 1,
      updatedAt: now(),
    });
  function readForReferenceV2(principal, id) {
    if (!principal?.accountKey) throw contractError(problems.unauthenticated());
    validateIdPath(id);
    const item = read(principal, id),
      file = files.read(principal, item.fileId);
    return {
      id: item.id,
      version: item.version,
      deletedAt: item.deletedAt,
      snapshot: {
        title: item.title,
        fileId: item.fileId,
        fileName: file.name,
        mediaType: file.mediaType,
        supplementPreviewFileId: item.supplementPreviewFileId,
      },
    };
  }
  const definitions = {
    readResourceForReferenceV2: {
      method: "GET",
      route: "/items/:id/for-reference",
      run: ({ principal, id }) => readForReferenceV2(principal, id),
    },
    updateResource: {
      method: "PUT",
      route: "/items/:id",
      schema: "UpdateResource",
      run: ({ principal, id, input }) => {
        const item = current(principal, id, input);
        if (!input.title.trim()) throw invalidInput("/title", "empty-content");
        taxonomy.validateLinks(principal, input);
        const { baseVersion, ...patch } = input;
        return changed(principal, item, patch);
      },
    },
    replaceResourceFile: {
      method: "PUT",
      route: "/items/:id/file",
      schema: "ReplaceResource",
      run: ({ principal, id, input }) => {
        const item = current(principal, id, input);
        files.read(principal, input.fileId);
        return changed(principal, item, {
          fileId: input.fileId,
          supplementPreviewFileId: null,
        });
      },
    },
    setResourceSupplementPreview: {
      method: "PUT",
      route: "/items/:id/supplement-preview",
      schema: "SupplementPreview",
      run: ({ principal, id, input }) => {
        const item = current(principal, id, input);
        if (item.fileId !== input.fileId)
          throw invalidInput("/fileId", "out-of-range");
        if (input.supplementPreviewFileId) {
          const file = files.read(principal, input.supplementPreviewFileId);
          const preview = files.preview(principal, file.id);
          if (
            file.mediaType !== "application/pdf" ||
            preview.state !== "ready" ||
            !preview.pageCount ||
            preview.pages.length !== preview.pageCount
          )
            throw invalidInput("/supplementPreviewFileId", "out-of-range");
        }
        return changed(principal, item, {
          supplementPreviewFileId: input.supplementPreviewFileId,
        });
      },
    },
    setResourceDeletion: {
      method: "POST",
      route: "/items/:id/deletion",
      schema: "SetDeletion",
      run: ({ principal, id, input }) => {
        const item = current(principal, id, input, true);
        return changed(principal, item, {
          deletedAt: input.deleted ? (item.deletedAt ?? now()) : null,
        });
      },
    },
    getResourceTaxonomy: {
      method: "GET",
      route: "/taxonomy",
      run: ({ principal }) => taxonomy.read(principal),
    },
    updateResourceTaxonomy: {
      method: "PUT",
      route: "/taxonomy",
      schema: "UpdateResourceTaxonomy",
      run: ({ principal, input }) => taxonomy.update(principal, input),
    },
    listResources: {
      method: "GET",
      route: "/items",
      run: ({ principal, query }) => list(principal, query),
    },
    getResource: {
      method: "GET",
      route: "/items/:id",
      run: ({ principal, id }) => read(principal, id),
    },
    createResource: {
      method: "POST",
      route: "/items",
      schema: "CreateResource",
      status: 201,
      run: ({ principal, input }) => {
        files.read(principal, input.fileId);
        if (!input.title.trim()) throw invalidInput("/title", "empty-content");
        taxonomy.validateLinks(principal, input);
        const timestamp = now();
        return save(principal, {
          id: randomUUID(),
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          ...input,
          supplementPreviewFileId: null,
        });
      },
    },
  };
  const operations = {};
  const router = Router();
  for (const [name, definition] of Object.entries(definitions)) {
    operations[name] = async ({ principal, key, input, id, query = {} }) => {
      if (!principal?.accountKey)
        throw contractError(problems.unauthenticated());
      if (definition.route.includes(":id")) validateIdPath(id);
      if (definition.schema) validateInput(definition.schema, input);
      if (name !== "listResources") validateNoQuery(query);
      else query = validateQuery(query);
      const status = definition.status ?? 200;
      const action = () => ({
        status,
        body: definition.run({ principal, input, id, query }),
      });
      if (definition.method === "GET") return action();
      if (!uuidPattern.test(key ?? ""))
        throw invalidInput("/headers/Idempotency-Key", "invalid-type");
      return mutations.execute(
        {
          principal,
          key,
          method: definition.method,
          path: "/api/modules/resources" + definition.route.replace(":id", id),
          body: input,
        },
        action,
      );
    };
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
  return { router, port: { operations, readForReferenceV2 } };
}

function validateQuery(query) {
  for (const key of Object.keys(query))
    if (!["q", "state", "folderId", "tagIds", "mediaType"].includes(key))
      throw invalidInput(`/query/${key}`, "unknown-field");
  const value = { ...query };
  for (const [key, max] of [
    ["q", 200],
    ["mediaType", 150],
  ])
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "string" ||
        value[key].length > max ||
        (key === "mediaType" && !value[key]))
    )
      throw invalidInput(`/query/${key}`, "out-of-range");
  if (value.state !== undefined && !["active", "deleted"].includes(value.state))
    throw invalidInput("/query/state", "out-of-range");
  if (value.folderId !== undefined)
    validateIdPath(value.folderId, "/query/folderId");
  if (value.tagIds !== undefined) {
    value.tagIds = Array.isArray(value.tagIds) ? value.tagIds : [value.tagIds];
    if (
      value.tagIds.length > 100 ||
      new Set(value.tagIds).size !== value.tagIds.length
    )
      throw invalidInput("/query/tagIds", "out-of-range");
    value.tagIds.forEach((id) => validateIdPath(id, "/query/tagIds"));
  }
  return value;
}

function validateInput(schema, input) {
  validateSchema(schema, input);
  if (input.tagIds && new Set(input.tagIds).size !== input.tagIds.length)
    throw invalidInput("/tagIds", "duplicate-id");
}
