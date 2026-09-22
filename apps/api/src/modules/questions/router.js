import { Router } from 'express';
import { readIdempotencyKey } from '../../workbench/http.js';
import { validateNoQuery } from '../../workbench/schema.js';
import { contractError, problems } from '../../workbench/problems.js';
import { routes, createQuestionsOperations } from './operations.js';

export function createQuestionsRouter({ operations, service, mutations }) {
  operations ??= createQuestionsOperations({ service, mutations });
  const router = Router();
  for (const [id, method, route] of routes) {
    router[method.toLowerCase()](route, (req, res) => {
      const args = { ...req.params };
      if (method === 'GET' && ['listQuestions', 'listLessons', 'listDerivatives'].includes(id)) args.query = req.query;
      else validateNoQuery(req.query);
      if (method !== 'GET') {
        if (req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw contractError(problems.unsupportedMediaType());
        args.body = req.body;
      }
      const result = operations[id]({ principal: req.workbenchPrincipal, arguments: args,
        key: method === 'GET' ? undefined : () => readIdempotencyKey(req) });
      res.status(result.status).json(result.body);
    });
  }
  return router;
}
