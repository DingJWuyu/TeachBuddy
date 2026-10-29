import { createQuestionBusinessOperations } from "./business.js";
import { createQuestionsOperations } from "./operations.js";
import { createAssetHandler } from "./assets.js";
import { createWordReader } from "./native-word.js";
import { createPdfReader } from "./native-pdf.js";
import { createMaterialsStore } from "./materials-store.js";
import { createMaterialsService } from "./materials-service.js";
import { createMaterialsOperations } from "./materials-operations.js";
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
  logger,
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
  const materialOperations = createMaterialsOperations({ service: materials.service, mutations });
  router.use(createMaterialsRouter({ operations: materialOperations }));
  const jobHandlers = {
    "question-asset": createAssetHandler({ store, files, logger }),
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
    jobHandlers,
    port: {
      operations: materialOperations,
      businessOperations: createQuestionBusinessOperations({ legacy: operations, current: materialOperations }),
    },
  };
}

export { migrations };
