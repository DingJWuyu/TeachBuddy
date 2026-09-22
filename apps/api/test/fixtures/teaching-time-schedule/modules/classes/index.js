/**
 * Fixture classes module factory: the T52 substitute for the T51 provider.
 * The public port shape follows the frozen architecture table; the HTTP surface
 * is fixture-only.
 */
import { createClassesFixtureModule } from './router.js';

export function createClassesModule({ db } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Fixture classes module requires the shared database.');
  }
  return createClassesFixtureModule({ db });
}

export { migrations } from './migrations/index.js';
