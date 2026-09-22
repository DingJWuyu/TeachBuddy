/**
 * Shared schema consumption.
 *
 * The workbench exposes the frozen OpenAPI's cross-module value shapes
 * (documents, snapshots, sources, references) plus the validator that fixes the
 * single-error selection. B13's operation envelopes are built from these; these
 * tests pin the behavior a consumer can rely on.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { contractSchemas, schema, validateBody, validateSchema } from '../src/workbench/schema.js';

function expectError(node, value, field, reason) {
  const result = validateSchema(node, value);
  assert.equal(result.ok, false, `expected a validation error at ${field}`);
  assert.deepEqual(result.error, { field, reason });
}

const paragraph = (text) => ({ type: 'paragraph', runs: [{ type: 'text', text }] });

test('a well-formed document passes with inline and block math', () => {
  const document = {
    version: 1,
    blocks: [
      {
        type: 'paragraph',
        runs: [
          { type: 'text', text: '已知函数 ' },
          { type: 'math', latex: 'f(x)=x^2-2x' },
          { type: 'text', text: '，求最小值。' }
        ]
      },
      { type: 'math', latex: 'f(x)=(x-1)^2-1\\geq -1' }
    ]
  };
  assert.equal(validateSchema(contractSchemas.document, document).ok, true);
  assert.equal(validateSchema(contractSchemas.document, { version: 1, blocks: [] }).ok, true);
});

test('an unknown document version or node type is an unsupported content version', () => {
  expectError(
    contractSchemas.document,
    { version: 2, blocks: [] },
    '/version',
    'unsupported-content-version'
  );
  expectError(
    contractSchemas.document,
    { version: 1, blocks: [{ type: 'image', src: 'x' }] },
    '/blocks/0/type',
    'unsupported-content-version'
  );
});

test('document errors pick the deepest, first-in-order location', () => {
  // Missing latex on the math run is deeper than the paragraph discriminant,
  // so the math variant's error wins.
  expectError(
    contractSchemas.document,
    { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'math' }] }] },
    '/blocks/0/runs/0/latex',
    'required'
  );
  expectError(
    contractSchemas.document,
    { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'math', latex: '' }] }] },
    '/blocks/0/runs/0/latex',
    'empty-content'
  );
  expectError(
    contractSchemas.document,
    { version: 1, blocks: new Array(1001).fill(paragraph('x')) },
    '/blocks',
    'out-of-range'
  );
  expectError(
    contractSchemas.document,
    { version: 1, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: 'ok', extra: 1 }] }] },
    '/blocks/0/runs/0/extra',
    'unknown-field'
  );
});

test('sources accept the frozen kinds and reject an unknown one', () => {
  assert.equal(validateSchema(contractSchemas.createSource, { kind: 'manual' }).ok, true);
  assert.equal(
    validateSchema(contractSchemas.createSource, { kind: 'paste', text: '原稿\n换行' }).ok,
    true
  );
  assert.equal(validateSchema(contractSchemas.source, {
    kind: 'copy',
    questionId: '00000000-0000-4000-8000-000000000001',
    questionVersion: 1,
    snapshot: {
      title: '题',
      body: { version: 1, blocks: [paragraph('题面')] },
      solution: { version: 1, blocks: [paragraph('-1')] }
    }
  }).ok, true);
  expectError(contractSchemas.createSource, { kind: 'scan' }, '/kind', 'out-of-range');
  expectError(contractSchemas.createSource, { kind: 'paste', text: '' }, '/text', 'empty-content');
});

test('reference and section inputs use the shared ID, version and note shapes', () => {
  const reference = {
    id: '00000000-0000-4000-8000-000000000010',
    questionId: '00000000-0000-4000-8000-000000000001',
    questionVersion: 2,
    note: '本课备注'
  };
  assert.equal(validateSchema(contractSchemas.referenceInput, reference).ok, true);
  expectError(
    contractSchemas.referenceInput,
    { ...reference, questionVersion: 0 },
    '/questionVersion',
    'out-of-range'
  );
  expectError(
    contractSchemas.referenceInput,
    { ...reference, id: 'not-a-uuid' },
    '/id',
    'out-of-range'
  );
  expectError(
    contractSchemas.referenceInput,
    { ...reference, questionId: reference.questionId, snapshot: {} },
    '/snapshot',
    'unknown-field'
  );

  const section = { id: reference.id, title: '环节一', content: { version: 1, blocks: [] }, references: [reference] };
  assert.equal(validateSchema(contractSchemas.sectionInput, section).ok, true);
  // A blank section title is out-of-range in both spellings: fields are
  // validated, never trimmed.
  expectError(contractSchemas.sectionInput, { ...section, title: '   ' }, '/title', 'out-of-range');
  expectError(contractSchemas.sectionInput, { ...section, title: '' }, '/title', 'out-of-range');
});

test('the boolean branch matches the frozen starred field', () => {
  assert.equal(validateSchema(schema.boolean(), true).ok, true);
  assert.equal(validateSchema(schema.boolean(), false).ok, true);
  expectError(schema.boolean(), 'true', '', 'invalid-type');
});

test('scalar primitives reject implicit conversion and empty content', () => {
  assert.equal(validateSchema(contractSchemas.title, '').ok, true);
  expectError(contractSchemas.title, 'x'.repeat(201), '', 'out-of-range');
  expectError(contractSchemas.version, '1', '', 'invalid-type');
  expectError(contractSchemas.timestamp, '2026-09-21 10:00:00', '', 'out-of-range');
  assert.equal(validateSchema(contractSchemas.timestamp, '2026-09-21T10:00:00.000Z').ok, true);
});

test('validateBody throws the contract 422 problem a module can reuse', () => {
  const node = schema.object([['value', schema.string({ minLength: 1 })]]);
  assert.deepEqual(validateBody(node, { value: 'ok' }), { value: 'ok' });
  assert.throws(
    () => validateBody(node, { value: '' }),
    (error) => error.status === 422
      && error.problem.type === '/problems/workbench/invalid-input'
      && error.problem.field === '/value'
      && error.problem.reason === 'empty-content'
  );
});
