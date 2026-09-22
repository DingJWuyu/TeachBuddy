// HTTP wiring for lessons. All reference resolution happens inside the
// idempotent write transaction opened by the shared mutation handler; request
// schema (path, query, body) is validated before the key is confirmed.
import { Router } from 'express';
import { createMutationHandler, withPathId } from '../../workbench/http.js';
import { validateIdPath, validateNoQuery } from '../../workbench/schema.js';
import { unauthenticated } from '../questions/contract.js';
import {
  validateCreateLesson,
  validateLessonsQuery,
  validateSetDeletion,
  validateUpdateLesson
} from '../questions/schema.js';

function requirePrincipal(req) {
  const principal = req.workbenchPrincipal;
  if (!principal || typeof principal.accountKey !== 'string' || principal.accountKey.length === 0) {
    throw unauthenticated();
  }
  return principal;
}

export function createLessonsRouter({ service, mutations }) {
  const router = Router();

  router.get('/items', (req, res) => {
    validateLessonsQuery(req.query);
    const principal = requirePrincipal(req);
    res.json(service.listLessons(principal, req.query));
  });

  router.post('/items', createMutationHandler({
    mutations,
    method: 'POST',
    validate: validateCreateLesson,
    write: ({ principal, body }) => ({
      status: 201,
      body: service.createLesson(principal, body)
    })
  }));

  router.get('/items/:id', (req, res) => {
    validateIdPath(req.params.id);
    validateNoQuery(req.query);
    const principal = requirePrincipal(req);
    res.json(service.getLesson(principal, req.params.id));
  });

  router.put('/items/:id', createMutationHandler({
    mutations,
    method: 'PUT',
    validate: withPathId(validateUpdateLesson),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.updateLesson(principal, request.params.id, body)
    })
  }));

  router.post('/items/:id/deletion', createMutationHandler({
    mutations,
    method: 'POST',
    validate: withPathId(validateSetDeletion),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.setLessonDeletion(principal, request.params.id, body)
    })
  }));

  router.get('/question-usages/:questionId', (req, res) => {
    validateIdPath(req.params.questionId, '/path/questionId');
    validateNoQuery(req.query);
    const principal = requirePrincipal(req);
    res.json(service.listQuestionUsages(principal, req.params.questionId));
  });

  return router;
}
