// HTTP wiring for classes, records and reverse feedback.
//
// The shared workbench transport owns identity, the request pipeline and
// problem mapping; this router supplies each operation's request schema and
// turns validated requests into idempotent business writes. Paths and queries
// are validated before any business state is touched.
import { Router } from 'express';
import { createMutationHandler, withPathId } from '../../workbench/http.js';
import { validateIdPath, validateNoQuery } from '../../workbench/schema.js';
import { problems } from '../../workbench/problems.js';
import { contractError } from './contract.js';
import {
  validateClassesQuery,
  validateCreateClass,
  validateCreateRecord,
  validateCreateRecordV2,
  validateUpdateRecordV2,
  validateDeletion,
  validatePurgeClass,
  validateRecordsQuery,
  validateSourceRecordsPath,
  validateUpdateClass,
  validateUpdateRecord
} from './schema.js';

function requirePrincipal(req) {
  const principal = req.workbenchPrincipal;
  if (!principal || typeof principal.accountKey !== 'string' || principal.accountKey.length === 0) {
    throw contractError(problems.unauthenticated());
  }
  return principal;
}

export function createClassesRouter({ service, mutations, version = 1 }) {
  const router = Router();
  const recordService = version === 2 ? {
    listRecords: service.listRecordsV2, getRecord: service.getRecordV2,
    createRecord: service.createRecordV2, updateRecord: service.updateRecordV2,
    setRecordDeletion: service.setRecordDeletionV2, listSourceRecords: service.listSourceRecordsV2
  } : service;

  if (version === 1) {
    router.get('/items', (req, res) => {
      const query = validateClassesQuery(req.query);
      res.json(service.listClasses(requirePrincipal(req), query));
    });

    router.post('/items', createMutationHandler({
      mutations,
      method: 'POST',
      validate: validateCreateClass,
      write: ({ principal, body }) => ({
        status: 201,
        body: service.createClass(principal, body)
      })
    }));

    router.get('/items/:id', (req, res) => {
      validateIdPath(req.params.id);
      validateNoQuery(req.query);
      res.json(service.getClass(requirePrincipal(req), req.params.id));
    });

    router.put('/items/:id', createMutationHandler({
      mutations,
      method: 'PUT',
      validate: withPathId(validateUpdateClass),
      write: ({ principal, body, request }) => ({
        status: 200,
        body: service.updateClass(principal, request.params.id, body)
      })
    }));

    router.post('/items/:id/deletion', createMutationHandler({
      mutations,
      method: 'POST',
      validate: withPathId(validateDeletion),
      write: ({ principal, body, request }) => ({
        status: 200,
        body: service.setClassDeletion(principal, request.params.id, body)
      })
    }));

    router.post('/items/:id/purge', createMutationHandler({
      mutations,
      method: 'POST',
      validate: withPathId(validatePurgeClass),
      write: ({ principal, body, request }) => ({ status: 200,
        body: service.purgeClass(principal, request.params.id, body) })
    }));

  }

  router.get('/records', (req, res) => {
    const query = validateRecordsQuery(req.query);
    res.json(recordService.listRecords(requirePrincipal(req), query));
  });

  router.post('/records', createMutationHandler({
    mutations,
    method: 'POST',
    validate: version === 2 ? validateCreateRecordV2 : validateCreateRecord,
    write: ({ principal, body }) => ({
      status: 201,
      body: recordService.createRecord(principal, body)
    })
  }));

  router.get('/records/:id', (req, res) => {
    validateIdPath(req.params.id);
    validateNoQuery(req.query);
    res.json(recordService.getRecord(requirePrincipal(req), req.params.id));
  });

  router.put('/records/:id', createMutationHandler({
    mutations,
    method: 'PUT',
    validate: withPathId(version === 2 ? validateUpdateRecordV2 : validateUpdateRecord),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: recordService.updateRecord(principal, request.params.id, body)
    })
  }));

  router.post('/records/:id/deletion', createMutationHandler({
    mutations,
    method: 'POST',
    validate: withPathId(validateDeletion),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: recordService.setRecordDeletion(principal, request.params.id, body)
    })
  }));

  router.get('/source-records/:kind/:id', (req, res) => {
    const query = validateSourceRecordsPath(req.params.kind, req.params.id, version);
    validateNoQuery(req.query);
    res.json(recordService.listSourceRecords(requirePrincipal(req), query));
  });

  return router;
}
