import { createMathAdapter } from '../../math-adapter.js';
/**
 * T51 test-only fixture module: the real classes module wired with the missing
 * `lessons.readForTeachingLink` provider.
 *
 * T53 will add that read port to the lessons module itself. Until then this
 * fixture projects the real lessons service (same database, same account
 * checks, same tombstones) into the frozen `LessonReference` shape, so the
 * classes module and its browser tests run against real lesson data instead of
 * a fabricated provider. It is never part of a production implementation map.
 */
import { createClassesModule as createProductClassesModule } from '../../../../../src/modules/classes/index.js';
import { createLessonsRepository } from '../../../../../src/modules/lessons/repository.js';
import { createLessonsService } from '../../../../../src/modules/lessons/service.js';

// The production factory signature has no clock (the module uses the server
// clock); a test process can fix it here so contract timestamps are
// reproducible. Never set outside a test harness.
let fixtureClock = null;

export function setClassesFixtureClock(clock) {
  fixtureClock = clock;
}

export function createClassesModule({ db, mutations, questions, now } = {}) {
  const effectiveNow = now ?? fixtureClock ?? undefined;
  const lessonsService = createLessonsService({
    repository: createLessonsRepository(db),
    questions,
    now: effectiveNow
  });

  const lessons = {
    readForTeachingLink(principal, lessonId) {
      const lesson = lessonsService.getLesson(principal, lessonId);
      return {
        id: lesson.id,
        version: lesson.version,
        title: lesson.title,
        deletedAt: lesson.deletedAt
      };
    }
  };

  return createProductClassesModule({
    db,
    mutations,
    questions,
    lessons,
    math: createMathAdapter(db),
    now: effectiveNow
  });
}
