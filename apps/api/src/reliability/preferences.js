import express from 'express';
import { createGuards, asyncHandler, createMutationHandler, createWorkbenchErrorHandler } from '../workbench/http.js';
import { contractError, problems, invalidInput } from '../workbench/problems.js';

export const preferenceMigrations = [{ moduleId: 'reliability-preferences', migrations: [{
  id: 'reliability_preferences_001',
  up(db) { db.exec(`CREATE TABLE reliability_preferences (
    accountKey TEXT PRIMARY KEY, version INTEGER NOT NULL, valuesJson TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`); }
}] }];

const defaults = { readingSize: 'standard', motion: 'system', externalAi: 'deepseek' };
function validate(body, request) {
  if (Object.keys(request.query).length) throw invalidInput('/query', 'unknown-field');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalidInput('/', 'invalid-type');
  for (const name of Object.keys(body)) if (!['baseVersion', 'values'].includes(name)) throw invalidInput(`/${name}`, 'unknown-field');
  if (!Number.isSafeInteger(body.baseVersion) || body.baseVersion < 1) throw invalidInput('/baseVersion', 'out-of-range');
  const values = body.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw invalidInput('/values', 'invalid-type');
  for (const name of Object.keys(values)) if (!Object.hasOwn(defaults, name)) throw invalidInput(`/values/${name}`, 'unknown-field');
  for (const [name, choices] of Object.entries({ readingSize: ['standard', 'large'], motion: ['system', 'reduce'], externalAi: ['deepseek', 'doubao'] })) {
    if (!choices.includes(values[name])) throw invalidInput(`/values/${name}`, 'out-of-range');
  }
  return body;
}

export function createPreferencesRouter({ db, mutations, identity, trustedOrigins, ready, logger, clock = () => new Date() }) {
  const router = express.Router();
  const guards = createGuards({ identity, trustedOrigins });
  function read(principal) {
    const row = db.prepare('SELECT * FROM reliability_preferences WHERE accountKey = ?').get(principal.accountKey);
    return row ? { version: row.version, values: JSON.parse(row.valuesJson), updatedAt: row.updatedAt }
      : { version: 1, values: { ...defaults }, updatedAt: null };
  }
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/preferences', guards.identityGuard, asyncHandler(async (req, res) => {
    await ready();
    if (Object.keys(req.query).length) throw invalidInput('/query', 'unknown-field');
    res.json(read(req.workbenchPrincipal));
  }));
  router.put('/preferences', guards.originGuard, guards.protectionGuard, guards.identityGuard,
    express.json({ limit: '16kb' }), asyncHandler(async (req, res, next) => { await ready(); next(); }),
    createMutationHandler({ mutations, method: 'PUT', validate, write({ principal, body }) {
      const current = read(principal);
      if (body.baseVersion !== current.version) throw contractError(problems.versionConflict(current.version));
      const next = { version: current.version + 1, values: body.values, updatedAt: clock().toISOString() };
      db.prepare(`INSERT INTO reliability_preferences VALUES (?, ?, ?, ?)
        ON CONFLICT(accountKey) DO UPDATE SET version=excluded.version, valuesJson=excluded.valuesJson, updatedAt=excluded.updatedAt`)
        .run(principal.accountKey, next.version, JSON.stringify(next.values), next.updatedAt);
      return { status: 200, body: next };
    } }));
  router.use(createWorkbenchErrorHandler({ logger }));
  return router;
}
