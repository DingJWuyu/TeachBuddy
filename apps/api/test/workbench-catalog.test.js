/**
 * Static module catalog (ADR 0001) checks: the frozen entries, the build-time
 * problems the catalog must catch, and the loader's missing-mapping /
 * missing-dependency behavior. No stub module is registered anywhere: catalog
 * entries are enabled only when an implementation directory exists.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertModuleCatalog,
  assertModuleDependencies,
  moduleCatalog,
  projectModuleCatalog,
  validateModuleCatalog,
  workbenchHeaders,
  workbenchLimits,
  workbenchPaths,
  workbenchProblemTypes
} from '@refatos/shared';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
import { createModuleLoader, factoryNameFor } from '../src/workbench/moduleLoader.js';

const catalogEntry = (overrides = {}) => ({
  id: 'a',
  name: 'A',
  path: '/a',
  navigation: 'sidebar',
  auxiliaryPanel: false,
  requires: [],
  ...overrides
});

test('the shared catalog matches the current four-module contract', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(repoRoot,'apps/api/test/fixtures/contracts/math-samples.json'))).find(s=>s.id==='catalog-combined-target');
  const expected = structuredClone(sample.value.items);
  assert.deepEqual(moduleCatalog, expected);
  assert.equal(validateModuleCatalog(moduleCatalog).length, 0);
});

test('catalog validation reports duplicates, missing dependencies and cycles', () => {
  const duplicates = validateModuleCatalog([
    catalogEntry(),
    catalogEntry({ id: 'a', name: 'B', path: '/b' })
  ]);
  assert.ok(duplicates.some((problem) => problem.includes('duplicates catalog[0].id')));

  const duplicatePath = validateModuleCatalog([
    catalogEntry({ path: '/same' }),
    catalogEntry({ id: 'b', name: 'B', path: '/same' })
  ]);
  assert.ok(duplicatePath.some((problem) => problem.includes('duplicates catalog[0].path')));

  const unknownPort = validateModuleCatalog([catalogEntry({ requires: ['a.missing'] })]);
  assert.ok(unknownPort.some((problem) => problem.includes('unknown port')));

  const unknownField = validateModuleCatalog([catalogEntry({ extra: true })]);
  assert.ok(unknownField.some((problem) => problem.includes('unknown field extra')));

  assert.throws(() => assertModuleCatalog([catalogEntry({ id: 'A' })]), /Invalid module catalog/);
});

test('catalog projection enables only implemented modules and rejects orphans', () => {
  assert.deepEqual(projectModuleCatalog([]), { version: 3, items: [] });

  const scheduleOnly = projectModuleCatalog(['schedule']);
  assert.deepEqual(scheduleOnly.items.map(entry => entry.id), ['schedule']);
  assert.deepEqual(scheduleOnly.items[0].requires, []);

  assert.throws(
    () => projectModuleCatalog(['questions', 'unknown-module']),
    /without a catalog mapping: unknown-module/
  );

  assert.doesNotThrow(() => assertModuleDependencies(['questions', 'math', 'resources', 'schedule']));

});

test('the shared contract vocabulary stays in the frozen OpenAPI documents', () => {
  const openapi = fs.readFileSync(
    path.join(repoRoot, 'apps', 'api', 'src', 'contracts', 'workbench.openapi.yaml'),
    'utf-8'
  );
  const allOpenapi = openapi + fs.readFileSync(path.join(repoRoot,'apps/api/src/contracts/schedule-v1.openapi.yaml'),'utf8');
  const authOpenapi = fs.readFileSync(
    path.join(repoRoot, 'apps', 'api', 'src', 'contracts', 'auth.openapi.yaml'),
    'utf-8'
  );

  for (const problemType of Object.values(workbenchProblemTypes)) {
    assert.ok(allOpenapi.includes(problemType), `problem type ${problemType} is missing from the frozen OpenAPI`);
  }
  for (const authVocabulary of [workbenchHeaders.sessionCookie, workbenchHeaders.browserProtection]) {
    assert.ok(
      authOpenapi.includes(authVocabulary),
      `${authVocabulary} is missing from the frozen auth OpenAPI`
    );
  }
  assert.ok(
    openapi.includes(workbenchHeaders.idempotencyKey),
    `header ${workbenchHeaders.idempotencyKey} is missing from the frozen OpenAPI`
  );
  assert.ok(openapi.includes(workbenchPaths.context), 'the context path is missing from the frozen OpenAPI');
  assert.ok(openapi.includes(workbenchPaths.modules), 'the module path is missing from the frozen OpenAPI');

  const frozenLimits = [
    `maxLength: ${workbenchLimits.titleLength}`,
    `maxLength: ${workbenchLimits.noteLength}`,
    `maxLength: ${workbenchLimits.latexLength}`,
    `maxLength: ${workbenchLimits.pasteSourceLength}`,
    `maxItems: ${workbenchLimits.documentBlocks}`,
    `maxItems: ${workbenchLimits.paragraphRuns}`,
    `maximum: ${Number.MAX_SAFE_INTEGER}`
  ];
  for (const expected of frozenLimits) {
    assert.ok(openapi.includes(expected), `${expected} is missing from the frozen OpenAPI`);
  }
});

test('the loader refuses an implementation without a catalog mapping', async () => {
  const loader = createModuleLoader({
    implementations: {
      'unknown-module': { factory: async () => ({ createUnknownModuleModule: () => ({ router() {} }) }) }
    },
    dependencies: {}
  });
  await assert.rejects(loader.discover(), /has no catalog mapping/);
});

test('the loader names factories by convention and requires {router, port}', async () => {
  assert.equal(factoryNameFor('workbench-probe'), 'createWorkbenchProbeModule');
  assert.equal(factoryNameFor('teaching-time'), 'createTeachingTimeModule');

  const wrongShape = createModuleLoader({
    implementations: {
      questions: { factory: async () => ({ createQuestionsModule: () => ({}) }) }
    },
    dependencies: {}
  });
  await assert.rejects(wrongShape.instantiate(), /factory must return \{router, port\}/);

  const wrongName = createModuleLoader({
    implementations: {
      questions: { factory: async () => ({ notTheFactory: () => ({ router() {}, port: {} }) }) }
    },
    dependencies: {}
  });
  await assert.rejects(wrongName.instantiate(), /must export createQuestionsModule/);
});

test('the loader passes shared dependencies to enabled module factories', async () => {
  const loader = createModuleLoader({
    implementations: { questions: { factory: async () => ({ createQuestionsModule: ({ db, mutations }) => ({ router() {}, port: { db, mutations } }) }) } },
    dependencies: { db: { name: 'db' }, mutations: { name: 'mutations' } }
  });
  await loader.instantiate();
  assert.deepEqual(loader.enabledIds(), ['questions']);
  assert.equal(loader.get('questions').port.mutations.name, 'mutations');
  assert.equal(loader.get('questions').port.db.name, 'db');
});
