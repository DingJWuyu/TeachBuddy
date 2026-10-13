import { createMathAdapter } from '../../math-adapter.js';
// Test-only fixed clock and math adapter for the real classes module.
import { createClassesModule as createProductClassesModule } from '../../../../../src/modules/classes/index.js';

// The production factory signature has no clock (the module uses the server
// clock); a test process can fix it here so contract timestamps are
// reproducible. Never set outside a test harness.
let fixtureClock = null;

export function setClassesFixtureClock(clock) {
  fixtureClock = clock;
}

export function createClassesModule({ db, mutations, questions, now } = {}) {
  const effectiveNow = now ?? fixtureClock ?? undefined;
  return createProductClassesModule({
    db,
    mutations,
    questions,
    math: createMathAdapter(db),
    now: effectiveNow
  });
}
