// Request validation for the first-flow operations. The workbench HTTP layer
// owns the request pipeline, but the modules keep their own copy of the rules
// so direct business callers get the same contract rejections and storage can
// never receive an unvalidated aggregate.
import { assertDocument, invalidInput, isBlankDocument, pointerField } from './contract.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_VERSION = Number.MAX_SAFE_INTEGER;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTE_LENGTH = 20000;
const MAX_PASTE_LENGTH = 100000;
const MAX_SECTIONS = 200;
const MAX_REFERENCES = 1000;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value, pointer) {
  if (!isPlainObject(value)) throw invalidInput(pointer, 'invalid-type');
  return value;
}

function rejectUnknownFields(value, allowed, pointer) {
  const unknown = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort();
  if (unknown.length > 0) {
    throw invalidInput(pointerField(pointer, unknown[0]), 'unknown-field');
  }
}

function requireField(object, key, pointer) {
  if (object[key] === undefined) throw invalidInput(pointerField(pointer, key), 'required');
}

function requireString(value, pointer, { minLength = 0, maxLength, blankIsOutOfRange = false } = {}) {
  if (typeof value !== 'string') throw invalidInput(pointer, 'invalid-type');
  if (blankIsOutOfRange && value.trim().length < Math.max(minLength, 1)) {
    throw invalidInput(pointer, 'out-of-range');
  }
  if (value.length < minLength || (maxLength !== undefined && value.length > maxLength)) {
    throw invalidInput(pointer, 'out-of-range');
  }
  return value;
}

function requireVersion(value, pointer) {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw invalidInput(pointer, 'invalid-type');
  if (value < 1 || value > MAX_VERSION) throw invalidInput(pointer, 'out-of-range');
  return value;
}

function requireUuid(value, pointer) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw invalidInput(pointer, 'invalid-type');
  return value;
}

function requireBoolean(value, pointer) {
  if (typeof value !== 'boolean') throw invalidInput(pointer, 'invalid-type');
  return value;
}

function requireArray(value, pointer, { maxItems } = {}) {
  if (!Array.isArray(value)) throw invalidInput(pointer, 'invalid-type');
  if (maxItems !== undefined && value.length > maxItems) throw invalidInput(pointer, 'out-of-range');
  return value;
}

function validateSource(value, pointer) {
  requireObject(value, pointer);
  requireField(value, 'kind', pointer);
  if (value.kind === 'manual') {
    rejectUnknownFields(value, ['kind'], pointer);
    return;
  }
  if (value.kind === 'paste') {
    rejectUnknownFields(value, ['kind', 'text'], pointer);
    requireField(value, 'text', pointer);
    requireString(value.text, pointerField(pointer, 'text'), {
      minLength: 1,
      maxLength: MAX_PASTE_LENGTH
    });
    return;
  }
  throw invalidInput(pointerField(pointer, 'kind'), 'invalid-type');
}

function validateQuestionContent(body, pointer) {
  requireField(body, 'title', pointer);
  requireString(body.title, pointerField(pointer, 'title'), { maxLength: MAX_TITLE_LENGTH });
  requireField(body, 'body', pointer);
  assertDocument(body.body, pointerField(pointer, 'body'));
  if (isBlankDocument(body.body)) throw invalidInput(pointerField(pointer, 'body'), 'empty-content');
  requireField(body, 'solution', pointer);
  assertDocument(body.solution, pointerField(pointer, 'solution'));
  requireField(body, 'note', pointer);
  requireString(body.note, pointerField(pointer, 'note'), { maxLength: MAX_NOTE_LENGTH });
  requireField(body, 'starred', pointer);
  requireBoolean(body.starred, pointerField(pointer, 'starred'));
}

export function validateCreateQuestion(input) {
  const body = requireObject(input, '');
  rejectUnknownFields(body, ['title', 'body', 'solution', 'note', 'starred', 'source'], '');
  validateQuestionContent(body, '');
  requireField(body, 'source', '');
  validateSource(body.source, '/source');
  return body;
}

export function validateUpdateQuestion(input) {
  const body = requireObject(input, '');
  rejectUnknownFields(body, ['baseVersion', 'title', 'body', 'solution', 'note', 'starred'], '');
  requireField(body, 'baseVersion', '');
  requireVersion(body.baseVersion, '/baseVersion');
  validateQuestionContent(body, '');
  return body;
}

export function validateCopyQuestion(input) {
  const body = requireObject(input, '');
  rejectUnknownFields(body, ['baseVersion', 'title', 'body', 'solution', 'note', 'starred'], '');
  requireField(body, 'baseVersion', '');
  requireVersion(body.baseVersion, '/baseVersion');
  validateQuestionContent(body, '');
  return body;
}

export function validateSetDeletion(input) {
  const body = requireObject(input, '');
  rejectUnknownFields(body, ['baseVersion', 'deleted'], '');
  requireField(body, 'baseVersion', '');
  requireVersion(body.baseVersion, '/baseVersion');
  requireField(body, 'deleted', '');
  requireBoolean(body.deleted, '/deleted');
  return body;
}

