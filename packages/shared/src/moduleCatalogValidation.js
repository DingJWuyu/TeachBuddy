/**
 * Build-time and startup checks for the single static module catalog.
 *
 * `validateModuleCatalog` answers the frozen build questions: missing mapping,
 * duplicate ID/path, missing dependency, and dependency cycles. It returns
 * human-readable problems instead of throwing so the build script can print
 * every problem at once; `assertModuleCatalog` turns the same list into an
 * error for startup composition.
 */
import {
  moduleCatalog,
  moduleCatalogIdPattern,
  moduleCatalogNavigationValues,
  moduleCatalogPathPattern,
  moduleCatalogVersion,
  modulePorts
} from './moduleCatalog.js';

const descriptorFields = ['id', 'name', 'path', 'navigation', 'auxiliaryPanel', 'webEnabled', 'requires'];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function describeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Structural and dependency checks for one catalog. `entries` defaults to the
 * frozen catalog; pass a test catalog to check fixtures.
 */
export function validateModuleCatalog(entries = moduleCatalog) {
  const problems = [];

  if (!Array.isArray(entries)) {
    return ['module catalog must be an array of descriptors'];
  }

  const seenIds = new Map();
  const seenPaths = new Map();

  entries.forEach((entry, index) => {
    const at = `catalog[${index}]`;
    if (!isPlainObject(entry)) {
      problems.push(`${at} must be an object, received ${describeType(entry)}`);
      return;
    }

    for (const field of Object.keys(entry)) {
      if (!descriptorFields.includes(field)) {
        problems.push(`${at} has unknown field ${field}`);
      }
    }
    for (const field of descriptorFields) {
      if (!(field in entry)) {
        problems.push(`${at} is missing required field ${field}`);
      }
    }

    if (typeof entry.id !== 'string' || !moduleCatalogIdPattern.test(entry.id)) {
      problems.push(`${at}.id must match ${moduleCatalogIdPattern}`);
    } else if (seenIds.has(entry.id)) {
      problems.push(`${at}.id duplicates catalog[${seenIds.get(entry.id)}].id (${entry.id})`);
    } else {
      seenIds.set(entry.id, index);
    }

    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      problems.push(`${at}.name must be a non-empty string`);
    }

    if (typeof entry.path !== 'string' || !moduleCatalogPathPattern.test(entry.path)) {
      problems.push(`${at}.path must match ${moduleCatalogPathPattern}`);
    } else if (seenPaths.has(entry.path)) {
      problems.push(`${at}.path duplicates catalog[${seenPaths.get(entry.path)}].path (${entry.path})`);
    } else {
      seenPaths.set(entry.path, index);
    }

    if (!moduleCatalogNavigationValues.includes(entry.navigation)) {
      problems.push(`${at}.navigation must be one of ${moduleCatalogNavigationValues.join(', ')}`);
    }

    if (typeof entry.webEnabled !== 'boolean') {
      problems.push(`${at}.webEnabled must be a boolean`);
    }

    if (typeof entry.auxiliaryPanel !== 'boolean') {
      problems.push(`${at}.auxiliaryPanel must be a boolean`);
    }

    if (!Array.isArray(entry.requires)) {
      problems.push(`${at}.requires must be an array`);
      return;
    }

    const seenRequires = new Set();
    for (const requiredPort of entry.requires) {
      if (typeof requiredPort !== 'string' || !modulePorts[requiredPort]) {
        problems.push(`${at}.requires contains unknown port ${JSON.stringify(requiredPort)} (missing dependency)`);
        continue;
      }
      if (seenRequires.has(requiredPort)) {
        problems.push(`${at}.requires repeats port ${requiredPort}`);
      }
      seenRequires.add(requiredPort);
    }
  });

  problems.push(...findDependencyCycles(entries, seenIds));
  return problems;
}

