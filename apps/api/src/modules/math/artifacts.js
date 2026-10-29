import { MathSourceError } from "@teachbuddy/shared/math/expression";
import { mathError } from "./contract.js";
import { readHtml, dynamicPresentation, isolatedHtml } from "./presentation.js";
import { renderSource, rendererVersion, workshopRendererVersion } from "./render.js";
import { renderWorkshop } from "./workshop-render.js";
import { workshopPresentation } from "./workshop-presentation.js";

// Preparation may persist immutable files through store(bytes, name), but never
// commits a work, revision or export receipt. The service rechecks and commits
// those only after preparation succeeds. Keep storage names stable for old keys.
export function createMathArtifacts({ files, mathRuntimeDirectory }) {
  function assertAvailable(principal, work) {
    for (const id of [
      work.render.posterFileId,
      work.render.graphPosterFileId,
      work.render.presentationFileId,
      work.source.kind === "html" ? work.source.fileId : null,
      work.originalFileId,
    ])
      if (id) files.read(principal, id);
    return work;
  }

  async function prepareWork(source, { title, principal, store }) {
    let render;
    try {
      if (source.kind === "workshop") {
        const output = await renderWorkshop(source, { runtimeDirectory: mathRuntimeDirectory });
        const poster = await store(output.bytes, "math-workshop-poster.png");
        const graph = output.graphBytes ? await store(output.graphBytes, "math-workshop-graph.png") : null;
        const presentation = await store(await workshopPresentation(source, {
          title, formulaAssets: output.formulaAssets, runtimeDirectory: mathRuntimeDirectory,
        }), "math-workshop-classroom.zip");
        render = {
          state: "ready", posterFileId: poster.id, graphPosterFileId: graph?.id ?? null,
          presentationFileId: presentation.id, reason: null,
        };
      } else if (source.kind === "geogebra") {
        render = { state: "source-only", posterFileId: null, presentationFileId: null, reason: null };
      } else if (source.kind === "html") {
        const html = await readHtml(files, principal, source.fileId);
        const presentation = html.text === null ? null
          : await store(Buffer.from(isolatedHtml(html.text)), "math-presentation.html");
        render = {
          state: "source-only", posterFileId: null,
          presentationFileId: presentation?.id ?? null, reason: null,
        };
      } else {
        const poster = await store(await renderSource(source), "math-poster.png");
        const presentation = source.kind === "dynamic"
          ? await store(await dynamicPresentation(source), "math-presentation.html") : null;
        render = {
          state: "ready", posterFileId: poster.id,
          presentationFileId: presentation?.id ?? null, reason: null,
        };
      }
    } catch (error) {
      if (!(error instanceof MathSourceError)) throw error;
      render = {
        state: "invalid", posterFileId: null, presentationFileId: null,
        reason: error.reason,
        ...(source.kind === "workshop" ? { graphPosterFileId: null } : {}),
      };
    }
    return {
      render,
      rendererVersion: source.kind === "workshop" ? workshopRendererVersion : rendererVersion,
    };
  }

  async function prepareExport(saved, input, { principal, store }) {
    const { format, background, width, selection = "work", formulaId } = input;
    const workshop = saved.source.kind === "workshop";
    if (
      (format === "html" && !saved.render.presentationFileId) ||
      (saved.source.kind === "html" && !["html", "source"].includes(format)) ||
      (saved.source.kind === "geogebra" && format !== "source") ||
      (saved.render.state === "invalid" && format !== "source") ||
      (saved.source.kind === "formula" && background !== "transparent") ||
      (["source", "html", "bundle", "ggb"].includes(format) && (width !== 1600 || background !== "transparent")) ||
      (!workshop && (["bundle", "ggb"].includes(format) || input.selection !== undefined || formulaId !== undefined)) ||
      (workshop && ((selection === "formula") !== (formulaId !== undefined))) ||
      (workshop && ["source", "bundle"].includes(format) && selection !== "work") ||
      (workshop && format === "ggb" && (selection !== "graph" || !saved.source.graph)) ||
      (workshop && format === "bundle" && !saved.render.presentationFileId) ||
      (workshop && format === "html") ||
      (workshop && selection === "formula" && background !== "transparent")
    ) throw mathError("unsupported-export");

    let file;
    if (["html", "bundle"].includes(format)) {
      // Read the bytes as well as metadata: a missing blob must still fail even
      // though this export reuses the revision's original presentation File.
      const stream = await files.open(principal, saved.render.presentationFileId);
      for await (const chunk of stream) void chunk;
      file = files.read(principal, saved.render.presentationFileId);
    } else {
      let bytes;
      if (format === "ggb") bytes = Buffer.from(saved.source.graph.base64, "base64");
      else if (format === "source") bytes = saved.source.kind === "html"
        ? (await readHtml(files, principal, saved.source.fileId)).bytes
        : Buffer.from(JSON.stringify(saved.source, null, 2));
      else {
        assertAvailable(principal, saved);
        bytes = workshop
          ? (await renderWorkshop(saved.source, { ...input, runtimeDirectory: mathRuntimeDirectory })).bytes
          : await renderSource(saved.source, input);
      }
      const extension = format === "source" ? (saved.source.kind === "html" ? "html" : "json") : format;
      file = await store(bytes, `math-${saved.id}-v${input.version}.${extension}`);
    }
    return {
      file,
      offline: format === "bundle" ? "self-contained" : format === "html"
        ? saved.source.kind === "dynamic" ? "self-contained" : "unverified"
        : "not-applicable",
    };
  }

  return { prepareWork, prepareExport, assertAvailable };
}
