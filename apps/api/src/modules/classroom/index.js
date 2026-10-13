import { createClassroomRepository, kinds } from './repository.js';
import { createRoster } from './roster.js';
import { createTags } from './tags.js';
import { createImports } from './imports.js';
import { createAssessment } from './assessment.js';
import { createClassroomStatistics } from './statistics.js';
import { createClassroomOperations } from './operations.js';
import { createClassroomRouter } from './router.js';
import { account } from './problems.js';
export { migrations } from './migrations/index.js';
export { validateStoredData } from './stored-data.js';
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
    port: {
      readForExport(principal) {
        const key = account(principal);
        return Object.fromEntries(kinds.map(kind => [kind, repository.list(kind, key)]));
      }
    }
  };
}
export function deleteAccountData(db, accountKey) {
  for (const kind of kinds) {
    db.prepare(`DELETE FROM classroom_${kind} WHERE accountKey=?`).run(accountKey);
  }
}
