import { emptyRecordContent, recordContentText } from '@refatos/shared';
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
  validatePurgeClass,
  validateNextNoteVisibility,
  validateMoveRecord,
  validateSourceRecordsPath,
  validateUpdateClass,
  validateUpdateRecord
} from './schema.js';

export function createClassesService({ repository, questions, lessons, math, content, now = () => new Date() }) {
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
  function toSource(principal, stored, version) {
    let reference;
    try { reference = readSource(principal, stored.kind, stored.sourceId); }
    catch (error) {
      // Existing links already belong to this record's owner. Keep their saved
      // label when a provider is unavailable; new links still require validation.
      if (version < 2 || ![404, 503].includes(error.status)) throw error;
      return { kind: stored.kind, id: stored.sourceId, labelAtLink: stored.labelAtLink,
        currentLabel: stored.labelAtLink, deleted: null,
        unavailable: error.status === 404 ? 'missing' : 'temporary' };
    }
    return {
      kind: stored.kind,
      id: stored.sourceId,
      labelAtLink: stored.labelAtLink,
      currentLabel: sourceDisplayTitle(stored.kind, reference),
      deleted: reference.deletedAt !== null
    };
  }

  function assertRepresentable(record, version, field = '/sources') {
    if (version === 1 && record.content?.blocks.length) throw invalidInput(field === '/items' ? field : '/content', 'unsupported-content-version');
    if (version === 1 && repository.listSources(record.id).some(source => source.kind === 'math')) {
      throw invalidInput(field, 'unsupported-content-version');
    }
  }

  function projectRecords(principal, records, version) {
    records.forEach(record => assertRepresentable(record, version, '/items'));
    if (version >= 2) records.sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    return { items: records.map(record => toRecord(principal, record, version)) };
  }

  function toRecord(principal, record, version = 1) {
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
      ...(version >= 2 ? { nextNoteHidden: Boolean(record.nextNoteHidden), content: record.content ?? emptyRecordContent() } : {}),
      sources: repository.listSources(record.id).map((stored) => toSource(principal, stored, version))
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

  function overview(principal) {
    const accountKey = requireAccountKey(principal);
    const records = repository.listActiveRecordsForAccount(accountKey);
    return { items: repository.listClassesForAccount(accountKey).filter(item => !item.deletedAt).map(classroom => {
      const items = records.filter(record => record.classId === classroom.id);
      const latest = items[0];
      const position = items.find(record => record.position.trim());
      return { id: classroom.id, count: items.length,
        latest: latest ? { recordedOn: latest.recordedOn, text: recordLabel(latest) } : null,
        position: position ? { recordedOn: position.recordedOn, text: position.position } : null };
    }) };
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

  function purgeClass(principal, classId, input) {
    const accountKey = requireAccountKey(principal);
    const body = validatePurgeClass(input);
    const current = requireClass(principal, classId);
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    if (current.deletedAt === null) throw invalidInput('/classId', 'invalid-reference');
    repository.purgeClass(accountKey, classId, timestamp());
    return { id: classId, permanentlyDeleted: true };
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
    return toRecord(principal, record, version);
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

  function recordContent(principal, supplied, previous) {
    const document = supplied ?? previous ?? emptyRecordContent();
    // Keeping an existing attachment must not make unrelated text edits depend
    // on its file still being readable. New/changed content is fully validated.
    if (document.blocks.length && JSON.stringify(document) !== JSON.stringify(previous)) {
      if (!content) throw new TypeError('classes content writes require the shared content service');
      try { content.validate(principal, document); }
      catch (error) {
        if (typeof error.problem?.field === 'string') error.problem.field = '/content' + error.problem.field;
        throw error;
      }
    }
    return document;
  }
  function assertRecordContent(record) {
    if (![record.note, record.position, record.unfinished, record.commonIssues, record.nextNote].some(value => value.trim())
      && !recordContentText(record.content)) throw invalidInput('/note', 'empty-content');
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
      ...recordText(body),
      content: recordContent(principal, body.content),
      nextNoteHidden: 0
    };
    assertRecordContent(record);
    repository.insertRecord(record);
    repository.replaceSources(record.id, accountKey, resolveLinks(principal, body.sources, new Map()));
    return toRecord(principal, record, version);
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
    const next = { ...current, version: current.version + 1, updatedAt: timestamp(), ...recordText(body),
      nextNoteHidden: body.nextNote === current.nextNote ? current.nextNoteHidden : 0,
      content: recordContent(principal, body.content, current.content) };
    assertRecordContent(next);
    const existingByKey = new Map(
      repository.listSources(current.id).map((stored) => [`${stored.kind}:${stored.sourceId}`, stored])
    );
    repository.updateRecord(next);
    repository.replaceSources(current.id, accountKey, resolveLinks(principal, body.sources, existingByKey));
    return toRecord(principal, next, version);
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
    return toRecord(principal, next, version);
  }

  function moveRecord(principal, recordId, input) {
    const body = validateMoveRecord(input);
    const current = requireRecordInActiveClass(principal, recordId);
    if (current.deletedAt !== null) throw objectDeleted();
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    requireClass(principal, body.targetClassId, { allowDeleted: false });
    if (body.targetClassId === current.classId) throw invalidInput('/targetClassId', 'invalid-reference');
    const at = timestamp();
    const moved = { ...current, id: randomUUID(), classId: body.targetClassId, version: 1, createdAt: at, updatedAt: at };
    repository.insertRecord(moved);
    repository.replaceSources(moved.id, current.accountKey, repository.listSources(current.id).map(source => ({
      kind: source.kind, id: source.sourceId, labelAtLink: source.labelAtLink
    })));
    // The original identity and class remain valid for existing schedule links.
    // Both the destination and source deletion share the caller's transaction.
    repository.updateRecord({ ...current, version: current.version + 1, updatedAt: at, deletedAt: at });
    return { originalId: current.id, originalClassId: current.classId, record: toRecord(principal, moved, 2) };
  }

  function purgeRecord(principal, recordId, input) {
    const body = validatePurgeClass(input);
    const current = requireRecordInActiveClass(principal, recordId);
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    if (current.deletedAt === null) throw invalidInput('/recordId', 'invalid-reference');
    repository.purgeRecord(requireAccountKey(principal), recordId, timestamp());
    return { id: recordId, classId: current.classId, permanentlyDeleted: true };
  }

  function setNextNoteVisibility(principal, recordId, input) {
    const body = validateNextNoteVisibility(input);
    const current = requireRecordInActiveClass(principal, recordId);
    if (current.deletedAt !== null) throw objectDeleted();
    if (body.expectedVersion !== current.version) throw versionConflict(current.version, current.id);
    const next = { ...current, nextNoteHidden: body.hidden ? 1 : 0, version: current.version + 1, updatedAt: timestamp() };
    repository.updateRecord(next);
    return toRecord(principal, next, 2);
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
    const removed = repository.getRemovedForAccount(requireAccountKey(principal), classId, 'class');
    if (removed) return { id: removed.id, version: removed.version, name: '已删除班级', deletedAt: removed.removedAt };
    const record = requireClass(principal, classId);
    return {
      id: record.id,
      version: record.version,
      name: record.name,
      deletedAt: record.deletedAt
    };
  }

  function readRecord(principal, recordId) {
    const removed = repository.getRemovedForAccount(requireAccountKey(principal), recordId, 'record');
    if (removed) return { id: removed.id, version: removed.version, classId: removed.classId,
      label: '已删除记录', deletedAt: removed.removedAt,
      classDeletedAt: repository.getClassForAccount(requireAccountKey(principal), removed.classId)?.deletedAt
        ?? repository.getRemovedForAccount(requireAccountKey(principal), removed.classId, 'class')?.removedAt ?? null };
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
    readForExport(principal) {
      const accountKey = requireAccountKey(principal);
      return {
        classes: repository.listClassesForAccount(accountKey).map(toClass),
        records: repository.listRecordsForAccount(accountKey).map(record => toRecord(principal, record, 2)),
      };
    },
    listClasses,
    overview,
    getClass,
    createClass,
    updateClass,
    setClassDeletion,
    purgeClass,
    purgeRecord,
    moveRecord,
    setNextNoteVisibility,
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
