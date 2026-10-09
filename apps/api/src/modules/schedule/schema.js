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

const calendarSchema = schema.object([
  ['allDay', schema.boolean()],
  ['notes', schema.string({ maxLength: 50000 })],
  ['tags', schema.array(() => id, { maxItems: 30 })]
]);
const calendarRepeatSchema = schema.object([
  ['until', date],
  ['frequency', schema.string({ enum: ['daily', 'weekly', 'monthly', 'yearly'] })],
  ['interval', schema.integer({ min: 1, max: 999 })],
  ['weekdays', schema.array(() => schema.integer({ min: 0, max: 6 }), { maxItems: 7 })],
  ['monthly', schema.string({ enum: ['date', 'weekday'] })],
  ['count', schema.integer({ min: 0, max: 10000 })]
]);

// The calendar extension is additive. Existing callers keep the original
// request shape, limits and weekly-series behaviour.
function calendarFields(fields, value) {
  const extended = value && Object.hasOwn(value, 'calendar');
  return fields.map(([name, node]) => {
    if (name === 'repeat' && value?.repeat && Object.hasOwn(value.repeat, 'frequency')) return [name, calendarRepeatSchema];
    if (name === 'time' && extended) return [name, schema.object([
      ['date', date], ['startTime', schema.string({ pattern: timeOfDayPattern })],
      ['timeZone', schema.string({ minLength: 1, maxLength: 100 })],
      ['durationMinutes', schema.integer({ min: 1, max: 527040 })]
    ])];
    return [name, node];
  }).concat(extended ? [['calendar', calendarSchema]] : []);
}

const reminderFields = [
  ['side', schema.string({ enum: ['before', 'after'] })],
  ['minutes', schema.integer({ min: 0, max: 10080 })]
];
const reminderSchema = schema.oneOf([
  schema.object([...reminderFields, ['anchor', schema.string({ enum: ['start', 'end'] })]]),
  schema.object(reminderFields)
]);

const itemFields = [
  ['id', id],
  ['text', schema.string({ minLength: 1, maxLength: 4000 })],
  ['priority', schema.string({ enum: ['low', 'normal', 'high'] })]
];
const itemSchema = schema.oneOf([
  schema.object([...itemFields, ['completed', schema.boolean()]]),
  schema.object(itemFields)
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

const moveItemFields = [
  ['itemId', id],
  ['fromEntryId', id],
  ['fromVersion', version],
  ['toEntryId', id],
  ['toVersion', version],
  ['toIndex', schema.integer({ min: 0 })]
];
const moveItemSchema = schema.object(moveItemFields);

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
  { path: ['toVersion'], sentinel: 1 },
  { path: ['toOriginDate'], sentinel: '2000-01-01' }
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
  if (value.calendar) {
    if (new Set(value.calendar.tags).size !== value.calendar.tags.length) throw invalidInput(`${pointer}/calendar/tags`, 'duplicate-id');
    if (value.calendar.allDay && value.time && (value.time.startTime !== '00:00' || value.time.durationMinutes % 1440 !== 0)) {
      throw invalidInput(`${pointer}/time`, 'out-of-range');
    }
  }
  if (value.repeat?.frequency === 'weekly' && value.repeat.weekdays.length === 0) throw invalidInput(`${pointer}/repeat/weekdays`, 'empty-content');
  return value;
}

export function validateCreateEntry(body) {
  const { prepared, pending } = prepare(body, entryNullables);
  const value = validateBody(schema.object(calendarFields(entryBodyFields, body)), prepared);
  restoreNulls(pending);
  return validateEntryShape(value);
}

export function validateUpdateEntry(body) {
  const { prepared, pending } = prepare(body, entryNullables);
  const value = validateBody(schema.object([['expectedVersion', version], ...calendarFields(entryBodyFields, body)]), prepared);
  restoreNulls(pending);
  return validateEntryShape(value);
}

export function validateDeleteEntry(body) {
  return validateBody(schema.object([['expectedVersion', version]]), body);
}

export function validateSetDeletion(body) {
  return validateBody(deletionSchema, body);
}

export function validateExceptionInput(body) {
  const prepared = structuredClone(body);
  const contentPending = prepared?.mode === 'override' && prepared.content
    ? applySentinels(prepared.content, overrideNullables)
    : [];
  const overrideFields = entryBodyFields.filter(([name]) => name !== 'repeat');
  const value = validateBody(body?.mode === 'override' ? schema.object([
    ['expectedVersion', version], ['mode', schema.string({ const: 'override' })],
    ['content', schema.object(calendarFields(overrideFields, body.content))]
  ]) : exceptionInputSchema, prepared);
  restoreNulls(contentPending);
  if (value.mode === 'override') {
    if (value.content.time === null) throw invalidInput('/content/time', 'invalid-type');
    validateEntryShape(value.content, '/content');
  }
  return value;
}

export function validateMoveItem(body) {
  const { prepared, pending } = prepare(body, moveNullables);
  const fields = body && typeof body === 'object' && ('toScope' in body || 'toOriginDate' in body) ? schema.object([...moveItemFields,
    ['toScope', schema.string({ enum: ['series', 'instance'] })], ['toOriginDate', date]]) : moveItemSchema;
  const value = validateBody(fields, prepared);
  restoreNulls(pending);
  return value;
}

export function validateSettingsUpdate(body) {
  return validateBody(settingsUpdateSchema, body);
}

const labelFields = [['name', schema.string({ minLength: 1, maxLength: 60, nonBlank: true })],
  ['color', schema.string({ pattern: /^#[0-9a-fA-F]{6}$/ })]];
export const validateCreateLabel = body => validateBody(schema.object(labelFields), body);
export const validateUpdateLabel = body => validateBody(schema.object([
  ['expectedVersion', version], ...labelFields, ['deleted', schema.boolean()]
]), body);
