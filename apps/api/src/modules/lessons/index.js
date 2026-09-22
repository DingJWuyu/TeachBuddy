import { createLessonsOperations } from './operations.js';
// Lessons module entry point. The workbench composition root mounts the
// returned router under /api/modules/lessons and passes the questions port.
import { createLessonsRepository } from './repository.js';
import { createLessonsRouter } from './router.js';
import { createLessonsService } from './service.js';
import { migrations } from './migrations/index.js';

export function createLessonsModule({ db, mutations, questions, now } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('createLessonsModule requires a better-sqlite3 Database instance.');
  }
  if (!mutations || typeof mutations.execute !== 'function') {
    throw new TypeError('createLessonsModule requires the mutations.execute seam.');
  }
  if (!questions || typeof questions.readForReference !== 'function') {
    throw new TypeError('createLessonsModule requires the questions.readForReference port.');
  }

  const repository = createLessonsRepository(db);
  const service = createLessonsService({ repository, questions, now });
  const operations = createLessonsOperations({ service, mutations });
  const router = createLessonsRouter({ operations });

  return { router, operations };
}

export { migrations };
// Callable business surface for future agent adapters (C25/C26); it has no
// HTTP dependency, so a caller can invoke the same operations the API uses.
export { createLessonsService } from './service.js';
