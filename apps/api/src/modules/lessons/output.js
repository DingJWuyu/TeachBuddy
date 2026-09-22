import { validateFormulas } from "./formula.js";
import { materialsError } from "../../workbench/jobs/index.js";
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
  const notes = [],
    answers = [],
    blocks = [heading(lesson.title)];
  let number = 0;
  const filter = (items, field) =>
    items.flatMap((block, i) => {
      const pointer = `${field}/${i}`;
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
    if (ref.kind === "math") {
      if (options.kind !== "practice") {
        const source = ref.snapshot.source;
        blocks.push(para(ref.snapshot.title));
        if (source.kind === "formula") {
          blocks.push({ type: "math", latex: source.latex, field: `${field}/snapshot/source/latex` });
          if (source.includeCaption && source.caption) blocks.push(para(source.caption));
        } else if (source.kind === "html") blocks.push(para("交互演示见单独文件"));
        else blocks.push({ type: "image", fileId: ref.snapshot.posterFileId, alt: ref.snapshot.title, widthMm: 150, field });
      }
    } else if (ref.kind === "resource") {
      if (options.kind !== "practice")
        blocks.push(para(`${ref.snapshot.title} · ${ref.snapshot.fileName}`));
    } else {
      number++;
      blocks.push(
        { ...para(`${number}. ${ref.snapshot.title}`), keepNext: true },
        ...filter(ref.snapshot.body.blocks, `${field}/snapshot/body/blocks`),
      );
      if (options.kind !== "lesson-plan" && options.answerSpaceLines > 0) {
        // Keep the initial writing area with the question ending. Four lines
        // fit below even our tallest image on A4; longer spaces must be free
        // to continue across pages instead of forming an oversized keep chain.
        const attachedLines = Math.min(options.answerSpaceLines, 4);
        blocks.at(-1).keepNext = true;
        for (let i = 0; i < options.answerSpaceLines; i++)
          blocks.push({
            ...para(" "),
            keepNext: i < attachedLines - 1,
          });
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
    const body = filter(s.content.blocks, `/sections/${i}/content/blocks`);
    if (options.kind !== "practice") blocks.push(heading(s.title), ...body);
    s.references.forEach((r, j) =>
      reference(r, `/sections/${i}/references/${j}`),
    );
  });
  const materials = lesson.materials.filter((r) =>
    options.materialReferenceIds.includes(r.id),
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
    });
  validate(blocks);
  validateFormulas(formulas);
  return blocks;
}
