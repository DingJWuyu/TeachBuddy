import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  ImportedXmlComponent,
  Packer,
  HeadingLevel,
  WidthType,
} from "docx";
import sharp from "sharp";
import { formulaOmml } from "./formula.js";
import { materialsError } from "../../workbench/jobs/index.js";
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
    if (ref.kind === "resource") {
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
  const validate = (items) =>
    items.forEach((b) => {
      if (b.type === "math") formulaOmml(b.latex, b.field);
      b.runs?.forEach((r, i) => {
        if (r.type === "math") formulaOmml(r.latex, `${b.field}/runs/${i}`);
      });
      b.items?.forEach((i) => validate(i.blocks));
      b.rows?.forEach((row) => row.forEach((c) => validate(c.blocks)));
    });
  validate(blocks);
  return blocks;
}
export async function generateDocx(blocks, { files, principal }) {
  const bytes = async (id) => {
    const chunks = [];
    for await (const chunk of await files.open(principal, id))
      chunks.push(chunk);
    return Buffer.concat(chunks);
  };
  const inline = (r) =>
    r.type === "math"
      ? ImportedXmlComponent.fromXmlString(formulaOmml(r.latex))
      : new TextRun({ text: r.text, font: "Noto Sans CJK SC", size: 22 });
  async function render(items, keepLastNext = false) {
    const result = [];
    for (const [index, b] of items.entries()) {
      const keepNext = b.keepNext || (keepLastNext && index === items.length - 1);
      if (b.type === "paragraph" || b.type === "heading")
        result.push(
          new Paragraph({
            children: b.runs.map(inline),
            heading:
              b.type === "heading"
                ? b.level === 1
                  ? HeadingLevel.HEADING_1
                  : HeadingLevel.HEADING_2
                : undefined,
            spacing: { after: 120, line: 300 },
            widowControl: true,
            keepNext: b.type === "heading" || keepNext,
          }),
        );
      else if (b.type === "math")
        result.push(
          new Paragraph({
            children: [
              ImportedXmlComponent.fromXmlString(formulaOmml(b.latex, b.field)),
            ],
            spacing: { before: 100, after: 140 },
            keepLines: true,
            keepNext,
          }),
        );
      else if (b.type === "image") {
        const raw = await bytes(b.fileId);
        const image = sharp(raw, { limitInputPixels: 40000000 });
        const meta = await image.metadata();
        const scale = Math.min(
          (b.widthMm * 96) / 25.4 / meta.width,
          650 / meta.height,
        );
        const png = await image.png().toBuffer();
        result.push(
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: png,
                transformation: {
                  width: Math.round(meta.width * scale),
                  height: Math.round(meta.height * scale),
                },
                altText: {
                  title: b.alt ?? "",
                  description: b.alt ?? "",
                  name: "题图",
                },
              }),
            ],
            keepLines: true,
            keepNext,
          }),
        );
      } else if (b.type === "list") {
        for (const [itemIndex, item] of b.items.entries()) {
          const keepItemNext = keepNext && itemIndex === b.items.length - 1;
          const [first, ...rest] = item.blocks;
          if (first?.type === "paragraph")
            result.push(
              ...(await render(
                [
                  {
                    ...first,
                    runs: [
                      { type: "text", text: item.label + " " },
                      ...first.runs,
                    ],
                  },
                  ...rest,
                ],
                keepItemNext,
              )),
            );
          else
            result.push(
              new Paragraph({ text: item.label, keepNext: true }),
              ...(await render(item.blocks, keepItemNext)),
            );
        }
      } else if (b.type === "table") {
        const rows = [];
        for (const [rowIndex, row] of b.rows.entries()) {
          const cells = [];
          for (const cell of row)
            cells.push(
              new TableCell({
                children: cell.blocks.length
                  ? await render(
                      cell.blocks,
                      keepNext && rowIndex === b.rows.length - 1,
                    )
                  : [
                      new Paragraph({
                        text: "",
                        keepNext: keepNext && rowIndex === b.rows.length - 1,
                      }),
                    ],
              }),
            );
          rows.push(new TableRow({ children: cells, cantSplit: true }));
        }
        result.push(
          new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        );
      }
    }
    return result;
  }
  const children = await render(blocks);
  return Packer.toBuffer(
    new Document({
      creator: "",
      title: "",
      description: "",
      styles: {
        default: {
          document: {
            run: { font: "Noto Sans CJK SC", size: 22 },
            paragraph: { spacing: { line: 300, after: 120 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
            },
          },
          children,
        },
      ],
    }),
  );
}
