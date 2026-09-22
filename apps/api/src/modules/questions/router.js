// HTTP wiring for the question bank. The shared workbench HTTP layer owns
// identity resolution, the request pipeline and problem mapping; this router
// supplies the operation's own schema and translates validated requests into
// idempotent business writes. Every route validates its path and query before
// any business state is touched, matching the frozen processing order.
import { Router } from 'express';
import { createMutationHandler, withPathId } from '../../workbench/http.js';
import { validateIdPath, validateNoQuery } from '../../workbench/schema.js';
import { unauthenticated } from './contract.js';
import {
  validateCopyQuestion,
  validateCreateQuestion,
  validateDerivativesQuery,
  validateQuestionsQuery,
  validateSetDeletion,
  validateUpdateQuestion
} from './schema.js';

function requirePrincipal(req) {
  const principal = req.workbenchPrincipal;
  if (!principal || typeof principal.accountKey !== 'string' || principal.accountKey.length === 0) {
    throw unauthenticated();
  }
  return principal;
}

export function createQuestionsRouter({ service, mutations }) {
  const router = Router();

  router.get('/items', (req, res) => {
    validateQuestionsQuery(req.query);
    const principal = requirePrincipal(req);
    res.json(service.listQuestions(principal, req.query));
  });

  router.post('/items', createMutationHandler({
    mutations,
    method: 'POST',
    validate: validateCreateQuestion,
    write: ({ principal, body }) => ({
      status: 201,
      body: service.createQuestion(principal, body)
    })
  }));

  router.get('/items/:id', (req, res) => {
    validateIdPath(req.params.id);
    validateNoQuery(req.query);
    const principal = requirePrincipal(req);
    res.json(service.getQuestion(principal, req.params.id));
  });

  router.put('/items/:id', createMutationHandler({
    mutations,
    method: 'PUT',
    validate: withPathId(validateUpdateQuestion),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.updateQuestion(principal, request.params.id, body)
    })
  }));

  router.get('/items/:id/copies', (req, res) => {
    validateIdPath(req.params.id);
    validateDerivativesQuery(req.query);
    const principal = requirePrincipal(req);
    res.json(service.listDerivatives(principal, req.params.id, req.query));
  });

  router.post('/items/:id/copies', createMutationHandler({
    mutations,
    method: 'POST',
    validate: withPathId(validateCopyQuestion),
    write: ({ principal, body, request }) => ({
      status: 201,
      body: service.copyQuestion(principal, request.params.id, body)
    })
  }));

  router.post('/items/:id/deletion', createMutationHandler({
    mutations,
    method: 'POST',
    validate: withPathId(validateSetDeletion),
    write: ({ principal, body, request }) => ({
      status: 200,
      body: service.setQuestionDeletion(principal, request.params.id, body)
    })
  }));

  return router;
}
