// Business operations for lesson preparation. The lesson is one versioned
// aggregate: title, intro, sections, references and materials commit or fail
// together. Reference snapshots always come from the questions port inside the
// caller's transaction; a client can never submit its own snapshot.
import { randomUUID } from "node:crypto";
import {
  compareByUpdatedDescThenId,
  flattenDocumentText,
  invalidInput,
  matchesSearch,
  normalizeSearchQuery,
  notFound,
  objectDeleted,
  referenceVersionConflict,
  versionConflict,
} from "../questions/contract.js";
import {
  validateCreateLesson,
  validateSetDeletion,
  validateUpdateLesson,
} from "../questions/schema.js";

export function createLessonsService({
  repository,
  questions,
  now = () => new Date(),
}) {
  function timestamp() {
    return now().toISOString();
  }

  function requireAccountKey(principal) {
    if (
      !principal ||
      typeof principal.accountKey !== "string" ||
      principal.accountKey.length === 0
    ) {
      throw new TypeError("A verified workbench principal is required.");
    }
    return principal.accountKey;
  }

  function requireLesson(principal, lessonId, { allowDeleted = true } = {}) {
    const record = repository.getLessonForAccount(
      requireAccountKey(principal),
      lessonId,
    );
    if (!record) throw notFound();
    if (!allowDeleted && record.deletedAt !== null) throw objectDeleted();
    return record;
  }

  function toSummary(record) {
    return {
      id: record.id,
      version: record.version,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      title: record.title,
    };
  }

  function toReference(principal, row) {
    let sourceState = "deleted";
    let latestVersion = row.questionVersion;
    try {
      const source = questions.readForReference(principal, row.questionId);
      sourceState = source.deletedAt === null ? "active" : "deleted";
      latestVersion = source.version;
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
    return {
      id: row.referenceId,
      questionId: row.questionId,
      questionVersion: row.questionVersion,
      note: row.note,
      snapshot: row.snapshot,
      sourceState,
      latestVersion,
    };
  }

  function assertLegacy(record) {
    const documents = [
      record.intro,
      ...repository.listSections(record.id).map((s) => s.content),
    ];
    for (const reference of repository.listReferences(record.id)) {
      if (reference.kind === "resource" || reference.kind === "math")
        throw invalidInput("/materials", "unsupported-content-version");
      documents.push(reference.snapshot.body, reference.snapshot.solution);
    }
    if (documents.some((document) => document?.version !== 1))
      throw invalidInput("/intro/version", "unsupported-content-version");
  }

  function readLesson(principal, record) {
    assertLegacy(record);
    const referencesBySection = new Map();
    for (const reference of repository.listReferences(record.id)) {
      const key = reference.sectionId ?? null;
      if (!referencesBySection.has(key)) referencesBySection.set(key, []);
      referencesBySection.get(key).push(reference);
    }
    return {
      id: record.id,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      title: record.title,
      intro: record.intro,
      sections: repository.listSections(record.id).map((section) => ({
        id: section.sectionId,
        title: section.title,
        content: section.content,
        references: (referencesBySection.get(section.sectionId) ?? []).map(
          (reference) => toReference(principal, reference),
        ),
      })),
      materials: (referencesBySection.get(null) ?? []).map((reference) =>
        toReference(principal, reference),
      ),
    };
  }

  function resolveReference(principal, input, storedReferences, placement) {
    const stored = storedReferences.get(input.id);
    if (stored && stored.questionId !== input.questionId) {
      throw invalidInput(
        `${placement.pointer}/questionId`,
        "invalid-reference",
      );
    }
    if (stored && stored.questionVersion === input.questionVersion) {
      return {
        ...placement,
        referenceId: input.id,
        questionId: input.questionId,
        questionVersion: input.questionVersion,
        note: input.note,
        snapshot: stored.snapshot,
      };
    }
    const source = questions.readForReference(principal, input.questionId);
    if (source.deletedAt !== null) throw objectDeleted();
    if (source.version !== input.questionVersion) {
      throw referenceVersionConflict(input.questionId, source.version);
    }
    return {
      ...placement,
      referenceId: input.id,
      questionId: input.questionId,
      questionVersion: input.questionVersion,
      note: input.note,
      snapshot: source.snapshot,
    };
  }

  function persistContent(principal, lessonId, accountKey, input) {
    const storedReferences = new Map(
      repository
        .listReferences(lessonId)
        .map((reference) => [reference.referenceId, reference]),
    );
    const sections = input.sections.map((section, index) => ({
      lessonId,
      accountKey,
      sectionId: section.id,
      position: index,
      title: section.title,
      content: section.content,
    }));
    const references = [];
    input.sections.forEach((section, sectionIndex) => {
      section.references.forEach((reference, referenceIndex) => {
        references.push(
          resolveReference(principal, reference, storedReferences, {
            lessonId,
            accountKey,
            sectionId: section.id,
            position: referenceIndex,
            pointer: `/sections/${sectionIndex}/references/${referenceIndex}`,
          }),
        );
      });
    });
    input.materials.forEach((reference, materialIndex) => {
      references.push(
        resolveReference(principal, reference, storedReferences, {
          lessonId,
          accountKey,
          sectionId: null,
          position: materialIndex,
          pointer: `/materials/${materialIndex}`,
        }),
      );
    });
    repository.replaceContent(lessonId, sections, references);
  }

  function listLessons(principal, query = {}) {
    const accountKey = requireAccountKey(principal);
    const search = normalizeSearchQuery(query.q);
    const wantDeleted = query.state === "deleted";
    const items = [];
    for (const record of repository.listLessonsForAccount(accountKey)) {
      if ((record.deletedAt !== null) !== wantDeleted) continue;
      const parts = [record.title, flattenDocumentText(record.intro)];
      for (const section of repository.listSections(record.id)) {
        parts.push(flattenDocumentText(section.content));
      }
      if (!matchesSearch(search, parts)) continue;
      assertLegacy(record);
      items.push(toSummary(record));
    }
    return { items: items.sort(compareByUpdatedDescThenId) };
  }

  function getLesson(principal, lessonId) {
    return readLesson(principal, requireLesson(principal, lessonId));
  }

  function createLesson(principal, input) {
    const accountKey = requireAccountKey(principal);
    const body = validateCreateLesson(input);
    const at = timestamp();
    const record = {
      id: randomUUID(),
      accountKey,
      version: 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      title: body.title,
      intro: body.intro,
    };
    repository.insertLesson(record);
    persistContent(principal, record.id, accountKey, body);
    return readLesson(principal, record);
  }

  function updateLesson(principal, lessonId, input) {
    requireAccountKey(principal);
    const body = validateUpdateLesson(input);
    const current = requireLesson(principal, lessonId, { allowDeleted: false });
    if (body.baseVersion !== current.version)
      throw versionConflict(current.version);
    assertLegacy(current);
    const next = {
      ...current,
      version: current.version + 1,
      updatedAt: timestamp(),
      title: body.title,
      intro: body.intro,
    };
    repository.updateLesson(next);
    persistContent(principal, lessonId, current.accountKey, body);
    return readLesson(principal, next);
  }

  function setLessonDeletion(principal, lessonId, input) {
    requireAccountKey(principal);
    const body = validateSetDeletion(input);
    const current = requireLesson(principal, lessonId);
    if (body.baseVersion !== current.version)
      throw versionConflict(current.version);
    assertLegacy(current);
    // See questions/setQuestionDeletion: only a repeat delete is object-deleted;
    // restoring an active lesson is a same-content write that bumps the version.
    if (body.deleted && current.deletedAt !== null) throw objectDeleted();
    const at = timestamp();
    const next = {
      ...current,
      version: current.version + 1,
      updatedAt: at,
      deletedAt: body.deleted ? at : null,
    };
    repository.updateLesson(next);
    return readLesson(principal, next);
  }

  function listQuestionUsages(principal, questionId) {
    const accountKey = requireAccountKey(principal);
    questions.readForReference(principal, questionId);
    return {
      items: repository.listActiveUsages(accountKey, questionId).map((row) => ({
        lessonId: row.lessonId,
        lessonTitle: row.lessonTitle,
        sectionId: row.sectionId ?? null,
        sectionTitle: row.sectionTitle ?? null,
        referenceId: row.referenceId,
        questionVersion: row.questionVersion,
      })),
    };
  }

  return {
    listLessons,
    getLesson,
    createLesson,
    updateLesson,
    setLessonDeletion,
    listQuestionUsages,
  };
}
