import { validateFormulas } from "./formula.js";
import { materialsError } from "../../workbench/jobs/index.js";
import { visibleWorkshopFormulas } from "../../../../../packages/shared/src/math/workshop.js";
export { generateDocx } from "./pandoc.js";
const para = (text) => ({ type: "paragraph", runs: [{ type: "text", text }] });
const heading = (text) => ({
  type: "heading",
  level: 1,
  runs: [{ type: "text", text }],
});

export function exportTree(lesson, options) {
  const selected = lesson.sections.filter((s) =>
    options.sectionIds.includes(s.id),
  );
  if (
    new Set(options.sectionIds).size !== options.sectionIds.length ||
    new Set(options.materialReferenceIds).size !==
      options.materialReferenceIds.length ||
    selected.length !== options.sectionIds.length ||
    options.materialReferenceIds.some(
      (id) => !lesson.materials.some((r) => r.id === id),
    )
  )
    throw materialsError("invalid-export-selection");
  const references = [...lesson.materials, ...lesson.sections.flatMap(s => s.references)];
  const excluded = new Set(options.excludedReferenceIds ?? []);
  const overrides = new Map((options.answerSpaceOverrides ?? []).map(item => [item.referenceId, item.lines]));
  const resourcePages = new Set(options.resourcePageReferenceIds ?? []);
  if (excluded.size !== (options.excludedReferenceIds ?? []).length ||
      [...excluded].some(id => !references.some(r => r.id === id)) ||
      overrides.size !== (options.answerSpaceOverrides ?? []).length ||
      [...overrides.keys()].some(id => !references.some(r => r.id === id && (r.kind ?? "question") === "question")) ||
      resourcePages.size !== (options.resourcePageReferenceIds ?? []).length ||
      [...resourcePages].some(id => !references.some(r => r.id === id && r.kind === "resource")))
    throw materialsError("invalid-export-selection");
  const notes = [],
    answers = [],
    blocks = [heading(lesson.title)];
  let number = 0;
  const filter = (items, field, offset = 0) =>
    items.flatMap((block, i) => {
      const pointer = `${field}/${i + offset}`;
      if (block.type === "teacher-note") {
        if (options.includeTeacherNotes)
          notes.push(...filter(block.blocks, `${pointer}/blocks`));
        return [];
      }
      const next = { ...block, field: pointer };
      if (block.items)
        next.items = block.items.map((item, j) => ({
          ...item,
          blocks: filter(item.blocks, `${pointer}/items/${j}/blocks`),
        }));
      if (block.rows)
        next.rows = block.rows.map((row, j) =>
          row.map((cell, k) => ({
            ...cell,
            blocks: filter(cell.blocks, `${pointer}/rows/${j}/${k}/blocks`),
          })),
        );
      return [next];
    });
  const reference = (ref, field) => {
    if (excluded.has(ref.id)) return;
    const answerSpaceLines = overrides.get(ref.id) ?? options.answerSpaceLines;
    if (ref.kind === "math") {
      if (options.kind !== "practice") {
        const source = ref.snapshot.source;
        blocks.push({ ...para(ref.snapshot.title), keepNext: true });
        if (source.kind === "workshop") {
          for (const formula of visibleWorkshopFormulas(source)) {
            const index = source.formulas.findIndex(item => item.id === formula.id);
            blocks.push({ type: "math", latex: formula.latex, field: `${field}/snapshot/source/formulas/${index}/latex` });
            if (formula.includeCaption && formula.caption) blocks.push(para(formula.caption));
          }
          if (ref.snapshot.graphPosterFileId) blocks.push({ type: "image", fileId: ref.snapshot.graphPosterFileId, alt: ref.snapshot.title, widthMm: 150, field });
        } else if (source.kind === "formula") {
          blocks.push({ type: "math", latex: source.latex, field: `${field}/snapshot/source/latex` });
          if (source.includeCaption && source.caption) blocks.push(para(source.caption));
        } else if (source.kind === "html") blocks.push(para("交互演示见单独文件"));
        else blocks.push({ type: "image", fileId: ref.snapshot.posterFileId, alt: ref.snapshot.title, widthMm: 150, field });
      }
    } else if (ref.kind === "resource") {
      if (options.kind !== "practice") {
        blocks.push(para(`${ref.snapshot.title} · ${ref.snapshot.fileName}`));
        if (resourcePages.has(ref.id)) blocks.push({ type: "resource-pages", fileId: ref.snapshot.fileId, title: ref.snapshot.title, field });
      }
    } else {
      number++;
      const question = { type: "question", blocks: [
        para(`${number}. ${ref.snapshot.title}`),
        ...filter(ref.snapshot.body.blocks, `${field}/snapshot/body/blocks`),
      ] };
      blocks.push(question);
      if (options.kind !== "lesson-plan" && answerSpaceLines > 0) {
        // Retain the initial writing area below the required question content.
        // The rest can flow across pages without enlarging its reading group.
        const attachedLines = Math.min(answerSpaceLines, 4);
        for (let i = 0; i < attachedLines; i++) question.blocks.push(para(" "));
        for (let i = attachedLines; i < answerSpaceLines; i++)
          blocks.push(para(" "));
      }
      if (options.includeAnswers && ref.snapshot.solution.blocks.length)
        answers.push(
          para(`${number}.`),
          ...filter(
            ref.snapshot.solution.blocks,
            `${field}/snapshot/solution/blocks`,
          ),
        );
    }
    if (options.includeTeacherNotes && ref.note) notes.push(para(ref.note));
  };
  if (options.kind !== "practice")
    blocks.push(...filter(lesson.intro.blocks, "/intro/blocks"));
  else if (options.includeTeacherNotes)
    filter(lesson.intro.blocks, "/intro/blocks");
  lesson.sections.forEach((s, i) => {
    if (!options.sectionIds.includes(s.id)) return;
    if (options.kind !== "practice") blocks.push(heading(s.title));
    for (let position = 0; position <= s.content.blocks.length; position++) {
      if (position > 0) {
        const body = filter([s.content.blocks[position - 1]], `/sections/${i}/content/blocks`, position - 1);
        if (options.kind !== "practice") blocks.push(...body);
      }
      s.references.forEach((r, j) => {
        if ((r.afterBlock ?? s.content.blocks.length) === position) reference(r, `/sections/${i}/references/${j}`);
      });
    }
  });
  const materials = lesson.materials.filter((r) =>
    options.materialReferenceIds.includes(r.id) && !excluded.has(r.id),
  );
  if (materials.length && options.kind !== "practice")
    blocks.push(heading("备用材料"));
  lesson.materials.forEach((r, i) => {
    if (options.materialReferenceIds.includes(r.id))
      reference(r, `/materials/${i}`);
  });
  if (options.kind === "practice" && !number)
    throw materialsError("invalid-export-selection");
  if (answers.length) blocks.push(heading("答案与解析"), ...answers);
  if (notes.length) blocks.push(heading("教师注记"), ...notes);
  // Validate only the filtered distribution tree. Excluded answers cannot
  // obstruct or leak into student outputs, even when their formula is invalid.
  const formulas = [];
  const validate = (items) =>
    items.forEach((b) => {
      if (b.type === "math") formulas.push({ latex: b.latex, field: b.field });
      b.runs?.forEach((r, i) => {
        if (r.type === "math") formulas.push({ latex: r.latex, field: `${b.field}/runs/${i}` });
      });
      b.items?.forEach((i) => validate(i.blocks));
      b.rows?.forEach((row) => row.forEach((c) => validate(c.blocks)));
      if (b.blocks) validate(b.blocks);
    });
  validate(blocks);
  validateFormulas(formulas);
  return blocks;
}
