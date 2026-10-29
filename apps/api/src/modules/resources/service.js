import { createTaxonomy } from "./taxonomy.js";
import { createResourceHistory } from "./history.js";
import { createResourceTextSearch } from "./text-search.js";
import { randomUUID } from "node:crypto";
import { validateSchema } from "../../workbench/content/schema.js";
import {
  validateIdPath,
  validateNoQuery,
  uuidPattern,
} from "../../workbench/schema.js";
import {
  contractError,
  problems,
  invalidInput,
} from "../../workbench/problems.js";

export function createResourcesService({
  db,
  mutations,
  files,
  jobs,
  recognition,
  now = () => new Date().toISOString(),
}) {
  const history = createResourceHistory(db, files);
  const textSearch = createResourceTextSearch({ db, files, jobs, recognition, mutations });
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
  async function list(principal, query) {
    const fileMetadata = new Map();
    const fileInfo = (item) => {
      if (fileMetadata.has(item.fileId)) return fileMetadata.get(item.fileId);
      try {
        const file = files.read(principal, item.fileId);
        fileMetadata.set(item.fileId, file);
        return file;
      } catch (error) {
        if (error.status !== 503 && error.status !== 404) throw error;
        return null;
      }
    };
    const folders = taxonomy.read(principal).folders;
    const inFolder = (id) => {
      while (id) {
        if (id === query.folderId) return true;
        id = folders.find((f) => f.id === id)?.parentId;
      }
      return false;
    };
    const items = all(principal)
      .filter(
        (item) =>
          (query.state === "deleted"
            ? item.deletedAt !== null
            : item.deletedAt === null) &&
          (!query.folderId || inFolder(item.folderId)) &&
          (!query.tagIds ||
            query.tagIds.every((id) => item.tagIds.includes(id))) &&
          (!query.mediaType || fileInfo(item)?.mediaType === query.mediaType) &&
          (!query.sha256 || fileInfo(item)?.sha256 === query.sha256),
      )
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
      );
    return query.q?.trim()
      ? textSearch.search(principal, items, query.q, fileInfo)
      : { items };
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
  const definitions = {
    retryResourceText: {
      method: "POST",
      route: "/search/retry",
      schema: "Empty",
      run: ({ principal }) => textSearch.retry(principal),
    },
    organizeResources: {
      method: "POST",
      route: "/items/organize",
      schema: "OrganizeResources",
      run: ({ principal, input }) => {
        if (
          new Set(input.items.map((item) => item.id)).size !==
          input.items.length
        )
          throw invalidInput("/items", "duplicate-id");
        const selected = input.items.map((entry) =>
          current(principal, entry.id, entry, input.action === "restore"),
        );
        if (input.action === "move")
          taxonomy.validateLinks(principal, {
            folderId: input.folderId,
            tagIds: [],
          });
        if (input.action === "add-tags")
          taxonomy.validateLinks(principal, {
            folderId: null,
            tagIds: input.tagIds,
          });
        if (
          input.action === "restore" &&
          selected.some((item) => !item.deletedAt)
        )
          throw invalidInput("/items", "invalid-reference");
        return {
          items: selected.map((item) => {
            const patch =
              input.action === "move"
                ? { folderId: input.folderId }
                : input.action === "add-tags"
                  ? { tagIds: [...new Set([...item.tagIds, ...input.tagIds])] }
                  : { deletedAt: input.action === "archive" ? now() : null };
            if (patch.tagIds?.length > 100)
              throw invalidInput("/tagIds", "out-of-range");
            return changed(principal, item, patch);
          }),
        };
      },
    },
    listResourceFileHistory: {
      method: "GET",
      route: "/items/:id/history",
      run: ({ principal, id }) =>
        history.describe(principal, read(principal, id)),
    },
    restoreResourceFile: {
      method: "POST",
      route: "/items/:id/restore-file",
      schema: "RestoreResourceFile",
      run: ({ principal, id, input }) => {
        const item = current(principal, id, input);
        const revision = history
          .list(principal, item)
          .find((entry) => entry.version === input.fileVersion);
        if (!revision) throw invalidInput("/fileVersion", "invalid-reference");
        files.read(principal, revision.fileId);
        if (revision.supplementPreviewFileId)
          files.read(principal, revision.supplementPreviewFileId);
        const result = changed(principal, item, {
          fileId: revision.fileId,
          supplementPreviewFileId: revision.supplementPreviewFileId,
        });
        history.capture(principal, result);
        return result;
      },
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
        const result = changed(principal, item, {
          fileId: input.fileId,
          supplementPreviewFileId: null,
        });
        history.capture(principal, result);
        return result;
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
        const result = changed(principal, item, {
          supplementPreviewFileId: input.supplementPreviewFileId,
        });
        history.capture(principal, result);
        return result;
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
    purgeResource: {
      method: "POST",
      route: "/items/:id/purge",
      schema: "PurgeResource",
      run: ({ principal, id, input }) => {
        const item = current(principal, id, input, true);
        if (!item.deletedAt) throw invalidInput("/id", "invalid-reference");
        db.prepare(
          "DELETE FROM resource_items WHERE accountKey=? AND id=?",
        ).run(principal.accountKey, id);
        history.remove(principal, id);
        // Managed file bytes have their own lifetime.
        return { id, permanentlyDeleted: true };
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
        const result = save(principal, {
          id: randomUUID(),
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          ...input,
          supplementPreviewFileId: null,
        });
        history.capture(principal, result);
        return result;
      },
    },
  };
  const operations = {};
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
      if (definition.method === "GET")
        return {
          status,
          body: await definition.run({ principal, input, id, query }),
        };
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
  }
  return { definitions, validateInput, operations,
    readReference(principal, id) {
      validateIdPath(id);
      return read(principal, id);
    },
  };
}

function validateQuery(query) {
  for (const key of Object.keys(query))
    if (
      !["q", "state", "folderId", "tagIds", "mediaType", "sha256"].includes(key)
    )
      throw invalidInput(`/query/${key}`, "unknown-field");
  const value = { ...query };
  if (
    value.sha256 !== undefined &&
    (typeof value.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.sha256))
  )
    throw invalidInput("/query/sha256", "out-of-range");
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

