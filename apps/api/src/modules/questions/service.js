// Business operations for the question bank. These functions are also the
// callable surface future agent adapters consume; they never touch the HTTP
// layer and always run inside the caller's mutation transaction.
import { randomUUID } from "node:crypto";
import {
  compareByUpdatedDescThenId,
  flattenDocumentText,
  matchesSearch,
  normalizeSearchQuery,
  notFound,
  objectDeleted,
  versionConflict,
  invalidInput,
} from "./contract.js";
import {
  validateCreateQuestion,
  validateCopyQuestion,
  validateSetDeletion,
  validateUpdateQuestion,
} from "./schema.js";

export function createQuestionsService({ repository, now = () => new Date(), hasMaterialMetadata = () => false }) {
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

  function requireOwned(principal, questionId) {
    const record = repository.getForAccount(
      requireAccountKey(principal),
      questionId,
    );
    if (!record) throw notFound();
    return record;
  }

  function assertLegacy(record) {
    if (
      hasMaterialMetadata(record.id) ||
      record.body.version !== 1 ||
      record.solution.version !== 1 ||
      record.source.kind === "import" ||
      (record.source.kind === "copy" &&
        (record.source.snapshot.body.version !== 1 ||
          record.source.snapshot.solution.version !== 1))
    )
      throw invalidInput("/body/version", "unsupported-content-version");
  }

  function toQuestion(record) {
    assertLegacy(record);
    return {
      id: record.id,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      title: record.title,
      body: record.body,
      solution: record.solution,
      note: record.note,
      starred: record.starred,
      source: record.source,
    };
  }

  function toSummary(record) {
    assertLegacy(record);
    return {
      id: record.id,
      version: record.version,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      title: record.title,
      body: record.body,
      starred: record.starred,
    };
  }

  function snapshotOf(record) {
    assertLegacy(record);
    return {
      title: record.title,
      body: record.body,
      solution: record.solution,
    };
  }

  function listQuestions(principal, query = {}) {
    const accountKey = requireAccountKey(principal);
    const search = normalizeSearchQuery(query.q);
    const wantDeleted = query.state === "deleted";
    const wantStarred =
      query.starred === undefined
        ? null
        : query.starred === "true" || query.starred === true;

    return {
      items: repository
        .listForAccount(accountKey)
        .filter((record) => (record.deletedAt !== null) === wantDeleted)
        .filter(
          (record) => wantStarred === null || record.starred === wantStarred,
        )
        .filter((record) =>
          matchesSearch(search, [
            record.title,
            record.body.version === 1
              ? flattenDocumentText(record.body)
              : JSON.stringify(record.body),
            record.note,
          ]),
        )
        .sort(compareByUpdatedDescThenId)
        .map(toSummary),
    };
  }

  function getQuestion(principal, questionId) {
    return toQuestion(requireOwned(principal, questionId));
  }

  function createQuestion(principal, input) {
    const accountKey = requireAccountKey(principal);
    const body = validateCreateQuestion(input);
    const at = timestamp();
    const record = {
      id: randomUUID(),
      accountKey,
      version: 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      title: body.title,
      body: body.body,
      solution: body.solution,
      note: body.note,
      starred: body.starred,
      source: body.source,
      sourceQuestionId: null,
    };
    repository.insert(record);
    return toQuestion(record);
  }

  function updateQuestion(principal, questionId, input) {
    requireAccountKey(principal);
    const body = validateUpdateQuestion(input);
    const current = requireOwned(principal, questionId);
    if (current.deletedAt !== null) throw objectDeleted();
    if (body.baseVersion !== current.version)
      throw versionConflict(current.version);
    assertLegacy(current);
    const next = {
      ...current,
      version: current.version + 1,
      updatedAt: timestamp(),
      title: body.title,
      body: body.body,
      solution: body.solution,
      note: body.note,
      starred: body.starred,
    };
    repository.update(next);
    return toQuestion(next);
  }

  function copyQuestion(principal, questionId, input) {
    const accountKey = requireAccountKey(principal);
    const body = validateCopyQuestion(input);
    const source = requireOwned(principal, questionId);
    if (source.deletedAt !== null) throw objectDeleted();
    if (body.baseVersion !== source.version)
      throw versionConflict(source.version);
    const at = timestamp();
    const record = {
      id: randomUUID(),
      accountKey,
      version: 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      title: body.title,
      body: body.body,
      solution: body.solution,
      note: body.note,
      starred: body.starred,
      source: {
        kind: "copy",
        questionId: source.id,
        questionVersion: source.version,
        snapshot: snapshotOf(source),
      },
      sourceQuestionId: source.id,
    };
    repository.insert(record);
    return toQuestion(record);
  }

  function listDerivatives(principal, questionId, query = {}) {
    const accountKey = requireAccountKey(principal);
    requireOwned(principal, questionId);
    const wantDeleted = query.state === "deleted";
    return {
      items: repository
        .listDerivativesOf(accountKey, questionId)
        .filter((record) => (record.deletedAt !== null) === wantDeleted)
        .map(toSummary),
    };
  }

  function setQuestionDeletion(principal, questionId, input) {
    requireAccountKey(principal);
    const body = validateSetDeletion(input);
    const current = requireOwned(principal, questionId);
    if (body.baseVersion !== current.version)
      throw versionConflict(current.version);
    // Deleting an already-deleted object is the 409 object-deleted case. Restoring
    // an active object is not: the object is not deleted, so it is a same-content
    // write and bumps the version like any other new request (workbench.md).
    if (body.deleted && current.deletedAt !== null) throw objectDeleted();
    const at = timestamp();
    assertLegacy(current);
    const next = {
      ...current,
      version: current.version + 1,
      updatedAt: at,
      deletedAt: body.deleted ? at : null,
    };
    repository.update(next);
    return toQuestion(next);
  }

  return {
    listQuestions,
    getQuestion,
    createQuestion,
    updateQuestion,
    copyQuestion,
    listDerivatives,
    setQuestionDeletion,
  };
}
