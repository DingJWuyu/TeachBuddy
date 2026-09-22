/**
 * Fixture lessons module factory. T53 replaces this substitute with the real
 * lessons module plus its `readForTeachingLink` export.
 */
import { createLessonsFixtureModule } from './router.js';

export function createLessonsModule({ db } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Fixture lessons module requires the shared database.');
  }
  return createLessonsFixtureModule({ db });
}

export { migrations } from './migrations/index.js';
