import express from 'express';
import Ajv from 'ajv';
import { defaultNavigation, validNavigation } from '@refatos/shared';
import { navigationUpdateSchema } from '../contracts/navigation.js';
import { createGuards, asyncHandler, createMutationHandler, createWorkbenchErrorHandler } from './http.js';
import { contractError, problems, invalidInput } from './problems.js';
import { validateNoQuery } from './schema.js';

export const navigationMigrations = [{ moduleId: 'workbench-navigation', migrations: [{
  id: 'workbench_navigation_001',
  up(db) { db.exec(`CREATE TABLE workbench_navigation (
    accountKey TEXT PRIMARY KEY, version INTEGER NOT NULL, layoutJson TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`); }
}] }];
const validateShape = new Ajv({ strict: true }).compile(navigationUpdateSchema);
function validate(body, request) {
  validateNoQuery(request.query);
  if (!validateShape(body)) {
    const error = validateShape.errors[0];
    const field = `${error.instancePath}${error.params.additionalProperty ? '/' + error.params.additionalProperty : error.params.missingProperty ? '/' + error.params.missingProperty : ''}`;
    throw invalidInput(field, error.keyword === 'additionalProperties' ? 'unknown-field' : error.keyword === 'required' ? 'required' : error.keyword === 'type' ? 'invalid-type' : 'out-of-range');
  }
  if (!validNavigation(body.layout)) throw invalidInput('/layout', 'out-of-range');
  return body;
}

export function readNavigation(db, principal, catalog) {
  const row = db.prepare('SELECT * FROM workbench_navigation WHERE accountKey=?').get(principal.accountKey);
  if (!row) return { id: 'navigation', version: 1, layout: defaultNavigation(catalog), updatedAt: null };
  const layout = JSON.parse(row.layoutJson);
  if (!validNavigation(layout)) throw new Error('Stored navigation is unreadable');
  return { id: 'navigation', version: row.version, layout, updatedAt: row.updatedAt };
}

export function createNavigationRouter({ db, mutations, identity, trustedOrigins, ready, logger, catalog, clock = () => new Date() }) {
  const router = express.Router();
  const guards = createGuards({ identity, trustedOrigins });
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/', guards.identityGuard, asyncHandler(async (req, res) => {
    await ready();
    validateNoQuery(req.query);
    res.json(readNavigation(db, req.workbenchPrincipal, catalog));
  }));
  router.put('/', guards.originGuard, guards.protectionGuard, guards.identityGuard,
    express.json({ limit: '256kb' }), asyncHandler(async (req, res, next) => { await ready(); next(); }),
    createMutationHandler({ mutations, method: 'PUT', validate, write({ principal, body }) {
      const current = readNavigation(db, principal, catalog);
      if (body.baseVersion !== current.version) throw contractError(problems.versionConflict(current.version));
      const next = { id: 'navigation', version: current.version + 1, layout: body.layout, updatedAt: clock().toISOString() };
      db.prepare(`INSERT INTO workbench_navigation VALUES (?, ?, ?, ?)
        ON CONFLICT(accountKey) DO UPDATE SET version=excluded.version, layoutJson=excluded.layoutJson, updatedAt=excluded.updatedAt`)
        .run(principal.accountKey, next.version, JSON.stringify(next.layout), next.updatedAt);
      return { status: 200, body: next };
    } }));
  router.use(createWorkbenchErrorHandler({ logger }));
  return router;
}
