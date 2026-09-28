import path from "node:path";
import { randomUUID } from "node:crypto";
import { exportTree, generateDocx } from "./output.js";
import { convertFile } from "../../workbench/files/converter.js";
import { materialsError } from "../../workbench/jobs/index.js";
import { contractError, invalidInput, problems } from "../../workbench/problems.js";
const docxType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export function createLessonExports({
  db,
  jobs,
  files,
  getLesson,
  now = () => new Date(),
}) {
  const rows = db.prepare(
    "SELECT * FROM lesson_exports WHERE accountKey=? AND lessonId=? ORDER BY createdAt DESC,id",
  );
  const find = db.prepare(
    "SELECT * FROM lesson_exports WHERE accountKey=? AND json_extract(record,'$.jobId')=?",
  );
  function list(principal, id) {
    getLesson(principal, id);
    return {
      items: rows.all(principal.accountKey, id).map((r) => {
        const record = JSON.parse(r.record);
        return {
          ...record,
          fileId:
            jobs.get(principal, record.jobId).state === "succeeded"
              ? record.fileId
              : null,
        };
      }),
    };
  }
  function create(principal, input, id) {
    const lesson = getLesson(principal, id);
    if (lesson.version !== input.baseVersion)
      throw contractError(problems.versionConflict(lesson.version));
    if (lesson.deletedAt) throw contractError(problems.objectDeleted());
    const blocks = exportTree(lesson, input);
    const pageTypes = new Set(["application/pdf", "application/msword", "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", "image/png", "image/jpeg", "image/webp"]);
    for (const block of blocks.filter(b => b.type === "resource-pages")) {
      if (!pageTypes.has(files.read(principal, block.fileId).mediaType))
        throw invalidInput("/resourcePageReferenceIds", "out-of-range");
    }
    const job = jobs.enqueue({
      principal,
      kind: "export",
      target: { kind: "lesson", id, version: lesson.version },
    });
    const record = {
      id: randomUUID(),
      lessonId: id,
      lessonVersion: lesson.version,
      options: input,
      jobId: job.id,
      fileId: null,
      createdAt: now().toISOString(),
    };
    db.prepare("INSERT INTO lesson_exports VALUES(?,?,?,?,?,?)").run(
      record.id,
      principal.accountKey,
      id,
      record.createdAt,
      JSON.stringify(record),
      JSON.stringify({ title: lesson.title, blocks }),
    );
    return record;
  }
  function remove(principal, id) {
    for (const row of rows.all(principal.accountKey, id)) {
      const { jobId } = JSON.parse(row.record);
      const state = jobs.get(principal, jobId).state;
      if (["queued", "running", "cancelling"].includes(state)) {
        jobs.cancel(principal, jobId, {
          key: randomUUID(),
          method: "POST",
          path: `/internal/lessons/${id}/exports/${jobId}/cancel`,
        });
      }
    }
    db.prepare("DELETE FROM lesson_exports WHERE accountKey=? AND lessonId=?")
      .run(principal.accountKey, id);
  }
  const handler = {
    async run({ principal, job, signal, reportProgress }) {
      const row = find.get(principal.accountKey, job.id);
      if (!row) throw new Error("Missing accepted export");
      const record = JSON.parse(row.record),
        snapshot = JSON.parse(row.snapshot);
      let stage = "generate";
      try {
        if (record.fileId) {
          files.read(principal, record.fileId);
          return {
            state: "succeeded",
            outputFileIds: [record.fileId],
            issues: [],
          };
        }
        reportProgress({ completed: 0, total: 3, unit: "stages" });
        const blocks = [];
        for (const block of snapshot.blocks) {
          signal.throwIfAborted();
          if (block.type !== "resource-pages") { blocks.push(block); continue; }
          stage = "resources";
          let preview;
          try {
            preview = await files.ensurePreview(principal, block.fileId, { signal });
            if (preview.state !== "ready" || !preview.pages.length) throw new Error("Resource pages unavailable");
          } catch (error) {
            throw Object.assign(error, {
              resourceDetail: `“${block.title}”未能完整转换。请预览原件核对，或取消这份资源的“按原页插入”后重新生成。`,
              problem: { field: block.field },
            });
          }
          for (const page of preview.pages) blocks.push({ type: "image", fileId: page.imageFileId,
            alt: `${block.title} · 第 ${page.page} 页`, widthMm: 165, pageImage: true, field: block.field });
        }
        stage = "generate";
        const docx = await generateDocx(blocks, { files, principal, signal });
        signal.throwIfAborted();
        reportProgress({ completed: 1, total: 3, unit: "stages" });
        stage = "convert";
        const converted = await convertFile({
          bytes: docx,
          mediaType: docxType,
          directory: path.join(path.dirname(db.name), "lesson-conversions"),
          signal,
        });
        if (
          !converted.pdf ||
          !converted.pages.length ||
          converted.state === "limited"
        )
          throw new Error("Output validation failed");
        signal.throwIfAborted();
        reportProgress({ completed: 2, total: 3, unit: "stages" });
        stage = "write";
        const file = await files.store(
          principal,
          {
            name: `${snapshot.title.slice(0, 150)}-${record.options.kind}.${record.options.format}`,
            mediaType:
              record.options.format === "pdf" ? "application/pdf" : docxType,
            bytes: record.options.format === "pdf" ? converted.pdf : docx,
          },
          {
            key: record.id,
            method: "POST",
            path: `/internal/lessons/exports/${record.id}`,
          },
        );
        signal.throwIfAborted();
        record.fileId = file.id;
        db.prepare(
          "UPDATE lesson_exports SET record=? WHERE id=? AND accountKey=?",
        ).run(JSON.stringify(record), record.id, principal.accountKey);
        reportProgress({ completed: 3, total: 3, unit: "stages" });
        return { state: "succeeded", outputFileIds: [file.id], issues: [] };
      } catch (error) {
        return {
          state: "failed",
          outputFileIds: [],
          issues: [
            {
              code: signal.aborted
                ? "cancelled"
                : stage === "generate" && !error.pandocFailure
                  ? "missing-asset"
                  : stage === "write"
                    ? "disk-full"
                    : "conversion-failed",
              unitId: null,
              field: error.problem?.field ?? null,
              detail:
                error.resourceDetail ?? "文件未生成，已保存的备课和旧输出仍保留。修复后重新生成。",
            },
          ],
        };
      }
    },
  };
  function readForExport(principal) {
    const saved = db.prepare("SELECT id,record,snapshot FROM lesson_exports WHERE accountKey=?").all(principal.accountKey);
    return {
      exports: saved.map(row => JSON.parse(row.record)),
      exportSnapshots: saved.map(row => ({ id: row.id, snapshot: JSON.parse(row.snapshot) })),
    };
  }
  return { create, list, remove, handler, readForExport };
}
