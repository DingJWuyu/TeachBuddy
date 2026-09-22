import { createMaterialsLessons } from "./materials.js";
// Lessons module entry point. The workbench composition root mounts the
// returned router under /api/modules/lessons and passes the questions port.
import { createLessonsRepository } from "./repository.js";
import { createLessonsRouter } from "./router.js";
import { createLessonsService } from "./service.js";
import { migrations } from "./migrations/index.js";

export function createLessonsModule({
  db,
  mutations,
  questions,
  resources,
  math,
  content,
  jobs,
  files,
  now,
} = {}) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError(
      "createLessonsModule requires a better-sqlite3 Database instance.",
    );
  }
  if (!mutations || typeof mutations.execute !== "function") {
    throw new TypeError(
      "createLessonsModule requires the mutations.execute seam.",
    );
  }
  if (
    !questions ||
    (typeof questions.readForReference !== "function" &&
      typeof questions.readForReferenceV2 !== "function")
  ) {
    throw new TypeError(
      "createLessonsModule requires the questions.readForReference port.",
    );
  }

  const repository = createLessonsRepository(db);
  const service = createLessonsService({ repository, questions, now });
  const router = createLessonsRouter({ service, mutations });

  const materials = createMaterialsLessons({
    repository,
    mutations,
    questions,
    resources,
    content,
    db,
    jobs,
    files,
    now,
  });
  router.use("/v2", materials.router);
  const v3 = math ? createMaterialsLessons({ version: 3, math, repository, mutations, questions, resources, content, db, jobs, files, now }) : null;
  if (v3) router.use("/v3", v3.router);
  return { router, port: { ...materials.port, operations: { ...materials.port.operations, ...v3?.port.operations },
    ...(v3 ? { listUsagesV3: v3.port.listUsages } : {}),
    readForTeachingLink(principal, id) { const { id: lessonId, version, title, deletedAt } = materials.requireLesson(principal,id); return { id: lessonId, version, title, deletedAt }; }
  }, jobHandlers: materials.jobHandlers };
}

export { migrations };
// Callable business surface for future agent adapters (C25/C26); it has no
// HTTP dependency, so a caller can invoke the same operations the API uses.
export { createLessonsService } from "./service.js";
