import { randomUUID, createHash } from "node:crypto";
import {
  contractError,
  problems,
  invalidInput,
} from "../../workbench/problems.js";
import {
  validate,
  validateSourceRelations,
  validateGeoGebraSource,
  mathError,
  contract,
} from "./contract.js";
import { requestFingerprint } from "../../workbench/mutations.js";
import { createMathArtifacts } from "./artifacts.js";
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
export function createMathService({ db, mutations, files, mathRuntimeDirectory }) {
  const artifacts = createMathArtifacts({ files, mathRuntimeDirectory });
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
    const work = artifacts.assertAvailable(principal, get(principal, id));
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
        ...(work.source.kind === "workshop" ? { graphPosterFileId: work.render.graphPosterFileId } : {}),
        rendererVersion: work.rendererVersion,
      },
    };
  }
  // The file key derives from the request, so a retry after a failed commit reuses the prepared file.
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
      const started = Date.now();
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
        if (["dynamic", "geogebra", "workshop"].includes(input?.source?.kind)) {
          try {
            validate(input.source.kind === "geogebra" ? "GeoGebraSource" : input.source.kind === "workshop" ? "WorkshopSource" : "DynamicSource", input.source);
          } catch (error) {
            if (!error.problem) throw error;
            throw mathError(
              "invalid-math-source",
              `/source${error.problem.field ?? ""}`,
              error.problem.reason,
            );
          }
        }
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
              !["formula", "plane", "space", "dynamic", "html", "geogebra", "workshop"].includes(
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
            body = artifacts.assertAvailable(principal, get(principal, id));
            break;
          case "getWorkVersion":
            validate("Version", query.version);
            body = artifacts.assertAvailable(principal, revision(principal, id, query.version));
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
      // peek is read-only: slow preparation outside the transaction never claims the success key.
      const replay = mutations.peek(request);
      if (replay) return replay;
      if (definition.name === "purgeWork") {
        return mutations.execute(request, () => {
          const work = current(principal, id, input.baseVersion, false);
          if (!work.deletedAt) throw invalidInput("/id", "invalid-reference");
          db.prepare("DELETE FROM math_exports WHERE accountKey=? AND json_extract(value, '$.workId')=?").run(principal.accountKey, id);
          db.prepare("DELETE FROM math_revisions WHERE workId=?").run(id);
          db.prepare("DELETE FROM math_works WHERE id=? AND accountKey=?").run(id, principal.accountKey);
          // Shared immutable files have their own lifetime.
          return { status: 200, body: { id, permanentlyDeleted: true } };
        });
      }
      if (definition.name === "exportWork") {
        const saved = revision(principal, id, input.version);
        const { file, offline } = await artifacts.prepareExport(saved, input, {
          principal,
          store: (bytes, name) => store(principal, request, bytes, name),
        });
        if (Date.now() - started > 30000) throw mathError("render-unavailable", undefined, undefined, 503);
        return mutations.execute(request, () => {
          revision(principal, id, input.version);
          const body = {
            id: randomUUID(),
            workId: id,
            workVersion: input.version,
            format: input.format,
            file,
            offline,
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
      if (
        definition.name === "createWork" &&
        input.originalFileId !== (source.kind === "html" ? source.fileId : null)
      )
        throw mathError(
          "invalid-math-source",
          "/originalFileId",
          "invalid-reference",
        );
      if (prior && input.source && source.kind !== prior.source.kind)
        throw mathError("invalid-math-source", "/source/kind", "kind-changed");
      validateSourceRelations(source);
      if (source.kind === "workshop" && !source.graph && !source.formulas.length)
        throw mathError("invalid-math-source", "/source", "empty-workshop");
      if (input.source) await validateGeoGebraSource(source);
      let prepared = prior;
      if (["createWork", "updateWork"].includes(definition.name)) {
        prepared = await artifacts.prepareWork(source, {
          title: input.title,
          principal,
          store: (bytes, name) => store(principal, request, bytes, name),
        });
      } else artifacts.assertAvailable(principal, prior);
      if (Date.now() - started > 30000) throw mathError("render-unavailable", undefined, undefined, 503);
      return mutations.execute(request, () => {
        // Preparation ran outside the transaction, so ownership and version are rechecked before commit.
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
          originalFileId: prior?.originalFileId ?? input.originalFileId ?? null,
          render: prepared.render,
          rendererVersion: prepared.rendererVersion,
          createdAt: created ? now : prior.createdAt,
          updatedAt: now,
          deletedAt:
            definition.name === "setWorkDeletion" && input.deleted ? now : null,
        };
        return { status: created ? 201 : 200, body: persist(principal, work) };
      });
    };
  return { operations };
}
