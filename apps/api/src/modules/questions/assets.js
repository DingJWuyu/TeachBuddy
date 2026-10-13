import { stableRequestKey as stableKey } from "./request-key.js";
import { renderQuestionPng } from "./png-render.js";

export function createAssetHandler({ store: s, files }) {
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
          const file = await files.store(p, {
            name: `题面-${index + 1}.png`, mediaType: "image/png", bytes: png,
          }, {
            key: stableKey(job.id, index + 1), method: "POST", path: "/questions/assets/" + job.id,
          });
          output.push(file.id);
        }
        signal.throwIfAborted();
        if (!output.length) throw Error("无可输出题面");
        s.save("tasks", p, { ...task, outputFileIds: output });
        reportProgress({ completed: output.length, total: output.length, unit: "stages" });
        return { state: "succeeded", outputFileIds: output, issues: [] };
      } catch {
        return {
          state: "failed", outputFileIds: [],
          issues: [{ code: "unsupported-formula", unitId: null, field: "/body", detail: "素材生成失败，请检查公式和配图。" }],
        };
      }
    },
  };
}
