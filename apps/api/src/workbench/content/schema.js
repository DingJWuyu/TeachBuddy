import fs from 'node:fs';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { invalidInput } from '../problems.js';

// The frozen YAML is the sole schema source. Walk objects in declaration order
// so unrelated union branches cannot change B11's first-error field/reason.
const root = new URL('../../contracts/', import.meta.url);
const documents = new Map(
  ['workbench.openapi.yaml', 'materials.openapi.yaml'].map((name) => [
    name,
    YAML.parse(fs.readFileSync(new URL(name, root), 'utf8'))
  ])
);
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validators = new WeakMap();
const pointer = (base, key) => `${base}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
function resolve(schema, file) {
  if (!schema.$ref) return { schema, file };
  const [external, fragment] = schema.$ref.split('#');
  const target = external ? external.replace(/^\.\//, '') : file;
  let value = documents.get(target);
  for (const key of fragment.slice(1).split('/')) value = value[key];
  return resolve(value, target);
}
function matchesType(schema, value) {
  if (!schema.type) return true;
  if (Array.isArray(schema.type)) return schema.type.some(type => matchesType({ type }, value));
  if (schema.type === 'null') return value === null;
  if (schema.type === 'array') return Array.isArray(value);
  if (schema.type === 'object')
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (schema.type === 'integer') return Number.isInteger(value);
  return typeof value === schema.type;
}
function walk(input, value, field, source) {
  const { schema, file } = resolve(input, source);
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives) {
    const variants = alternatives.map((item) => resolve(item, file));
    for (const key of ['version', 'type', 'kind']) {
      if (variants.every((v) => v.schema.properties?.[key]?.const !== undefined)) {
        const chosen = variants.find((v) => v.schema.properties[key].const === value?.[key]);
        if (!chosen)
          throw invalidInput(
            pointer(field, key),
            value?.[key] === undefined
              ? 'required'
              : key === 'kind'
                ? 'out-of-range'
                : 'unsupported-content-version'
          );
        return walk(chosen.schema, value, field, chosen.file);
      }
    }
    const candidates = variants.filter((v) => matchesType(v.schema, value));
    if (candidates.length === 1)
      return walk(candidates[0].schema, value, field, candidates[0].file);
    let first;
    for (const candidate of candidates) {
      try {
        return walk(candidate.schema, value, field, candidate.file);
      } catch (error) {
        first ??= error;
      }
    }
    throw first ?? invalidInput(field, 'invalid-type');
  }
  if (!matchesType(schema, value)) throw invalidInput(field, 'invalid-type');
  if (schema.type === 'object') {
    const fields = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(value)
        .filter((key) => !Object.hasOwn(fields, key))
        .sort()[0];
      if (unknown !== undefined) throw invalidInput(pointer(field, unknown), 'unknown-field');
    }
    for (const [key, child] of Object.entries(fields)) {
      if (!Object.hasOwn(value, key)) {
        if (schema.required?.includes(key)) throw invalidInput(pointer(field, key), 'required');
      } else walk(child, value[key], pointer(field, key), file);
    }
    return value;
  }
  if (schema.type === 'array') {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity))
      throw invalidInput(field, 'out-of-range');
    value.forEach((item, i) => walk(schema.items, item, pointer(field, i), file));
    return value;
  }
  if (!validators.has(schema)) validators.set(schema, ajv.compile(schema));
  const validate = validators.get(schema);
  if (!validate(value)) {
    const error = validate.errors[0];
    const reason =
      error.keyword === 'type'
        ? 'invalid-type'
        : error.keyword === 'minLength' && value === ''
          ? 'empty-content'
          : error.keyword === 'const' && /\/(type|version)$/.test(field)
            ? 'unsupported-content-version'
            : 'out-of-range';
    throw invalidInput(field, reason);
  }
  return value;
}
export function validateSchema(name, value, field = '') {
  return walk(
    documents.get('materials.openapi.yaml').components.schemas[name],
    value,
    field,
    'materials.openapi.yaml'
  );
}
