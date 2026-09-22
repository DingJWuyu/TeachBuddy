// Business operations for classes, actual records and their material links.
//
// These functions are also the callable surface schedule and the reverse
// feedback panels consume; they never touch HTTP and always run inside the
// caller's mutation transaction. Source reads go through the injected public
// ports only: this module never reads another module's storage.
import { randomUUID } from 'node:crypto';
import {
  classMismatch,
  invalidInput,
  notFound,
  objectDeleted,
  recordLabel,
  referenceDeleted,
  sourceDisplayTitle,
  sourceRawTitle,
  versionConflict
} from './contract.js';
import {
  validateCreateClass,
  validateCreateRecord,
  validateCreateRecordV2,
  validateUpdateRecordV2,
  validateDeletion,
  validateSourceRecordsPath,
  validateUpdateClass,
  validateUpdateRecord
} from './schema.js';

export function createClassesService({ repository, questions, lessons, math, now = () => new Date() }) {
  const sourceReaders = {
    question: (principal, id) => questions.readForReferenceV2(principal, id),
    lesson: (principal, id) => lessons.readForTeachingLink(principal, id),
    math: (principal, id) => math.readForTeachingLinkV1(principal, id)
  };

  function timestamp() {
    return now().toISOString();
  }

  function requireAccountKey(principal) {
    if (!principal || typeof principal.accountKey !== 'string' || principal.accountKey.length === 0) {
      throw new TypeError('A verified workbench principal is required.');
    }
    return principal.accountKey;
  }

  function requireClass(principal, classId, { allowDeleted = true } = {}) {
    const record = repository.getClassForAccount(requireAccountKey(principal), classId);
    if (!record) throw notFound();
    if (!allowDeleted && record.deletedAt !== null) throw objectDeleted();
    return record;
  }

  function requireRecord(principal, recordId) {
    const record = repository.getRecordForAccount(requireAccountKey(principal), recordId);
    if (!record) throw notFound();
    return record;
  }

  function toClass(record) {
    return {
      id: record.id,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      name: record.name
    };
  }

  // ------------------------------------------------------------ source links

  /**
   * Read one source through its public port. A missing or foreign source is the
   * provider's 404 and stays a 404 here; any other provider failure propagates,
   * so a temporary read failure is never reported as "deleted".
   */
  function readSource(principal, kind, id) {
    const reference = sourceReaders[kind](principal, id);
    if (!reference || typeof reference.deletedAt === 'undefined' || typeof reference.version !== 'number') {
      throw notFound();
    }
    return reference;
  }

  /** Resolve a link that is being added: the source must exist and be active. */
  function resolveNewLink(principal, source) {
    const reference = readSource(principal, source.kind, source.id);
    if (reference.deletedAt !== null) throw referenceDeleted();
    // labelAtLink is the server-read title at linking time, so it stores the
    // raw title (possibly empty) and never the display fallback.
    return { kind: source.kind, id: source.id, labelAtLink: sourceRawTitle(source.kind, reference) };
  }

  /**
   * Build the stored link list for a write. An unchanged kind+id keeps its
   * saved labelAtLink; removing and re-adding later resolves the title again.
   */
  function resolveLinks(principal, inputs, existingByKey) {
    return inputs.map((source) => {
      const stored = existingByKey.get(`${source.kind}:${source.id}`);
      if (stored) return { kind: source.kind, id: source.id, labelAtLink: stored.labelAtLink };
      return resolveNewLink(principal, source);
    });
  }

  /** Project one stored link against the current source. */
  function toSource(principal, stored) {
    const reference = readSource(principal, stored.kind, stored.sourceId);
    return {
      kind: stored.kind,
      id: stored.sourceId,
      labelAtLink: stored.labelAtLink,
      currentLabel: sourceDisplayTitle(stored.kind, reference),
      deleted: reference.deletedAt !== null
    };
  }

  function assertRepresentable(record, version, field = '/sources') {
    if (version === 1 && repository.listSources(record.id).some(source => source.kind === 'math')) {
      throw invalidInput(field, 'unsupported-content-version');
    }
  }

  function projectRecords(principal, records, version) {
    records.forEach(record => assertRepresentable(record, version, '/items'));
    return { items: records.map(record => toRecord(principal, record)) };
  }

  function toRecord(principal, record) {
    return {
      id: record.id,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
      classId: record.classId,
      recordedOn: record.recordedOn,
      note: record.note,
      position: record.position,
      unfinished: record.unfinished,
      commonIssues: record.commonIssues,
      nextNote: record.nextNote,
      sources: repository.listSources(record.id).map((stored) => toSource(principal, stored))
    };
  }

  // ------------------------------------------------------------------ classes

  function listClasses(principal, { state = 'active' } = {}) {
    const accountKey = requireAccountKey(principal);
    const wantDeleted = state === 'deleted';
    return {
      items: repository
        .listClassesForAccount(accountKey)
        .filter((record) => (record.deletedAt !== null) === wantDeleted)
        .map(toClass)
    };
  }

  function getClass(principal, classId) {
    return toClass(requireClass(principal, classId));
  }

  function createClass(principal, input) {
    const accountKey = requireAccountKey(principal);
    const body = validateCreateClass(input);
    const at = timestamp();
    const record = {
      id: randomUUID(),
      accountKey,
      version: 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      name: body.name
    };
    repository.insertClass(record);
    return toClass(record);
  }

  function updateClass(principal, classId, input) {
    requireAccountKey(principal);
    const body = validateUpdateClass(input);
    const current = requireClass(principal, classId);
    if (current.deletedAt !== null) throw objectDeleted();
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    const next = { ...current, version: current.version + 1, updatedAt: timestamp(), name: body.name };
    repository.updateClass(next);
    return toClass(next);
  }

  function setClassDeletion(principal, classId, input) {
    requireAccountKey(principal);
    const body = validateDeletion(input);
    const current = requireClass(principal, classId);
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    // A repeat delete is object-deleted; restoring an active class is a
    // same-content write that bumps the version like any other new request.
    if (body.deleted && current.deletedAt !== null) throw objectDeleted();
    const at = timestamp();
    const next = {
      ...current,
      version: current.version + 1,
      updatedAt: at,
      deletedAt: body.deleted ? at : null
    };
    repository.updateClass(next);
    return toClass(next);
  }

  // ------------------------------------------------------------------ records

  function listRecords(principal, { classId, state = 'active' } = {}, version = 1) {
    const accountKey = requireAccountKey(principal);
    // Reading a deleted class's records stays possible: the class tombstone is
    // the only way to reach the deleted records and restore them.
    requireClass(principal, classId);
    const wantDeleted = state === 'deleted';
    return projectRecords(principal, repository.listRecordsForClass(accountKey, classId)
      .filter(record => (record.deletedAt !== null) === wantDeleted), version);
  }

  function getRecord(principal, recordId, version = 1) {
    const record = requireRecord(principal, recordId);
    assertRepresentable(record, version);
    return toRecord(principal, record);
  }

  function recordText(body) {
    return {
      recordedOn: body.recordedOn,
      note: body.note,
      position: body.position,
      unfinished: body.unfinished,
      commonIssues: body.commonIssues,
      nextNote: body.nextNote
    };
  }

  function createRecord(principal, input, version = 1) {
    const accountKey = requireAccountKey(principal);
    const body = (version === 2 ? validateCreateRecordV2 : validateCreateRecord)(input);
    const classroom = requireClass(principal, body.classId);
    if (classroom.deletedAt !== null) throw objectDeleted();
    const at = timestamp();
    const record = {
      id: randomUUID(),
      accountKey,
      classId: body.classId,
      version: 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      ...recordText(body)
    };
    repository.insertRecord(record);
    repository.replaceSources(record.id, accountKey, resolveLinks(principal, body.sources, new Map()));
    return toRecord(principal, record);
  }

  /**
   * A soft-deleted class makes its records read-only; that guard is shared by
   * every record write so a class tombstone can never be bypassed by one of
   * them. A deleted record rejects ordinary modification but must stay
   * restorable, so the record's own deletion state is checked per operation.
   */
  function requireRecordInActiveClass(principal, recordId) {
    const current = requireRecord(principal, recordId);
    if (requireClass(principal, current.classId).deletedAt !== null) throw objectDeleted();
    return current;
  }

  function updateRecord(principal, recordId, input, version = 1) {
    const accountKey = requireAccountKey(principal);
    const body = (version === 2 ? validateUpdateRecordV2 : validateUpdateRecord)(input);
    const current = requireRecordInActiveClass(principal, recordId);
    if (current.deletedAt !== null) throw objectDeleted();
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    assertRepresentable(current, version);
    // A record belongs to exactly one class for its whole life.
    if (body.classId !== current.classId) throw classMismatch();
    const next = { ...current, version: current.version + 1, updatedAt: timestamp(), ...recordText(body) };
    const existingByKey = new Map(
      repository.listSources(current.id).map((stored) => [`${stored.kind}:${stored.sourceId}`, stored])
    );
    repository.updateRecord(next);
    repository.replaceSources(current.id, accountKey, resolveLinks(principal, body.sources, existingByKey));
    return toRecord(principal, next);
  }

  function setRecordDeletion(principal, recordId, input, version = 1) {
    requireAccountKey(principal);
    const body = validateDeletion(input);
    const current = requireRecordInActiveClass(principal, recordId);
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    assertRepresentable(current, version);
    if (body.deleted && current.deletedAt !== null) throw objectDeleted();
    const at = timestamp();
    const next = { ...current, version: current.version + 1, updatedAt: at, deletedAt: body.deleted ? at : null };
    repository.updateRecord(next);
    return toRecord(principal, next);
  }

  // -------------------------------------------------- reverse feedback (links)

  function listSourceRecords(principal, { kind, id } = {}, version = 1) {
    const accountKey = requireAccountKey(principal);
    validateSourceRecordsPath(kind, id, version);
    // Ownership and existence are confirmed through the provider; a tombstone
    // is still queryable so deleted sources keep their feedback readable.
    readSource(principal, kind, id);
    return projectRecords(principal, repository.listActiveRecordsForSource(accountKey, kind, id), version);
  }

  // -------------------------------------------------------------- public ports

  function readClass(principal, classId) {
    const record = requireClass(principal, classId);
    return {
      id: record.id,
      version: record.version,
      name: record.name,
      deletedAt: record.deletedAt
    };
  }

  function readRecord(principal, recordId) {
    const record = requireRecord(principal, recordId);
    const classroom = requireClass(principal, record.classId);
    return {
      id: record.id,
      version: record.version,
      classId: record.classId,
      label: recordLabel(record),
      deletedAt: record.deletedAt,
      classDeletedAt: classroom.deletedAt
    };
  }

  return {
    listClasses,
    getClass,
    createClass,
    updateClass,
    setClassDeletion,
    listRecords,
    getRecord,
    createRecord,
    updateRecord,
    setRecordDeletion,
    listSourceRecords,
    listRecordsV2: (principal, query) => listRecords(principal, query, 2),
    getRecordV2: (principal, id) => getRecord(principal, id, 2),
    createRecordV2: (principal, input) => createRecord(principal, input, 2),
    updateRecordV2: (principal, id, input) => updateRecord(principal, id, input, 2),
    setRecordDeletionV2: (principal, id, input) => setRecordDeletion(principal, id, input, 2),
    listSourceRecordsV2: (principal, query) => listSourceRecords(principal, query, 2),
    readClass,
    readRecord
  };
}
