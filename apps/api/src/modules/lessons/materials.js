import { normalizeSearchQuery, matchesSearch } from "../questions/contract.js";
import { createLessonExports } from "./exports.js";
import { materialErrors } from "../../workbench/jobs/router.js";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { validateSchema } from "../../workbench/content/schema.js";
import {
  ContractError,
  invalidInput,
  contractError,
  problems,
} from "../../workbench/problems.js";
import { validateIdPath, validateNoQuery } from "../../workbench/schema.js";
import { validateLessonsQuery } from "../questions/schema.js";
import {
  createMutationHandler,
  withPathId,
  asyncHandler,
} from "../../workbench/http.js";

const fail = (status, type, extra = {}) =>
  new ContractError(status, {
    type: `/problems/${type.startsWith("materials/") ? type : `workbench/${type}`}`,
    ...extra,
  });
export function createMaterialsLessons({
  repository,
  mutations,
  questions,
  resources,
  content,
  db,
  jobs,
  files,
  now = () => new Date(),
}) {
  const account = (p) => {
    if (!p?.accountKey) throw contractError(problems.unauthenticated());
    return p.accountKey;
  };
  const requireLesson = (p, id) => {
    const r = repository.getLessonForAccount(account(p), id);
    if (!r) throw contractError(problems.notFound());
    return r;
  };
  const source = (p, kind, id) => {
    const port = kind === "question" ? questions : resources;
    if (!port?.readForReferenceV2) throw fail(503, "temporarily-unavailable");
    return port.readForReferenceV2(p, id);
  };
  const ref = (p, r) => {
    const kind = r.kind ?? "question";
    let latestVersion = r.questionVersion,
      sourceState = "deleted";
    try {
      const s = source(p, kind, r.questionId);
      latestVersion = s.version;
      sourceState = s.deletedAt === null ? "active" : "deleted";
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    const snapshot = structuredClone(r.snapshot);
    if (kind === "question" && !snapshot.answerStatus)
      snapshot.answerStatus = snapshot.solution.blocks.length
        ? "present"
        : "absent";
    return {
      id: r.referenceId,
      kind,
      [`${kind}Id`]: r.questionId,
      [`${kind}Version`]: r.questionVersion,
      note: r.note,
      snapshot,
      latestVersion,
      sourceState,
    };
  };
  const read = (p, r) => {
    const refs = repository.listReferences(r.id);
    const { accountKey, ...record } = r;
    return {
      ...record,
      sections: repository
        .listSections(r.id)
        .map((s) => ({
          id: s.sectionId,
          title: s.title,
          content: s.content,
          references: refs
            .filter((r) => r.sectionId === s.sectionId)
            .map((r) => ref(p, r)),
        })),
      materials: refs.filter((r) => r.sectionId === null).map((r) => ref(p, r)),
    };
  };
  const get = (p, id) => read(p, requireLesson(p, id));
  function persist(p, id, input) {
    const old = new Map(
      repository.listReferences(id).map((r) => [r.referenceId, r]),
    );
    const ids = new Set(),
      sectionIds = new Set(),
      references = [];
    if (!input.title.trim()) throw invalidInput("/title", "empty-content");
    content.validate(p, input.intro);
    const add = (r, sectionId, position, pointer) => {
      if (ids.has(r.id) || sectionIds.has(r.id))
        throw invalidInput(`${pointer}/id`, "invalid-reference");
      ids.add(r.id);
      if (ids.size > 1000) throw invalidInput("/materials", "out-of-range");
      const prior = old.get(r.id),
        kind = r.kind,
        sourceId = r[`${kind}Id`],
        version = r[`${kind}Version`];
      if (
        prior &&
        ((prior.kind ?? "question") !== kind || prior.questionId !== sourceId)
      )
        throw invalidInput(pointer, "invalid-reference");
      let snapshot = prior?.snapshot;
      if (!prior || prior.questionVersion !== version) {
        const s = source(p, kind, sourceId);
        if (s.deletedAt !== null) throw contractError(problems.objectDeleted());
        if (s.version !== version)
          throw fail(409, "materials/reference-version-conflict", {
            kind,
            id: sourceId,
            currentVersion: s.version,
          });
        validateSchema(
          kind === "question"
            ? "ReferenceReadQuestion"
            : "ReferenceReadResource",
          s,
        );
        snapshot =
          kind === "question"
            ? {
                title: s.snapshot.title,
                body: s.snapshot.body,
                solution: s.snapshot.solution,
                answerStatus: s.snapshot.answerStatus,
              }
            : {
                title: s.snapshot.title,
                fileId: s.snapshot.fileId,
                fileName: s.snapshot.fileName,
                mediaType: s.snapshot.mediaType,
                supplementPreviewFileId: s.snapshot.supplementPreviewFileId,
              };
      }
      references.push({
        lessonId: id,
        accountKey: account(p),
        referenceId: r.id,
        kind,
        questionId: sourceId,
        questionVersion: version,
        note: r.note,
        snapshot,
        sectionId,
        position,
      });
    };
    input.sections.forEach((s, i) => {
      if (sectionIds.has(s.id))
        throw invalidInput(`/sections/${i}/id`, "duplicate-id");
      sectionIds.add(s.id);
    });
    const sections = input.sections.map((s, i) => {
      if (!s.title.trim())
        throw invalidInput(`/sections/${i}/title`, "empty-content");
      content.validate(p, s.content);
      s.references.forEach((r, j) =>
        add(r, s.id, j, `/sections/${i}/references/${j}`),
      );
      return {
        lessonId: id,
        accountKey: account(p),
        sectionId: s.id,
        position: i,
        title: s.title,
        content: s.content,
      };
    });
    input.materials.forEach((r, j) => add(r, null, j, `/materials/${j}`));
    repository.replaceContent(id, sections, references);
  }
  function write(p, input, id) {
    const prior = id ? requireLesson(p, id) : null;
    if (prior && input.baseVersion !== prior.version)
      throw contractError(problems.versionConflict(prior.version));
    if (prior?.deletedAt) throw contractError(problems.objectDeleted());
    const at = now().toISOString();
    const record = {
      id: id ?? randomUUID(),
      accountKey: account(p),
      version: (prior?.version ?? 0) + 1,
      createdAt: prior?.createdAt ?? at,
      updatedAt: at,
      deletedAt: null,
      title: input.title,
      intro: input.intro,
    };
    persist(p, record.id, input);
    prior ? repository.updateLesson(record) : repository.insertLesson(record);
    return read(p, record);
  }
  function deletion(p, input, id) {
    const r = requireLesson(p, id);
    if (r.version !== input.baseVersion)
      throw contractError(problems.versionConflict(r.version));
    if (r.deletedAt && input.deleted)
      throw contractError(problems.objectDeleted());
    const at = now().toISOString();
    const next = {
      ...r,
      version: r.version + 1,
      updatedAt: at,
      deletedAt: input.deleted ? at : null,
    };
    repository.updateLesson(next);
    return read(p, next);
  }
  function list(p, query = {}) {
    const text = (blocks) =>
      blocks.flatMap((b) => [
        b.latex ?? "",
        ...(b.runs ?? []).map((r) => r.text ?? r.latex ?? ""),
        ...text(b.blocks ?? []),
        ...(b.items ?? []).flatMap((i) => text(i.blocks)),
        ...(b.rows ?? []).flatMap((row) => row.flatMap((c) => text(c.blocks))),
      ]);
    const q = normalizeSearchQuery(query.q);
    return {
      items: repository
        .listLessonsForAccount(account(p))
        .filter((r) => (r.deletedAt !== null) === (query.state === "deleted"))
        .map((r) => read(p, r))
        .filter((r) =>
          matchesSearch(q, [
            r.title,
            ...text(r.intro.blocks),
            ...r.sections.flatMap((s) => text(s.content.blocks)),
          ]),
        ),
    };
  }
  function listUsages(p, { kind, id }) {
    source(p, kind, id);
    return {
      items: repository
        .listLessonsForAccount(account(p))
        .filter((r) => !r.deletedAt)
        .flatMap((r) => {
          const sections = repository.listSections(r.id);
          return repository
            .listReferences(r.id)
            .filter(
              (ref) =>
                (ref.kind ?? "question") === kind && ref.questionId === id,
            )
            .sort((a, b) => a.referenceId.localeCompare(b.referenceId))
            .map((ref) => ({
              lessonId: r.id,
              lessonTitle: r.title,
              sectionId: ref.sectionId,
              sectionTitle:
                sections.find((s) => s.sectionId === ref.sectionId)?.title ??
                null,
              referenceId: ref.referenceId,
              adoptedVersion: ref.questionVersion,
            }));
        }),
    };
  }
  const exports = createLessonExports({ db, jobs, files, getLesson: get, now });
  const operations = {};
  const router = Router();
  const definitions = [
    [
      "createLessonExport",
      "post",
      "/items/:id/exports",
      "ExportInput",
      202,
      exports.create,
    ],
    [
      "listLessonExports",
      "get",
      "/items/:id/exports",
      null,
      200,
      (p, b, id) => exports.list(p, id),
    ],
    ["listLessonsV2", "get", "/items", null, 200, (p, b, id, q) => list(p, q)],
    [
      "createLessonV2",
      "post",
      "/items",
      "CreateLesson",
      201,
      (p, b) => write(p, b),
    ],
    ["getLessonV2", "get", "/items/:id", null, 200, (p, b, id) => get(p, id)],
    ["updateLessonV2", "put", "/items/:id", "UpdateLesson", 200, write],
    [
      "setLessonDeletionV2",
      "post",
      "/items/:id/deletion",
      "SetDeletion",
      200,
      deletion,
    ],
    [
      "listQuestionUsagesV2",
      "get",
      "/question-usages/:id",
      null,
      200,
      (p, b, id) => listUsages(p, { kind: "question", id }),
    ],
    [
      "listResourceUsagesV2",
      "get",
      "/resource-usages/:id",
      null,
      200,
      (p, b, id) => listUsages(p, { kind: "resource", id }),
    ],
  ];
  for (const [name, method, path, schema, status, action] of definitions) {
    operations[name] = async ({ principal, key, input, id, query }) => {
      account(principal);
      if (path.includes(":id")) validateIdPath(id);
      if (schema) validateSchema(schema, input);
      else if (name === "listLessonsV2") validateLessonsQuery(query ?? {});
      else validateNoQuery(query ?? {});
      const run = () => ({ status, body: action(principal, input, id, query) });
      return schema
        ? mutations.execute(
            {
              principal,
              key,
              method: method.toUpperCase(),
              path: `/api/modules/lessons/v2${path.replace(":id", id)}`,
              body: input,
            },
            run,
          )
        : run();
    };
    if (schema)
      router[method](
        path,
        createMutationHandler({
          mutations,
          method: method.toUpperCase(),
          validate: (b, req) => {
            if (path.includes(":id")) validateIdPath(req.params.id);
            validateNoQuery(req.query);
            return validateSchema(schema, b);
          },
          write: ({ principal, body, request }) => ({
            status,
            body: action(principal, body, request.params.id),
          }),
        }),
      );
    else
      router.get(
        path,
        asyncHandler(async (req, res) => {
          const result = await operations[name]({
            principal: req.workbenchPrincipal,
            id: req.params.id,
            query: req.query,
          });
          res.status(result.status).json(result.body);
        }),
      );
  }
  materialErrors(router);
  return {
    router,
    port: { operations, listUsages },
    jobHandlers: { export: exports.handler },
    get,
    requireLesson,
  };
}
