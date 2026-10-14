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
import YAML from 'yaml';
import { fileURLToPath } from 'node:url';
import {
  assertModuleCatalog,
  assertModuleDependencies,
  moduleCatalog,
  projectModuleCatalog,
  validateModuleCatalog,
  defaultNavigation,
  includeNewNavigationModules,
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
  webEnabled: true,
  requires: [],
  ...overrides
});

test('the shared catalog matches the current five-module contract', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(repoRoot,'apps/api/test/fixtures/contracts/math-samples.json'))).find(s=>s.id==='catalog-combined-target');
  const expected = structuredClone(sample.value.items);
  assert.deepEqual(moduleCatalog, expected);
  assert.equal(validateModuleCatalog(moduleCatalog).length, 0);
  assert.equal(moduleCatalog.find(entry => entry.id === 'classroom').webEnabled, false);
  assert.equal(defaultNavigation().groups.flatMap(group => group.moduleIds).includes('classroom'), false);
  const empty = defaultNavigation([]);
  assert.equal(includeNewNavigationModules(empty).groups.flatMap(group => group.moduleIds).includes('classroom'), false);
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

  const missingWebAvailability = catalogEntry();
  delete missingWebAvailability.webEnabled;
  assert.ok(validateModuleCatalog([missingWebAvailability]).some(problem => problem.includes('missing required field webEnabled')));
  assert.ok(validateModuleCatalog([catalogEntry({ webEnabled: 'false' })]).some(problem => problem.includes('webEnabled must be a boolean')));

  const unknownField = validateModuleCatalog([catalogEntry({ extra: true })]);
  assert.ok(unknownField.some((problem) => problem.includes('unknown field extra')));

  assert.throws(() => assertModuleCatalog([catalogEntry({ id: 'A' })]), /Invalid module catalog/);
});

test('catalog projection enables only implemented modules and rejects orphans', () => {
  assert.deepEqual(projectModuleCatalog([]), { version: 4, items: [] });

  const scheduleOnly = projectModuleCatalog(['schedule']);
  assert.deepEqual(scheduleOnly.items.map(entry => entry.id), ['schedule']);
  assert.deepEqual(scheduleOnly.items[0].requires, []);
  assert.equal(projectModuleCatalog(['classroom']).items[0].webEnabled, false);

  assert.throws(
    () => projectModuleCatalog(['questions', 'unknown-module']),
    /without a catalog mapping: unknown-module/
  );

  assert.doesNotThrow(() => assertModuleDependencies(['questions', 'math', 'resources', 'schedule', 'classroom']));

});

test('shared paths, headers and limits match their OpenAPI schema fields', () => {
  const readContract = name => YAML.parse(fs.readFileSync(
    path.join(repoRoot, 'apps/api/src/contracts', name), 'utf8',
  ));
  const workbench = readContract('workbench.openapi.yaml');
  const schedule = readContract('schedule-v1.openapi.yaml');
  const auth = readContract('auth.openapi.yaml');
  const problems = new Set([
    ...workbench.components.schemas.Problem.oneOf.map(schema => schema.properties.type.const),
    ...schedule.components.schemas.Problem.properties.type.enum,
  ]);
  for (const type of Object.values(workbenchProblemTypes)) assert.ok(problems.has(type), type);
  assert.equal(auth.components.securitySchemes.SessionCookie.name, workbenchHeaders.sessionCookie);
  assert.equal(auth.components.parameters.BrowserRequestProtection.name, workbenchHeaders.browserProtection);
  assert.equal(workbench.components.parameters.IdempotencyKey.name, workbenchHeaders.idempotencyKey);
  assert.ok(workbench.paths[workbenchPaths.context]?.get);
  assert.ok(workbench.paths[workbenchPaths.modules]?.get);
  const schemas = workbench.components.schemas;
  assert.equal(schemas.Title.maxLength, workbenchLimits.titleLength);
  assert.equal(schemas.Note.maxLength, workbenchLimits.noteLength);
  assert.equal(schemas.MathRun.properties.latex.maxLength, workbenchLimits.latexLength);
  assert.equal(schemas.MathBlock.properties.latex.maxLength, workbenchLimits.latexLength);
  assert.equal(schemas.PasteSource.properties.text.maxLength, workbenchLimits.pasteSourceLength);
  assert.equal(schemas.Document.properties.blocks.maxItems, workbenchLimits.documentBlocks);
  assert.equal(schemas.Paragraph.properties.runs.maxItems, workbenchLimits.paragraphRuns);
  assert.equal(schemas.Version.maximum, Number.MAX_SAFE_INTEGER);
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
