/**
 * Contract schema facilities for workbench request bodies.
 *
 * The frozen OpenAPI is the only schema source; this module is a small
 * validator that preserves the error selection the contract fixes for
 * `invalid-input`: exactly one error, schema field order depth-first, arrays by
 * index, root unknown fields before field content, and unknown fields at the
 * same level ordered by key ascending.
 *
 * Reason selection (frozen by first-flow-cases.md C16 and the Problem schema):
 * - missing key                          -> required
 * - undeclared key                       -> unknown-field
 * - wrong JSON type (no coercion)        -> invalid-type
 * - empty string where minLength >= 1    -> empty-content
 * - blank string where nonBlank is set   -> out-of-range
 * - length/range/pattern/enum violation  -> out-of-range
 * - const mismatch on `type`/`version`   -> unsupported-content-version
 * - const mismatch elsewhere             -> out-of-range
 * Business rules that no schema can express (duplicate IDs, references to
 * another question, unsupported document versions) are thrown by the owning
 * module through `invalidInput(field, reason)`.
 */
import { workbenchLimits } from '@teachbuddy/shared';
import { invalidInput } from './problems.js';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function joinPointer(pointer, key) {
  const escaped = String(key).replaceAll('~', '~0').replaceAll('/', '~1');
  return `${pointer}/${escaped}`;
}

function pointerDepth(pointer) {
  return pointer.split('/').length;
}

function ok(value) {
  return { ok: true, value };
}

function fail(field, reason) {
  return { ok: false, error: { field, reason } };
}

/** Fields may be declared lazily so shared primitives can reference each other. */
function lazyNode(value) {
  if (typeof value !== 'function') return () => value;
  let resolved;
  let done = false;
  return () => {
    if (!done) {
      resolved = value();
      done = true;
    }
    return resolved;
  };
}

export const schema = {
  object(fields) {
    const entries = Array.isArray(fields) ? fields : Object.entries(fields);
    return {
      kind: 'object',
      fields: entries.map(([name, fieldSchema]) => [name, lazyNode(fieldSchema)])
    };
  },

  array(items, options = {}) {
    return {
      kind: 'array',
      items: lazyNode(items),
      maxItems: options.maxItems
    };
  },

  string(options = {}) {
    return { kind: 'string', ...options };
  },

  integer(options = {}) {
    return { kind: 'integer', ...options };
  },

  boolean() {
    return { kind: 'boolean' };
  },

  oneOf(variants) {
    return { kind: 'oneOf', variants: variants.map((variant) => lazyNode(variant)) };
  }
};

function constReason(keyName) {
  return keyName === 'type' || keyName === 'version' ? 'unsupported-content-version' : 'out-of-range';
}

/**
 * OneOf variants in the frozen document are discriminated unions: every
 * variant is an object with the same literal `type`/`kind` field. The matching
 * variant owns the error; when nothing matches, the error is reported on the
 * discriminant itself (unknown node/kind -> unsupported-content-version),
 * instead of on some arbitrary field of an unrelated variant.
 */
function discriminantOf(node) {
  if (node?.kind !== 'object') return null;
  for (const [name, fieldSchema] of node.fields) {
    const field = fieldSchema();
    if (field.kind === 'string' && 'const' in field) return { name, value: field.const };
  }
  return null;
}

function validateOneOf(node, value, pointer, keyName) {
  const variants = node.variants.map((variant) => variant());
  const discriminants = variants.map(discriminantOf);

  if (isPlainObject(value) && discriminants.every(Boolean)) {
    const names = new Set(discriminants.map((discriminant) => discriminant.name));
    if (names.size === 1) {
      const [name] = names;
      const matchIndex = discriminants.findIndex((discriminant) => discriminant.value === value[name]);
      if (matchIndex >= 0) return validateSchema(variants[matchIndex], value, pointer, keyName);
      if (!(name in value)) return fail(joinPointer(pointer, name), 'required');
      if (typeof value[name] !== 'string') return fail(joinPointer(pointer, name), 'invalid-type');
      return fail(joinPointer(pointer, name), constReason(name));
    }
  }

  const errors = [];
  for (const variant of variants) {
    const result = validateSchema(variant, value, pointer, keyName);
    if (result.ok) return result;
    errors.push(result.error);
  }
  errors.sort((a, b) => pointerDepth(b.field) - pointerDepth(a.field));
  return { ok: false, error: errors[0] };
}

