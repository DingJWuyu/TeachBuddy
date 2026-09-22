/**
 * Build check for the single static module catalog (ADR 0001).
 *
 * Run by `npm run build:shared` before the API and Web builds. It fails the
 * build for: duplicate ID/path, missing dependency, dependency cycle, a module
 * implementation directory without a compile-time mapping, and a mapping or
 * catalog module missing its entry file. It deliberately does not require every
 * catalog entry to have an implementation yet: an entry is enabled only when it
 * is mapped in `moduleImplementations.js`, so parallel module work stays
 * independent and no stub module is needed to make the build pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertModuleCatalog,
  moduleCatalog,
  mathSupportCatalog,
  projectModuleCatalog
} from '../src/index.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const problems = [];

function listDirectories(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

const catalogProblems = [];
try {
  assertModuleCatalog(moduleCatalog);
  assertModuleCatalog(mathSupportCatalog);
} catch (error) {
  catalogProblems.push(...String(error.message).split('\n').slice(1).map((line) => line.replace(/^- /, '')));
}

const catalogIds = new Set(mathSupportCatalog.map((entry) => entry.id));

// API side: the compile-time map is the only way a module becomes enabled.
const apiModulesDir = path.join(repoRoot, 'apps', 'api', 'src', 'modules');
const implementationEntry = path.join(repoRoot, 'apps', 'api', 'src', 'workbench', 'moduleImplementations.js');
let apiImplemented = [];
if (!fs.existsSync(implementationEntry)) {
  problems.push('apps/api/src/workbench/moduleImplementations.js is missing the compile-time module mapping');
} else {
  const { moduleImplementations, mathSupportImplementations } = await import(pathToFileURL(implementationEntry).href);
  projectModuleCatalog(Object.keys(moduleImplementations ?? {}), moduleCatalog);
  apiImplemented = Object.keys(mathSupportImplementations ?? {});
  for (const moduleId of apiImplemented) {
    if (!catalogIds.has(moduleId)) {
      problems.push(`moduleImplementations.${moduleId} has no catalog mapping (unknown module ID)`);
      continue;
    }
    if (!fs.existsSync(path.join(apiModulesDir, moduleId, 'index.js'))) {
      problems.push(`moduleImplementations.${moduleId} is missing apps/api/src/modules/${moduleId}/index.js`);
    }
  }
  for (const moduleId of listDirectories(apiModulesDir)) {
    if (!catalogIds.has(moduleId)) {
      problems.push(`apps/api/src/modules/${moduleId} has no catalog mapping (unknown module ID)`);
      continue;
    }
    if (!apiImplemented.includes(moduleId)) {
      problems.push(`apps/api/src/modules/${moduleId} has no entry in moduleImplementations.js (missing mapping)`);
    }
  }
}

// Web side: apps/web/src/features/<id>/index.jsx for catalog module IDs.
const webFeaturesDir = path.join(repoRoot, 'apps', 'web', 'src', 'features');
const webImplemented = [];
for (const featureName of listDirectories(webFeaturesDir)) {
  if (!catalogIds.has(featureName)) continue;
  if (!fs.existsSync(path.join(webFeaturesDir, featureName, 'index.jsx'))) {
    problems.push(`apps/web/src/features/${featureName} is missing index.jsx`);
    continue;
  }
  webImplemented.push(featureName);
}

for (const [side, implemented] of [['API', apiImplemented], ['Web', webImplemented]]) {
  try {
    projectModuleCatalog(implemented, mathSupportCatalog);
  } catch (error) {
    problems.push(`${side} projection: ${error.message}`);
  }
}

if (catalogProblems.length || problems.length) {
  console.error('Module catalog check failed:');
  for (const problem of [...catalogProblems, ...problems]) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  `Module catalog ok: default ${moduleCatalog.length}, isolated math ${mathSupportCatalog.length} entries, `
  + `API implementations [${apiImplemented.join(', ')}], `
  + `Web implementations [${webImplemented.join(', ')}]`
);
