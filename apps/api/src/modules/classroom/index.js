import { createClassroomRepository } from './repository.js';
import { createRoster } from './roster.js';
import { createTags } from './tags.js';
import { createImports } from './imports.js';
import { createAssessment } from './assessment.js';
import { createClassroomStatistics } from './statistics.js';
import { createClassroomOperations } from './operations.js';
import { createClassroomRouter } from './router.js';
export { migrations } from './migrations/index.js';
export function createClassroomModule({
  db,
  mutations,
  files,
  clock
}) {
  if (!db?.prepare || !mutations?.execute || !mutations?.peek || !files?.read || !files?.open) {
    throw new TypeError('classroom requires database, mutations and managed files.');
  }
  const repository = createClassroomRepository(db),
    roster = createRoster({
      repository,
      clock
    }),
    tags = createTags({
      repository,
      clock
    }),
    imports = createImports({
      repository,
      files,
      clock
    }),
    assessment = createAssessment({
      repository,
      files,
      clock,
      imports
    }),
    statistics = createClassroomStatistics({
      repository
    });
  const operations = createClassroomOperations({
    roster,
    tags,
    imports,
    assessment,
    statistics,
    mutations
  });
  return {
    router: createClassroomRouter({
      operations
    }),
    operations,

  };
}
