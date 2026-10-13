import { validateSchema as validateDocumentSchema } from '../../workbench/content/schema.js';
// Request validation for the classes operations.
//
// Shapes come from the frozen teaching-time OpenAPI and are validated with the
// shared schema engine, so the rejection field/reason selection matches every
// other workbench module. Cross-field rules that no single-field schema can
// express (a real calendar date, at least one non-blank text, unique links) are
// checked here as well, because direct business callers must get the same
// rejections as the HTTP entry.
import { schema, uuidPattern, validateBody } from '../../workbench/schema.js';
import {
  MAX_NAME_LENGTH,
  MAX_SOURCES,
  MAX_TEXT_LENGTH,
  invalidInput
} from './contract.js';

const datePattern = /^(19\d{2}|20\d{2}|2100)-\d{2}-\d{2}$/;

/** Valid Gregorian date in 1900-01-01 .. 2100-12-31. */
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const primitives = {
  id: schema.string({ pattern: uuidPattern }),
  version: schema.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  name: schema.string({ minLength: 1, maxLength: MAX_NAME_LENGTH, nonBlank: true }),
  date: schema.string({ pattern: datePattern }),
  text: schema.string({ maxLength: MAX_TEXT_LENGTH })
};

const sourceInputSchema = schema.object([
  ['kind', schema.string({ enum: ['question'] })],
  ['id', () => primitives.id]
]);

const classInputSchema = schema.object([
  ['name', () => primitives.name]
]);

const classUpdateSchema = schema.object([
  ['expectedVersion', () => primitives.version],
  ['name', () => primitives.name]
]);

const deletionSchema = schema.object([
  ['expectedVersion', () => primitives.version],
  ['deleted', schema.boolean()]
]);
const purgeClassSchema = schema.object([['expectedVersion', () => primitives.version]]);
export function validateNextNoteVisibility(input) {
  return validateBody(schema.object([['expectedVersion', () => primitives.version], ['hidden', schema.boolean()]]), input);
}
export function validatePurgeClass(input) { return validateBody(purgeClassSchema, input); }

function recordFieldList(sourceSchema = sourceInputSchema) {
  return [
    ['classId', () => primitives.id],
    ['recordedOn', () => primitives.date],
    ['note', () => primitives.text],
    ['position', () => primitives.text],
    ['unfinished', () => primitives.text],
    ['commonIssues', () => primitives.text],
    ['nextNote', () => primitives.text],
    ['sources', schema.array(() => sourceSchema, { maxItems: MAX_SOURCES })]
  ];
}

const recordInputSchema = schema.object(recordFieldList());
const recordUpdateSchema = schema.object([
  ['expectedVersion', () => primitives.version],
  ...recordFieldList()
]);

const sourceInputV2Schema = schema.object([
  ['kind', schema.string({ enum: ['question', 'math'] })],
  ['id', () => primitives.id]
]);
const recordInputV2Schema = schema.object(recordFieldList(sourceInputV2Schema));
const recordUpdateV2Schema = schema.object([
  ['expectedVersion', () => primitives.version], ...recordFieldList(sourceInputV2Schema)
]);
export function validateCreateRecordV2(input) {
  return validateRecordV2(recordInputV2Schema, input);
}
export function validateUpdateRecordV2(input) {
  return validateRecordV2(recordUpdateV2Schema, input);
}

function validateRecordV2(shape, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return validateRecordBody(shape, input, true);
  const { content, ...plain } = input;
  validateRecordBody(shape, plain, true);
  if (Object.hasOwn(input, 'content')) validateDocumentSchema('Document', content, '/content');
  return input;
}

export function validateMoveRecord(input) {
  return validateBody(schema.object([['expectedVersion', () => primitives.version], ['targetClassId', () => primitives.id]]), input);
}

function validateRecordBody(shape, input, allowContent = false) {
  try {
    return assertRecordRules(validateBody(shape, input), allowContent);
  } catch (error) {
    if (/^\/sources\/\d+\/kind$/.test(error.problem?.field ?? '') && error.problem?.reason === 'out-of-range') {
      throw invalidInput(error.problem.field, 'invalid-reference');
    }
    throw error;
  }
}

function hasAnyText(body) {
  return [body.note, body.position, body.unfinished, body.commonIssues, body.nextNote]
    .some((value) => value.trim() !== '');
}

function assertRecordRules(body, allowContent) {
  if (!isCalendarDate(body.recordedOn)) throw invalidInput('/recordedOn', 'out-of-range');
  if (!allowContent && !hasAnyText(body)) throw invalidInput('/note', 'empty-content');
  const seen = new Set();
  body.sources.forEach((source, index) => {
    const key = `${source.kind}:${source.id}`;
    if (seen.has(key)) throw invalidInput(`/sources/${index}/id`, 'duplicate-id');
    seen.add(key);
  });
  return body;
}

export function validateCreateClass(input) {
  return validateBody(classInputSchema, input);
}

export function validateUpdateClass(input) {
  return validateBody(classUpdateSchema, input);
}

export function validateDeletion(input) {
  return validateBody(deletionSchema, input);
}

export function validateCreateRecord(input) {
  return validateRecordBody(recordInputSchema, input);
}

export function validateUpdateRecord(input) {
  return validateRecordBody(recordUpdateSchema, input);
}

function readState(query) {
  const source = query ?? {};
  for (const key of Object.keys(source).sort()) {
    if (key !== 'state') throw invalidInput(`/query/${key}`, 'unknown-field');
  }
  if (source.state !== undefined && source.state !== 'active' && source.state !== 'deleted') {
    throw invalidInput('/query/state', 'invalid-type');
  }
  return source.state ?? 'active';
}

/** listClasses declares only `state`; repeated or unknown query keys are rejected. */
export function validateClassesQuery(query) {
  return { state: readState(query) };
}

/** listRecords requires one UUID classId plus the optional state filter. */
export function validateRecordsQuery(query) {
  const source = query ?? {};
  for (const key of Object.keys(source).sort()) {
    if (key !== 'classId' && key !== 'state') throw invalidInput(`/query/${key}`, 'unknown-field');
  }
  if (source.classId === undefined) throw invalidInput('/query/classId', 'required');
  if (typeof source.classId !== 'string' || !uuidPattern.test(source.classId)) {
    throw invalidInput('/query/classId', 'invalid-type');
  }
  if (source.state !== undefined && source.state !== 'active' && source.state !== 'deleted') {
    throw invalidInput('/query/state', 'invalid-type');
  }
  return { classId: source.classId, state: source.state ?? 'active' };
}

/** source-records/{kind}/{id}: the kind enum and the UUID are one request schema. */
export function validateSourceRecordsPath(kind, id, version = 1) {
  if (!['question', ...(version === 2 ? ['math'] : [])].includes(kind)) throw invalidInput('/path/kind', 'invalid-reference');
  if (typeof id !== 'string' || !uuidPattern.test(id)) throw invalidInput('/path/id', 'invalid-type');
  return { kind, id };
}
