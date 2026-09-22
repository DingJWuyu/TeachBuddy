import { createQuestionsOperations } from './operations.js';
// Questions module entry point. The workbench composition root mounts the
// returned router under /api/modules/questions and hands the port to lessons.
import { createQuestionsRepository } from './repository.js';
import { createQuestionsRouter } from './router.js';
import { createQuestionsService } from './service.js';
import { migrations } from './migrations/index.js';

export function createQuestionsModule({ db, mutations, now } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('createQuestionsModule requires a better-sqlite3 Database instance.');
  }
  if (!mutations || typeof mutations.execute !== 'function') {
    throw new TypeError('createQuestionsModule requires the mutations.execute seam.');
  }

  const repository = createQuestionsRepository(db);
  const service = createQuestionsService({ repository, now });
  const operations = createQuestionsOperations({ service, mutations });
  const router = createQuestionsRouter({ operations });

  return {
    router,
    operations,
    port: {
      readForReference(principal, questionId) {
        return service.readForReference(principal, questionId);
      }
    }
  };
}

export { migrations };
// Callable business surface for future agent adapters (C25/C26); it has no
// HTTP dependency, so a caller can invoke the same operations the API uses.
export { createQuestionsService } from './service.js';
