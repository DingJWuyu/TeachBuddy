// Frozen R30 ResourceReference/Usage adapter, not the R34 lessons implementation.
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { validateSchema } from "../../../../api/src/workbench/content/schema.js";
import { materialErrors } from "../../../../api/src/workbench/jobs/router.js";
export function lessonsAdapter({ db, resources, mutations }) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS r32_fixture_references (id TEXT PRIMARY KEY, accountKey TEXT NOT NULL, value TEXT NOT NULL)",
  );
  const router = Router();
  const readRows = (principal) =>
    db
      .prepare("SELECT value FROM r32_fixture_references WHERE accountKey=?")
      .all(principal.accountKey)
      .map((r) => JSON.parse(r.value));
  db.exec(
    "CREATE TABLE IF NOT EXISTS r32_fixture_lessons (accountKey TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
  const lessonId = "00000000-0000-4000-8000-000000000701";
  const readLesson = (principal) => {
    const row = db
      .prepare("SELECT value FROM r32_fixture_lessons WHERE accountKey=?")
      .get(principal.accountKey);
    return row
      ? JSON.parse(row.value)
      : {
          id: lessonId,
          version: 1,
          createdAt: "2026-09-22T00:00:00Z",
          updatedAt: "2026-09-22T00:00:00Z",
          deletedAt: null,
          title: "函数复习课",
          intro: { version: 2, blocks: [] },
          sections: [],
          materials: [],
        };
  };
  // The resource picker now uses v3. This resource-only adapter exposes the
  // same lesson at both paths; real v3 composition is covered separately.
  router.get(["/api/modules/lessons/v2/items", "/api/modules/lessons/v3"], (req, res) =>
    res.json({ items: [readLesson(req.workbenchPrincipal)] }),
  );
  router.get(["/api/modules/lessons/v2/items/:id", "/api/modules/lessons/v3/:id"], (req, res) =>
    res.json(readLesson(req.workbenchPrincipal)),
  );
  router.put(["/api/modules/lessons/v2/items/:id", "/api/modules/lessons/v3/:id"], (req, res, next) => {
    try {
      validateSchema("UpdateLesson", req.body);
      const result = mutations.execute(
        {
          principal: req.workbenchPrincipal,
          key: req.get("Idempotency-Key"),
          method: "PUT",
          path: req.path,
          body: req.body,
        },
        () => {
          const old = readLesson(req.workbenchPrincipal);
          if (old.version !== req.body.baseVersion)
            throw Object.assign(new Error("conflict"), {
              status: 409,
              problem: {
                type: "/problems/workbench/version-conflict",
                currentVersion: old.version,
              },
            });
          const adopt = (input) => {
            const existing = [
              ...old.materials,
              ...old.sections.flatMap((s) => s.references),
            ].find((r) => r.id === input.id);
            const source = resources.readForReferenceV2(
              req.workbenchPrincipal,
              input.resourceId,
            );
            if (
              existing &&
              existing.resourceId === input.resourceId &&
              existing.resourceVersion === input.resourceVersion
            )
              return { ...existing, note: input.note };
            if (source.deletedAt || source.version !== input.resourceVersion)
              throw Object.assign(new Error("reference conflict"), {
                status: 409,
                problem: {
                  type: "/problems/materials/reference-version-conflict",
                  kind: "resource",
                  id: source.id,
                  currentVersion: source.version,
                },
              });
            return {
              ...input,
              snapshot: source.snapshot,
              sourceState: "active",
              latestVersion: source.version,
            };
          };
          const { baseVersion, ...input } = req.body;
          const lesson = {
            ...old,
            ...input,
            version: old.version + 1,
            updatedAt: new Date().toISOString(),
            materials: input.materials.map(adopt),
            sections: input.sections.map((s) => ({
              ...s,
              references: s.references.map(adopt),
            })),
          };
          validateSchema("Lesson", lesson);
          db.prepare(
            "INSERT INTO r32_fixture_lessons VALUES (?,?) ON CONFLICT(accountKey) DO UPDATE SET value=excluded.value",
          ).run(req.workbenchPrincipal.accountKey, JSON.stringify(lesson));
          return { status: 200, body: lesson };
        },
      );
      res.status(result.status).json(result.body);
    } catch (e) {
      next(e);
    }
  });
  router.post("/fixture/adopt", (req, res, next) => {
    try {
      const source = resources.readForReferenceV2(
        req.workbenchPrincipal,
        req.body.resourceId,
      );
      if (source.deletedAt)
        return res
          .status(409)
          .json({ type: "/problems/workbench/object-deleted" });
      if (source.version !== req.body.resourceVersion)
        return res.status(409).json({
          type: "/problems/materials/reference-version-conflict",
          kind: "resource",
          id: source.id,
          currentVersion: source.version,
        });
      const existing = readRows(req.workbenchPrincipal).find(
        (r) => r.id === req.body.id,
      );
      if (existing && existing.resourceId !== source.id)
        return res.status(422).json({
          type: "/problems/workbench/invalid-input",
          field: "/resourceId",
          reason: "invalid-reference",
        });
      const reference = {
        id: existing?.id ?? randomUUID(),
        kind: "resource",
        resourceId: source.id,
        resourceVersion: source.version,
        note: existing?.note ?? "课堂保留注记",
        snapshot: source.snapshot,
        sourceState: "active",
        latestVersion: source.version,
      };
      validateSchema("ResourceReference", reference);
      db.prepare(
        "INSERT INTO r32_fixture_references VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      ).run(
        reference.id,
        req.workbenchPrincipal.accountKey,
        JSON.stringify(reference),
      );
      res.json(reference);
    } catch (e) {
      next(e);
    }
  });
  router.get("/fixture/references", (req, res) =>
    res.json({
      items: readRows(req.workbenchPrincipal).map((r) => {
        const current = resources.readForReferenceV2(
          req.workbenchPrincipal,
          r.resourceId,
        );
        return {
          ...r,
          latestVersion: current.version,
          sourceState: current.deletedAt ? "deleted" : "active",
        };
      }),
    }),
  );
  router.get(
    "/api/modules/lessons/v2/resource-usages/:id",
    (req, res, next) => {
      try {
        resources.readForReferenceV2(req.workbenchPrincipal, req.params.id);
        const result = {
          items: [
            ...readRows(req.workbenchPrincipal),
            ...readLesson(req.workbenchPrincipal).materials,
            ...readLesson(req.workbenchPrincipal).sections.flatMap(
              (s) => s.references,
            ),
          ]
            .filter((r) => r.resourceId === req.params.id)
            .map((r) => ({
              lessonId: "00000000-0000-4000-8000-000000000701",
              lessonTitle: "函数复习课",
              sectionId: null,
              sectionTitle: null,
              referenceId: r.id,
              adoptedVersion: r.resourceVersion,
            })),
        };
        validateSchema("UsageList", result);
        res.json(result);
      } catch (e) {
        next(e);
      }
    },
  );
  materialErrors(router);
  return router;
}
