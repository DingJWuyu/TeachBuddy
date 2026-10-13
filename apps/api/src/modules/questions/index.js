import { createQuestionsOperations } from "./operations.js";
import { createAssetHandler } from "./assets.js";
import { createWordReader } from "./native-word.js";
import { createPdfReader } from "./native-pdf.js";
import { createMaterialsStore } from "./materials-store.js";
import { createMaterialsService } from "./materials-service.js";
import { createMaterialsRouter } from "./materials-router.js";
import { createExtractionHandler } from "./extraction.js";
// Questions module entry point. The workbench composition root mounts the
// returned router under /api/modules/questions.
import { createQuestionsRepository } from "./repository.js";
import { createQuestionsRouter } from "./router.js";
import { createQuestionsService } from "./service.js";
import { migrations } from "./migrations/index.js";

export function createQuestionsModule({
  db,
  mutations,
  now,
  files,
  content,
  jobs,
  provider,
  recognition,
} = {}) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError(
      "createQuestionsModule requires a better-sqlite3 Database instance.",
    );
  }
  if (!mutations || typeof mutations.execute !== "function") {
    throw new TypeError(
      "createQuestionsModule requires the mutations.execute seam.",
    );
  }

  const repository = createQuestionsRepository(db);
  // Document v1 can belong to a current material question. Its metadata is
  // authoritative: the legacy shape cannot represent answer state or taxonomy.
  const materialMetadata = db.prepare('SELECT 1 FROM questions_materials_meta WHERE id=?');
  const service = createQuestionsService({ repository, now, hasMaterialMetadata: id => Boolean(materialMetadata.get(id)) });
  const operations = createQuestionsOperations({ service, mutations });
  const router = createQuestionsRouter({ operations });

  const store = createMaterialsStore(db, repository, now);
  const materials = createMaterialsService({ store, files, content, jobs });
  const v2 = createMaterialsRouter({ service: materials.service, mutations });
  router.use(v2.router);
  const jobHandlers = {
    "question-asset": createAssetHandler({ store, files }),
    extraction: createExtractionHandler({
      store,
      files,
      jobs,
      provider,
      recognition,
      content,
      validateLocations: materials.locations,
      readWord: files ? createWordReader(files) : undefined,
      readPdf: files ? createPdfReader(files) : undefined,
    }),
  };

  return {
    router,
    operations,
    jobHandlers,
    port: {
      operations: v2.operations,
      readForExport(principal) {
        return {
          questions: store.questions(principal),
          taxonomy: store.taxonomy(principal),
          imports: store.list("imports", principal),
          recognitionEvidence: store.list("tasks", principal)
            .filter(task => Object.keys(task.lateResults ?? {}).length || Object.keys(task.nativeWordSources ?? {}).length)
            .map(task => ({ jobId: task.id, importId: task.importId, lateResults: task.lateResults, nativeWordSources: task.nativeWordSources, originalDocuments: task.originalDocuments })),
        };
      },
      readForReferenceV2(principal, id) {
        return materials.service.readQuestionForReferenceV2({ principal, id });
      },
      readForReference(principal, questionId) {
        return service.readForReference(principal, questionId);
      },
    },
  };
}

export { migrations };
// Callable business surface for future agent adapters (C25/C26); it has no
// HTTP dependency, so a caller can invoke the same operations the API uses.
export { createQuestionsService } from "./service.js";

// Account lifecycle owned by this module; the composition root owns the transaction.
export function deleteAccountData(db, accountKey) {
  for (const table of ['question_items', 'questions_materials_meta', 'questions_materials_imports', 'questions_materials_taxonomy', 'questions_materials_tasks'])
    db.prepare(`DELETE FROM ${table} WHERE accountKey=?`).run(accountKey);
}