function findDependencyCycles(entries, seenIds) {
  const problems = [];
  const edges = new Map();

  for (const entry of entries) {
    if (!isPlainObject(entry) || typeof entry.id !== 'string' || !Array.isArray(entry.requires)) continue;
    const targets = [];
    for (const requiredPort of entry.requires) {
      const provider = typeof requiredPort === 'string' ? modulePorts[requiredPort]?.provider : null;
      if (!provider) continue;
      if (!seenIds.has(provider)) {
        problems.push(`catalog entry ${entry.id} requires ${requiredPort} but provider ${provider} is not in the catalog (missing dependency)`);
        continue;
      }
      if (provider === entry.id) {
        problems.push(`catalog entry ${entry.id} requires its own port ${requiredPort} (cycle)`);
        continue;
      }
      targets.push(provider);
    }
    edges.set(entry.id, targets);
  }

  const visiting = new Set();
  const visited = new Set();

  function walk(id, trail) {
    if (visiting.has(id)) {
      problems.push(`module dependency cycle: ${[...trail, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of edges.get(id) ?? []) walk(next, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of edges.keys()) walk(id, []);
  return problems;
}

export function assertModuleCatalog(entries = moduleCatalog) {
  const problems = validateModuleCatalog(entries);
  if (problems.length) {
    const error = new Error(`Invalid module catalog:\n- ${problems.join('\n- ')}`);
    let field = '/items';
    let reason = 'invalid-reference';
    const ids = new Set();
    const paths = new Set();
    for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
      if (ids.has(entry?.id) || paths.has(entry?.path)) {
        field = `/items/${index}/${ids.has(entry?.id) ? 'id' : 'path'}`;
        reason = 'duplicate-id';
        break;
      }
      ids.add(entry?.id);
      paths.add(entry?.path);
    }
    if (reason !== 'duplicate-id' && Array.isArray(entries)) {
      outer: for (const [index, entry] of entries.entries()) {
        for (const [position, port] of (Array.isArray(entry?.requires) ? entry.requires : []).entries()) {
          if (!modulePorts[port] || !ids.has(modulePorts[port].provider)) {
            field = `/items/${index}/requires/${position}`;
            break outer;
          }
        }
      }
    }
    error.status = 422;
    error.problem = { type: '/problems/workbench/invalid-input', field, reason };
    throw error;
  }
  return entries;
}

/**
 * Project the catalog to the runtime shape returned by GET /api/modules and to
 * the Web shell's local mapping. `enabledIds` are the implementations actually
 * imported by this side; an id without a catalog entry is a build/startup
 * failure, and a catalog entry without an implementation is simply not
 * enabled yet (parallel work keeps the two sides independent).
 */
export function projectModuleCatalog(enabledIds, entries = moduleCatalog) {
  assertModuleCatalog(entries);
  const enabled = new Set(enabledIds);
  const ownIds = new Set(entries.map((entry) => entry.id));

  const unknown = [...enabled].filter((id) => !ownIds.has(id));
  if (unknown.length) {
    throw new Error(`Module implementations without a catalog mapping: ${unknown.join(', ')}`);
  }

  return {
    version: moduleCatalogVersion,
    items: entries.filter((entry) => enabled.has(entry.id)).map((entry) => ({
      id: entry.id,
      name: entry.name,
      path: entry.path,
      navigation: entry.navigation,
      auxiliaryPanel: entry.auxiliaryPanel,
      webEnabled: entry.webEnabled,
      requires: [...entry.requires]
    }))
  };
}

/**
 * Every dependency of an enabled module must be enabled too. This is the
 * startup check that prevents an unavailable provider from failing on the
 * first cross-module read.
 */
export function assertModuleDependencies(enabledIds, entries = moduleCatalog) {
  assertModuleCatalog(entries);
  const enabled = new Set(enabledIds);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  for (const id of enabled) {
    const entry = byId.get(id);
    for (const requiredPort of entry?.requires ?? []) {
      const provider = modulePorts[requiredPort]?.provider;
      if (!provider) continue;
      if (!enabled.has(provider)) {
        throw new Error(`Module ${id} requires ${requiredPort} but provider module ${provider} is not enabled.`);
      }
    }
  }
}
