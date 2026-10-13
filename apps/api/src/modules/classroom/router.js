import { Router } from 'express';
import { asyncHandler, readIdempotencyKey, canonicalRequestPath } from '../../workbench/http.js';
import { contractError, problems } from '../../workbench/problems.js';
import { routes } from './operations.js';
export function createClassroomRouter({
  operations
}) {
  const router = Router();
  for (const [name, method, path] of routes) {
    router[method.toLowerCase()](path, asyncHandler(async (req, res) => {
      if (method !== 'GET' && req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw contractError(problems.unsupportedMediaType());
      }
      const result = await operations[name]({
        principal: req.workbenchPrincipal,
        requestPath: canonicalRequestPath(req),
        arguments: {
          ...req.params,
          body: req.body,
          query: req.query
        },
        key: method === 'GET' ? undefined : () => readIdempotencyKey(req)
      });
      res.status(result.status).json(result.body);
    }));
  }
  return router;
}
