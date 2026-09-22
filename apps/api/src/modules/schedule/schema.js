/**
 * Schedule request schemas.
 *
 * Request bodies follow the frozen OpenAPI strictly: unknown fields, implicit
 * type conversion and out-of-range values are rejected with exactly one
 * `invalid-input` carrying an RFC6901 pointer and a reason. Calendar reality,
 * blank item text and cross-field rules no JSON Schema can express are checked
 * here too, so HTTP writes and the future agent-facing operations share one
 * request validation.
 *
 * The shared schema engine has no JSON `null` node. Nullable fields are
 * therefore validated against a sentinel value that satisfies the real node and
 * restored to `null` afterwards; a non-null value never touches the sentinel, so
 * every other error pointer stays exact.
 */
import { schema, uuidPattern, validateBody } from '../../workbench/schema.js';
import { invalidInput } from '../../workbench/problems.js';
import { isDate } from './time.js';

const datePattern = /^(19\d{2}|20\d{2}|2100)-\d{2}-\d{2}$/;
const timeOfDayPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const placeholderId = '00000000-0000-4000-8000-000000000000';

const id = schema.string({ pattern: uuidPattern });
const date = schema.string({ pattern: datePattern });
const version = schema.integer({ min: 1 });

const timeSchema = schema.object([
  ['date', date],
  ['startTime', schema.string({ pattern: timeOfDayPattern })],
  ['timeZone', schema.string({ minLength: 1, maxLength: 100 })],
  ['durationMinutes', schema.integer({ min: 1, max: 1440 })]
]);

const repeatSchema = schema.object([['until', date]]);

const reminderSchema = schema.object([
  ['side', schema.string({ enum: ['before', 'after'] })],
  ['minutes', schema.integer({ min: 0, max: 10080 })]
]);

const itemSchema = schema.object([
  ['id', id],
  ['text', schema.string({ minLength: 1, maxLength: 4000 })],
  ['priority', schema.string({ enum: ['low', 'normal', 'high'] })]
]);

const courseSchema = schema.object([
  ['classId', id],
  ['lessonId', id],
  ['recordIds', schema.array(() => id, { maxItems: 100 })]
]);

const entryBodyFields = [
  ['title', schema.string({ maxLength: 300 })],
  ['items', schema.array(() => itemSchema, { maxItems: 200 })],
  ['time', timeSchema],
  ['repeat', repeatSchema],
  ['course', courseSchema],
  ['reminder', reminderSchema]
];

const entryInputSchema = schema.object(entryBodyFields);
const entryUpdateSchema = schema.object([['expectedVersion', version], ...entryBodyFields]);
const overrideSchema = schema.object([
  ['title', schema.string({ maxLength: 300 })],
  ['items', schema.array(() => itemSchema, { maxItems: 200 })],
  ['time', timeSchema],
  ['course', courseSchema],
  ['reminder', reminderSchema]
]);

const deletionSchema = schema.object([
  ['expectedVersion', version],
  ['deleted', schema.boolean()]
]);

const exceptionInputSchema = schema.oneOf([
  schema.object([
    ['expectedVersion', version],
    ['mode', schema.string({ const: 'override' })],
    ['content', overrideSchema]
  ]),
  schema.object([
    ['expectedVersion', version],
    ['mode', schema.string({ const: 'cancelled' })]
  ]),
  schema.object([
    ['expectedVersion', version],
    ['mode', schema.string({ const: 'inherit' })]
  ])
]);

const moveItemSchema = schema.object([
  ['itemId', id],
  ['fromEntryId', id],
  ['fromVersion', version],
  ['toEntryId', id],
  ['toVersion', version],
  ['toIndex', schema.integer({ min: 0 })]
]);

const settingsUpdateSchema = schema.object([
  ['timeZone', schema.string({ minLength: 1, maxLength: 100 })],
  ['expectedVersion', version]
]);

/**
 * Nullable positions per operation, with a sentinel that the real node accepts.
 * `restoreNulls` puts the literal `null` back after the engine has validated.
 */
const timeSentinel = { date: '1900-01-01', startTime: '00:00', timeZone: 'UTC', durationMinutes: 1 };
const repeatSentinel = { until: '1900-01-01' };
const reminderSentinel = { side: 'before', minutes: 0 };