export function validateSchema(node, value, pointer = '', keyName = undefined) {
  switch (node.kind) {
    case 'object': {
      if (!isPlainObject(value)) return fail(pointer, 'invalid-type');
      const declared = new Set(node.fields.map(([name]) => name));
      const unknown = Object.keys(value).filter((key) => !declared.has(key)).sort();
      if (unknown.length) return fail(joinPointer(pointer, unknown[0]), 'unknown-field');
      for (const [name, fieldSchema] of node.fields) {
        if (!(name in value)) return fail(joinPointer(pointer, name), 'required');
        const result = validateSchema(fieldSchema(), value[name], joinPointer(pointer, name), name);
        if (!result.ok) return result;
      }
      return ok(value);
    }

    case 'array': {
      if (!Array.isArray(value)) return fail(pointer, 'invalid-type');
      if (node.maxItems !== undefined && value.length > node.maxItems) return fail(pointer, 'out-of-range');
      const itemSchema = node.items();
      for (let index = 0; index < value.length; index += 1) {
        const result = validateSchema(itemSchema, value[index], joinPointer(pointer, index), String(index));
        if (!result.ok) return result;
      }
      return ok(value);
    }

    case 'string': {
      if (typeof value !== 'string') return fail(pointer, 'invalid-type');
      if (node.nonBlank && value.trim() === '') return fail(pointer, 'out-of-range');
      if (value === '' && node.minLength !== undefined && node.minLength >= 1) return fail(pointer, 'empty-content');
      if (node.minLength !== undefined && value.length < node.minLength) return fail(pointer, 'out-of-range');
      if (node.maxLength !== undefined && value.length > node.maxLength) return fail(pointer, 'out-of-range');
      if (node.pattern && !node.pattern.test(value)) return fail(pointer, 'out-of-range');
      if (node.enum && !node.enum.includes(value)) return fail(pointer, 'out-of-range');
      if ('const' in node && value !== node.const) return fail(pointer, constReason(keyName));
      return ok(value);
    }

    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) return fail(pointer, 'invalid-type');
      if (node.min !== undefined && value < node.min) return fail(pointer, 'out-of-range');
      if (node.max !== undefined && value > node.max) return fail(pointer, 'out-of-range');
      if ('const' in node && value !== node.const) return fail(pointer, constReason(keyName));
      return ok(value);
    }

    case 'boolean': {
      if (typeof value !== 'boolean') return fail(pointer, 'invalid-type');
      return ok(value);
    }

    case 'oneOf':
      return validateOneOf(node, value, pointer, keyName);

    default:
      throw new Error(`Unknown schema node kind: ${String(node?.kind)}`);
  }
}

/**
 * Validate a parsed JSON request body. Throws the contract 422 problem so the
 * transport maps it unchanged; returns the validated body on success.
 */
export function validateBody(node, value) {
  const result = validateSchema(node, value);
  if (!result.ok) throw invalidInput(result.error.field, result.error.reason);
  return result.value;
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Request-shape rules every module operation shares: a path ID is a UUID, and
 * an operation that declares no query parameter rejects every query key. They
 * belong to the request schema stage, so they throw the contract 422 problem
 * the transport maps unchanged.
 */
export function validateIdPath(value, pointer = '/path/id') {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw invalidInput(pointer, 'invalid-type');
  }
  return value;
}

export function validateNoQuery(query) {
  for (const key of Object.keys(query ?? {}).sort()) {
    throw invalidInput(`/query/${key}`, 'unknown-field');
  }
}
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// Shared primitives from the frozen OpenAPI components. Operation envelopes
// belong to the module that owns the operation; these are the value shapes two
// modules must agree on (documents, snapshots, sources, references).
/** Inline math run and block math share one node shape in the frozen schema. */
function mathNode() {
  return schema.object([
    ['type', schema.string({ const: 'math' })],
    ['latex', schema.string({ minLength: 1, maxLength: workbenchLimits.latexLength })]
  ]);
}

const primitives = {
  id: schema.string({ pattern: uuidPattern }),
  version: schema.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  timestamp: schema.string({ pattern: timestampPattern }),
  title: schema.string({ maxLength: workbenchLimits.titleLength }),
  note: schema.string({ maxLength: workbenchLimits.noteLength }),

  textRun: schema.object([
    ['type', schema.string({ const: 'text' })],
    ['text', schema.string({ maxLength: workbenchLimits.textRunLength })]
  ]),

  mathRun: mathNode(),

  paragraph: schema.object([
    ['type', schema.string({ const: 'paragraph' })],
    ['runs', schema.array(
      () => schema.oneOf([primitives.textRun, primitives.mathRun]),
      { maxItems: workbenchLimits.paragraphRuns }
    )]
  ]),

  mathBlock: mathNode(),

  document: schema.object([
    ['version', schema.integer({ const: 1 })],
    ['blocks', schema.array(
      () => schema.oneOf([primitives.paragraph, primitives.mathBlock]),
      { maxItems: workbenchLimits.documentBlocks }
    )]
  ]),

  manualSource: schema.object([
    ['kind', schema.string({ const: 'manual' })]
  ]),

  pasteSource: schema.object([
    ['kind', schema.string({ const: 'paste' })],
    ['text', schema.string({ minLength: 1, maxLength: workbenchLimits.pasteSourceLength })]
  ]),

  createSource: schema.oneOf([() => primitives.manualSource, () => primitives.pasteSource])
};

primitives.snapshot = schema.object([
  ['title', () => primitives.title],
  ['body', () => primitives.document],
  ['solution', () => primitives.document]
]);

primitives.copySource = schema.object([
  ['kind', schema.string({ const: 'copy' })],
  ['questionId', () => primitives.id],
  ['questionVersion', () => primitives.version],
  ['snapshot', () => primitives.snapshot]
]);

primitives.source = schema.oneOf([
  () => primitives.manualSource,
  () => primitives.pasteSource,
  () => primitives.copySource
]);


export const contractSchemas = Object.freeze(primitives);
