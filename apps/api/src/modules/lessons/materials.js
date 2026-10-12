import { validate as validateMath } from "../../workbench/content/mathSchema.js";
import { createLessonOrder } from "./order.js";
import { createLessonHistory } from "./history.js";
import { lessonDocuments, supportedDocument } from "@refatos/shared";
import { normalizeSearchQuery, matchesSearch } from "../questions/contract.js";
import { images } from "../questions/materials-content.js";
import { createLessonExports } from "./exports.js";
import { materialErrors } from "../../workbench/jobs/router.js";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { validateSchema } from "../../workbench/content/schema.js";
import {
  ContractError,
  sendProblem,
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
    type: `/problems/${(type.startsWith("materials/") || type.startsWith("math/")) ? type : `workbench/${type}`}`,
    ...extra,
  });
export function createMaterialsLessons({
  version = 2,
  math,
  repository,
  mutations,
  questions,
  resources,
  content,
  db,
  jobs,
  files,
  recognition,
  now = () => new Date(),
}) {
  const order = version === 3 ? createLessonOrder({ db, repository, mutations }) : null;
  const validate = (name, value) => {
    if (["PurgeLesson", "CopyLesson", "CopyLessonSections", "RestoreLessonVersion", "AdoptLessonPage"].includes(name) || version < 3) return validateSchema(name, value);
    return validateMath(
      name === "CreateLesson" || name === "UpdateLesson" ? `${name}V3` : name,
      value,
    );
  };
  const assertRepresentable = (id) => {
    if (version < 3 && repository.listReferences(id).some(r => r.kind === "math")) throw invalidInput("/materials", "unsupported-content-version");
  };
  const assertWritable = (record) => {
    const references = repository.listReferences(record.id);
    const documents = lessonDocuments({
      ...record,
      sections: repository.listSections(record.id).map((section) => ({
        ...section,
        references: references.filter((reference) => reference.sectionId === section.sectionId),
      })),
      materials: references.filter((reference) => reference.sectionId === null),
    });
    const unsupported = documents.find(([, document]) => !supportedDocument(document));
    if (unsupported) throw invalidInput(`${unsupported[0]}/version`, "unsupported-content-version");
  };
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
    if (kind === "math") return math.readForReferenceV1(p, id);
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
      [kind === "math" ? "workId" : `${kind}Id`]: r.questionId,
      [kind === "math" ? "workVersion" : `${kind}Version`]: r.questionVersion,
      note: r.note,
      afterBlock: r.afterBlock ?? null,
      snapshot,
      latestVersion,
      sourceState,
    };
  };
  const read = (p, r, saved = null) => {
    assertRepresentable(r.id);
    const refs = saved?.references ?? repository.listReferences(r.id);
    const { accountKey, ...record } = r;
    return {
      ...record,
      sections: (saved?.sections ?? repository.listSections(r.id))
        .map((s) => ({
          id: s.sectionId,
          title: s.title,
          content: s.content,
          ...(s.pageSource ? { pageSource: s.pageSource } : {}),
          references: refs
            .filter((r) => r.sectionId === s.sectionId)
            .map((r) => ref(p, r)),
        })),
      materials: refs.filter((r) => r.sectionId === null).map((r) => ref(p, r)),
    };
  };
  const get = (p, id) => read(p, requireLesson(p, id));
  const history = createLessonHistory({ db, repository, requireLesson });
  function persist(p, id, input) {
    const oldSections = new Map(repository.listSections(id).map(s => [s.sectionId, s]));
    const old = new Map(
      repository.listReferences(id).map((r) => [r.referenceId, r]),
    );
    const ids = new Set(),
      sectionIds = new Set(),
      references = [];
    if (!input.title.trim()) throw invalidInput("/title", "empty-content");
    content.validate(p, input.intro);
    const add = (r, sectionId, position, pointer, blockCount = 0) => {
      if (ids.has(r.id) || sectionIds.has(r.id))
        throw invalidInput(`${pointer}/id`, "invalid-reference");
      ids.add(r.id);
      if (ids.size > 1000) throw invalidInput("/materials", "out-of-range");
      const prior = old.get(r.id),
        kind = r.kind,
        sourceId = r[kind === "math" ? "workId" : `${kind}Id`],
        version = r[kind === "math" ? "workVersion" : `${kind}Version`];
      if (
        prior &&
        ((prior.kind ?? "question") !== kind || prior.questionId !== sourceId)
      )
        throw invalidInput(pointer, "invalid-reference");
      let snapshot = prior?.snapshot;
      const afterBlock = sectionId === null ? null : Object.hasOwn(r, "afterBlock") ? r.afterBlock : prior?.afterBlock ?? null;
      if (afterBlock !== null && afterBlock > blockCount) throw invalidInput(`${pointer}/afterBlock`, "out-of-range");
      if (!prior || prior.questionVersion !== version) {
        const s = source(p, kind, sourceId);
        if (s.deletedAt !== null) throw contractError(problems.objectDeleted());
        if (s.version !== version)
          throw fail(409, `${kind === "math" ? "math" : "materials"}/reference-version-conflict`, {
            kind,
            id: sourceId,
            currentVersion: s.version,
          });
        if (kind === "math") {
          validateMath("ReferenceReadWork", s);
          if (s.snapshot.render?.state === "invalid" || (!s.snapshot.posterFileId && s.snapshot.source.kind !== "html")) throw fail(422, "math/work-not-ready");
          if (s.snapshot.source.kind === "workshop" && (!s.snapshot.presentationFileId || (s.snapshot.source.graph && !s.snapshot.graphPosterFileId))) throw fail(422, "math/work-not-ready");
          snapshot = structuredClone(s.snapshot);
        } else {
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
        afterBlock,
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
        add(r, s.id, j, `/sections/${i}/references/${j}`, s.content.blocks.length),
      );
      return {
        lessonId: id,
        accountKey: account(p),
        sectionId: s.id,
        position: i,
        title: s.title,
        content: s.content,
        pageSource: oldSections.get(s.id)?.pageSource ?? null,
      };
    });
    input.materials.forEach((r, j) => add(r, null, j, `/materials/${j}`));
    repository.replaceContent(id, sections, references);
  }
  function write(p, input, id) {
    const prior = id ? requireLesson(p, id) : null;
    if (prior && input.baseVersion !== prior.version)
      throw contractError(problems.versionConflict(prior.version));
    if (prior) assertRepresentable(id);
    if (prior?.deletedAt) throw contractError(problems.objectDeleted());
    if (prior) assertWritable(prior);
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
    if (prior) history.capture(prior);
    persist(p, record.id, input);
    prior ? repository.updateLesson(record) : repository.insertLesson(record);
    history.capture(record);
    return read(p, record);
  }
  function deletion(p, input, id) {
    const r = requireLesson(p, id);
    if (r.version !== input.baseVersion)
      throw contractError(problems.versionConflict(r.version));
    assertRepresentable(id);
    if (r.deletedAt && input.deleted)
      throw contractError(problems.objectDeleted());
    assertWritable(r);
    const at = now().toISOString();
    const next = {
      ...r,
      version: r.version + 1,
      updatedAt: at,
      deletedAt: input.deleted ? at : null,
    };
    history.capture(r);
    repository.updateLesson(next);
    history.capture(next);
    return read(p, next);
  }
  function purge(p, input, id) {
    const lesson = requireLesson(p, id);
    if (lesson.version !== input.baseVersion)
      throw contractError(problems.versionConflict(lesson.version));
    if (!lesson.deletedAt) throw invalidInput("/id", "invalid-reference");
    exports.remove(p, id);
    repository.purgeLesson(account(p), id);
    return { id, permanentlyDeleted: true };
  }
  function copy(p, input, id) {
    const original = requireLesson(p, id);
    if (original.version !== input.baseVersion)
      throw contractError(problems.versionConflict(original.version));
    assertWritable(original);
    const at = now().toISOString();
    const record = { ...original, id: randomUUID(), version: 1,
      createdAt: at, updatedAt: at, deletedAt: null,
      title: `${Array.from(original.title).slice(0, 196).join("")}（副本）` };
    const originalSections = repository.listSections(id);
    const sections = originalSections.map(section => ({
      ...section, sectionId: randomUUID(),
    }));
    const sectionIds = new Map(originalSections
      .map((section, index) => [section.sectionId, sections[index].sectionId]));
    // Reuse adopted snapshots, including archived/removed sources. Copying must
    // never silently upgrade the source version or trust a client snapshot.
    const references = repository.listReferences(id).map(reference => ({
      ...reference, referenceId: randomUUID(),
      sectionId: sectionIds.get(reference.sectionId) ?? null,
    }));
    repository.insertLesson(record);
    repository.replaceContent(record.id, sections, references);
    history.capture(record);
    return read(p, record);
  }
  function editable(p, input, id) {
    const record = requireLesson(p, id);
    if (record.version !== input.baseVersion) throw contractError(problems.versionConflict(record.version));
    if (record.deletedAt) throw contractError(problems.objectDeleted());
    assertWritable(record);
    return record;
  }
  function restoreVersion(p, input, id) {
    const current = editable(p, input, id);
    const saved = history.get(p, id, input.version);
    const document = read(p, saved.record, saved);
    if (lessonDocuments(document).some(([, value]) => !supportedDocument(value)))
      throw invalidInput("/version", "unsupported-content-version");
    history.capture(current);
    const record = { ...current, title: saved.record.title, intro: saved.record.intro,
      version: current.version + 1, updatedAt: now().toISOString() };
    repository.replaceContent(id, saved.sections, saved.references);
    repository.updateLesson(record);
    history.capture(record);
    return read(p, record);
  }
  function copySections(p, input, id) {
    const current = editable(p, input, id);
    const source = requireLesson(p, input.sourceLessonId);
    if (source.version !== input.sourceVersion) throw fail(409, "version-conflict", { currentVersion: source.version });
    assertWritable(source);
    const originals = repository.listSections(source.id);
    const selected = input.sectionIds.map(id => originals.find(s => s.sectionId === id));
    const sections = repository.listSections(id), references = repository.listReferences(id);
    if (selected.some(s => !s) || new Set(input.sectionIds).size !== input.sectionIds.length)
      throw invalidInput("/sectionIds", "invalid-reference");
    const copiedReferences = repository.listReferences(source.id);
    for (const section of selected) {
      const sectionId = randomUUID();
      sections.push({ ...section, accountKey: current.accountKey, sectionId, position: sections.length });
      references.push(...copiedReferences.filter(r => r.sectionId === section.sectionId)
        .map(r => ({ ...r, accountKey: current.accountKey, sectionId, referenceId: randomUUID() })));
    }
    if (sections.length > 200 || references.length > 1000) throw invalidInput("/sectionIds", "out-of-range");
    history.capture(current);
    const record = { ...current, version: current.version + 1, updatedAt: now().toISOString() };
    repository.replaceContent(id, sections, references);
    repository.updateLesson(record);
    history.capture(record);
    return read(p, record);
  }
  function adoptPage(p, input, id) {
    const current = editable(p, input, id);
    const resource = source(p, "resource", input.resourceId);
    if (resource.version !== input.resourceVersion || resource.deletedAt !== null)
      throw fail(409, "materials/reference-version-conflict", {
        kind: "resource", id: resource.id, currentVersion: resource.version,
      });
    if (![resource.snapshot.fileId, resource.snapshot.supplementPreviewFileId].includes(input.fileId))
      throw invalidInput("/fileId", "invalid-reference");
    if (!recognition?.readResult) throw fail(503, "temporarily-unavailable");
    // This port only reads an immutable, completed result inside the mutation.
    // Recognition and crop generation always happen before adoption.
    const binding = { fileId: input.fileId, renditionFileId: input.renditionFileId, page: input.page };
    const result = recognition.readResult(p, input.resultId, binding);
    if (result.state !== "ready") throw invalidInput("/resultId", "invalid-reference");
    if (result.resultId !== input.resultId || Object.entries(binding).some(([key, value]) => result.location?.[key] !== value))
      throw invalidInput("/resultId", "invalid-reference");
    if (!input.title.trim()) throw invalidInput("/title", "empty-content");
    if (!input.content.blocks.length) throw invalidInput("/content", "empty-content");
    content.validate(p, result.document);
    content.validate(p, input.content);
    let recognizedImage;
    if (input.recognizedImage) {
      const selected = input.recognizedImage;
      if (!images(result.document).includes(selected.fileId) || !result.assetFileIds.includes(selected.fileId))
        throw invalidInput("/recognizedImage/fileId", "invalid-reference");
      const imageBinding = { fileId: selected.fileId, renditionFileId: selected.renditionFileId, page: 1 };
      const child = recognition.readResult(p, selected.resultId, imageBinding);
      if (child.state !== "ready" || child.resultId !== selected.resultId ||
          Object.entries(imageBinding).some(([key, value]) => child.location?.[key] !== value))
        throw invalidInput("/recognizedImage/resultId", "invalid-reference");
      content.validate(p, child.document);
      for (const fileId of new Set([selected.fileId, selected.renditionFileId, child.imageFileId, child.rawFileId, ...child.assetFileIds]))
        files.read(p, fileId);
      recognizedImage = { ...imageBinding, resultId: child.resultId,
        imageFileId: child.imageFileId, rawFileId: child.rawFileId, assetFileIds: [...child.assetFileIds],
        location: structuredClone(child.location), machineDocument: structuredClone(child.document) };
    }
    const file = files.read(p, input.fileId);
    const retainedFiles = new Set([input.fileId, input.renditionFileId, result.imageFileId, result.rawFileId, ...result.assetFileIds]);
    for (const fileId of retainedFiles) files.read(p, fileId);
    const pageSource = {
      resourceId: resource.id, resourceVersion: resource.version, resourceTitle: resource.snapshot.title,
      ...binding, fileName: file.name, fileSha256: file.sha256, resultId: result.resultId,
      imageFileId: result.imageFileId, rawFileId: result.rawFileId, assetFileIds: [...result.assetFileIds],
      location: structuredClone(result.location), machineDocument: structuredClone(result.document),
      adoptedDocument: structuredClone(input.content),
      ...(recognizedImage ? { recognizedImage } : {}),
    };
    const sections = repository.listSections(id);
    if (sections.length >= 200) throw invalidInput("/sections", "out-of-range");
    sections.push({ lessonId: id, accountKey: account(p), sectionId: randomUUID(),
      position: sections.length, title: input.title.trim(), content: input.content, pageSource });
    history.capture(current);
    const record = { ...current, version: current.version + 1, updatedAt: now().toISOString() };
    repository.replaceContent(id, sections, repository.listReferences(id));
    repository.updateLesson(record);
    history.capture(record);
    return read(p, record);
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
    const rows = repository.listLessonsForAccount(account(p));
    if (order) order.sort(p, rows);
    return {
      items: rows
        .filter((r) => (r.deletedAt !== null) === (query.state === "deleted"))
        .filter((r) =>
          matchesSearch(q, [
            r.title,
            ...text(r.intro.blocks),
            ...repository.listSections(r.id).flatMap((s) => [s.title, ...text(s.content.blocks)]),
            ...repository.listReferences(r.id).flatMap(({ note, snapshot }) => [
              note, snapshot.title ?? "", snapshot.fileName ?? "",
              ...text(snapshot.body?.blocks ?? []),
              ...text(snapshot.solution?.blocks ?? []),
              snapshot.source?.latex ?? "", snapshot.source?.caption ?? "",
            ]),
          ]),
        )
        .map((r) => read(p, r)),
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
  function readHistoryForExport(principal, id) {
    return history.list(principal, id).items.map(({ version, savedAt }) => {
      const saved = history.get(principal, id, version);
      return { ...read(principal, saved.record, saved), savedAt };
    });
  }
  function readForExport(principal) {
    const records = repository.listLessonsForAccount(account(principal));
    return {
      lessons: records.map(record => read(principal, record)),
      revisions: records.flatMap(record => readHistoryForExport(principal, record.id)),
      ...exports.readForExport(principal),
    };
  }
  const operations = {};
  const router = Router();
  order?.mount(router);
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
  if (version === 3) {
    definitions.splice(7);
    definitions.push(["copyLessonSectionsV3", "post", "/items/:id/sections/copy", "CopyLessonSections", 200, copySections]);
    definitions.push(["adoptLessonPageV3", "post", "/items/:id/sections/adopt-page", "AdoptLessonPage", 200, adoptPage]);
    definitions.push(["restoreLessonVersionV3", "post", "/items/:id/history/restore", "RestoreLessonVersion", 200, restoreVersion]);
    definitions.push(["listLessonHistoryV3", "get", "/items/:id/history", null, 200, (p, b, id) => history.list(p, id)]);
    router.get("/:id/history/:revision", (req, res) => {
      validateIdPath(req.params.id);
      validateNoQuery(req.query);
      if (!/^[1-9]\d*$/.test(req.params.revision)) throw invalidInput("/version", "out-of-range");
      const saved = history.get(req.workbenchPrincipal, req.params.id, Number(req.params.revision));
      res.json(read(req.workbenchPrincipal, saved.record, saved));
    });
    definitions.push(["copyLessonV3", "post", "/items/:id/copy", "CopyLesson", 201, copy]);
    definitions.push([
      "purgeLessonV3", "post", "/items/:id/purge", "PurgeLesson", 200, purge,
    ]);
    definitions.unshift(["listUsagesV3", "get", "/usages", null, 200, (p,b,id,q) => listUsages(p,q)]);
  }
  for (const [name, method, oldPath, schema, status, action] of definitions) {
    const path = version === 3 ? oldPath.replace("/items", "") || "/" : oldPath;
    const operationName = version === 3 ? ({createLessonExport: "exportLessonV3", listLessonExports: "listLessonExportsV3", listUsagesV3: "listUsagesV3"}[name] ?? name.replace("V2", "V3")) : name;
    operations[operationName] = ({ principal, key, input, id, query }) => {
      account(principal);
      if (path.includes(":id")) validateIdPath(id);
      if (schema) { validateNoQuery(query ?? {}); validate(schema, input); }
      else if (name === "listUsagesV3") {
        if (Object.keys(query ?? {}).some(k => !["kind", "id"].includes(k)) || !["question", "resource", "math"].includes(query?.kind)) throw invalidInput("/query", "invalid-reference");
        validateIdPath(query?.id);
      }
      else if (name === "listLessonsV2") validateLessonsQuery(query ?? {});
      else validateNoQuery(query ?? {});
      const run = () => ({ status, body: action(principal, input, id, query) });
      return schema
        ? mutations.execute(
            {
              principal,
              key,
              method: method.toUpperCase(),
              path: `/api/modules/lessons/v${version}${path === "/" ? "" : path.replace(":id", id)}`,
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
            return validate(schema, b);
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
          const result = await operations[operationName]({
            principal: req.workbenchPrincipal,
            id: req.params.id,
            query: req.query,
          });
          res.status(result.status).json(result.body);
        }),
      );
  }
  router.use((error, req, res, next) => error.problem?.type?.startsWith("/problems/math/") ? sendProblem(res,error.status,error.problem) : next(error));
  materialErrors(router);
  return {
    router,
    port: {
      operations,
      listUsages,
      readHistoryForExport,
      readForExport,
    },
    jobHandlers: { export: exports.handler },
    get,
    requireLesson,
  };
}
