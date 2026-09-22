import { randomUUID, createHash } from "node:crypto";
import {
  contractError,
  problems,
  invalidInput,
} from "../../workbench/problems.js";
import {
  validate,
  validateSourceRelations,
  mathError,
  contract,
} from "./contract.js";
import { renderSource, rendererVersion } from "./render.js";
import { MathSourceError } from "../../../../../packages/shared/src/math/expression.js";
import { requestFingerprint } from "../../workbench/mutations.js";
export const operationDefinitions = Object.entries(contract.paths)
  .filter(([p]) => p.startsWith("/api/modules/math/"))
  .flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, value]) => ({
      path,
      method: method.toUpperCase(),
      name: value.operationId,
      schema: value.requestBody?.content["application/json"].schema.$ref
        .split("/")
        .at(-1),
    })),
  );
export function createMathService({ db, mutations, files }) {
  const select = db.prepare(
    "SELECT value FROM math_works WHERE id=? AND accountKey=?",
  );
  function principalKey(principal) {
    if (!principal?.accountKey) throw contractError(problems.unauthenticated());
    return principal.accountKey;
  }
  function get(principal, id) {
    const row = select.get(id, principalKey(principal));
    if (!row) throw contractError(problems.notFound());
    return JSON.parse(row.value);
  }
  function assets(principal, work) {
    for (const id of [work.render.posterFileId, work.render.presentationFileId])
      if (id) files.read(principal, id);
    return work;
  }
  function current(principal, id, version, active = true) {
    const work = get(principal, id);
    if (work.version !== version)
      throw contractError(problems.versionConflict(work.version));
    if (active && work.deletedAt) throw contractError(problems.objectDeleted());
    return work;
  }
  function revision(principal, id, version) {
    get(principal, id);
    const row = db
      .prepare("SELECT value FROM math_revisions WHERE workId=? AND version=?")
      .get(id, version);
    if (!row) throw contractError(problems.notFound());
    return JSON.parse(row.value);
  }
  function persist(principal, work) {
    db.prepare(
      "INSERT INTO math_works VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    ).run(work.id, principalKey(principal), JSON.stringify(work));
    const { updatedAt, deletedAt, ...snapshot } = work;
    db.prepare("INSERT INTO math_revisions VALUES (?,?,?)").run(
      work.id,
      work.version,
      JSON.stringify({ ...snapshot, createdAt: updatedAt }),
    );
    return work;
  }
  function readForReferenceV1(principal, id) {
    const work = assets(principal, get(principal, id));
    return {
      id: work.id,
      version: work.version,
      deletedAt: work.deletedAt,
      snapshot: {
        title: work.title,
        workVersion: work.version,
        source: work.source,
        posterFileId: work.render.posterFileId,
        presentationFileId: work.render.presentationFileId,
        rendererVersion: work.rendererVersion,
      },
    };
  }
  function readForTeachingLinkV1(principal, id) {
    const { version, title, deletedAt } = get(principal, id);
    return { id, version, title, deletedAt };
  }
  async function store(principal, request, bytes, name) {
    const hash = createHash("sha256")
      .update(requestFingerprint(request))
      .update(name)
      .update(bytes)
      .digest("hex");
    const key = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    return files.store(
      principal,
      { name, bytes },
      { key, method: "POST", path: "/internal/math/files" },
    );
  }
  const operations = {};
  for (const definition of operationDefinitions)
    operations[definition.name] = async ({
      principal,
      key,
      input,
      id,
      query = {},
    } = {}) => {
      principalKey(principal);
      if (id !== undefined) validate("Id", id);
      const allowed =
        definition.name === "listWorks"
          ? ["q", "state", "kind"]
          : definition.name === "getWorkVersion"
            ? ["version"]
            : [];
      for (const name of Object.keys(query))
        if (!allowed.includes(name))
          throw invalidInput(`/query/${name}`, "unknown-field");
      if (definition.schema) {
        if (
          input?.source?.schemaVersion !== undefined &&
          input.source.schemaVersion !== 1
        )
          throw mathError("unsupported-work-version", "/source/schemaVersion");
        validate(definition.schema, input);
        validate("Id", key);
      }
      const request = {
        principal,
        key,
        method: definition.method,
        path: definition.path.replace("{id}", id),
        body: input,
      };
      if (!definition.schema) {
        let body;
        switch (definition.name) {
          case "listWorks": {
            if (
              query.q !== undefined &&
              (typeof query.q !== "string" || query.q.length > 200)
            )
              throw invalidInput("/query/q", "out-of-range");
            if (
              query.state !== undefined &&
              !["active", "deleted"].includes(query.state)
            )
              throw invalidInput("/query/state", "out-of-range");
            if (
              query.kind !== undefined &&
              !["formula", "plane", "space", "dynamic", "html"].includes(
                query.kind,
              )
            )
              throw invalidInput("/query/kind", "out-of-range");
            const items = db
              .prepare("SELECT value FROM math_works WHERE accountKey=?")
              .all(principal.accountKey)
              .map((r) => JSON.parse(r.value))
              .filter(
                (w) =>
                  Boolean(w.deletedAt) === (query.state === "deleted") &&
                  (!query.kind || w.source.kind === query.kind) &&
                  (!query.q ||
                    w.title
                      .toLowerCase()
                      .includes(query.q.trim().toLowerCase())),
              )
              .sort(
                (a, b) =>
                  b.updatedAt.localeCompare(a.updatedAt) ||
                  a.id.localeCompare(b.id),
              );
            body = { items };
            break;
          }
          case "getWork":
            body = assets(principal, get(principal, id));
            break;
          case "getWorkVersion":
            validate("Version", query.version);
            body = assets(principal, revision(principal, id, query.version));
            break;
          case "listWorkVersions":
            get(principal, id);
            body = {
              items: db
                .prepare(
                  "SELECT value FROM math_revisions WHERE workId=? ORDER BY version DESC",
                )
                .all(id)
                .map((r) => JSON.parse(r.value)),
            };
            break;
          case "readWorkForReference":
            body = readForReferenceV1(principal, id);
            break;
        }
        return { status: 200, body };
      }
      // Probe the shared replay seam with a rollback-only callback. No successful
      // receipt or business write is created until all asynchronous files exist.
      const prepare = Symbol("prepare");
      try {
        return mutations.execute(request, () => {
          throw prepare;
        });
      } catch (e) {
        if (e !== prepare) throw e;
      }
      if (definition.name === "exportWork") {
        const saved = revision(principal, id, input.version);
        const { format, background, width } = input;
        if (
          format === "html" ||
          (saved.render.state === "invalid" && format !== "source") ||
          (saved.source.kind === "formula" && background !== "transparent") ||
          (format === "source" &&
            (width !== 1600 || background !== "transparent"))
        )
          throw mathError("unsupported-export");
        let bytes;
        if (format === "source")
          bytes = Buffer.from(JSON.stringify(saved.source, null, 2));
        else {
          assets(principal, saved);
          bytes = await renderSource(saved.source, input);
        }
        const file = await store(
          principal,
          request,
          bytes,
          `math-${id}-v${input.version}.${format === "source" ? "json" : format}`,
        );
        return mutations.execute(request, () => {
          const body = {
            id: randomUUID(),
            workId: id,
            workVersion: input.version,
            format,
            file,
            offline: "not-applicable",
            createdAt: new Date().toISOString(),
          };
          db.prepare("INSERT INTO math_exports VALUES (?,?,?)").run(
            body.id,
            principal.accountKey,
            JSON.stringify(body),
          );
          return { status: 201, body };
        });
      }
      const prior =
        definition.name === "createWork"
          ? null
          : current(
              principal,
              id,
              input.baseVersion,
              definition.name !== "setWorkDeletion",
            );
      let source = input.source ?? prior.source;
      if (definition.name === "createWork" && input.originalFileId !== null)
        throw mathError(
          "invalid-math-source",
          "/originalFileId",
          "invalid-reference",
        );
      if (prior && input.source && source.kind !== prior.source.kind)
        throw mathError("invalid-math-source", "/source/kind", "kind-changed");
      validateSourceRelations(source);
      let render = prior?.render;
      if (["createWork", "updateWork"].includes(definition.name)) {
        try {
          const bytes = await renderSource(source);
          const file = await store(
            principal,
            request,
            bytes,
            "math-poster.png",
          );
          render = {
            state: "ready",
            posterFileId: file.id,
            presentationFileId: null,
            reason: null,
          };
        } catch (e) {
          if (!(e instanceof MathSourceError)) throw e;
          render = {
            state: "invalid",
            posterFileId: null,
            presentationFileId: null,
            reason: e.reason,
          };
        }
      } else assets(principal, prior);
      return mutations.execute(request, () => {
        if (prior)
          current(
            principal,
            id,
            input.baseVersion,
            definition.name !== "setWorkDeletion",
          );
        const created = !prior || definition.name === "copyWork",
          now = new Date().toISOString();
        const work = {
          id: created ? randomUUID() : id,
          version: created ? 1 : prior.version + 1,
          title: input.title ?? prior.title,
          source,
          originalFileId: prior?.originalFileId ?? null,
          render,
          rendererVersion:
            prior && definition.name !== "updateWork"
              ? prior.rendererVersion
              : rendererVersion,
          createdAt: created ? now : prior.createdAt,
          updatedAt: now,
          deletedAt:
            definition.name === "setWorkDeletion" && input.deleted ? now : null,
        };
        return { status: created ? 201 : 200, body: persist(principal, work) };
      });
    };
  return { operations, readForReferenceV1, readForTeachingLinkV1 };
}
