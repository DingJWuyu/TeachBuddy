import { casefold } from "./casefold.js";
import { questionDocuments, supportedDocument } from "@refatos/shared";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  invalidInput,
  objectDeleted,
  compareByUpdatedDescThenId,
} from "./contract.js";
import { materialsError } from "../../workbench/jobs/index.js";
import { validateLocation } from "../../workbench/content/index.js";
import {
  validateQuestionContent,
  validateTaxonomyIds,
  documentText,
  images,
  walkBlocks,
} from "./materials-content.js";
const busy = new Set(["queued", "running", "cancelling"]);
export function createMaterialsService({ store: s, files, content, jobs }) {
  const assertWritable = (question) => {
    const unsupported = questionDocuments(question).find(([, document]) => !supportedDocument(document));
    if (unsupported) throw invalidInput(`${unsupported[0]}/version`, "unsupported-content-version");
  };
  const snapshot = (q) => ({
    title: q.title,
    body: q.body,
    solution: q.solution,
    answerStatus: q.answerStatus,
  });
  const filtered = (rows, q) =>
    rows
      .filter((x) => Boolean(x.deletedAt) === (q.state === "deleted"))
      .filter(
        (x) =>
          !q.q ||
          [x.title, x.note ?? "", x.body ? documentText(x.body) : "",
            (q.searchAnswers === true || q.searchAnswers === "true") && x.solution ? documentText(x.solution) : ""]
            .join("\n")
            .toLowerCase()
            .includes(q.q.trim().toLowerCase()),
      )
      .sort(compareByUpdatedDescThenId);
  const editable = (p, m, base) => {
    s.check(m, base);
    if (busy.has(jobs.get(p, m.jobId).state))
      throw materialsError("import-not-editable", 409);
  };
  function checkPurge(p, item, baseVersion, kind) {
    s.check(item, baseVersion, false);
    if (!item.deletedAt) throw materialsError('archive-required', 409);
    if (jobs.list(p).items.some(job => job.target.kind === kind && job.target.id === item.id && busy.has(job.state)))
      throw materialsError('processing-in-progress', 409);
  }
  function locations(p, m, parts) {
    const originals = [...(m.input.fileIds ?? []), ...m.supplementFileIds];
    const task = s.get("tasks", p, m.jobId);
    for (const part of parts)
      for (const l of part.locations) {
        try {
          validateLocation(files, p, l, {
            text: m.input.text,
            originals,
            renditions: task.renditions ?? [],
            paragraphs: task.paragraphs?.[l.fileId] ?? [],
            nativeWordSource: task.nativeWordSources?.[l.fileId],
          });
        } catch (e) {
          if (e.status === 404) throw e;
          throw materialsError("invalid-location", 422, "/parts", e.message);
        }
      }
  }
  function validate(p, q, options) {
    validateTaxonomyIds(s.taxonomy(p), q);
    validateQuestionContent(content, p, q, options);
  }
  function accept(p, m, units = null) {
    const job = jobs.enqueue(
      {
        principal: p,
        kind: "extraction",
        target: { kind: "import", id: m.id, version: m.version },
      },
      {},
    );
    let previous = {};
    if (m.jobId) previous = s.get("tasks", p, m.jobId);
    s.save("tasks", p, {
      ...previous,
      id: job.id,
      importId: m.id,
      units,
      completed: previous.completed ?? [],
      renditions: previous.renditions ?? [],
      paragraphs: previous.paragraphs ?? {},
    });
    m.jobId = job.id;
    return s.save("imports", p, m);
  }
  const service = {
    getQuestionTaxonomy: ({ principal: p }) => s.taxonomy(p),
    updateQuestionTaxonomy({ principal: p, input }) {
      const old = s.taxonomy(p);
      s.check(old, input.baseVersion, false);
      const ids = new Set();
      for (const key of ["types", "tags"]) {
        const names = new Set();
        for (const term of input[key]) {
          term.name = term.name.trim();
          const folded = casefold(term.name);
          if (!folded || names.has(folded) || ids.has(term.id))
            throw materialsError("invalid-taxonomy", 422, "/" + key);
          names.add(folded);
          ids.add(term.id);
        }
      }
      const next = {
        version: old.version + 1,
        types: input.types,
        tags: input.tags,
      };
      for (const q of s.questions(p)) {
        const typeId = next.types.some((t) => t.id === q.typeId)
          ? q.typeId
          : null;
        const tagIds = q.tagIds.filter((id) =>
          next.tags.some((t) => t.id === id),
        );
        if (typeId !== q.typeId || tagIds.length !== q.tagIds.length) {
          assertWritable(q);
          s.writeQuestion(p, { ...s.bump(q), typeId, tagIds });
        }
      }
      return s.saveTaxonomy(p, next);
    },
    listQuestionsV2: ({ principal: p, query: q = {} }) => ({
      items: filtered(s.questions(p), q).filter(
        (x) =>
          (!q.typeId || x.typeId === q.typeId) &&
          (!q.tagIds || q.tagIds.every((id) => x.tagIds.includes(id))) &&
          (q.starred === undefined ||
            x.starred === (q.starred === true || q.starred === "true")),
      ),
    }),
    getQuestionV2: ({ principal: p, id }) => s.question(p, id),
    createQuestionV2({ principal: p, input }) {
      validate(p, input);
      return s.writeQuestion(p, { ...s.fresh(), ...input });
    },
    updateQuestionV2({ principal: p, id, input }) {
      const q = s.question(p, id);
      s.check(q, input.baseVersion);
      assertWritable(q);
      validate(p, input);
      const { baseVersion, ...fields } = input;
      return s.writeQuestion(p, { ...s.bump(q), ...fields });
    },
    copyQuestionV2({ principal: p, id, input }) {
      const q = s.question(p, id);
      s.check(q, input.baseVersion);
      assertWritable(q);
      validate(p, input);
      const { baseVersion, ...fields } = input;
      return s.writeQuestion(p, {
        ...s.fresh(),
        ...fields,
        source: {
          kind: "copy",
          questionId: q.id,
          questionVersion: q.version,
          snapshot: snapshot(q),
        },
      });
    },
    listQuestionCopiesV2: ({ principal: p, id }) => {
      s.question(p, id);
      return {
        items: s
          .questions(p)
          .filter(
            (x) =>
              x.source.kind === "copy" &&
              x.source.questionId === id &&
              !x.deletedAt,
          )
          .sort(compareByUpdatedDescThenId),
      };
    },
    readQuestionForReferenceV2: ({ principal: p, id }) => {
      const q = s.question(p, id);
      return {
        id: q.id,
        version: q.version,
        deletedAt: q.deletedAt,
        snapshot: snapshot(q),
      };
    },
    setQuestionDeletionV2({ principal: p, id, input }) {
      const q = s.question(p, id);
      s.check(q, input.baseVersion, false);
      if (input.deleted && q.deletedAt) throw objectDeleted();
      assertWritable(q);
      return s.writeQuestion(p, {
        ...s.bump(q),
        deletedAt: input.deleted ? s.stamp() : null,
      });
    },
    purgeQuestionV2({ principal: p, id, input }) {
      checkPurge(p, s.question(p, id), input.baseVersion, 'question');
      s.purgeQuestion(p, id);
      return { id, permanentlyDeleted: true };
    },
    relocateQuestion({ principal: p, id, input }) {
      const q = s.question(p, id);
      s.check(q, input.baseVersion);
      assertWritable(q);
      if (q.source.kind !== "import")
        throw invalidInput("/source", "out-of-range");
      locations(p, s.get("imports", p, q.source.importId), input.parts);
      return s.writeQuestion(p, {
        ...s.bump(q),
        source: { ...q.source, parts: input.parts },
      });
    },
    createImport({ principal: p, input }) {
      if (!input.title.trim()) throw invalidInput("/title", "empty-content");
      if (input.input.kind === "files") {
        const original = input.input;
        const rows = original.fileIds.map((id) => files.read(p, id));
        const image = rows.every((f) =>
          ["image/png", "image/jpeg", "image/webp"].includes(f.mediaType),
        );
        if (
          !image &&
          (rows.length !== 1 ||
            ![
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ].includes(rows[0].mediaType))
        )
          throw invalidInput("/input/fileIds", "out-of-range");
        if (
          new Set(original.fileIds).size !== original.fileIds.length ||
          new Set(original.pages.map((x) => x.fileId)).size !==
            original.pages.length ||
          original.pages.some(
            (x) =>
              !original.fileIds.includes(x.fileId) ||
              new Set(x.pages).size !== x.pages.length,
          )
        )
          throw invalidInput("/input/pages", "out-of-range");
      }
      return accept(p, {
        ...s.fresh(),
        ...input,
        supplementFileIds: [],
        drafts: [],
        fragments: [],
      });
    },
    getImport: ({ principal: p, id }) => {
      const material = s.get("imports", p, id);
      const task = s.get("tasks", p, material.jobId);
      if (!Object.keys(task.originalDocuments ?? {}).length) return material;
      return {...material, originalDocuments: Object.entries(task.originalDocuments ?? {})
        .map(([fileId, paragraphs]) => ({fileId, paragraphs}))};
    },
    listImports: ({ principal: p, query = {} }) => ({
      items: filtered(s.list("imports", p), query),
    }),
    saveImportReview({ principal: p, id, input }) {
      const m = s.get("imports", p, id);
      editable(p, m, input.baseVersion);
      const seen = new Set();
      const otherDraftIds = new Set(
        s
          .list("imports", p)
          .filter((x) => x.id !== id)
          .flatMap((x) => x.drafts.map((d) => d.id)),
      );
      for (const d of input.drafts) {
        if (seen.has(d.id) || otherDraftIds.has(d.id))
          throw invalidInput("/drafts", "out-of-range");
        seen.add(d.id);
        const prior = m.drafts.find((x) => x.id === d.id);
        if (prior?.disposition === "confirmed") {
          if (!isDeepStrictEqual(prior, d))
            throw invalidInput("/drafts", "out-of-range");
          continue;
        }
        if (d.disposition === "confirmed" || d.questionId !== null)
          throw invalidInput("/drafts", "out-of-range");
        validate(p, d, { draft: true });
        locations(p, m, d.parts);
        for (const issue of d.issues)
          if (issue.locations.length)
            locations(p, m, [{ locations: issue.locations }]);
      }
      if (
        m.drafts.some((d) => d.disposition === "confirmed" && !seen.has(d.id))
      )
        throw invalidInput("/drafts", "out-of-range");
      const fragmentIds = new Set();
      for (const f of input.fragments) {
        if (fragmentIds.has(f.id))
          throw invalidInput("/fragments", "out-of-range");
        fragmentIds.add(f.id);
        locations(p, m, [f]);
        if (f.document) content.validate(p, f.document);
      }
      return s.save("imports", p, {
        ...s.bump(m),
        drafts: input.drafts,
        fragments: input.fragments,
      });
    },
    commitImportDrafts({ principal: p, id, input }) {
      const m = s.get("imports", p, id);
      editable(p, m, input.baseVersion);
      if (new Set(input.draftIds).size !== input.draftIds.length)
        throw invalidInput("/draftIds", "out-of-range");
      const selected = input.draftIds.map((id) => {
        const d = m.drafts.find((x) => x.id === id);
        if (!d) throw invalidInput("/draftIds", "out-of-range");
        return d;
      });
      for (const d of selected) {
        if (d.disposition === "confirmed") continue;
        if (
          d.disposition !== "pending" ||
          d.answerStatus === "unresolved" ||
          d.issues.some(
            (i) =>
              i.resolution === "open" ||
              ([
                "uncertain-formula",
                "missing-figure",
                "incomplete-answer",
                "unverified-location",
              ].includes(i.code) &&
                i.resolution !== "corrected"),
          )
        )
          throw materialsError("draft-not-ready", 409, "/draftIds");
        if (
          d.issues.some((i) => i.code === "missing-figure") &&
          !images(d.body).length
        )
          throw materialsError("draft-not-ready", 409, "/body");
        let formula = false;
        walkBlocks(d.body.blocks, (b) => {
          if (b.latex || b.runs?.some((r) => r.type === "math")) formula = true;
        });
        if (d.issues.some((i) => i.code === "uncertain-formula") && !formula)
          throw materialsError("draft-not-ready", 409, "/body");
        validate(p, d);
        locations(p, m, d.parts);
      }
      let changed = false;
      const questions = selected.map((d) => {
        if (d.questionId) return s.question(p, d.questionId);
        changed = true;
        const {
          id: draftId,
          parts,
          issues,
          disposition,
          questionId,
          ...fields
        } = d;
        const q = s.writeQuestion(p, {
          ...s.fresh(),
          ...fields,
          note: "",
          starred: false,
          source: { kind: "import", importId: id, draftId, parts },
        });
        d.disposition = "confirmed";
        d.questionId = q.id;
        return q;
      });
      return {
        import: changed ? s.save("imports", p, s.bump(m)) : m,
        questions,
      };
    },
    supplementImport({ principal: p, id, input }) {
      const m = s.get("imports", p, id);
      editable(p, m, input.baseVersion);
      if (
        new Set(input.fileIds).size !== input.fileIds.length ||
        m.supplementFileIds.length + input.fileIds.length > 100
      )
        throw invalidInput("/fileIds", "out-of-range");
      for (const f of input.fileIds) {
        const file = files.read(p, f);
        if (
          !["image/png", "image/jpeg", "image/webp"].includes(file.mediaType) ||
          [...(m.input.fileIds ?? []), ...m.supplementFileIds].includes(f)
        )
          throw invalidInput("/fileIds", "out-of-range");
      }
      return accept(
        p,
        {
          ...s.bump(m),
          supplementFileIds: [...m.supplementFileIds, ...input.fileIds],
        },
        input.fileIds.map((id) => "file:" + id),
      );
    },
    setImportDeletion({ principal: p, id, input }) {
      const m = s.get("imports", p, id);
      s.check(m, input.baseVersion, false);
      if (input.deleted && m.deletedAt) throw objectDeleted();
      return s.save("imports", p, {
        ...s.bump(m),
        deletedAt: input.deleted ? s.stamp() : null,
      });
    },
    purgeQuestionImport({ principal: p, id, input }) {
      checkPurge(p, s.get('imports', p, id), input.baseVersion, 'import');
      s.purgeImport(p, id);
      return { id, permanentlyDeleted: true };
    },
    createQuestionAsset({ principal: p, id, input }) {
      const q = s.question(p, id);
      s.check(q, input.baseVersion);
      if (
        input.mode === "figure-png"
          ? !images(q.body)
              .concat(input.includeAnswers ? images(q.solution) : [])
              .includes(input.figureFileId)
          : input.figureFileId !== null
      )
        throw invalidInput("/figureFileId", "out-of-range");
      const job = jobs.enqueue(
        {
          principal: p,
          kind: "question-asset",
          target: { kind: "question", id, version: q.version },
        },
        {},
      );
      s.save("tasks", p, {
        id: job.id,
        question: q,
        options: input,
        outputFileIds: [],
      });
      return job;
    },
  };
  return { service, locations, accept };
}
