import { stableRequestKey as stableKey } from "./request-key.js";
import { AssetGenerationError, renderQuestionPng } from "./png-render.js";

export function createAssetHandler({ store: s, files, logger }) {
  return {
    async run({ principal: p, job, signal, reportProgress }) {
      const task = s.get("tasks", p, job.id);
      if (task.outputFileIds.length)
        return { state: "succeeded", outputFileIds: task.outputFileIds, issues: [] };
      const output = [];
      try {
        async function bytes(id) {
          const chunks = [];
          for await (const c of await files.open(p, id)) chunks.push(c);
          return Buffer.concat(chunks);
        }
        const sections = task.options.mode === "figure-png"
          ? [[{ type: "image", fileId: task.options.figureFileId }]]
          : [task.question.body.blocks];
        if (task.options.includeAnswers && task.options.mode === "question-png")
          sections.push(task.question.solution.blocks);
        const images = await renderQuestionPng(sections, { bytes, signal });
        for (const [index, png] of images.entries()) {
          signal.throwIfAborted();
          let file;
          try { file = await files.store(p, {
            name: `题面-${index + 1}.png`, mediaType: "image/png", bytes: png,
          }, {
            // Keys derive from the job, so a rerun after restart reuses stored PNGs instead of duplicating them.
            key: stableKey(job.id, index + 1), method: "POST", path: "/questions/assets/" + job.id,
          });
          } catch (error) {
            throw new AssetGenerationError(error.code === "ENOSPC" ? "disk-full" : "asset-storage-failed", "output-store", error);
          }
          output.push(file.id);
        }
        signal.throwIfAborted();
        if (!output.length) throw Error("无可输出题面");
        try { s.save("tasks", p, { ...task, outputFileIds: output }); }
        catch (error) {
          throw new AssetGenerationError(error.code === "ENOSPC" ? "disk-full" : "asset-storage-failed", "output-publish", error);
        }
        reportProgress({ completed: output.length, total: output.length, unit: "stages" });
        return { state: "succeeded", outputFileIds: output, issues: [] };
      } catch (error) {
        if (signal.aborted) throw error;
        const failure = error instanceof AssetGenerationError ? error :
          new AssetGenerationError("asset-render-failed", "generation", error);
        // Log only classified facts. Browser/SQLite messages may contain paths,
        // embedded markup, credentials or teacher content.
        const cause = failure.cause;
        const code = /^(?:SQLITE_[A-Z_]+|E[A-Z0-9]+)$/.test(cause?.code ?? "") ? cause.code : "unknown";
        const name = ["Error", "TypeError", "RangeError", "TimeoutError", "SqliteError"].includes(cause?.name) ? cause.name : "Error";
        logger?.error(`question-asset job=${job.id}`, Object.assign(
          new Error(`stage=${failure.stage}; cause=${name}; code=${code}`), { code: failure.code }));
        return {
          state: "failed", outputFileIds: [],
          issues: [{ code: failure.code, unitId: null, field: failure.field,
            detail: failure.code === "unsupported-formula" ? "公式无法排版，请修改后重新生成。" :
              ["missing-asset", "asset-image-failed"].includes(failure.code) ? "配图无法读取，请检查后重新生成。" : "生成未完成，可重新生成" }],
        };
      }
    },
  };
}
