// Classes module entry point. The workbench composition root mounts the router
// under /api/modules/classes and passes the questions and math ports; the
// returned port serves schedule and the reverse feedback panels.
import { createClassesRepository } from './repository.js';
import { createClassesRouter } from './router.js';
import { createClassesService } from './service.js';
import { migrations } from './migrations/index.js';

export function createClassesModule({ db, mutations, questions, math, content, enableV2 = math !== undefined, now } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('createClassesModule requires a better-sqlite3 Database instance.');
  }
  if (!mutations || typeof mutations.execute !== 'function') {
    throw new TypeError('createClassesModule requires the mutations.execute seam.');
  }
  if (!questions || typeof questions.readForReferenceV2 !== 'function') {
    throw new TypeError('createClassesModule requires the questions.readForReferenceV2 port.');
  }

  if (enableV2 && typeof math?.readForTeachingLinkV1 !== 'function') {
    throw new TypeError('classes v2 requires math.readForTeachingLinkV1 on the same database.');
  }

  const repository = createClassesRepository(db);
  const service = createClassesService({ repository, questions, math, content, now });
  const router = createClassesRouter({ service, mutations });

  if (enableV2) router.use('/v2', createClassesRouter({ service, mutations, version: 2 }));

  return {
    router,
    port: {
      readForExport: service.readForExport,
      ...(enableV2 ? { listSourceRecordsV2: service.listSourceRecordsV2 } : {}),
      readClass(principal, id) {
        return service.readClass(principal, id);
      },
      readRecord(principal, id) {
        return service.readRecord(principal, id);
      },
      listSourceRecords(principal, query) {
        return service.listSourceRecords(principal, query);
      }
    }
  };
}

export { migrations };
// Callable business surface for future agent adapters; it has no HTTP
// dependency, so a caller can invoke the same operations the API uses.
export { createClassesService } from './service.js';

// Account lifecycle owned by this module; the composition root owns the transaction.
export function deleteAccountData(db, accountKey) {
  for (const table of ['classes_record_sources', 'classes_records', 'classes_removed_objects', 'classes_items'])
    db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
