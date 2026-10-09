import { constructionIssue } from "../../../../../packages/shared/src/math/geometry.js";
import { parameterOnGrid } from "../../../../../packages/shared/src/math/dynamic.js";
import { ContractError } from "../../workbench/problems.js";
import yauzl from "yauzl";
import { crc32 } from "node:zlib";
import { validateWorkshopSourceShape } from "../../../../../packages/shared/src/math/workshop.js";
export { contract, validate } from "../../workbench/content/mathSchema.js";
export function mathError(type, field = "", reason = type, status = 422) {
  return new ContractError(status, {
    type: `/problems/math/${type}`,
    ...(field === undefined ? {} : { field }),
    ...(reason === undefined ? {} : { reason }),
  });
}
export function validateSourceRelations(source) {
  const bad = (field, reason) => {
    throw mathError("invalid-math-source", `/source${field}`, reason);
  };
  if (source.schemaVersion !== 1)
    throw mathError("unsupported-work-version", "/source/schemaVersion");
  if (!["formula", "plane", "space", "dynamic", "html", "geogebra", "workshop"].includes(source.kind))
    throw mathError("unsupported-work-version", "/source/kind");
  if (source.kind === "workshop") {
    try { validateWorkshopSourceShape(source); }
    catch (error) { throw workshopContractError(error); }
  }
  validateDynamic(source);
  const view = source.scene?.viewport ?? source.viewport;
  if (view && (view.xMin >= view.xMax || view.yMin >= view.yMax))
    bad("/viewport", "invalid-range");
  const unique = (items, field) => {
    const ids = new Set();
    items.forEach((item, i) => {
      if (ids.has(item.id)) bad(`${field}/${i}/id`, "duplicate-id");
      ids.add(item.id);
    });
    return ids;
  };
  if (["plane", "dynamic"].includes(source.kind)) {
    unique(source.scene.elements, "/scene/elements");
    const issue = constructionIssue(source.scene.elements);
    if (issue) bad(`/scene/elements/${source.scene.elements.findIndex(e => e.id === issue)}/construction`, 'invalid-reference');
    source.scene.elements.forEach((e, i) => {
      if (e.type === "function" && e.domain.min >= e.domain.max)
        bad(`/scene/elements/${i}/domain`, "invalid-range");
    });
  }
  if (source.kind === "space") {
    const ids = unique(source.points, "/points");
    unique(source.edges, "/edges");
    unique(source.faces ?? [], '/faces'); unique(source.sections ?? [], '/sections');
    (source.faces ?? []).forEach((face, i) => { if (face.vertices.some(id => !ids.has(id))) bad(`/faces/${i}`, 'invalid-reference'); });
    source.edges.forEach((e, i) => {
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to)
        bad(`/edges/${i}`, "invalid-reference");
    });
  }
}

// Native GGB files are ZIP archives. Bound both their stored and expanded sizes,
// and read every entry so corrupt compression, lengths and CRCs cannot be saved.
export async function validateGeoGebraSource(source) {
  if (source.kind !== "geogebra" && !(source.kind === "workshop" && source.graph)) return;
  const base64 = source.kind === "workshop" ? source.graph.base64 : source.base64;
  const bad = () => mathError("invalid-math-source", source.kind === "workshop" ? "/source/graph/base64" : "/source/base64", "invalid-geogebra-file");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64 || !bytes.length) throw bad();
  const expandedLimit = 16 * 1024 * 1024;
  try {
    await new Promise((resolve, reject) => {
      yauzl.fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
        if (error) return reject(error);
        let expanded = 0, count = 0, hasConstruction = false;
        const fail = (issue) => { zip.close(); reject(issue); };
        zip.on("error", fail);
        zip.on("end", () => hasConstruction ? resolve() : reject(bad()));
        zip.on("entry", (entry) => {
          expanded += entry.uncompressedSize;
          if (++count > 1024 || expanded > expandedLimit) return fail(bad());
          if (entry.fileName.endsWith("/")) return zip.readEntry();
          zip.openReadStream(entry, (issue, stream) => {
            if (issue) return fail(issue);
            let size = 0, checksum = 0;
            stream.on("error", fail);
            stream.on("data", (chunk) => {
              size += chunk.length;
              if (size > entry.uncompressedSize || size > expandedLimit) {
                stream.destroy(bad());
                return;
              }
              checksum = crc32(chunk, checksum);
            });
            stream.on("end", () => {
              if (size !== entry.uncompressedSize || checksum !== entry.crc32) return fail(bad());
              if (entry.fileName === "geogebra.xml" && size > 0) hasConstruction = true;
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      });
    });
  } catch {
    throw bad();
  }
}

export function workshopContractError(error) {
  if (error?.code !== "invalid-workshop") return error;
  return mathError("invalid-math-source", error.field, error.reason);
}

export function validateDynamic(source) {
  if (source.kind !== "dynamic") return;
  const bad = (field) => {
    throw mathError(
      "invalid-math-source",
      `/source/${field}`,
      "invalid-reference",
    );
  };
  const names = new Set();
  source.parameters.forEach((p, i) => {
    if (
      names.has(p.name) ||
      [
        "x",
        "pi",
        "e",
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "sqrt",
        "abs",
        "exp",
        "ln",
        "log10",
      ].includes(p.name) ||
      p.min >= p.max ||
      p.step <= 0 ||
      !parameterOnGrid(p, p.initial) ||
      !parameterOnGrid(p, p.max)
    )
      bad(`parameters/${i}`);
    names.add(p.name);
  });
  const elements = new Map(source.scene.elements.map((e) => [e.id, e]));
  if (source.animation && !names.has(source.animation.parameter)) bad('animation/parameter');
  (source.traceIds ?? []).forEach((id, i) => { if (elements.get(id)?.type !== 'point') bad(`traceIds/${i}`); });
  const bound = new Set();
  source.drags.forEach((d, i) => {
    const point = elements.get(d.pointId);
    if (
      !point ||
      point.type !== "point" || point.construction ||
      bound.has(d.pointId) ||
      (!d.xParameter && !d.yParameter)
    )
      bad(`drags/${i}`);
    for (const axis of ["x", "y"])
      if (
        d[`${axis}Parameter`] !== null &&
        (!names.has(d[`${axis}Parameter`]) ||
          point.at[axis] !== d[`${axis}Parameter`])
      )
        bad(`drags/${i}`);
    bound.add(d.pointId);
  });
  const steps = new Set();
  source.steps.forEach((step, i) => {
    if (
      steps.has(step.id) ||
      new Set(step.visibleIds).size !== step.visibleIds.length ||
      step.visibleIds.some((id) => !elements.has(id)) ||
      step.values.length !== names.size ||
      new Set(step.values.map((v) => v.name)).size !== names.size
    )
      bad(`steps/${i}`);
    step.values.forEach((v) => {
      const p = source.parameters.find((p) => p.name === v.name);
      if (!p || !parameterOnGrid(p, v.value)) bad(`steps/${i}/values`);
    });
    steps.add(step.id);
  });
  if (
    source.steps.length
      ? !steps.has(source.initialStepId)
      : source.initialStepId !== null
  )
    bad("initialStepId");
}