const entryNullables = [
  { path: ['time'], sentinel: timeSentinel },
  { path: ['repeat'], sentinel: repeatSentinel },
  { path: ['reminder'], sentinel: reminderSentinel },
  { path: ['course', 'classId'], sentinel: placeholderId },
  { path: ['course', 'lessonId'], sentinel: placeholderId }
];

const overrideNullables = [
  { path: ['reminder'], sentinel: reminderSentinel },
  { path: ['course', 'classId'], sentinel: placeholderId },
  { path: ['course', 'lessonId'], sentinel: placeholderId }
];

const moveNullables = [
  { path: ['toEntryId'], sentinel: placeholderId },
  { path: ['toVersion'], sentinel: 1 }
];

function atPath(object, path) {
  let current = object;
  for (const key of path.slice(0, -1)) {
    if (!current || typeof current !== 'object') return null;
    current = current[key];
  }
  return current;
}

function applySentinels(body, nullables) {
  const pending = [];
  for (const { path, sentinel } of nullables) {
    const parent = atPath(body, path);
    const key = path[path.length - 1];
    if (parent && typeof parent === 'object' && parent[key] === null) {
      parent[key] = structuredClone(sentinel);
      pending.push({ parent, key });
    }
  }
  return pending;
}

function restoreNulls(pending) {
  for (const { parent, key } of pending) parent[key] = null;
}

function prepare(body, nullables) {
  const prepared = structuredClone(body);
  const pending = applySentinels(prepared, nullables);
  return { prepared, pending };
}

/** Items are non-blank and their IDs are unique inside one entry. */
function assertItems(items, pointer) {
  const seen = new Set();
  items.forEach((item, index) => {
    const itemPointer = `${pointer}/items/${index}`;
    if (item.text.trim() === '') throw invalidInput(`${itemPointer}/text`, 'out-of-range');
    if (seen.has(item.id)) throw invalidInput(`${itemPointer}/id`, 'duplicate-id');
    seen.add(item.id);
  });
}

function assertCourse(course, pointer) {
  const seen = new Set();
  course.recordIds.forEach((recordId, index) => {
    if (seen.has(recordId)) throw invalidInput(`${pointer}/recordIds/${index}`, 'duplicate-id');
    seen.add(recordId);
  });
}

function assertDateFields(value, pointer) {
  if (value.time && !isDate(value.time.date)) throw invalidInput(`${pointer}/time/date`, 'out-of-range');
  if (value.repeat && !isDate(value.repeat.until)) throw invalidInput(`${pointer}/repeat/until`, 'out-of-range');
}

/** Shape checks shared by EntryInput, EntryUpdate and Override content. */
export function validateEntryShape(value, pointer = '') {
  assertItems(value.items, pointer);
  assertDateFields(value, pointer);
  assertCourse(value.course, pointer);
  return value;
}

export function validateCreateEntry(body) {
  const { prepared, pending } = prepare(body, entryNullables);
  const value = validateBody(entryInputSchema, prepared);
  restoreNulls(pending);
  return validateEntryShape(value);
}

export function validateUpdateEntry(body) {
  const { prepared, pending } = prepare(body, entryNullables);
  const value = validateBody(entryUpdateSchema, prepared);
  restoreNulls(pending);
  return validateEntryShape(value);
}

export function validateSetDeletion(body) {
  return validateBody(deletionSchema, body);
}

export function validateExceptionInput(body) {
  const prepared = structuredClone(body);
  const contentPending = prepared?.mode === 'override' && prepared.content
    ? applySentinels(prepared.content, overrideNullables)
    : [];
  const value = validateBody(exceptionInputSchema, prepared);
  restoreNulls(contentPending);
  if (value.mode === 'override') {
    if (value.content.time === null) throw invalidInput('/content/time', 'invalid-type');
    validateEntryShape(value.content, '/content');
  }
  return value;
}

export function validateMoveItem(body) {
  const { prepared, pending } = prepare(body, moveNullables);
  const value = validateBody(moveItemSchema, prepared);
  restoreNulls(pending);
  return value;
}

export function validateSettingsUpdate(body) {
  return validateBody(settingsUpdateSchema, body);
}