function validateReference(value, pointer) {
  requireObject(value, pointer);
  rejectUnknownFields(value, ['id', 'questionId', 'questionVersion', 'note'], pointer);
  for (const key of ['id', 'questionId', 'questionVersion', 'note']) {
    requireField(value, key, pointer);
  }
  requireUuid(value.id, pointerField(pointer, 'id'));
  requireUuid(value.questionId, pointerField(pointer, 'questionId'));
  requireVersion(value.questionVersion, pointerField(pointer, 'questionVersion'));
  requireString(value.note, pointerField(pointer, 'note'), { maxLength: MAX_NOTE_LENGTH });
}

function validateSection(value, pointer) {
  requireObject(value, pointer);
  rejectUnknownFields(value, ['id', 'title', 'content', 'references'], pointer);
  for (const key of ['id', 'title', 'content', 'references']) {
    requireField(value, key, pointer);
  }
  requireUuid(value.id, pointerField(pointer, 'id'));
  requireString(value.title, pointerField(pointer, 'title'), {
    minLength: 1,
    maxLength: MAX_TITLE_LENGTH,
    blankIsOutOfRange: true
  });
  assertDocument(value.content, pointerField(pointer, 'content'));
  requireArray(value.references, pointerField(pointer, 'references'), { maxItems: MAX_REFERENCES });
  value.references.forEach((reference, index) => validateReference(reference, `${pointer}/references/${index}`));
}

function validateLessonContent(body, pointer) {
  requireField(body, 'title', pointer);
  requireString(body.title, pointerField(pointer, 'title'), {
    minLength: 1,
    maxLength: MAX_TITLE_LENGTH,
    blankIsOutOfRange: true
  });
  requireField(body, 'intro', pointer);
  assertDocument(body.intro, pointerField(pointer, 'intro'));
  requireField(body, 'sections', pointer);
  requireArray(body.sections, pointerField(pointer, 'sections'), { maxItems: MAX_SECTIONS });
  const sectionIds = new Set();
  body.sections.forEach((section, index) => {
    const sectionPointer = `${pointer}/sections/${index}`;
    validateSection(section, sectionPointer);
    if (sectionIds.has(section.id)) throw invalidInput(`${sectionPointer}/id`, 'duplicate-id');
    sectionIds.add(section.id);
  });
  requireField(body, 'materials', pointer);
  requireArray(body.materials, pointerField(pointer, 'materials'), { maxItems: MAX_REFERENCES });
  const referenceIds = new Set();
  body.sections.forEach((section, sectionIndex) => {
    section.references.forEach((reference, referenceIndex) => {
      const referencePointer = `${pointer}/sections/${sectionIndex}/references/${referenceIndex}`;
      if (referenceIds.has(reference.id)) throw invalidInput(`${referencePointer}/id`, 'duplicate-id');
      referenceIds.add(reference.id);
    });
  });
  body.materials.forEach((reference, index) => {
    const referencePointer = `${pointer}/materials/${index}`;
    validateReference(reference, referencePointer);
    if (referenceIds.has(reference.id)) throw invalidInput(`${referencePointer}/id`, 'duplicate-id');
    referenceIds.add(reference.id);
  });
}

export function validateCreateLesson(input) {
  const body = requireObject(input, '');
  rejectUnknownFields(body, ['title', 'intro', 'sections', 'materials'], '');
  validateLessonContent(body, '');
  return body;
}

export function validateUpdateLesson(input) {
  const body = requireObject(input, '');
  rejectUnknownFields(body, ['baseVersion', 'title', 'intro', 'sections', 'materials'], '');
  requireField(body, 'baseVersion', '');
  requireVersion(body.baseVersion, '/baseVersion');
  validateLessonContent(body, '');
  return body;
}

function validateQuery(query, allowedKeys, { starred = false } = {}) {
  const source = query ?? {};
  for (const key of Object.keys(source).sort()) {
    if (!allowedKeys.includes(key)) throw invalidInput(`/query/${key}`, 'unknown-field');
  }
  if (source.q !== undefined) {
    if (typeof source.q !== 'string') throw invalidInput('/query/q', 'invalid-type');
    if (source.q.length > MAX_TITLE_LENGTH) throw invalidInput('/query/q', 'out-of-range');
  }
  if (source.state !== undefined && source.state !== 'active' && source.state !== 'deleted') {
    throw invalidInput('/query/state', 'invalid-type');
  }
  if (starred && source.starred !== undefined && source.starred !== 'true' && source.starred !== 'false') {
    throw invalidInput('/query/starred', 'invalid-type');
  }
}

export function validateQuestionsQuery(query) {
  validateQuery(query, ['q', 'state', 'starred'], { starred: true });
}

export function validateDerivativesQuery(query) {
  validateQuery(query, ['state']);
}

export function validateLessonsQuery(query) {
  validateQuery(query, ['q', 'state']);
}
