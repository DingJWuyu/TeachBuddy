/**
 * Schedule HTTP wiring.
 *
 * Reads validate their query parameters before touching the account (unknown,
 * repeated and malformed query keys are contract rejections). Writes go through
 * the shared mutation handler, so the idempotency key and the atomic transaction
 * come from the frozen B11 transport; the service body runs inside it.
 */
import { Router } from 'express';
import { createMutationHandler, withPathId } from '../../workbench/http.js';
import { contractError, invalidInput, problems } from '../../workbench/problems.js';
import { validateIdPath } from '../../workbench/schema.js';
import {
  validateCreateEntry,
  validateCreateLabel,
  validateUpdateLabel,
  validateExceptionInput,
  validateMoveItem,
  validateSetDeletion,
  validateDeleteEntry,
  validateSettingsUpdate,
  validateUpdateEntry
} from './schema.js';
import { isDate } from './time.js';

function requirePrincipal(req) {
  const principal = req.workbenchPrincipal;
  if (!principal || typeof principal.accountKey !== 'string' || principal.accountKey.length === 0) {
    throw contractError(problems.unauthenticated());
  }
  return principal;
}

/** One query is one value: unknown, repeated and non-string keys are rejected. */
function validateQuery(query, allowed) {
  for (const key of Object.keys(query ?? {}).sort()) {
    if (!allowed.includes(key)) throw invalidInput(`/query/${key}`, 'unknown-field');
    const value = query[key];
    if (Array.isArray(value)) throw invalidInput(`/query/${key}`, 'duplicate-id');
    if (typeof value !== 'string') throw invalidInput(`/query/${key}`, 'invalid-type');
  }
}

function requireDateQuery(query, name) {
  const value = query[name];
  if (value === undefined) throw invalidInput(`/query/${name}`, 'required');
  if (!isDate(value)) throw invalidInput(`/query/${name}`, 'out-of-range');
  return value;
}

function requireEnumQuery(query, name, allowed, fallback) {
  const value = query[name];
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) throw invalidInput(`/query/${name}`, 'out-of-range');
  return value;
}

// A successful pre-retirement save can still be awaiting its browser receipt.
// Validate the surviving fields, but keep the original body for the existing
// idempotency fingerprint. Only an existing receipt may accept the old field;
// a new write still runs the current validator and rejects it.
function createEntryMutationHandler(options) {
  const retiredField = body => {
    if (body && Object.hasOwn(body, 'course')) return 'course';
    if (body?.mode === 'override' && body.content && Object.hasOwn(body.content, 'course')) return 'content';
    return null;
  };
  return createMutationHandler({
    ...options,
    validate(body, request) {
      const field = retiredField(body);
      if (!field) return options.validate(body, request);
      const current = structuredClone(body);
      if (field === 'content') delete current.content.course;
      else delete current.course;
      options.validate(current, request);
      return body;
    },
    write(input) {
      if (retiredField(input.body)) options.validate(input.body, input.request);
      return options.write(input);
    }
  });
}

export function createScheduleRouter({ service, mutations }) {
  const router = Router();

  router.get('/labels', (req, res) => {
    validateQuery(req.query, []);
    res.json(service.listLabels(requirePrincipal(req)));
  });
  router.post('/labels', createMutationHandler({ mutations, method: 'POST', validate: validateCreateLabel,
    write: ({ principal, body }) => ({ status: 201, body: service.createLabel(principal, body) }) }));
  router.put('/labels/:id', createMutationHandler({ mutations, method: 'PUT', validate: withPathId(validateUpdateLabel),
    write: ({ principal, body, request }) => ({ status: 200, body: service.updateLabel(principal, request.params.id, body) }) }));

  router.get('/settings', (req, res) => {
    validateQuery(req.query, []);
    res.json(service.getSettings(requirePrincipal(req)));
  });

  router.put('/settings', createMutationHandler({
    mutations,
    method: 'PUT',
    validate: validateSettingsUpdate,
    write: ({ principal, body }) => ({ status: 200, body: service.updateSettings(principal, body) })
  }));

  router.get('/entries', (req, res) => {
    validateQuery(req.query, ['state', 'placement']);
    const principal = requirePrincipal(req);
    const query = {
      state: requireEnumQuery(req.query, 'state', ['active', 'deleted'], 'active'),
      placement: requireEnumQuery(req.query, 'placement', ['all', 'unscheduled'], 'all')
    };
    res.json(service.listEntries(principal, query));
  });

  router.post('/entries', createEntryMutationHandler({
    mutations,
    method: 'POST',
    validate: validateCreateEntry,
    write: ({ principal, body }) => ({ status: 201, body: service.createEntry(principal, body) })
  }));

  router.get('/entries/:id', (req, res) => {
    validateIdPath(req.params.id);
    validateQuery(req.query, []);
    res.json(service.getEntry(requirePrincipal(req), req.params.id));
  });

  router.put('/entries/:id', createEntryMutationHandler({
    mutations,
    method: 'PUT',
    validate: withPathId(validateUpdateEntry),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.updateEntry(principal, request.params.id, body)
    })
  }));

  router.post('/entries/:id/delete', createMutationHandler({
    mutations,
    method: 'POST',
    validate: withPathId(validateDeleteEntry),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.deleteEntry(principal, request.params.id, body)
    })
  }));

  router.post('/entries/:id/deletion', createMutationHandler({
    mutations,
    method: 'POST',
    validate: withPathId(validateSetDeletion),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.setEntryDeletion(principal, request.params.id, body)
    })
  }));

  router.get('/entries/:id/exceptions', (req, res) => {
    validateIdPath(req.params.id);
    validateQuery(req.query, []);
    res.json(service.listExceptions(requirePrincipal(req), req.params.id));
  });

  router.put('/entries/:id/exceptions/:originDate', createEntryMutationHandler({
    mutations,
    method: 'PUT',
    validate: (body, request) => {
      validateIdPath(request.params.id);
      return validateExceptionInput(body);
    },
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.setException(principal, request.params.id, request.params.originDate, body)
    })
  }));

  router.post('/entries/:id/occurrences/:originDate/detach', createEntryMutationHandler({
    mutations,
    method: 'POST',
    validate: withPathId(validateUpdateEntry),
    write: ({ principal, body, request }) => ({
      status: 201,
      body: service.detachOccurrence(principal, request.params.id, request.params.originDate, body)
    })
  }));

  router.get('/entries/:id/occurrence', (req, res) => {
    validateIdPath(req.params.id);
    validateQuery(req.query, ['originDate']);
    const originDate = req.query.originDate;
    if (originDate !== undefined && !isDate(originDate)) {
      throw invalidInput('/query/originDate', 'out-of-range');
    }
    res.json(service.getOccurrence(requirePrincipal(req), req.params.id, { originDate: originDate ?? null }));
  });

  router.get('/occurrences', (req, res) => {
    validateQuery(req.query, ['from', 'to']);
    const principal = requirePrincipal(req);
    const from = requireDateQuery(req.query, 'from');
    const to = requireDateQuery(req.query, 'to');
    if (from > to) throw invalidInput('/query/from', 'out-of-range');
    res.json(service.listOccurrences(principal, { from, to }));
  });

  router.post('/item-moves', createMutationHandler({
    mutations,
    method: 'POST',
    validate: validateMoveItem,
    write: ({ principal, body }) => ({ status: 200, body: service.moveItem(principal, body) })
  }));

  return router;
}
